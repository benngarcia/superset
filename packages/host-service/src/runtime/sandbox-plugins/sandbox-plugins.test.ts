import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setAgentSetupTemplatesDir } from "@superset/agent-setup";
import { seedSandboxPlugins } from "./sandbox-plugins";

let home: string;
let templates: string;
const originalHome = process.env.SUPERSET_HOME_DIR;

function shipPlugin(name: string, version: string): void {
	const dir = join(templates, "plugins", name);
	mkdirSync(join(dir, "skills"), { recursive: true });
	writeFileSync(join(dir, "plugin.json"), JSON.stringify({ name, version }));
}

function ledger(): { plugins: Record<string, unknown>[] } {
	return JSON.parse(
		readFileSync(join(home, "plugins", "installed_plugins.json"), "utf8"),
	);
}

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "seed-home-"));
	templates = mkdtempSync(join(tmpdir(), "seed-templates-"));
	mkdirSync(join(templates, "plugins"), { recursive: true });
	process.env.SUPERSET_HOME_DIR = home;
	setAgentSetupTemplatesDir(templates);
});

afterEach(() => {
	if (originalHome === undefined) delete process.env.SUPERSET_HOME_DIR;
	else process.env.SUPERSET_HOME_DIR = originalHome;
});

describe("seedSandboxPlugins", () => {
	it("points the ledger at the shipped tree and its own version", () => {
		shipPlugin("linear", "1.3.0");
		seedSandboxPlugins({
			SUPERSET_SANDBOX_PLUGINS: JSON.stringify([
				{
					marketplace: "superset",
					name: "linear",
					version: "1.2.0",
					enabled: true,
				},
			]),
		});

		expect(ledger().plugins).toEqual([
			expect.objectContaining({
				marketplace: "superset",
				name: "linear",
				// The account says 1.2.0; the box can only serve what it ships.
				version: "1.3.0",
				installPath: join(templates, "plugins", "linear"),
				enabled: true,
			}),
		]);
	});

	it("keeps a disabled install as a record that materializes nothing", () => {
		shipPlugin("sentry", "1.0.0");
		seedSandboxPlugins({
			SUPERSET_SANDBOX_PLUGINS: JSON.stringify([
				{
					marketplace: "superset",
					name: "sentry",
					version: "1.0.0",
					enabled: false,
				},
			]),
		});

		expect(ledger().plugins).toHaveLength(1);
		expect(ledger().plugins[0]).toMatchObject({ enabled: false });
	});

	it("keeps a plugin with no tree, but without an installPath", () => {
		shipPlugin("linear", "1.0.0");
		seedSandboxPlugins({
			SUPERSET_SANDBOX_PLUGINS: JSON.stringify([
				{
					marketplace: "superset",
					name: "linear",
					version: "1.0.0",
					enabled: true,
				},
				{
					marketplace: "acme",
					name: "unshipped",
					version: "1.0.0",
					enabled: true,
				},
			]),
		});

		// Skill provisioning requires installPath and so ignores it; MCP
		// provisioning does not, which is the whole point of keeping it.
		expect(ledger().plugins).toEqual([
			expect.objectContaining({
				name: "linear",
				installPath: expect.any(String),
			}),
			expect.not.objectContaining({ installPath: expect.anything() }),
		]);
	});

	it("writes nothing off a cloud workspace", () => {
		seedSandboxPlugins({});
		expect(() => ledger()).toThrow();
	});

	it("writes nothing when the conf value is unusable", () => {
		seedSandboxPlugins({ SUPERSET_SANDBOX_PLUGINS: "not json" });
		seedSandboxPlugins({ SUPERSET_SANDBOX_PLUGINS: JSON.stringify({}) });
		expect(() => ledger()).toThrow();
	});
});
