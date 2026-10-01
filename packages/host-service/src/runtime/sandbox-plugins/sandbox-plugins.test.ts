import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getAgentSetupTemplatesDir,
	setAgentSetupTemplatesDir,
} from "@superset/agent-setup";
import { applyAgentTemplatesDir } from "../agent-provisioning";
import { seedSandboxPlugins } from "./sandbox-plugins";

let home: string;
let templates: string;
let scratch: string[] = [];
const originalHome = process.env.SUPERSET_HOME_DIR;
const originalTemplatesEnv = process.env.SUPERSET_AGENT_TEMPLATES_DIR;
const originalTemplatesDir = getAgentSetupTemplatesDir();

function scratchDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	scratch.push(dir);
	return dir;
}

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
	home = scratchDir("seed-home-");
	templates = scratchDir("seed-templates-");
	mkdirSync(join(templates, "plugins"), { recursive: true });
	process.env.SUPERSET_HOME_DIR = home;
	setAgentSetupTemplatesDir(templates);
});

afterEach(() => {
	if (originalHome === undefined) delete process.env.SUPERSET_HOME_DIR;
	else process.env.SUPERSET_HOME_DIR = originalHome;
	if (originalTemplatesEnv === undefined)
		delete process.env.SUPERSET_AGENT_TEMPLATES_DIR;
	else process.env.SUPERSET_AGENT_TEMPLATES_DIR = originalTemplatesEnv;
	// Sibling test files share this process and the templates dir is global.
	setAgentSetupTemplatesDir(originalTemplatesDir);
	for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
	scratch = [];
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

	it("empties the ledger when the claim states no plugins", () => {
		shipPlugin("linear", "1.0.0");
		seedSandboxPlugins({
			SUPERSET_SANDBOX_PLUGINS: JSON.stringify([
				{
					marketplace: "superset",
					name: "linear",
					version: "1.0.0",
					enabled: true,
				},
			]),
		});
		expect(ledger().plugins).toHaveLength(1);

		seedSandboxPlugins({ SUPERSET_SANDBOX_PLUGINS: "[]" });
		expect(ledger().plugins).toEqual([]);
	});

	it("finds the shipped tree once the templates dir is applied", () => {
		process.env.SUPERSET_AGENT_TEMPLATES_DIR = templates;
		setAgentSetupTemplatesDir(join(scratchDir("seed-stale-"), "unset"));
		shipPlugin("linear", "1.0.0");

		applyAgentTemplatesDir();
		seedSandboxPlugins({
			SUPERSET_SANDBOX_PLUGINS: JSON.stringify([
				{
					marketplace: "superset",
					name: "linear",
					version: "1.0.0",
					enabled: true,
				},
			]),
		});

		expect(ledger().plugins[0]).toMatchObject({
			installPath: join(templates, "plugins", "linear"),
		});
	});

	it("writes nothing when the conf value is unusable", () => {
		seedSandboxPlugins({ SUPERSET_SANDBOX_PLUGINS: "not json" });
		seedSandboxPlugins({ SUPERSET_SANDBOX_PLUGINS: JSON.stringify({}) });
		expect(() => ledger()).toThrow();
	});
});
