import { Trans, useLingui } from "@lingui/react/macro";
import type {
	OutboxEntry,
	SessionSnapshot,
	TurnGroup,
} from "@superset/chat/core";
import type { ApprovalRequest, Decision } from "@superset/chat/protocol";
import {
	MessageScroller,
	useMessageScroller,
	useMessageScrollerScrollable,
} from "@superset/chat-ui/MessageScroller";
import { ScrollToBottomButton } from "@superset/chat-ui/ScrollToBottomButton";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import {
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ChatForkTarget } from "../../types";
import { TurnGroupSection } from "./components/TurnGroupSection";
import { WorkingIndicator } from "./components/WorkingIndicator";
import { useScrollAnchorKey } from "./hooks/useScrollAnchorKey";
import { showsWorkingIndicator } from "./utils/showsWorkingIndicator";
import { type TranscriptRow, transcriptRows } from "./utils/transcriptRows";

const REMEMBER_SIZE_CLASSNAME = "[contain-intrinsic-size:auto_240px]";
const OFFSCREEN_CLASSNAME = "[content-visibility:auto]";
const RECENT_ROWS_RENDERED_IN_FULL = 30;
const SCROLL_KEYS = new Set([
	"ArrowDown",
	"ArrowUp",
	"End",
	"Home",
	"PageDown",
	"PageUp",
	" ",
]);

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
	onRetryPrompt: (clientId: string) => void;
	onDiscardPrompt: (clientId: string) => void;
};

function rowMessageId(row: TranscriptRow): string {
	if (row.kind === "item") return row.item.id;
	if (row.kind === "tool_run") return row.items[0]?.id ?? row.key;
	return row.key;
}

export function Transcript({
	approvals,
	canForkToWorktree,
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
	const { t } = useLingui();
	const scroller = useMessageScroller();
	const scrollerRef = useRef(scroller);
	scrollerRef.current = scroller;
	const scrollable = useMessageScrollerScrollable();
	const awayFromEndRef = useRef(scrollable.end);
	awayFromEndRef.current = scrollable.end;
	const readerScrolledAway = useRef(false);
	useEffect(() => {
		if (!scrollable.end) readerScrolledAway.current = false;
	}, [scrollable.end]);
	const markReaderScroll = useCallback(() => {
		readerScrolledAway.current = true;
	}, []);
	const onViewportKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (SCROLL_KEYS.has(event.key)) readerScrolledAway.current = true;
		},
		[],
	);
	const onViewportPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.target !== event.currentTarget) return;
			readerScrolledAway.current = true;
			// The scroller counts only wheel, touch and scroll keys as the reader's own scroll.
			event.currentTarget.dispatchEvent(
				new WheelEvent("wheel", { bubbles: true }),
			);
		},
		[],
	);

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

	const anchorRowKey = useScrollAnchorKey(rows, outbox, {
		turnRunning: groups.at(-1)?.turn?.status === "running",
		readerScrolledAway,
	});

	const firstPendingApprovalId = approvals[0]?.id ?? null;
	useEffect(() => {
		if (!firstPendingApprovalId || !awayFromEndRef.current) return;
		scrollerRef.current.scrollToMessage(firstPendingApprovalId, {
			align: "nearest",
		});
	}, [firstPendingApprovalId]);

	const contentChildren = rows.map((row, index) => (
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
				endsGroup={rows[index + 1]?.groupStart ?? true}
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
	));
	if (showsWorkingIndicator(groups)) {
		const firstOutboxIndex = rows.findIndex((row) => row.kind === "outbox");
		contentChildren.splice(
			firstOutboxIndex === -1 ? rows.length : firstOutboxIndex,
			0,
			<WorkingIndicator key="working-indicator" />,
		);
	}

	return (
		<MessageScroller.Root className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<MessageScroller.Viewport
				aria-label={t({ message: "Messages" })}
				className="min-h-0 flex-1 overflow-y-auto px-6 [scrollbar-gutter:stable_both-edges]"
				onKeyDown={onViewportKeyDown}
				onPointerDown={onViewportPointerDown}
				onTouchMove={markReaderScroll}
				onWheel={markReaderScroll}
			>
				{hasOlder && (
					<div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pt-6">
						<Button onClick={onLoadOlder} size="sm" variant="ghost">
							<Trans>Load earlier messages</Trans>
						</Button>
					</div>
				)}
				<MessageScroller.Content className="mx-auto flex w-full max-w-3xl select-text flex-col gap-4 px-6 py-6">
					{contentChildren}
				</MessageScroller.Content>
			</MessageScroller.Viewport>
			<div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
				<ScrollToBottomButton />
			</div>
		</MessageScroller.Root>
	);
}
