import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupDotenvx } from "../../../../src/generators/tools/dotenvx.js";

describe("dotenvx generator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "dotenvx-test-"));
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

  describe("setupDotenvx", () => {
    it("package.jsonに依存関係が追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDotenvx実行
      setupDotenvx(options);

      // Then: package.jsonに@dotenvx/dotenvxが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies["@dotenvx/dotenvx"]).toBe("^1.29.0");
    });

    it("npm scriptsにdotenvxコマンドが追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDotenvx実行
      setupDotenvx(options);

      // Then: env:encrypt, env:decryptスクリプトが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts["env:encrypt"]).toBe("dotenvx encrypt");
      expect(packageJson.scripts["env:decrypt"]).toBe("dotenvx decrypt");
    });

    it(".env.exampleが生成される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupDotenvx実行
      setupDotenvx(options);

      // Then: .env.exampleファイルが作成される
      const envExamplePath = join(testDir, ".env.example");
      expect(existsSync(envExamplePath)).toBe(true);

      const content = readFileSync(envExamplePath, "utf-8");
      expect(content).toContain("DATABASE_URL");
      expect(content).toContain("NEXTAUTH_SECRET");
    });
  });
});
