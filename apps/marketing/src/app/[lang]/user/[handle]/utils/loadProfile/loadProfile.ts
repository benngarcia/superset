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
 * of its own; any other failure still throws so nothing is cached.
 */
export async function loadProfile(handle: string): Promise<ProfileLookup> {
	"use cache";
	cacheLife({ revalidate: 300 });
	try {
		const profile = await fetchParticipant(handle, { period: "all" });
		return profile ? { state: "found", profile } : { state: "missing" };
	} catch (error) {
		if (isRateLimited(error)) return { state: "rate-limited" };
		throw error;
	}
}
