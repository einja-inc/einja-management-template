// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
	execSync: execSyncMock,
}));

import {
	copyEnvKeysFromMainWorktree,
	ensureFileFromMainWorktree,
	getEnvPersonalCandidatePaths,
} from "./worktree-utils";

describe("worktree-utils", () => {
	let tempRoot: string;
	let mainWorktreePath: string;
	let taskWorktreePath: string;

	beforeEach(() => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-utils-"));
		mainWorktreePath = path.join(tempRoot, "main");
		taskWorktreePath = path.join(tempRoot, "task");
		fs.mkdirSync(mainWorktreePath, { recursive: true });
		fs.mkdirSync(taskWorktreePath, { recursive: true });

		execSyncMock.mockReturnValue(
			[
				`worktree ${mainWorktreePath}`,
				"HEAD 1234567890",
				"branch refs/heads/main",
				"",
				`worktree ${taskWorktreePath}`,
				"HEAD abcdef1234",
				"branch refs/heads/task/test",
				"",
			].join("\n"),
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
		fs.rmSync(tempRoot, { recursive: true, force: true });
	});

	it("共有 .env.personal と worktree ローカル .env.personal を優先順で返す", () => {
		fs.writeFileSync(
			path.join(mainWorktreePath, ".env.personal"),
			"GITHUB_TOKEN=shared\n",
			"utf-8",
		);
		fs.writeFileSync(
			path.join(taskWorktreePath, ".env.personal"),
			"GITHUB_TOKEN=local\n",
			"utf-8",
		);

		expect(getEnvPersonalCandidatePaths(taskWorktreePath)).toEqual([
			path.join(mainWorktreePath, ".env.personal"),
			path.join(taskWorktreePath, ".env.personal"),
		]);
	});

	it("メインworktreeから .env.keys をコピーする", () => {
		const targetPath = path.join(taskWorktreePath, ".env.keys");
		fs.writeFileSync(
			path.join(mainWorktreePath, ".env.keys"),
			"DOTENV_PRIVATE_KEY_LOCAL=test-key\n",
			"utf-8",
		);

		expect(copyEnvKeysFromMainWorktree(targetPath, taskWorktreePath)).toBe(true);
		expect(fs.readFileSync(targetPath, "utf-8")).toContain(
			"DOTENV_PRIVATE_KEY_LOCAL=test-key",
		);
	});

	it("メインworktreeから .env.local をコピーする", () => {
		const targetPath = path.join(taskWorktreePath, ".env.local");
		fs.writeFileSync(
			path.join(mainWorktreePath, ".env.local"),
			"AUTH_SECRET=shared-secret\n",
			"utf-8",
		);

		expect(ensureFileFromMainWorktree(".env.local", targetPath, taskWorktreePath)).toEqual({
			sourcePath: path.join(mainWorktreePath, ".env.local"),
			status: "copied",
			targetPath,
		});
		expect(fs.readFileSync(targetPath, "utf-8")).toContain("AUTH_SECRET=shared-secret");
	});

	it("現在worktreeに既存ファイルがある場合は上書きしない", () => {
		const targetPath = path.join(taskWorktreePath, ".env.local");
		fs.writeFileSync(targetPath, "AUTH_SECRET=current-secret\n", "utf-8");
		fs.writeFileSync(
			path.join(mainWorktreePath, ".env.local"),
			"AUTH_SECRET=shared-secret\n",
			"utf-8",
		);

		expect(ensureFileFromMainWorktree(".env.local", targetPath, taskWorktreePath)).toEqual({
			sourcePath: null,
			status: "already_exists",
			targetPath,
		});
		expect(fs.readFileSync(targetPath, "utf-8")).toContain("AUTH_SECRET=current-secret");
	});

	it("非worktreeではコピーを試みない", () => {
		execSyncMock.mockReturnValue(
			[`worktree ${taskWorktreePath}`, "HEAD abcdef1234", "branch refs/heads/main", ""].join(
				"\n",
			),
		);
		const targetPath = path.join(taskWorktreePath, ".env.local");

		expect(ensureFileFromMainWorktree(".env.local", targetPath, taskWorktreePath)).toEqual({
			sourcePath: null,
			status: "not_worktree",
			targetPath,
		});
	});
});
