import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { db } from "@superset/db/client";
import { PgDialect } from "drizzle-orm/pg-core";
import * as github from "../../../lib/sandbox/clone-token";
import {
	createCallerFactory,
	createTRPCRouter,
	type TRPCContext,
} from "../../../trpc";
import * as membership from "../utils";
import { getPullRequestDiff } from "./get-pull-request-diff";

const organizationId = "00000000-0000-4000-8000-000000000001";
const createCaller = createCallerFactory(
	createTRPCRouter({ getPullRequestDiff }),
);
const caller = createCaller({
	headers: new Headers(),
	client: null,
	sandboxCaller: null,
	session: {
		user: { id: "user" },
		session: { activeOrganizationId: organizationId },
	},
} as TRPCContext);
const input = { organizationId, repoFullName: "OWNER/Repo", number: 12 };
const request = mock(
	async (_route: string, _options: unknown): Promise<{ data: unknown }> => ({
		data: "diff --git a/a b/a",
	}),
);
const tooLarge = Object.assign(
	new Error("Sorry, the diff exceeded the maximum number of lines (20000)"),
	{
		status: 406,
		response: {
			data: {
				errors: [{ resource: "PullRequest", field: "diff", code: "too_large" }],
			},
		},
	},
);
const pullRequest = {
	base: { sha: "a".repeat(40) },
	head: { sha: "b".repeat(40) },
	changed_files: 1,
	additions: 1,
	deletions: 1,
};
const file = {
	filename: "a.txt",
	status: "modified",
	additions: 1,
	deletions: 1,
	patch: "@@ -1 +1 @@\n-old\n+new",
};

beforeEach(() => {
	spyOn(membership, "verifyOrgMembership").mockResolvedValue({
		membership: {},
	} as Awaited<ReturnType<typeof membership.verifyOrgMembership>>);
	spyOn(db.query.githubInstallations, "findFirst").mockResolvedValue({
		id: "installation-row",
		installationId: "123",
	} as Awaited<ReturnType<typeof db.query.githubInstallations.findFirst>>);
	spyOn(db.query.githubRepositories, "findFirst").mockResolvedValue({
		fullName: "owner/repo",
	} as Awaited<ReturnType<typeof db.query.githubRepositories.findFirst>>);
	request.mockReset().mockResolvedValue({ data: "diff --git a/a b/a" });
	spyOn(github, "installationOctokit").mockResolvedValue({
		request,
	} as unknown as Awaited<ReturnType<typeof github.installationOctokit>>);
});

afterEach(() => {
	mock.restore();
});

describe("integration.github.getPullRequestDiff", () => {
	test("fetches a diff for an installed repository without a synced PR row", async () => {
		expect(await caller.getPullRequestDiff(input)).toEqual({
			patch: "diff --git a/a b/a",
		});
		expect(membership.verifyOrgMembership).toHaveBeenCalledWith(
			"user",
			organizationId,
		);
		expect(github.installationOctokit).toHaveBeenCalledWith("123");
		expect(request).toHaveBeenCalledWith(
			"GET /repos/{owner}/{repo}/pulls/{pull_number}",
			{
				owner: "owner",
				repo: "repo",
				pull_number: 12,
				headers: { accept: "application/vnd.github.diff" },
			},
		);
		const repoLookup = spyOn(db.query.githubRepositories, "findFirst").mock
			.calls[0]?.[0];
		expect(
			new PgDialect().sqlToQuery(repoLookup?.where as import("drizzle-orm").SQL)
				.params,
		).toEqual(["installation-row", "owner/repo"]);
		expect(request).toHaveBeenCalledTimes(1);
	});

	test("preserves a successful empty diff without fetching files", async () => {
		request.mockResolvedValue({ data: "" });
		expect(await caller.getPullRequestDiff(input)).toEqual({ patch: "" });
		expect(request).toHaveBeenCalledTimes(1);
	});

	test("paginates oversized diffs through the same authorized installation", async () => {
		const files = Array.from({ length: 101 }, (_, index) => ({
			...file,
			filename: `file-${index}.txt`,
		}));
		const metadata = {
			...pullRequest,
			changed_files: files.length,
			additions: files.length,
			deletions: files.length,
		};
		request.mockRejectedValueOnce(tooLarge);
		request.mockImplementation(async (route, options) => {
			if (route.endsWith("/files")) {
				const { page, per_page } = options as {
					page: number;
					per_page: number;
				};
				return { data: files.slice((page - 1) * per_page, page * per_page) };
			}
			return { data: metadata };
		});

		const { patch, files: changedFiles } =
			await caller.getPullRequestDiff(input);
		expect(patch.match(/^diff --git /gm)).toHaveLength(101);
		expect(patch).toContain("diff --git a/file-100.txt b/file-100.txt");
		expect(changedFiles).toEqual(
			files.map(({ filename, status }) => ({ filename, status })),
		);
		expect(github.installationOctokit).toHaveBeenCalledTimes(1);
		expect(membership.verifyOrgMembership).toHaveBeenCalledTimes(1);
		for (const page of [1, 2]) {
			expect(request).toHaveBeenCalledWith(
				"GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
				{ owner: "owner", repo: "repo", pull_number: 12, page, per_page: 100 },
			);
		}
		expect(
			request.mock.calls.filter(
				([route, options]) =>
					!route.endsWith("/files") &&
					!(options as { headers?: unknown }).headers,
			),
		).toHaveLength(2);
	});

	for (const status of [401, 403, 404, 500]) {
		test(`does not treat HTTP ${status} as an oversized diff`, async () => {
			request.mockRejectedValue(
				Object.assign(new Error(`GitHub HTTP ${status}`), { status }),
			);
			await expect(caller.getPullRequestDiff(input)).rejects.toThrow(
				`GitHub HTTP ${status}`,
			);
			expect(request).toHaveBeenCalledTimes(1);
		});
	}

	test("rejects incomplete per-file patches instead of returning partial code", async () => {
		request.mockRejectedValueOnce(tooLarge);
		request.mockImplementation(async (route) => ({
			data: route.endsWith("/files")
				? [{ ...file, patch: undefined }]
				: pullRequest,
		}));
		await expect(caller.getPullRequestDiff(input)).rejects.toThrow("a.txt");
	});

	test("keeps files API failures actionable", async () => {
		request.mockRejectedValueOnce(tooLarge);
		request.mockImplementation(async (route) => {
			if (route.endsWith("/files"))
				throw new Error("GitHub files access denied");
			return { data: pullRequest };
		});
		await expect(caller.getPullRequestDiff(input)).rejects.toThrow(
			"GitHub files access denied",
		);
	});

	test("does not treat malformed bulk success as a size rejection", async () => {
		request.mockResolvedValue({ data: {} });
		await expect(caller.getPullRequestDiff(input)).rejects.toThrow(
			"GitHub did not return a pull request diff",
		);
		expect(request).toHaveBeenCalledTimes(1);
	});

	test("rejects nonmembers before looking up the installation or contacting GitHub", async () => {
		spyOn(membership, "verifyOrgMembership").mockRejectedValue(
			new Error("Not a member"),
		);
		await expect(caller.getPullRequestDiff(input)).rejects.toThrow(
			"Not a member",
		);
		expect(db.query.githubInstallations.findFirst).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});

	test("rejects repositories outside the organization's installation", async () => {
		spyOn(db.query.githubRepositories, "findFirst").mockResolvedValue(
			undefined,
		);
		await expect(caller.getPullRequestDiff(input)).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(github.installationOctokit).not.toHaveBeenCalled();
	});

	test("reports missing installations", async () => {
		spyOn(db.query.githubInstallations, "findFirst").mockResolvedValue(
			undefined,
		);
		await expect(caller.getPullRequestDiff(input)).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
		});
		expect(request).not.toHaveBeenCalled();
	});

	test("surfaces GitHub failures", async () => {
		request.mockRejectedValue(new Error("GitHub unavailable"));
		await expect(caller.getPullRequestDiff(input)).rejects.toThrow(
			"GitHub unavailable",
		);
	});
});
