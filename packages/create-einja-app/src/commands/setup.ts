import { existsSync } from "node:fs";
import { join } from "node:path";
import ora from "ora";
import { promptSetupConfig } from "../prompts/setup.js";
import {
  setupDirenv,
  setupDotenvx,
  setupVolta,
  setupBiome,
  setupHusky,
  promptDirenvAllow,
} from "../generators/tools/index.js";
import type { ToolSetupOptions } from "../types/index.js";
import * as logger from "../utils/logger.js";

/**
 * setupコマンド - 既存プロジェクトへのツール追加
 *
 * US-002: 既存プロジェクトへの環境ツール追加
 * AC-002-1: `npx create-einja-app --setup` で対話式プロンプトが表示される
 * AC-002-2: 既存の設定ファイルがある場合、マージ・上書き・スキップを選択できる
 * AC-002-3: 選択したツールのみがセットアップされる
 * AC-002-4: 既存ファイルを破壊せずにツールが追加される（マージモード時）
 */
export async function setupCommand(): Promise<void> {
  const targetDir = process.cwd();

  // 1. プロジェクトディレクトリ確認（package.json存在確認）
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    logger.error("エラー: package.jsonが見つかりません");
    logger.info("このコマンドは既存のプロジェクトディレクトリで実行してください");
    process.exit(1);
  }

  logger.info("既存プロジェクトへのツール追加を開始します");
  logger.info("");

  // 2. プロンプトで設定収集
  const config = await promptSetupConfig();

  logger.info("");
  logger.info("セットアップを開始します...");
  logger.info("");

  const options: ToolSetupOptions = {
    targetDir,
    conflictStrategy: config.conflictStrategy,
  };

  // 3. 選択されたツールのセットアップ
  let setupCount = 0;

  if (config.tools.direnv) {
    const spin = ora("direnv をセットアップしています...").start();
    try {
      setupDirenv(options);
      spin.succeed("direnv セットアップ完了");
      setupCount++;
    } catch (error) {
      spin.fail("direnv セットアップ失敗");
      logger.error(
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      );
    }
  }

  if (config.tools.dotenvx) {
    const spin = ora("dotenvx をセットアップしています...").start();
    try {
      setupDotenvx(options);
      spin.succeed("dotenvx セットアップ完了");
      setupCount++;
    } catch (error) {
      spin.fail("dotenvx セットアップ失敗");
      logger.error(
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      );
    }
  }

  if (config.tools.volta) {
    const spin = ora("Volta をセットアップしています...").start();
    try {
      setupVolta(options);
      spin.succeed("Volta セットアップ完了");
      setupCount++;
    } catch (error) {
      spin.fail("Volta セットアップ失敗");
      logger.error(
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      );
    }
  }

  if (config.tools.biome) {
    const spin = ora("Biome をセットアップしています...").start();
    try {
      setupBiome(options);
      spin.succeed("Biome セットアップ完了");
      setupCount++;
    } catch (error) {
      spin.fail("Biome セットアップ失敗");
      logger.error(
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      );
    }
  }

  if (config.tools.husky) {
    const spin = ora("Husky をセットアップしています...").start();
    try {
      setupHusky(options);
      spin.succeed("Husky セットアップ完了");
      setupCount++;
    } catch (error) {
      spin.fail("Husky セットアップ失敗");
      logger.error(
        error instanceof Error ? error.message : "予期しないエラーが発生しました"
      );
    }
  }

  logger.info("");

  // 4. direnv allowの確認プロンプト（direnvがセットアップされた場合のみ）
  if (config.tools.direnv) {
    await promptDirenvAllow(targetDir);
    logger.info("");
  }

  // 5. 完了メッセージ
  logger.success(`✅ セットアップが完了しました！（${setupCount}個のツール）`);
  logger.info("");
  logger.info("次のステップ:");

  if (config.tools.direnv) {
    logger.info("  1. .envrc を編集して環境変数を設定");
    logger.info("  2. direnv allow を実行（まだの場合）");
  }

  if (config.tools.dotenvx) {
    logger.info("  - .env.example をコピーして .env を作成");
    logger.info("  - 必要に応じて pnpm env:encrypt で暗号化");
  }

  if (config.tools.biome) {
    logger.info("  - pnpm lint でコードをチェック");
    logger.info("  - pnpm format:fix でフォーマット");
  }

  if (config.tools.husky) {
    logger.info("  - pnpm install でHuskyフックをインストール");
  }

  logger.info("");
  logger.success("開発を開始できます！");
}
