import {
	ChatMarkdown,
	chatMarkdownFirstBlock,
} from "@superset/chat-ui/ChatMarkdown";
import { cn } from "@superset/ui/utils";
import { memo, useMemo } from "react";
import { CHAT_CODE_COMPONENTS } from "../ChatCodeBlock";
import { planMarkdown } from "./utils/planMarkdown";

const MarkdownBlock = memo(function MarkdownBlock({
	block,
	first,
}: {
	block: string;
	first: boolean;
}) {
	return (
		<ChatMarkdown
			className={first ? chatMarkdownFirstBlock : undefined}
			components={CHAT_CODE_COMPONENTS}
		>
			{block}
		</ChatMarkdown>
	);
});

export function MarkdownView({
	className,
	text,
}: {
	text: string;
	className?: string;
}) {
	const plan = useMemo(() => planMarkdown(text), [text]);
	return (
		<div
			className={cn(
				// A measure, not the pane's width: ~110 characters a line is why the
				// same answer reads harder here than in the terminal.
				"flex min-w-0 max-w-[76ch] flex-col gap-2 text-sm leading-relaxed",
				className,
			)}
		>
			{plan.stable.map((entry, index) => (
				<MarkdownBlock
					block={entry.block}
					first={index === 0}
					key={entry.key}
				/>
			))}
			{plan.tail !== null &&
				(plan.tailFenceOpen ? (
					<pre className="overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs">
						{plan.tail}
					</pre>
				) : (
					<MarkdownBlock block={plan.tail} first={plan.stable.length === 0} />
				))}
		</div>
	);
}
