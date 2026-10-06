import { formatNumber } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";

interface PullRequestDiffStatProps {
	additions: number;
	deletions: number;
	className?: string;
}

/** The "+N −M" change size, in the diff's own green and red. */
export function PullRequestDiffStat({
	additions,
	deletions,
	className,
}: PullRequestDiffStatProps) {
	return (
		<span
			className={cn("inline-flex items-baseline gap-1 tabular-nums", className)}
		>
			<span className="text-success">+{formatNumber(additions)}</span>
			<span className="text-destructive">−{formatNumber(deletions)}</span>
		</span>
	);
}
