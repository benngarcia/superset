import { describe, expect, it } from "bun:test";
import { pendingInteractionFromHookInput } from "./pending-interaction";

// Shaped like Claude Code 2.1.293's PermissionRequest hook input.
function permissionRequest(toolName: string, toolInput: unknown): string {
	return JSON.stringify({
		session_id: "s-1",
		transcript_path: "/Users/a/.claude/projects/p/s-1.jsonl",
		cwd: "/Users/a/wt",
		permission_mode: "default",
		hook_event_name: "PermissionRequest",
		tool_name: toolName,
		tool_input: toolInput,
	});
}

describe("pendingInteractionFromHookInput", () => {
	it("turns AskUserQuestion into its questions and choices", () => {
		expect(
			pendingInteractionFromHookInput(
				permissionRequest("AskUserQuestion", {
					questions: [
						{
							question: "Which color?",
							header: "Color",
							options: [
								{ label: "Red", description: "Warm" },
								{ label: "Blue", description: "Cool" },
							],
							multiSelect: false,
						},
					],
				}),
			),
		).toEqual({
			kind: "question",
			questions: [
				{
					question: "Which color?",
					header: "Color",
					multiSelect: false,
					options: [
						{ label: "Red", description: "Warm" },
						{ label: "Blue", description: "Cool" },
					],
				},
			],
		});
	});

	it("names the tool and the agent's description of an approval, never its input", () => {
		const interaction = pendingInteractionFromHookInput(
			permissionRequest("Bash", {
				command: "curl -H 'Authorization: Bearer sk-secret' https://x",
				description: "Fetch the release notes",
			}),
		);
		expect(interaction).toEqual({
			kind: "approval",
			tool: "Bash",
			summary: "Fetch the release notes",
		});
		expect(JSON.stringify(interaction)).not.toContain("sk-secret");
	});

	it("keeps a multi-select question multi-select", () => {
		const interaction = pendingInteractionFromHookInput(
			permissionRequest("AskUserQuestion", {
				questions: [
					{
						question: "Which checks?",
						header: "Checks",
						options: [{ label: "Lint" }, { label: "Types" }],
						multiSelect: true,
					},
				],
			}),
		);
		expect(
			interaction?.kind === "question" && interaction.questions[0]?.multiSelect,
		).toBe(true);
	});

	it("never takes a summary from another tool's arguments", () => {
		expect(
			pendingInteractionFromHookInput(
				permissionRequest("mcp__linear__save_issue", {
					title: "Outage",
					description: "Prod DB url: postgres://admin:hunter2@db/prod",
				}),
			),
		).toEqual({ kind: "approval", tool: "mcp__linear__save_issue" });
	});

	it("bounds the text one hook call can carry", () => {
		const interaction = pendingInteractionFromHookInput(
			permissionRequest("AskUserQuestion", {
				questions: Array.from({ length: 6 }, () => ({
					question: "q".repeat(5000),
					options: Array.from({ length: 20 }, (_, i) => ({ label: `${i}` })),
				})),
			}),
		);
		expect(interaction?.kind).toBe("question");
		if (interaction?.kind !== "question") return;
		expect(interaction.questions).toHaveLength(4);
		expect(interaction.questions[0]?.question).toHaveLength(2000);
		expect(interaction.questions[0]?.options).toHaveLength(16);
	});

	it("ignores input that is not a Claude permission request", () => {
		expect(pendingInteractionFromHookInput("{not json")).toBeUndefined();
		expect(
			pendingInteractionFromHookInput(
				JSON.stringify({ type: "exec_approval_request", command: ["ls"] }),
			),
		).toBeUndefined();
	});
});
