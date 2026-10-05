/**
 * The vocabulary a teleport is described in, shared by the host that
 * performs one and the client that shows it.
 *
 * Types only, plus the pure functions that derive them. The git work lives
 * in host-service; nothing here may import node built-ins, because the
 * renderer imports this module to render the review dialog.
 */

/** What becomes of one pane on the other side. */
export type PaneDisposition =
	/** An agent with a resumable session: handoff note, then resume. */
	| { kind: "agent-resumes"; agent: string }
	/** An agent we cannot resume; it restarts with the handoff note only. */
	| { kind: "agent-restarts"; agent: string }
	/** A long-running process re-launched from its command line. */
	| { kind: "process-restarts"; command: string }
	/** A plain shell: the destination opens one, with no scrollback. */
	| { kind: "shell-opens" };

export interface PanePlan {
	paneId: string;
	/** What the pane is running now, for the row's left-hand side. */
	label: string;
	disposition: PaneDisposition;
}

export interface TabPlan {
	tabId: string;
	title: string;
	panes: PanePlan[];
}

export interface WorkingTreeSummary {
	modified: number;
	untracked: number;
	preciousFiles: number;
	unpushedCommits: number;
}

/**
 * The two ways a destination can be unable to take a branch. Both are cheap
 * to detect and expensive to discover late.
 */
export type TeleportRefusal =
	| { kind: "branch-checked-out"; branch: string; path: string }
	| { kind: "branch-diverged"; branch: string; destinationTip: string }
	/** The destination has no checkout of this repository to arrive in. */
	| { kind: "repository-missing"; branch: string; repository: string }
	/** The destination could not be checked; moving blind could bury work. */
	| { kind: "unverified"; branch: string; reason: string };

export interface TeleportPlan {
	branch: string;
	destinationHostName: string;
	/** Whether the destination has to clone before it can take the branch. */
	repository: "clone" | "fetch";
	workingTree: WorkingTreeSummary;
	tabs: TabPlan[];
	/** Non-empty means the move cannot proceed; the dialog shows these. */
	refusals: TeleportRefusal[];
	/** True when nothing but the branch itself would move. */
	isEmpty: boolean;
}

export interface BuildTeleportPlanInput {
	branch: string;
	destinationHostName: string;
	destinationHasRepository: boolean;
	workingTree: WorkingTreeSummary;
	tabs: TabPlan[];
	refusals?: TeleportRefusal[];
}

export function buildTeleportPlan({
	branch,
	destinationHostName,
	destinationHasRepository,
	workingTree,
	tabs,
	refusals = [],
}: BuildTeleportPlanInput): TeleportPlan {
	return {
		branch,
		destinationHostName,
		repository: destinationHasRepository ? "fetch" : "clone",
		workingTree,
		tabs,
		refusals,
		isEmpty: isNothingToMove(workingTree, tabs),
	};
}

/**
 * A move with no uncommitted work and no panes still does something useful
 * (the branch appears there, the workspace opens), but the dialog should say
 * so rather than implying work is in flight.
 */
function isNothingToMove(
	workingTree: WorkingTreeSummary,
	tabs: TabPlan[],
): boolean {
	const clean =
		workingTree.modified === 0 &&
		workingTree.untracked === 0 &&
		workingTree.preciousFiles === 0 &&
		workingTree.unpushedCommits === 0;
	return clean && tabs.every((tab) => tab.panes.length === 0);
}

/**
 * The disposition of a pane, from what host-service already knows about it.
 *
 * The ordering is the point: a resumable agent session outranks the process
 * it happens to be running, because "resume the conversation" is what the
 * user means by moving an agent pane. Only a pane running nothing at all
 * becomes a bare shell.
 */
export function derivePaneDisposition(pane: {
	agentId: string | null;
	agentSessionId: string | null;
	canResumeSession: boolean;
	foregroundCommand: string | null;
}): PaneDisposition {
	if (pane.agentId) {
		return pane.agentSessionId && pane.canResumeSession
			? { kind: "agent-resumes", agent: pane.agentId }
			: { kind: "agent-restarts", agent: pane.agentId };
	}
	if (pane.foregroundCommand) {
		return { kind: "process-restarts", command: pane.foregroundCommand };
	}
	return { kind: "shell-opens" };
}

/**
 * The steps a run moves through, in order. This list is the progress UI, the
 * failure vocabulary, and the documentation of what a teleport does — which
 * is why it is one array rather than three.
 */
export const TELEPORT_STEPS = [
	"handoff",
	"capture",
	"createWorktree",
	"restore",
	"setup",
	"tabs",
	"stopSource",
	"launch",
] as const;

export type TeleportStepId = (typeof TELEPORT_STEPS)[number];

/**
 * Where a capture's bundle is written. Named by workspace so a retry
 * overwrites its own file rather than accumulating one per attempt, and
 * carried in the ref namespace so a stray file is identifiable.
 */
export function handoffBundleName(workspaceId: string): string {
	return `superset-teleport-${workspaceId}.bundle`;
}

/**
 * The shell that puts a published capture back into a checkout that can
 * reach origin. It is what a destination runs when nothing newer than git is
 * installed there — a fresh sandbox, or a host on a release without
 * `teleport.restore`. Prints one `TELEPORT_RESTORED <n> files` line, which is
 * what a caller watches for.
 */
export function buildArrivalCommand(ref: string, branch: string): string {
	const q = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
	// `--reset` rather than a two-tree merge: a second arrival finds the first
	// one's untracked files already in the working tree, and a merge refuses
	// to overwrite them. The refresh's own failure is swallowed in a group so
	// the marker still means every step before it succeeded.
	return [
		`git fetch -q origin ${q(`${ref}:${ref}`)}`,
		`git checkout -q -B ${q(branch)} ${q(`${ref}~2`)}`,
		`git read-tree -u --reset ${q(ref)}`,
		`git read-tree ${q(`${ref}^`)}`,
		`git update-ref -d ${q(ref)}`,
		"{ git update-index -q --refresh || true; }",
		`echo "TELEPORT_RESTORED $(git status --porcelain=v1 --untracked-files=all | wc -l | tr -d ' ') files on $(git branch --show-current) @ $(git rev-parse --short HEAD)"`,
	].join(" && ");
}

/** The ref a workspace's capture lives behind, on the source and on origin. */
export function handoffRef(workspaceId: string): string {
	return `refs/superset/teleport/${workspaceId}`;
}

/**
 * Capture and push from a checkout whose host-service predates `teleport.*`:
 * a cloud sandbox runs the released build, so the capture is typed into one
 * of its own terminals as plain git. It mirrors `captureHandoff`: the index
 * as the staged tree, a scratch index with `add -A` as the working tree, two
 * commits on HEAD under the teleport identity, the ref pushed by force. The
 * marker carries HEAD, the working commit, and the working tree id, which a
 * second pass compares to know whether anything changed.
 */
export function buildDepartureCommand(ref: string, remote = "origin"): string {
	const q = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
	const identity =
		"-c user.name='Superset Teleport' -c user.email='teleport@superset.invalid'";
	return [
		"HEAD_SHA=$(git rev-parse HEAD)",
		"STAGED_TREE=$(git write-tree)",
		"SCRATCH_INDEX=$(mktemp)",
		'cp "$(git rev-parse --git-path index)" "$SCRATCH_INDEX"',
		'GIT_INDEX_FILE="$SCRATCH_INDEX" git add -A',
		'WORKING_TREE=$(GIT_INDEX_FILE="$SCRATCH_INDEX" git write-tree)',
		'rm -f "$SCRATCH_INDEX"',
		`STAGED_COMMIT=$(git ${identity} commit-tree "$STAGED_TREE" -p "$HEAD_SHA" -m 'superset teleport: staged changes')`,
		`WORKING_COMMIT=$(git ${identity} commit-tree "$WORKING_TREE" -p "$STAGED_COMMIT" -m 'superset teleport: working tree')`,
		`git update-ref ${q(ref)} "$WORKING_COMMIT"`,
		`git push -q --force ${q(remote)} ${q(`${ref}:${ref}`)}`,
		'echo "TELEPORT_PUBLISHED $HEAD_SHA $WORKING_COMMIT $WORKING_TREE"',
	].join(" && ");
}

/** What a departure prints: HEAD, the working commit, the working tree id. */
export const DEPARTURE_MARKER =
	/TELEPORT_PUBLISHED ([0-9a-f]+) ([0-9a-f]+) ([0-9a-f]+)/;

/** The plan's counts, from a checkout that cannot answer `teleport.sourceState`. */
export function buildStateProbeCommand(): string {
	return [
		"STATUS=$(git status --porcelain=v1 --untracked-files=all)",
		`echo "TELEPORT_STATE $(printf '%s\n' "$STATUS" | grep -c '^[^?]' ; true) $(printf '%s\n' "$STATUS" | grep -c '^??' ; true) $(git branch --show-current) $(git remote get-url origin 2>/dev/null || echo -)"`,
	].join(" && ");
}

/** modified count, untracked count, branch. */
export const STATE_MARKER = /TELEPORT_STATE (\d+) (\d+) (\S+) (\S+)/;

/**
 * One name for a repository however it is addressed: `host/owner/name`,
 * lower-cased, without the scheme, credentials, or `.git`. Two checkouts
 * belong together when this matches, which is what picks the destination's
 * project and the sandbox's environment.
 */
export function repositoryIdentity(
	url: string | null | undefined,
): string | null {
	if (!url) return null;
	let rest = url.trim();
	if (rest === "" || rest.startsWith("/") || rest.startsWith(".")) return null;
	if (/^file:/i.test(rest)) return null;
	const scp = rest.match(/^[\w.-]+@([^:/]+):(.+)$/);
	if (scp) rest = `${scp[1]}/${scp[2]}`;
	else {
		rest = rest.replace(/^[a-z+]+:\/\//i, "");
		rest = rest.replace(/^[^@/]+@/, "");
	}
	rest = rest.replace(/:\d+\//, "/");
	rest = rest.replace(/\.git\/?$/, "").replace(/\/+$/, "");
	const parts = rest.split("/").filter(Boolean);
	if (parts.length < 3) return null;
	return parts.slice(0, 3).join("/").toLowerCase();
}

/** The identity of a forge repository named `owner/name`, GitHub unless said otherwise. */
export function repositoryIdentityFromFullName(
	fullName: string,
	host = "github.com",
): string | null {
	return repositoryIdentity(`https://${host}/${fullName}`);
}

/** The marker a successful arrival prints; `n` is the dirty-file count. */
export const ARRIVAL_MARKER =
	/TELEPORT_RESTORED (\d+) files on (\S+) @ ([0-9a-f]+)/;
