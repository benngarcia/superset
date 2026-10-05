import { Plural, Trans } from "@lingui/react/macro";
import type { PaneDisposition, TeleportPlan } from "@superset/shared/teleport";

interface PlanSummaryProps {
	plan: TeleportPlan;
	hostName: string;
}

/**
 * What moves, and what the destination will do on the user's behalf.
 *
 * The second half matters as much as the first: "clones the repository
 * there first" is the difference between a teleport that looks stuck and
 * one the user understands is doing a big thing once. Every live agent gets
 * a row and a verb, so no part of the move is left to the imagination.
 */
export function PlanSummary({ plan, hostName }: PlanSummaryProps) {
	const panes = plan.tabs.flatMap((tab) => tab.panes);
	return (
		<dl className="space-y-2 text-sm">
			<Row label={<Trans>Branch</Trans>}>
				<span className="font-mono text-xs">{plan.branch}</span>
				{plan.workingTree.unpushedCommits > 0 && (
					<span className="text-muted-foreground">
						{" · "}
						<Plural
							value={plan.workingTree.unpushedCommits}
							one="# unpushed commit"
							other="# unpushed commits"
						/>
					</span>
				)}
			</Row>

			<Row label={<Trans>Changes</Trans>}>
				{plan.isEmpty ? (
					<span className="text-muted-foreground">
						<Trans>Nothing uncommitted — the branch moves on its own</Trans>
					</span>
				) : (
					<ChangeCounts plan={plan} />
				)}
			</Row>

			<Row label={<Trans>Repo</Trans>}>
				{plan.repository === "clone" ? (
					<Trans>Clones the repository on {hostName} first</Trans>
				) : (
					<Trans>Already on {hostName} · fetch only</Trans>
				)}
			</Row>

			<Row label={<Trans>Agents</Trans>}>
				{panes.length === 0 ? (
					<span className="text-muted-foreground">
						<Trans>None running · a terminal opens empty</Trans>
					</span>
				) : (
					<ul className="space-y-0.5">
						{panes.map((pane) => (
							<li
								key={pane.paneId}
								className="flex items-baseline justify-between gap-4"
							>
								<span className="truncate font-mono text-xs">{pane.label}</span>
								<span className="shrink-0 text-emerald-600 text-xs dark:text-emerald-400">
									<DispositionLabel disposition={pane.disposition} />
								</span>
							</li>
						))}
					</ul>
				)}
			</Row>
		</dl>
	);
}

function ChangeCounts({ plan }: { plan: TeleportPlan }) {
	const { modified, untracked, preciousFiles } = plan.workingTree;
	const parts = [
		modified > 0 && (
			<Plural key="m" value={modified} one="# modified" other="# modified" />
		),
		untracked > 0 && (
			<Plural key="u" value={untracked} one="# untracked" other="# untracked" />
		),
	].filter(Boolean);

	return (
		<>
			{parts.map((part, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed, ordered parts
				<span key={index}>
					{index > 0 && ", "}
					{part}
				</span>
			))}
			{/* Named apart from the counts: the work travels through origin,
			    which may be a public forge, so ignored secrets never do. */}
			{preciousFiles > 0 && (
				<span className="block text-muted-foreground text-xs">
					<Plural
						value={preciousFiles}
						one="# env file stays here — ignored files don't travel"
						other="# env files stay here — ignored files don't travel"
					/>
				</span>
			)}
		</>
	);
}

/**
 * The verb for a pane. Each one is a promise about what the user will find
 * on the other side, so they are worded as outcomes rather than mechanisms.
 */
function DispositionLabel({ disposition }: { disposition: PaneDisposition }) {
	switch (disposition.kind) {
		case "agent-resumes":
			return <Trans>hands off &amp; resumes</Trans>;
		case "agent-restarts":
			return <Trans>hands off &amp; starts fresh</Trans>;
		case "process-restarts":
			return <Trans>restarts</Trans>;
		case "shell-opens":
			return <Trans>opens empty</Trans>;
	}
}

function Row({
	label,
	children,
}: {
	label: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-3">
			<dt className="w-16 shrink-0 text-muted-foreground text-xs leading-5">
				{label}
			</dt>
			<dd className="min-w-0 flex-1 leading-5">{children}</dd>
		</div>
	);
}
