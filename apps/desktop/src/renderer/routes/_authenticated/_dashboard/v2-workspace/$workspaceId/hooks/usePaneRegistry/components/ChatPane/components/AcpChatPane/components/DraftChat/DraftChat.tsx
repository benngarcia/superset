import type { UserContent, UserMessage } from "@superset/chat/protocol";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Composer } from "../../../../../ChatSession/components/Composer";
import { ConnectionNotice } from "../../../../../ChatSession/components/ConnectionNotice";

const NO_COMMANDS: never[] = [];
const NOTHING = async () => {};

export function DraftChat({
	draftKey,
	isActive,
	notice,
	onQueue,
	queued,
	workspaceId,
}: {
	draftKey: string;
	isActive: boolean;
	notice: ReactNode;
	onQueue: (content: UserContent[]) => void;
	queued: UserContent[][];
	workspaceId: string;
}) {
	const promptQueue = useMemo(
		() =>
			queued.length === 0
				? undefined
				: {
						prompts: queued.map(
							(content, index): UserMessage => ({
								id: `draft-${index}`,
								kind: "user_message",
								startedAtMs: 0,
								queued: true,
								content,
							}),
						),
						paused: false,
						actionable: false,
						remove: NOTHING,
						resume: NOTHING,
						steer: NOTHING,
					},
		[queued],
	);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col">
			<div className="min-h-0 flex-1" />
			<ConnectionNotice>{notice}</ConnectionNotice>
			<Composer
				availableCommands={NO_COMMANDS}
				draftKey={draftKey}
				isActive={isActive}
				onSend={(content) => onQueue(content)}
				promptQueue={promptQueue}
				workspaceId={workspaceId}
			/>
		</div>
	);
}
