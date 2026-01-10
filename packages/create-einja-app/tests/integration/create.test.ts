import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCommand } from "../../src/commands/create.js";

// inquirerをモックして、全てのプロンプトをスキップ
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ shouldAllow: false }),
  },
}));

// execaをモックして、特定の外部コマンド実行をスキップ
vi.mock("execa", async (importOriginal) => {
  const actual = await importOriginal<typeof import("execa")>();
  return {
    ...actual,
    execa: vi.fn().mockImplementation(async (command: string, args?: string[]) => {
      // @einja/cli init のみモック
      if (command === "npx" && args?.[0] === "@einja/cli") {
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      // その他のコマンドは実際に実行
      return actual.execa(command, args || []);
    }),
    execaSync: vi.fn().mockImplementation((command: string, args?: string[]) => {
      // which direnv はモック
      if (command === "which" && args?.[0] === "direnv") {
        throw new Error("direnv not found");
      }
      // その他のコマンドは実際に実行
      return actual.execaSync(command, args || []);
    }),
  };
});

describe("create command integration test", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "create-integration-test-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("完全なプロジェクト作成フロー", () => {
    it("デフォルト設定でプロジェクトを作成すると、全ファイルが生成される", async () => {
      // Given: デフォルト設定とプロジェクト名
      const projectName = "test-project";
      const options = {
        template: "turborepo-pandacss",
        skipGit: true,
        skipInstall: true,
        yes: true,
      };

      // 現在のディレクトリをtestDirに変更
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: createCommand実行
        await createCommand(projectName, options);

        // Then: プロジェクトディレクトリが作成される
        const projectPath = join(testDir, projectName);
        expect(existsSync(projectPath)).toBe(true);

        // Then: 主要なファイルが存在する
        expect(existsSync(join(projectPath, "package.json"))).toBe(true);
        expect(existsSync(join(projectPath, "turbo.json"))).toBe(true);
        expect(existsSync(join(projectPath, "pnpm-workspace.yaml"))).toBe(true);
        expect(existsSync(join(projectPath, ".envrc"))).toBe(true);
        expect(existsSync(join(projectPath, ".envrc.example"))).toBe(true);
        expect(existsSync(join(projectPath, ".gitignore"))).toBe(true);

        // Then: package.jsonにプロジェクト名が含まれる
        const packageJson = JSON.parse(
          readFileSync(join(projectPath, "package.json"), "utf-8")
        );
        expect(packageJson.name).toBe(projectName);
      } finally {
        process.chdir(originalCwd);
      }
    }, 30000); // タイムアウトを30秒に設定

    it("--skip-gitオプションでプロジェクトを作成すると、.gitディレクトリが作成されない", async () => {
      // Given: --skip-gitオプション
      const projectName = "test-project-no-git";
      const options = {
        skipGit: true,
        skipInstall: true,
        yes: true,
      };

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: createCommand実行
        await createCommand(projectName, options);

        // Then: .gitディレクトリが作成されない
        const projectPath = join(testDir, projectName);
        expect(existsSync(join(projectPath, ".git"))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    }, 30000);

    it("--skip-installオプションでプロジェクトを作成すると、node_modulesディレクトリが作成されない", async () => {
      // Given: --skip-installオプション
      const projectName = "test-project-no-install";
      const options = {
        skipGit: true,
        skipInstall: true,
        yes: true,
      };

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // When: createCommand実行
        await createCommand(projectName, options);

        // Then: node_modulesディレクトリが作成されない
        const projectPath = join(testDir, projectName);
        expect(existsSync(join(projectPath, "node_modules"))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    }, 30000);
  });

  describe("プロジェクト名のバリデーション", () => {
    it("無効なプロジェクト名を渡すと、エラーで終了する", async () => {
      // Given: 無効なプロジェクト名（数字で始まる）
      const projectName = "123-invalid-name";
      const options = {
        skipGit: true,
        skipInstall: true,
        yes: true,
      };

      const originalCwd = process.cwd();
      const originalExit = process.exit;
      let exitCode: number | undefined;
      let exitCalled = false;

      // process.exitをモック（例外をスローせずexitCodeのみ記録）
      process.exit = ((code: number) => {
        exitCode = code;
        exitCalled = true;
        // 例外をスローしない（finallyブロックを確実に実行させるため）
      }) as never;

      process.chdir(testDir);

      try {
        // When: createCommand実行
        await createCommand(projectName, options);
      } finally {
        process.chdir(originalCwd);
        process.exit = originalExit;
      }

      // Then: process.exitが呼ばれ、exitCode = 1
      expect(exitCalled).toBe(true);
      expect(exitCode).toBe(1);
    });
  });

  describe("既存ディレクトリ検出", () => {
    it("既に存在するディレクトリ名を指定すると、エラーで終了する", async () => {
      // Given: 既に存在するディレクトリ
      const projectName = "existing-dir";
      const projectPath = join(testDir, projectName);
      mkdtempSync(projectPath);

      const options = {
        skipGit: true,
        skipInstall: true,
        yes: true,
      };

      const originalCwd = process.cwd();
      const originalExit = process.exit;
      let exitCode: number | undefined;
      let exitCalled = false;

      // process.exitをモック（例外をスローせずexitCodeのみ記録）
      process.exit = ((code: number) => {
        exitCode = code;
        exitCalled = true;
        // 例外をスローしない（finallyブロックを確実に実行させるため）
      }) as never;

      process.chdir(testDir);

      try {
        // When: createCommand実行
        await createCommand(projectName, options);
      } finally {
        process.chdir(originalCwd);
        process.exit = originalExit;
      }

      // Then: process.exitが呼ばれ、exitCode = 1
      expect(exitCalled).toBe(true);
      expect(exitCode).toBe(1);
    });
  });
});
