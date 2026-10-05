import { ARRIVAL_MARKER, buildArrivalCommand } from "@superset/shared/teleport";
import type { HostServiceClient } from "renderer/lib/host-service-client";
import { runMarkedCommand } from "../marked-command";
import type { ReadyDestination } from "./types";

const RESTORE_TIMEOUT_MS = 5 * 60_000;

/**
 * A checkout on any host-service, driven only through procedures every
 * build has: the arrival is git typed into a terminal and watched for its
 * marker, agent presets resolve once the host has listed its configs, and
 * agents start through `agents.run`.
 */
export function readyOnHost(
	client: HostServiceClient,
	workspaceId: string,
): ReadyDestination {
	return {
		workspaceId,
		arrive: async (ref, branch) => {
			await runMarkedCommand(
				client,
				workspaceId,
				buildArrivalCommand(ref, branch),
				ARRIVAL_MARKER,
				RESTORE_TIMEOUT_MS,
				"The destination never reported the restore finishing",
			);
		},
		// A fresh host has no agent configs until a client lists them, which
		// is what seeds the bundled defaults that preset ids resolve against.
		seedAgents: async () => {
			await client.settings.agentConfigs.list.query().catch(() => undefined);
		},
		launchAgent: async (agent, prompt) => {
			await client.agents.run.mutate({ workspaceId, agent, prompt });
		},
	};
}
