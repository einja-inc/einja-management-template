import { execa, execaSync } from "execa";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import type { ProjectConfig } from "../types/index.js";
import * as logger from "../utils/logger.js";

/**
 * PostSetupOptions型
 * 生成後セットアップのオプション
 */
export interface PostSetupOptions {
  skipGit?: boolean;
  skipInstall?: boolean;
}

/**
 * direnvコマンドが利用可能かチェック
 * @returns direnvコマンドが利用可能な場合true
 */
function isDirenvAvailable(): boolean {
  try {
    execaSync("which", ["direnv"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * direnv allowの確認プロンプトを表示し、実行する
 * @param targetPath - プロジェクトディレクトリ
 */
async function promptAndExecuteDirenvAllow(targetPath: string): Promise<void> {
  try {
    const { shouldAllow } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow を実行しますか？（環境変数を有効化します）",
        default: true,
      },
    ]);

    if (shouldAllow) {
      try {
        await execa("direnv", ["allow"], { cwd: targetPath });
        logger.success("direnv allow を実行しました");
      } catch (error) {
        logger.warn("direnv allow の実行に失敗しました");
        logger.info("後で手動で 'direnv allow' を実行してください");
      }
    } else {
      logger.info("direnv allow をスキップしました");
      logger.info("後で手動で 'direnv allow' を実行してください");
    }
  } catch (error) {
    logger.info("direnv allow をスキップしました");
  }
}

/**
 * 完了メッセージを表示
 * @param config - プロジェクト設定
 */
function printCompletionMessage(config: ProjectConfig): void {
  console.log();
  logger.success("プロジェクトの作成が完了しました！");
  console.log();
  console.log(chalk.bold("次のステップ:"));
  console.log();
  console.log(chalk.cyan(`  cd ${config.projectName}`));
  console.log(chalk.cyan("  pnpm env:update          # 環境変数を設定"));
  console.log(chalk.cyan("  pnpm dev                 # PostgreSQL起動 + 開発サーバー起動"));
  console.log();
  console.log(
    chalk.yellow("⚠ セキュリティ: テンプレートの秘密鍵をそのまま使用しないでください")
  );
  console.log(
    chalk.gray("  pnpm env:rotate-secrets  # 秘密鍵を自分のプロジェクト用に再生成")
  );
  console.log();
  console.log(chalk.gray("開発サーバー: ターミナルに表示されるURLを確認"));
  console.log();
  console.log(chalk.gray("詳細は README.md をご確認ください。"));
  console.log();
}

/**
 * 生成後セットアップを実行
 * @param config - プロジェクト設定
 * @param targetPath - プロジェクトディレクトリ
 * @param options - セットアップオプション
 */
export async function execPostSetup(
  config: ProjectConfig,
  targetPath: string,
  options: PostSetupOptions
): Promise<void> {
  const { skipGit, skipInstall } = options;

  // Git初期化
  if (!skipGit) {
    const gitSpinner = ora("Gitリポジトリを初期化中...").start();
    try {
      await execa("git", ["init"], { cwd: targetPath });
      await execa("git", ["add", "."], { cwd: targetPath });
      await execa("git", ["commit", "-m", "Initial commit"], { cwd: targetPath });
      gitSpinner.succeed("Gitリポジトリを初期化しました");
    } catch (error) {
      gitSpinner.fail("Gitリポジトリの初期化に失敗しました");
      logger.warn("後で手動で 'git init' を実行してください");
    }
  }

  // 依存関係インストール
  if (!skipInstall) {
    const installSpinner = ora("依存関係をインストール中...").start();
    try {
      await execa("pnpm", ["install"], { cwd: targetPath });
      installSpinner.succeed("依存関係をインストールしました");

      // Prismaクライアント生成
      const prismaSpinner = ora("Prismaクライアントを生成中...").start();
      try {
        await execa("pnpm", ["db:generate"], { cwd: targetPath });
        prismaSpinner.succeed("Prismaクライアントを生成しました");
      } catch (error) {
        prismaSpinner.fail("Prismaクライアントの生成に失敗しました");
        logger.warn("後で手動で 'pnpm db:generate' を実行してください");
      }
    } catch (error) {
      installSpinner.fail("依存関係のインストールに失敗しました");
      logger.warn("後で手動で 'pnpm install' を実行してください");
    }
  }

  // direnv allow（direnvが有効で、コマンドが利用可能な場合）
  if (config.tools.direnv && isDirenvAvailable()) {
    await promptAndExecuteDirenvAllow(targetPath);
  }

  // @einja/dev-cli init
  if (config.setupEinjaCli) {
    const einjaSpinner = ora("@einja/dev-cli を初期化中...").start();
    try {
      await execa("npx", ["@einja/dev-cli", "init", "--force", "--no-backup"], { cwd: targetPath });
      einjaSpinner.succeed("@einja/dev-cli を初期化しました");
    } catch (error) {
      einjaSpinner.fail("@einja/dev-cli の初期化に失敗しました");
      logger.warn("後で手動で 'npx @einja/dev-cli init' を実行してください");
    }
  }

  // 完了メッセージ表示
  printCompletionMessage(config);
}
