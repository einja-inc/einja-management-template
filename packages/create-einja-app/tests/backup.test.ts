import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanOldBackups,
  createBackup,
  getLatestBackup,
  listBackups,
  restoreFromBackup,
} from "../src/utils/backup.js";

const testDir = join(__dirname, "test-backup-dir");

describe("backup utilities", () => {
  beforeEach(() => {
    // テスト用ディレクトリを作成
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // テスト用ディレクトリを削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("createBackup", () => {
    it("指定されたファイルをバックアップディレクトリにコピーできる", async () => {
      // Given: テストファイルを作成
      const testFile = "test.txt";
      const testFilePath = join(testDir, testFile);
      writeFileSync(testFilePath, "test content");

      // When: バックアップを作成
      const backupDir = await createBackup(testDir, [testFile]);

      // Then: バックアップディレクトリが作成される
      expect(existsSync(backupDir)).toBe(true);

      // Then: バックアップディレクトリにファイルがコピーされる
      const backupFilePath = join(backupDir, testFile);
      expect(existsSync(backupFilePath)).toBe(true);
    });

    it("ディレクトリ構造を保持してバックアップできる", async () => {
      // Given: サブディレクトリにファイルを作成
      const subDir = "sub";
      const testFile = join(subDir, "test.txt");
      const testFilePath = join(testDir, testFile);
      mkdirSync(join(testDir, subDir), { recursive: true });
      writeFileSync(testFilePath, "test content");

      // When: バックアップを作成
      const backupDir = await createBackup(testDir, [testFile]);

      // Then: サブディレクトリ構造が保持される
      const backupFilePath = join(backupDir, testFile);
      expect(existsSync(backupFilePath)).toBe(true);
    });

    it("存在しないファイルはスキップされる", async () => {
      // Given: 存在しないファイル名を指定
      const nonExistentFile = "non-existent.txt";

      // When: バックアップを作成
      const backupDir = await createBackup(testDir, [nonExistentFile]);

      // Then: バックアップディレクトリは作成されるが、ファイルは存在しない
      expect(existsSync(backupDir)).toBe(true);
      expect(existsSync(join(backupDir, nonExistentFile))).toBe(false);
    });
  });

  describe("restoreFromBackup", () => {
    it("バックアップからファイルを復元できる", async () => {
      // Given: バックアップを作成
      const testFile = "test.txt";
      const testFilePath = join(testDir, testFile);
      writeFileSync(testFilePath, "original content");
      const backupDir = await createBackup(testDir, [testFile]);

      // When: オリジナルファイルを変更
      writeFileSync(testFilePath, "modified content");

      // When: バックアップから復元
      const result = await restoreFromBackup(backupDir, testDir);

      // Then: 復元が成功する
      expect(result).toBe(true);

      // Then: オリジナルの内容に戻る
      const restoredContent = require("node:fs").readFileSync(testFilePath, "utf-8");
      expect(restoredContent).toBe("original content");
    });

    it("存在しないバックアップディレクトリの場合はfalseが返る", async () => {
      // Given: 存在しないバックアップディレクトリ
      const nonExistentBackupDir = join(testDir, ".einja-sync-backup-2000-01-01_00-00-00");

      // When: 復元を試みる
      const result = await restoreFromBackup(nonExistentBackupDir, testDir);

      // Then: falseが返る
      expect(result).toBe(false);
    });
  });

  describe("listBackups", () => {
    it("バックアップディレクトリの一覧を取得できる", async () => {
      // Given: 複数のバックアップを作成
      const testFile = "test.txt";
      writeFileSync(join(testDir, testFile), "content");
      await createBackup(testDir, [testFile]);
      await new Promise((resolve) => setTimeout(resolve, 1100)); // タイムスタンプを変えるため待機（秒単位なので1秒以上必要）
      await createBackup(testDir, [testFile]);

      // When: バックアップ一覧を取得
      const backups = await listBackups(testDir);

      // Then: 2つのバックアップが取得される
      expect(backups).toHaveLength(2);

      // Then: 新しい順にソートされている
      expect(backups[0]?.timestamp.getTime()).toBeGreaterThan(backups[1]?.timestamp.getTime() ?? 0);
    });

    it("バックアップが存在しない場合は空の配列が返る", async () => {
      // When: バックアップ一覧を取得
      const backups = await listBackups(testDir);

      // Then: 空の配列が返る
      expect(backups).toEqual([]);
    });
  });

  describe("getLatestBackup", () => {
    it("最新のバックアップを取得できる", async () => {
      // Given: 複数のバックアップを作成
      const testFile = "test.txt";
      writeFileSync(join(testDir, testFile), "content");
      await createBackup(testDir, [testFile]);
      await new Promise((resolve) => setTimeout(resolve, 1100)); // タイムスタンプを変えるため待機（秒単位なので1秒以上必要）
      const latestBackupDir = await createBackup(testDir, [testFile]);

      // When: 最新のバックアップを取得
      const latestBackup = await getLatestBackup(testDir);

      // Then: 最新のバックアップが返る
      expect(latestBackup).not.toBeNull();
      expect(latestBackup?.path).toBe(latestBackupDir);
    });

    it("バックアップが存在しない場合はnullが返る", async () => {
      // When: 最新のバックアップを取得
      const latestBackup = await getLatestBackup(testDir);

      // Then: nullが返る
      expect(latestBackup).toBeNull();
    });
  });

  describe("cleanOldBackups", () => {
    it("古いバックアップを削除できる", async () => {
      // Given: 古いバックアップを作成（手動でディレクトリ名を設定）
      const oldBackupDir = join(testDir, ".einja-sync-backup-2020-01-01_00-00-00");
      mkdirSync(oldBackupDir);

      // Given: 新しいバックアップを作成
      const testFile = "test.txt";
      writeFileSync(join(testDir, testFile), "content");
      await createBackup(testDir, [testFile]);

      // When: 古いバックアップを削除（保持期間7日）
      const deletedCount = await cleanOldBackups(testDir, 7);

      // Then: 1つのバックアップが削除される
      expect(deletedCount).toBe(1);

      // Then: 古いバックアップは削除される
      expect(existsSync(oldBackupDir)).toBe(false);

      // Then: 新しいバックアップは残る
      const remainingBackups = await listBackups(testDir);
      expect(remainingBackups).toHaveLength(1);
    });

    it("保持期間内のバックアップは削除されない", async () => {
      // Given: 新しいバックアップを作成
      const testFile = "test.txt";
      writeFileSync(join(testDir, testFile), "content");
      await createBackup(testDir, [testFile]);

      // When: 古いバックアップを削除（保持期間7日）
      const deletedCount = await cleanOldBackups(testDir, 7);

      // Then: 削除されない
      expect(deletedCount).toBe(0);

      // Then: バックアップは残る
      const backups = await listBackups(testDir);
      expect(backups).toHaveLength(1);
    });
  });
});
