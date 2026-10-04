import { Trans } from "@lingui/react/macro";
import type {
	OutboxEntry,
	SessionSnapshot,
	TurnGroup,
} from "@superset/chat/core";
import type { ApprovalRequest, Decision } from "@superset/chat/protocol";
import {
	MessageScroller,
	useMessageScroller,
} from "@superset/chat-ui/MessageScroller";
import { ScrollToBottomButton } from "@superset/chat-ui/ScrollToBottomButton";
import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatForkTarget } from "../../types";
import { TurnGroupSection } from "./components/TurnGroupSection";
import { WorkingIndicator } from "./components/WorkingIndicator";

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

function latestUserItemId(groups: TurnGroup[]): string | null {
	for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex -= 1) {
		const group = groups[groupIndex];
		if (!group) continue;
		for (let index = group.entries.length - 1; index >= 0; index -= 1) {
			const entry = group.entries[index];
			if (entry?.kind === "item" && entry.item.kind === "user_message") {
				return entry.item.id;
			}
		}
	}
	return null;
}

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

function outboxText(entry: OutboxEntry): string {
	return entry.content
		.filter((content) => content.type === "text")
		.map((content) => content.text)
		.join("\n");
}

/**
 * The scroller follows the newest content while a turn runs and lets go the
 * moment the reader scrolls up, so a reply never lands below the fold
 * unnoticed; the button brings them back.
 */
export function Transcript(props: TranscriptProps) {
	return (
		<MessageScroller.Provider autoScroll defaultScrollPosition="end">
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
	const [entryOverrides, setEntryOverrides] = useState<
		ReadonlyMap<string, boolean>
	>(new Map());

	const isEntryCollapsed = useCallback(
		(entryKey: string, defaultCollapsed: boolean) =>
			entryOverrides.get(entryKey) ?? defaultCollapsed,
		[entryOverrides],
	);
	const onToggleEntry = useCallback((entryKey: string, collapsed: boolean) => {
		setEntryOverrides((previous) => {
			const next = new Map(previous);
			next.set(entryKey, collapsed);
			return next;
		});
	}, []);
	const pendingApprovalTargets = useMemo(() => {
		const targets = new Set<string>();
		for (const approval of approvals) {
			targets.add(approval.id);
			if (approval.targetItemId) targets.add(approval.targetItemId);
		}
		return targets;
	}, [approvals]);

	const anchorItemId = latestUserItemId(groups);
	useEffect(() => {
		if (!anchorItemId) return;
		scrollerRef.current.scrollToMessage(anchorItemId, { align: "start" });
	}, [anchorItemId]);

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

	const firstPendingApprovalId = approvals[0]?.id ?? null;
	useEffect(() => {
		if (!firstPendingApprovalId) return;
		scrollerRef.current.scrollToMessage(firstPendingApprovalId, {
			align: "nearest",
		});
	}, [firstPendingApprovalId]);

	const working = showsWorkingIndicator(groups);

	return (
		// The viewport spans the pane so its bar sits at the edge; the gutter
		// is reserved on both sides so the column centers on the same axis as
		// the composer below it, scrollbar or not. The app disables selection
		// on body; the transcript is text, so it opts back in.
		<MessageScroller.Root className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<MessageScroller.Viewport className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]">
				<MessageScroller.Content className="mx-auto flex w-full max-w-3xl select-text flex-col gap-6 px-6 py-6">
					{hasOlder && (
						<div className="flex items-center gap-2">
							<Button onClick={onLoadOlder} size="sm" variant="ghost">
								<Trans>Load earlier messages</Trans>
							</Button>
						</div>
					)}
					{groups.map((group) => (
						<TurnGroupSection
							canForkToWorktree={canForkToWorktree}
							group={group}
							isEntryCollapsed={isEntryCollapsed}
							key={group.turnId}
							onFork={onFork}
							onRespond={onRespond}
							onToggleEntry={onToggleEntry}
							pendingApprovalTargets={pendingApprovalTargets}
							snapshot={snapshot}
						/>
					))}
					{working && <WorkingIndicator />}
					{outbox.map((entry) => (
						<div
							className="flex flex-col items-end gap-1 self-end"
							key={entry.clientId}
						>
							<div className="max-w-[80%] whitespace-pre-wrap break-words rounded-lg bg-primary/10 px-3 py-2 text-sm">
								{outboxText(entry)}
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant={entry.state === "failed" ? "destructive" : "outline"}
								>
									{entry.state === "failed" ? (
										<Trans>Failed to send</Trans>
									) : (
										<Trans>Sending</Trans>
									)}
								</Badge>
								{entry.state === "failed" && (
									<>
										<Button
											onClick={() => onRetryPrompt(entry.clientId)}
											size="sm"
											variant="ghost"
										>
											<Trans>Retry</Trans>
										</Button>
										<Button
											onClick={() => onDiscardPrompt(entry.clientId)}
											size="sm"
											variant="ghost"
										>
											<Trans>Discard</Trans>
										</Button>
									</>
								)}
							</div>
						</div>
					))}
				</MessageScroller.Content>
			</MessageScroller.Viewport>
			<div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
				<ScrollToBottomButton />
			</div>
		</MessageScroller.Root>
	);
}
