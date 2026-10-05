import { describe, expect, test } from "bun:test";
import {
	getPluginByName,
	isServerSatisfiedExternally,
	PLUGIN_CATALOG,
	pluginProxyMcpServers,
} from "./index";
import { FIRST_PARTY_MANIFESTS } from "./manifests.generated";

describe("PLUGIN_CATALOG", () => {
	test("covers every published first-party manifest", () => {
		const missing = Object.keys(FIRST_PARTY_MANIFESTS).filter(
			(name) => !getPluginByName(name),
		);
		expect(missing).toEqual([]);
	});

	test("agrees with each manifest on display name", () => {
		for (const [name, manifest] of Object.entries(FIRST_PARTY_MANIFESTS)) {
			expect(getPluginByName(name)?.interface.displayName).toBe(
				manifest.extensions.superset.interface.displayName,
			);
		}
	});

	test("has no duplicate names", () => {
		const names = PLUGIN_CATALOG.map((plugin) => plugin.name);
		expect(names).toEqual([...new Set(names)]);
	});
});

describe("isServerSatisfiedExternally", () => {
	const proxied = pluginProxyMcpServers("linear");
	const linear = proxied?.linear;

	test("a user's Superset MCP entry does not satisfy a proxied plugin", () => {
		expect(linear).toBeDefined();
		if (!linear) return;
		expect(
			isServerSatisfiedExternally("linear", linear, [
				{ name: "superset", url: "https://api.superset.sh/mcp" },
			]),
		).toBe(false);
	});

	test("an entry for the same proxy path satisfies it", () => {
		if (!linear) return;
		expect(
			isServerSatisfiedExternally("linear", linear, [
				{
					name: "my-linear",
					url: "https://api.superset.sh/mcp/plugins/superset/linear/",
				},
			]),
		).toBe(true);
	});

	test("a vendor URL still matches by hostname", () => {
		expect(
			isServerSatisfiedExternally(
				"playwright",
				{ type: "http", url: "https://mcp.example.com/mcp" },
				[{ name: "pw", url: "https://mcp.example.com/sse" }],
			),
		).toBe(true);
	});
});
