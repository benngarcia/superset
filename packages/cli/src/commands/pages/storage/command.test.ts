import { describe, expect, test } from "bun:test";
import { displayStorage } from "./command";

const UPDATED = "2026-10-01T12:00:00.000Z";

describe("displayStorage", () => {
	test("lists each key with its record count", () => {
		const output = displayStorage({
			pageId: "page-1",
			keys: [{ key: "votes", records: 3, updatedAt: UPDATED }],
		});
		expect(output).toContain("KEY");
		expect(output).toMatch(/votes\s+3/);
	});

	test("prints a long key whole so it can be passed to --key", () => {
		const key = "k".repeat(128);
		const output = displayStorage({
			pageId: "page-1",
			keys: [{ key, records: 1, updatedAt: UPDATED }],
		});
		expect(output).toContain(key);
	});

	test("shows every person's slot for one key", () => {
		const output = displayStorage({
			pageId: "page-1",
			key: "votes",
			records: [
				{ userId: "u1", name: "Ada", value: { pick: "b" }, updatedAt: UPDATED },
			],
		});
		expect(output).toMatch(/Ada\s+\{"pick":"b"\}/);
	});

	test("says so when a key has no records", () => {
		expect(
			displayStorage({ pageId: "page-1", key: "votes", records: [] }),
		).toBe('No records for key "votes".');
	});
});
