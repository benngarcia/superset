import { APIConnectionError } from "../core/error";

export interface WebSocketLike {
	addEventListener(type: string, listener: (event: never) => void): void;
	close(code?: number, reason?: string): void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

export interface SocketClose {
	code: number;
	reason: string;
}

export interface Subscription {
	close(): void;
}

export interface SocketHandlers {
	onMessage(message: unknown): void;
	onError?(error: Error): void;
	onClose?(event: SocketClose): void;
}

/**
 * Resolves once the socket is open, or rejects if it fails before that.
 * Text frames are parsed as JSON; a frame that is not JSON is skipped.
 */
export function subscribeJSON(
	socket: WebSocketLike,
	handlers: SocketHandlers,
): Promise<Subscription> {
	return new Promise((resolve, reject) => {
		let opened = false;
		socket.addEventListener("open", () => {
			opened = true;
			resolve({ close: () => socket.close() });
		});
		socket.addEventListener("message", (event: { data: unknown }) => {
			if (typeof event.data !== "string") return;
			let message: unknown;
			try {
				message = JSON.parse(event.data);
			} catch {
				return;
			}
			handlers.onMessage(message);
		});
		socket.addEventListener("error", () => {
			const error = new APIConnectionError({
				message: "WebSocket connection failed.",
			});
			if (opened) handlers.onError?.(error);
			else reject(error);
		});
		socket.addEventListener("close", (event: SocketClose) => {
			if (!opened) {
				reject(
					new APIConnectionError({
						message: `WebSocket closed before it opened (code ${event.code}).`,
					}),
				);
				return;
			}
			handlers.onClose?.({ code: event.code, reason: event.reason });
		});
	});
}
