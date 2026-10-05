import { Trans } from "@lingui/react/macro";
import { ArrowUpRight } from "lucide-react";

export function LeaderboardJoin() {
	return (
		<a
			href="superset://settings/account"
			className="group inline-flex min-h-11 shrink-0 self-start items-center justify-center gap-3 rounded-[2px] border border-brand bg-background px-3.5 py-2 text-sm font-normal leading-5 text-brand transition-colors hover:border-brand-light hover:bg-brand/5 active:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
		>
			<Trans>Join the leaderboard</Trans>
			<ArrowUpRight
				aria-hidden="true"
				className="size-4 opacity-70 transition-opacity group-hover:opacity-100"
				strokeWidth={1.5}
			/>
		</a>
	);
}
