import {
	DEFAULT_MARKETPLACE,
	getPluginByName,
	type PluginMcpServerConfig,
} from "@superset/shared/plugins";
import { type EnabledPlugin, readEnabledPlugins } from "./installed-plugins";
import { syncManagedMcpServers } from "./managed-mcp-servers";

export function desiredPluginMcpServers(
	plugins: readonly EnabledPlugin[],
): Record<string, PluginMcpServerConfig> {
	const desired: Record<string, PluginMcpServerConfig> = {};
	for (const { name, marketplace } of plugins) {
		// Only the first-party catalog is known here, and its proxy URL names
		// its own marketplace: another marketplace's same-named plugin would
		// otherwise be served Superset's.
		if (marketplace && marketplace !== DEFAULT_MARKETPLACE) continue;
		const plugin = getPluginByName(name);
		if (plugin) Object.assign(desired, plugin.mcpServers);
	}
	return desired;
}

export function syncPluginMcpServers(): void {
	const plugins = readEnabledPlugins();
	if (!plugins) return;
	syncManagedMcpServers(desiredPluginMcpServers(plugins));
}
