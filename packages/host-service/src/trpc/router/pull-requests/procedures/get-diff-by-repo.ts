import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../../index";
import { fetchPullRequestDiff } from "../shared/fetch-pull-request-diff";

export const getDiffByRepo = protectedProcedure
	.input(
		z.object({
			repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
			prNumber: z.number().int().positive(),
		}),
	)
	.query(async ({ input }) => {
		try {
			const patch = await fetchPullRequestDiff(
				input.repoFullName,
				input.prNumber,
			);
			return { patch };
		} catch (cause) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Failed to fetch diff for ${input.repoFullName}#${input.prNumber}`,
				cause,
			});
		}
	});
