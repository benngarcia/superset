import { transferAllTabs, type WorkspaceStore } from "@superset/panes";
import { useEffect } from "react";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { StoreApi } from "zustand/vanilla";
import type { PaneViewerData } from "../../types";

const SIDEBAR_PANE_KINDS = new Set(["files", "changes-list", "review"]);

export function useRightPaneAreaLifecycle({
	workspaceId,
	flag,
	centerStore,
	rightStore,
	isReady,
	hasRow,
}: {
	workspaceId: string;
	flag: boolean | undefined;
	centerStore: StoreApi<WorkspaceStore<PaneViewerData>>;
	rightStore: StoreApi<WorkspaceStore<PaneViewerData>>;
	isReady: boolean;
	hasRow: boolean;
}): void {
	const collections = useCollections();

	useEffect(() => {
		if (!isReady || !hasRow || flag === undefined) return;
		const row = collections.v2WorkspaceLocalState.get(workspaceId);
		if (!row) return;
		if (flag === false) {
			if (row.rightPaneLayout === undefined) return;
			const state = rightStore.getState();
			for (const tab of state.tabs) {
				for (const pane of Object.values(tab.panes)) {
					if (!SIDEBAR_PANE_KINDS.has(pane.kind)) continue;
					rightStore
						.getState()
						.closePane({ tabId: tab.id, paneId: pane.id, intent: "remove" });
				}
			}
			transferAllTabs({ source: rightStore, target: centerStore });
			collections.v2WorkspaceLocalState.update(workspaceId, (draft) => {
				delete draft.rightPaneLayout;
				delete draft.rightPaneAreaExpansion;
			});
			return;
		}
		if (row.rightPaneLayout !== undefined) return;
		const state = rightStore.getState();
		state.addTab({ panes: [{ kind: "files", data: { kind: "files" } }] });
		state.addTab({
			panes: [{ kind: "changes-list", data: { kind: "changes-list" } }],
		});
		const [first] = rightStore.getState().tabs;
		if (first) rightStore.getState().setActiveTab(first.id);
	}, [
		collections,
		workspaceId,
		flag,
		centerStore,
		rightStore,
		isReady,
		hasRow,
	]);
}
