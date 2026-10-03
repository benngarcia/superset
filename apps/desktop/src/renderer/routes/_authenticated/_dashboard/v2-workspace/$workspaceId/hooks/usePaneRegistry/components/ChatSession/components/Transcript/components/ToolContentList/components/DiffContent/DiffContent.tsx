import { MultiFileDiff } from "@pierre/diffs/react";
import type { ToolContent } from "@superset/chat/protocol";
import {
	getDiffsTheme,
	getDiffViewerStyle,
} from "renderer/screens/main/components/WorkspaceView/utils/code-theme";
import { useResolvedTheme } from "renderer/stores/theme";

type DiffToolContent = Extract<ToolContent, { type: "diff" }>;

const CHAT_DIFF_FONT_SIZE = 12;

export function DiffContent({ content }: { content: DiffToolContent }) {
	const activeTheme = useResolvedTheme();
	return (
		<div className="flex flex-col gap-1">
			<span className="font-mono text-xs text-muted-foreground">
				{content.path}
				{content.oldText === null ? " (new file)" : ""}
			</span>
			<MultiFileDiff
				oldFile={{ name: content.path, contents: content.oldText ?? "" }}
				newFile={{ name: content.path, contents: content.newText }}
				className="overflow-hidden rounded-md border border-border/60"
				style={getDiffViewerStyle(activeTheme, {
					fontSize: CHAT_DIFF_FONT_SIZE,
				})}
				options={{
					diffStyle: "unified",
					expandUnchanged: false,
					theme: getDiffsTheme(activeTheme),
					themeType: activeTheme.type,
					overflow: "wrap",
					disableFileHeader: true,
				}}
			/>
		</div>
	);
}
