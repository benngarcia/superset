import { describe, expect, it } from "bun:test";
import { runTeleport } from "@superset/shared/teleport-driver";
import { composeTeleportOperations } from "./composeTeleportOperations";
import type {
	HandoffEntry,
	PublishedCapture,
	ReadyDestination,
	TeleportDestinationEndpoint,
	TeleportSourceEndpoint,
} from "./endpoints/types";

interface Fakes {
	log: string[];
	source: TeleportSourceEndpoint;
	destination: TeleportDestinationEndpoint;
	trees: string[];
	handoffs: HandoffEntry[][];
}

function fakes({
	trees = ["tree-1", "tree-1"],
	handoffs = [[], []],
}: Partial<Pick<Fakes, "trees" | "handoffs">> = {}): Fakes {
	const log: string[] = [];
	let publishes = 0;
	let handoffCalls = 0;
	const ready: ReadyDestination = {
		workspaceId: "dest-ws",
		arrive: async (ref, branch) => {
			log.push(`arrive ${ref} on ${branch}`);
		},
		seedAgents: async () => {
			log.push("seed agents");
		},
		launchAgent: async (agent, prompt) => {
			log.push(`launch ${agent}: ${prompt}`);
		},
	};
	const source: TeleportSourceEndpoint = {
		workspaceId: "src-ws",
		state: async () => ({
			branch: "feature/x",
			worktreePath: "/repo",
			workingTree: {
				modified: 1,
				untracked: 0,
				preciousFiles: 0,
				unpushedCommits: 0,
			},
		}),
		refusalFor: async () => null,
		handoff: async () => {
			log.push("handoff");
			return handoffs[Math.min(handoffCalls++, handoffs.length - 1)] ?? [];
		},
		publish: async (unlessWorkingTree): Promise<PublishedCapture> => {
			const workingTree = trees[Math.min(publishes++, trees.length - 1)] ?? "";
			const unchanged =
				unlessWorkingTree !== undefined && workingTree === unlessWorkingTree;
			log.push(`publish${unchanged ? " (unchanged)" : ""}`);
			return { ref: "refs/superset/teleport/src-ws", workingTree, unchanged };
		},
		discard: async () => {
			log.push("discard");
		},
	};
	const destination: TeleportDestinationEndpoint = {
		prepare: async () => {
			log.push("prepare");
			return ready;
		},
	};
	return { log, source, destination, trees, handoffs };
}

describe("composeTeleportOperations", () => {
	it("starts the destination before the capture and arrives once when nothing changed", async () => {
		const f = fakes();
		const result = await runTeleport(
			composeTeleportOperations({
				source: f.source,
				destination: f.destination,
				branch: "feature/x",
			}),
			() => {},
		);
		expect(result.failedAt).toBeNull();
		expect(result.destinationWorkspaceId).toBe("dest-ws");
		expect(f.log.indexOf("prepare")).toBeLessThan(f.log.indexOf("publish"));
		expect(f.log.filter((line) => line.startsWith("arrive"))).toEqual([
			"arrive refs/superset/teleport/src-ws on feature/x",
		]);
		expect(f.log.indexOf("publish (unchanged)")).toBeLessThan(
			f.log.indexOf("discard"),
		);
	});

	it("arrives a second time when the source changed after the pre-copy", async () => {
		const f = fakes({ trees: ["tree-1", "tree-2"] });
		await runTeleport(
			composeTeleportOperations({
				source: f.source,
				destination: f.destination,
				branch: "main",
			}),
			() => {},
		);
		expect(f.log.filter((line) => line.startsWith("arrive"))).toHaveLength(2);
		expect(f.log).not.toContain("publish (unchanged)");
	});

	it("hands agents their latest transcripts, after the host seeded its presets", async () => {
		const f = fakes({
			handoffs: [
				[{ terminalId: "t1", agent: "claude", prompt: "early" }],
				[
					{ terminalId: "t1", agent: "claude", prompt: "later" },
					{ terminalId: "t2", agent: "codex", prompt: "new pane" },
				],
			],
		});
		await runTeleport(
			composeTeleportOperations({
				source: f.source,
				destination: f.destination,
				branch: "main",
			}),
			() => {},
		);
		const launches = f.log.filter((line) => line.startsWith("launch"));
		expect(launches).toEqual([
			"launch claude: later",
			"launch codex: new pane",
		]);
		expect(f.log.indexOf("seed agents")).toBeLessThan(
			f.log.indexOf(launches[0] ?? ""),
		);
	});

	it("reports the destination id as soon as it is ready", async () => {
		const f = fakes();
		const seen: string[] = [];
		await runTeleport(
			composeTeleportOperations({
				source: f.source,
				destination: f.destination,
				branch: "main",
				onDestinationReady: (id) => seen.push(id),
			}),
			() => {},
		);
		expect(seen).toEqual(["dest-ws"]);
	});

	it("fails the move at createWorktree when the destination cannot be made", async () => {
		const f = fakes();
		const destination: TeleportDestinationEndpoint = {
			prepare: async () => {
				throw new Error("no room");
			},
		};
		const result = await runTeleport(
			composeTeleportOperations({
				source: f.source,
				destination,
				branch: "main",
			}),
			() => {},
		);
		expect(result.failedAt).toBe("createWorktree");
		expect(result.error).toBe("no room");
	});
});
