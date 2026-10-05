import { repositoryIdentityFromFullName } from "@superset/shared/teleport";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { setHostServiceSecret } from "renderer/lib/host-service-auth";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { sleep } from "../marked-command";
import { isSandboxCheckoutReady } from "../sandbox-checkout";
import { readyOnHost } from "./readyOnHost";
import type { TeleportDestinationEndpoint } from "./types";

/** Provisioning a sandbox may pull an image; generous on purpose. */
const SANDBOX_READY_TIMEOUT_MS = 12 * 60_000;
const CHECKOUT_READY_TIMEOUT_MS = 5 * 60_000;
const POLL_MS = 1_000;

export interface CreateCloudDestinationInput {
	organizationId: string;
	/** The source's name; the sandbox is named after it. */
	workspaceName: string;
	/** The source repository's identity; the sandbox must start from an environment that has it. */
	repository: string | null;
}

interface EnvironmentWithRepositories {
	id: string;
	repositories?: ReadonlyArray<{ fullName: string }> | null;
}

/**
 * The environment a teleport starts its sandbox from: one that carries the
 * source's repository. A box built from any other environment would clone
 * a different repository and the arrival would have nothing to fetch into.
 */
export function environmentForRepository<T extends EnvironmentWithRepositories>(
	environments: T[],
	repository: string | null,
): T | undefined {
	if (!repository) return undefined;
	return environments.find((environment) =>
		(environment.repositories ?? []).some(
			(entry) => repositoryIdentityFromFullName(entry.fullName) === repository,
		),
	);
}

/**
 * A new cloud sandbox. Its workspace is created by the cloud API, not host
 * `workspaces.create` (which a sandbox refuses: one project, one workspace
 * per box), and it boots the released host-service, which is why arrival is
 * plain git. No branch is requested: the box then fetches the repository's
 * default branch over its image's clone, the fast path, and the arrival
 * command moves the checkout onto the source branch. Asking for the source
 * branch, which rarely exists on origin, made that fetch fail and the box
 * clone from scratch.
 */
export function createCloudDestination({
	organizationId,
	workspaceName,
	repository,
}: CreateCloudDestinationInput): TeleportDestinationEndpoint {
	return {
		prepare: async () => {
			const environments = await apiTrpcClient.environment.list.query({
				organizationId,
			});
			const environment = environmentForRepository(environments, repository);
			if (!environment) {
				throw new Error(
					`No environment carries ${repository ?? "this repository"}`,
				);
			}
			const created = await apiTrpcClient.cloudWorkspace.create.mutate({
				organizationId,
				environmentId: environment.id,
				name: `${workspaceName} (teleported)`,
			});
			const access = await waitForSandbox(created.id);
			setHostServiceSecret(access.url, access.token);
			setHostServiceSecret(access.desktop.url, access.desktop.token);
			const client = getHostServiceClientByUrl(access.url);
			await waitForCheckout(client);

			// The sandbox seeded exactly one workspace for its checkout; that
			// row is where the terminal runs and the files land. Its id is the
			// cloud row's id, which is what the app navigates to.
			const [workspace] = await client.workspace.list.query();
			if (!workspace) throw new Error("The sandbox has no workspace yet");
			return readyOnHost(client, workspace.id);
		},
	};
}

/**
 * `cloudWorkspace.access` answers only once the sandbox is ready, and with
 * `wake` it also starts host-service inside it. Until then it throws, which
 * is the poll's "not yet".
 */
async function waitForSandbox(cloudWorkspaceId: string) {
	const deadline = Date.now() + SANDBOX_READY_TIMEOUT_MS;
	let lastError: unknown = null;
	while (Date.now() < deadline) {
		try {
			return await apiTrpcClient.cloudWorkspace.access.mutate({
				id: cloudWorkspaceId,
				wake: true,
			});
		} catch (error) {
			lastError = error;
			if (/failed|deleted/i.test(errorText(error))) break;
			await sleep(POLL_MS);
		}
	}
	throw new Error(`The sandbox did not become ready: ${errorText(lastError)}`);
}

/**
 * A woken sandbox answers seconds after the wake, but its host-service is up
 * before its clone is done. Wait for the checkout, not just for health.
 */
async function waitForCheckout(host: HostServiceClient): Promise<void> {
	const deadline = Date.now() + CHECKOUT_READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const health = await host.health.check.query().catch(() => null);
		if (health && isSandboxCheckoutReady(health)) return;
		await sleep(POLL_MS);
	}
	throw new Error("The sandbox's checkout did not finish in time");
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
