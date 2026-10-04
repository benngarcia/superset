import { execGh } from "../../workspace-creation/utils/exec-gh";
import { fetchPullRequestGitDiff } from "./fetch-pull-request-git-diff";

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 20;
const entries = new Map<
	string,
	{ promise: Promise<string>; fetchedAt: number | null }
>();

export function fetchPullRequestDiff(
	repoFullName: string,
	prNumber: number,
): Promise<string> {
	const key = `${repoFullName.toLowerCase()}#${prNumber}`;
	const now = Date.now();
	for (const [otherKey, entry] of entries) {
		if (entry.fetchedAt !== null && now - entry.fetchedAt >= CACHE_TTL_MS) {
			entries.delete(otherKey);
		}
	}
	const cached = entries.get(key);
	if (cached) return cached.promise;
	const promise = execGh(
		["pr", "diff", String(prNumber), "--repo", repoFullName],
		{ timeout: 30_000, maxBuffer: 200 * 1024 * 1024 },
	)
		.then((raw) => (typeof raw === "string" ? raw : ""))
		.catch((error: unknown) => {
			if (
				error instanceof Error &&
				/PullRequest\.diff too_large|diff exceeded the maximum number of lines/i.test(
					error.message,
				)
			) {
				return fetchPullRequestGitDiff(repoFullName, prNumber);
			}
			throw error;
		});
	if (entries.size >= MAX_CACHE_ENTRIES) {
		for (const [otherKey, entry] of entries) {
			if (entry.fetchedAt !== null) {
				entries.delete(otherKey);
				break;
			}
		}
	}
	if (entries.size < MAX_CACHE_ENTRIES) {
		entries.set(key, { promise, fetchedAt: null });
	}
	void promise.then(
		() => {
			const entry = entries.get(key);
			if (entry?.promise === promise) entry.fetchedAt = Date.now();
		},
		() => {
			if (entries.get(key)?.promise === promise) entries.delete(key);
		},
	);
	return promise;
}
