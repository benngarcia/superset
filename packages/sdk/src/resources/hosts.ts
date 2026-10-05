import type { APIPromise } from "../core/api-promise";
import { SupersetError } from "../core/error";
import { APIResource } from "../core/resource";
import type { RequestOptions } from "../internal/request-options";
import { uuid4 } from "../internal/utils/uuid";

/**
 * Hosts are machines running Superset in your organization. Their projects
 * and workspaces live on the machine, so these calls go to it through the
 * relay, and the machine has to be online. `hostId` defaults to the client's.
 */
export class Hosts extends APIResource {
	projects: HostProjects = new HostProjects(this._client);
	workspaces: HostWorkspaces = new HostWorkspaces(this._client);

	/** List the hosts you are linked to in the organization, with whether each is online. */
	list(options?: RequestOptions): APIPromise<HostListResponse> {
		const organizationId = this._client.organizationId;
		if (!organizationId) {
			throw new SupersetError(
				"organizationId is required. Set SUPERSET_ORGANIZATION_ID, or pass `organizationId` to the Superset constructor.",
			);
		}
		return this._client.userQuery<HostListResponse>(
			{ method: "hosts.list", procedure: "host.list" },
			{ organizationId },
			options,
		);
	}
}

export class HostProjects extends APIResource {
	/** List the projects (repositories) set up on a host. */
	list(
		params: HostTargetParams = {},
		options?: RequestOptions,
	): APIPromise<HostProjectListResponse> {
		return this._client.hostQuery<HostProjectListResponse>(
			params.hostId,
			{ method: "hosts.projects.list", procedure: "project.list" },
			undefined,
			options,
		);
	}
}

export class HostWorkspaces extends APIResource {
	/** List a host's workspaces, optionally for one project or matching `search`. */
	async list(
		params: HostWorkspaceListParams = {},
		options?: RequestOptions,
	): Promise<HostWorkspaceListResponse> {
		const workspaces = await this._client.hostQuery<HostWorkspace[]>(
			params.hostId,
			{ method: "hosts.workspaces.list", procedure: "workspace.list" },
			undefined,
			options,
		);
		const search = params.search?.toLowerCase();
		return workspaces.filter(
			(workspace) =>
				(!params.projectId || workspace.projectId === params.projectId) &&
				(!search ||
					workspace.name.toLowerCase().includes(search) ||
					workspace.branch.toLowerCase().includes(search)),
		);
	}

	/**
	 * Create a workspace for a project on a host: by default its own git
	 * worktree on `branch` (or `pr`). `checkout: "local"` uses the project's
	 * own checkout instead, with no branch, `pr` or `baseBranch`. Retrying
	 * with the same `id` returns the workspace already created.
	 */
	create(
		params: HostWorkspaceCreateParams,
		options?: RequestOptions,
	): APIPromise<HostWorkspaceCreateResult> {
		const local = params.checkout === "local";
		return this._client.hostMutation<HostWorkspaceCreateResult>(
			params.hostId,
			{
				method: "hosts.workspaces.create",
				procedure: local ? "workspaces.createLocal" : "workspaces.create",
			},
			{
				id: params.id ?? uuid4(),
				projectId: params.projectId,
				checkout: params.checkout,
				name: params.name,
				branch: params.branch,
				pr: params.pr,
				baseBranch: params.baseBranch,
				taskId: params.taskId,
				tags: params.tags,
				agents: params.agents,
				command: params.command,
			},
			options,
		);
	}

	/** Create a workspace with no project: a scratch folder with its own git repository. */
	createSession(
		params: HostWorkspaceCreateSessionParams = {},
		options?: RequestOptions,
	): APIPromise<HostWorkspaceCreateSessionResult> {
		return this._client.hostMutation<HostWorkspaceCreateSessionResult>(
			params.hostId,
			{
				method: "hosts.workspaces.createSession",
				procedure: "workspaces.createSession",
			},
			{
				id: params.id ?? uuid4(),
				name: params.name,
				tags: params.tags,
				agents: params.agents,
				command: params.command,
			},
			options,
		);
	}

	/** Rename a workspace, retag it, or link it to a task (`taskId: null` unlinks). */
	update(
		params: HostWorkspaceUpdateParams,
		options?: RequestOptions,
	): APIPromise<HostWorkspace> {
		return this._client.hostMutation<HostWorkspace>(
			params.hostId,
			{ method: "hosts.workspaces.update", procedure: "workspace.update" },
			{
				id: params.id,
				name: params.name,
				taskId: params.taskId,
				tags: params.tags,
			},
			options,
		);
	}

	/** Delete a workspace and remove its worktree. The branch is kept. */
	delete(
		params: HostWorkspaceDeleteParams,
		options?: RequestOptions,
	): APIPromise<HostWorkspaceDeleteResult> {
		return this._client.hostMutation<HostWorkspaceDeleteResult>(
			params.hostId,
			{ method: "hosts.workspaces.delete", procedure: "workspace.delete" },
			{ id: params.id },
			options,
		);
	}
}

export interface Host {
	/** The host's machine id: the `hostId` for every host call. */
	id: string;
	name: string;
	online: boolean;
	organizationId: string;
}

export type HostListResponse = Host[];

export interface HostTargetParams {
	/** Machine id of the host (see `hosts.list()`). Defaults to the client's `hostId`. */
	hostId?: string;
}

export interface HostProject {
	id: string;
	name: string;
	/** Absolute path of the repository on the host. */
	repoPath: string;
	repoOwner: string | null;
	repoName: string | null;
	repoUrl: string | null;
	worktreeBaseDir: string | null;
	createdAt: number;
	updatedAt: number;
}

export type HostProjectListResponse = HostProject[];

export interface HostWorkspace {
	id: string;
	organizationId: string;
	/** Null for a workspace with no project (see `createSession`). */
	projectId: string | null;
	projectName?: string | null;
	hostId: string;
	name: string;
	branch: string;
	/** `worktree` owns a git worktree, `local` uses the project's checkout, `session` has no project. */
	type: "local" | "worktree" | "session" | "main";
	createdByUserId: string | null;
	taskId: string | null;
	createdAt: string;
	updatedAt: string;
	/** Absolute path of the workspace on the host. */
	worktreePath?: string;
	worktreeExists?: boolean;
}

export type HostWorkspaceListResponse = HostWorkspace[];

export interface HostWorkspaceListParams extends HostTargetParams {
	projectId?: string;
	/** Matches workspace name or branch, ignoring case. */
	search?: string;
}

export interface HostWorkspaceAgentLaunch {
	/** Agent preset id, e.g. `"claude"`, or a host agent config id. */
	agent: string;
	prompt: string;
	model?: string;
	effort?: string;
	attachmentIds?: string[];
}

export interface HostWorkspaceCreateParams extends HostTargetParams {
	/** Your id for the workspace, so a retry does not create a second one. Generated when omitted. */
	id?: string;
	/** Project id (see `hosts.projects.list()`). */
	projectId: string;
	/** Omitted: named from the branch, or by the agent's prompt. */
	name?: string;
	checkout?: "worktree" | "local";
	/** Branch to check out. Created from `baseBranch` when it does not exist. */
	branch?: string;
	/** Pull request number; the host checks out its head. Not with `branch`. */
	pr?: number;
	baseBranch?: string;
	taskId?: string;
	/** Tags group workspaces into a sidebar folder of the same name. */
	tags?: string[];
	/** Terminal agents to launch once the workspace is ready. */
	agents?: HostWorkspaceAgentLaunch[];
	/** Shell command to run in the workspace once it is ready. */
	command?: string;
}

export type HostWorkspaceCreateAgentResult =
	| { ok: true; kind: "terminal"; sessionId: string; label: string }
	| { ok: false; error: string };

export interface HostWorkspaceCreateResult {
	workspace: HostWorkspace;
	terminals: Array<{ terminalId: string; label?: string }>;
	agents: HostWorkspaceCreateAgentResult[];
	alreadyExists: boolean;
}

export interface HostWorkspaceCreateSessionParams extends HostTargetParams {
	id?: string;
	name?: string;
	tags?: string[];
	agents?: HostWorkspaceAgentLaunch[];
	command?: string;
}

export type HostWorkspaceCreateSessionResult = Omit<
	HostWorkspaceCreateResult,
	"alreadyExists"
>;

export interface HostWorkspaceUpdateParams extends HostTargetParams {
	id: string;
	name?: string;
	taskId?: string | null;
	tags?: string[];
}

export interface HostWorkspaceDeleteParams extends HostTargetParams {
	id: string;
}

export interface HostWorkspaceDeleteResult {
	success: boolean;
	worktreeRemoved?: boolean;
	branchDeleted?: boolean;
	warnings?: string[];
}
