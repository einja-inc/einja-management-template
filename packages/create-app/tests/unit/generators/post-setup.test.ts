import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execPostSetup } from "@/generators/post-setup.js";
import type { ProjectConfig } from "@/types/index.js";

// execaをモック化
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

// oraをモック化
vi.mock("ora", () => ({
  default: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  }),
}));

describe("post-setup generator", () => {
  let testDir: string;
  let mockConfig: ProjectConfig;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "post-setup-test-"));
    const initialPackageJson = {
      name: "test-project",
      version: "1.0.0",
    };
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify(initialPackageJson, null, 2),
      "utf-8"
    );

    mockConfig = {
      projectName: "test-project",
      packageScope: "@test",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        mise: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("execPostSetup", () => {
    it("skipオプションなしの場合、init.sh、Git初期化とpnpm installが実行される", async () => {
      // Given: デフォルトオプション
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, {});

      // Then: bash scripts/init.sh が実行される
      expect(execa).toHaveBeenCalledWith("bash", ["scripts/init.sh"], {
        cwd: testDir,
        stdio: "inherit",
      });

      // Then: git init, git add, git commit が実行される
      expect(execa).toHaveBeenCalledWith("git", ["init"], { cwd: testDir });
      expect(execa).toHaveBeenCalledWith("git", ["add", "."], { cwd: testDir });
      expect(execa).toHaveBeenCalledWith("git", ["commit", "-m", "Initial commit"], {
        cwd: testDir,
      });

      // Then: pnpm install が実行される
      expect(execa).toHaveBeenCalledWith("pnpm", ["install"], { cwd: testDir });

      // Then: Drizzle移行後、db:generate（Prismaクライアント生成相当）は不要のため呼ばれない
      expect(execa).not.toHaveBeenCalledWith("pnpm", ["db:generate"], { cwd: testDir });
    });

    it("skipGitオプションが有効な場合、Git初期化がスキップされる", async () => {
      // Given: skipGit = true
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, { skipGit: true });

      // Then: git関連コマンドが実行されない
      expect(execa).not.toHaveBeenCalledWith("git", ["init"], { cwd: testDir });
      expect(execa).not.toHaveBeenCalledWith("git", ["add", "."], { cwd: testDir });
      expect(execa).not.toHaveBeenCalledWith("git", ["commit", "-m", "Initial commit"], {
        cwd: testDir,
      });

      // Then: pnpm install は実行される
      expect(execa).toHaveBeenCalledWith("pnpm", ["install"], { cwd: testDir });
    });

    it("skipInstallオプションが有効な場合、依存関係インストールがスキップされる", async () => {
      // Given: skipInstall = true
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, { skipInstall: true });

      // Then: git関連コマンドは実行される
      expect(execa).toHaveBeenCalledWith("git", ["init"], { cwd: testDir });

      // Then: pnpm installが実行されない
      expect(execa).not.toHaveBeenCalledWith("pnpm", ["install"], { cwd: testDir });

      // Then: pnpm db:generateも実行されない
      expect(execa).not.toHaveBeenCalledWith("pnpm", ["db:generate"], { cwd: testDir });
    });

    it("setupEinjaCliが有効な場合、@einja-inc/dev-cli initが実行される", async () => {
      // Given: setupEinjaCli = true
      const { execa } = await import("execa");
      const configWithEinja = { ...mockConfig, setupEinjaCli: true };

      // When: execPostSetup実行
      await execPostSetup(configWithEinja, testDir, {});

      // Then: npx @einja-inc/dev-cli init --forceが実行される
      expect(execa).toHaveBeenCalledWith("npx", ["--yes", "@einja-inc/dev-cli@latest", "init", "--force", "--no-backup"], { cwd: testDir });
    });

    it("setupEinjaCliが無効な場合、@einja-inc/dev-cli initが実行されない", async () => {
      // Given: setupEinjaCli = false
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, {});

      // Then: npx @einja-inc/dev-cli init --forceが実行されない
      expect(execa).not.toHaveBeenCalledWith("npx", ["--yes", "@einja-inc/dev-cli@latest", "init", "--force", "--no-backup"], {
        cwd: testDir,
      });
    });

    it("init.shが実行される", async () => {
      // Given: デフォルトオプション
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, {});

      // Then: bash scripts/init.sh が実行される
      expect(execa).toHaveBeenCalledWith("bash", ["scripts/init.sh"], {
        cwd: testDir,
        stdio: "inherit",
      });
    });

    it("skipInstallオプションが有効な場合、init.shがスキップされる", async () => {
      // Given: skipInstall = true
      const { execa } = await import("execa");

      // When: execPostSetup実行
      await execPostSetup(mockConfig, testDir, { skipInstall: true });

      // Then: bash scripts/init.sh が実行されない
      expect(execa).not.toHaveBeenCalledWith("bash", ["scripts/init.sh"], {
        cwd: testDir,
        stdio: "inherit",
      });
    });

    it("Git初期化に失敗した場合、エラーハンドリングされる", async () => {
      // Given: git initが失敗する
      const { execa } = await import("execa");
      // biome-ignore lint/suspicious/noExplicitAny: モック関数の型定義のため必要
      (execa as any).mockRejectedValueOnce(new Error("git init failed"));

      // When: execPostSetup実行
      // Then: エラーが投げられずに処理が継続される
      await expect(execPostSetup(mockConfig, testDir, {})).resolves.toBeUndefined();
    });

    it("pnpm installに失敗した場合、エラーハンドリングされる", async () => {
      // Given: pnpm installが失敗する
      const { execa } = await import("execa");
      // biome-ignore lint/suspicious/noExplicitAny: モック関数の型定義のため必要
      (execa as any)
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // init.sh成功
        .mockRejectedValueOnce(new Error("pnpm install failed")); // pnpm install失敗

      // When: execPostSetup実行
      // Then: エラーが投げられずに処理が継続される
      await expect(execPostSetup(mockConfig, testDir, {})).resolves.toBeUndefined();
    });

    it("@einja-inc/dev-cli initに失敗した場合、エラーハンドリングされる", async () => {
      // Given: npx @einja-inc/dev-cli initが失敗する
      const { execa } = await import("execa");
      const configWithEinja = { ...mockConfig, setupEinjaCli: true };

      // biome-ignore lint/suspicious/noExplicitAny: モック関数の型定義のため必要
      (execa as any)
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // init.sh成功
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pnpm install成功
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pnpm env:rotate-secrets成功
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git init成功
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git add成功
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git commit成功
        .mockRejectedValueOnce(new Error("@einja-inc/dev-cli init failed")); // @einja-inc/dev-cli init失敗

      // When: execPostSetup実行
      // Then: エラーが投げられずに処理が継続される
      await expect(execPostSetup(configWithEinja, testDir, {})).resolves.toBeUndefined();
    });
  });
});
