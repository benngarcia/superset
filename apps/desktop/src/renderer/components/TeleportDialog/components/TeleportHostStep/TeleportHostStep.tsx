import { Trans } from "@lingui/react/macro";
import { FEATURE_FLAGS } from "@superset/shared/constants";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/lib/utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useWorkspaceHostOptions } from "renderer/hooks/useWorkspaceHostOptions";
import type { TeleportDestination } from "../../types";

interface TeleportHostStepProps {
	selectedHostId: string | null;
	onSelect: (host: TeleportDestination) => void;
	onCancel: () => void;
	onReview: () => void;
	/** True when the work is not on this device yet, so this device is a destination. */
	includeThisDevice: boolean;
	/** False when the work already lives in a sandbox. */
	allowCloud: boolean;
}

/**
 * Pick where the workspace goes.
 *
 * Nothing is preselected on purpose: the destination is the one decision
 * this dialog cannot make for you, and a default would be clicked through.
 * An offline host stays selectable — it is reached when it wakes, which the
 * row says — because "my desktop is asleep" is the normal reason to be
 * moving work to it.
 */
export function TeleportHostStep({
	selectedHostId,
	onSelect,
	onCancel,
	onReview,
	includeThisDevice,
	allowCloud,
}: TeleportHostStepProps) {
	const { otherHosts, localHostId, currentDeviceName, localHostIsOnline } =
		useWorkspaceHostOptions();
	const cloudFlag = useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES);
	const cloudEnabled = allowCloud && cloudFlag === true;
	const hosts =
		includeThisDevice && localHostId && currentDeviceName
			? [
					{
						id: localHostId,
						name: currentDeviceName,
						isOnline: localHostIsOnline ?? true,
						isThisDevice: true,
					},
					...otherHosts.map((host) => ({ ...host, isThisDevice: false })),
				]
			: otherHosts.map((host) => ({ ...host, isThisDevice: false }));

	if (hosts.length === 0 && !cloudEnabled) {
		return (
			<>
				<p className="px-1 py-6 text-center text-muted-foreground text-sm">
					{allowCloud ? (
						<Trans>
							Connect another device, or enable cloud workspaces, to teleport
							this workspace somewhere.
						</Trans>
					) : (
						<Trans>Connect a device to teleport this workspace to it.</Trans>
					)}
				</p>
				<div className="flex justify-end">
					<Button variant="ghost" onClick={onCancel}>
						<Trans>Close</Trans>
					</Button>
				</div>
			</>
		);
	}

	return (
		<>
			<div className="-mx-1 max-h-72 overflow-y-auto">
				{hosts.map((host) => (
					<button
						key={host.id}
						type="button"
						aria-pressed={selectedHostId === host.id}
						onClick={() =>
							onSelect({
								kind: "host",
								id: host.id,
								name: host.name,
								isOnline: host.isOnline,
							})
						}
						className={cn(
							"flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
							selectedHostId === host.id ? "bg-accent" : "hover:bg-accent/50",
						)}
					>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-sm">
								{host.name}
							</span>
							<span className="block text-muted-foreground text-xs">
								{host.isThisDevice ? (
									<Trans>This device</Trans>
								) : host.isOnline ? (
									<Trans>Connected</Trans>
								) : (
									<Trans>Offline · will be reached when it wakes</Trans>
								)}
							</span>
						</span>
						<span
							aria-hidden="true"
							className={cn(
								"size-2 shrink-0 rounded-full",
								host.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
							)}
						/>
					</button>
				))}
				{cloudEnabled && (
					<button
						type="button"
						aria-pressed={selectedHostId === "cloud"}
						onClick={() =>
							onSelect({ kind: "cloud", id: "cloud", name: "Cloud" })
						}
						className={cn(
							"flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
							selectedHostId === "cloud" ? "bg-accent" : "hover:bg-accent/50",
						)}
					>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-sm">
								<Trans>Cloud</Trans>
							</span>
							<span className="block text-muted-foreground text-xs">
								<Trans>New sandbox · the work arrives through origin</Trans>
							</span>
						</span>
						<span
							aria-hidden="true"
							className="size-2 shrink-0 rounded-full bg-emerald-500"
						/>
					</button>
				)}
			</div>
			<div className="flex justify-end gap-2">
				<Button variant="ghost" onClick={onCancel}>
					<Trans>Cancel</Trans>
				</Button>
				<Button disabled={!selectedHostId} onClick={onReview}>
					<Trans>Review</Trans>
				</Button>
			</div>
		</>
	);
}
