// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execSyncMock } = vi.hoisted(() => ({
	execSyncMock: vi.fn((command: string) => {
		if (command === "git rev-parse --git-common-dir") {
			return ".git\n";
		}
		if (command === "git rev-parse --abbrev-ref HEAD") {
			return "feature/runtime-metadata\n";
		}
		return "";
	}),
}));

vi.mock("node:child_process", () => ({
	execSync: execSyncMock,
	spawn: vi.fn(),
	spawnSync: vi.fn(),
}));

import {
	createRuntimeMetadata,
	getRuntimeMetadataFileName,
	readRuntimeMetadata,
	readRuntimeMetadataRecords,
	removeRuntimeMetadata,
	writeRuntimeMetadata,
} from "./dev";

describe("worktree dev runtime metadata", () => {
	let originalCwd: string;
	let tempRoot: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-dev-"));
		fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
		process.chdir(tempRoot);
		execSyncMock.mockClear();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempRoot, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("同一worktreeの複数セッションを書き込むと、metadataを複数保持する", () => {
		// Given: 同一worktreeで開始時刻が異なる2つのセッションmetadata
		const firstMetadata = {
			...createRuntimeMetadata("feature/runtime-metadata", { web: 3101 }, "feature_runtime", "log/dev.log", 1111, tempRoot),
			startedAt: "2026-03-18T10:00:00.000Z",
		};
		const secondMetadata = {
			...createRuntimeMetadata("feature/runtime-metadata", { web: 3102, admin: 4102 }, "feature_runtime", "log/dev.log", 2222, tempRoot),
			startedAt: "2026-03-18T10:05:00.000Z",
		};

		// When: 両方のmetadataを書き込む
		writeRuntimeMetadata(firstMetadata);
		writeRuntimeMetadata(secondMetadata);

		// Then: metadataが上書きされずに2件保持され、最新セッションが優先される
		const records = readRuntimeMetadataRecords(tempRoot);
		expect(records).toHaveLength(2);
		expect(new Set(records.map((record) => path.basename(record.metadataPath))).size).toBe(2);
		expect(path.basename(records[0].metadataPath)).toBe(
			getRuntimeMetadataFileName(tempRoot, secondMetadata.startedAt, secondMetadata.rootPid),
		);
		expect(readRuntimeMetadata(tempRoot)?.rootPid).toBe(secondMetadata.rootPid);
	});

	it("removeRuntimeMetadataを呼ぶと、同一worktreeの複数metadataがまとめて削除される", () => {
		// Given: 同一worktreeに複数のmetadataが存在する
		writeRuntimeMetadata({
			...createRuntimeMetadata("feature/runtime-metadata", { web: 3201 }, "feature_runtime", "log/dev.log", 3333, tempRoot),
			startedAt: "2026-03-18T11:00:00.000Z",
		});
		writeRuntimeMetadata({
			...createRuntimeMetadata("feature/runtime-metadata", { web: 3202 }, "feature_runtime", "log/dev.log", 4444, tempRoot),
			startedAt: "2026-03-18T11:05:00.000Z",
		});

		// When: worktree単位でmetadataを削除する
		removeRuntimeMetadata(tempRoot);

		// Then: 追跡対象のmetadataがすべて消える
		expect(readRuntimeMetadataRecords(tempRoot)).toEqual([]);
		expect(readRuntimeMetadata(tempRoot)).toBeNull();
	});
});
