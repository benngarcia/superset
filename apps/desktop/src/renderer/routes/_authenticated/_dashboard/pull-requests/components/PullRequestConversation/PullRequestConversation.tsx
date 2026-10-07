import { Trans } from "@lingui/react/macro";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";
import { PullRequestConversationComment } from "./components/PullRequestConversationComment";
import {
	type PullRequestCommentTarget,
	PullRequestConversationComposer,
} from "./components/PullRequestConversationComposer";

interface PullRequestConversationProps {
	data: PullRequestDetail;
	/** Where a new comment posts; null hides the composer. */
	commentTarget: PullRequestCommentTarget | null;
}

/**
 * The pull request's comments and reviews, oldest first, under a
 * hairline-topped heading that folds; the last two start open. Older hosts
 * and the cloud route send no comments, so the section then only offers
 * the composer when there is a host to post through.
 */
export function PullRequestConversation({
	data,
	commentTarget,
}: PullRequestConversationProps) {
	const [open, setOpen] = useState(true);
	const comments = useMemo(
		() =>
			[...(data.comments ?? [])].sort((left, right) =>
				left.createdAt.localeCompare(right.createdAt),
			),
		[data.comments],
	);
	if (data.comments === undefined && !commentTarget) return null;
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="border-t border-border/60"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-1.5 py-3 text-left text-[15px] font-medium">
				<span>
					<Trans>Comments</Trans>
				</span>
				<ChevronDown
					className={cn(
						"size-3.5 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
				/>
				{data.comments !== undefined ? (
					<span className="text-xs tabular-nums text-muted-foreground">
						{comments.length}
					</span>
				) : null}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="space-y-2 pb-4">
					{data.comments !== undefined ? (
						comments.length === 0 ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								<Trans>No comments</Trans>
							</p>
						) : (
							<div>
								{comments.map((comment, index) => (
									<PullRequestConversationComment
										key={comment.id}
										comment={comment}
										prUrl={data.url}
										defaultOpen={index >= comments.length - 2}
									/>
								))}
							</div>
						)
					) : null}
					{commentTarget ? (
						<PullRequestConversationComposer target={commentTarget} />
					) : null}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
