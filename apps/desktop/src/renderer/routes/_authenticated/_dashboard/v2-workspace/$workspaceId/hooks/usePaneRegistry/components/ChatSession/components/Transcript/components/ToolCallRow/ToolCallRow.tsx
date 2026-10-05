import { Plural, Trans, useLingui } from "@lingui/react/macro";
import type { ToolCall, ToolKind } from "@superset/chat/protocol";
import { ShimmerLabel } from "@superset/ui/ai-elements/shimmer-label";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import {
	FileText,
	FileX,
	Globe,
	MoveRight,
	PencilLine,
	Search,
	Sparkles,
	SquareTerminal,
	Wrench,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import { fileChangeOf } from "../../utils/fileChange";
import { ToolContentList } from "../ToolContentList";
import { FileChangeTitle } from "./components/FileChangeTitle";
import { StatusWord } from "./components/StatusWord";
import { durationLabel } from "./utils/durationLabel";
import { outputTail } from "./utils/outputTail";

const ICON_BY_KIND: Record<ToolKind, ComponentType<{ className?: string }>> = {
	read: FileText,
	edit: PencilLine,
	delete: FileX,
	move: MoveRight,
	search: Search,
	execute: SquareTerminal,
	think: Sparkles,
	fetch: Globe,
	other: Wrench,
};

/**
 * One line per call, the way an editor lists what an agent did: the tool's own
 * icon and title, the tail of its output beneath, and the rest behind a
 * disclosure that says how much it is hiding. A running call shimmers its
 * title; a settled one recedes, so the live frontier is what the eye lands on,
 * and the raw tool name stays out of it.
 */
export function ToolCallRow({ item }: { item: ToolCall }) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const duration = durationLabel(item);
	const hasBody = item.content.length > 0;
	const Icon = ICON_BY_KIND[item.toolKind] ?? Wrench;
	const running = item.status === "running";
	const tail = outputTail(item);
	const change = useMemo(() => fileChangeOf(item), [item]);
	let title: ReactNode;
	if (change) {
		title = <FileChangeTitle change={change} item={item} running={running} />;
	} else if (running) {
		// The translator names a command "Terminal" until the command itself
		// arrives a beat later; "Running" says more in the meantime.
		const label =
			item.toolKind === "execute" && item.title === "Terminal"
				? t({ message: "Running" })
				: item.title;
		title = (
			<span className="min-w-0 truncate">
				<ShimmerLabel className="font-normal">{label}</ShimmerLabel>
			</span>
		);
	} else {
		title = <span className="min-w-0 truncate">{item.title}</span>;
	}
	return (
		<Collapsible
			className={cn(
				"transition-opacity duration-300",
				!running && !open && "opacity-60 hover:opacity-100",
			)}
			onOpenChange={setOpen}
			open={open}
		>
			<div className="flex items-center gap-2 py-0.5 text-muted-foreground text-sm">
				<Icon className="size-3.5 shrink-0" />
				<span className="flex min-w-0 flex-1 items-center gap-1.5">
					{title}
				</span>
				<StatusWord status={item.status} />
				{duration && (
					<span className="shrink-0 text-xs tabular-nums opacity-50">
						{duration}
					</span>
				)}
			</div>
			{tail && !open && (
				<div className="ml-[22px] flex flex-col overflow-hidden">
					{tail.lines.map((line, index) => (
						<span
							className="truncate font-mono text-muted-foreground/70 text-xs"
							// Output lines have no id and repeat; position is the identity.
							key={`${item.id}:${index}`}
						>
							{line}
						</span>
					))}
				</div>
			)}
			{hasBody && (
				<>
					<CollapsibleTrigger className="ml-[22px] py-0.5 text-muted-foreground/60 text-xs hover:text-foreground">
						{open ? (
							<Trans>Hide detail</Trans>
						) : tail && tail.hidden > 0 ? (
							<Plural
								one="+# more line"
								other="+# more lines"
								value={tail.hidden}
							/>
						) : (
							<Trans>Show detail</Trans>
						)}
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="mt-1 ml-[7px] flex flex-col gap-2 border-border/60 border-l pl-3">
							<ToolContentList
								itemId={item.id}
								items={item.content}
								streaming={running}
							/>
						</div>
					</CollapsibleContent>
				</>
			)}
		</Collapsible>
	);
}
