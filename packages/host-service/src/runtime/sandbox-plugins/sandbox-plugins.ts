import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	getBundledMarketplaceDir,
	type InstalledPluginEntry,
	pluginCachePath,
	writeInstalledPlugins,
} from "@superset/agent-setup";
import { DEFAULT_MARKETPLACE } from "@superset/shared/plugins";
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

/**
 * The shipped tree lives under the host runtime directory, which is
 * root-owned and which install-host reaps on upgrade, so the ledger must point
 * at the same cache a laptop uses instead.
 */
function cacheShippedTree(
	from: string,
	marketplace: string,
	name: string,
	version: string,
): string | undefined {
	let target: string;
	try {
		target = pluginCachePath(marketplace, name, version);
	} catch (error) {
		console.warn(`[sandbox] ${name}: ${(error as Error).message}`);
		return undefined;
	}
	if (existsSync(join(target, "plugin.json"))) return target;
	try {
		mkdirSync(dirname(target), { recursive: true });
		cpSync(from, target, { recursive: true });
		return target;
	} catch (error) {
		console.warn(`[sandbox] ${name}: could not cache its tree:`, error);
		return undefined;
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
	const entries: InstalledPluginEntry[] = parsed.data.map((plugin) => {
		const dir = join(root, plugin.name);
		// Only the first-party trees ship in the bundle, so a same-named
		// plugin from another marketplace must stay tools-only.
		const shipped =
			plugin.marketplace === DEFAULT_MARKETPLACE &&
			existsSync(join(dir, "plugin.json"));
		const version = shipped ? treeVersion(dir, plugin.version) : plugin.version;
		const installPath = shipped
			? cacheShippedTree(dir, plugin.marketplace, plugin.name, version)
			: undefined;
		return {
			marketplace: plugin.marketplace,
			name: plugin.name,
			version,
			...(installPath ? { installPath } : {}),
			installedAt,
			enabled: plugin.enabled,
		};
	});

	writeInstalledPlugins(entries);
	const toolsOnly = entries.filter((entry) => !entry.installPath).length;
	console.log(
		`[sandbox] Seeded ${entries.length} plugin(s) into the ledger${
			toolsOnly ? ` (${toolsOnly} with no tree in this runtime)` : ""
		}`,
	);
}
