import { afterEach, expect, mock, spyOn, test } from "bun:test";
import type { HostServiceContext } from "../../../../types";
import { createCallerFactory, router } from "../../../index";
import * as projects from "../../workspace-creation/shared/project-helpers";
import * as gh from "../../workspace-creation/utils/exec-gh";
import { getDiff } from "../procedures/get-diff";
import { getDiffByRepo } from "../procedures/get-diff-by-repo";
import { fetchPullRequestDiff } from "./fetch-pull-request-diff";

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
