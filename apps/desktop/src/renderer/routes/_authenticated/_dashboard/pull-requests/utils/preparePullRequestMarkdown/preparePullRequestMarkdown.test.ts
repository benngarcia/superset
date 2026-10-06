import { describe, expect, it } from "bun:test";
import {
	preparePullRequestMarkdown,
	pullRequestMarkdownPreview,
} from "./preparePullRequestMarkdown";

describe("preparePullRequestMarkdown", () => {
	it("drops template comments and resolves line breaks outside code", () => {
		expect(
			preparePullRequestMarkdown(
				"<!-- READ BEFORE OPENING -->\nLine one<br>Line two\n\n```html\n<!-- kept --><br>\n```",
			),
		).toBe("Line one\nLine two\n\n```html\n<!-- kept --><br>\n```");
	});

	it("strips inline formatting wrappers the renderer would print", () => {
		expect(preparePullRequestMarkdown("<sub>bot</sub> says <kbd>x</kbd>")).toBe(
			"bot says x",
		);
	});
});

describe("pullRequestMarkdownPreview", () => {
	it("flattens markdown to readable text", () => {
		expect(
			pullRequestMarkdownPreview(
				"## Summary\n\n**Bold** [link](https://x.test) ![img](a.png)\n\n```js\ncode\n```\n<details><summary>More</summary>hidden</details>",
			),
		).toBe("Summary\nBold link img\n[code]");
	});
});
