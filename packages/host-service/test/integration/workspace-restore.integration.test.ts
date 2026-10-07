import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { workspaces } from "../../src/db/schema";
import { cloudFlows } from "../helpers/cloud-fakes";
import {
	createFeatureWorktreeScenario,
	type FeatureWorktreeScenario,
} from "../helpers/scenarios";

describe("workspaces.restore integration", () => {
	let scenario: FeatureWorktreeScenario;

	beforeEach(async () => {
		scenario = await createFeatureWorktreeScenario({
			hostOptions: { apiOverrides: cloudFlows.workspaceDeleteOk() },
		});
	});

	afterEach(async () => {
		await scenario.dispose();
	});

	function archivedAt(): number | null | undefined {
		return scenario.host.db
			.select({ archivedAt: workspaces.archivedAt })
			.from(workspaces)
			.where(eq(workspaces.id, scenario.featureWorkspaceId))
			.get()?.archivedAt;
	}

	test("re-creates the worktree on the kept branch and un-archives the row", async () => {
		writeFileSync(join(scenario.worktreePath, "work.txt"), "committed work");
		execSync("git add work.txt && git commit -m work", {
			cwd: scenario.worktreePath,
			stdio: "ignore",
		});
		await scenario.host.trpc.workspaceCleanup.destroy.mutate({
			workspaceId: scenario.featureWorkspaceId,
		});
		expect(existsSync(scenario.worktreePath)).toBe(false);
		expect(archivedAt()).toBeTruthy();

		const { workspace } = await scenario.host.trpc.workspaces.restore.mutate({
			workspaceId: scenario.featureWorkspaceId,
		});

		expect(workspace.id).toBe(scenario.featureWorkspaceId);
		expect(archivedAt()).toBeNull();
		expect(existsSync(join(scenario.worktreePath, "work.txt"))).toBe(true);
	});

	test("keeps the row archived when the branch is gone and no PR is linked", async () => {
		await scenario.host.trpc.workspaceCleanup.destroy.mutate({
			workspaceId: scenario.featureWorkspaceId,
			deleteBranch: true,
		});

		const error = await scenario.host.trpc.workspaces.restore
			.mutate({ workspaceId: scenario.featureWorkspaceId })
			.catch((err: unknown) => err);
		expect(error).toMatchObject({
			data: {
				i18nKey: "serverError.workspaces.restoreBranchMissing",
				i18nParams: { branch: scenario.branch, remote: "origin" },
			},
		});
		expect(archivedAt()).toBeTruthy();
		expect(existsSync(scenario.worktreePath)).toBe(false);
	});

	test("fetches a branch that is only on the remote", async () => {
		const remotePath = mkdtempSync(join(tmpdir(), "restore-remote-"));
		try {
			execSync(`git init --bare --quiet ${remotePath}`);
			writeFileSync(join(scenario.worktreePath, "work.txt"), "pushed work");
			execSync(
				`git add work.txt && git commit -m work && git remote add origin ${remotePath} && git push --quiet origin HEAD && git update-ref -d refs/remotes/origin/${scenario.branch}`,
				{ cwd: scenario.worktreePath, stdio: "ignore" },
			);
			await scenario.host.trpc.workspaceCleanup.destroy.mutate({
				workspaceId: scenario.featureWorkspaceId,
				deleteBranch: true,
			});

			await scenario.host.trpc.workspaces.restore.mutate({
				workspaceId: scenario.featureWorkspaceId,
			});

			expect(archivedAt()).toBeNull();
			expect(existsSync(join(scenario.worktreePath, "work.txt"))).toBe(true);
		} finally {
			rmSync(remotePath, { recursive: true, force: true });
		}
	});
});
