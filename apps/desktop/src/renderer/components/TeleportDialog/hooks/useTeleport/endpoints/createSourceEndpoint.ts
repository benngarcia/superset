import {
	buildDepartureCommand,
	buildStateProbeCommand,
	DEPARTURE_MARKER,
	handoffRef,
	STATE_MARKER,
} from "@superset/shared/teleport";
import type { HostServiceClient } from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { runMarkedCommand } from "../marked-command";
import type {
	CaptureIdentity,
	DestinationState,
	HandoffEntry,
	PublishedCapture,
	SourceState,
	TeleportSourceEndpoint,
} from "./types";

const COMMAND_TIMEOUT_MS = 5 * 60_000;
/** Where a published capture goes; `buildDepartureCommand` pushes there too. */
const REMOTE = "origin";

/**
 * Any host-service as a source. A current one answers the `teleport.*`
 * procedures; one that predates them (a sandbox image, a host that has not
 * updated) is driven through its terminal with plain git instead, which is
 * slower to ask but needs nothing new. The choice is made per call, on the
 * host's own answer, so a mixed fleet just works.
 */
export function createSourceEndpoint(
	client: HostServiceClient,
	workspaceId: string,
): TeleportSourceEndpoint {
	const ref = handoffRef(workspaceId);

	const liveBindings = async () =>
		(
			await client.terminalAgents.listByWorkspace
				.query({ workspaceId })
				.catch(() => [])
		).filter((binding) => !binding.endedAt);

	return {
		workspaceId,

		state: () =>
			orLegacy(
				async (): Promise<SourceState> => {
					const state = await client.teleport.sourceState.query({
						workspaceId,
					});
					return {
						branch: state.branch ?? "",
						worktreePath: state.worktreePath,
						workingTree: state.workingTree,
						remoteUrl: state.remoteUrl,
					};
				},
				async (): Promise<SourceState> => {
					const workspaces = await client.workspace.list.query();
					const workspace = workspaces.find((row) => row.id === workspaceId);
					const match = await runMarkedCommand(
						client,
						workspaceId,
						buildStateProbeCommand(),
						STATE_MARKER,
						COMMAND_TIMEOUT_MS,
						"The source never reported its working tree",
					);
					// Precious files and unpushed commits read as zero: neither
					// travels by the ref transport anyway.
					return {
						branch: match[3] ?? "",
						worktreePath: workspace?.worktreePath ?? "",
						workingTree: {
							modified: Number(match[1] ?? 0),
							untracked: Number(match[2] ?? 0),
							preciousFiles: 0,
							unpushedCommits: 0,
						},
						remoteUrl: match[4] && match[4] !== "-" ? match[4] : null,
					};
				},
			),

		refusalFor: (branch, destination: DestinationState) =>
			orLegacy(
				() =>
					client.teleport.checkDestination.query({
						workspaceId,
						branch,
						destination,
					}),
				// Without the source's history only the check that needs none.
				async () =>
					destination.checkedOutAt
						? {
								kind: "branch-checked-out",
								branch,
								path: destination.checkedOutAt,
							}
						: null,
			),

		handoff: async (): Promise<HandoffEntry[]> => {
			const bindings = await liveBindings();
			const entries = await Promise.all(
				bindings.map(async (binding) => {
					const transcript = await client.terminal.transcript
						.query({ workspaceId, terminalId: binding.terminalId })
						.catch(() => null);
					return {
						terminalId: binding.terminalId,
						agent: binding.agentId,
						prompt: transcript?.text?.trim() ?? "",
					};
				}),
			);
			return entries.filter((entry) => entry.prompt.length > 0);
		},

		publish: (unless) =>
			orLegacy(
				async (): Promise<PublishedCapture> => {
					const published = await client.teleport.publish.mutate({
						workspaceId,
						unless,
					});
					return {
						ref: published.ref,
						head: published.head,
						workingTree: published.workingTree,
						unchanged: published.unchanged,
					};
				},
				async (): Promise<PublishedCapture> => {
					// A terminal cannot be told to skip the push; an unchanged
					// tree pushes nothing new, which is close enough.
					const match = await runMarkedCommand(
						client,
						workspaceId,
						buildDepartureCommand(ref),
						DEPARTURE_MARKER,
						COMMAND_TIMEOUT_MS,
						"The source never reported the capture pushed",
					);
					const identity: CaptureIdentity = {
						head: match[1] ?? "",
						workingTree: match[3] ?? "",
					};
					return {
						ref,
						...identity,
						unchanged: unless !== undefined && sameCapture(identity, unless),
					};
				},
			),

		stopAgents: async () => {
			const bindings = await liveBindings();
			await Promise.all(
				bindings.map((binding) =>
					client.terminal.killSession
						.mutate({ workspaceId, terminalId: binding.terminalId })
						.catch(() => undefined),
				),
			);
		},

		discard: () =>
			orLegacy(
				async () => {
					await client.teleport.discard.mutate({
						workspaceId,
						remote: REMOTE,
					});
				},
				async () => {
					await client.terminal.launchSession
						.mutate({
							workspaceId,
							initialCommand: `git update-ref -d '${ref}'; git push -q ${REMOTE} ':${ref}'`,
						})
						.catch(() => undefined);
				},
			),
	};
}

function sameCapture(a: CaptureIdentity, b: CaptureIdentity): boolean {
	return a.head === b.head && a.workingTree === b.workingTree;
}

async function orLegacy<T>(
	current: () => Promise<T>,
	legacy: () => Promise<T>,
): Promise<T> {
	try {
		return await current();
	} catch (error) {
		if (isMissingProcedureError(error)) return legacy();
		throw error;
	}
}
