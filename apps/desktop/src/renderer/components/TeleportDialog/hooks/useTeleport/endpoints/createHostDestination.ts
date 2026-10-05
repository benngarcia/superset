import type { HostServiceClient } from "renderer/lib/host-service-client";
import { readyOnHost } from "./readyOnHost";
import type { TeleportDestinationEndpoint } from "./types";

export interface CreateHostDestinationInput {
	client: HostServiceClient;
	/** The host's project for the same repository. */
	projectId: string;
	branch: string;
	/** The source's name, so the new row reads the same on both ends. */
	name: string;
}

/** A new worktree on a host someone owns. */
export function createHostDestination({
	client,
	projectId,
	branch,
	name,
}: CreateHostDestinationInput): TeleportDestinationEndpoint {
	return {
		prepare: async () => {
			const created = await client.workspaces.create.mutate({
				projectId,
				branch,
				name,
				checkout: "worktree",
			});
			return readyOnHost(client, created.workspace.id);
		},
	};
}
