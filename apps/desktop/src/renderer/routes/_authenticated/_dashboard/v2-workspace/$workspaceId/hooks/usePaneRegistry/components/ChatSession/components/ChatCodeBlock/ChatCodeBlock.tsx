import { useLingui } from "@lingui/react/macro";
import { parsePatchFiles } from "@pierre/diffs";
import { File, PatchDiff } from "@pierre/diffs/react";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import {
	getDiffsTheme,
	getDiffViewerStyle,
} from "renderer/screens/main/components/WorkspaceView/utils/code-theme";
import { useResolvedTheme } from "renderer/stores/theme";
import { CopyButton } from "../CopyButton";
import { fenceLanguage, fenceText, isDiffLanguage } from "./utils/fencedCode";

const CHAT_CODE_FONT_SIZE = 12;

/** The renderer's shadow tree does not inherit the transcript's opt-in. */
const SELECTABLE_CSS = "* { user-select: text; -webkit-user-select: text; }";

type FencedCodeProps = ComponentProps<"code"> & {
	node?: unknown;
	children?: ReactNode;
};

function patchParses(text: string): boolean {
	try {
		const parsed = parsePatchFiles(text);
		return parsed.some((patch) =>
			patch.files.some((file) => file.hunks.length > 0),
		);
	} catch {
		return false;
	}
}

/**
 * A fenced block in agent prose, rendered by the same highlighter as the
 * diff card and the file viewer so code reads the same wherever it appears:
 * a quiet label and a copy button, then the code, wrapped rather than
 * scrolled. A fence marked `diff` that is a real patch renders as one.
 */
export function ChatCodeBlock({ children, className }: FencedCodeProps) {
	const { t } = useLingui();
	const activeTheme = useResolvedTheme();
	const language = fenceLanguage(className);
	const text = useMemo(() => fenceText(children), [children]);
	const asPatch = useMemo(
		() => isDiffLanguage(language) && patchParses(text),
		[language, text],
	);
	const style = getDiffViewerStyle(activeTheme, {
		fontSize: CHAT_CODE_FONT_SIZE,
	});
	const options = {
		theme: getDiffsTheme(activeTheme),
		themeType: activeTheme.type,
		overflow: "wrap" as const,
		disableFileHeader: true,
		unsafeCSS: SELECTABLE_CSS,
	};
	return (
		<div
			className="my-2 overflow-hidden rounded-md border border-border/60 bg-background"
			data-chat-code-block={language ?? ""}
		>
			<div className="flex items-center justify-between pr-1 pl-3 pt-1">
				<span className="font-mono text-[11px] text-muted-foreground uppercase">
					{language ?? ""}
				</span>
				<CopyButton
					iconClassName="size-3"
					label={t({ message: "Copy code" })}
					text={text}
				/>
			</div>
			{asPatch ? (
				<PatchDiff
					options={{ ...options, diffStyle: "unified", expandUnchanged: true }}
					patch={text}
					style={style}
				/>
			) : (
				<File
					file={{
						name: `snippet.${language ?? "txt"}`,
						contents: text,
						lang: language ?? "text",
					}}
					options={{ ...options, disableLineNumbers: true }}
					style={style}
				/>
			)}
		</div>
	);
}

/** What a chat surface hands `ChatMarkdown` so fenced code renders through this block. */
export const CHAT_CODE_COMPONENTS = { code: ChatCodeBlock };
