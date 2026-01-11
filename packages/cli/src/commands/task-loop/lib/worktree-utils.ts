/**
 * Git worktree 関連のユーティリティ関数
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * direnv allow の実行結果
 */
export interface DirenvAllowResult {
  success: boolean;
  error?: string;
}

/**
 * 指定ミリ秒待機する
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * attempt.id からワークツリーパスを取得
 * --porcelain オプションで安定したパースを実現
 *
 * @param attemptId - Vibe-KanbanのattemptID
 * @param branchPrefix - ブランチ名のプレフィックス（デフォルト: "vk/"）
 * @param maxRetries - 最大リトライ回数（デフォルト: 3）
 * @param retryDelayMs - リトライ間隔（デフォルト: 500ms）
 * @returns ワークツリーのパス。見つからない場合は null
 */
export async function getWorktreePathByAttemptId(
  attemptId: string,
  branchPrefix = "vk/",
  maxRetries = 3,
  retryDelayMs = 500
): Promise<string | null> {
  const branchName = `${branchPrefix}${attemptId}`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // --porcelain で機械可読な形式を取得
      const output = execSync("git worktree list --porcelain", { encoding: "utf-8" });
      const blocks = output.trim().split("\n\n");

      for (const block of blocks) {
        const lines = block.split("\n");
        let worktreePath: string | null = null;
        let branch: string | null = null;

        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            worktreePath = line.slice("worktree ".length);
          }
          if (line.startsWith("branch refs/heads/")) {
            branch = line.slice("branch refs/heads/".length);
          }
        }

        if (branch === branchName && worktreePath) {
          return worktreePath;
        }
      }
    } catch {
      // git コマンド失敗時は次のリトライへ
    }

    // ワークツリー作成直後は反映されていない可能性があるためリトライ
    if (i < maxRetries - 1) {
      await sleep(retryDelayMs);
    }
  }

  return null;
}

/**
 * 指定パスで direnv allow を実行
 * .envrc が存在する場合のみ実行
 *
 * @param worktreePath - ワークツリーのパス
 * @returns 実行結果
 */
export function runDirenvAllow(worktreePath: string): DirenvAllowResult {
  // .envrc が存在しない場合はスキップ
  if (!existsSync(join(worktreePath, ".envrc"))) {
    return { success: true }; // .envrc がないので成功扱い
  }

  try {
    // execFileSync を使用してシェルインジェクションを防止
    execFileSync("direnv", ["allow", worktreePath], {
      cwd: worktreePath,
      stdio: "pipe",
    });
    return { success: true };
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? (error as { stderr?: Buffer }).stderr?.toString()
        : undefined;
    return { success: false, error: stderr || "direnv allow failed" };
  }
}
