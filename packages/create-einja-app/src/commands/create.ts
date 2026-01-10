import { existsSync } from "node:fs";
import { resolve } from "node:path";
import ora from "ora";
import { promptProjectConfig, type ProjectConfig } from "../prompts/project.js";
import { generateTemplate } from "../generators/template.js";
import { execPostSetup } from "../generators/post-setup.js";
import * as logger from "../utils/logger.js";

/**
 * CreateOptions型
 * createコマンドのオプション
 */
interface CreateOptions {
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
        template: "default",
        authMethod: "default",
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
          biome: true,
          husky: true,
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

    // 生成後セットアップ実行
    await execPostSetup(config, targetPath, {
      skipGit: options.skipGit,
      skipInstall: options.skipInstall,
    });
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
