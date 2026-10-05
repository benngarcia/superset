import { Trans } from "@lingui/react/macro";
import type { TeleportRefusal } from "@superset/shared/teleport";
import type { TeleportDestination } from "../../../../types";

interface PlanRefusalProps {
	refusal: TeleportRefusal;
	destination: TeleportDestination;
}

/**
 * Why the move cannot happen, and what to do instead.
 *
 * Each refusal is recoverable by the user in about a minute, so each one
 * says which action would clear it. A refusal that only states the problem
 * makes the feature look broken rather than careful.
 */
export function PlanRefusal({ refusal, destination }: PlanRefusalProps) {
	const hostName = destination.name;
	return (
		<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
			<p className="font-medium">
				<Title
					refusal={refusal}
					hostName={hostName}
					cloud={destination.kind === "cloud"}
				/>
			</p>
			<p className="mt-1 text-muted-foreground text-xs">
				<Advice
					refusal={refusal}
					hostName={hostName}
					cloud={destination.kind === "cloud"}
				/>
			</p>
		</div>
	);
}

interface RefusalTextProps {
	refusal: TeleportRefusal;
	hostName: string;
	cloud: boolean;
}

function Title({ refusal, hostName, cloud }: RefusalTextProps) {
	switch (refusal.kind) {
		case "branch-checked-out":
			return (
				<Trans>
					{refusal.branch} is already checked out on {hostName}.
				</Trans>
			);
		case "branch-diverged":
			return (
				<Trans>
					{hostName} has commits on {refusal.branch} that this side doesn't.
				</Trans>
			);
		case "repository-missing":
			return cloud ? (
				<Trans>No environment carries {refusal.repository}.</Trans>
			) : (
				<Trans>
					{hostName} doesn't have {refusal.repository} yet.
				</Trans>
			);
		case "unverified":
			return <Trans>{hostName} couldn't be checked.</Trans>;
	}
}

function Advice({ refusal, hostName, cloud }: RefusalTextProps) {
	switch (refusal.kind) {
		case "branch-checked-out":
			return (
				<Trans>
					Close or switch that workspace there, then try again. Its path is{" "}
					{refusal.path}.
				</Trans>
			);
		case "branch-diverged":
			return (
				<Trans>
					Teleporting would bury them. Pull from {hostName} first, or teleport
					in the other direction.
				</Trans>
			);
		case "repository-missing":
			return cloud ? (
				<Trans>
					Add an environment with this repository in Settings, then try again.
				</Trans>
			) : (
				<Trans>
					Add the repository as a project on {hostName}, then try again.
				</Trans>
			);
		case "unverified":
			return (
				<Trans>
					{refusal.reason}. Nothing moved: teleporting blind could bury work
					there.
				</Trans>
			);
	}
}
