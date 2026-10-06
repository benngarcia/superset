import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { MarkdownRenderer } from "renderer/components/MarkdownRenderer";
import { preparePullRequestMarkdown } from "../../utils/preparePullRequestMarkdown";
import "./pull-request-markdown.css";

interface PullRequestMarkdownProps {
	body: string;
	className?: string;
}

/** A GitHub body as page prose: template comments gone, no inner scroller. */
export function PullRequestMarkdown({
	body,
	className,
}: PullRequestMarkdownProps) {
	const prepared = preparePullRequestMarkdown(body);
	if (!prepared) {
		return (
			<p className={cn("text-sm italic text-muted-foreground", className)}>
				<Trans>No description provided.</Trans>
			</p>
		);
	}
	return (
		<MarkdownRenderer
			content={prepared}
			className={cn("pull-request-markdown h-auto overflow-visible", className)}
		/>
	);
}
