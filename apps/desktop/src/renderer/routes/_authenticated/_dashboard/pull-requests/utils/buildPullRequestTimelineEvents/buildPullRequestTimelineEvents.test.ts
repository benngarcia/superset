import { describe, expect, it } from "bun:test";
import { buildPullRequestTimelineEvents } from "./buildPullRequestTimelineEvents";

describe("buildPullRequestTimelineEvents", () => {
	it("orders creation, commits, comments and the merge by time", () => {
		const events = buildPullRequestTimelineEvents({
			createdAt: "2026-10-01T10:00:00Z",
			author: { login: "avi" },
			commits: [
				{
					oid: "abcdef1234567",
					messageHeadline: "feat: thing",
					committedDate: "2026-10-01T09:00:00Z",
					authors: [{ login: "", name: "Local Git" }],
				},
			],
			comments: [
				{
					id: "c1",
					kind: "review",
					author: { login: "bot", name: null },
					body: "**Looks good**",
					createdAt: "2026-10-02T10:00:00Z",
					reviewState: "APPROVED",
				},
			],
			mergedAt: "2026-10-03T10:00:00Z",
			closedAt: "2026-10-03T10:00:00Z",
		});
		expect(events.map((event) => event.kind)).toEqual([
			"commit",
			"opened",
			"review",
			"merged",
		]);
		expect(events[0]).toMatchObject({
			actor: "Local Git",
			oid: "abcdef1234567",
		});
		expect(events[2]).toMatchObject({
			actor: "bot",
			reviewState: "APPROVED",
			body: "Looks good",
		});
	});

	it("reports a close only when the pull request was not merged", () => {
		const events = buildPullRequestTimelineEvents({
			createdAt: "2026-10-01T10:00:00Z",
			author: null,
			closedAt: "2026-10-02T10:00:00Z",
		});
		expect(events.map((event) => event.kind)).toEqual(["opened", "closed"]);
		expect(events[0]).toMatchObject({ actor: null });
	});
});
