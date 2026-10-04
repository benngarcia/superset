import { afterEach, expect, mock, spyOn, test } from "bun:test";
import type { HostServiceContext } from "../../../../types";
import { createCallerFactory, router } from "../../../index";
import * as projects from "../../workspace-creation/shared/project-helpers";
import * as gh from "../../workspace-creation/utils/exec-gh";
import { getDiff } from "../procedures/get-diff";
import { getDiffByRepo } from "../procedures/get-diff-by-repo";
import { fetchPullRequestDiff } from "./fetch-pull-request-diff";
import * as gitDiff from "./fetch-pull-request-git-diff";

afterEach(() => mock.restore());

test("project and repository endpoints share a case-insensitive in-flight cache", async () => {
	let resolve!: (patch: string) => void;
	const exec = spyOn(gh, "execGh").mockImplementation(
		() =>
			new Promise<string>((done) => {
				resolve = done;
			}),
	);
	spyOn(projects, "resolveGithubRepo").mockResolvedValue({
		owner: "Owner",
		name: "Shared",
		repoPath: "/unused",
	});
	const caller = createCallerFactory(router({ getDiff, getDiffByRepo }))({
		isAuthenticated: true,
	} as HostServiceContext);
	const byProject = caller.getDiff({ projectId: "project", prNumber: 81 });
	const byRepo = caller.getDiffByRepo({
		repoFullName: "owner/shared",
		prNumber: 81,
	});
	await new Promise((done) => setTimeout(done, 0));
	expect(exec).toHaveBeenCalledTimes(1);
	resolve("patch");
	expect(await Promise.all([byProject, byRepo])).toEqual([
		{ patch: "patch" },
		{ patch: "patch" },
	]);
	expect(
		await caller.getDiffByRepo({ repoFullName: "OWNER/SHARED", prNumber: 81 }),
	).toEqual({ patch: "patch" });
	expect(exec).toHaveBeenCalledTimes(1);
});

test("expires cached diffs after 30 seconds", async () => {
	const now = spyOn(Date, "now").mockReturnValue(100_000);
	const exec = spyOn(gh, "execGh").mockResolvedValue("first");
	expect(await fetchPullRequestDiff("owner/expiry", 1)).toBe("first");
	now.mockReturnValue(129_999);
	expect(await fetchPullRequestDiff("owner/expiry", 1)).toBe("first");
	expect(exec).toHaveBeenCalledTimes(1);
	now.mockReturnValue(130_000);
	exec.mockResolvedValue("updated");
	expect(await fetchPullRequestDiff("owner/expiry", 1)).toBe("updated");
	expect(exec).toHaveBeenCalledTimes(2);
});

test("evicts failures so the next request retries", async () => {
	const exec = spyOn(gh, "execGh").mockRejectedValue(new Error("offline"));
	await expect(fetchPullRequestDiff("owner/retry", 1)).rejects.toThrow(
		"offline",
	);
	exec.mockResolvedValue("recovered");
	expect(await fetchPullRequestDiff("owner/retry", 1)).toBe("recovered");
	expect(exec).toHaveBeenCalledTimes(2);
});

test("keeps repositories and PR numbers separate", async () => {
	const exec = spyOn(gh, "execGh").mockResolvedValue("patch");
	await Promise.all([
		fetchPullRequestDiff("owner/one", 2),
		fetchPullRequestDiff("owner/two", 2),
		fetchPullRequestDiff("owner/one", 3),
	]);
	expect(exec).toHaveBeenCalledTimes(3);
});

test("preserves the legacy patch without invoking the Git fallback", async () => {
	const patch =
		"diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-old\n+new\n";
	spyOn(gh, "execGh").mockResolvedValue(patch);
	const fallback = spyOn(gitDiff, "fetchPullRequestGitDiff").mockResolvedValue(
		"fallback",
	);
	expect(await fetchPullRequestDiff("owner/legacy-patch", 1)).toBe(patch);
	expect(fallback).not.toHaveBeenCalled();
});

test("preserves a successful empty legacy diff", async () => {
	spyOn(gh, "execGh").mockResolvedValue("");
	const fallback = spyOn(gitDiff, "fetchPullRequestGitDiff").mockResolvedValue(
		"fallback",
	);
	expect(await fetchPullRequestDiff("owner/legacy-empty", 1)).toBe("");
	expect(fallback).not.toHaveBeenCalled();
});

test.each([
	"GraphQL: PullRequest.diff too_large",
	"HTTP 406: diff exceeded the maximum number of lines",
])("uses Git for a size-limited diff: %s", async (message) => {
	spyOn(gh, "execGh").mockRejectedValue(new Error(message));
	const fallback = spyOn(gitDiff, "fetchPullRequestGitDiff").mockResolvedValue(
		"complete patch",
	);
	const prNumber = message.startsWith("GraphQL") ? 1 : 2;
	expect(await fetchPullRequestDiff("owner/large-diff", prNumber)).toBe(
		"complete patch",
	);
	expect(fallback).toHaveBeenCalledWith("owner/large-diff", prNumber);
	expect(await fetchPullRequestDiff("OWNER/LARGE-DIFF", prNumber)).toBe(
		"complete patch",
	);
	expect(fallback).toHaveBeenCalledTimes(1);
});

test.each([
	"HTTP 401: Bad credentials",
	"HTTP 404: Not Found",
	"HTTP 429: API rate limit exceeded",
	"network connection lost",
])("preserves non-size errors without fetching Git objects: %s", async (message) => {
	const error = new Error(message);
	spyOn(gh, "execGh").mockRejectedValue(error);
	const fallback = spyOn(gitDiff, "fetchPullRequestGitDiff").mockResolvedValue(
		"fallback",
	);
	await expect(fetchPullRequestDiff("owner/unchanged-errors", 1)).rejects.toBe(
		error,
	);
	expect(fallback).not.toHaveBeenCalled();
});

test("evicts a failed Git fallback so a retry can recover", async () => {
	spyOn(gh, "execGh").mockRejectedValue(
		new Error("PullRequest.diff too_large"),
	);
	const fallback = spyOn(gitDiff, "fetchPullRequestGitDiff").mockRejectedValue(
		new Error("fetch failed"),
	);
	await expect(fetchPullRequestDiff("owner/git-retry", 1)).rejects.toThrow(
		"fetch failed",
	);
	fallback.mockResolvedValue("recovered patch");
	expect(await fetchPullRequestDiff("owner/git-retry", 1)).toBe(
		"recovered patch",
	);
	expect(fallback).toHaveBeenCalledTimes(2);
});

test("shares slow in-flight requests and starts their TTL when they finish", async () => {
	const now = spyOn(Date, "now").mockReturnValue(200_000);
	let resolve!: (patch: string) => void;
	const exec = spyOn(gh, "execGh").mockImplementation(
		() =>
			new Promise<string>((done) => {
				resolve = done;
			}),
	);
	const first = fetchPullRequestDiff("owner/slow-fetch", 1);
	now.mockReturnValue(260_000);
	const second = fetchPullRequestDiff("OWNER/SLOW-FETCH", 1);
	expect(exec).toHaveBeenCalledTimes(1);
	resolve("slow patch");
	expect(await Promise.all([first, second])).toEqual([
		"slow patch",
		"slow patch",
	]);
	now.mockReturnValue(289_999);
	expect(await fetchPullRequestDiff("owner/slow-fetch", 1)).toBe("slow patch");
	expect(exec).toHaveBeenCalledTimes(1);
	now.mockReturnValue(290_000);
	exec.mockResolvedValue("fresh patch");
	expect(await fetchPullRequestDiff("owner/slow-fetch", 1)).toBe("fresh patch");
	expect(exec).toHaveBeenCalledTimes(2);
});

test("keeps in-flight requests shared when the cache reaches its limit", async () => {
	const resolvers: Array<(patch: string) => void> = [];
	const exec = spyOn(gh, "execGh").mockImplementation(
		() => new Promise<string>((resolve) => resolvers.push(resolve)),
	);
	const pending = Array.from({ length: 20 }, (_, index) =>
		fetchPullRequestDiff("owner/cache-pressure", index + 1),
	);
	pending.push(fetchPullRequestDiff("owner/cache-pressure", 21));
	pending.push(fetchPullRequestDiff("owner/cache-pressure", 1));
	expect(exec).toHaveBeenCalledTimes(21);
	for (const resolve of resolvers) resolve("patch");
	expect(await Promise.all(pending)).toEqual(Array(22).fill("patch"));
});
