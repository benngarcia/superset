/**
 * The creator's installed plugins, as the claim carries them into
 * `sandbox.conf`.
 *
 * A box acts as its creator and never asks the API for account state, so the
 * control plane reads it here and writes it to disk before host-service starts.
 * That ordering is the point: boot-time provisioning finds the ledger already
 * there, so there is no second sync pass and no race with the launched agent.
 */
import { db } from "@superset/db/client";
import { pluginInstalls } from "@superset/db/schema";
import type { SandboxPlugin } from "@superset/shared/sandbox-contract";
import { asc, eq } from "drizzle-orm";

/**
 * Keyed on the user alone, the way `plugins.list` is: an install's
 * `organization_id` is nullable and the install path writes it null, so
 * narrowing by organization would match nothing.
 */
export async function creatorPlugins(
	userId: string | null,
): Promise<SandboxPlugin[]> {
	if (!userId) return [];
	return await db
		.select({
			marketplace: pluginInstalls.marketplace,
			name: pluginInstalls.pluginName,
			version: pluginInstalls.version,
			enabled: pluginInstalls.enabled,
		})
		.from(pluginInstalls)
		.where(eq(pluginInstalls.userId, userId))
		.orderBy(asc(pluginInstalls.pluginName));
}
