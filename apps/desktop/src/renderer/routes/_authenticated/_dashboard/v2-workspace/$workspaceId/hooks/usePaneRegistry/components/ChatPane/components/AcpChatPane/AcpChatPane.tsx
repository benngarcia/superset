import { Trans, useLingui } from "@lingui/react/macro";
import { AGENT_DEFAULT_MODE, type UserContent } from "@superset/chat/protocol";
import { getAgentModelSupport } from "@superset/shared/agent-models";
import { buildChatSessionHandoffPrompt } from "@superset/shared/terminal-session-handoff";
import { toast } from "@superset/ui/sonner";
import { useWorkspaceClient } from "@superset/workspace-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTerminalAgentBindings } from "renderer/hooks/host-service/useTerminalAgentBindings";
import { useWorkspaceEvent } from "renderer/hooks/host-service/useWorkspaceEvent";
import { useV2AgentConfigs } from "renderer/hooks/useV2AgentConfigs";
import { acpHarnessForPreset } from "renderer/lib/acpHarness";
import type { OpenFile } from "../../../../../../types";
import { SessionView } from "../../../ChatSession/components/SessionView";
import { useSessionClient } from "../../../ChatSession/hooks/useSessionClient";
import type { ChatForkTarget } from "../../../ChatSession/types";
import { isUnrestrictedMode } from "../../../ChatSession/utils/isUnrestrictedMode";
import { useForkChat } from "../../hooks/useForkChat";
import { readSavedChatMode } from "../../utils/savedChatMode";
import { AcpRecovery } from "./components/AcpRecovery";
import { DraftChat } from "./components/DraftChat";
import { createWhenReachable } from "./utils/createWhenReachable";
import {
	isChatCreateWatched,
	sharedChatCreate,
	watchChatCreate,
} from "./utils/sharedChatCreate";

/**
 * A chat bridged to an agent session, resumed by its session id. `agent` comes
 * from the pane: the terminal it may have come from is stopped.
 */
export function AcpChatPane({
	agent,
	isActive,
	onSessionInfo,
	onPendingPromptsSent,
	onQueuePrompt,
	onOpenFile,
	onModeChange,
	onSessionCreated,
	onSwitchAgent,
	pendingPrompts,
	sessionId,
	terminalId,
	workspaceId,
	modelId,
	modelLabel,
	modeId,
}: {
	workspaceId: string;
	terminalId: string;
	/** `sessionId` is absent until the agent has run a turn to report one. */
	agent: { id: string; sessionId?: string } | undefined;
	isActive: boolean;
	sessionId: string | null;
	pendingPrompts: UserContent[][];
	onPendingPromptsSent: () => void;
	onQueuePrompt: (content: UserContent[]) => void;
	onSessionCreated: (sessionId: string) => void;
	onModeChange?: (modeId: string) => void;
	onSessionInfo: (info: { harnessSessionId?: string; title?: string }) => void;
	onOpenFile?: OpenFile;
	onSwitchAgent?: (target: {
		presetId: string;
		label: string;
		model: { id: string; label: string } | null;
		modeId: string | undefined;
		handoffPrompt: string | null;
	}) => void;
	modelId?: string;
	modelLabel?: string;
	modeId?: string;
}) {
	const { t } = useLingui();
	const { client, wiring } = useSessionClient(sessionId);
	const { forkToWorktree, canForkToWorktree } = useForkChat(workspaceId);
	const { hostUrl } = useWorkspaceClient();
	const { data: agentConfigs } = useV2AgentConfigs(hostUrl);
	const agentLabel = agentConfigs?.find(
		(config) => config.id === agent?.id,
	)?.label;
	const harness = acpHarnessForPreset(agent?.id);
	const [failure, setFailure] = useState<string | null>(null);
	const [unreachable, setUnreachable] = useState(false);

	// The stored session outlives its process — after a host restart the row
	// still reads "idle" and only the send fails. Ask who is actually running.
	const { data: stored } = useQuery({
		enabled: sessionId !== null,
		queryKey: ["acp-chat-session", sessionId],
		queryFn: () =>
			sessionId
				? wiring.transport.getSession({ sessionId })
				: Promise.resolve(null),
		staleTime: 5_000,
	});
	const queryClient = useQueryClient();
	useWorkspaceEvent(
		"chat:sessions-changed",
		workspaceId,
		() => {
			void queryClient.invalidateQueries({
				queryKey: ["acp-chat-session", sessionId],
			});
		},
		sessionId !== null,
	);

	const createKey = `${terminalId}:${agent?.id ?? ""}`;
	useEffect(() => watchChatCreate(createKey), [createKey]);
	const attaching = useRef(false);
	// A switch to another agent remounts this pane; its pending calls must not
	// write the old agent back over the new one.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const start = useCallback(
		async (resumeHarness: string, resume?: string) => {
			attaching.current = true;
			setFailure(null);
			try {
				const startModeId =
					modeId ??
					(resume || !agent ? undefined : readSavedChatMode(agent.id));
				const commandId = crypto.randomUUID();
				const createdId = await sharedChatCreate(
					createKey,
					() =>
						createWhenReachable({
							attempt: () =>
								wiring.transport
									.createSession({
										commandId,
										workspaceId,
										harness: resumeHarness,
										terminalId,
										...(modelId ? { modelId } : {}),
										...(startModeId ? { modeId: startModeId } : {}),
										...(resume ? { resume: { harnessSessionId: resume } } : {}),
									})
									.then((created) => created.sessionId),
							isReachableFailure: (error) =>
								error instanceof TRPCClientError && error.data != null,
							shouldContinue: () => isChatCreateWatched(createKey),
							onUnreachable: (next) => {
								if (mounted.current) setUnreachable(next);
							},
						}),
					(orphan) => {
						void wiring.transport
							.closeSession({ sessionId: orphan })
							.catch(() => undefined);
					},
				);
				if (mounted.current) onSessionCreated(createdId);
			} catch (error) {
				attaching.current = false;
				setFailure(error instanceof Error ? error.message : String(error));
			}
		},
		[
			createKey,
			wiring.transport,
			workspaceId,
			terminalId,
			onSessionCreated,
			modelId,
			modeId,
			agent,
		],
	);

	const agentSessionId = agent?.sessionId;
	// Resuming when there is a session to resume, and a plain new one when the
	// pane was opened straight onto the chat and no agent has run yet.
	useEffect(() => {
		if (sessionId || attaching.current || !harness) return;
		void start(harness, agentSessionId);
	}, [sessionId, harness, agentSessionId, start]);

	// Branching opens the copy in this pane; the agent keeps the original, so
	// nothing is lost by following the fork. The agent copies the session whole
	// — `session/fork` takes no truncation point — so where it was clicked from
	// makes no difference to what the branch contains.
	const forkHere = useCallback(() => {
		if (!sessionId) return;
		void wiring.transport
			.forkSession({
				commandId: crypto.randomUUID(),
				sessionId,
				workspaceId,
			})
			.then((forked) => {
				if (forked) {
					if (!mounted.current) {
						void wiring.transport
							.closeSession({ sessionId: forked.sessionId })
							.catch(() => undefined);
						return;
					}
					onSessionCreated(forked.sessionId);
					void wiring.transport
						.closeSession({ sessionId })
						.catch((error: unknown) =>
							console.warn(
								"[acp-chat] could not close the branched-from chat",
								error,
							),
						);
					return;
				}
				// The adapter declines rather than sending a `session/fork` an
				// agent would reject, and a button that does nothing is worse
				// than one that says why.
				toast.error(t({ message: "This agent can't branch a conversation" }));
			})
			.catch((error: unknown) => {
				console.error("[acp-chat] fork failed", error);
				toast.error(t({ message: "Couldn't branch the conversation" }));
			});
	}, [wiring.transport, sessionId, workspaceId, onSessionCreated, t]);

	// A worktree of its own cannot resume this session — the agent keys its
	// sessions to a project directory — so that branch is a fresh chat handed
	// the conversation. Both live under one control because the user is
	// choosing where the work continues, not which mechanism carries it.
	const fork = useCallback(
		(target: ChatForkTarget, transcript: string) => {
			if (target === "workspace") {
				forkHere();
				return;
			}
			if (!agent) return;
			void forkToWorktree({
				agentId: agent.id,
				agentLabel: agentLabel ?? agent.id,
				transcript,
			});
		},
		[forkHere, forkToWorktree, agent, agentLabel],
	);

	const startFresh = useCallback(() => {
		if (!harness) return;
		attaching.current = false;
		void start(harness);
	}, [harness, start]);

	const agentSwitch = useMemo(() => {
		if (!agent || !onSwitchAgent) return undefined;
		const presetIds = [
			...new Set((agentConfigs ?? []).map((config) => config.presetId)),
		].filter((presetId) => acpHarnessForPreset(presetId));
		if (!presetIds.includes(agent.id)) return undefined;
		return {
			currentPresetId: agent.id,
			agents: presetIds.map((presetId) => ({
				presetId,
				label:
					agentConfigs?.find((config) => config.presetId === presetId)?.label ??
					presetId,
				models: (getAgentModelSupport(presetId)?.models ?? []).map(
					({ id, label }) => ({ id, label }),
				),
			})),
			onSwitch: async (
				presetId: string,
				nextModel: { id: string; label: string } | null,
				transcript: string,
				currentModeId: string | undefined,
			) => {
				if (sessionId) {
					try {
						await wiring.transport.closeSession({ sessionId });
					} catch (error) {
						console.warn("[acp-chat] could not stop the chat session", error);
						toast.error(t({ message: "Couldn't stop the chat" }));
						return;
					}
				}
				if (!mounted.current) return;
				onSwitchAgent({
					presetId,
					label:
						agentConfigs?.find((config) => config.presetId === presetId)
							?.label ?? presetId,
					model: nextModel,
					// Never more access than the chat being left, unless the user
					// already chose otherwise for the agent being switched to.
					modeId:
						readSavedChatMode(presetId) ??
						(isUnrestrictedMode(currentModeId)
							? undefined
							: AGENT_DEFAULT_MODE),
					handoffPrompt: transcript.trim()
						? buildChatSessionHandoffPrompt({
								transcript,
								sourceAgentLabel: agentConfigs?.find(
									(config) => config.presetId === agent.id,
								)?.label,
							})
						: null,
				});
			},
		};
	}, [agent, agentConfigs, onSwitchAgent, sessionId, t, wiring.transport]);

	const sessionDead = stored?.session?.status === "dead";
	const sessionStopped =
		stored !== undefined && stored !== null && !stored.live;
	// A stopped or dead chat has not lost anything: the agent session it was
	// bound to can be loaded again. Dead means the agent exited or failed to
	// start, and a later attempt may get past either. Reopening a pane should
	// just work, so do it.
	const bindings = useTerminalAgentBindings(workspaceId);
	const continuedInTerminal =
		agentSessionId !== undefined &&
		[...bindings.values()].some(
			(binding) =>
				binding.agentSessionId === agentSessionId &&
				!binding.chatSessionId &&
				binding.endedAt === undefined,
		);
	const sawLive = useRef(false);
	if (stored?.live) sawLive.current = true;
	const canResume = Boolean(
		(sessionStopped || sessionDead) &&
			harness &&
			agentSessionId &&
			!continuedInTerminal,
	);
	const stoppedWhileOpen = canResume && sawLive.current;

	// Once per mount: if the session we resume into is itself unusable, fall
	// through to the panel instead of spawning adapters in a loop.
	const autoResumed = useRef(false);
	const resumingFrom = useRef<string | null>(null);
	const resume = useCallback(() => {
		if (!harness || !agentSessionId || !sessionId) return;
		resumingFrom.current = sessionId;
		attaching.current = false;
		void wiring.transport
			.closeSession({ sessionId })
			.catch(() => undefined)
			.then(() => start(harness, agentSessionId));
	}, [harness, agentSessionId, sessionId, start, wiring.transport]);
	useEffect(() => {
		if (!canResume || stoppedWhileOpen || autoResumed.current) return;
		autoResumed.current = true;
		resume();
	}, [canResume, stoppedWhileOpen, resume]);

	const resuming =
		canResume &&
		!stoppedWhileOpen &&
		(!autoResumed.current || (resumingFrom.current === sessionId && !failure));
	const draft = (notice: ReactNode) => (
		<DraftChat
			draftKey={`chat-v3-draft:${terminalId}`}
			isActive={isActive}
			notice={
				unreachable ? <Trans>Connecting to the host service…</Trans> : notice
			}
			onQueue={onQueuePrompt}
			queued={pendingPrompts}
			workspaceId={workspaceId}
		/>
	);

	if (resuming) {
		return draft(<Trans>Resuming the conversation…</Trans>);
	}

	if (harness && sessionId && (sessionDead || sessionStopped)) {
		return (
			<AcpRecovery
				detail={failure ?? undefined}
				onStartNew={startFresh}
				{...(stoppedWhileOpen ? { onResume: resume } : {})}
				reason={
					continuedInTerminal
						? "in-terminal"
						: stoppedWhileOpen
							? "stopped-while-open"
							: sessionDead
								? "no-transcript"
								: "stopped"
				}
			/>
		);
	}

	if (!client || !sessionId) {
		if (failure && harness) {
			return (
				<AcpRecovery
					detail={failure}
					onStartNew={startFresh}
					reason="no-transcript"
				/>
			);
		}
		if (!harness) {
			return (
				<div className="flex h-full w-full items-center justify-center p-4 text-center text-muted-foreground text-xs">
					<Trans>This agent can't be opened as a chat.</Trans>
				</div>
			);
		}
		return draft(
			agentSessionId ? (
				<Trans>Attaching to the running session…</Trans>
			) : (
				<Trans>Starting the agent…</Trans>
			),
		);
	}

	return (
		<SessionView
			client={client}
			key={sessionId}
			onPendingPromptsSent={onPendingPromptsSent}
			agentLabel={agentLabel}
			agentSwitch={agentSwitch}
			onModeChange={onModeChange}
			canForkToWorktree={canForkToWorktree}
			isActive={isActive}
			onFork={fork}
			openFile={onOpenFile}
			onSessionState={(state) => {
				// A resume that found no transcript lands on a different agent
				// session. Keep the pane pointed at the live one, or the trip back
				// to the CLI resumes an id that no longer exists.
				const bound = state?.harnessSessionId;
				if (!mounted.current) return;
				onSessionInfo({
					...(bound && bound !== agent?.sessionId
						? { harnessSessionId: bound }
						: {}),
					...(state?.title ? { title: state.title } : {}),
				});
			}}
			pendingPrompts={pendingPrompts}
			preferredModelLabel={modelLabel}
			sessionId={sessionId}
			workspaceId={workspaceId}
		/>
	);
}
