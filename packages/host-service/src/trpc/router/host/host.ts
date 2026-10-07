import os from "node:os";
import { getHostId, getHostName } from "@superset/shared/host-info";
import { TRPCError } from "@trpc/server";
import {
	getHostInstallSource,
	HOST_SERVICE_VERSION,
} from "../../../install-source";
import type { ApiClient } from "../../../types";
import { machineOnlyProcedure, protectedProcedure, router } from "../../index";
import { rethrowCloudUnreachable } from "./cloud-api-error";

const ORGANIZATION_CACHE_TTL_MS = 60 * 60 * 1000;

let cachedOrganization: {
	data: { id: string; name: string; slug: string };
	cachedAt: number;
} | null = null;

async function getOrganization(
	api: ApiClient,
	organizationId: string,
): Promise<{ id: string; name: string; slug: string }> {
	if (
		cachedOrganization &&
		cachedOrganization.data.id === organizationId &&
		Date.now() - cachedOrganization.cachedAt < ORGANIZATION_CACHE_TTL_MS
	) {
		return cachedOrganization.data;
	}

	let organization: { id: string; name: string; slug: string } | null;
	try {
		organization = await api.organization.getByIdFromJwt.query({
			id: organizationId,
		});
	} catch (error) {
		rethrowCloudUnreachable(error);
		throw error;
	}
	if (!organization) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Organization not found or not accessible from JWT",
		});
	}

	cachedOrganization = { data: organization, cachedAt: Date.now() };
	return organization;
}

export const hostRouter = router({
	info: protectedProcedure.query(async ({ ctx }) => {
		const organization = await getOrganization(ctx.api, ctx.organizationId);

		return {
			hostId: getHostId(),
			hostName: getHostName(),
			version: HOST_SERVICE_VERSION,
			installSource: getHostInstallSource(),
			organization,
			platform: os.platform(),
			arch: os.arch(),
			uptime: process.uptime(),
		};
	}),
	/**
	 * The API token of the account that runs this host, so the CLI in one of
	 * its terminals acts as that account instead of its own login. The relay
	 * adds the host secret too, so a teammate there would pass every other
	 * check and leave with the owner's credential.
	 */
	apiToken: machineOnlyProcedure.query(async ({ ctx }) => {
		if (ctx.isLocalCaller !== true || !ctx.apiAuth) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "The API token is only given to callers on this machine.",
			});
		}
		const authorization = (await ctx.apiAuth.getHeaders()).Authorization;
		const token = authorization?.startsWith("Bearer ")
			? authorization.slice(7)
			: null;
		if (!token) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "This host has no API token to give.",
			});
		}
		return { token };
	}),
});
