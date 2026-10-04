import { Plural } from "@lingui/react/macro";
import type { ToolCall } from "@superset/chat/protocol";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import { ChevronRight } from "lucide-react";
import { memo } from "react";
import { ToolCallRow } from "../ToolCallRow";

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
			<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
				<ChevronRight
					className={cn(
						"size-3 transition-transform",
						!collapsed && "rotate-90",
					)}
				/>
				<Plural value={items.length} one="# tool call" other="# tool calls" />
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-0.5 pt-1">
				{items.map((tool) => (
					<ToolCallRow item={tool} key={tool.id} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}, sameTools);
