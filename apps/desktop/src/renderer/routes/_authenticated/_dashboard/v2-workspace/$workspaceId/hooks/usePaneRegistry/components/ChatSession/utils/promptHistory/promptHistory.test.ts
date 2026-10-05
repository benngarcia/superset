import { describe, expect, it } from "bun:test";
import type { TurnGroup } from "@superset/chat/core";
import { promptHistory } from "./promptHistory";

function userItem(id: string, text: string) {
	return {
		kind: "item" as const,
		item: {
			id,
			kind: "user_message" as const,
			startedAtMs: 0,
			content: [{ type: "text" as const, text }],
		},
	};
}

describe("promptHistory", () => {
	it("lists sent prompts oldest first, without blanks or repeats", () => {
		const groups = [
			{
				turnId: "t1",
				turn: null,
				entries: [
					userItem("u1", "add a test"),
					{
						kind: "item" as const,
						item: { id: "a1", kind: "agent_message", startedAtMs: 1 },
					},
				],
			},
			{ turnId: "t2", turn: null, entries: [userItem("u2", "  ")] },
			{ turnId: "t3", turn: null, entries: [userItem("u3", "run it")] },
			{ turnId: "t4", turn: null, entries: [userItem("u4", "run it")] },
		] as unknown as TurnGroup[];

		expect(promptHistory(groups)).toEqual(["add a test", "run it"]);
	});
});
