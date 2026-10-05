import { useLingui } from "@lingui/react/macro";
import type { TeleportPlan } from "@superset/shared/teleport";
import {
	buildTeleportPlan,
	derivePaneDisposition,
} from "@superset/shared/teleport";
import {
	runTeleport,
	type TeleportProgress,
} from "@superset/shared/teleport-driver";
import { toast } from "@superset/ui/sonner";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useWorkspaceHostOptions } from "renderer/hooks/useWorkspaceHostOptions";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useSandboxAccess } from "renderer/routes/_authenticated/providers/SandboxAccessProvider";
import { composeTeleportOperations } from "./hooks/useTeleport/composeTeleportOperations";
import {
	createCloudDestination,
	createHostDestination,
	createSourceEndpoint,
	type TeleportDestinationEndpoint,
} from "./hooks/useTeleport/endpoints";
import { useTeleportRunsStore } from "./stores/teleportRunsStore";
import { TeleportDialog } from "./TeleportDialog";
import type {
	TeleportDestination,
	TeleportRunState,
	TeleportSource,
} from "./types";
import { deriveRunOutcome } from "./utils/runOutcome";

/**
 * Everything the dialog needs from the app, in one place.
 *
 * The dialog itself renders phases and nothing else; this resolves the two
 * ends of the move into endpoints, loads the real plan, and runs the real
 * driver over their composition. The run's progress lives in a store keyed
 * by workspace, not here: the dialog can be closed while the move
 * continues, reopened onto it, and a move nobody is watching announces its
 * end with a toast.
 */

interface TeleportDialogContainerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The source workspace's id: a host workspace, or a cloud row. */
	workspaceId: string;
	workspaceLabel: string;
	source: TeleportSource;
}

const EMPTY_RUN: TeleportRunState = { steps: {}, error: null };
/** Long enough to come back to; a finished move is worth more than a glance. */
const FINISHED_TOAST_MS = 15_000;

export function TeleportDialogContainer({
	open,
	onOpenChange,
	workspaceId,
	workspaceLabel,
	source,
}: TeleportDialogContainerProps) {
	const { t } = useLingui();
	// The same resolver the sidebar's other cross-host actions use, so a
	// teleport addresses a host exactly the way a delete or an open does.
	const { cache: hostCache } = useHostWorkspaces();
	const { localHostId, activeHostUrl } = useWorkspaceHostOptions();
	const { targets: sandboxes } = useSandboxAccess();
	const organizationId = useActiveOrganizationId();
	const navigate = useNavigate();
	const record = useTeleportRunsStore((state) => state.runs[workspaceId]);
	const [plan, setPlan] = useState<TeleportPlan | null>(null);
	const planRequest = useRef(0);
	const run = record?.run ?? EMPTY_RUN;

	// While this dialog is mounted the run is being watched, so its ending
	// shows here and not as a toast.
	useEffect(() => {
		useTeleportRunsStore.getState().setWatched(workspaceId, true);
		return () => useTeleportRunsStore.getState().setWatched(workspaceId, false);
	}, [workspaceId]);

	const hostUrlFor = useCallback(
		(hostId: string) =>
			hostCache.resolveHostUrl(hostId) ??
			(hostId === localHostId ? activeHostUrl : null),
		[hostCache, localHostId, activeHostUrl],
	);
	const sourceUrl =
		source.kind === "host"
			? hostUrlFor(source.hostId)
			: (sandboxes.find(
					(sandbox) => sandbox.workspaceId === source.cloudWorkspaceId,
				)?.url ?? null);

	const openDestination = useCallback(
		(destinationWorkspaceId: string | null) => {
			useTeleportRunsStore.getState().clear(workspaceId);
			if (!destinationWorkspaceId) return;
			void navigate({
				to: "/v2-workspace/$workspaceId",
				params: { workspaceId: destinationWorkspaceId },
			});
		},
		[workspaceId, navigate],
	);

	const announce = useCallback(
		(host: TeleportDestination) => {
			const finished = useTeleportRunsStore.getState().runs[workspaceId];
			if (!finished) return;
			const outcome = deriveRunOutcome(finished.run);
			if (finished.watched) return;
			if (outcome === "done") {
				const { destinationWorkspaceId } = finished;
				toast.success(t({ message: `Teleported to ${host.name}` }), {
					description: workspaceLabel,
					duration: FINISHED_TOAST_MS,
					action: {
						label: t({ message: `Open on ${host.name}` }),
						onClick: () => openDestination(destinationWorkspaceId),
					},
					onDismiss: () => useTeleportRunsStore.getState().clear(workspaceId),
					onAutoClose: () => useTeleportRunsStore.getState().clear(workspaceId),
				});
			} else if (outcome === "failed") {
				toast.error(t({ message: `Teleport to ${host.name} failed` }), {
					description: finished.run.error ?? workspaceLabel,
					onDismiss: () => useTeleportRunsStore.getState().clear(workspaceId),
					onAutoClose: () => useTeleportRunsStore.getState().clear(workspaceId),
				});
			}
		},
		[workspaceId, workspaceLabel, t, openDestination],
	);

	const loadPlan = useCallback(
		async (host: TeleportDestination) => {
			const request = ++planRequest.current;
			setPlan(null);
			if (!sourceUrl) return;

			const sourceEndpoint = createSourceEndpoint(
				getHostServiceClientByUrl(sourceUrl),
				workspaceId,
			);
			const [state, entries] = await Promise.all([
				sourceEndpoint.state(),
				sourceEndpoint.handoff(),
			]);
			const { branch } = state;
			// Every live agent pane gets a row and a verb.
			const panes = entries.map((entry) => ({
				paneId: entry.terminalId,
				label: entry.agent,
				disposition: derivePaneDisposition({
					agentId: entry.agent,
					agentSessionId: null,
					// Context travels as a prompt, so a pane resumes whether or
					// not its harness can restore a session id.
					canResumeSession: true,
					foregroundCommand: null,
				}),
			}));
			const tabs =
				panes.length > 0 ? [{ tabId: "panes", title: "Panes", panes }] : [];

			if (host.kind === "cloud") {
				// A sandbox is new by construction: nothing to diverge from,
				// and it fetches the repository before anything else.
				if (request !== planRequest.current) return;
				setPlan(
					buildTeleportPlan({
						branch,
						destinationHostName: host.name,
						destinationHasRepository: false,
						workingTree: state.workingTree,
						tabs,
					}),
				);
				return;
			}

			// The destination's own view of the branch, judged by the source,
			// which is the side that knows what it contains.
			const destinationUrl = hostUrlFor(host.id);
			const destination = destinationUrl
				? getHostServiceClientByUrl(destinationUrl)
				: null;
			const project = destination
				? await findProject(destination, state.worktreePath)
				: null;
			const destinationState =
				destination && project
					? await destination.teleport.destinationState
							.query({ repositoryPath: project.repoPath, branch })
							.catch(() => null)
					: null;
			const refusal = destinationState
				? await sourceEndpoint
						.refusalFor(branch, destinationState)
						.catch(() => null)
				: null;

			if (request !== planRequest.current) return;
			setPlan(
				buildTeleportPlan({
					branch,
					destinationHostName: host.name,
					destinationHasRepository: project !== null,
					workingTree: state.workingTree,
					tabs,
					refusals: refusal ? [refusal] : [],
				}),
			);
		},
		[workspaceId, sourceUrl, hostUrlFor],
	);

	const start = useCallback(
		async (host: TeleportDestination) => {
			if (!sourceUrl || !plan) return;
			const sourceEndpoint = createSourceEndpoint(
				getHostServiceClientByUrl(sourceUrl),
				workspaceId,
			);
			const destination = await resolveDestination(host, {
				organizationId,
				workspaceLabel,
				branch: plan.branch,
				hostUrlFor,
				sourceWorktreePath: (await sourceEndpoint.state()).worktreePath,
			});
			if (!destination) return;

			useTeleportRunsStore.getState().begin(workspaceId, host);
			await runTeleport(
				composeTeleportOperations({
					source: sourceEndpoint,
					destination,
					branch: plan.branch,
					onDestinationReady: (destinationWorkspaceId) =>
						useTeleportRunsStore
							.getState()
							.setDestinationWorkspace(workspaceId, destinationWorkspaceId),
				}),
				(event: TeleportProgress) =>
					useTeleportRunsStore.getState().progress(workspaceId, event),
			);
			announce(host);
		},
		[
			workspaceId,
			sourceUrl,
			hostUrlFor,
			plan,
			organizationId,
			workspaceLabel,
			announce,
		],
	);

	return (
		<TeleportDialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					planRequest.current++;
					setPlan(null);
					// A finished run is read; one still going keeps its record
					// so the dialog can reopen on it and its ending gets announced.
					if (record && deriveRunOutcome(record.run) !== "running") {
						useTeleportRunsStore.getState().clear(workspaceId);
					}
				}
				onOpenChange(next);
			}}
			workspaceLabel={workspaceLabel}
			source={source}
			plan={plan}
			run={run}
			resumeRun={record?.destination ?? null}
			onDestinationChosen={loadPlan}
			onConfirm={start}
			onOpenThere={() => {
				openDestination(record?.destinationWorkspaceId ?? null);
				onOpenChange(false);
			}}
		/>
	);
}

interface ResolveDestinationInput {
	organizationId: string | null;
	workspaceLabel: string;
	branch: string;
	hostUrlFor: (hostId: string) => string | null;
	sourceWorktreePath: string;
}

/** The chosen destination as an endpoint; null when it cannot be addressed. */
async function resolveDestination(
	host: TeleportDestination,
	{
		organizationId,
		workspaceLabel,
		branch,
		hostUrlFor,
		sourceWorktreePath,
	}: ResolveDestinationInput,
): Promise<TeleportDestinationEndpoint | null> {
	if (host.kind === "cloud") {
		if (!organizationId) return null;
		return createCloudDestination({
			organizationId,
			workspaceName: workspaceLabel,
		});
	}
	const url = hostUrlFor(host.id);
	if (!url) return null;
	const client = getHostServiceClientByUrl(url);
	const project = await findProject(client, sourceWorktreePath);
	return createHostDestination({
		client,
		projectId: project?.id ?? "",
		branch,
		name: workspaceLabel,
	});
}

/**
 * The destination's project for the same repository, matched on the repo
 * directory name. A destination that has never seen the repository returns
 * null, which is what turns the plan's "Repo" row into "clones first".
 */
async function findProject(
	client: HostServiceClient,
	sourceWorktreePath: string,
): Promise<{ id: string; repoPath: string } | null> {
	const projects = await client.project.list.query().catch(() => []);
	const name = repoNameOf(sourceWorktreePath);
	const match = projects.find(
		(project: { repoPath: string }) => repoNameOf(project.repoPath) === name,
	);
	return match ? { id: match.id, repoPath: match.repoPath } : null;
}

function repoNameOf(path: string): string {
	return path.replace(/\/+$/, "").split("/").pop() ?? "";
}
