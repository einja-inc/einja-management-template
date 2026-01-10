import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupHusky } from "../../../../src/generators/tools/husky.js";

describe("husky generator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "husky-test-"));
    const initialPackageJson = {
      name: "test-project",
      version: "1.0.0",
    };
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify(initialPackageJson, null, 2),
      "utf-8"
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("setupHusky", () => {
    it(".huskyディレクトリが生成される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupHusky実行
      setupHusky(options);

      // Then: .huskyディレクトリが作成される
      const huskyDir = join(testDir, ".husky");
      expect(existsSync(huskyDir)).toBe(true);
    });

    it("pre-commitフックが設定される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupHusky実行
      setupHusky(options);

      // Then: pre-commitフックファイルが作成される
      const preCommitPath = join(testDir, ".husky", "pre-commit");
      expect(existsSync(preCommitPath)).toBe(true);

      const content = readFileSync(preCommitPath, "utf-8");
      expect(content).toContain("pnpm lint-staged");
    });

    it("lint-staged設定が追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupHusky実行
      setupHusky(options);

      // Then: package.jsonにlint-staged設定が追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson["lint-staged"]).toBeDefined();
      expect(packageJson["lint-staged"]["*.{js,jsx,ts,tsx}"]).toBeDefined();
    });

    it("package.jsonにhusky, lint-stagedが開発依存関係として追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupHusky実行
      setupHusky(options);

      // Then: devDependenciesにhusky, lint-stagedが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies.husky).toBe("^9.1.7");
      expect(packageJson.devDependencies["lint-staged"]).toBe("^15.2.11");
    });

    it("prepareスクリプトが追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupHusky実行
      setupHusky(options);

      // Then: prepareスクリプトが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.prepare).toBe("husky");
    });
  });
});
