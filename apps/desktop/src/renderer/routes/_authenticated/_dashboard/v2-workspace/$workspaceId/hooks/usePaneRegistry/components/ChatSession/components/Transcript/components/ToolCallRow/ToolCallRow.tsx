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
import { DiffStatText } from "../../../../../../../../components/DiffStatText";
import { diffStats } from "../../utils/diffStats";
import { type FileChange, fileChangeOf } from "../../utils/fileChange";
import { ToolContentList } from "../ToolContentList";

/** How many trailing output lines a call shows without being expanded. */
const PREVIEW_LINES = 3;

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

function durationLabel(item: ToolCall): string | null {
	if (item.completedAtMs === undefined) return null;
	const seconds = Math.max(0, item.completedAtMs - item.startedAtMs) / 1000;
	return `${seconds.toFixed(1)}s`;
}

/**
 * The tail, not the head: the end of a command's output is the part worth
 * seeing without opening anything.
 */
function outputTail(
	item: ToolCall,
): { lines: string[]; hidden: number } | null {
	const text = item.content
		.map((content) =>
			content.type === "text"
				? content.text
				: content.type === "terminal"
					? content.output
					: null,
		)
		.filter((value): value is string => value !== null)
		.join("\n")
		.trimEnd();
	if (text === "") return null;
	// A fence delimiter is markup, not a line of output, and in a three-line
	// preview it costs a third of what there is to see. Dropped rather than
	// peeled off the ends: the text may hold several blocks.
	const all = text
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("```"));
	return {
		lines: all.slice(-PREVIEW_LINES),
		hidden: Math.max(0, all.length - PREVIEW_LINES),
	};
}

function StatusWord({ status }: { status: ToolCall["status"] }) {
	switch (status) {
		case "failed":
			return (
				<span className="shrink-0 font-mono text-[11px] text-destructive/80 lowercase">
					<Trans>Failed</Trans>
				</span>
			);
		case "declined":
			return (
				<span className="shrink-0 font-mono text-[11px] text-destructive/80 lowercase">
					<Trans>Denied</Trans>
				</span>
			);
		case "canceled":
			return (
				<span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 lowercase">
					<Trans>Canceled</Trans>
				</span>
			);
		default:
			return null;
	}
}

/**
 * "Edited README.md +5 −1": the verb says what happened and whether it is
 * still happening, the name is what a row has room for, the tally is what it
 * cost. The agent's own title ("Write /full/path") says the same thing worse.
 */
function FileChangeTitle({
	change,
	item,
	running,
}: {
	change: FileChange;
	item: ToolCall;
	running: boolean;
}) {
	const { t } = useLingui();
	const stats = useMemo(() => {
		const diff = item.content.find((content) => content.type === "diff");
		return diff && diff.type === "diff" ? diffStats(diff) : null;
	}, [item.content]);
	const verb = running
		? change.kind === "added"
			? t({ message: "Creating" })
			: change.kind === "deleted"
				? t({ message: "Deleting" })
				: t({ message: "Editing" })
		: change.kind === "added"
			? t({ message: "Created" })
			: change.kind === "deleted"
				? t({ message: "Deleted" })
				: t({ message: "Edited" });
	return (
		<>
			<span className="shrink-0">
				{running ? (
					<ShimmerLabel className="font-normal">{verb}</ShimmerLabel>
				) : (
					verb
				)}
			</span>
			<span
				className="min-w-0 truncate font-medium text-foreground/90"
				title={change.path}
			>
				{change.name}
			</span>
			{stats && !running && (
				<span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums">
					<DiffStatText
						additions={change.kind === "deleted" ? 0 : stats.additions}
						deletions={change.kind === "added" ? 0 : stats.deletions}
					/>
				</span>
			)}
		</>
	);
}

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
