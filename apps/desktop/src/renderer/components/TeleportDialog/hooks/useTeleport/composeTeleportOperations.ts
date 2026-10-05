import type { TeleportOperations } from "@superset/shared/teleport-driver";
import type {
	HandoffEntry,
	PublishedCapture,
	ReadyDestination,
	TeleportDestinationEndpoint,
	TeleportSourceEndpoint,
} from "./endpoints/types";

export interface ComposeTeleportOperationsInput {
	source: TeleportSourceEndpoint;
	destination: TeleportDestinationEndpoint;
	branch: string;
	/** The destination checkout's id, as soon as it exists. */
	onDestinationReady?: (workspaceId: string) => void;
}

/**
 * One move, for any source and any destination.
 *
 * The destination is the slow part, so it is started first and comes up
 * while the source is asked for its handoff and captured. The capture is a
 * pre-copy: the source stays usable, and the last step captures again and
 * sends only what changed since, which is nothing when nothing did. Agents
 * are handed their transcripts as they stand at the end.
 */
export function composeTeleportOperations({
	source,
	destination,
	branch,
	onDestinationReady,
}: ComposeTeleportOperationsInput): TeleportOperations {
	let preparing: Promise<ReadyDestination> | null = null;
	let carried: HandoffEntry[] = [];
	let published: PublishedCapture | null = null;
	let agentsSeeded: Promise<void> = Promise.resolve();

	const prepare = (): Promise<ReadyDestination> => {
		if (!preparing) {
			preparing = destination.prepare();
			// Surfaced by the step that awaits it, never as an unhandled rejection.
			preparing.catch(() => {});
		}
		return preparing;
	};

	const captured = (): PublishedCapture => {
		if (!published) throw new Error("Teleport reached restore before capture");
		return published;
	};

	return {
		askAgentsForHandoff: async () => {
			void prepare();
			carried = await source.handoff();
		},

		capture: async () => {
			published = await source.publish();
			return { ref: published.ref, bundlePath: "" };
		},

		createWorktree: async () => {
			const ready = await prepare();
			onDestinationReady?.(ready.workspaceId);
			agentsSeeded = ready.seedAgents();
			return { workspaceId: ready.workspaceId, bundlePath: "" };
		},

		restore: async () => {
			const ready = await prepare();
			await ready.arrive(captured().ref, branch);
		},

		runSetupScripts: async () => {
			// Setup ran where the checkout was made: on the host's create, or
			// in the sandbox's own boot.
		},

		rebuildTabs: async () => {
			// Panes come back as their agents are launched below.
		},

		stopSource: async () => {
			const ready = await prepare();
			const latest = await source.publish(captured().workingTree);
			if (!latest.unchanged) await ready.arrive(latest.ref, branch);
			await source.discard();
		},

		startPrograms: async () => {
			const ready = await prepare();
			const byTerminal = new Map(
				carried.map((entry) => [entry.terminalId, entry]),
			);
			for (const entry of await source.handoff()) {
				byTerminal.set(entry.terminalId, entry);
			}
			if (byTerminal.size === 0) return;
			await agentsSeeded;
			await Promise.all(
				[...byTerminal.values()].map((entry) =>
					ready.launchAgent(entry.agent, entry.prompt),
				),
			);
		},
	};
}
