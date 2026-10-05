import { useLingui } from "@lingui/react/macro";
import type { TeleportStepId } from "@superset/shared/teleport";
import { useMemo } from "react";
import type { TeleportDestination } from "../../../../types";

/**
 * One human label per step, in the user's language.
 *
 * These double as the failure vocabulary — an error reads "Restoring
 * changes failed: …" — so they are phrased as the thing being done, not as
 * the command being run. A user who reads "Capturing commits and changes"
 * knows what was at stake if it stopped there; "git write-tree" tells them
 * nothing.
 */
export function useTeleportStepLabels(
	destination: TeleportDestination["kind"],
): Record<TeleportStepId, string> {
	const { t } = useLingui();

	return useMemo(
		() => ({
			handoff: t({
				message: "Reading the agents' transcripts",
				context: "teleport step",
			}),
			capture: t({
				message: "Capturing commits and changes",
				context: "teleport step",
			}),
			createWorktree:
				destination === "cloud"
					? t({
							message: "Starting a sandbox",
							context: "teleport step",
						})
					: t({
							message: "Creating the worktree there",
							context: "teleport step",
						}),
			restore: t({
				message: "Restoring changes",
				context: "teleport step",
			}),
			setup: t({
				message: "Running setup scripts",
				context: "teleport step",
			}),
			tabs: t({
				message: "Rebuilding tabs",
				context: "teleport step",
			}),
			stopSource: t({
				message: "Syncing late changes, stopping the source",
				context: "teleport step",
			}),
			launch: t({
				message: "Resuming agents",
				context: "teleport step",
			}),
		}),
		[t, destination],
	);
}
