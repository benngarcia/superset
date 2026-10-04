import { useLingui } from "@lingui/react/macro";
import { ShimmerLabel } from "@superset/ui/ai-elements/shimmer-label";

/**
 * The last line of a running turn, where the eye waits: a shimmer that says
 * the agent is busy even when nothing else has arrived yet.
 */
export function WorkingIndicator() {
	const { t } = useLingui();
	return (
		<output className="flex items-center gap-2 py-0.5 text-muted-foreground text-sm">
			<ShimmerLabel className="font-normal">
				{t({ message: "Working…" })}
			</ShimmerLabel>
		</output>
	);
}
