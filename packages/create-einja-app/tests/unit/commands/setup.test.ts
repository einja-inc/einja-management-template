import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupCommand } from "../../../src/commands/setup.js";
import * as setupPrompts from "../../../src/prompts/setup.js";
import * as direnvTools from "../../../src/generators/tools/direnv.js";

describe("setup command", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "setup-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("プロジェクトディレクトリ確認", () => {
    it("package.jsonが存在しない場合、エラーで終了する", async () => {
      // Given: package.jsonが存在しないディレクトリ
      // （testDirにはpackage.jsonが存在しない）

      // Mock process.exit to prevent test from exiting
      const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as () => never);

      // When: setupCommand実行
      // Then: process.exit(1)が呼ばれる
      await expect(setupCommand()).rejects.toThrow("process.exit called");
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("package.jsonが存在する場合、セットアップが開始される", async () => {
      // Given: package.jsonが存在するディレクトリ
      const packageJsonPath = join(testDir, "package.json");
      writeFileSync(
        packageJsonPath,
        JSON.stringify({ name: "test-project", version: "1.0.0" }),
        "utf-8"
      );

      // Mock promptSetupConfig to avoid interactive prompt
      const mockPrompt = vi
        .spyOn(setupPrompts, "promptSetupConfig")
        .mockResolvedValue({
          tools: {
            direnv: false,
            dotenvx: false,
            volta: false,
            biome: false,
            husky: false,
          },
          conflictStrategy: "merge",
        });

      // When: setupCommand実行
      await setupCommand();

      // Then: promptSetupConfigが呼ばれる
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe("ツールセットアップ", () => {
    beforeEach(() => {
      // package.jsonを作成
      const packageJsonPath = join(testDir, "package.json");
      writeFileSync(
        packageJsonPath,
        JSON.stringify({ name: "test-project", version: "1.0.0" }),
        "utf-8"
      );

      // promptDirenvAllowをモック化（対話プロンプトを避ける）
      vi.spyOn(direnvTools, "promptDirenvAllow").mockResolvedValue();
    });

    it("direnvが選択された場合、.envrcファイルが生成される", async () => {
      // Given: direnvを選択
      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      // When: setupCommand実行
      await setupCommand();

      // Then: .envrcファイルが作成される
      const envrcPath = join(testDir, ".envrc");
      expect(existsSync(envrcPath)).toBe(true);
      const content = readFileSync(envrcPath, "utf-8");
      expect(content).toContain("dotenv_if_exists");
    });

    it("voltaが選択された場合、package.jsonにvoltaフィールドが追加される", async () => {
      // Given: voltaを選択
      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: false,
          dotenvx: false,
          volta: true,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      // When: setupCommand実行
      await setupCommand();

      // Then: package.jsonにvoltaフィールドが追加される
      const packageJsonPath = join(testDir, "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      expect(packageJson.volta).toBeDefined();
      expect(packageJson.volta.node).toBeDefined();
    });

    it("複数のツールを選択した場合、すべてセットアップされる", async () => {
      // Given: direnv, dotenvx, voltaを選択
      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      // When: setupCommand実行
      await setupCommand();

      // Then: 全てのツールがセットアップされる
      expect(existsSync(join(testDir, ".envrc"))).toBe(true);
      expect(existsSync(join(testDir, ".env.example"))).toBe(true);

      const packageJson = JSON.parse(
        readFileSync(join(testDir, "package.json"), "utf-8")
      );
      expect(packageJson.volta).toBeDefined();
      expect(packageJson.dependencies?.["@dotenvx/dotenvx"]).toBeDefined();
    });

    it("ツールを選択しない場合、セットアップが完了する", async () => {
      // Given: ツールを選択しない
      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: false,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      // When: setupCommand実行
      await setupCommand();

      // Then: エラーなく完了する（ファイルは生成されない）
      expect(existsSync(join(testDir, ".envrc"))).toBe(false);
      expect(existsSync(join(testDir, ".env.example"))).toBe(false);
    });
  });

  describe("競合戦略", () => {
    beforeEach(() => {
      // package.jsonを作成
      const packageJsonPath = join(testDir, "package.json");
      writeFileSync(
        packageJsonPath,
        JSON.stringify({ name: "test-project", version: "1.0.0" }),
        "utf-8"
      );

      // promptDirenvAllowをモック化（対話プロンプトを避ける）
      vi.spyOn(direnvTools, "promptDirenvAllow").mockResolvedValue();
    });

    it("競合戦略がmergeの場合、既存ファイルに追記される", async () => {
      // Given: 既存の.envrc
      const existingContent = "# existing content";
      writeFileSync(join(testDir, ".envrc"), existingContent, "utf-8");

      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      // When: setupCommand実行（merge戦略）
      await setupCommand();

      // Then: 既存内容が保持され、新規設定が追記される
      const content = readFileSync(join(testDir, ".envrc"), "utf-8");
      expect(content).toContain(existingContent);
      expect(content).toContain("dotenv_if_exists");
    });

    it("競合戦略がskipの場合、既存ファイルが保持される", async () => {
      // Given: 既存の.envrc
      const existingContent = "# existing content only";
      writeFileSync(join(testDir, ".envrc"), existingContent, "utf-8");

      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "skip",
      });

      // When: setupCommand実行（skip戦略）
      await setupCommand();

      // Then: 既存ファイルがそのまま保持される
      const content = readFileSync(join(testDir, ".envrc"), "utf-8");
      expect(content).toBe(existingContent);
    });

    it("競合戦略がoverwriteの場合、既存ファイルが上書きされる", async () => {
      // Given: 既存の.envrc
      const existingContent = "# existing content only";
      writeFileSync(join(testDir, ".envrc"), existingContent, "utf-8");

      vi.spyOn(setupPrompts, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "overwrite",
      });

      // When: setupCommand実行（overwrite戦略）
      await setupCommand();

      // Then: 既存ファイルが上書きされる
      const content = readFileSync(join(testDir, ".envrc"), "utf-8");
      expect(content).not.toContain(existingContent);
      expect(content).toContain("dotenv_if_exists");
    });
  });
});
