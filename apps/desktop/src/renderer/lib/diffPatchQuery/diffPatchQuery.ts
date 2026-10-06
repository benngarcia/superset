import type { AppRouter } from "@superset/host-service";
import type { QueryKey, QueryMeta } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";

export type GetDiffPatchInput =
	inferRouterInputs<AppRouter>["git"]["getDiffPatch"];

/** What a `git.getDiffPatch` request diffs, which is all its query key holds.
 * The path lists stay in the input for the host but out of the key, so a
 * file joining or leaving the changeset refetches the same entry instead of
 * creating one that lingers until gc. */
export type DiffPatchScope = Omit<
	GetDiffPatchInput,
	"paths" | "untrackedPaths"
>;

export function toDiffPatchScope(input: GetDiffPatchInput): DiffPatchScope {
	const { paths: _paths, untrackedPaths: _untrackedPaths, ...scope } = input;
	return scope;
}

const PATHS_META_KEY = "diffPatchPaths";

/** Every path a request asked the host for, carried on the query so a
 * `git:changed` can tell which patches a worktree write can have moved. */
export function createDiffPatchQueryMeta(input: GetDiffPatchInput): QueryMeta {
	return {
		[PATHS_META_KEY]: [...(input.paths ?? []), ...(input.untrackedPaths ?? [])],
	};
}

interface DiffPatchQueryLike {
	queryKey: QueryKey;
	meta?: QueryMeta | undefined;
}

/**
 * Whether a worktree-only `git:changed` for `changedPaths` can have left this
 * query's patch behind. The staged diff and ref-to-ref diffs (against base, a
 * commit) only move with `.git/`, which arrives as a broad event, so a
 * worktree write stales them only when they hold one of the files. Any write
 * can add a file to the unstaged diff, and git gives an untracked file no
 * section until asked for it by path, so that category is always stale.
 */
export function isDiffPatchQueryAffected(
	query: DiffPatchQueryLike,
	changedPaths: readonly string[],
): boolean {
	if (readScope(query.queryKey)?.category === "unstaged") return true;
	const paths = query.meta?.[PATHS_META_KEY];
	if (!Array.isArray(paths)) return true;
	return changedPaths.some((path) => paths.includes(path));
}

function readScope(queryKey: QueryKey): Partial<DiffPatchScope> | undefined {
	const options = queryKey[1];
	if (typeof options !== "object" || options === null) return undefined;
	return (options as { input?: Partial<DiffPatchScope> }).input;
}
