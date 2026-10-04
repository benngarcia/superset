import type { PullRequestRef } from "renderer/lib/github/pullRequestRef";
import { usePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
import { useWorkspace } from "renderer/routes/_authenticated/_dashboard/v2-workspace/providers/WorkspaceProvider";

export function usePullRequestPaneDetail(ref: PullRequestRef) {
	const { workspace, hostUrl } = useWorkspace();
	return usePullRequestDetail({
		projectId: workspace.projectId,
		hostUrl,
		repoFullName: ref.repoFullName,
		prNumber: ref.number,
	});
}
