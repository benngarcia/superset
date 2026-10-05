export function avatarUrl(handle: string): string {
	return `/api/leaderboard-avatar/${encodeURIComponent(handle.toLowerCase())}?v=2`;
}
