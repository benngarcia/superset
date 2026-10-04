import { cacheLife } from "next/cache";
import {
	fetchParticipant,
	isRateLimited,
	type ParticipantProfile,
} from "@/app/[lang]/utils/fetchLeaderboard";

export type ProfileLookup =
	| { state: "found"; profile: ParticipantProfile }
	| { state: "missing" }
	| { state: "rate-limited" };

/**
 * Shared by the page and its metadata. Only a refused read becomes a state
 * of its own, cached for a moment; any other failure throws and is not cached.
 */
export async function loadProfile(handle: string): Promise<ProfileLookup> {
	"use cache";
	try {
		const profile = await fetchParticipant(handle, { period: "all" });
		cacheLife({ revalidate: 300 });
		return profile ? { state: "found", profile } : { state: "missing" };
	} catch (error) {
		if (!isRateLimited(error)) throw error;
		cacheLife("seconds");
		return { state: "rate-limited" };
	}
}
