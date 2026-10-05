import type { HostTarget } from "../client";
import { APIResource } from "../core/resource";
import { type SocketClose, type Subscription, subscribeJSON } from "../lib/socket";
import type { ChatSessionStatus } from "./chat";

/** A host-service's live event feed, one per host or cloud workspace. */
export class Events extends APIResource {
	/**
	 * Receive the host's events as they happen. The promise resolves once the
	 * feed is open; call `close()` to stop it. Reconnect from `onClose` if you
	 * need the feed to outlive a dropped connection.
	 */
	async subscribe(params: EventsSubscribeParams): Promise<Subscription> {
		const url = await this._client.hostSocketURL(params, "/events");
		return subscribeJSON(this._client.openSocket(url), {
			onMessage: (message) => {
				const event = message as HostEvent;
				params.onEvent?.(event);
				if (event.type === "chat:session-changed") {
					params.onChatSessionChanged?.(event as ChatSessionChangedEvent);
				}
			},
			onError: params.onError,
			onClose: params.onClose,
		});
	}
}

/** A chat session was created, changed status, or was removed. */
export interface ChatSessionChangedEvent {
	type: "chat:session-changed";
	sessionId: string;
	workspaceId: string;
	status: ChatSessionStatus;
	/** True when the session was deleted; it no longer appears in `chat.listSessions`. */
	removed: boolean;
	occurredAt: number;
}

export type HostEvent =
	| ChatSessionChangedEvent
	| { type: string; [key: string]: unknown };

export interface EventsSubscribeParams extends HostTarget {
	onChatSessionChanged?(event: ChatSessionChangedEvent): void;
	/** Every event, including types this SDK does not describe. */
	onEvent?(event: HostEvent): void;
	onError?(error: Error): void;
	onClose?(event: SocketClose): void;
}
