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
		const plugin = getPluginByName(name);
		if (plugin) Object.assign(desired, plugin.mcpServers);
	}
	return desired;
}

export function syncPluginMcpServers(): void {
	syncManagedMcpServers(desiredPluginMcpServers(readEnabledPluginNames()));
}
