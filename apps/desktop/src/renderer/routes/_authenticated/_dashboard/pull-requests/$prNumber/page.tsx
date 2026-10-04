import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useHostUrl } from "renderer/hooks/host-service/useHostTargetUrl";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { useProjectHost } from "renderer/routes/_authenticated/_dashboard/hooks/useProjectHost";
import { PullRequestDetailContent } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailContent";
import { PullRequestDetailHeader } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailHeader";
import { PullRequestListToggle } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestListToggle";
import { usePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
import { parsePositiveIntegerParam } from "renderer/routes/_authenticated/_dashboard/utils/parsePositiveIntegerParam";
import { Route as PullRequestsLayoutRoute } from "../layout";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/pull-requests/$prNumber/",
)({
	component: PullRequestDetailPage,
});

type DetailTab = "summary" | "code";

function PullRequestDetailPage() {
	const { t } = useLingui();
	const detailTabs: ReadonlyArray<{ value: DetailTab; label: string }> = [
		{
			value: "summary",
			label: t({
				message: "Summary",
			}),
		},
		{
			value: "code",
			label: t({
				message: "Code",
			}),
		},
	];
	const { prNumber: prNumberRaw } = Route.useParams();
	const prNumber = parsePositiveIntegerParam(prNumberRaw);
	const search = PullRequestsLayoutRoute.useSearch();
	const projectId = search.project ?? null;
	const { hostId } = useProjectHost(projectId);
	const hostUrl = useHostUrl(hostId);
	const [activeTab, setActiveTab] = useState<DetailTab>("summary");

	const detail = usePullRequestDetail({
		projectId,
		hostUrl,
		prNumber,
		repoFullName: search.repo,
	});

	// The list pane is always visible in the split view (or reachable via the
	// list-collapse toggle in the shared layout), so there's no "back"
	// affordance here — just the PR identity and its actions.
	const header = (
		<div className="flex shrink-0 flex-col border-b border-border">
			<PageHeader
				contentClassName="gap-1"
				start={
					<>
						<PullRequestListToggle />
						<div className="ml-2 flex items-center gap-1">
							{detailTabs.map(({ value, label }) => (
								<button
									key={value}
									type="button"
									onClick={() => setActiveTab(value)}
									aria-current={activeTab === value ? "true" : undefined}
									className={cn(
										"rounded-md px-2 py-1 text-xs font-medium transition-colors",
										activeTab === value
											? "bg-accent text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{label}
								</button>
							))}
						</div>
					</>
				}
			/>
			<PullRequestDetailHeader
				projectId={detail.projectId}
				hostId={hostId}
				hostUrl={hostUrl}
				prNumber={prNumber}
				data={detail.data}
				isLoading={detail.isLoading}
			/>
		</div>
	);

	return (
		<div className="@container flex min-h-0 flex-1 flex-col">
			{header}
			<PullRequestDetailContent
				activeTab={activeTab}
				detail={detail}
				projectId={detail.projectId}
				repoFullName={detail.repoFullName}
				prNumber={prNumber}
				hostUrl={hostUrl}
				hostId={hostId}
			/>
		</div>
	);
}
