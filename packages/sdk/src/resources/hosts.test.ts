import { expect, test } from "bun:test";
import { Superset } from "../client";

const RELAY = "https://relay.invalid";
const JWT = "header.e30.signature";

function hostClient(
	respond: (url: URL, init?: RequestInit) => unknown,
	requests: Array<{ url: URL; init?: RequestInit }>,
) {
	return new Superset({
		apiKey: "sk_test_fake",
		organizationId: "org",
		hostId: "machine-1",
		baseURL: "https://api.invalid",
		maxRetries: 0,
		fetch: async (input, init) => {
			const url = new URL(String(input));
			if (url.pathname.endsWith("/analytics.captureEvent")) {
				return Response.json({ result: { data: { json: null } } });
			}
			requests.push({ url, init });
			if (url.pathname === "/api/auth/token") return Response.json({ token: JWT });
			if (url.pathname === "/api/trpc/host.relayEndpoint") {
				return Response.json({ result: { data: { json: { url: RELAY } } } });
			}
			return Response.json({ result: { data: { json: respond(url, init) } } });
		},
	});
}

test("hosts.list asks the API with the user JWT, so the API can check presence at the relay", async () => {
	const requests: Array<{ url: URL; init?: RequestInit }> = [];
	const client = hostClient(
		() => [{ id: "machine-1", name: "Laptop", online: true, organizationId: "org" }],
		requests,
	);

	const hosts = await client.hosts.list();

	const call = requests.find(({ url }) => url.pathname === "/api/trpc/host.list");
	const headers = new Headers(call?.init?.headers);
	expect(hosts.map((host) => host.online)).toEqual([true]);
	expect(headers.get("authorization")).toBe(`Bearer ${JWT}`);
	expect(headers.get("x-api-key")).toBeNull();
	expect(JSON.parse(call?.url.searchParams.get("input") ?? "null")).toEqual({
		json: { organizationId: "org" },
	});
});

test("hosts.workspaces.create reaches the client's host through the relay with a retry id", async () => {
	const requests: Array<{ url: URL; init?: RequestInit }> = [];
	const client = hostClient(
		() => ({ workspace: { id: "w1" }, terminals: [], agents: [], alreadyExists: false }),
		requests,
	);

	const created = await client.hosts.workspaces.create({
		projectId: "p1",
		branch: "feat/roster",
		tags: ["roster"],
	});

	const call = requests.at(-1);
	const body = JSON.parse(String(call?.init?.body));
	expect(created.workspace.id).toBe("w1");
	expect(`${call?.url.origin}${call?.url.pathname}`).toBe(
		`${RELAY}/hosts/org:machine-1/trpc/workspaces.create`,
	);
	expect(body.json).toMatchObject({
		projectId: "p1",
		branch: "feat/roster",
		tags: ["roster"],
	});
	expect(body.json.id).toMatch(/^[0-9a-f-]{36}$/);
});
