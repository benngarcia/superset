import { describe, expect, test } from "bun:test";
import { fenceLanguage, fenceText, isDiffLanguage } from "./fencedCode";

describe("fenceLanguage", () => {
	test("reads the language off the class markdown sets", () => {
		expect(fenceLanguage("language-TypeScript")).toBe("typescript");
		expect(fenceLanguage("other language-diff")).toBe("diff");
	});
	test("is null without a language or a string class", () => {
		expect(fenceLanguage("")).toBeNull();
		expect(fenceLanguage(undefined)).toBeNull();
		expect(fenceLanguage("hljs")).toBeNull();
	});
});

describe("fenceText", () => {
	test("joins string children and drops the trailing newline", () => {
		expect(fenceText(["a\n", "b\n"])).toBe("a\nb");
		expect(fenceText("x")).toBe("x");
	});
	test("drops nullish children and keeps numbers", () => {
		expect(fenceText([null, "a", undefined, 1])).toBe("a1");
	});
});

describe("isDiffLanguage", () => {
	test("covers the names agents use for patches", () => {
		expect(isDiffLanguage("diff")).toBe(true);
		expect(isDiffLanguage("patch")).toBe(true);
		expect(isDiffLanguage("ts")).toBe(false);
		expect(isDiffLanguage(null)).toBe(false);
	});
});
