import type { ToolCall } from "@superset/chat/protocol";

/** How many trailing output lines a call shows without being expanded. */
const PREVIEW_LINES = 3;

/**
 * The tail, not the head: the end of a command's output is the part worth
 * seeing without opening anything.
 */
export function outputTail(
	item: ToolCall,
): { lines: string[]; hidden: number } | null {
	const text = item.content
		.map((content) =>
			content.type === "text"
				? content.text
				: content.type === "terminal"
					? content.output
					: null,
		)
		.filter((value): value is string => value !== null)
		.join("\n")
		.trimEnd();
	if (text === "") return null;
	// A fence delimiter is markup, not a line of output, and in a three-line
	// preview it costs a third of what there is to see. Dropped rather than
	// peeled off the ends: the text may hold several blocks.
	const all = text
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("```"));
	return {
		lines: all.slice(-PREVIEW_LINES),
		hidden: Math.max(0, all.length - PREVIEW_LINES),
	};
}
