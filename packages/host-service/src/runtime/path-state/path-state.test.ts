import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPathState } from "./path-state";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "superset-path-state-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("getPathState", () => {
	test("tells directories, files, and missing paths apart", () => {
		const file = join(root, "file.txt");
		writeFileSync(file, "x");

		expect(getPathState(root)).toBe("directory");
		expect(getPathState(file)).toBe("file");
		expect(getPathState(join(root, "absent"))).toBe("missing");
		expect(getPathState(join(file, "child"))).toBe("missing");
	});

	test("sees a dangling symlink only when not following it", () => {
		const link = join(root, "link");
		symlinkSync(join(root, "absent"), link);

		expect(getPathState(link)).toBe("missing");
		expect(getPathState(link, { followSymlinks: false })).toBe("file");
	});

	test.skipIf(process.getuid?.() === 0)(
		"reports a path behind a locked directory as inaccessible, not missing",
		() => {
			const locked = join(root, "locked");
			mkdirSync(join(locked, "inner"), { recursive: true });
			chmodSync(locked, 0o000);
			try {
				expect(getPathState(join(locked, "inner"))).toBe("inaccessible");
			} finally {
				chmodSync(locked, 0o755);
			}
		},
	);
});
