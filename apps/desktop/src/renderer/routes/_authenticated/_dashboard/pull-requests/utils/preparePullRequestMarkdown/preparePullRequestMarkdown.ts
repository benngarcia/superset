const CODE_SPLIT_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/**
 * Drops the template comments GitHub bodies carry ("READ BEFORE OPENING") so
 * a comment-only body reads as empty. Code spans and fences stay as written.
 */
export function preparePullRequestMarkdown(markdown: string): string {
	return markdown
		.split(CODE_SPLIT_PATTERN)
		.map((segment, index) =>
			index % 2 === 1 ? segment : segment.replace(HTML_COMMENT_PATTERN, ""),
		)
		.join("")
		.trim();
}
