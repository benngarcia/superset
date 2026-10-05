import { describe, expect, test } from "bun:test";
import { revealEnd } from "./revealEnd";

describe("revealEnd", () => {
	test("runs to the end of the word the position falls in", () => {
		expect(revealEnd("hello world again", 2, true)).toBe(5);
		expect(revealEnd("hello world again", 7, true)).toBe(11);
	});

	test("holds back a partial last word while streaming", () => {
		expect(revealEnd("hello wor", 7, true)).toBe(6);
	});

	test("shows everything once the stream has ended", () => {
		expect(revealEnd("hello wor", 7, false)).toBe(9);
	});
});
