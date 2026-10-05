import { useLingui } from "@lingui/react/macro";
import type { TeleportPlan, TeleportRefusal } from "@superset/shared/teleport";
import {
	buildTeleportPlan,
	derivePaneDisposition,
	repositoryIdentity,
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
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
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
	environmentForRepository,
	type SourceState,
	type TeleportDestinationEndpoint,
	type TeleportSourceEndpoint,
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
 *
 * Nothing that cannot be verified is allowed through. A destination that
 * cannot be reached, a repository it does not have, a check that errored:
 * each becomes a refusal on the plan, because moving blind is how work gets
 * buried.
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
			const current = () => request === planRequest.current;
			let branch = "";
			try {
				if (!sourceUrl) {
					throw new Error(
						t({ message: "This workspace's host cannot be reached" }),
					);
				}
				const sourceEndpoint = createSourceEndpoint(
					getHostServiceClientByUrl(sourceUrl),
					workspaceId,
				);
				const [state, entries] = await Promise.all([
					sourceEndpoint.state(),
					sourceEndpoint.handoff(),
				]);
				branch = state.branch;
				const tabs = tabsFor(entries);
				const refusal =
					host.kind === "cloud"
						? await cloudRefusal(state, organizationId)
						: await hostRefusal(state, sourceEndpoint, hostUrlFor(host.id));
				if (!current()) return;
				setPlan(
					buildTeleportPlan({
						branch,
						destinationHostName: host.name,
						// A sandbox is new by construction and clones before
						// anything else; a host only qualifies once it has the
						// repository as a project.
						destinationHasRepository: host.kind === "host",
						workingTree: state.workingTree,
						tabs,
						refusals: refusal ? [refusal] : [],
					}),
				);
			} catch (error) {
				if (!current()) return;
				setPlan(
					buildTeleportPlan({
						branch,
						destinationHostName: host.name,
						destinationHasRepository: true,
						workingTree: {
							modified: 0,
							untracked: 0,
							preciousFiles: 0,
							unpushedCommits: 0,
						},
						tabs: [],
						refusals: [
							{ kind: "unverified", branch, reason: errorText(error) },
						],
					}),
				);
			}
		},
		[workspaceId, sourceUrl, hostUrlFor, organizationId, t],
	);

	const start = useCallback(
		async (host: TeleportDestination) => {
			if (!sourceUrl || !plan) return;
			const store = useTeleportRunsStore.getState();
			store.begin(workspaceId, host);
			try {
				const sourceEndpoint = createSourceEndpoint(
					getHostServiceClientByUrl(sourceUrl),
					workspaceId,
				);
				const destination = await resolveDestination(host, {
					organizationId,
					workspaceLabel,
					branch: plan.branch,
					hostUrlFor,
					source: await sourceEndpoint.state(),
				});
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
			} catch (error) {
				useTeleportRunsStore.getState().fail(workspaceId, errorText(error));
			}
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

/** Every live agent pane gets a row and a verb. */
function tabsFor(entries: Array<{ terminalId: string; agent: string }>) {
	const panes = entries.map((entry) => ({
		paneId: entry.terminalId,
		label: entry.agent,
		disposition: derivePaneDisposition({
			agentId: entry.agent,
			agentSessionId: null,
			// Context travels as a prompt, so a pane resumes whether or not
			// its harness can restore a session id.
			canResumeSession: true,
			foregroundCommand: null,
		}),
	}));
	return panes.length > 0 ? [{ tabId: "panes", title: "Agents", panes }] : [];
}

/**
 * Why a host cannot take this branch, judged by the source, which is the
 * side that knows what it contains. Null when the move is safe.
 */
async function hostRefusal(
	source: SourceState,
	sourceEndpoint: TeleportSourceEndpoint,
	destinationUrl: string | null,
): Promise<TeleportRefusal | null> {
	const { branch } = source;
	if (!destinationUrl) {
		return {
			kind: "unverified",
			branch,
			reason: "The destination cannot be reached right now",
		};
	}
	const repository = repositoryIdentity(source.remoteUrl);
	if (!repository) {
		return {
			kind: "unverified",
			branch,
			reason: "This workspace has no origin remote to send the work through",
		};
	}
	const destination = getHostServiceClientByUrl(destinationUrl);
	const project = await findProject(destination, repository);
	if (!project) return { kind: "repository-missing", branch, repository };
	const destinationState = await destination.teleport.destinationState.query({
		repositoryPath: project.repoPath,
		branch,
	});
	return sourceEndpoint.refusalFor(branch, destinationState);
}

/** A sandbox is new, so the only question is whether one can be made for this repository. */
async function cloudRefusal(
	source: SourceState,
	organizationId: string | null,
): Promise<TeleportRefusal | null> {
	const { branch } = source;
	const repository = repositoryIdentity(source.remoteUrl);
	if (!repository) {
		return {
			kind: "unverified",
			branch,
			reason: "This workspace has no origin remote to send the work through",
		};
	}
	if (!organizationId) {
		return { kind: "unverified", branch, reason: "No organization is active" };
	}
	const environments = await apiTrpcClient.environment.list.query({
		organizationId,
	});
	return environmentForRepository(environments, repository)
		? null
		: { kind: "repository-missing", branch, repository };
}

interface ResolveDestinationInput {
	organizationId: string | null;
	workspaceLabel: string;
	branch: string;
	hostUrlFor: (hostId: string) => string | null;
	source: SourceState;
}

/** The chosen destination as an endpoint; throws when it cannot be addressed. */
async function resolveDestination(
	host: TeleportDestination,
	{
		organizationId,
		workspaceLabel,
		branch,
		hostUrlFor,
		source,
	}: ResolveDestinationInput,
): Promise<TeleportDestinationEndpoint> {
	const repository = repositoryIdentity(source.remoteUrl);
	if (host.kind === "cloud") {
		if (!organizationId) throw new Error("No organization is active");
		return createCloudDestination({
			organizationId,
			workspaceName: workspaceLabel,
			repository,
		});
	}
	const url = hostUrlFor(host.id);
	if (!url) throw new Error(`${host.name} cannot be reached right now`);
	const client = getHostServiceClientByUrl(url);
	const project = repository ? await findProject(client, repository) : null;
	if (!project) {
		throw new Error(`${host.name} has no project for ${repository}`);
	}
	return createHostDestination({
		client,
		projectId: project.id,
		branch,
		name: workspaceLabel,
	});
}

/**
 * The destination's project for the same repository, matched on the
 * repository's identity rather than on a folder name: two worktrees of the
 * same clone share a repository and two unrelated clones can share a name.
 */
async function findProject(
	client: HostServiceClient,
	repository: string,
): Promise<{ id: string; repoPath: string } | null> {
	const projects = await client.project.list.query();
	const match = projects.find(
		(project) => repositoryIdentity(project.repoUrl) === repository,
	);
	return match ? { id: match.id, repoPath: match.repoPath } : null;
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
