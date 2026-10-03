import { describe, expect, test } from "bun:test";
import type { ToolCall } from "@superset/chat/protocol";
import { fileChangeKind, fileChangeOf, fileName } from "./fileChange";

function call(content: ToolCall["content"]): ToolCall {
	return {
		id: "toolu_1",
		kind: "tool_call",
		title: "Write /repo/packages/chat/README.md",
		toolKind: "edit",
		toolName: "Write",
		status: "completed",
		startedAtMs: 1,
		content,
	};
}

describe("fileName", () => {
	test("keeps the last segment of an absolute path", () => {
		expect(fileName("/Users/x/repo/packages/chat/README.md")).toBe("README.md");
	});
	test("tolerates a trailing slash and windows separators", () => {
		expect(fileName("C:\\repo\\src\\index.ts")).toBe("index.ts");
		expect(fileName("packages/chat/")).toBe("chat");
	});
	test("returns a bare name unchanged", () => {
		expect(fileName("README.md")).toBe("README.md");
	});
});

describe("fileChangeKind", () => {
	test("a missing old text is a new file", () => {
		expect(
			fileChangeKind({ type: "diff", path: "a", oldText: null, newText: "x" }),
		).toBe("added");
	});
	test("an emptied file is a deletion", () => {
		expect(
			fileChangeKind({ type: "diff", path: "a", oldText: "x", newText: "" }),
		).toBe("deleted");
	});
	test("anything else is an edit, including emptying an already empty file", () => {
		expect(
			fileChangeKind({ type: "diff", path: "a", oldText: "x", newText: "y" }),
		).toBe("modified");
		expect(
			fileChangeKind({ type: "diff", path: "a", oldText: "", newText: "" }),
		).toBe("modified");
	});
});

describe("fileChangeOf", () => {
	test("reads the first diff a call carries", () => {
		expect(
			fileChangeOf(
				call([
					{ type: "text", text: "ok" },
					{ type: "diff", path: "/repo/src/a.ts", oldText: "1", newText: "2" },
				]),
			),
		).toEqual({ kind: "modified", path: "/repo/src/a.ts", name: "a.ts" });
	});
	test("is null for a call without a diff", () => {
		expect(fileChangeOf(call([{ type: "text", text: "ok" }]))).toBeNull();
	});
});
