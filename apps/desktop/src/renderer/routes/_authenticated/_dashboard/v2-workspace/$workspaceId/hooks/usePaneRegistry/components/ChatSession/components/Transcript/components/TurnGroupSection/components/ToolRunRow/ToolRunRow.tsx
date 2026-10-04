import { plural } from "@lingui/core/macro";
import type { ToolCall } from "@superset/chat/protocol";
import { formatList } from "@superset/i18n/format";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import { ChevronRight } from "lucide-react";
import { memo } from "react";
import { ToolCallRow } from "../../../ToolCallRow";
import { stepCounts } from "../../utils/stepCounts";

/** One phrase of a step summary; `count` is the placeholder every plural shares. */
function stepPhrase(
	concept: keyof ReturnType<typeof stepCounts>,
	count: number,
): string {
	switch (concept) {
		case "reads":
			return plural(count, { one: "read # file", other: "read # files" });
		case "searches":
			return plural(count, { one: "# search", other: "# searches" });
		case "commands":
			return plural(count, { one: "ran # command", other: "ran # commands" });
		case "edits":
			return plural(count, { one: "edited # file", other: "edited # files" });
		case "fetches":
			return plural(count, { one: "fetched # page", other: "fetched # pages" });
		case "tools":
			return plural(count, { one: "used # tool", other: "used # tools" });
	}
}

const STEP_CONCEPT_ORDER = [
	"reads",
	"searches",
	"commands",
	"edits",
	"fetches",
	"tools",
] as const;

/**
 * "ran 6 commands, edited 3 files, read 2 files": what the run did, in the
 * order it is most often done, instead of how many calls it took.
 */
function StepSummary({ items }: { items: readonly ToolCall[] }) {
	const counts = stepCounts(items);
	const phrases = STEP_CONCEPT_ORDER.filter(
		(concept) => counts[concept] > 0,
	).map((concept) => stepPhrase(concept, counts[concept]));
	return (
		<span className="min-w-0 truncate first-letter:uppercase">
			{formatList(phrases, { type: "unit", style: "short" })}
		</span>
	);
}

type ToolRunRowProps = {
	rowKey: string;
	items: ToolCall[];
	collapsed: boolean;
	onToggle: (rowKey: string, collapsed: boolean) => void;
};

function sameTools(previous: ToolRunRowProps, next: ToolRunRowProps): boolean {
	return (
		previous.rowKey === next.rowKey &&
		previous.collapsed === next.collapsed &&
		previous.onToggle === next.onToggle &&
		previous.items.length === next.items.length &&
		previous.items.every((item, index) => item === next.items[index])
	);
}

export const ToolRunRow = memo(function ToolRunRow({
	collapsed,
	items,
	onToggle,
	rowKey,
}: ToolRunRowProps) {
	return (
		<Collapsible
			onOpenChange={(open) => onToggle(rowKey, !open)}
			open={!collapsed}
		>
			<CollapsibleTrigger className="flex max-w-full items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
				<ChevronRight
					className={cn(
						"size-3 shrink-0 transition-transform",
						!collapsed && "rotate-90",
					)}
				/>
				<StepSummary items={items} />
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-0.5 pt-1">
				{items.map((tool) => (
					<ToolCallRow item={tool} key={tool.id} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}, sameTools);
