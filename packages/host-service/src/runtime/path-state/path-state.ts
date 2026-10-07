import { lstatSync, statSync } from "node:fs";

export type PathState = "missing" | "directory" | "file" | "inaccessible";

/** Unlike `existsSync`, keeps a path this process may not read (EPERM, EACCES)
 * apart from one that is absent. */
export function getPathState(
	path: string,
	{ followSymlinks = true }: { followSymlinks?: boolean } = {},
): PathState {
	try {
		const stats = (followSymlinks ? statSync : lstatSync)(path, {
			throwIfNoEntry: false,
		});
		if (!stats) return "missing";
		return stats.isDirectory() ? "directory" : "file";
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOTDIR") return "missing";
		return "inaccessible";
	}
}

export function isMissingPath(
	path: string,
	options?: { followSymlinks?: boolean },
): boolean {
	return getPathState(path, options) === "missing";
}

export function inaccessiblePathMessage(path: string): string {
	const hint =
		process.platform === "darwin"
			? " Allow Superset to access this location in System Settings > Privacy & Security > Files & Folders, then restart Superset."
			: "";
	return `Superset does not have permission to read ${path}.${hint}`;
}
