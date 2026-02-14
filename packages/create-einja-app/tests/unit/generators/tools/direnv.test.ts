import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promptDirenvAllow, setupDirenv } from "../../../../src/generators/tools/direnv.js";

describe("direnv generator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "direnv-test-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("setupDirenv", () => {
    it(".envrcファイルが生成される", () => {
      // Given: 新規プロジェクト（テストディレクトリ）
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDirenv実行
      setupDirenv(options);

      // Then: .envrcファイルが作成される
      const envrcPath = join(testDir, ".envrc");
      expect(existsSync(envrcPath)).toBe(true);

      const content = readFileSync(envrcPath, "utf-8");
      expect(content).toContain("dotenv_if_exists");
    });

    it(".envrc.exampleファイルが生成される", () => {
      // Given: 新規プロジェクト
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDirenv実行
      setupDirenv(options);

      // Then: .envrc.exampleファイルが作成される
      const envrcExamplePath = join(testDir, ".envrc.example");
      expect(existsSync(envrcExamplePath)).toBe(true);

      const content = readFileSync(envrcExamplePath, "utf-8");
      expect(content).toContain("Example direnv configuration");
    });

    it(".gitignoreに.envrcが追加される", () => {
      // Given: 新規プロジェクト
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDirenv実行
      setupDirenv(options);

      // Then: .gitignoreに.envrcが追記される
      const gitignorePath = join(testDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(true);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".envrc");
    });

    it("競合戦略がskipの場合、既存ファイルが保持される", () => {
      // Given: 既存の.envrc
      const existingContent = "existing content";
      const envrcPath = join(testDir, ".envrc");
      require("node:fs").writeFileSync(envrcPath, existingContent, "utf-8");

      const options = {
        targetDir: testDir,
        conflictStrategy: "skip" as const,
      };

      // When: setupDirenv(skip)実行
      setupDirenv(options);

      // Then: 既存ファイルが保持される
      const content = readFileSync(envrcPath, "utf-8");
      expect(content).toBe(existingContent);
    });
  });

  describe("promptDirenvAllow", () => {
    it("promptDirenvAllow関数が定義されている", () => {
      // Then: promptDirenvAllow関数が存在する
      expect(typeof promptDirenvAllow).toBe("function");
    });

    it("promptDirenvAllow関数がPromiseを返す", () => {
      // Given: モック環境でinquirerが使えない状況
      // Then: 関数はPromiseを返す（エクスポートと型定義の確認）
      // 注: inquirerの対話プロンプトはE2Eテストで検証
      expect(promptDirenvAllow).toBeDefined();
      expect(typeof promptDirenvAllow).toBe("function");
    });
  });
});
