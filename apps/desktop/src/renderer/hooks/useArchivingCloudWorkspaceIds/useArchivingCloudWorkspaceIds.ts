import { useMutationState } from "@tanstack/react-query";
import { getMutationKey } from "@trpc/react-query";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

const ARCHIVE_MUTATION_KEY = getMutationKey(cloudTrpc.cloudWorkspace.delete);

/** Ids of cloud workspaces whose archive has not settled yet. */
export function useArchivingCloudWorkspaceIds(): string[] {
	return useMutationState({
		filters: { mutationKey: ARCHIVE_MUTATION_KEY, status: "pending" },
		select: (mutation) => (mutation.state.variables as { id: string }).id,
	});
}
