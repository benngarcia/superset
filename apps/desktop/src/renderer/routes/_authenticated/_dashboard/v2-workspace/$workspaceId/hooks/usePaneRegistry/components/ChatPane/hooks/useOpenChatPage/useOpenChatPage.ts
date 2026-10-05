import type { RendererContext } from "@superset/panes";
import { useCallback } from "react";
import { useUrlLinkAction } from "renderer/lib/clickPolicy";
import type { PaneViewerData } from "renderer/routes/_authenticated/_dashboard/v2-workspace/$workspaceId/types";
import { runUrlLinkAction } from "../../../../utils/runTerminalLinkAction";
import type { OpenPage } from "../../../ChatSession/providers/ChatPaneActionsProvider";

/**
 * A click on a page card in the chat. Modifiers follow the page link click
 * policy; a tier the policy leaves unbound opens the page in a pane, because a
 * card that ignores a plain click reads as broken.
 */
export function useOpenChatPage(
	store: RendererContext<PaneViewerData>["store"],
): OpenPage {
	const getUrlAction = useUrlLinkAction("4-tier");
	return useCallback(
		(url, event) =>
			runUrlLinkAction({ store }, url, getUrlAction(event, url) ?? "pane"),
		[getUrlAction, store],
	);
}
