import { execGh } from "../../workspace-creation/utils/exec-gh";

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 20;
const entries = new Map<
	string,
	{ promise: Promise<string>; fetchedAt: number }
>();

export function fetchPullRequestDiff(
	repoFullName: string,
	prNumber: number,
): Promise<string> {
	const key = `${repoFullName.toLowerCase()}#${prNumber}`;
	const now = Date.now();
	for (const [otherKey, entry] of entries) {
		if (now - entry.fetchedAt >= CACHE_TTL_MS) entries.delete(otherKey);
	}
	const cached = entries.get(key);
	if (cached) return cached.promise;
	const promise = execGh(
		["pr", "diff", String(prNumber), "--repo", repoFullName],
		{ timeout: 30_000, maxBuffer: 200 * 1024 * 1024 },
	).then((raw) => (typeof raw === "string" ? raw : ""));
	if (entries.size >= MAX_CACHE_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest !== undefined) entries.delete(oldest);
	}
	entries.set(key, { promise, fetchedAt: now });
	void promise.catch(() => {
		if (entries.get(key)?.promise === promise) entries.delete(key);
	});
	return promise;
}
