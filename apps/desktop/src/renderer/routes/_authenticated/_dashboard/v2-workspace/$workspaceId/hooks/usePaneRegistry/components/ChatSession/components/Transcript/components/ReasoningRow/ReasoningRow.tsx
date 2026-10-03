import type { SessionSnapshot } from "@superset/chat/core";
import { displayText } from "@superset/chat/core";
import type { Reasoning as ReasoningItem } from "@superset/chat/protocol";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@superset/ui/ai-elements/reasoning";
import { useState } from "react";

const MS_IN_S = 1000;

/** Replayed thoughts settle in the same instant they start; a zero reads as live. */
function thoughtSeconds(item: ReasoningItem): number | undefined {
	if (item.completedAtMs === undefined) return undefined;
	const seconds = Math.round((item.completedAtMs - item.startedAtMs) / MS_IN_S);
	return seconds >= 1 ? seconds : undefined;
}

/**
 * Closed until the reader opens it, and it stays how they left it when the
 * thought finishes: the label changes from "Thinking..." to the duration, the
 * disclosure does not move.
 */
export function ReasoningRow({
	item,
	snapshot,
}: {
	item: ReasoningItem;
	snapshot: SessionSnapshot;
}) {
	const text = displayText(snapshot, item.id);
	const [open, setOpen] = useState(false);
	return (
		<Reasoning
			className="mb-0"
			defaultOpen={false}
			duration={thoughtSeconds(item)}
			isStreaming={item.completedAtMs === undefined}
			onOpenChange={setOpen}
			open={open}
		>
			<ReasoningTrigger />
			<ReasoningContent className="ml-1.5 border-border/60 border-l pl-3 text-muted-foreground">
				{text}
			</ReasoningContent>
		</Reasoning>
	);
}
