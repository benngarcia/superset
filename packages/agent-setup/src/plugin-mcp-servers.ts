/**
 * The MCP servers an installed plugin contributes, written from the one ledger
 * every provisioner reads.
 *
 * Here rather than in the desktop because three writers need it and they must
 * not disagree: the desktop at boot, `plugins sync` on a laptop, and
 * host-service in a cloud workspace, which has no desktop at all. It runs in
 * the same provisioning pass as the skills, off the same file, so a plugin is
 * never half on — skills materialized with its servers reaped, or the reverse.
 */
import {
	getPluginByName,
	type PluginMcpServerConfig,
} from "@superset/shared/plugins";
import { readEnabledPluginNames } from "./installed-plugins";
import { syncManagedMcpServers } from "./managed-mcp-servers";

export function desiredPluginMcpServers(
	names: readonly string[],
): Record<string, PluginMcpServerConfig> {
	const desired: Record<string, PluginMcpServerConfig> = {};
	for (const name of names) {
		// An unknown name is a catalog entry removed after install, so its
		// servers reap on this sync. Per-agent skipping of servers the user
		// configured themselves happens inside syncManagedMcpServers.
		const plugin = getPluginByName(name);
		if (plugin) Object.assign(desired, plugin.mcpServers);
	}
	return desired;
}

/** Converges every managed agent config on what the ledger currently says. */
export function syncPluginMcpServers(): void {
	syncManagedMcpServers(desiredPluginMcpServers(readEnabledPluginNames()));
}
