import { describe, expect, it } from "bun:test";
import { preparePullRequestMarkdown } from "./preparePullRequestMarkdown";

describe("preparePullRequestMarkdown", () => {
	it("drops template comments but leaves html and code as written", () => {
		expect(
			preparePullRequestMarkdown(
				"<!-- READ BEFORE OPENING -->\nLine one<br>Line two <sub>x</sub>\n\n```html\n<!-- kept -->\n```\n`<!-- inline -->`",
			),
		).toBe(
			"Line one<br>Line two <sub>x</sub>\n\n```html\n<!-- kept -->\n```\n`<!-- inline -->`",
		);
	});

	it("reads a comment-only body as empty", () => {
		expect(preparePullRequestMarkdown("<!-- a -->\n\n<!-- b -->")).toBe("");
	});
});
