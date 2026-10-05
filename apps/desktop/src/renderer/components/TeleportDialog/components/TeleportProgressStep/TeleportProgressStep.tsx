import { Trans } from "@lingui/react/macro";
import { TELEPORT_STEPS, type TeleportStepId } from "@superset/shared/teleport";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/lib/utils";
import { Check, CircleDashed, LoaderCircle, X } from "lucide-react";
import type {
	TeleportDestination,
	TeleportRunState,
	TeleportStepState,
} from "../../types";
import { useTeleportStepLabels } from "./hooks/useTeleportStepLabels";

interface TeleportProgressStepProps {
	run: TeleportRunState;
	destination: TeleportDestination;
	isDone: boolean;
	onClose: () => void;
	onOpenThere: () => void;
}

/**
 * Setup runs inside the destination's own creation and panes come back as
 * agents start, so these two steps finish the instant they begin. Listing
 * them would show two ticks that mean nothing.
 */
const INSTANT_STEPS: ReadonlySet<TeleportStepId> = new Set(["setup", "tabs"]);
const SHOWN_STEPS = TELEPORT_STEPS.filter((step) => !INSTANT_STEPS.has(step));

/**
 * Named steps, not a spinner.
 *
 * The value is in a failure: the user sees which step stopped, and
 * therefore that every step above it completed — which is how they know
 * their work is safe on the source and nothing is half-applied there.
 */
export function TeleportProgressStep({
	run,
	destination,
	isDone,
	onClose,
	onOpenThere,
}: TeleportProgressStepProps) {
	const labels = useTeleportStepLabels(destination.kind);
	const failed = run.error !== null;
	// The driver stops the source last; a failure before that step left it
	// exactly as it was.
	const sourceUntouched = run.steps.stopSource === undefined;

	return (
		<>
			<ul className="space-y-1.5 px-1">
				{SHOWN_STEPS.map((step) => {
					const state = run.steps[step] ?? "pending";
					return (
						<li
							key={step}
							className={cn(
								"flex items-center gap-2.5 text-sm",
								state === "pending" && "text-muted-foreground",
								state === "running" && "font-medium",
								state === "failed" && "text-destructive",
							)}
						>
							<StepIcon state={state} />
							{labels[step]}
						</li>
					);
				})}
			</ul>

			{failed && (
				<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
					<p className="font-medium text-destructive">{run.error}</p>
					<p className="mt-1 text-muted-foreground text-xs">
						{sourceUntouched ? (
							<Trans>
								Nothing changed here. Fix the cause and teleport again.
							</Trans>
						) : (
							<Trans>
								The work reached {destination.name}; check both sides before
								continuing.
							</Trans>
						)}
					</p>
				</div>
			)}

			{isDone && (
				<p className="px-1 text-muted-foreground text-xs">
					<Trans>
						Done. This workspace is stopped here; the work continues on{" "}
						{destination.name}.
					</Trans>
				</p>
			)}

			<div className="flex justify-end gap-2">
				<Button variant={failed ? "default" : "ghost"} onClick={onClose}>
					{isDone || failed ? (
						<Trans>Close</Trans>
					) : (
						<Trans>Run in background</Trans>
					)}
				</Button>
				{!failed && (
					<Button disabled={!isDone} onClick={onOpenThere}>
						<Trans>Open on {destination.name}</Trans>
					</Button>
				)}
			</div>
		</>
	);
}

function StepIcon({ state }: { state: TeleportStepState }) {
	const className = "size-3.5 shrink-0";
	switch (state) {
		case "done":
			return (
				<Check
					className={cn(className, "text-emerald-600 dark:text-emerald-400")}
				/>
			);
		case "running":
			return <LoaderCircle className={cn(className, "animate-spin")} />;
		case "failed":
			return <X className={className} />;
		case "pending":
			return <CircleDashed className={cn(className, "opacity-50")} />;
	}
}
