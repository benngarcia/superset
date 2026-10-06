import type {
	PullRequestDetailActor,
	PullRequestDetailComment,
	PullRequestDetailCommit,
} from "../../hooks/usePullRequestDetail";
import { pullRequestMarkdownPreview } from "../preparePullRequestMarkdown";

export type PullRequestTimelineEvent =
	| { id: string; at: string; kind: "opened"; actor: string | null }
	| {
			id: string;
			at: string;
			kind: "commit";
			actor: string | null;
			oid: string;
			body: string;
	  }
	| {
			id: string;
			at: string;
			kind: "comment" | "review";
			actor: string | null;
			reviewState: string | null;
			body: string | null;
	  }
	| { id: string; at: string; kind: "merged" | "closed"; actor: null };

export interface PullRequestTimelineSource {
	createdAt: string;
	author: { login: string } | null;
	comments?: PullRequestDetailComment[];
	commits?: PullRequestDetailCommit[];
	mergedAt?: string | null;
	closedAt?: string | null;
}

export function pullRequestActorName(
	actor: PullRequestDetailActor | { login: string } | null | undefined,
): string | null {
	if (!actor) return null;
	const name = "name" in actor ? actor.name?.trim() : undefined;
	return name || actor.login.trim() || null;
}

/**
 * Creation, commits, comments and reviews, then the terminal merge or close,
 * sorted by time. Merged wins over closed: GitHub stamps both on a merge, and
 * "closed" would misstate what happened.
 */
export function buildPullRequestTimelineEvents(
	detail: PullRequestTimelineSource,
): PullRequestTimelineEvent[] {
	const mergedAt = detail.mergedAt ?? null;
	const events: PullRequestTimelineEvent[] = [
		{
			id: "opened",
			at: detail.createdAt,
			kind: "opened",
			actor: pullRequestActorName(detail.author),
		},
		...(detail.commits ?? []).map(
			(commit): PullRequestTimelineEvent => ({
				id: `commit:${commit.oid}`,
				at: commit.committedDate,
				kind: "commit",
				actor:
					commit.authors
						.map((author) => pullRequestActorName(author))
						.find((name) => name !== null) ?? null,
				oid: commit.oid,
				body: commit.messageHeadline,
			}),
		),
		...(detail.comments ?? []).map(
			(comment): PullRequestTimelineEvent => ({
				id: `${comment.kind}:${comment.id}`,
				at: comment.createdAt,
				kind: comment.kind,
				actor: pullRequestActorName(comment.author),
				reviewState: comment.reviewState,
				body: pullRequestMarkdownPreview(comment.body) || null,
			}),
		),
	];
	if (mergedAt) {
		events.push({ id: "merged", at: mergedAt, kind: "merged", actor: null });
	} else if (detail.closedAt) {
		events.push({
			id: "closed",
			at: detail.closedAt,
			kind: "closed",
			actor: null,
		});
	}
	return events.sort((left, right) => left.at.localeCompare(right.at));
}
