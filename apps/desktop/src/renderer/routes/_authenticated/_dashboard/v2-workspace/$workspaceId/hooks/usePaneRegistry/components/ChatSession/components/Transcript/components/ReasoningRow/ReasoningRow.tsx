import type { Reasoning as ReasoningItem } from "@superset/chat/protocol";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@superset/ui/ai-elements/reasoning";

export function ReasoningRow({
	item,
	text,
}: {
	item: ReasoningItem;
	text: string;
}) {
	return (
		<Reasoning isStreaming={item.completedAtMs === undefined}>
			<ReasoningTrigger />
			<ReasoningContent>{text}</ReasoningContent>
		</Reasoning>
	);
}
