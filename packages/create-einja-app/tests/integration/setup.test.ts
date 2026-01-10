import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupCommand } from "../../src/commands/setup.js";
import * as promptSetup from "../../src/prompts/setup.js";

// inquirerをモックして、direnv allowプロンプトをスキップ
vi.mock("inquirer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("inquirer")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      prompt: vi.fn().mockImplementation(async (questions: unknown) => {
        // promptSetupConfigで使用されるプロンプトはモック対象外
        // direnv allowプロンプトのみスキップ
        if (Array.isArray(questions) && questions.length === 1) {
          const q = questions[0] as { name?: string };
          if (q.name === "shouldAllow") {
            return { shouldAllow: false };
          }
        }
        // 他のプロンプトは元の実装を使用
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return actual.default.prompt(questions as Parameters<typeof actual.default.prompt>[0]);
      }),
    },
  };
});

describe("setup command integration test", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "setup-integration-test-"));
    // package.jsonを作成（既存プロジェクトとして）
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "existing-project", version: "1.0.0" }),
      "utf-8"
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("既存プロジェクトへのツール追加", () => {
    it("direnvのみ選択すると、direnv関連ファイルのみ生成される", async () => {
      // Given: direnvのみ選択
      vi.spyOn(promptSetup, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "overwrite",
      });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: setupCommand実行
        await setupCommand();

        // Then: direnv関連ファイルが生成される
        expect(existsSync(join(testDir, ".envrc"))).toBe(true);
        expect(existsSync(join(testDir, ".envrc.example"))).toBe(true);

        // Then: 他のツールのファイルは生成されない
        expect(existsSync(join(testDir, ".node-version"))).toBe(false);
        expect(existsSync(join(testDir, "biome.json"))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    }, 15000);

    it("複数選択すると、選択した全ツールの設定が生成される", async () => {
      // Given: direnv, dotenvx, Voltaを選択
      vi.spyOn(promptSetup, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
          biome: false,
          husky: false,
        },
        conflictStrategy: "overwrite",
      });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: setupCommand実行
        await setupCommand();

        // Then: 全ての選択したツールのファイルが生成される
        expect(existsSync(join(testDir, ".envrc"))).toBe(true);
        expect(existsSync(join(testDir, ".node-version"))).toBe(true);

        // dotenvxはpackage.jsonに依存関係を追加（dependenciesに追加される）
        const packageJson = JSON.parse(readFileSync(join(testDir, "package.json"), "utf-8"));
        expect(packageJson.dependencies).toBeDefined();
        expect(packageJson.dependencies["@dotenvx/dotenvx"]).toBeDefined();

        // Then: 未選択のツールのファイルは生成されない
        expect(existsSync(join(testDir, "biome.json"))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    }, 15000);
  });

  describe("競合戦略", () => {
    it("merge戦略で既存ファイルがある場合、既存内容が保持され新規設定が追記される", async () => {
      // Given: 既存の.envrcとmerge戦略
      const existingContent = "export EXISTING=value";
      writeFileSync(join(testDir, ".envrc"), existingContent, "utf-8");

      vi.spyOn(promptSetup, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "merge",
      });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: setupCommand実行
        await setupCommand();

        // Then: 既存内容と新規設定の両方が含まれる
        const content = readFileSync(join(testDir, ".envrc"), "utf-8");
        expect(content).toContain(existingContent);
        expect(content).toContain("dotenv_if_exists");
      } finally {
        process.chdir(originalCwd);
      }
    }, 15000);

    it("skip戦略で既存ファイルがある場合、ファイルが変更されない", async () => {
      // Given: 既存の.envrcとskip戦略
      const existingContent = "export EXISTING=value";
      writeFileSync(join(testDir, ".envrc"), existingContent, "utf-8");

      vi.spyOn(promptSetup, "promptSetupConfig").mockResolvedValue({
        tools: {
          direnv: true,
          dotenvx: false,
          volta: false,
          biome: false,
          husky: false,
        },
        conflictStrategy: "skip",
      });

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: setupCommand実行
        await setupCommand();

        // Then: 既存ファイルが変更されない
        const content = readFileSync(join(testDir, ".envrc"), "utf-8");
        expect(content).toBe(existingContent);
      } finally {
        process.chdir(originalCwd);
      }
    }, 15000);
  });

  describe("package.json不在時のエラー", () => {
    it("package.jsonが存在しない場合、エラーで終了する", async () => {
      // Given: package.jsonが存在しないディレクトリ
      const emptyTestDir = mkdtempSync(join(tmpdir(), "setup-no-package-"));

      const originalCwd = process.cwd();
      const originalExit = process.exit;
      let exitCode: number | undefined;

      // process.exitをモック（例外をスローして即座に終了）
      process.exit = ((code: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as never;

      process.chdir(emptyTestDir);

      try {
        // When: setupCommand実行
        await setupCommand();
        // Then: process.exitが呼ばれることを期待
        expect.fail("Should have thrown error");
      } catch (error) {
        // Then: エラーが発生し、exitCode = 1
        expect(exitCode).toBe(1);
      } finally {
        process.chdir(originalCwd);
        process.exit = originalExit;
        rmSync(emptyTestDir, { recursive: true, force: true });
      }
    });
  });
});
