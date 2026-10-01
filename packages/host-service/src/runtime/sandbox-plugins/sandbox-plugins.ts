/**
 * The plugin ledger on a cloud workspace, written from `sandbox.conf` before
 * provisioning reads it. No network: the first-party trees ship in the runtime.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	getBundledMarketplaceDir,
	type InstalledPluginEntry,
	writeInstalledPlugins,
} from "@superset/agent-setup";
import { sandboxPluginsSchema } from "@superset/shared/sandbox-contract";

function treeVersion(dir: string, fallback: string): string {
	try {
		const manifest = JSON.parse(
			readFileSync(join(dir, "plugin.json"), "utf8"),
		) as { version?: unknown };
		return typeof manifest.version === "string" ? manifest.version : fallback;
	} catch {
		return fallback;
	}
}

export function seedSandboxPlugins(env: NodeJS.ProcessEnv = process.env): void {
	const raw = env.SUPERSET_SANDBOX_PLUGINS;
	if (!raw) return;

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		console.warn("[sandbox] SUPERSET_SANDBOX_PLUGINS is not JSON");
		return;
	}
	const parsed = sandboxPluginsSchema.safeParse(json);
	if (!parsed.success) {
		console.warn("[sandbox] SUPERSET_SANDBOX_PLUGINS is not a plugin list");
		return;
	}

	const root = getBundledMarketplaceDir();
	const installedAt = new Date().toISOString();
	// Every install, tree or not: a tools-only plugin has no tree and still needs
	// its MCP servers. installPath is what makes skill provisioning skip it.
	const entries: InstalledPluginEntry[] = parsed.data.map((plugin) => {
		const dir = join(root, plugin.name);
		const shipped = existsSync(join(dir, "plugin.json"));
		return {
			marketplace: plugin.marketplace,
			name: plugin.name,
			version: shipped ? treeVersion(dir, plugin.version) : plugin.version,
			...(shipped ? { installPath: dir } : {}),
			installedAt,
			enabled: plugin.enabled,
		};
	});

	// The whole desired set: provisioning reaps whatever is absent from it.
	writeInstalledPlugins(entries);
	const toolsOnly = entries.filter((entry) => !entry.installPath).length;
	console.log(
		`[sandbox] Seeded ${entries.length} plugin(s) into the ledger${
			toolsOnly ? ` (${toolsOnly} with no tree in this runtime)` : ""
		}`,
	);
}
