import type { PageStorageRecord } from "./page-storage";

export interface PageStorageKeySummary {
	key: string;
	records: number;
	updatedAt: string;
}

export type PageStorageHubRequest =
	| { op: "clear"; key?: string }
	| { op: "clearUser"; userId: string }
	| { op: "keys" }
	| { op: "records"; key: string };

export type PageStorageHubResponse =
	| { ok: true; op: "clear"; cleared: number }
	| { ok: true; op: "clearUser"; cleared: number }
	| { ok: true; op: "keys"; keys: PageStorageKeySummary[] }
	| { ok: true; op: "records"; key: string; records: PageStorageRecord[] }
	| { ok: false; code: "invalid"; message: string };

export type PageStorageHubSuccess = Extract<
	PageStorageHubResponse,
	{ ok: true }
>;

export type PageStorageHubReplyFor<Op extends PageStorageHubRequest["op"]> =
	Extract<PageStorageHubSuccess, { op: Op }>;

export function pageStorageAdminPath(pageId: string): string {
	return `/v2/page/${encodeURIComponent(pageId)}/storage/admin`;
}

export function pageStorageNudgePath(pageId: string): string {
	return `/v2/page/${encodeURIComponent(pageId)}/storage/manifest-changed`;
}

export function pageStorageTicketPath(pageId: string): string {
	return `/v2/page/${encodeURIComponent(pageId)}/storage/ticket`;
}

export function pageStorageSocketPath(pageId: string): string {
	return `/v2/page/${encodeURIComponent(pageId)}/storage/socket`;
}
