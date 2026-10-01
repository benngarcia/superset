/**
 * The plugin ledger on a cloud workspace, written from `sandbox.conf`.
 *
 * A box never asks the API what its creator has installed: the claim already
 * wrote the list into the conf, and this turns it into the one file every
 * provisioner reads. It runs before provisionAgentIntegrations, so the boot
 * sync that follows finds the ledger already there — no second pass, and no
 * race with the agent the box launches.
 *
 * No network, no account call. Every account install is first-party, and the
 * first-party trees ship in the host runtime, so materializing a plugin is
 * pointing the ledger at a directory that is already on disk.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	getBundledMarketplaceDir,
	type InstalledPluginEntry,
	writeInstalledPlugins,
} from "@superset/agent-setup";
import { sandboxPluginsSchema } from "@superset/shared/sandbox-contract";

/** The version the box will actually serve, which is the tree's own. */
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
	// Every install the account reports, tree or not. A plugin can be tools only
	// — a catalog entry whose server is reached directly — and dropping it here
	// would cost it its MCP servers, which have nothing to do with a tree.
	// Provisioning decides what each entry contributes: skills need installPath,
	// servers need a catalog entry.
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

	// The whole desired set, every boot: provisioning reaps what is absent, so
	// a plugin uninstalled on the account loses its skills on the next wake.
	writeInstalledPlugins(entries);
	const toolsOnly = entries.filter((entry) => !entry.installPath).length;
	console.log(
		`[sandbox] Seeded ${entries.length} plugin(s) into the ledger${
			toolsOnly ? ` (${toolsOnly} with no tree in this runtime)` : ""
		}`,
	);
}
