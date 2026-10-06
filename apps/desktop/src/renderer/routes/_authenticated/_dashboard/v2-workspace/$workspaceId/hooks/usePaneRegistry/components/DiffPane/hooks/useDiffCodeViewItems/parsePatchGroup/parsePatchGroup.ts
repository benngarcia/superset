import {
	type FileDiffMetadata,
	parseDiffFromFile,
	parsePatchFiles,
} from "@pierre/diffs";
import { hashString } from "../../../utils/hashString";

export interface PatchGroupFile {
	path: string;
	oldPath?: string;
	oldFile: { name: string; contents: string };
	newFile: { name: string; contents: string };
}

/** What a patch group resolves to. `patch` is the normal path; `files` is
 * what an older host-service without `git.getDiffPatch` can still give us —
 * the full contents per file, which parse into complete (non-partial)
 * metadata. `requestedPaths` is every path the host was asked for, whether
 * or not it answered with a section. */
export type PatchGroupResult = { requestedPaths: string[] } & (
	| { kind: "patch"; patch: string }
	| { kind: "files"; files: PatchGroupFile[] }
);

export interface ParsedPatchGroup {
	/** The result this was parsed from. React Query shares structure across
	 * refetches, so an unchanged patch is the same object and parses nothing. */
	source: PatchGroupResult;
	byPath: ReadonlyMap<string, FileDiffMetadata>;
	bySegmentKey: ReadonlyMap<string, FileDiffMetadata>;
}

const SEGMENT_BOUNDARY = /^diff --git /gm;

/** One section per file, each starting at its `diff --git` header. Text
 * before the first header stays attached to the first section. */
export function splitPatchSegments(patch: string): string[] {
	const starts: number[] = [];
	for (const match of patch.matchAll(SEGMENT_BOUNDARY)) {
		starts.push(match.index);
	}
	if (starts.length <= 1) return patch.length > 0 ? [patch] : [];
	const segments: string[] = [];
	let start = 0;
	for (const boundary of starts.slice(1)) {
		segments.push(patch.slice(start, boundary));
		start = boundary;
	}
	segments.push(patch.slice(start));
	return segments;
}

const SECOND_SEED = 0x9e3779b9;
const SECOND_PRIME = 0x85ebca6b;

/** Content-addressed: two independent FNV-1a passes plus the length, under
 * the group so the same hunks in two categories never share a key. Stable
 * across refetches, so an unchanged file keeps its parsed metadata and
 * `cacheKey`, and with them its `CodeViewItem` version. */
export function buildPatchSegmentKey(scope: string, content: string): string {
	return [
		scope,
		content.length,
		hashString(content).toString(36),
		hashString(content, SECOND_SEED, SECOND_PRIME).toString(36),
	].join(":");
}

export function parsePatchGroup(
	groupKey: string,
	result: PatchGroupResult,
	previous?: ParsedPatchGroup,
): ParsedPatchGroup {
	const byPath = new Map<string, FileDiffMetadata>();
	const bySegmentKey = new Map<string, FileDiffMetadata>();
	const keep = (key: string, parse: () => FileDiffMetadata | undefined) => {
		const fileDiff = previous?.bySegmentKey.get(key) ?? parse();
		if (!fileDiff) return;
		bySegmentKey.set(key, fileDiff);
		byPath.set(fileDiff.name, fileDiff);
		if (fileDiff.prevName) byPath.set(fileDiff.prevName, fileDiff);
	};

	if (result.kind === "patch") {
		for (const segment of splitPatchSegments(result.patch)) {
			const key = buildPatchSegmentKey(groupKey, segment);
			keep(key, () => parsePatchFiles(segment, key)[0]?.files[0]);
		}
	} else {
		for (const file of result.files) {
			const oldName = file.oldPath ?? file.path;
			const key = buildPatchSegmentKey(
				groupKey,
				[oldName, file.oldFile.contents, file.path, file.newFile.contents].join(
					"\0",
				),
			);
			keep(key, () =>
				parseDiffFromFile(
					{ ...file.oldFile, name: oldName, cacheKey: `${key}:old` },
					{ ...file.newFile, name: file.path, cacheKey: `${key}:new` },
				),
			);
		}
	}

	return { source: result, byPath, bySegmentKey };
}
