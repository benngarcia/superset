import type { ToolCall } from "@superset/chat/protocol";

export function durationLabel(item: ToolCall): string | null {
	if (item.completedAtMs === undefined) return null;
	const seconds = Math.max(0, item.completedAtMs - item.startedAtMs) / 1000;
	return `${seconds.toFixed(1)}s`;
}
