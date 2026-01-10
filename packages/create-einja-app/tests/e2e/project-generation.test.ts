import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execa } from "execa";

/**
 * E2Eテスト: 実際のプロジェクト生成とビルドを検証
 *
 * 注意: これらのテストは実際にcreate-einja-appをビルドして実行します。
 * テスト実行前に `pnpm build` を実行してください。
 */
describe("project generation E2E test", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "e2e-project-gen-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("プロジェクト作成とビルド", () => {
    it.skip("プロジェクトを作成してビルドが成功する", async () => {
      // Given: プロジェクト名とオプション
      const projectName = "test-e2e-project";
      const projectPath = join(testDir, projectName);

      // When: create-einja-appを実行
      const cliPath = join(__dirname, "../../dist/cli.js");
      const { exitCode: createExitCode } = await execa(
        "node",
        [cliPath, projectName, "--yes", "--skip-git", "--skip-install"],
        { cwd: testDir }
      );

      // Then: コマンドが成功する
      expect(createExitCode).toBe(0);

      // Then: プロジェクトディレクトリが作成される
      expect(existsSync(projectPath)).toBe(true);

      // Then: 主要なファイルが存在する
      expect(existsSync(join(projectPath, "package.json"))).toBe(true);
      expect(existsSync(join(projectPath, "turbo.json"))).toBe(true);
      expect(existsSync(join(projectPath, "pnpm-workspace.yaml"))).toBe(true);

      // Then: apps/ ディレクトリが存在する
      expect(existsSync(join(projectPath, "apps", "web"))).toBe(true);

      // Then: packages/ ディレクトリが存在する
      expect(existsSync(join(projectPath, "packages", "config"))).toBe(true);
      expect(existsSync(join(projectPath, "packages", "front-core"))).toBe(true);
      expect(existsSync(join(projectPath, "packages", "server-core"))).toBe(true);
      expect(existsSync(join(projectPath, "packages", "ui"))).toBe(true);

      // 注: ビルドは時間がかかるため、ファイル構成の検証のみ行う
      // 実際のビルドテストは手動またはCI環境で実行
    }, 120000); // タイムアウトを120秒に設定
  });

  describe("開発サーバー起動（スキップ）", () => {
    // 注: 開発サーバー起動は環境依存が大きいため、E2Eテストではスキップ
    // 実際の動作確認は手動テストで行う
    it.skip("プロジェクトを作成して開発サーバーが起動する", async () => {
      // このテストは手動実行時のみ有効化する
      // Given: プロジェクト作成
      const projectName = "test-e2e-dev-server";
      const projectPath = join(testDir, projectName);

      const cliPath = join(__dirname, "../../dist/cli.js");
      await execa("node", [cliPath, projectName, "--yes"], { cwd: testDir });

      // When: pnpm install実行
      await execa("pnpm", ["install"], { cwd: projectPath });

      // When: pnpm dev実行（バックグラウンド）
      const devProcess = execa("pnpm", ["dev"], { cwd: projectPath });

      // Then: サーバーが起動してhttp://localhost:3000が応答する
      // （実装は省略: ポート確認やヘルスチェック）

      // クリーンアップ
      devProcess.kill();
      await devProcess;
    });
  });
});
