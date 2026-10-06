import type { RendererContext } from "@superset/panes";
import type {
	ChatPaneData,
	OpenFile,
	PaneViewerData,
} from "renderer/routes/_authenticated/_dashboard/v2-workspace/$workspaceId/types";
import { AcpChatPane } from "./components/AcpChatPane";
import { saveChatMode } from "./utils/savedChatMode";

export function ChatPane({
	ctx,
	onOpenFile,
	workspaceId,
}: {
	ctx: RendererContext<PaneViewerData>;
	workspaceId: string;
	onOpenFile: OpenFile;
}) {
	const data = ctx.pane.data as ChatPaneData;

	return (
		<AcpChatPane
			key={`${data.terminalId}:${data.agent?.id}`}
			agent={data.agent}
			isActive={ctx.isActive}
			onFirstPromptSent={() => {
				if (
					data.pendingPrompt === undefined &&
					data.pendingAttachments === undefined
				)
					return;
				const {
					pendingPrompt: _sent,
					pendingAttachments: _attached,
					...rest
				} = data;
				ctx.actions.updateData(rest);
			}}
			pendingFirstPrompt={
				data.pendingPrompt || data.pendingAttachments?.length
					? [
							...(data.pendingPrompt
								? [{ type: "text" as const, text: data.pendingPrompt }]
								: []),
							...(data.pendingAttachments ?? []).map((attachment) => ({
								type: "attachment" as const,
								...attachment,
							})),
						]
					: null
			}
			modelId={data.chatModelId}
			modelLabel={data.chatModelLabel}
			modeId={data.chatModeId}
			onSessionInfo={({ harnessSessionId, title }) => {
				const rebound = harnessSessionId !== undefined && data.agent;
				const retitled = title !== undefined && title !== data.chatTitle;
				if (!rebound && !retitled) return;
				ctx.actions.updateData({
					...data,
					...(rebound
						? { agent: { ...rebound, sessionId: harnessSessionId } }
						: {}),
					...(retitled ? { chatTitle: title } : {}),
				});
			}}
			onSwitchAgent={({ presetId, label, model, modeId, handoffPrompt }) => {
				ctx.actions.setTitle(label);
				ctx.actions.updateData({
					terminalId: data.terminalId,
					sessionId: null,
					agent: { id: presetId },
					...(model
						? { chatModelId: model.id, chatModelLabel: model.label }
						: {}),
					...(modeId ? { chatModeId: modeId } : {}),
					...(handoffPrompt ? { pendingPrompt: handoffPrompt } : {}),
				});
			}}
			onModeChange={(chatModeId) => {
				if (data.agent) saveChatMode(data.agent.id, chatModeId);
				ctx.actions.updateData({ ...data, chatModeId });
			}}
			onSessionCreated={(sessionId) =>
				ctx.actions.updateData({ ...data, sessionId })
			}
			onOpenFile={onOpenFile}
			sessionId={data.sessionId}
			terminalId={data.terminalId}
			workspaceId={workspaceId}
		/>
	);
}
