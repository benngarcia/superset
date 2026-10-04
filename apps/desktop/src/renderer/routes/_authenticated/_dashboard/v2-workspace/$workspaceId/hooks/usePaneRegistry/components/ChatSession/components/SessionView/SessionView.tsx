import { Trans } from "@lingui/react/macro";
import type { SessionClient } from "@superset/chat/client";
import { deriveQueuedPrompts } from "@superset/chat/core";
import type {
	AvailableCommand,
	Decision,
	SessionConfigOption,
	SessionState,
	UserContent,
} from "@superset/chat/protocol";
import {
	useApprovals,
	useChatSession,
	useTimeline,
} from "@superset/chat/react";
import { ChatHistorySidebar } from "@superset/ui/chat-history-sidebar";
import { Spinner } from "@superset/ui/spinner";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStableList } from "../../hooks/useStableList";
import type { ChatForkTarget } from "../../types";
import { buildChatHandoffTranscript } from "../../utils/chatHandoffTranscript";
import { railMessages } from "../../utils/railMessages";
import { Composer } from "../Composer";
import { SessionHeader } from "../SessionHeader";
import { Transcript } from "../Transcript";

const NO_COMMANDS: AvailableCommand[] = [];
const NO_CONFIG_OPTIONS: SessionConfigOption[] = [];

export function SessionView({
	agentLabel,
	canForkToWorktree,
	client,
	headerLeft,
	pendingFirstPrompt,
	onFirstPromptSent,
	onFork,
	onSessionState,
	sessionId,
	workspaceId,
}: {
	client: SessionClient;
	sessionId: string;
	workspaceId: string;
	headerLeft?: ReactNode;
	pendingFirstPrompt: UserContent[] | null;
	onFirstPromptSent: () => void;
	onSessionState?: (session: SessionState | null) => void;
	/**
	 * Absent when the agent cannot branch its own session. The transcript is
	 * built here because only this view holds the timeline; a branch into
	 * another worktree cannot resume the session and is told it instead.
	 */
	onFork?: ((target: ChatForkTarget, transcript: string) => void) | undefined;
	canForkToWorktree?: boolean;
	/** Names the speaker in a handed-over transcript. */
	agentLabel?: string;
}) {
	const session = useChatSession({ client });
	const timeline = useTimeline(session.snapshot);
	const rail = useStableList(
		useMemo(
			() => railMessages(timeline, session.snapshot),
			[timeline, session.snapshot],
		),
		(previous, next) =>
			previous.id === next.id &&
			previous.role === next.role &&
			previous.preview === next.preview,
	);
	const [scrollRequest, setScrollRequest] = useState<{
		itemId: string;
		nonce: number;
	}>();
	const selectFromRail = useCallback((message: { id: string }) => {
		setScrollRequest((previous) => ({
			itemId: message.id,
			nonce: (previous?.nonce ?? 0) + 1,
		}));
	}, []);
	const approvals = useApprovals(session.snapshot);

	const firstPromptSentRef = useRef(false);
	useEffect(() => {
		if (!pendingFirstPrompt || firstPromptSentRef.current) return;
		if (session.status !== "ready") return;
		firstPromptSentRef.current = true;
		session.sendPrompt(pendingFirstPrompt);
		onFirstPromptSent();
	}, [pendingFirstPrompt, session, onFirstPromptSent]);

	const sessionState = session.snapshot.session;
	useEffect(() => {
		onSessionState?.(sessionState ?? null);
	}, [sessionState, onSessionState]);

	const runningTurnId = useMemo(() => {
		for (const turn of session.snapshot.turns.values()) {
			if (turn.status === "running") return turn.id;
		}
		return null;
	}, [session.snapshot.turns]);

	const queuedPrompts = useStableList(
		useMemo(() => deriveQueuedPrompts(session.snapshot), [session.snapshot]),
	);

	const timelineRef = useRef(timeline);
	timelineRef.current = timeline;
	const snapshotRef = useRef(session.snapshot);
	snapshotRef.current = session.snapshot;
	const forkWithTranscript = useCallback(
		(target: ChatForkTarget) =>
			onFork?.(
				target,
				buildChatHandoffTranscript(
					timelineRef.current,
					snapshotRef.current,
					agentLabel ?? "Agent",
				),
			),
		[onFork, agentLabel],
	);
	const {
		cancelTurn,
		loadOlder,
		respondToApproval,
		sendPrompt,
		setConfigOption,
	} = session;
	const onRespond = useCallback(
		(approvalId: string, decision: Decision) =>
			void respondToApproval(approvalId, decision),
		[respondToApproval],
	);
	const onLoadOlder = useCallback(() => void loadOlder(), [loadOlder]);
	const onSetConfigOption = useCallback(
		(configId: string, value: string) => void setConfigOption(configId, value),
		[setConfigOption],
	);
	const onSend = useCallback(
		(content: UserContent[]) => sendPrompt(content),
		[sendPrompt],
	);
	const onCancelTurn = useMemo(
		() => (runningTurnId ? () => void cancelTurn(runningTurnId) : null),
		[runningTurnId, cancelTurn],
	);
	const promptQueue = useMemo(
		() => ({
			prompts: queuedPrompts,
			paused: sessionState?.queuePaused === true,
			remove: session.removeQueuedPrompt,
			resume: session.resumeQueue,
			steer: session.steerQueuedPrompt,
		}),
		[
			queuedPrompts,
			sessionState?.queuePaused,
			session.removeQueuedPrompt,
			session.resumeQueue,
			session.steerQueuedPrompt,
		],
	);

	// The stream is ready well before the agent is: the harness still has to
	// spawn and, when resuming, replay the whole transcript. Showing an empty
	// pane through that reads as a broken chat rather than a loading one.
	const booting = sessionState?.status === "starting" && timeline.length === 0;
	const loadingTranscript = session.status === "loading" || booting;

	return (
		// w-full because the pane lays its children out in a row: without it this
		// sizes to its content and leaves the right of the pane empty.
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col">
			{/* Only worth a row when it carries a control: the pane header above
			    already names the agent, and harness/status/connection repeated
			    under it read louder than the transcript. */}
			{headerLeft && (
				<SessionHeader
					connection={session.connection}
					left={headerLeft}
					session={session.snapshot.session}
				/>
			)}
			<div className="flex min-h-0 flex-1">
				{!loadingTranscript && rail.length > 1 && (
					<ChatHistorySidebar
						className="hidden max-h-full shrink-0 flex-col self-center pl-3 lg:flex"
						messages={rail}
						onMessageSelect={selectFromRail}
					/>
				)}
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{loadingTranscript ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3">
							<Spinner className="size-5" />
							{booting && (
								<span className="text-muted-foreground text-xs">
									<Trans>Opening the conversation…</Trans>
								</span>
							)}
						</div>
					) : (
						<Transcript
							approvals={approvals}
							canForkToWorktree={canForkToWorktree}
							groups={timeline}
							hasOlder={session.hasOlder}
							onDiscardPrompt={session.discardPrompt}
							onFork={onFork ? forkWithTranscript : undefined}
							onLoadOlder={onLoadOlder}
							onRespond={onRespond}
							onRetryPrompt={session.retryPrompt}
							outbox={session.outbox}
							scrollRequest={scrollRequest}
							snapshot={session.snapshot}
						/>
					)}
					<Composer
						availableCommands={sessionState?.availableCommands ?? NO_COMMANDS}
						configOptions={sessionState?.configOptions ?? NO_CONFIG_OPTIONS}
						onSetConfigOption={onSetConfigOption}
						disabled={session.status !== "ready"}
						draftKey={`chat-v3-draft:${sessionId}`}
						onCancelTurn={onCancelTurn}
						onSend={onSend}
						promptQueue={promptQueue}
						workspaceId={workspaceId}
					/>
				</div>
			</div>
		</div>
	);
}
