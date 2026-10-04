import { beforeEach, expect, mock, test } from "bun:test";

const getContent = mock(async (_input: unknown) => ({
	number: 12,
	url: "https://github.com/owner/repo/pull/12",
	title: "host title",
	state: "open",
	checks: [],
}));
const getPullRequest = mock(async (_input: unknown) => ({
	title: "API title",
}));
mock.module("renderer/lib/host-service-client", () => ({
	getHostServiceClientByUrl: () => ({
		pullRequests: { getContent: { query: getContent } },
	}),
}));
mock.module("renderer/lib/cloud-trpc", () => ({
	cloudTrpcClient: {
		integration: { github: { getPullRequest: { query: getPullRequest } } },
	},
}));
const { fetchPullRequestDetail } = await import("../fetchPullRequestDetail");
const input = {
	projectId: null,
	hostUrl: "http://host.test",
	organizationId: "org",
	repoFullName: "owner/repo",
	prNumber: 12,
};
beforeEach(() => {
	getContent.mockClear();
	getPullRequest.mockClear();
});
test("loads Summary without a project", async () => {
	expect(await fetchPullRequestDetail(input)).toMatchObject({
		title: "API title",
	});
	expect(getContent).not.toHaveBeenCalled();
	expect(getPullRequest).toHaveBeenCalledWith({
		organizationId: "org",
		repoFullName: "owner/repo",
		number: 12,
	});
});
test("matching projects keep the existing host path", async () => {
	expect(
		(await fetchPullRequestDetail({ ...input, projectId: "project" })).title,
	).toBe("host title");
	expect(getPullRequest).not.toHaveBeenCalled();
});
test("falls back when the matching host fails", async () => {
	getContent.mockRejectedValueOnce(new Error("offline"));
	expect(
		await fetchPullRequestDetail({ ...input, projectId: "project" }),
	).toMatchObject({ title: "API title" });
});
test("falls back when the host is absent", async () => {
	expect(
		await fetchPullRequestDetail({
			...input,
			projectId: "project",
			hostUrl: null,
		}),
	).toMatchObject({ title: "API title" });
	expect(getContent).not.toHaveBeenCalled();
});
test("preserves host failures if cloud fallback is unavailable", async () => {
	getContent.mockRejectedValueOnce(new Error("offline"));
	await expect(
		fetchPullRequestDetail({
			...input,
			projectId: "project",
			organizationId: null,
		}),
	).rejects.toThrow("offline");
});
