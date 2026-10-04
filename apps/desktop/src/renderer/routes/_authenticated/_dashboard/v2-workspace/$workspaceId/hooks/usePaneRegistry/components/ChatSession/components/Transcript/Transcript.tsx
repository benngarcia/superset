import { Trans } from "@lingui/react/macro";
import type {
	OutboxEntry,
	SessionSnapshot,
	TurnGroup,
} from "@superset/chat/core";
import type {
	ApprovalRequest,
	Decision,
	UserMessage,
} from "@superset/chat/protocol";
import {
	MessageScroller,
	useMessageScroller,
	useMessageScrollerScrollable,
} from "@superset/chat-ui/MessageScroller";
import { ScrollToBottomButton } from "@superset/chat-ui/ScrollToBottomButton";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatForkTarget } from "../../types";
import { TurnGroupSection } from "./components/TurnGroupSection";
import { WorkingIndicator } from "./components/WorkingIndicator";
import { type TranscriptRow, transcriptRows } from "./utils/transcriptRows";

const REMEMBER_SIZE_CLASSNAME = "[contain-intrinsic-size:auto_240px]";
const OFFSCREEN_CLASSNAME = "[content-visibility:auto]";
const RECENT_ROWS_RENDERED_IN_FULL = 30;
const RESUME_FOLLOW_PX = 24;
const CLOCK_SKEW_MS = 5_000;

export type TranscriptProps = {
	groups: TurnGroup[];
	snapshot: SessionSnapshot;
	approvals: ApprovalRequest[];
	outbox: OutboxEntry[];
	hasOlder: boolean;
	onLoadOlder: () => void;
	onRespond: (approvalId: string, decision: Decision) => void;
	onFork?: ((target: ChatForkTarget) => void) | undefined;
	canForkToWorktree?: boolean;
	/**
	 * An item the rail asked to see. Carries a nonce because selecting the
	 * same message twice is a second request, not the same one.
	 */
	scrollRequest?: { itemId: string; nonce: number } | undefined;
	onRetryPrompt: (clientId: string) => void;
	onDiscardPrompt: (clientId: string) => void;
};

/**
 * Whether the end of the transcript needs its own "busy" line: a running
 * turn whose newest row is not itself live. A streaming message, a thought
 * mid-stream and a running tool call all shimmer on their own, and a pending
 * approval is the reader's turn, not the agent's; the line covers the gaps
 * between them, and the wait before the first one.
 */
function showsWorkingIndicator(groups: TurnGroup[]): boolean {
	const last = groups.at(-1);
	if (!last || last.turn?.status !== "running") return false;
	const entry = last.entries.at(-1);
	if (!entry) return true;
	if (entry.kind === "tool_run")
		return entry.items.every((item) => item.status !== "running");
	const item = entry.item;
	if (item.kind === "tool_call") return item.status !== "running";
	if (item.kind === "agent_message" || item.kind === "reasoning")
		return item.completedAtMs !== undefined;
	if (item.kind === "approval_request") return item.status !== "pending";
	return true;
}

function rowMessageId(row: TranscriptRow): string {
	if (row.kind === "item") return row.item.id;
	if (row.kind === "tool_run") return row.items[0]?.id ?? row.key;
	return row.key;
}

function sentInThisView(row: TranscriptRow, mountedAtMs: number): boolean {
	if (row.kind === "outbox") return true;
	return (
		row.kind === "item" &&
		row.item.kind === "user_message" &&
		Boolean((row.item as UserMessage).clientId) &&
		row.item.startedAtMs >= mountedAtMs - CLOCK_SKEW_MS
	);
}

/**
 * The latest message sent from this view is the scroll anchor: the scroller
 * pins it to the top and follows the reply once it outgrows the screen. A
 * message that was there when the view opened, or that came from another
 * client, never moves the reader and never takes the anchor away.
 */
export function Transcript(props: TranscriptProps) {
	return (
		<MessageScroller.Provider
			autoScroll
			defaultScrollPosition="end"
			scrollEdgeThreshold={RESUME_FOLLOW_PX}
			scrollPreviousItemPeek={0}
		>
			<TranscriptBody {...props} />
		</MessageScroller.Provider>
	);
}

function TranscriptBody({
	approvals,
	canForkToWorktree,
	scrollRequest,
	groups,
	hasOlder,
	onDiscardPrompt,
	onFork,
	onLoadOlder,
	onRespond,
	onRetryPrompt,
	outbox,
	snapshot,
}: TranscriptProps) {
	const scroller = useMessageScroller();
	const scrollerRef = useRef(scroller);
	scrollerRef.current = scroller;
	const scrollable = useMessageScrollerScrollable();
	const awayFromEndRef = useRef(scrollable.end);
	awayFromEndRef.current = scrollable.end;

	const [entryOverrides, setEntryOverrides] = useState<
		ReadonlyMap<string, boolean>
	>(new Map());
	const isEntryCollapsed = useCallback(
		(entryKey: string, defaultCollapsed: boolean) =>
			entryOverrides.get(entryKey) ?? defaultCollapsed,
		[entryOverrides],
	);
	const onToggleEntry = useCallback((entryKey: string, collapsed: boolean) => {
		setEntryOverrides((previous) => new Map(previous).set(entryKey, collapsed));
	}, []);

	const pendingApprovalTargets = useMemo(() => {
		const targets = new Set<string>();
		for (const approval of approvals) {
			targets.add(approval.id);
			if (approval.targetItemId) targets.add(approval.targetItemId);
		}
		return targets;
	}, [approvals]);

	const rows = useMemo(
		() => transcriptRows(groups, outbox, pendingApprovalTargets),
		[groups, outbox, pendingApprovalTargets],
	);

	const [mountedAtMs] = useState(() => Date.now());
	const [rowKeysAtMount] = useState(() => new Set(rows.map((row) => row.key)));
	const anchorRowKey = useMemo(
		() =>
			rows.findLast(
				(row) =>
					!rowKeysAtMount.has(row.key) && sentInThisView(row, mountedAtMs),
			)?.key ?? null,
		[rows, rowKeysAtMount, mountedAtMs],
	);

	// On the request object rather than its fields: the nonce is what makes
	// choosing the same message twice a second scroll, and a dependency list
	// of fields would drop it as redundant.
	useEffect(() => {
		if (!scrollRequest) return;
		scrollerRef.current.scrollToMessage(scrollRequest.itemId, {
			align: "start",
			behavior: "smooth",
		});
	}, [scrollRequest]);

	// A jump parks the scroller until the reader scrolls by hand, so it is
	// only for a reader who already scrolled away from the end.
	const firstPendingApprovalId = approvals[0]?.id ?? null;
	useEffect(() => {
		if (!firstPendingApprovalId || !awayFromEndRef.current) return;
		scrollerRef.current.scrollToMessage(firstPendingApprovalId, {
			align: "nearest",
		});
	}, [firstPendingApprovalId]);

	return (
		// The viewport spans the pane so its bar sits at the edge; the gutter
		// is reserved on both sides so the column centers on the same axis as
		// the composer below it, scrollbar or not. The app disables selection
		// on body; the transcript is text, so it opts back in. Rows are direct
		// children of Content: the scroller reads anchors and prepends from
		// them, so the load button sits outside it.
		<MessageScroller.Root className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<MessageScroller.Viewport className="min-h-0 flex-1 overflow-y-auto px-6 [scrollbar-gutter:stable_both-edges]">
				{hasOlder && (
					<div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pt-6">
						<Button onClick={onLoadOlder} size="sm" variant="ghost">
							<Trans>Load earlier messages</Trans>
						</Button>
					</div>
				)}
				<MessageScroller.Content className="mx-auto flex w-full max-w-3xl select-text flex-col gap-4 px-6 py-6">
					{rows.map((row, index) => (
						<MessageScroller.Item
							className={cn(
								REMEMBER_SIZE_CLASSNAME,
								index < rows.length - RECENT_ROWS_RENDERED_IN_FULL &&
									OFFSCREEN_CLASSNAME,
								row.groupStart && index > 0 && "mt-2",
							)}
							key={row.key}
							messageId={rowMessageId(row)}
							scrollAnchor={row.key === anchorRowKey}
						>
							<TurnGroupSection
								canForkToWorktree={canForkToWorktree}
								isEntryCollapsed={isEntryCollapsed}
								onDiscardPrompt={onDiscardPrompt}
								onFork={onFork}
								onRespond={onRespond}
								onRetryPrompt={onRetryPrompt}
								onToggleEntry={onToggleEntry}
								row={row}
								snapshot={snapshot}
							/>
						</MessageScroller.Item>
					))}
					{showsWorkingIndicator(groups) && <WorkingIndicator />}
				</MessageScroller.Content>
			</MessageScroller.Viewport>
			<div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
				<ScrollToBottomButton />
			</div>
		</MessageScroller.Root>
	);
}
