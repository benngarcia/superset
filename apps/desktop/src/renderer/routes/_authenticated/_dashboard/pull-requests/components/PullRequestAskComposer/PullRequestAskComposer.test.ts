import { expect, test } from "bun:test";
import { buildPullRequestQuestionPrompt } from "./PullRequestAskComposer";

test("names the pull request before the question", () => {
	expect(
		buildPullRequestQuestionPrompt(
			{ number: 42, title: "Fix it", url: "https://github.com/o/r/pull/42" },
			"  why did this change?  ",
		),
	).toBe(
		'About pull request #42 "Fix it" (https://github.com/o/r/pull/42): why did this change?',
	);
});
