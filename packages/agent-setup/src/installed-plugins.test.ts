import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEnabledPluginNames } from "./installed-plugins";

let dir: string;
let file: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "ledger-"));
	file = join(dir, "installed_plugins.json");
});

describe("readEnabledPluginNames", () => {
	it("reads the enabled names, skipping the disabled", () => {
		writeFileSync(
			file,
			JSON.stringify({
				version: 1,
				plugins: [
					{ name: "linear", enabled: true },
					{ name: "sentry", enabled: false },
					{ name: "figma" },
				],
			}),
		);

		expect(readEnabledPluginNames(file)).toEqual(["linear", "figma"]);
	});

	it("reports no plugins when the ledger does not exist", () => {
		expect(readEnabledPluginNames(file)).toEqual([]);
	});

	it("reports an unreadable ledger as null, not as no plugins", () => {
		writeFileSync(file, "{not json");
		expect(readEnabledPluginNames(file)).toBeNull();

		writeFileSync(file, JSON.stringify({ version: 1 }));
		expect(readEnabledPluginNames(file)).toBeNull();

		expect(readEnabledPluginNames(dir)).toBeNull();
	});
});
