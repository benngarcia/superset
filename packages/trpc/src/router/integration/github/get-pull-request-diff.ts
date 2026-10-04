import { z } from "zod";
import { installationOctokit } from "../../../lib/sandbox/clone-token";
import { protectedProcedure } from "../../../trpc";
import { verifyOrgMembership } from "../utils";
import { findInstalledRepository } from "./find-installed-repository";

export const getPullRequestDiff = protectedProcedure
	.input(
		z.object({
			organizationId: z.string().uuid(),
			repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
			number: z.number().int().positive(),
		}),
	)
	.query(async ({ ctx, input }) => {
		await verifyOrgMembership(ctx.session.user.id, input.organizationId);
		const { installation, repo } = await findInstalledRepository(
			input.organizationId,
			input.repoFullName,
		);
		const [owner, name] = repo.fullName.split("/");
		const octokit = await installationOctokit(installation.installationId);
		const { data } = await octokit.request(
			"GET /repos/{owner}/{repo}/pulls/{pull_number}",
			{
				owner: owner ?? "",
				repo: name ?? "",
				pull_number: input.number,
				headers: { accept: "application/vnd.github.diff" },
			},
		);
		if (typeof data !== "string") {
			throw new Error("GitHub did not return a pull request diff");
		}
		return { patch: data };
	});
