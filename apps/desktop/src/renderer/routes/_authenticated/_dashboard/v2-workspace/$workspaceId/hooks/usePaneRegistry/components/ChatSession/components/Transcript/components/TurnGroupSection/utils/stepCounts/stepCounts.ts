import type { ToolCall } from "@superset/chat/protocol";

/**
 * What a run of tool calls amounted to, by the concept a reader cares about
 * rather than by tool name: the agent explored, ran things, changed files,
 * went to the web, or used something else.
 */
export type StepCounts = {
	commands: number;
	edits: number;
	reads: number;
	searches: number;
	fetches: number;
	tools: number;
};

export function stepCounts(items: readonly ToolCall[]): StepCounts {
	const counts: StepCounts = {
		commands: 0,
		edits: 0,
		reads: 0,
		searches: 0,
		fetches: 0,
		tools: 0,
	};
	for (const item of items) {
		switch (item.toolKind) {
			case "execute":
				counts.commands += 1;
				break;
			case "edit":
			case "delete":
			case "move":
				counts.edits += 1;
				break;
			case "read":
				counts.reads += 1;
				break;
			case "search":
				counts.searches += 1;
				break;
			case "fetch":
				counts.fetches += 1;
				break;
			default:
				counts.tools += 1;
		}
	}
	return counts;
}
