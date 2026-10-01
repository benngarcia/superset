/**
 * The MCP servers installed plugins contribute, from the one ledger every
 * provisioner reads. Here, not in the desktop, because a box has no desktop.
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
		// An unknown name is a catalog entry removed after install: its servers
		// reap on this sync.
		const plugin = getPluginByName(name);
		if (plugin) Object.assign(desired, plugin.mcpServers);
	}
	return desired;
}

/** Converges every managed agent config on what the ledger currently says. */
export function syncPluginMcpServers(): void {
	syncManagedMcpServers(desiredPluginMcpServers(readEnabledPluginNames()));
}
