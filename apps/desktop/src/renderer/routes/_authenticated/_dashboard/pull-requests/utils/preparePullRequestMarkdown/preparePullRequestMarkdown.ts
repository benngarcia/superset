const FENCED_CODE_SPLIT_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const HTML_LINE_BREAK_PATTERN = /<br\s*\/?>/gi;
const FORMATTING_TAG_PATTERN = /<\/?(?:sub|sup|ins|kbd|samp)>/gi;

/**
 * GitHub-flavored bodies lean on HTML the renderer would print literally:
 * template comments ("READ BEFORE OPENING"), bare `<br>` tags, and the inline
 * wrappers bot badges nest. Fenced code is left untouched so samples survive.
 */
export function preparePullRequestMarkdown(markdown: string): string {
	return markdown
		.split(FENCED_CODE_SPLIT_PATTERN)
		.map((segment, index) =>
			index % 2 === 1
				? segment
				: segment
						.replace(HTML_COMMENT_PATTERN, "")
						.replace(HTML_LINE_BREAK_PATTERN, "\n")
						.replace(FORMATTING_TAG_PATTERN, ""),
		)
		.join("")
		.trim();
}

/** A one-line, plain-text reading of a markdown body for dense surfaces. */
export function pullRequestMarkdownPreview(markdown: string): string {
	return preparePullRequestMarkdown(markdown)
		.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, "")
		.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "[code]")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^>\s?/gm, "")
		.replace(/(\*\*|__|\*|_|~~|`)/g, "")
		.replace(/\n{2,}/g, "\n")
		.trim();
}
