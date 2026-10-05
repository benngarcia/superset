import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import superjson, { type SuperJSONResult } from "superjson";
import { isTrpcPath, trpcErrorResponse } from "./trpc-error";

async function errorBody(path: string): Promise<{ error: SuperJSONResult }> {
	const app = new Hono();
	app.get("*", (c) =>
		trpcErrorResponse(c, path, "SERVICE_UNAVAILABLE", "Host is not online"),
	);
	const response = await app.request("/");
	return (await response.json()) as { error: SuperJSONResult };
}

describe("trpcErrorResponse", () => {
	test("the main router's errors are superjson-encoded", async () => {
		const body = await errorBody("/trpc/workspace.list");
		expect(superjson.deserialize(body.error)).toMatchObject({
			message: "Host is not online",
		});
	});

	test("chat-v3 errors are plain, because its router has no transformer", async () => {
		const body = await errorBody("/chat-v3/trpc/listSessions");
		expect(body.error).toMatchObject({
			message: "Host is not online",
			data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 },
		});
	});
});

test("isTrpcPath covers both routers", () => {
	expect(isTrpcPath("/trpc/x")).toBe(true);
	expect(isTrpcPath("/chat-v3/trpc/x")).toBe(true);
	expect(isTrpcPath("/chat-v3/sessions/s/stream")).toBe(false);
});
