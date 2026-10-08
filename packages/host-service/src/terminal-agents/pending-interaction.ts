import { z } from "zod";
import type { TerminalAgentPendingInteraction } from "./types";

// The hook endpoint is unauthenticated, so bound what one call can put in
// front of a user. Claude asks one to four questions per AskUserQuestion.
const MAX_TEXT_LENGTH = 2000;
const MAX_QUESTIONS = 4;
const MAX_OPTIONS = 16;

const permissionRequestInput = z.object({
	tool_name: z.string().min(1),
	tool_input: z.record(z.string(), z.unknown()).optional(),
});

const askUserQuestionInput = z.object({
	questions: z
		.array(
			z.object({
				question: z.string(),
				header: z.string().optional(),
				multiSelect: z.boolean().optional(),
				options: z.array(
					z.object({
						label: z.string(),
						description: z.string().optional(),
					}),
				),
			}),
		)
		.min(1),
});

function clip(value: string): string {
	return value.slice(0, MAX_TEXT_LENGTH);
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Normalize a Claude Code `PermissionRequest` hook input (`tool_name`,
 * `tool_input`) into what the user is being asked. AskUserQuestion becomes
 * its questions and choices; any other tool becomes an approval naming the
 * tool and the agent's own description of the call. Everything else in the
 * input — commands, file contents, paths — is dropped here. Returns
 * undefined for input of any other shape.
 */
export function pendingInteractionFromHookInput(
	raw: string,
): TerminalAgentPendingInteraction | undefined {
	const request = permissionRequestInput.safeParse(parseJson(raw));
	if (!request.success) return undefined;
	const { tool_name: tool, tool_input: toolInput } = request.data;

	if (tool === "AskUserQuestion") {
		const ask = askUserQuestionInput.safeParse(toolInput);
		if (ask.success) {
			return {
				kind: "question",
				questions: ask.data.questions.slice(0, MAX_QUESTIONS).map((q) => ({
					question: clip(q.question),
					...(q.header ? { header: clip(q.header) } : {}),
					multiSelect: q.multiSelect ?? false,
					options: q.options.slice(0, MAX_OPTIONS).map((option) => ({
						label: clip(option.label),
						...(option.description
							? { description: clip(option.description) }
							: {}),
					})),
				})),
			};
		}
	}

	const description = toolInput?.description;
	return {
		kind: "approval",
		tool: clip(tool),
		...(typeof description === "string" && description.trim()
			? { summary: clip(description.trim()) }
			: {}),
	};
}
