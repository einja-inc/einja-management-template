import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupVolta } from "../../../../src/generators/tools/volta.js";

describe("volta generator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "volta-test-"));
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

  describe("setupVolta", () => {
    it("package.jsonにvoltaフィールドが追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupVolta実行
      setupVolta(options);

      // Then: package.jsonにvoltaフィールドが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.volta).toBeDefined();
      expect(packageJson.volta.node).toBe("22.16.0");
      expect(packageJson.volta.pnpm).toBe("9.15.0");
    });

    it(".node-versionファイルが生成される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupVolta実行
      setupVolta(options);

      // Then: .node-versionファイルが作成される
      const nodeVersionPath = join(testDir, ".node-version");
      expect(existsSync(nodeVersionPath)).toBe(true);

      const content = readFileSync(nodeVersionPath, "utf-8");
      expect(content.trim()).toBe("22.16.0");
    });
  });
});
