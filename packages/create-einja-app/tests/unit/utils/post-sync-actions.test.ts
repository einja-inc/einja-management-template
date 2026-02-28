import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPostSyncActions } from "@/utils/post-sync-actions.js";
import type { SyncCategory, SyncResult } from "@/types/index.js";

// モック対象モジュール
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  chmodSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("@/utils/logger.js", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

// モックをインポート
import { execSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import inquirer from "inquirer";
import * as logger from "@/utils/logger.js";

describe("runPostSyncActions", () => {
  const targetDir = "/test/target/dir";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("direnv allow アクション", () => {
    it("envカテゴリで.envrcがcopiedの場合、direnv allowの確認プロンプトが表示される", async () => {
      // Given: envカテゴリが選択され、.envrcがcopiedされた
      const syncedCategories: SyncCategory[] = ["env"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "copied",
          },
        ],
      };

      // Given: direnvが利用可能
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(""));

      // Given: ユーザーがdirenv allowを実行すると選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({ shouldAllow: true });

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: direnvの利用可能性チェックが呼ばれる
      expect(execSync).toHaveBeenCalledWith("which direnv", { stdio: "ignore" });

      // Then: プロンプトが表示される
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: "confirm",
          name: "shouldAllow",
          message: "direnv allow を実行しますか？（環境変数を有効化します）",
          default: true,
        },
      ]);

      // Then: direnv allowが実行される
      expect(execSync).toHaveBeenCalledWith("direnv allow", {
        cwd: targetDir,
        stdio: "inherit",
      });

      // Then: 成功メッセージが表示される
      expect(logger.success).toHaveBeenCalledWith("direnv allow を実行しました");
    });

    it("envカテゴリで.envrcがmergedの場合、direnv allowの確認プロンプトが表示される", async () => {
      // Given: envカテゴリが選択され、.envrcがmergedされた
      const syncedCategories: SyncCategory[] = ["env"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "merged",
          },
        ],
      };

      // Given: direnvが利用可能
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(""));

      // Given: ユーザーがdirenv allowをスキップすると選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({ shouldAllow: false });

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: プロンプトが表示される
      expect(inquirer.prompt).toHaveBeenCalled();

      // Then: direnv allowがスキップされる
      expect(execSync).toHaveBeenCalledTimes(1); // which direnvのみ
      expect(logger.info).toHaveBeenCalledWith("direnv allow をスキップしました");
    });

    it(".envrcがskippedの場合、direnvアクションは実行されない", async () => {
      // Given: envカテゴリが選択され、.envrcがskippedされた
      const syncedCategories: SyncCategory[] = ["env"];
      const syncResult: SyncResult = {
        success: 0,
        skipped: 1,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "skipped",
          },
        ],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: direnvアクションは実行されない
      expect(execSync).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it("envカテゴリが選択されていない場合、direnvアクションは実行されない", async () => {
      // Given: envカテゴリが選択されていない
      const syncedCategories: SyncCategory[] = ["tools"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "copied",
          },
        ],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: direnvアクションは実行されない
      expect(execSync).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it("direnvコマンドが利用不可の場合、プロンプトは表示されない", async () => {
      // Given: envカテゴリが選択され、.envrcがcopiedされた
      const syncedCategories: SyncCategory[] = ["env"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "copied",
          },
        ],
      };

      // Given: direnvが利用不可
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("direnv not found");
      });

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: direnvの利用可能性チェックが呼ばれる
      expect(execSync).toHaveBeenCalledWith("which direnv", { stdio: "ignore" });

      // Then: プロンプトは表示されない
      expect(inquirer.prompt).not.toHaveBeenCalled();

      // Then: 情報メッセージが表示される
      expect(logger.info).toHaveBeenCalledWith("direnvコマンドが見つかりません。スキップします。");
    });
  });

  describe("husky chmod アクション", () => {
    it("git-hooksカテゴリで.husky/pre-commitがcopiedの場合、chmodが実行される", async () => {
      // Given: git-hooksカテゴリが選択され、.husky/pre-commitがcopiedされた
      const syncedCategories: SyncCategory[] = ["git-hooks"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".husky/pre-commit",
            action: "copied",
          },
        ],
      };

      // Given: .husky/pre-commitが存在する
      vi.mocked(existsSync).mockReturnValueOnce(true);

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: chmodが実行される
      expect(chmodSync).toHaveBeenCalledWith(`${targetDir}/.husky/pre-commit`, 0o755);

      // Then: 成功メッセージが表示される
      expect(logger.success).toHaveBeenCalledWith(".husky/pre-commit に実行権限を設定しました");
    });

    it("git-hooksカテゴリで.husky/pre-commitがmergedの場合、chmodが実行される", async () => {
      // Given: git-hooksカテゴリが選択され、.husky/pre-commitがmergedされた
      const syncedCategories: SyncCategory[] = ["git-hooks"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".husky/pre-commit",
            action: "merged",
          },
        ],
      };

      // Given: .husky/pre-commitが存在する
      vi.mocked(existsSync).mockReturnValueOnce(true);

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: chmodが実行される
      expect(chmodSync).toHaveBeenCalledWith(`${targetDir}/.husky/pre-commit`, 0o755);
    });

    it(".husky/pre-commitがskippedの場合、chmodは実行されない", async () => {
      // Given: git-hooksカテゴリが選択され、.husky/pre-commitがskippedされた
      const syncedCategories: SyncCategory[] = ["git-hooks"];
      const syncResult: SyncResult = {
        success: 0,
        skipped: 1,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".husky/pre-commit",
            action: "skipped",
          },
        ],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: chmodは実行されない
      expect(existsSync).not.toHaveBeenCalled();
      expect(chmodSync).not.toHaveBeenCalled();
    });

    it("git-hooksカテゴリが選択されていない場合、chmodは実行されない", async () => {
      // Given: git-hooksカテゴリが選択されていない
      const syncedCategories: SyncCategory[] = ["env"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".husky/pre-commit",
            action: "copied",
          },
        ],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: chmodは実行されない
      expect(existsSync).not.toHaveBeenCalled();
      expect(chmodSync).not.toHaveBeenCalled();
    });

    it(".husky/pre-commitファイルが存在しない場合、chmodは実行されない", async () => {
      // Given: git-hooksカテゴリが選択され、.husky/pre-commitがcopiedされた
      const syncedCategories: SyncCategory[] = ["git-hooks"];
      const syncResult: SyncResult = {
        success: 1,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".husky/pre-commit",
            action: "copied",
          },
        ],
      };

      // Given: .husky/pre-commitが存在しない
      vi.mocked(existsSync).mockReturnValueOnce(false);

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: 警告メッセージが表示される
      expect(logger.warn).toHaveBeenCalledWith(
        `.husky/pre-commit が見つかりません: ${targetDir}/.husky/pre-commit`
      );

      // Then: chmodは実行されない
      expect(chmodSync).not.toHaveBeenCalled();
    });
  });

  describe("複合アクション", () => {
    it("両方のカテゴリが選択された場合、両方のアクションが実行される", async () => {
      // Given: envとgit-hooksカテゴリが選択され、対応ファイルがcopiedされた
      const syncedCategories: SyncCategory[] = ["env", "git-hooks"];
      const syncResult: SyncResult = {
        success: 2,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "copied",
          },
          {
            path: ".husky/pre-commit",
            action: "copied",
          },
        ],
      };

      // Given: direnvが利用可能
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(""));

      // Given: ユーザーがdirenv allowを実行すると選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({ shouldAllow: true });

      // Given: .husky/pre-commitが存在する
      vi.mocked(existsSync).mockReturnValueOnce(true);

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: direnvアクションが実行される
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(execSync).toHaveBeenCalledWith("direnv allow", {
        cwd: targetDir,
        stdio: "inherit",
      });

      // Then: chmodアクションが実行される
      expect(chmodSync).toHaveBeenCalledWith(`${targetDir}/.husky/pre-commit`, 0o755);
    });

    it("アクションが不要な場合、何も実行されない", async () => {
      // Given: カテゴリが選択されているが、対象ファイルがskippedされた
      const syncedCategories: SyncCategory[] = ["env", "git-hooks"];
      const syncResult: SyncResult = {
        success: 0,
        skipped: 2,
        errors: 0,
        conflicts: 0,
        files: [
          {
            path: ".envrc",
            action: "skipped",
          },
          {
            path: ".husky/pre-commit",
            action: "skipped",
          },
        ],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: 何も実行されない
      expect(execSync).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(existsSync).not.toHaveBeenCalled();
      expect(chmodSync).not.toHaveBeenCalled();
    });

    it("空のカテゴリと空の同期結果の場合、何も実行されない", async () => {
      // Given: カテゴリが選択されていない
      const syncedCategories: SyncCategory[] = [];
      const syncResult: SyncResult = {
        success: 0,
        skipped: 0,
        errors: 0,
        conflicts: 0,
        files: [],
      };

      // When: ポストアクション実行
      await runPostSyncActions(targetDir, syncedCategories, syncResult);

      // Then: 何も実行されない
      expect(execSync).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(existsSync).not.toHaveBeenCalled();
      expect(chmodSync).not.toHaveBeenCalled();
    });
  });
});
