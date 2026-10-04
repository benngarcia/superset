import { useLingui } from "@lingui/react/macro";
import type {
	AvailableCommand,
	SessionConfigOption,
	UserContent,
	UserMessage,
} from "@superset/chat/protocol";
import type {
	ComposerMentionEntry,
	ComposerMentionProvider,
	PromptInputCommand,
	PromptInputHandle,
} from "@superset/chat-ui/PromptInput";
import { errorMessage } from "@superset/i18n/errors";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AgentComposer } from "renderer/components/AgentComposer";
import { userMessageText } from "../../utils/userMessageText";
import { ModelPicker } from "./components/ModelPicker";
import { ModePicker, type SessionMode } from "./components/ModePicker";
import { QueuedPrompts } from "./components/QueuedPrompts";

const DRAFT_DEBOUNCE_MS = 300;

export type ComposerProps = {
	workspaceId: string;
	draftKey: string;
	availableCommands: AvailableCommand[];
	configOptions?: SessionConfigOption[];
	onSetConfigOption?: (configId: string, value: string) => unknown;
	modes?: SessionMode[];
	currentModeId?: string;
	onSetMode?: (modeId: string) => void;
	onSend: (content: UserContent[]) => unknown;
	placeholder?: string;
	disabled?: boolean;
	onCancelTurn?: (() => void) | null;
	promptQueue?: {
		prompts: UserMessage[];
		paused: boolean;
		actionable: boolean;
		remove: (itemId: string) => Promise<void>;
		resume: () => Promise<void>;
		steer: (itemId: string) => Promise<void>;
	};
};

/**
 * The agent's own slash commands, in the shape the composer's menu takes.
 * Selecting one inserts a chip that serializes back to `/name`, so what the
 * agent receives is the command it advertised.
 */
function toMenuCommands(commands: AvailableCommand[]): PromptInputCommand[] {
	return commands.map((command) => ({
		id: command.name,
		title: `/${command.name}`,
		description: command.description ?? command.hint ?? "",
		onSelect: (ctx) =>
			ctx.insertChip({
				label: `/${command.name}`,
				serialized: `/${command.name}`,
			}),
	}));
}

export const Composer = memo(function Composer({
	availableCommands,
	configOptions,
	currentModeId,
	modes,
	onSetConfigOption,
	onSetMode,
	disabled,
	draftKey,
	onCancelTurn,
	onSend,
	placeholder,
	promptQueue,
	workspaceId,
}: ComposerProps) {
	const { t } = useLingui();
	const trpcUtils = workspaceTrpc.useUtils();
	const uploadAttachment = workspaceTrpc.attachments.upload.useMutation();
	const searchFiles = useCallback(
		async (query: string) => {
			const { matches } = await trpcUtils.filesystem.searchFiles.fetch({
				workspaceId,
				query,
				includeHidden: false,
				limit: 20,
			});
			return matches.map(
				(match): ComposerMentionEntry => ({
					id: match.absolutePath,
					label: match.name,
					description: match.relativePath,
					// The agent reads the path itself, so a mention is the path.
					select: (ctx) =>
						ctx.insertChip({
							label: match.name,
							serialized: match.relativePath,
						}),
				}),
			);
		},
		[trpcUtils, workspaceId],
	);

	const mentionProviders = useMemo<ComposerMentionProvider[]>(
		() => [
			{
				id: "files",
				title: t({ message: "Files" }),
				priority: 1,
				source: {
					kind: "search",
					search: searchFiles,
					emptyState: t({ message: "No matching files" }),
				},
			},
		],
		[searchFiles, t],
	);

	const commands = useMemo(
		() => toMenuCommands(availableCommands),
		[availableCommands],
	);

	// Debounced so a draft costs one write per pause rather than one per
	// keystroke; the last value is flushed when the pane goes away.
	const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChange = useCallback(
		(text: string) => {
			if (draftTimer.current) clearTimeout(draftTimer.current);
			draftTimer.current = setTimeout(() => {
				if (text === "") window.localStorage.removeItem(draftKey);
				else window.localStorage.setItem(draftKey, text);
			}, DRAFT_DEBOUNCE_MS);
		},
		[draftKey],
	);

	const [seed, setSeed] = useState(() => ({
		draftKey,
		text: window.localStorage.getItem(draftKey) ?? undefined,
	}));

	const handleSubmit = useCallback(
		async ({ text, files }: { text: string; files: File[] }) => {
			if (disabled || (text.trim() === "" && files.length === 0)) return;
			let attachments: UserContent[];
			try {
				attachments = await Promise.all(
					files.map(async (file) => {
						const mimeType = file.type || "application/octet-stream";
						const { attachmentId } = await uploadAttachment.mutateAsync({
							data: { kind: "base64", data: await fileToBase64(file) },
							mediaType: mimeType,
							originalFilename: file.name,
						});
						return {
							type: "attachment" as const,
							attachmentId,
							name: file.name,
							mimeType,
						};
					}),
				);
			} catch (error) {
				toast.error(t({ message: "Couldn't attach files" }), {
					description: errorMessage(error, t({ message: "Unknown error" })),
				});
				return;
			}
			onSend([
				...(text.trim() === "" ? [] : [{ type: "text" as const, text }]),
				...attachments,
			]);
			window.localStorage.removeItem(draftKey);
			setSeed({ draftKey, text: undefined });
		},
		[disabled, onSend, draftKey, uploadAttachment, t],
	);

	const runQueueAction = useCallback(
		async (action: () => Promise<void>) => {
			try {
				await action();
				return true;
			} catch (error) {
				toast.error(t({ message: "Couldn't update the queue" }), {
					description: errorMessage(error, t({ message: "Unknown error" })),
				});
				return false;
			}
		},
		[t],
	);

	const storedDraft =
		seed.draftKey === draftKey
			? seed.text
			: (window.localStorage.getItem(draftKey) ?? undefined);

	const promptInputRef = useRef<PromptInputHandle>(null);
	const editQueued = useCallback(
		async (prompt: UserMessage) => {
			if (!promptQueue) return;
			if (!(await runQueueAction(() => promptQueue.remove(prompt.id)))) return;
			promptInputRef.current?.appendText(userMessageText(prompt));
		},
		[promptQueue, runQueueAction],
	);

	const clearQueued = useCallback(async () => {
		if (!promptQueue) return;
		await runQueueAction(async () => {
			const results = await Promise.allSettled(
				promptQueue.prompts.map((prompt) => promptQueue.remove(prompt.id)),
			);
			const failed = results.find((result) => result.status === "rejected");
			if (failed) throw failed.reason;
		});
	}, [promptQueue, runQueueAction]);

	return (
		<div className="px-6 pt-1 pb-5">
			{promptQueue && (
				<div className="mx-auto w-full max-w-3xl">
					<QueuedPrompts
						onClear={() => void clearQueued()}
						onEdit={(prompt) => void editQueued(prompt)}
						onRemove={(id) => void runQueueAction(() => promptQueue.remove(id))}
						onResume={() => void runQueueAction(promptQueue.resume)}
						onSteer={(id) => void runQueueAction(() => promptQueue.steer(id))}
						actionable={promptQueue.actionable}
						paused={promptQueue.paused}
						prompts={promptQueue.prompts}
					/>
				</div>
			)}
			<AgentComposer
				className="mx-auto w-full max-w-3xl"
				clearOnSubmit={!disabled}
				commands={commands}
				defaultValue={storedDraft}
				key={draftKey}
				mentionProviders={mentionProviders}
				onChange={onChange}
				onStop={onCancelTurn ?? undefined}
				onSubmit={handleSubmit}
				ref={promptInputRef}
				placeholder={
					placeholder ??
					t({ message: "Ask the agent, @mention files, run /commands" })
				}
				status={onCancelTurn ? "streaming" : "ready"}
				submitWhileStreaming={promptQueue !== undefined}
				toolbar={
					modes && onSetMode ? (
						<ModePicker
							currentModeId={currentModeId}
							modes={modes}
							onSelect={onSetMode}
						/>
					) : null
				}
				toolbarEnd={
					configOptions && onSetConfigOption ? (
						<ModelPicker
							configOptions={configOptions}
							onSelect={onSetConfigOption}
						/>
					) : null
				}
			/>
		</div>
	);
});

async function fileToBase64(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}
