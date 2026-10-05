import { Badge } from "@superset/ui/badge";
import { workspaceTrpc } from "@superset/workspace-client";
import { useState } from "react";

export function AttachmentImage({
	attachmentId,
	name,
}: {
	attachmentId: string;
	name: string;
}) {
	const { data, isPending, isError } = workspaceTrpc.attachments.read.useQuery(
		{ attachmentId },
		{ staleTime: Number.POSITIVE_INFINITY, retry: false },
	);
	const [unrenderable, setUnrenderable] = useState(false);
	if (isError || unrenderable) return <Badge variant="secondary">{name}</Badge>;
	if (isPending)
		return (
			<div className="size-40 animate-pulse rounded-2xl bg-foreground/10" />
		);
	return (
		<img
			alt={name}
			className="size-40 rounded-2xl border border-border object-cover"
			onError={() => setUnrenderable(true)}
			src={`data:${data.mediaType};base64,${data.data}`}
		/>
	);
}
