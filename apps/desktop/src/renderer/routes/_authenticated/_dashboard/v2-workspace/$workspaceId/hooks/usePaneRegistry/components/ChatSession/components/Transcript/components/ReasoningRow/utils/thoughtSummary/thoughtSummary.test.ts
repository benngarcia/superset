import { describe, expect, test } from "bun:test";
import { thoughtSummary } from "./thoughtSummary";

describe("thoughtSummary", () => {
	test("takes the first paragraph as one plain line", () => {
		expect(
			thoughtSummary(
				"\n**Checking** the `shimmer`\nprimitive first.\n\nThen the rest.",
			),
		).toBe("Checking the shimmer primitive first.");
	});

	test("is empty before any text arrives", () => {
		expect(thoughtSummary("  \n ")).toBe("");
	});
});
