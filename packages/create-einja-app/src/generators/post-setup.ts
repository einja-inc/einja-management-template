import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import chalk from "chalk";
import ora from "ora";
import type { ProjectConfig } from "@/types/index.js";
import * as logger from "@/utils/logger.js";

/**
 * PostSetupOptions型
 * 生成後セットアップのオプション
 */
export interface PostSetupOptions {
  skipGit?: boolean;
  skipInstall?: boolean;
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
    chalk.green("✓ セキュリティ: 秘密鍵は自動ローテーション済みです")
  );
  console.log(
    chalk.gray("  pnpm env:rotate-secrets  # 手動で再ローテーションする場合")
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

  // 0. 初回セットアップ（Volta/Node.js/pnpm/direnv）
  if (!skipInstall) {
    logger.info("初回セットアップを実行中...");
    try {
      await execa("bash", ["scripts/init.sh"], { cwd: targetPath, stdio: "inherit" });
      // init.shでインストールされたVolta/pnpmを後続ステップで使えるようPATHに追加
      const voltaBin = path.join(os.homedir(), ".volta", "bin");
      if (!process.env.PATH?.includes(voltaBin)) {
        process.env.PATH = `${voltaBin}:${process.env.PATH}`;
      }
    } catch (error) {
      logger.warn("初回セットアップの自動実行に失敗しました");
      logger.info("後で手動で './scripts/init.sh' を実行してください");
    }
  }

  // 1. 依存関係インストール（git initより先に実行）
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

  // 2. 秘密鍵の自動ローテーション（git commitの前に実行）
  if (!skipInstall) {
    const rotateSpinner = ora("秘密鍵をローテーション中...").start();
    try {
      await execa("pnpm", ["env:rotate-secrets", "--all", "--non-interactive"], { cwd: targetPath });
      rotateSpinner.succeed("秘密鍵をローテーションしました");
    } catch (error) {
      rotateSpinner.warn("秘密鍵の自動ローテーションに失敗しました");
      logger.info("後で手動で 'pnpm env:rotate-secrets' を実行してください");
    }
  }

  // 3. Git初期化（ローテーション後にcommit）
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

  // 4. @einja/dev-cli init
  if (config.setupEinjaCli) {
    const einjaSpinner = ora("@einja/dev-cli を初期化中...").start();
    try {
      await execa("npx", ["--yes", "@einja/dev-cli@latest", "init", "--force", "--no-backup"], { cwd: targetPath });
      einjaSpinner.succeed("@einja/dev-cli を初期化しました");
    } catch (error) {
      einjaSpinner.fail("@einja/dev-cli の初期化に失敗しました");
      logger.warn("後で手動で 'npx --yes @einja/dev-cli@latest init' を実行してください");
    }
  }

  // 完了メッセージ表示
  printCompletionMessage(config);
}
