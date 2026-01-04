import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIRepoDetector } from "./cli-repo-detector.js";

describe("CLIRepoDetector", () => {
  let detector: CLIRepoDetector;
  let testDir: string;

  beforeEach(() => {
    detector = new CLIRepoDetector();
    // テスト用一時ディレクトリ
    testDir = join(process.cwd(), "test-temp-cli-repo");
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("validateRepository", () => {
    it("packages/cli/が存在しない場合、validがfalseかつエラーメッセージが返ること", async () => {
      const result = await detector.validateRepository(testDir);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("packages/cli/が見つかりません");
      expect(result.cliPackagePath).toBeUndefined();
    });

    it("packages/cli/package.jsonが存在しない場合、validがfalseかつエラーメッセージが返ること", async () => {
      // packages/cli/ディレクトリのみ作成
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      const result = await detector.validateRepository(testDir);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("package.jsonが見つかりません");
      expect(result.cliPackagePath).toBeUndefined();
    });

    it("package.jsonのnameが@einja/cli以外の場合、validがfalseかつエラーメッセージが返ること", async () => {
      // packages/cli/ディレクトリとpackage.jsonを作成（間違ったname）
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      const packageJson = {
        name: "@wrong/package",
        version: "1.0.0",
      };
      writeFileSync(
        join(cliDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await detector.validateRepository(testDir);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("@einja/cli");
      expect(result.error).toContain("@wrong/package");
      expect(result.cliPackagePath).toBeUndefined();
    });

    it("package.jsonが不正なJSON形式の場合、validがfalseかつエラーメッセージが返ること", async () => {
      // packages/cli/ディレクトリと不正なpackage.jsonを作成
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      writeFileSync(join(cliDir, "package.json"), "{ invalid json }");

      const result = await detector.validateRepository(testDir);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("読み込みに失敗");
      expect(result.cliPackagePath).toBeUndefined();
    });

    it("正しいCLIリポジトリの場合、validがtrueかつcliPackagePathが返ること", async () => {
      // 正しいpackages/cli/ディレクトリとpackage.jsonを作成
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      const packageJson = {
        name: "@einja/cli",
        version: "1.0.0",
      };
      writeFileSync(
        join(cliDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await detector.validateRepository(testDir);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.cliPackagePath).toBe(cliDir);
    });
  });

  describe("isCliRepository", () => {
    it("CLIリポジトリでない場合、falseが返ること", async () => {
      const result = await detector.isCliRepository(testDir);

      expect(result).toBe(false);
    });

    it("CLIリポジトリの場合、trueが返ること", async () => {
      // 正しいCLIリポジトリを作成
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      const packageJson = {
        name: "@einja/cli",
        version: "1.0.0",
      };
      writeFileSync(
        join(cliDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await detector.isCliRepository(testDir);

      expect(result).toBe(true);
    });
  });

  describe("getCliPackagePath", () => {
    it("CLIリポジトリでない場合、nullが返ること", async () => {
      const result = await detector.getCliPackagePath(testDir);

      expect(result).toBeNull();
    });

    it("CLIリポジトリの場合、packages/cli/のパスが返ること", async () => {
      // 正しいCLIリポジトリを作成
      const cliDir = join(testDir, "packages", "cli");
      mkdirSync(cliDir, { recursive: true });

      const packageJson = {
        name: "@einja/cli",
        version: "1.0.0",
      };
      writeFileSync(
        join(cliDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await detector.getCliPackagePath(testDir);

      expect(result).toBe(cliDir);
    });
  });
});
