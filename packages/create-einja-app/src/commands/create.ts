import { existsSync } from "node:fs";
import { resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { promptProjectConfig, type ProjectConfig } from "../prompts/project.js";
import { generateTemplate } from "../generators/template.js";
import * as logger from "../utils/logger.js";

/**
 * CreateOptions型
 * createコマンドのオプション
 */
interface CreateOptions {
  template?: string;
  skipGit?: boolean;
  skipInstall?: boolean;
  yes?: boolean;
}

/**
 * プロジェクト名のバリデーション
 * @param projectName - プロジェクト名
 * @returns エラーメッセージ（問題なければundefined）
 */
function validateProjectName(projectName: string): string | undefined {
  const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
  if (!regex.test(projectName)) {
    return "プロジェクト名は英字で始まり、英数字・ハイフン・アンダースコアのみ使用できます（1〜50文字）";
  }
  return undefined;
}

/**
 * プロジェクトディレクトリの存在確認
 * @param targetPath - ターゲットパス
 * @returns 存在する場合true
 */
function checkProjectExists(targetPath: string): boolean {
  return existsSync(targetPath);
}

/**
 * 完了メッセージを表示
 * @param config - プロジェクト設定
 * @param targetPath - プロジェクトパス
 */
function printCompletionMessage(config: ProjectConfig, targetPath: string): void {
  console.log();
  logger.success("プロジェクトの作成が完了しました！");
  console.log();
  console.log(chalk.bold("次のステップ:"));
  console.log();
  console.log(chalk.cyan(`  cd ${config.projectName}`));
  console.log(chalk.cyan("  pnpm install"));
  console.log(chalk.cyan("  pnpm dev"));
  console.log();
  console.log(chalk.gray("詳細は README.md をご確認ください。"));
  console.log();
}

/**
 * createコマンドの実装
 * @param projectName - プロジェクト名（オプション）
 * @param options - コマンドオプション
 */
export async function createCommand(
  projectName: string | undefined,
  options: CreateOptions
): Promise<void> {
  try {
    // プロンプトで設定収集
    let config: ProjectConfig;

    if (options.yes && projectName) {
      // --yes オプション: デフォルト値を使用
      const error = validateProjectName(projectName);
      if (error) {
        logger.error(error);
        process.exit(1);
      }

      config = {
        projectName,
        packageScope: "@repo",
        template: (options.template as "turborepo-pandacss" | "minimal") || "turborepo-pandacss",
        authMethod: "google",
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
        },
        setupEinjaCli: true,
        worktreeConfig: undefined,
      };

      logger.info(`プロジェクト名: ${config.projectName}`);
      logger.info(`テンプレート: ${config.template}`);
      logger.info(`認証方式: ${config.authMethod}`);
    } else {
      // 対話式プロンプト
      config = await promptProjectConfig(projectName);
    }

    // ターゲットパスの解決
    const targetPath = resolve(process.cwd(), config.projectName);

    // プロジェクトディレクトリの存在確認
    if (checkProjectExists(targetPath)) {
      logger.error(`ディレクトリ '${config.projectName}' は既に存在します`);
      logger.info("別の名前を指定するか、既存ディレクトリを削除してください");
      process.exit(1);
    }

    // テンプレート展開
    const spinner = ora("プロジェクトを作成中...").start();

    try {
      await generateTemplate(config, targetPath);
      spinner.succeed("プロジェクトを作成しました");
    } catch (error) {
      spinner.fail("プロジェクトの作成に失敗しました");
      throw error;
    }

    // 完了メッセージ表示
    printCompletionMessage(config, targetPath);
  } catch (error) {
    logger.error("エラーが発生しました:");
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }
    process.exit(1);
  }
}
