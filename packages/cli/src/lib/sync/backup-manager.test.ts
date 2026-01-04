import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { BackupManager } from "./backup-manager.js";

describe("BackupManager", () => {
	let tempDir: string;
	let manager: BackupManager;

	beforeEach(async () => {
		// テスト用一時ディレクトリを作成
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "backup-test-"));
		manager = new BackupManager(tempDir);
	});

	describe("backupFile", () => {
		it("ファイルをバックアップディレクトリにコピーする", async () => {
			const testFile = "test.txt";
			const testContent = "Test content";
			const testFilePath = path.join(tempDir, testFile);

			// テストファイルを作成
			await fs.writeFile(testFilePath, testContent, "utf-8");

			// バックアップを実行
			const backupPath = await manager.backupFile(testFile);

			// バックアップファイルが存在することを確認
			expect(await fs.pathExists(backupPath)).toBe(true);

			// バックアップの内容が元のファイルと一致することを確認
			const backupContent = await fs.readFile(backupPath, "utf-8");
			expect(backupContent).toBe(testContent);
		});

		it("存在しないファイルをバックアップしようとした場合、エラーをスローする", async () => {
			await expect(manager.backupFile("nonexistent.txt")).rejects.toThrow(
				"バックアップ対象ファイルが存在しません",
			);
		});
	});

	describe("backupFiles", () => {
		it("複数のファイルをバックアップする", async () => {
			const files = ["file1.txt", "file2.txt"];
			const content1 = "Content 1";
			const content2 = "Content 2";

			// テストファイルを作成
			await fs.writeFile(path.join(tempDir, files[0]), content1, "utf-8");
			await fs.writeFile(path.join(tempDir, files[1]), content2, "utf-8");

			// バックアップを実行
			const backupMap = await manager.backupFiles(files);

			// 2つのファイルがバックアップされたことを確認
			expect(backupMap.size).toBe(2);
			expect(backupMap.has(files[0])).toBe(true);
			expect(backupMap.has(files[1])).toBe(true);

			// バックアップファイルの内容を確認
			const backup1Content = await fs.readFile(
				backupMap.get(files[0]) as string,
				"utf-8",
			);
			const backup2Content = await fs.readFile(
				backupMap.get(files[1]) as string,
				"utf-8",
			);
			expect(backup1Content).toBe(content1);
			expect(backup2Content).toBe(content2);
		});

		it("存在しないファイルはスキップする", async () => {
			const files = ["exists.txt", "nonexistent.txt"];
			await fs.writeFile(path.join(tempDir, files[0]), "Content", "utf-8");

			// バックアップを実行（エラーにならず、存在するファイルのみバックアップ）
			const backupMap = await manager.backupFiles(files);

			expect(backupMap.size).toBe(1);
			expect(backupMap.has(files[0])).toBe(true);
			expect(backupMap.has(files[1])).toBe(false);
		});
	});

	describe("restoreFile", () => {
		it("バックアップファイルをリストアする", async () => {
			const originalFile = "test.txt";
			const originalContent = "Original content";
			const originalPath = path.join(tempDir, originalFile);

			// 元のファイルを作成してバックアップ
			await fs.writeFile(originalPath, originalContent, "utf-8");
			const backupPath = await manager.backupFile(originalFile);

			// 元のファイルを変更
			await fs.writeFile(originalPath, "Modified content", "utf-8");

			// リストアを実行
			await manager.restoreFile(backupPath, originalFile);

			// 元の内容に戻っていることを確認
			const restoredContent = await fs.readFile(originalPath, "utf-8");
			expect(restoredContent).toBe(originalContent);
		});

		it("バックアップファイルが存在しない場合、エラーをスローする", async () => {
			await expect(
				manager.restoreFile("/nonexistent/backup.txt", "test.txt"),
			).rejects.toThrow("バックアップファイルが存在しません");
		});
	});

	describe("restoreFiles", () => {
		it("複数のバックアップファイルをリストアする", async () => {
			const files = ["file1.txt", "file2.txt"];
			const originalContents = ["Content 1", "Content 2"];

			// 元のファイルを作成してバックアップ
			await fs.writeFile(
				path.join(tempDir, files[0]),
				originalContents[0],
				"utf-8",
			);
			await fs.writeFile(
				path.join(tempDir, files[1]),
				originalContents[1],
				"utf-8",
			);
			const backupMap = await manager.backupFiles(files);

			// 元のファイルを変更
			await fs.writeFile(path.join(tempDir, files[0]), "Modified 1", "utf-8");
			await fs.writeFile(path.join(tempDir, files[1]), "Modified 2", "utf-8");

			// リストアを実行
			await manager.restoreFiles(backupMap);

			// 両方のファイルが元の内容に戻っていることを確認
			const restored1 = await fs.readFile(
				path.join(tempDir, files[0]),
				"utf-8",
			);
			const restored2 = await fs.readFile(
				path.join(tempDir, files[1]),
				"utf-8",
			);
			expect(restored1).toBe(originalContents[0]);
			expect(restored2).toBe(originalContents[1]);
		});
	});

	describe("cleanupOldBackups", () => {
		it("古いバックアップファイルを削除する", async () => {
			const backupDir = manager.getBackupDir();
			await fs.ensureDir(backupDir);

			// 古いバックアップファイルを作成（8日前）
			const oldBackup = path.join(backupDir, "old-backup.txt");
			await fs.writeFile(oldBackup, "Old backup", "utf-8");
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 8);
			await fs.utimes(oldBackup, oldDate, oldDate);

			// 新しいバックアップファイルを作成（今日）
			const newBackup = path.join(backupDir, "new-backup.txt");
			await fs.writeFile(newBackup, "New backup", "utf-8");

			// クリーンアップを実行（7日より古いファイルを削除）
			const deletedCount = await manager.cleanupOldBackups(7);

			// 1ファイルが削除されたことを確認
			expect(deletedCount).toBe(1);

			// 古いファイルが削除され、新しいファイルは残っていることを確認
			expect(await fs.pathExists(oldBackup)).toBe(false);
			expect(await fs.pathExists(newBackup)).toBe(true);
		});

		it("バックアップディレクトリが存在しない場合、0を返す", async () => {
			const deletedCount = await manager.cleanupOldBackups(7);
			expect(deletedCount).toBe(0);
		});
	});

	describe("clearAllBackups", () => {
		it("すべてのバックアップファイルを削除する", async () => {
			const backupDir = manager.getBackupDir();

			// バックアップファイルを作成
			const testFile = "test.txt";
			await fs.writeFile(path.join(tempDir, testFile), "Content", "utf-8");
			await manager.backupFile(testFile);

			// バックアップディレクトリが存在することを確認
			expect(await fs.pathExists(backupDir)).toBe(true);

			// すべてのバックアップを削除
			await manager.clearAllBackups();

			// バックアップディレクトリが削除されたことを確認
			expect(await fs.pathExists(backupDir)).toBe(false);
		});

		it("バックアップディレクトリが存在しない場合、エラーにならない", async () => {
			// エラーなく実行できることを確認
			await expect(manager.clearAllBackups()).resolves.toBeUndefined();
		});
	});

	describe("getBackupDir", () => {
		it("バックアップディレクトリのパスを返す", () => {
			const backupDir = manager.getBackupDir();
			expect(backupDir).toBe(path.join(tempDir, ".einja-sync-backups"));
		});
	});
});
