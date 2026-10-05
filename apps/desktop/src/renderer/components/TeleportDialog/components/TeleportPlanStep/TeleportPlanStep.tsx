import { Trans } from "@lingui/react/macro";
import type { TeleportPlan } from "@superset/shared/teleport";
import { Button } from "@superset/ui/button";
import { Spinner } from "@superset/ui/spinner";
import type { TeleportDestination } from "../../types";
import { PlanRefusal } from "./components/PlanRefusal";
import { PlanSummary } from "./components/PlanSummary";

interface TeleportPlanStepProps {
	plan: TeleportPlan | null;
	destination: TeleportDestination;
	onBack: () => void;
	onConfirm: () => void;
}

/**
 * The plan, which is the feature.
 *
 * The refusals appear here rather than surfacing as a failure eight steps
 * into a run, and a blocked plan keeps its Back button so the user can pick
 * somewhere else without starting over.
 */
export function TeleportPlanStep({
	plan,
	destination,
	onBack,
	onConfirm,
}: TeleportPlanStepProps) {
	const hostName = destination.name;
	if (!plan) {
		return (
			<>
				<div className="flex items-center gap-2 px-1 py-8 text-muted-foreground text-sm">
					<Spinner className="size-4" />
					<Trans>Checking {hostName} and the running agents…</Trans>
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={onBack}>
						<Trans>Back</Trans>
					</Button>
					<Button disabled>
						<Trans>Teleport</Trans>
					</Button>
				</div>
			</>
		);
	}

	const blocked = plan.refusals.length > 0;

	return (
		<>
			<div className="max-h-96 space-y-4 overflow-y-auto px-1">
				{blocked ? (
					plan.refusals.map((refusal) => (
						<PlanRefusal
							key={`${refusal.kind}-${refusal.branch}`}
							refusal={refusal}
							destination={destination}
						/>
					))
				) : (
					<>
						<PlanSummary plan={plan} hostName={hostName} />
						<p className="text-muted-foreground text-xs">
							<Trans>
								You can keep working while it moves; whatever changes late is
								sent again at the end. This workspace stays here, stopped, until
								you delete it.
							</Trans>
						</p>
					</>
				)}
			</div>

			<div className="flex justify-end gap-2">
				<Button variant="ghost" onClick={onBack}>
					<Trans>Back</Trans>
				</Button>
				<Button disabled={blocked} onClick={onConfirm}>
					<Trans>Teleport</Trans>
				</Button>
			</div>
		</>
	);
}
