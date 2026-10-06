import type { ReactNode } from "react";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";
import { PullRequestInfo } from "../PullRequestInfo";
import { PullRequestItemHeader } from "../PullRequestItemHeader";
import { PullRequestMarkdown } from "../PullRequestMarkdown";
import { PullRequestPageBody } from "../PullRequestPageBody";

interface PullRequestSummaryContentProps {
	data: PullRequestDetail;
	/** Rendered under the description (the workspace pane's review comments). */
	children?: ReactNode;
	composer?: ReactNode;
}

/** The Summary tab: header, info rail, description, then whatever the host adds. */
export function PullRequestSummaryContent({
	data,
	children,
	composer,
}: PullRequestSummaryContentProps) {
	return (
		<PullRequestPageBody
			header={<PullRequestItemHeader data={data} />}
			info={(variant) => <PullRequestInfo data={data} variant={variant} />}
			composer={composer}
		>
			<PullRequestMarkdown body={data.body} />
			{children ? <div className="mt-8">{children}</div> : null}
		</PullRequestPageBody>
	);
}
