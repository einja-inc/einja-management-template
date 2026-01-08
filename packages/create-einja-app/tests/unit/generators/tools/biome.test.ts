import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupBiome } from "../../../../src/generators/tools/biome.js";

describe("biome generator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "biome-test-"));
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

  describe("setupBiome", () => {
    it("biome.jsonが生成される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupBiome実行
      setupBiome(options);

      // Then: biome.jsonファイルが作成される
      const biomeConfigPath = join(testDir, "biome.json");
      expect(existsSync(biomeConfigPath)).toBe(true);

      const content = readFileSync(biomeConfigPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.formatter).toBeDefined();
      expect(config.linter).toBeDefined();
    });

    it("package.jsonにlint/formatスクリプトが追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupBiome実行
      setupBiome(options);

      // Then: lint/formatスクリプトが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.lint).toBe("biome lint .");
      expect(packageJson.scripts["lint:fix"]).toBe("biome lint --write .");
      expect(packageJson.scripts.format).toBe("biome format .");
      expect(packageJson.scripts["format:fix"]).toBe("biome format --write .");
    });

    it("VSCode設定が追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupBiome実行
      setupBiome(options);

      // Then: .vscode/settings.jsonが作成される
      const vscodeSettingsPath = join(testDir, ".vscode", "settings.json");
      expect(existsSync(vscodeSettingsPath)).toBe(true);

      const content = readFileSync(vscodeSettingsPath, "utf-8");
      const settings = JSON.parse(content);
      expect(settings["editor.defaultFormatter"]).toBe("biomejs.biome");
      expect(settings["editor.formatOnSave"]).toBe(true);
    });

    it("package.jsonに@biomejs/biomeが開発依存関係として追加される", () => {
      // Given: 初期package.json
      const options = {
        targetDir: testDir,
        conflictStrategy: "overwrite" as const,
      };

      // When: setupBiome実行
      setupBiome(options);

      // Then: devDependenciesに@biomejs/biomeが追加される
      const packageJsonPath = join(testDir, "package.json");
      const content = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies["@biomejs/biome"]).toBe("^1.9.4");
    });
  });
});
