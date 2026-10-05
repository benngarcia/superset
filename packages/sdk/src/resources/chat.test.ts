import { expect, test } from "bun:test";
import { Superset } from "../client";
import { SupersetError } from "../core/error";
import type { WebSocketLike } from "../lib/socket";
import type { ChatSessionChangedEvent } from "./events";

const RELAY = "https://relay.invalid";

function fakeJwt(expiresInSeconds: number): string {
	const payload = btoa(
		JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
	);
	return `header.${payload}.signature`;
}

function clientWith(
	fetch: (url: URL, init?: RequestInit) => Response,
	options: { apiKey?: string; hostId?: string } = {},
) {
	return new Superset({
		apiKey: options.apiKey ?? "sk_test_fake",
		organizationId: "org",
		hostId: options.hostId,
		baseURL: "https://api.invalid",
		maxRetries: 0,
		fetch: async (url, init) => {
			const parsed = new URL(String(url));
			if (parsed.pathname.endsWith("/analytics.captureEvent")) {
				return Response.json({ result: { data: { json: null } } });
			}
			return fetch(parsed, init);
		},
	});
}

function hostFetch(
	jwt: string,
	requests: Array<{ url: URL; init?: RequestInit }>,
	respond: (url: URL) => unknown,
) {
	return (url: URL, init?: RequestInit) => {
		requests.push({ url, init });
		if (url.pathname === "/api/auth/token") return Response.json({ token: jwt });
		if (url.pathname === "/api/trpc/host.relayEndpoint") {
			return Response.json({ result: { data: { json: { url: RELAY } } } });
		}
		return Response.json({ result: { data: respond(url) } });
	};
}

test("host calls trade the API key for one JWT and go through the relay as plain JSON", async () => {
	const jwt = fakeJwt(3600);
	const requests: Array<{ url: URL; init?: RequestInit }> = [];
	const client = clientWith(
		hostFetch(jwt, requests, (url) =>
			url.pathname.endsWith("/createSession")
				? { sessionId: "s1", epoch: "e1" }
				: { itemId: "i1", queued: false },
		),
		{ hostId: "machine-1" },
	);

	const created = await client.chat.createSession({
		workspaceId: "ws-1",
		harness: "claude-code",
	});
	const prompted = await client.chat.prompt({
		sessionId: "s1",
		content: "Fix the build",
	});

	expect(created).toEqual({ sessionId: "s1", epoch: "e1" });
	expect(prompted).toEqual({ itemId: "i1", queued: false });
	const paths = requests.map(({ url }) => `${url.origin}${url.pathname}`);
	expect(paths.slice(0, 2).sort()).toEqual([
		"https://api.invalid/api/auth/token",
		"https://api.invalid/api/trpc/host.relayEndpoint",
	]);
	expect(paths.slice(2)).toEqual([
		`${RELAY}/hosts/org:machine-1/chat-v3/trpc/createSession`,
		`${RELAY}/hosts/org:machine-1/chat-v3/trpc/prompt`,
	]);
	const [, , createRequest, promptRequest] = requests;
	const headers = new Headers(createRequest?.init?.headers);
	expect(headers.get("authorization")).toBe(`Bearer ${jwt}`);
	expect(headers.get("x-api-key")).toBeNull();
	expect(JSON.parse(String(createRequest?.init?.body))).toMatchObject({
		workspaceId: "ws-1",
		harness: "claude-code",
	});
	expect(JSON.parse(String(promptRequest?.init?.body))).toMatchObject({
		sessionId: "s1",
		content: [{ type: "text", text: "Fix the build" }],
	});
});

test("a bearer credential goes to the relay as is", async () => {
	const requests: Array<{ url: URL; init?: RequestInit }> = [];
	const client = clientWith(
		hostFetch("unused", requests, () => []),
		{ apiKey: "user-jwt" },
	);

	await client.chat.listSessions({ hostId: "machine-1", workspaceId: "ws-1" });

	const last = requests.at(-1);
	expect(requests.some(({ url }) => url.pathname === "/api/auth/token")).toBe(
		false,
	);
	expect(new Headers(last?.init?.headers).get("authorization")).toBe(
		"Bearer user-jwt",
	);
	expect(JSON.parse(last?.url.searchParams.get("input") ?? "null")).toEqual({
		workspaceId: "ws-1",
	});
});

test("without a host, chat calls reach the cloud workspace's sandbox", async () => {
	const requests: URL[] = [];
	const client = clientWith((url) => {
		requests.push(url);
		if (url.pathname === "/api/trpc/cloudWorkspace.hostTicket") {
			return Response.json({
				result: {
					data: {
						json: {
							url: "https://gate.invalid",
							token: "ticket",
							expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
						},
					},
				},
			});
		}
		return Response.json({ result: { data: [] } });
	});

	await client.chat.listSessions({ workspaceId: "ws-1" });

	expect(`${requests[1]?.origin}${requests[1]?.pathname}`).toBe(
		"https://gate.invalid/chat-v3/trpc/listSessions",
	);
});

test("a chat call with neither a host nor a workspace is refused before any request", async () => {
	const client = clientWith(() => {
		throw new Error("no request expected");
	});

	const outcome = await client.chat.retrieveSession({ sessionId: "s1" }).then(
		() => null,
		(error: unknown) => error,
	);

	expect(outcome).toBeInstanceOf(SupersetError);
});

test("events.subscribe opens the host's feed through the relay and routes chat session changes", async () => {
	const jwt = fakeJwt(3600);
	const listeners = new Map<string, (event: never) => void>();
	let openedURL = "";
	const socket: WebSocketLike = {
		addEventListener(type, listener) {
			listeners.set(type, listener);
			if (type === "open") queueMicrotask(() => listener({} as never));
		},
		close() {},
	};
	const client = new Superset({
		apiKey: "sk_test_fake",
		organizationId: "org",
		hostId: "machine-1",
		baseURL: "https://api.invalid",
		maxRetries: 0,
		fetch: async (url) => hostFetch(jwt, [], () => null)(new URL(String(url))),
		WebSocket: class {
			constructor(url: string) {
				openedURL = url;
				return socket;
			}
		} as unknown as new (url: string) => WebSocketLike,
	});
	const changes: ChatSessionChangedEvent[] = [];

	await client.events.subscribe({
		onChatSessionChanged: (event) => changes.push(event),
	});
	const change: ChatSessionChangedEvent = {
		type: "chat:session-changed",
		sessionId: "s1",
		workspaceId: "ws-1",
		status: "running",
		removed: false,
		occurredAt: 1,
	};
	listeners.get("message")?.({
		data: JSON.stringify({ type: "git:changed", workspaceId: "ws-1" }),
	} as never);
	listeners.get("message")?.({ data: JSON.stringify(change) } as never);

	expect(openedURL).toBe(
		`wss://relay.invalid/hosts/org:machine-1/events?token=${jwt}`,
	);
	expect(changes).toEqual([change]);
});
