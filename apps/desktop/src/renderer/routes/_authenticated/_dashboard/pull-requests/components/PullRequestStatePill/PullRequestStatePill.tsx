import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { LuLoaderCircle } from "react-icons/lu";
import {
	normalizePRState,
	PRIcon,
	type PRState,
} from "renderer/screens/main/components/PRIcon";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";

// Borderless, flat-tinted pill per Figma (PR Badge, node 3246:2410) — exact
// hex for "open" (#dcfae8 / #00a558); the other states follow the same
// pale-bg/saturated-text formula. `[.dark_&]` targets the real `.dark` class
// the theme store puts on <html>; `dark:` would track the OS setting instead.
export const PR_STATE_BADGE_STYLES: Record<PRState, string> = {
	open: "bg-[#dcfae8] text-[#00a558] [.dark_&]:bg-[#064e3b] [.dark_&]:text-[#34d399]",
	closed:
		"bg-rose-100 text-rose-600 [.dark_&]:bg-[#4a2020] [.dark_&]:text-[#e0918a]",
	merged:
		"bg-violet-100 text-violet-600 [.dark_&]:bg-[#322b47] [.dark_&]:text-[#b0a6d9]",
	draft: "bg-muted text-muted-foreground",
	queued:
		"bg-amber-100 text-amber-600 [.dark_&]:bg-[#78350f] [.dark_&]:text-[#fbbf24]",
};

interface PullRequestStatePillProps {
	data: Pick<PullRequestDetail, "state" | "isDraft" | "mergeability">;
	/** Replaces the state word while an action is in flight ("Merging…"). */
	pendingLabel?: string | null;
	trailing?: ReactNode;
	className?: string;
}

export function PullRequestStatePill({
	data,
	pendingLabel,
	trailing,
	className,
}: PullRequestStatePillProps) {
	const state = normalizePRState(data.state, data.isDraft);
	const hasConflicts =
		data.state === "open" &&
		!data.isDraft &&
		data.mergeability === "conflicting";
	return (
		<span
			className={cn(
				"inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
				hasConflicts
					? "bg-rose-100 text-rose-600 [.dark_&]:bg-[#4a2020] [.dark_&]:text-[#e0918a]"
					: PR_STATE_BADGE_STYLES[state],
				className,
			)}
			aria-live="polite"
		>
			{pendingLabel ? (
				<LuLoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
			) : (
				<PRIcon state={state} className="size-3.5" />
			)}
			<span>
				{pendingLabel ??
					(data.isDraft && data.state === "open" ? (
						<Trans>Draft</Trans>
					) : hasConflicts ? (
						<Trans>Has conflicts</Trans>
					) : data.state === "open" ? (
						<Trans>Open</Trans>
					) : data.state === "merged" ? (
						<Trans>Merged</Trans>
					) : (
						<Trans>Closed</Trans>
					))}
			</span>
			{trailing}
		</span>
	);
}
