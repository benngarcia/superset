import type { TurnGroup } from "@superset/chat/core";

/**
 * Whether the end of the transcript needs its own "busy" line: a running
 * turn whose newest row is not itself live. A streaming message, a thought
 * mid-stream and a running tool call all shimmer on their own, and a pending
 * approval is the reader's turn, not the agent's; the line covers the gaps
 * between them, and the wait before the first one.
 */
export function showsWorkingIndicator(groups: TurnGroup[]): boolean {
	const last = groups.at(-1);
	if (!last || last.turn?.status !== "running") return false;
	const entry = last.entries.at(-1);
	if (!entry) return true;
	if (entry.kind === "tool_run")
		return entry.items.every((item) => item.status !== "running");
	const item = entry.item;
	if (item.kind === "tool_call") return item.status !== "running";
	if (item.kind === "agent_message" || item.kind === "reasoning")
		return item.completedAtMs !== undefined;
	if (item.kind === "approval_request") return item.status !== "pending";
	return true;
}
