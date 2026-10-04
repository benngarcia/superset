import "server-only";

import { FEATURE_FLAGS } from "@superset/shared/constants";
import { cacheLife } from "next/cache";
import { posthogServer } from "./posthog-server";

const SITE_DISTINCT_ID = "marketing-site";
const REVALIDATE_SECONDS = 60;

/** A flag evaluated once for the whole site. Any failure reads as off. */
export async function getSiteFlag(flag: string): Promise<boolean> {
	"use cache";
	cacheLife({ revalidate: REVALIDATE_SECONDS });
	try {
		return Boolean(
			await posthogServer.getFeatureFlag(flag, SITE_DISTINCT_ID, {
				sendFeatureFlagEvents: false,
			}),
		);
	} catch (error) {
		console.error(`[site-flags] Failed to load ${flag}`, error);
		return false;
	}
}

export function isMobileLaunched(): Promise<boolean> {
	return getSiteFlag(FEATURE_FLAGS.MOBILE_LAUNCH);
}
