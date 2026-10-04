import { useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { WorkItemDetailState } from "../../../components/WorkItemDetailState";
import { PullRequestCodeTab } from "../../$prNumber/components/PullRequestCodeTab";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";
import { PullRequestSummaryContent } from "../PullRequestSummaryContent";

export function PullRequestDetailContent({
	activeTab,
	projectId,
	hostUrl,
	hostId,
	prNumber,
	repoFullName,
	detail,
	children,
}: {
	activeTab: "summary" | "code";
	projectId: string | null;
	hostUrl: string | null;
	hostId: string | null;
	prNumber: number | null;
	repoFullName: string | null;
	detail: {
		data?: PullRequestDetail | null;
		isLoading: boolean;
		error: unknown;
		refetch: () => unknown;
	};
	children?: ReactNode;
}) {
	const { t } = useLingui();
	if (prNumber === null || (!repoFullName && !detail.isLoading)) {
		return (
			<WorkItemDetailState
				message={t({ message: "This pull request link is invalid." })}
				isError
			/>
		);
	}
	const prUrl =
		detail.data?.url ??
		(repoFullName
			? `https://github.com/${repoFullName}/pull/${prNumber}`
			: null);
	return (
		<>
			{detail.data ? (
				<div
					className={cn("min-h-0 flex-1", activeTab !== "summary" && "hidden")}
				>
					<PullRequestSummaryContent data={detail.data}>
						{children}
					</PullRequestSummaryContent>
				</div>
			) : activeTab === "summary" || !prUrl ? (
				<WorkItemDetailState
					message={
						detail.error
							? errorMessage(detail.error)
							: t({ message: "Loading pull request…" })
					}
					isLoading={detail.isLoading}
					isError={!!detail.error}
					onRetry={detail.error ? () => void detail.refetch() : undefined}
				/>
			) : null}
			{activeTab === "code" && prUrl && (
				<PullRequestCodeTab
					key={`${repoFullName}#${prNumber}`}
					projectId={projectId}
					hostUrl={hostUrl ?? ""}
					hostId={hostId}
					prNumber={prNumber}
					prUrl={prUrl}
				/>
			)}
		</>
	);
}
