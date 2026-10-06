import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { CodeViewItem } from "@pierre/diffs";
import type { ReactNode } from "react";
import type { ChangesetFile } from "../../../../../useChangeset";
import type { DiffAnnotationMetadata } from "../useDiffAnnotations";

const alreadyRegistered = GlobalRegistrator.isRegistered;
if (!alreadyRegistered) GlobalRegistrator.register();
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** What the fake host answers `git.getDiffPatch` with, per category. */
const patchByCategory = new Map<string, string>();
const getDiffPatch = mock(async (input: { category: string }) => ({
	patch: patchByCategory.get(input.category) ?? "",
}));

const actualWorkspaceClient = await import("@superset/workspace-client");
mock.module("@superset/workspace-client", () => ({
	...actualWorkspaceClient,
	useWorkspaceClient: () => ({
		trpcClient: { git: { getDiffPatch: { query: getDiffPatch } } },
	}),
	workspaceTrpc: {
		git: {
			getDiffPatch: { _def: () => ({ path: ["git", "getDiffPatch"] }) },
		},
	},
}));

const { act, cleanup, renderHook, waitFor } = await import(
	"@testing-library/react"
);
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
);
const { useDiffCodeViewItems } = await import("./useDiffCodeViewItems");

const FILE_A = [
	"diff --git a/a.ts b/a.ts",
	"index 0000001..0000002 100644",
	"--- a/a.ts",
	"+++ b/a.ts",
	"@@ -1,2 +1,2 @@",
	" const shared = 1;",
	"-const a = 1;",
	"+const a = 2;",
	"",
].join("\n");

const FILE_B = [
	"diff --git a/b.ts b/b.ts",
	"index 0000003..0000004 100644",
	"--- a/b.ts",
	"+++ b/b.ts",
	"@@ -1,1 +1,2 @@",
	" const b = 1;",
	"+const added = 2;",
	"",
].join("\n");

const FILE_B_EDITED = FILE_B.replace("+const added = 2;", "+const added = 3;");

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP = new Map<string, never>();

function unstagedFile(path: string): ChangesetFile {
	return {
		path,
		status: "modified",
		additions: 1,
		deletions: 1,
		source: { kind: "unstaged" },
	};
}

function options(files: ChangesetFile[]) {
	return {
		workspaceId: "workspace-1",
		files,
		collapsedSet: EMPTY_SET,
		editingSet: EMPTY_SET,
		editorRevisionByItemId: EMPTY_MAP,
		annotationsByPath: EMPTY_MAP,
	};
}

function diffItem(items: CodeViewItem<DiffAnnotationMetadata>[], path: string) {
	const item = items.find(
		(candidate) => candidate.id === `diff:unstaged:${path}`,
	);
	if (item?.type !== "diff") throw new Error(`${path} has no diff item yet`);
	return item;
}

function renderItems(files: ChangesetFile[]) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	const rendered = renderHook(
		(props: Parameters<typeof useDiffCodeViewItems>[0]) =>
			useDiffCodeViewItems(props),
		{ wrapper, initialProps: options(files) },
	);
	return { client, ...rendered };
}

beforeEach(() => {
	patchByCategory.clear();
	getDiffPatch.mockClear();
});

afterEach(cleanup);

afterAll(async () => {
	if (!alreadyRegistered) await GlobalRegistrator.unregister();
});

describe("useDiffCodeViewItems", () => {
	test("a refetch where only file B changed keeps file A's cacheKey and version", async () => {
		patchByCategory.set("unstaged", FILE_A + FILE_B);
		const { client, result } = renderItems([
			unstagedFile("a.ts"),
			unstagedFile("b.ts"),
		]);
		await waitFor(() => diffItem(result.current.items, "b.ts"));
		const a = diffItem(result.current.items, "a.ts");
		const b = diffItem(result.current.items, "b.ts");

		patchByCategory.set("unstaged", FILE_A + FILE_B_EDITED);
		await act(() => client.invalidateQueries());
		await waitFor(() =>
			expect(diffItem(result.current.items, "b.ts").version).not.toBe(
				b.version,
			),
		);

		const after = diffItem(result.current.items, "a.ts");
		expect(after.fileDiff).toBe(a.fileDiff);
		expect(after.fileDiff.cacheKey).toBe(a.fileDiff.cacheKey);
		expect(after.version).toBe(a.version);
		expect(diffItem(result.current.items, "b.ts").fileDiff.cacheKey).not.toBe(
			b.fileDiff.cacheKey,
		);
	});

	test("a refetch where file B is removed keeps file A", async () => {
		patchByCategory.set("unstaged", FILE_A + FILE_B);
		const { client, result, rerender } = renderItems([
			unstagedFile("a.ts"),
			unstagedFile("b.ts"),
		]);
		await waitFor(() => diffItem(result.current.items, "b.ts"));
		const a = diffItem(result.current.items, "a.ts");

		patchByCategory.set("unstaged", FILE_A);
		rerender(options([unstagedFile("a.ts")]));
		await act(() => client.invalidateQueries());
		await waitFor(() => expect(getDiffPatch).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(client.isFetching()).toBe(0));

		expect(result.current.items).toHaveLength(1);
		const after = diffItem(result.current.items, "a.ts");
		expect(after.fileDiff).toBe(a.fileDiff);
		expect(after.version).toBe(a.version);
		expect(client.getQueryCache().getAll()).toHaveLength(1);
	});

	test("a file joining the changeset refetches the same cache entry", async () => {
		patchByCategory.set("unstaged", FILE_A);
		const { client, result, rerender } = renderItems([unstagedFile("a.ts")]);
		await waitFor(() => diffItem(result.current.items, "a.ts"));
		const a = diffItem(result.current.items, "a.ts");

		patchByCategory.set("unstaged", FILE_A + FILE_B);
		rerender(options([unstagedFile("a.ts"), unstagedFile("b.ts")]));
		await waitFor(() => diffItem(result.current.items, "b.ts"));

		expect(getDiffPatch).toHaveBeenCalledTimes(2);
		expect(getDiffPatch.mock.calls[1]?.[0]).toMatchObject({
			paths: ["a.ts", "b.ts"],
		});
		expect(client.getQueryCache().getAll()).toHaveLength(1);
		expect(diffItem(result.current.items, "a.ts").version).toBe(a.version);
	});
});
