import { execSync } from "node:child_process";
import * as logger from "./logger.js";

/**
 * カレントディレクトリがGitリポジトリかチェック
 * @param targetDir - 対象ディレクトリ（省略時はカレント）
 * @returns Gitリポジトリの場合 true
 */
export function isGitRepository(targetDir?: string): boolean {
  try {
    const cwd = targetDir || process.cwd();
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 未コミットの変更があるかチェック
 * @param targetDir - 対象ディレクトリ（省略時はカレント）
 * @returns 未コミットの変更がある場合 true
 */
export function hasUncommittedChanges(targetDir?: string): boolean {
  if (!isGitRepository(targetDir)) {
    logger.warn("⚠️  このディレクトリはGitリポジトリではありません");
    return false;
  }

  try {
    const cwd = targetDir || process.cwd();
    const output = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
    });
    return output.trim().length > 0;
  } catch (error) {
    logger.warn(`⚠️  Gitステータス確認中にエラーが発生しました: ${error}`);
    return false;
  }
}

/**
 * sync コマンド実行前のGitステータスチェック
 * @param force - --forceフラグ
 * @param targetDir - 対象ディレクトリ（省略時はカレント）
 * @returns チェック通過の場合 true、ブロックの場合 process.exit(1)
 */
export function checkGitStatusForSync(
  force: boolean,
  targetDir?: string,
): boolean {
  // 1. Gitリポジトリかチェック
  if (!isGitRepository(targetDir)) {
    logger.warn("⚠️  このディレクトリはGitリポジトリではありません");
    logger.warn(
      "   sync実行後の差分確認は `git diff` で行うことを推奨します",
    );
    // 処理は続行（警告のみ）
    return true;
  }

  // 2. 未コミット変更チェック
  if (hasUncommittedChanges(targetDir)) {
    if (!force) {
      // デフォルトでブロック
      logger.error("❌ 未コミットの変更があります");
      logger.error(
        "   変更をコミットしてから実行するか、--force フラグを使用してください",
      );
      process.exit(1);
    }

    // --force 指定時は警告のみ
    logger.warn("⚠️  未コミットの変更がありますが、--force により続行します");
    logger.warn(
      "   問題が発生した場合は `git checkout .` で復元できます",
    );
  }

  return true;
}
