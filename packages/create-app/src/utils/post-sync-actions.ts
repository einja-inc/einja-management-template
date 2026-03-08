import { execSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import inquirer from "inquirer";
import type { SyncCategory, SyncResult } from "@/types/index.js";
import * as logger from "@/utils/logger.js";

/**
 * direnvコマンドが利用可能かチェック
 */
function isDirenvAvailable(): boolean {
  try {
    execSync("which direnv", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * direnv allow ポストアクション
 * .envrcが作成/更新された場合にdirenv allowを実行するか確認
 *
 * @param targetDir - ターゲットディレクトリ
 */
async function runDirenvAllowAction(targetDir: string): Promise<void> {
  // direnvが利用可能かチェック
  if (!isDirenvAvailable()) {
    logger.info("direnvコマンドが見つかりません。スキップします。");
    return;
  }

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
        execSync("direnv allow", { cwd: targetDir, stdio: "inherit" });
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
    // プロンプトがキャンセルされた場合など
    logger.info("direnv allow をスキップしました");
  }
}

/**
 * .husky/pre-commit の chmod ポストアクション
 * .husky/pre-commitが作成/更新された場合に実行権限を設定
 *
 * @param targetDir - ターゲットディレクトリ
 */
function runHuskyChmodAction(targetDir: string): void {
  const preCommitPath = join(targetDir, ".husky", "pre-commit");

  if (!existsSync(preCommitPath)) {
    logger.warn(`.husky/pre-commit が見つかりません: ${preCommitPath}`);
    return;
  }

  try {
    chmodSync(preCommitPath, 0o755);
    logger.success(".husky/pre-commit に実行権限を設定しました");
  } catch (error) {
    logger.error(
      `.husky/pre-commit の権限設定に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
    );
  }
}

/**
 * ポストアクションを実行
 *
 * @param targetDir - ターゲットディレクトリ
 * @param syncedCategories - 同期されたカテゴリ一覧
 * @param syncResult - 同期結果
 */
export async function runPostSyncActions(
  targetDir: string,
  syncedCategories: SyncCategory[],
  syncResult: SyncResult
): Promise<void> {
  // envカテゴリで.envrcが作成/更新された場合にdirenv allow確認
  const hasEnvCategory = syncedCategories.includes("env");
  const envrcFile = syncResult.files.find((f) => f.path === ".envrc");
  const isEnvrcSynced = envrcFile !== undefined && (envrcFile.action === "copied" || envrcFile.action === "merged");

  if (hasEnvCategory && isEnvrcSynced) {
    logger.info("\n📝 ポストアクション: direnv allow");
    await runDirenvAllowAction(targetDir);
  }

  // git-hooksカテゴリで.husky/pre-commitが作成/更新された場合にchmod
  const hasGitHooksCategory = syncedCategories.includes("git-hooks");
  const preCommitFile = syncResult.files.find((f) => f.path === ".husky/pre-commit");
  const isPreCommitSynced =
    preCommitFile !== undefined && (preCommitFile.action === "copied" || preCommitFile.action === "merged");

  if (hasGitHooksCategory && isPreCommitSynced) {
    logger.info("\n📝 ポストアクション: .husky/pre-commit の実行権限設定");
    runHuskyChmodAction(targetDir);
  }
}
