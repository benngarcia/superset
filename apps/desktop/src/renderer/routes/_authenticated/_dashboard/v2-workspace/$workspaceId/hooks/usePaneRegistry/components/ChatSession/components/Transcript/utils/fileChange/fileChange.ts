import type { ToolCall, ToolContent } from "@superset/chat/protocol";

export type FileChangeKind = "added" | "deleted" | "modified";

export type FileChange = {
	kind: FileChangeKind;
	/** The path as the agent reported it. */
	path: string;
	/** The last path segment, which is what a row has room for. */
	name: string;
};

type DiffToolContent = Extract<ToolContent, { type: "diff" }>;

export function fileChangeKind(content: DiffToolContent): FileChangeKind {
	if (content.oldText === null) return "added";
	if (content.newText === "" && content.oldText !== "") return "deleted";
	return "modified";
}

export function fileName(path: string): string {
	const trimmed = path.replace(/[\\/]+$/, "");
	const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return index === -1 ? trimmed : trimmed.slice(index + 1);
}

/** The file a call changed, when it carried a diff; null for every other call. */
export function fileChangeOf(item: ToolCall): FileChange | null {
	const diff = item.content.find(
		(content): content is DiffToolContent => content.type === "diff",
	);
	if (!diff) return null;
	return {
		kind: fileChangeKind(diff),
		path: diff.path,
		name: fileName(diff.path),
	};
}
