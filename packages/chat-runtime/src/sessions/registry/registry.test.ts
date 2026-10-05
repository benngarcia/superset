import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { AdapterEvent, HarnessAdapter } from "../../harness";
import { FakeHarness } from "../../harness/fake";
import { agentMessage, turn } from "../../testing/fixtures";
import { createTestRuntime } from "../../testing/testRuntime";
import { journalEnvelopes, waitFor } from "../../testing/testUtils";
import type { HarnessRegistry, SessionChange } from "./registry";

const HARNESS = "registry-fake";

function idleAdapter(): HarnessAdapter {
	return new FakeHarness({ turns: [] });
}

function registryOf(factory: () => HarnessAdapter): HarnessRegistry {
	return new Map([[HARNESS, factory]]);
}

function onDispose(after: () => void): HarnessAdapter {
	const inner = new FakeHarness({ turns: [] });
	return {
		start: (options) => inner.start(options),
		prompt: (content) => inner.prompt(content),
		cancelTurn: () => inner.cancelTurn(),
		respondToApproval: (id, decision) => inner.respondToApproval(id, decision),
		setMode: (modeId) => inner.setMode(modeId),
		dispose: async () => {
			await inner.dispose();
			after();
		},
	};
}

function createSession(runtime: ReturnType<typeof createTestRuntime>): string {
	return runtime.commands.createSession({
		commandId: randomUUID(),
		scopeId: "workspace-1",
		harness: HARNESS,
		cwd: "/tmp/workspace",
	}).sessionId;
}

describe("LiveSessionRegistry", () => {
	test("refuses to replace a session that is already running", async () => {
		const runtime = createTestRuntime({ harnesses: registryOf(idleAdapter) });
		const sessionId = createSession(runtime);

		expect(() =>
			runtime.live.create({
				sessionId,
				scopeId: "workspace-1",
				harness: HARNESS,
				cwd: "/tmp/workspace",
			}),
		).toThrow(/already running/);

		await runtime.dispose();
	});

	test("unregisters and disposes a session whose start throws", async () => {
		let disposed = false;
		const runtime = createTestRuntime({
			harnesses: registryOf(() => ({
				start: (): AsyncIterable<AdapterEvent> => {
					throw new Error("spawn failed");
				},
				prompt: () => undefined,
				cancelTurn: () => undefined,
				respondToApproval: () => undefined,
				setMode: () => undefined,
				dispose: async () => {
					disposed = true;
				},
			})),
		});

		expect(() => createSession(runtime)).toThrow("spawn failed");
		expect(runtime.sessions.list()).toEqual([]);
		expect(disposed).toBe(true);

		await runtime.dispose();
	});

	test("settles every disposal and still closes the database when one fails", async () => {
		let secondDisposed = false;
		let created = 0;
		const runtime = createTestRuntime({
			harnesses: registryOf(() => {
				created += 1;
				return created === 1
					? onDispose(() => {
							throw new Error("adapter teardown failed");
						})
					: onDispose(() => {
							secondDisposed = true;
						});
			}),
		});

		createSession(runtime);
		createSession(runtime);

		await expect(runtime.dispose()).rejects.toThrow("adapter teardown failed");
		expect(secondDisposed).toBe(true);
		expect(() => runtime.sessions.list()).toThrow();
	});
});

describe("LiveSessionRegistry onSessionChanged", () => {
	function oneTurnAdapter(): HarnessAdapter {
		return new FakeHarness({
			turns: [
				[
					{ kind: "session", session: { status: "running" } },
					{ kind: "turn", turn: turn("t1") },
					{ kind: "item", item: agentMessage("a1", "done"), turnId: "t1" },
					{
						kind: "turn",
						turn: turn("t1", { status: "completed", completedAtMs: 2 }),
					},
					{ kind: "session", session: { status: "idle" } },
					{ kind: "session", session: { status: "idle", title: "Done" } },
				],
			],
		});
	}

	async function runOneTurn(): Promise<{
		changes: SessionChange[];
		sessionEvents: number;
	}> {
		const changes: SessionChange[] = [];
		const runtime = createTestRuntime({
			harnesses: registryOf(oneTurnAdapter),
			onSessionChanged: (change) => changes.push(change),
		});
		const sessionId = createSession(runtime);
		runtime.commands.prompt({
			commandId: randomUUID(),
			sessionId,
			clientId: "client-1",
			content: [{ type: "text", text: "hi" }],
		});
		await waitFor(() => runtime.sessions.get(sessionId)?.status === "idle");
		const sessionEvents = journalEnvelopes(runtime, sessionId).filter(
			(envelope) => envelope.event.type === "session",
		).length;
		await runtime.commands.closeSession({ sessionId });
		await runtime.dispose();
		return { changes, sessionEvents };
	}

	test("reports creation, each status change, and close", async () => {
		const { changes } = await runOneTurn();

		expect(
			changes.map(({ status, live, scopeId }) => ({ status, live, scopeId })),
		).toEqual([
			{ status: "starting", live: true, scopeId: "workspace-1" },
			{ status: "running", live: true, scopeId: "workspace-1" },
			{ status: "idle", live: true, scopeId: "workspace-1" },
			{ status: "idle", live: false, scopeId: "workspace-1" },
		]);
	});

	test("skips session events that keep the same status", async () => {
		const { changes, sessionEvents } = await runOneTurn();

		const liveChanges = changes.filter((change) => change.live).length;
		expect(sessionEvents).toBeGreaterThan(liveChanges);
	});
});
