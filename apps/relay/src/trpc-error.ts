import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import superjson from "superjson";

type TrpcErrorCode =
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "INTERNAL_SERVER_ERROR"
	| "SERVICE_UNAVAILABLE"
	| "BAD_GATEWAY";

const RPC_CODE: Record<TrpcErrorCode, number> = {
	UNAUTHORIZED: -32001,
	FORBIDDEN: -32003,
	INTERNAL_SERVER_ERROR: -32603,
	SERVICE_UNAVAILABLE: -32603,
	BAD_GATEWAY: -32603,
};

const HTTP_STATUS: Record<TrpcErrorCode, ContentfulStatusCode> = {
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
	BAD_GATEWAY: 502,
};

const CHAT_TRPC_PREFIX = "/chat-v3/trpc";

export function isTrpcPath(pathAfterHost: string): boolean {
	return (
		pathAfterHost.startsWith("/trpc") ||
		pathAfterHost.startsWith(CHAT_TRPC_PREFIX)
	);
}

/** The host's main router uses superjson; its chat router has no transformer. */
export function trpcErrorResponse(
	c: Context,
	pathAfterHost: string,
	code: TrpcErrorCode,
	message: string,
) {
	const httpStatus = HTTP_STATUS[code];
	const shape = { message, code: RPC_CODE[code], data: { code, httpStatus } };
	const error = pathAfterHost.startsWith(CHAT_TRPC_PREFIX)
		? shape
		: superjson.serialize(shape);
	return c.json({ error }, httpStatus);
}
