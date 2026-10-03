import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = {
	status: string;
	deletedAt: Date | null;
	provider: string;
	providerSandboxId: string;
};

let row: Row | undefined;
let sandboxCalls: string[] = [];
let queued: Array<{ body: unknown; delaySeconds?: number }> = [];

// `mock.module` is process-wide, so every export the real module has must be here.
mock.module("@superset/db/client", () => ({
	db: {
		query: { cloudWorkspaces: { findFirst: () => Promise.resolve(row) } },
	},
	dbWs: {
		transaction: () => Promise.reject(new Error("dbWs is stubbed in tests")),
	},
}));
mock.module("../../lib/sandbox", () => ({
	stopSandbox: (id: string) => {
		sandboxCalls.push(`stop:${id}`);
		return Promise.resolve();
	},
	deleteSandbox: (id: string) => {
		sandboxCalls.push(`delete:${id}`);
		return Promise.resolve();
	},
}));
mock.module("./jobs", () => ({
	publishCloudWorkspaceJob: (job: { body: unknown; delaySeconds?: number }) => {
		queued.push({ body: job.body, delaySeconds: job.delaySeconds });
		return Promise.resolve();
	},
}));

const {
	ARCHIVE_GRACE_SECONDS,
	ARCHIVE_STOP_DELAY_SECONDS,
	queueReap,
	reapArchivedCloudWorkspace,
} = await import("./reap");

const archivedAt = new Date("2026-10-01T00:00:00.000Z");
const input = {
	cloudWorkspaceId: "00000000-0000-0000-0000-000000000001",
	archivedAt: archivedAt.toISOString(),
};

describe("archive reap", () => {
	beforeEach(() => {
		row = {
			status: "deleted",
			deletedAt: archivedAt,
			provider: "vercel",
			providerSandboxId: "ws-box",
		};
		sandboxCalls = [];
		queued = [];
	});

	test("an archive queues the stop after a short delay and the delete after the grace period", async () => {
		await queueReap(input);
		expect(queued).toEqual([
			{
				body: { ...input, stage: "stop" },
				delaySeconds: ARCHIVE_STOP_DELAY_SECONDS,
			},
			{
				body: { ...input, stage: "delete" },
				delaySeconds: ARCHIVE_GRACE_SECONDS,
			},
		]);
	});

	test("the stop stage only stops the box", async () => {
		expect(await reapArchivedCloudWorkspace({ ...input, stage: "stop" })).toBe(
			"stopped",
		);
		expect(sandboxCalls).toEqual(["stop:ws-box"]);
		expect(queued).toEqual([]);
	});

	test("the delete stage deletes the box", async () => {
		expect(
			await reapArchivedCloudWorkspace({ ...input, stage: "delete" }),
		).toBe("reaped");
		expect(sandboxCalls).toEqual(["delete:ws-box"]);
		expect(queued).toEqual([]);
	});

	test("an unarchive before the stop keeps the box running", async () => {
		row = { ...(row as Row), status: "ready", deletedAt: null };
		expect(await reapArchivedCloudWorkspace({ ...input, stage: "stop" })).toBe(
			"skipped",
		);
		expect(sandboxCalls).toEqual([]);
		expect(queued).toEqual([]);
	});

	test("a later archive owns the box, not this one", async () => {
		row = { ...(row as Row), deletedAt: new Date("2026-10-02T00:00:00.000Z") };
		expect(await reapArchivedCloudWorkspace({ ...input, stage: "stop" })).toBe(
			"skipped",
		);
		expect(sandboxCalls).toEqual([]);
	});
});
