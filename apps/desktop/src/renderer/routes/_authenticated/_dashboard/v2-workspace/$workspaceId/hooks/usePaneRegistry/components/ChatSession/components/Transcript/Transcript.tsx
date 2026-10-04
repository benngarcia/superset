import { Trans } from "@lingui/react/macro";
import type {
	OutboxEntry,
	SessionSnapshot,
	TurnGroup,
} from "@superset/chat/core";
import { displayText } from "@superset/chat/core";
import type {
	ApprovalRequest,
	Decision,
	UserMessage,
} from "@superset/chat/protocol";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ChatForkTarget } from "../../types";
import { ItemRow } from "./components/ItemRow";
import { ToolRunRow } from "./components/ToolRunRow";
import { TurnStatusRow } from "./components/TurnStatusRow";
import { WorkingFor } from "./components/WorkingFor";
import {
	latestUserRowKey,
	type TranscriptRow,
	transcriptRows,
} from "./utils/transcriptRows";

const REMEMBER_SIZE_CLASSNAME = "[contain-intrinsic-size:auto_240px]";
const OFFSCREEN_CLASSNAME = "[content-visibility:auto]";
const RECENT_ROWS_RENDERED_IN_FULL = 30;
const PINNED_ROW_TOP_GAP_PX = 24;
const RESUME_FOLLOW_PX = 8;

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

function outboxMessage(entry: OutboxEntry): UserMessage {
	return {
		id: entry.clientId,
		kind: "user_message",
		clientId: entry.clientId,
		startedAtMs: 0,
		content: entry.content,
	};
}

export function Transcript({
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
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [collapseOverrides, setCollapseOverrides] = useState<
		ReadonlyMap<string, boolean>
	>(new Map());
	const onToggleToolRun = useCallback((rowKey: string, collapsed: boolean) => {
		setCollapseOverrides((previous) =>
			new Map(previous).set(rowKey, collapsed),
		);
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

	const contentRef = useRef<HTMLDivElement | null>(null);
	const spacerRef = useRef<HTMLDivElement | null>(null);
	const pinnedRowKey = useRef<string | null>(null);

	const pinnedRow = useCallback((): HTMLElement | null => {
		const key = pinnedRowKey.current;
		if (!key) return null;
		return (
			containerRef.current?.querySelector<HTMLElement>(
				`[data-row-key="${CSS.escape(key)}"]`,
			) ?? null
		);
	}, []);

	const spacerHeight = useRef(0);
	const sizeSpacer = useCallback(() => {
		const container = containerRef.current;
		const spacer = spacerRef.current;
		if (!container || !spacer) return;
		const row = pinnedRow();
		const contentBelowRow = row ? spacer.offsetTop - row.offsetTop : 0;
		const height = row
			? container.clientHeight - contentBelowRow - PINNED_ROW_TOP_GAP_PX
			: 0;
		spacerHeight.current = Math.max(0, height);
		spacer.style.height = `${spacerHeight.current}px`;
	}, [pinnedRow]);

	const holdPin = useRef(false);
	const keepPinnedRowInPlace = useCallback(() => {
		sizeSpacer();
		const container = containerRef.current;
		const row = pinnedRow();
		if (!holdPin.current || !container || !row) return;
		container.scrollTop =
			spacerHeight.current > 0
				? row.offsetTop - PINNED_ROW_TOP_GAP_PX
				: container.scrollHeight;
	}, [pinnedRow, sizeSpacer]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const release = () => {
			holdPin.current = false;
		};
		const resumeAtBottom = () => {
			const distance =
				container.scrollHeight - container.scrollTop - container.clientHeight;
			if (spacerHeight.current === 0 && distance < RESUME_FOLLOW_PX) {
				holdPin.current = true;
			}
		};
		const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
		for (const event of events) {
			container.addEventListener(event, release, { passive: true });
		}
		container.addEventListener("scroll", resumeAtBottom, { passive: true });
		return () => {
			for (const event of events) container.removeEventListener(event, release);
			container.removeEventListener("scroll", resumeAtBottom);
		};
	}, []);

	useEffect(() => {
		const content = contentRef.current;
		const container = containerRef.current;
		if (!content || !container) return;
		const observer = new ResizeObserver(keepPinnedRowInPlace);
		observer.observe(content);
		observer.observe(container);
		return () => observer.disconnect();
	}, [keepPinnedRowInPlace]);

	const anchorRowKey = latestUserRowKey(rows);
	const seenAnchor = useRef(false);
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!anchorRowKey || !container) return;
		if (!seenAnchor.current) {
			seenAnchor.current = true;
			container.scrollTop = container.scrollHeight;
			return;
		}
		pinnedRowKey.current = anchorRowKey;
		holdPin.current = true;
		keepPinnedRowInPlace();
	}, [anchorRowKey, keepPinnedRowInPlace]);

	// On the request object rather than its fields: the nonce is what makes
	// choosing the same message twice a second scroll, and a dependency list
	// of fields would drop it as redundant.
	useEffect(() => {
		if (!scrollRequest) return;
		containerRef.current
			?.querySelector(`[data-item-id="${CSS.escape(scrollRequest.itemId)}"]`)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, [scrollRequest]);

	const firstPendingApprovalId = approvals[0]?.id ?? null;
	useEffect(() => {
		if (!firstPendingApprovalId) return;
		containerRef.current
			?.querySelector(`[data-item-id="${CSS.escape(firstPendingApprovalId)}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [firstPendingApprovalId]);

	const harness = snapshot.session?.harness;
	const renderRow = (row: TranscriptRow) => {
		switch (row.kind) {
			case "working":
				return (
					<WorkingFor
						completedAtMs={row.completedAtMs}
						startedAtMs={row.startedAtMs}
					/>
				);
			case "item":
				return (
					<ItemRow
						canForkToWorktree={canForkToWorktree}
						harness={harness}
						item={row.item}
						onFork={onFork}
						onRespond={onRespond}
						text={displayText(snapshot, row.item.id)}
					/>
				);
			case "outbox":
				return (
					<ItemRow
						harness={harness}
						item={outboxMessage(row.entry)}
						onRespond={onRespond}
						pending={{
							failed: row.entry.state === "failed",
							onRetry: () => onRetryPrompt(row.entry.clientId),
							onDiscard: () => onDiscardPrompt(row.entry.clientId),
						}}
						text=""
					/>
				);
			case "tool_run":
				return (
					<ToolRunRow
						collapsed={collapseOverrides.get(row.key) ?? row.defaultCollapsed}
						items={row.items}
						onToggle={onToggleToolRun}
						rowKey={row.key}
					/>
				);
			case "turn_status":
				return <TurnStatusRow message={row.message} status={row.status} />;
		}
	};

	return (
		// The scroller spans the pane so its bar sits at the edge; the column
		// inside it holds the reading measure.
		<div
			className="relative min-h-0 flex-1 overflow-y-auto px-6"
			ref={containerRef}
		>
			<div
				className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6"
				ref={contentRef}
			>
				{hasOlder && (
					<div className="flex items-center gap-2">
						<Button onClick={onLoadOlder} size="sm" variant="ghost">
							<Trans>Load earlier messages</Trans>
						</Button>
					</div>
				)}
				{rows.map((row, index) => (
					<div
						className={cn(
							REMEMBER_SIZE_CLASSNAME,
							index < rows.length - RECENT_ROWS_RENDERED_IN_FULL &&
								OFFSCREEN_CLASSNAME,
							row.groupStart && "mt-2",
						)}
						data-item-id={
							row.kind === "item"
								? row.item.id
								: row.kind === "tool_run"
									? row.items[0]?.id
									: undefined
						}
						data-row-key={row.key}
						key={row.key}
					>
						{renderRow(row)}
					</div>
				))}
				<div aria-hidden ref={spacerRef} />
			</div>
		</div>
	);
}
