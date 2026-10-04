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
const STICK_TO_BOTTOM_PX = 80;

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
	const stickToBottom = useRef(true);
	const scrollToBottom = useCallback(() => {
		const container = containerRef.current;
		if (container) container.scrollTop = container.scrollHeight;
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const onScroll = () => {
			stickToBottom.current =
				container.scrollHeight - container.scrollTop - container.clientHeight <
				STICK_TO_BOTTOM_PX;
		};
		container.addEventListener("scroll", onScroll, { passive: true });
		return () => container.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		const content = contentRef.current;
		if (!content) return;
		const observer = new ResizeObserver(() => {
			if (stickToBottom.current) scrollToBottom();
		});
		observer.observe(content);
		return () => observer.disconnect();
	}, [scrollToBottom]);

	const anchorRowKey = latestUserRowKey(rows);
	useLayoutEffect(() => {
		if (!anchorRowKey) return;
		stickToBottom.current = true;
		scrollToBottom();
	}, [anchorRowKey, scrollToBottom]);

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
		<div className="min-h-0 flex-1 overflow-y-auto px-6" ref={containerRef}>
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
			</div>
		</div>
	);
}
