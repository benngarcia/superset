import type { HostTarget } from "../client";
import type { APIPromise } from "../core/api-promise";
import { APIResource } from "../core/resource";
import type { RequestOptions } from "../internal/request-options";
import { uuid4 } from "../internal/utils/uuid";
import { type SocketClose, type Subscription, subscribeJSON } from "../lib/socket";

/**
 * Agent chat sessions on a host-service. Each call goes to a host through the
 * relay (`hostId`, or the client's `hostId`), or else to the sandbox of the
 * cloud workspace named by `workspaceId`.
 */
export class Chat extends APIResource {
	/**
	 * Start an agent session in a workspace. The host runs it in the
	 * workspace's worktree.
	 */
	createSession(
		params: ChatCreateSessionParams,
		options?: RequestOptions,
	): APIPromise<ChatCreateSessionResult> {
		return this._client.chatMutation<ChatCreateSessionResult>(
			params,
			{ method: "chat.createSession", procedure: "createSession" },
			{
				commandId: uuid4(),
				workspaceId: params.workspaceId,
				harness: params.harness,
				modeId: params.modeId,
				modelId: params.modelId,
				resume: params.resumeHarnessSessionId
					? { harnessSessionId: params.resumeHarnessSessionId }
					: undefined,
			},
			options,
		);
	}

	/** List sessions, newest first; only the workspace's when `workspaceId` is set. */
	listSessions(
		params: ChatListSessionsParams = {},
		options?: RequestOptions,
	): APIPromise<ChatSession[]> {
		return this._client.chatQuery<ChatSession[]>(
			params,
			{ method: "chat.listSessions", procedure: "listSessions" },
			{ workspaceId: params.workspaceId, limit: params.limit },
			options,
		);
	}

	/** A session's stored state, and whether its agent is running now. */
	retrieveSession(
		params: ChatSessionParams,
		options?: RequestOptions,
	): APIPromise<ChatRetrieveSessionResult> {
		return this._client.chatQuery<ChatRetrieveSessionResult>(
			params,
			{ method: "chat.retrieveSession", procedure: "getSession" },
			{ sessionId: params.sessionId },
			options,
		);
	}

	/** A page of the session's transcript, oldest first, ending before `before`. */
	listItems(
		params: ChatListItemsParams,
		options?: RequestOptions,
	): APIPromise<ChatItemsPage> {
		return this._client.chatQuery<ChatItemsPage>(
			params,
			{ method: "chat.listItems", procedure: "getItems" },
			{
				sessionId: params.sessionId,
				before: params.before,
				limit: params.limit,
			},
			options,
		);
	}

	/**
	 * Send a message. It is queued when the agent is busy. Pass a string for
	 * plain text, or content blocks.
	 */
	prompt(
		params: ChatPromptParams,
		options?: RequestOptions,
	): APIPromise<ChatPromptResult> {
		return this._client.chatMutation<ChatPromptResult>(
			params,
			{ method: "chat.prompt", procedure: "prompt" },
			{
				commandId: uuid4(),
				sessionId: params.sessionId,
				clientId: params.clientId ?? uuid4(),
				content:
					typeof params.content === "string"
						? [{ type: "text", text: params.content }]
						: params.content,
			},
			options,
		);
	}

	/** Stop the running turn. `pauseQueue` keeps queued messages from starting. */
	cancelTurn(
		params: ChatCancelTurnParams,
		options?: RequestOptions,
	): APIPromise<void> {
		return this._client.chatMutation<void>(
			params,
			{ method: "chat.cancelTurn", procedure: "cancelTurn" },
			{
				commandId: uuid4(),
				sessionId: params.sessionId,
				turnId: params.turnId,
				pauseQueue: params.pauseQueue,
			},
			options,
		);
	}

	/** Answer a pending approval (session status `awaiting_input`). */
	respondToApproval(
		params: ChatRespondToApprovalParams,
		options?: RequestOptions,
	): APIPromise<void> {
		return this._client.chatMutation<void>(
			params,
			{ method: "chat.respondToApproval", procedure: "respondToApproval" },
			{
				commandId: uuid4(),
				sessionId: params.sessionId,
				approvalId: params.approvalId,
				decision: params.decision,
			},
			options,
		);
	}

	/** Switch the agent's mode, as the harness lists them. */
	setMode(
		params: ChatSetModeParams,
		options?: RequestOptions,
	): APIPromise<void> {
		return this._client.chatMutation<void>(
			params,
			{ method: "chat.setMode", procedure: "setMode" },
			{ commandId: uuid4(), sessionId: params.sessionId, modeId: params.modeId },
			options,
		);
	}

	/** Set one of the harness's config options, such as an ACP agent's model. */
	setConfigOption(
		params: ChatSetConfigOptionParams,
		options?: RequestOptions,
	): APIPromise<void> {
		return this._client.chatMutation<void>(
			params,
			{ method: "chat.setConfigOption", procedure: "setConfigOption" },
			{
				commandId: uuid4(),
				sessionId: params.sessionId,
				configId: params.configId,
				value: params.value,
			},
			options,
		);
	}

	/**
	 * Stop the session's agent. The transcript stays readable, and
	 * `createSession` with `resumeHarnessSessionId` picks the agent back up.
	 */
	closeSession(
		params: ChatSessionParams,
		options?: RequestOptions,
	): APIPromise<void> {
		return this._client.chatMutation<void>(
			params,
			{ method: "chat.closeSession", procedure: "closeSession" },
			{ sessionId: params.sessionId },
			options,
		);
	}

	/**
	 * Stream a session's events as they happen, from `since` when given. The
	 * promise resolves once the stream is open; call `close()` to stop it.
	 */
	async subscribe(params: ChatSubscribeParams): Promise<Subscription> {
		const url = await this._client.hostSocketURL(
			params,
			`/chat-v3/sessions/${encodeURIComponent(params.sessionId)}/stream`,
			{
				since: params.since
					? `${params.since.epoch}:${params.since.seq}`
					: undefined,
				deltas: params.deltas?.join(","),
			},
		);
		return subscribeJSON(this._client.openSocket(url), {
			onMessage: (message) => params.onEnvelope(message as ChatEnvelope),
			onError: params.onError,
			onClose: params.onClose,
		});
	}
}

export type ChatSessionStatus =
	| "starting"
	| "running"
	| "awaiting_input"
	| "idle"
	| "not_loaded"
	| "offline"
	| "dead";

export interface ChatSession {
	sessionId: string;
	/** The workspace the session runs in. */
	scopeId: string;
	harness: string;
	/** The agent's own session id, for `resumeHarnessSessionId`. */
	harnessSessionId: string | null;
	epoch: string;
	status: ChatSessionStatus;
	title: string | null;
	queuedCount: number;
	updatedAt: number;
}

export interface ChatCursor {
	epoch: string;
	seq: number;
}

export type ChatUserContent =
	| { type: "text"; text: string }
	| { type: "attachment"; attachmentId: string; name: string; mimeType: string };

export type ChatDecision =
	| { type: "accept" }
	| { type: "accept_for_session" }
	| { type: "decline" }
	| { type: "cancel" }
	| { type: "option"; optionId: string };

export type ChatDeltaChannel = "text" | "tool_input" | "terminal";

/**
 * One message on a session stream: a stored event (`cursor` and `event`), a
 * live partial update (`delta`), or a `reset` that asks the reader to reload.
 */
export interface ChatEnvelope {
	v: 1;
	sessionId: string;
	ts: number;
	cursor?: ChatCursor;
	event?: { type: string; [key: string]: unknown };
	delta?: { [key: string]: unknown };
	reset?: { reason: string };
}

export interface ChatCreateSessionParams extends HostTarget {
	workspaceId: string;
	/** Agent to run, e.g. `"claude-code"`, `"codex"`, or an ACP agent the host lists. */
	harness: string;
	modeId?: string;
	modelId?: string;
	/** Load an earlier agent session's transcript instead of starting fresh. */
	resumeHarnessSessionId?: string;
}

export interface ChatCreateSessionResult {
	sessionId: string;
	epoch: string;
}

export interface ChatListSessionsParams extends HostTarget {
	/** At most 200. Defaults to 50. */
	limit?: number;
}

export interface ChatSessionParams extends HostTarget {
	sessionId: string;
}

export interface ChatRetrieveSessionResult {
	live: boolean;
	session: ChatSession | null;
	cursor: ChatCursor | null;
}

export interface ChatListItemsParams extends ChatSessionParams {
	before?: ChatCursor;
	/** At most 500. Defaults to 200. */
	limit?: number;
}

export type ChatItemsPage =
	| { ok: true; envelopes: ChatEnvelope[]; nextBefore: ChatCursor | null }
	| { ok: false; reset: string };

export interface ChatPromptParams extends ChatSessionParams {
	content: string | ChatUserContent[];
	/** Your id for this message, echoed back on its transcript item. */
	clientId?: string;
}

export interface ChatPromptResult {
	itemId: string;
	queued: boolean;
}

export interface ChatCancelTurnParams extends ChatSessionParams {
	turnId: string;
	pauseQueue?: boolean;
}

export interface ChatRespondToApprovalParams extends ChatSessionParams {
	approvalId: string;
	decision: ChatDecision;
}

export interface ChatSetModeParams extends ChatSessionParams {
	modeId: string;
}

export interface ChatSetConfigOptionParams extends ChatSessionParams {
	configId: string;
	value: string;
}

export interface ChatSubscribeParams extends ChatSessionParams {
	since?: ChatCursor;
	/** Live partial updates to include; none by default. */
	deltas?: ChatDeltaChannel[];
	onEnvelope(envelope: ChatEnvelope): void;
	onError?(error: Error): void;
	onClose?(event: SocketClose): void;
}
