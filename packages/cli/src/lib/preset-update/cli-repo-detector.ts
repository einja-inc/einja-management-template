import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ValidationResult } from "@/types/preset-update.js";

/**
 * CLIリポジトリ検出モジュール
 *
 * cli-template:updateスクリプトがCLIリポジトリ内で実行されているかを検証します。
 */
export class CLIRepoDetector {
  /**
   * 指定されたディレクトリがCLIリポジトリかどうかを判定
   *
   * @param cwd - 検証対象のディレクトリパス（デフォルト: process.cwd()）
   * @returns CLIリポジトリかどうか
   */
  async isCliRepository(cwd?: string): Promise<boolean> {
    const result = await this.validateRepository(cwd);
    return result.valid;
  }

  /**
   * packages/cli/ディレクトリのパスを取得
   *
   * @param cwd - 検証対象のディレクトリパス（デフォルト: process.cwd()）
   * @returns packages/cli/のパス（存在しない場合はnull）
   */
  async getCliPackagePath(cwd?: string): Promise<string | null> {
    const result = await this.validateRepository(cwd);
    return result.cliPackagePath ?? null;
  }

  /**
   * リポジトリ検証（詳細エラー情報付き）
   *
   * 以下を検証します:
   * 1. packages/cli/ディレクトリが存在するか
   * 2. packages/cli/package.jsonが存在するか
   * 3. package.jsonのnameが"@einja/cli"であるか
   *
   * @param cwd - 検証対象のディレクトリパス（デフォルト: process.cwd()）
   * @returns 検証結果
   */
  async validateRepository(cwd?: string): Promise<ValidationResult> {
    const workingDir = cwd ?? process.cwd();
    const cliPackagePath = join(workingDir, "packages", "cli");

    // 1. packages/cli/ディレクトリの存在確認
    if (!existsSync(cliPackagePath)) {
      return {
        valid: false,
        error:
          "このスクリプトはCLIパッケージリポジトリ内でのみ実行できます（packages/cli/が見つかりません）",
      };
    }

    // 2. packages/cli/package.jsonの存在確認
    const packageJsonPath = join(cliPackagePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      return {
        valid: false,
        error: "packages/cli/package.jsonが見つかりません",
      };
    }

    // 3. package.jsonのnameフィールドを検証
    try {
      const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent) as {
        name?: string;
      };

      if (packageJson.name !== "@einja/cli") {
        return {
          valid: false,
          error: `packages/cli/package.jsonのnameが"@einja/cli"ではありません（実際: "${packageJson.name}"）`,
        };
      }

      // すべての検証をパス
      return {
        valid: true,
        cliPackagePath,
      };
    } catch (error) {
      return {
        valid: false,
        error: `packages/cli/package.jsonの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
