import { Trans } from "@lingui/react/macro";
import { formatDateTime, formatRelativeTime } from "@superset/i18n/format";
import { ScrollArea } from "@superset/ui/scroll-area";
import type { ReactNode } from "react";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";
import {
	buildPullRequestTimelineEvents,
	type PullRequestTimelineEvent,
} from "../../utils/buildPullRequestTimelineEvents";

function eventTitle(event: PullRequestTimelineEvent): ReactNode {
	switch (event.kind) {
		case "opened":
			return event.actor ? (
				<Trans>{event.actor} opened this pull request</Trans>
			) : (
				<Trans>Pull request opened</Trans>
			);
		case "commit": {
			const short = event.oid.slice(0, 7);
			return event.actor ? (
				<Trans>
					Commit {short} by {event.actor}
				</Trans>
			) : (
				<Trans>Commit {short}</Trans>
			);
		}
		case "comment":
			return event.actor ? (
				<Trans>{event.actor} commented</Trans>
			) : (
				<Trans>Comment</Trans>
			);
		case "review": {
			const actor = event.actor;
			if (event.reviewState === "APPROVED") {
				return actor ? (
					<Trans>{actor} approved</Trans>
				) : (
					<Trans>Approved</Trans>
				);
			}
			if (event.reviewState === "CHANGES_REQUESTED") {
				return actor ? (
					<Trans>{actor} requested changes</Trans>
				) : (
					<Trans>Changes requested</Trans>
				);
			}
			return actor ? <Trans>{actor} reviewed</Trans> : <Trans>Review</Trans>;
		}
		case "merged":
			return <Trans>Pull request merged</Trans>;
		case "closed":
			return <Trans>Pull request closed</Trans>;
	}
}

interface PullRequestTimelineTabProps {
	data: PullRequestDetail;
}

/** Opened, commits, comments and reviews, merged or closed, as a left-rail list. */
export function PullRequestTimelineTab({ data }: PullRequestTimelineTabProps) {
	const events = buildPullRequestTimelineEvents({
		createdAt: data.createdAt,
		author: data.author,
		comments: data.comments,
		commits: data.commits,
		mergedAt: data.mergedAt,
		closedAt: data.closedAt,
	});
	return (
		<ScrollArea className="h-full">
			<div className="mx-auto w-full max-w-[76rem] px-6 py-5">
				<ol className="relative ml-2 border-l border-border/70 pl-5">
					{events.map((event) => {
						const at = new Date(event.at);
						const valid = !Number.isNaN(at.getTime());
						const body =
							event.kind === "commit" ||
							event.kind === "comment" ||
							event.kind === "review"
								? event.body
								: null;
						return (
							<li key={event.id} className="relative pb-5 text-sm">
								<span
									aria-hidden
									className="absolute -left-[1.55rem] top-1.5 size-2 rounded-full border border-border bg-background"
								/>
								<div className="font-medium">{eventTitle(event)}</div>
								{valid ? (
									<time
										dateTime={event.at}
										title={formatDateTime(at)}
										className="text-xs text-muted-foreground"
									>
										{formatRelativeTime(at)}
									</time>
								) : null}
								{body ? (
									<p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
										{body}
									</p>
								) : null}
							</li>
						);
					})}
				</ol>
			</div>
		</ScrollArea>
	);
}
