/**
 * Git ブランチ操作
 */

import { execSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { resolveConflictWithClaude } from "./conflict-handler.js";

/**
 * マージ結果の型
 */
interface MergeResult {
  success: boolean;
  alreadyUpToDate?: boolean;
  conflicted?: boolean;
  error?: string;
  worktreePath?: string;
}

/**
 * gh CLI が認証済みか確認
 */
function isGhCliAuthenticated(): boolean {
  try {
    execSync("gh auth status", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * GitHub API を使用してリモートでブランチをマージ
 * ローカルの状態に依存しない
 */
function mergeWithGitHubApi(
  baseBranch: string,
  headBranch: string,
  commitMessage: string
): MergeResult {
  try {
    execSync(
      `gh api repos/:owner/:repo/merges -f base="${baseBranch}" -f head="${headBranch}" -f commit_message="${commitMessage}"`,
      { encoding: "utf-8", stdio: "pipe" }
    );
    return { success: true };
  } catch (error) {
    const errorStr = String(error);
    // 409 Conflict = マージコンフリクト
    if (errorStr.includes("409") || errorStr.includes("Merge conflict")) {
      return { success: false, conflicted: true, error: "マージコンフリクトが発生しました" };
    }
    // 204 No Content または "already" = Already up to date
    if (errorStr.includes("204") || errorStr.includes("already")) {
      return { success: true, alreadyUpToDate: true };
    }
    return { success: false, error: errorStr };
  }
}

/**
 * git worktree を使用してマージ（フォールバック）
 * --detach で既存 worktree と競合しない
 * コンフリクト時は worktree を削除せず、パスを返す
 */
function mergeWithWorktree(
  baseBranch: string,
  headBranch: string,
  commitMessage: string
): MergeResult {
  const tempDir = path.join(os.tmpdir(), `merge-work-${Date.now()}`);

  try {
    // detached HEAD で worktree 作成（既存 worktree と競合しない）
    execSync(`git worktree add --detach "${tempDir}" origin/${baseBranch}`, {
      stdio: "pipe",
    });

    // マージ実行
    try {
      execSync(`git -C "${tempDir}" merge origin/${headBranch} -m "${commitMessage}"`, {
        stdio: "pipe",
      });
    } catch (mergeError) {
      // マージコンフリクト - worktree を保持してパスを返す
      return {
        success: false,
        conflicted: true,
        error: "マージコンフリクトが発生しました",
        worktreePath: tempDir,
      };
    }

    // プッシュ（ブランチ名を明示）
    execSync(`git -C "${tempDir}" push origin HEAD:${baseBranch}`, { stdio: "pipe" });

    // 成功時のみクリーンアップ
    try {
      execSync(`git worktree remove "${tempDir}" --force`, { stdio: "ignore" });
    } catch {
      // クリーンアップ失敗は無視
    }

    return { success: true };
  } catch (error) {
    // エラー時はクリーンアップ
    try {
      execSync(`git worktree remove "${tempDir}" --force`, { stdio: "ignore" });
    } catch {
      // クリーンアップ失敗は無視
    }
    return { success: false, error: String(error) };
  }
}

/**
 * 統合マージ関数（gh CLI → worktree のフォールバック）
 * ローカルの状態に依存せずにリモートブランチをマージ
 *
 * GitHub APIで409（コンフリクト）が返った場合、worktreeで再試行する。
 * GitHub APIは保守的な判定をするため、ローカルのgit merge（ort戦略）なら
 * 自動解決できるケースがある。
 */
function mergeRemoteBranches(
  baseBranch: string,
  headBranch: string,
  commitMessage: string
): MergeResult {
  // gh CLI が認証済みなら GitHub API を使用
  if (isGhCliAuthenticated()) {
    console.log("   🔧 GitHub API でマージを実行");
    const apiResult = mergeWithGitHubApi(baseBranch, headBranch, commitMessage);

    // API成功 or コンフリクト以外のエラー → そのまま返す
    if (apiResult.success || !apiResult.conflicted) {
      return apiResult;
    }

    // 409（コンフリクト）の場合のみ worktree で再試行
    // GitHub APIは保守的なため、ローカルのort戦略なら解決できる場合がある
    console.log("   ⚠️ GitHub API で 409 Conflict、worktree で再試行...");
    return mergeWithWorktree(baseBranch, headBranch, commitMessage);
  }

  // gh CLI 未認証: git worktree を使用
  console.log("   🔧 git worktree でマージを実行");
  return mergeWithWorktree(baseBranch, headBranch, commitMessage);
}

/**
 * リモートの最新情報を取得
 */
export function fetchRemote(): void {
  execSync("git fetch origin", { stdio: "inherit" });
}

/**
 * リモートのデフォルトブランチを取得
 */
export function getDefaultBranch(): string {
  try {
    const result = execSync("git remote show origin | grep 'HEAD branch' | awk '{print $NF}'", {
      encoding: "utf-8",
    });
    return result.trim();
  } catch {
    return "main";
  }
}

/**
 * ブランチが存在するか確認（ローカルまたはリモート）
 */
export function branchExists(branchName: string): boolean {
  try {
    // ローカルブランチの確認
    execSync(`git rev-parse --verify ${branchName}`, { stdio: "ignore" });
    return true;
  } catch {
    try {
      // リモートブランチの確認
      execSync(`git rev-parse --verify origin/${branchName}`, {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 現在のブランチ名を取得
 */
export function getCurrentBranch(): string {
  const result = execSync("git branch --show-current", { encoding: "utf-8" });
  return result.trim();
}

/**
 * ブランチをチェックアウト（存在しない場合は作成）
 */
export function checkoutBranch(branchName: string, baseBranch?: string): void {
  if (branchExists(branchName)) {
    execSync(`git checkout ${branchName}`, { stdio: "inherit" });
  } else if (baseBranch) {
    execSync(`git checkout -b ${branchName} origin/${baseBranch}`, {
      stdio: "inherit",
    });
  } else {
    execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
  }
}

/**
 * Issue ブランチを作成または取得
 * @returns ブランチ名
 */
export function ensureIssueBranch(issueNumber: number, baseBranch: string): string {
  const branchName = `issue/${issueNumber}`;

  fetchRemote();

  if (branchExists(branchName)) {
    console.log(`📌 既存の Issue ブランチを使用: ${branchName}`);
    checkoutBranch(branchName);
  } else {
    console.log(`🌿 Issue ブランチを作成: ${branchName} (from ${baseBranch})`);
    checkoutBranch(branchName, baseBranch);
    // リモートにプッシュ
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  }

  return branchName;
}

/**
 * Issue ブランチを作成または確認（チェックアウトなし）
 * 複数 Issue の同時実行をサポートするため、現在のブランチを変更しない
 * @returns ブランチ名
 */
export function ensureIssueBranchWithoutCheckout(issueNumber: number, baseBranch: string): string {
  const branchName = `issue/${issueNumber}`;

  fetchRemote();

  if (branchExists(branchName)) {
    console.log(`📌 既存の Issue ブランチを使用: ${branchName}`);
  } else {
    console.log(`🌿 Issue ブランチを作成: ${branchName} (from ${baseBranch})`);
    // チェックアウトせずにブランチを作成
    execSync(`git branch ${branchName} origin/${baseBranch}`, {
      stdio: "inherit",
    });
    // リモートにプッシュ
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  }

  return branchName;
}

/**
 * Phase ブランチを作成または確認（チェックアウトなし）
 * 複数 Issue の同時実行をサポートするため、現在のブランチを変更しない
 * @returns ブランチ名
 */
export function ensurePhaseBranchWithoutCheckout(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string
): string {
  const branchName = `issue/${issueNumber}-phase${phaseNumber}`;

  if (branchExists(branchName)) {
    console.log(`   📌 既存の Phase ブランチを使用: ${branchName}`);
  } else {
    console.log(`   🌿 Phase ブランチを作成: ${branchName} (from ${issueBranch})`);
    // チェックアウトせずにブランチを作成（ローカルの Issue ブランチから）
    execSync(`git branch ${branchName} ${issueBranch}`, {
      stdio: "inherit",
    });
    // リモートにプッシュ
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  }

  return branchName;
}

/**
 * Phase ブランチ名を取得
 */
export function getPhaseBranchNameNew(issueNumber: number, phaseNumber: number): string {
  return `issue/${issueNumber}-phase${phaseNumber}`;
}

/**
 * Phase ブランチを作成または取得
 * @returns ブランチ名
 */
export function ensurePhaseBranch(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string
): string {
  const branchName = `issue/${issueNumber}-phase${phaseNumber}`;

  if (branchExists(branchName)) {
    console.log(`📌 既存の Phase ブランチを使用: ${branchName}`);
  } else {
    console.log(`🌿 Phase ブランチを作成: ${branchName} (from ${issueBranch})`);

    // Issue ブランチから Phase ブランチを作成
    const currentBranch = getCurrentBranch();
    if (currentBranch !== issueBranch) {
      checkoutBranch(issueBranch);
    }
    execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  }

  return branchName;
}

/**
 * タスクグループの Phase ブランチ名を取得
 */
export function getPhaseBranchName(issueNumber: number, phaseNumber: number): string {
  return `issue/${issueNumber}-phase${phaseNumber}`;
}

/**
 * Phase ブランチを同期（存在しなければ作成、存在すれば最新化）
 * タスク着手時に呼び出され、リモートの最新状態を反映する
 * また、作成元の Issue ブランチの変更も取り込む
 */
export async function syncPhaseBranch(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string,
  issueBranchBase: string
): Promise<string> {
  const branchName = `issue/${issueNumber}-phase${phaseNumber}`;

  // リモートの最新を取得
  fetchRemote();

  // Issue ブランチをリモートの最新に同期し、ベースブランチの変更も取り込む
  await syncIssueBranch(issueBranch, issueBranchBase);

  // リモートにブランチが存在するか確認
  let remoteExists = false;
  try {
    execSync(`git rev-parse --verify origin/${branchName}`, {
      stdio: "ignore",
    });
    remoteExists = true;
  } catch {
    remoteExists = false;
  }

  if (remoteExists) {
    // リモートに存在する場合: リモートと同期
    console.log(`   🔄 Phase ブランチを同期: ${branchName}`);

    // リモートの最新を取得
    execSync(`git fetch origin ${branchName}`, { stdio: "inherit" });

    // ローカルブランチが存在するか確認
    let localExists = false;
    try {
      execSync(`git rev-parse --verify ${branchName}`, { stdio: "ignore" });
      localExists = true;
    } catch {
      localExists = false;
    }

    if (!localExists) {
      // ローカルにない場合は作成
      execSync(`git branch ${branchName} origin/${branchName}`, {
        stdio: "inherit",
      });
    } else {
      // ローカルにある場合はリモートとマージ（pull相当）
      mergeRemoteIntoLocal(branchName);
    }

    // Issue ブランチの変更を Phase ブランチに取り込む
    await mergeIssueBranchIntoPhase(branchName, issueBranch);
  } else if (branchExists(branchName)) {
    // ローカルのみに存在する場合: Issue ブランチの変更を取り込んでプッシュ
    console.log(`   📤 Phase ブランチをプッシュ: ${branchName}`);
    await mergeIssueBranchIntoPhase(branchName, issueBranch);
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  } else {
    // どこにも存在しない場合: Issue ブランチの最新から新規作成
    console.log(`   🌿 Phase ブランチを作成: ${branchName}`);
    execSync(`git branch ${branchName} ${issueBranch}`, {
      stdio: "inherit",
    });
    execSync(`git push -u origin ${branchName}`, { stdio: "inherit" });
  }

  return branchName;
}

/**
 * リモートブランチの変更をローカルブランチにマージ（pull相当）
 * ローカルとリモートが異なる場合のみマージを実行
 * 現在のブランチの場合は直接マージ、それ以外は worktree または fast-forward で処理
 */
function mergeRemoteIntoLocal(branchName: string): void {
  // ローカルとリモートが同じか確認
  const localCommit = execSync(`git rev-parse ${branchName}`, {
    encoding: "utf-8",
  }).trim();
  const remoteCommit = execSync(`git rev-parse origin/${branchName}`, {
    encoding: "utf-8",
  }).trim();

  if (localCommit === remoteCommit) {
    console.log(`   ✅ リモートと同期済み: ${branchName}`);
    return;
  }

  // 現在のブランチかどうか確認
  const currentBranch = getCurrentBranch();
  const isCurrentBranch = currentBranch === branchName;

  // ローカルがリモートの祖先か確認 (fast-forward 可能)
  try {
    execSync(`git merge-base --is-ancestor ${localCommit} ${remoteCommit}`, { stdio: "ignore" });
    // fast-forward 可能
    if (isCurrentBranch) {
      // 現在のブランチの場合は直接マージ
      execSync(`git merge origin/${branchName} --ff-only`, { stdio: "inherit" });
    } else {
      // 別のブランチの場合は branch -f で更新
      execSync(`git branch -f ${branchName} origin/${branchName}`, { stdio: "inherit" });
    }
    console.log(`   ✅ リモートの変更を取り込み (fast-forward): ${branchName}`);
    return;
  } catch {
    // fast-forward 不可
  }

  // リモートがローカルの祖先か確認 (プッシュが必要)
  try {
    execSync(`git merge-base --is-ancestor ${remoteCommit} ${localCommit}`, { stdio: "ignore" });
    // プッシュが必要
    execSync(`git push origin ${branchName}`, { stdio: "inherit" });
    console.log(`   ✅ ローカルの変更をプッシュ: ${branchName}`);
    return;
  } catch {
    // プッシュだけでは不十分、マージが必要
  }

  // 両方が進んでいる場合: マージが必要
  console.log(`   🔀 リモートの変更をマージ: ${branchName}`);

  if (isCurrentBranch) {
    // 現在のブランチの場合は直接マージ
    try {
      execSync(`git merge origin/${branchName} --no-edit`, { stdio: "pipe" });
    } catch {
      execSync("git merge --abort", { stdio: "ignore" });
      throw new Error(
        `ブランチ ${branchName} のリモート同期でコンフリクトが発生しました。手動で解決してください。`
      );
    }
    // マージ結果をプッシュ
    execSync(`git push origin ${branchName}`, { stdio: "pipe" });
    console.log(`   ✅ リモートの変更をマージ: ${branchName}`);
  } else {
    // 別のブランチの場合は worktree でマージ
    const tempDir = path.join(os.tmpdir(), `merge-sync-${Date.now()}`);

    try {
      // ローカルブランチを一時的に worktree にチェックアウト
      execSync(`git worktree add "${tempDir}" ${branchName}`, { stdio: "pipe" });

      // リモートの変更をマージ
      try {
        execSync(`git -C "${tempDir}" merge origin/${branchName} --no-edit`, { stdio: "pipe" });
      } catch {
        execSync(`git -C "${tempDir}" merge --abort`, { stdio: "ignore" });
        throw new Error(
          `ブランチ ${branchName} のリモート同期でコンフリクトが発生しました。手動で解決してください。`
        );
      }

      // マージ結果をプッシュ
      execSync(`git -C "${tempDir}" push origin ${branchName}`, { stdio: "pipe" });
      console.log(`   ✅ リモートの変更をマージ: ${branchName}`);
    } finally {
      // クリーンアップ
      try {
        execSync(`git worktree remove "${tempDir}" --force`, { stdio: "ignore" });
      } catch {
        // クリーンアップ失敗は無視
      }
    }
  }
}

/**
 * Issue ブランチをリモートの最新に同期し、ベースブランチの変更も取り込む
 */
async function syncIssueBranch(issueBranch: string, issueBranchBase: string): Promise<void> {
  // リモートに Issue ブランチが存在するか確認
  let remoteExists = false;
  try {
    execSync(`git rev-parse --verify origin/${issueBranch}`, {
      stdio: "ignore",
    });
    remoteExists = true;
  } catch {
    remoteExists = false;
  }

  if (!remoteExists) {
    return;
  }

  console.log(`   🔄 Issue ブランチを同期: ${issueBranch}`);

  // リモートの最新を取得
  execSync(`git fetch origin ${issueBranch}`, { stdio: "inherit" });

  // ローカルブランチが存在するか確認
  let localExists = false;
  try {
    execSync(`git rev-parse --verify ${issueBranch}`, { stdio: "ignore" });
    localExists = true;
  } catch {
    localExists = false;
  }

  if (!localExists) {
    // ローカルにない場合は作成
    execSync(`git branch ${issueBranch} origin/${issueBranch}`, {
      stdio: "inherit",
    });
  } else {
    // ローカルにある場合はリモートとマージ（pull相当）
    mergeRemoteIntoLocal(issueBranch);
  }

  // ベースブランチの変更を Issue ブランチに取り込む
  await mergeBaseBranchIntoIssue(issueBranch, issueBranchBase);
}

/**
 * ベースブランチの変更を Issue ブランチに取り込む（マージ）
 * checkout を使用せず、GitHub API または worktree でリモートマージを実行
 * コンフリクトが発生した場合は Claude Code でインタラクティブに解決
 */
async function mergeBaseBranchIntoIssue(
  issueBranch: string,
  issueBranchBase: string
): Promise<void> {
  // Issue ブランチがベースブランチの変更を既に含んでいるか確認
  const remoteBaseBranch = `origin/${issueBranchBase}`;
  const remoteIssueBranch = `origin/${issueBranch}`;

  // リモートブランチ同士で比較（ローカルの状態に依存しない）
  const mergeBase = execSync(`git merge-base ${remoteIssueBranch} ${remoteBaseBranch}`, {
    encoding: "utf-8",
  }).trim();
  const baseHead = execSync(`git rev-parse ${remoteBaseBranch}`, {
    encoding: "utf-8",
  }).trim();

  // ベースブランチの HEAD が merge-base と同じなら、取り込み済み
  if (mergeBase === baseHead) {
    console.log("   ✅ ベースブランチの変更は既に取り込み済み");
    return;
  }

  // Issue ブランチにベースブランチの変更をマージ（リモートで実行）
  console.log(`   🔀 ベースブランチの変更を取り込み: ${issueBranchBase} → ${issueBranch}`);

  const result = mergeRemoteBranches(
    issueBranch,
    issueBranchBase,
    `Merge ${issueBranchBase} into ${issueBranch}`
  );

  if (!result.success) {
    if (result.conflicted && result.worktreePath) {
      // Claude Code でコンフリクト解消
      const resolved = await resolveConflictWithClaude(
        {
          targetBranch: issueBranch,
          sourceBranch: issueBranchBase,
          operationType: "base",
        },
        result.worktreePath
      );

      if (!resolved) {
        // コンフリクト解消失敗 - worktree をクリーンアップ
        try {
          execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
        } catch {
          // クリーンアップ失敗は無視
        }
        throw new Error(
          `Issue ブランチ ${issueBranch} へのベースブランチ ${issueBranchBase} のマージでコンフリクトを解消できませんでした。`
        );
      }

      // コンフリクト解消成功 - プッシュしてクリーンアップ
      try {
        execSync(`git -C "${result.worktreePath}" push origin HEAD:${issueBranch}`, {
          stdio: "pipe",
        });
        console.log("   ✅ コンフリクト解消後のマージを完了しました");
      } finally {
        execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
      }
    } else {
      throw new Error(`マージに失敗しました: ${result.error}`);
    }
  } else {
    console.log("   ✅ ベースブランチのマージ完了");
  }

  // ローカルブランチをリモートに合わせて更新
  try {
    execSync(`git fetch origin ${issueBranch}`, { stdio: "pipe" });
    execSync(`git branch -f ${issueBranch} origin/${issueBranch}`, { stdio: "pipe" });
  } catch {
    // ローカルブランチの更新失敗は警告のみ（リモートは更新済み）
    console.log(`   ⚠️ ローカルブランチの更新をスキップ: ${issueBranch}`);
  }
}

/**
 * Phase ブランチを Issue ブランチにマージ（フェーズ完了時）
 * checkout を使用せず、GitHub API または worktree でリモートマージを実行
 * コンフリクトが発生した場合は Claude Code でインタラクティブに解決
 */
export async function mergePhaseBranchIntoIssue(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string
): Promise<void> {
  const phaseBranch = `issue/${issueNumber}-phase${phaseNumber}`;

  // リモートの最新を取得
  fetchRemote();

  // リモートに Phase ブランチが存在するか確認
  let remoteExists = false;
  try {
    execSync(`git rev-parse --verify origin/${phaseBranch}`, {
      stdio: "ignore",
    });
    remoteExists = true;
  } catch {
    remoteExists = false;
  }

  if (!remoteExists) {
    console.log(`   ⏭️  Phase ブランチがリモートに存在しません: ${phaseBranch}`);
    return;
  }

  // Issue ブランチが Phase ブランチの変更を既に含んでいるか確認
  const mergeBase = execSync(`git merge-base origin/${issueBranch} origin/${phaseBranch}`, {
    encoding: "utf-8",
  }).trim();
  const phaseHead = execSync(`git rev-parse origin/${phaseBranch}`, {
    encoding: "utf-8",
  }).trim();

  // Phase ブランチの HEAD が merge-base と同じなら、取り込み済み
  if (mergeBase === phaseHead) {
    console.log(`   ✅ Phase ${phaseNumber} の変更は既に Issue ブランチに取り込み済み`);
    return;
  }

  // Issue ブランチに Phase ブランチの変更をマージ（リモートで実行）
  console.log(`   🔀 Phase ブランチを Issue ブランチにマージ: ${phaseBranch} → ${issueBranch}`);

  const result = mergeRemoteBranches(
    issueBranch,
    phaseBranch,
    `Merge phase${phaseNumber} into ${issueBranch}`
  );

  if (!result.success) {
    if (result.conflicted && result.worktreePath) {
      // Claude Code でコンフリクト解消
      const resolved = await resolveConflictWithClaude(
        {
          targetBranch: issueBranch,
          sourceBranch: phaseBranch,
          operationType: "phase",
        },
        result.worktreePath
      );

      if (!resolved) {
        // コンフリクト解消失敗 - worktree をクリーンアップ
        try {
          execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
        } catch {
          // クリーンアップ失敗は無視
        }
        throw new Error(
          `Issue ブランチ ${issueBranch} への Phase ブランチ ${phaseBranch} のマージでコンフリクトを解消できませんでした。`
        );
      }

      // コンフリクト解消成功 - プッシュしてクリーンアップ
      try {
        execSync(`git -C "${result.worktreePath}" push origin HEAD:${issueBranch}`, {
          stdio: "pipe",
        });
        console.log(`   ✅ Phase ${phaseNumber} コンフリクト解消後のマージを完了しました`);
      } finally {
        execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
      }
    } else {
      throw new Error(`マージに失敗しました: ${result.error}`);
    }
  } else {
    console.log(`   ✅ Phase ${phaseNumber} マージ完了`);
  }

  // ローカルブランチをリモートに合わせて更新
  try {
    execSync(`git fetch origin ${issueBranch}`, { stdio: "pipe" });
    execSync(`git branch -f ${issueBranch} origin/${issueBranch}`, { stdio: "pipe" });
  } catch {
    // ローカルブランチの更新失敗は警告のみ（リモートは更新済み）
    console.log(`   ⚠️ ローカルブランチの更新をスキップ: ${issueBranch}`);
  }
}

/**
 * Issue ブランチの変更を Phase ブランチに取り込む（マージ）
 * checkout を使用せず、GitHub API または worktree でリモートマージを実行
 * コンフリクトが発生した場合は Claude Code でインタラクティブに解決
 */
async function mergeIssueBranchIntoPhase(phaseBranch: string, issueBranch: string): Promise<void> {
  // Phase ブランチが Issue ブランチの変更を既に含んでいるか確認
  // リモートブランチ同士で比較（ローカルの状態に依存しない）
  const remotePhaseBranch = `origin/${phaseBranch}`;
  const remoteIssueBranch = `origin/${issueBranch}`;

  const mergeBase = execSync(`git merge-base ${remotePhaseBranch} ${remoteIssueBranch}`, {
    encoding: "utf-8",
  }).trim();
  const issueHead = execSync(`git rev-parse ${remoteIssueBranch}`, {
    encoding: "utf-8",
  }).trim();

  // Issue ブランチの HEAD が merge-base と同じなら、取り込み済み
  if (mergeBase === issueHead) {
    console.log("   ✅ Issue ブランチの変更は既に取り込み済み");
    return;
  }

  // Phase ブランチに Issue ブランチの変更をマージ（リモートで実行）
  console.log(`   🔀 Issue ブランチの変更を取り込み: ${issueBranch} → ${phaseBranch}`);

  const result = mergeRemoteBranches(
    phaseBranch,
    issueBranch,
    `Merge ${issueBranch} into ${phaseBranch}`
  );

  if (!result.success) {
    if (result.conflicted && result.worktreePath) {
      // Claude Code でコンフリクト解消
      const resolved = await resolveConflictWithClaude(
        {
          targetBranch: phaseBranch,
          sourceBranch: issueBranch,
          operationType: "phase",
        },
        result.worktreePath
      );

      if (!resolved) {
        // コンフリクト解消失敗 - worktree をクリーンアップ
        try {
          execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
        } catch {
          // クリーンアップ失敗は無視
        }
        throw new Error(
          `Phase ブランチ ${phaseBranch} への Issue ブランチ ${issueBranch} のマージでコンフリクトを解消できませんでした。`
        );
      }

      // コンフリクト解消成功 - プッシュしてクリーンアップ
      try {
        execSync(`git -C "${result.worktreePath}" push origin HEAD:${phaseBranch}`, {
          stdio: "pipe",
        });
        console.log("   ✅ コンフリクト解消後のマージを完了しました");
      } finally {
        execSync(`git worktree remove "${result.worktreePath}" --force`, { stdio: "ignore" });
      }
    } else {
      throw new Error(`マージに失敗しました: ${result.error}`);
    }
  } else {
    console.log("   ✅ マージ完了");
  }

  // ローカルブランチをリモートに合わせて更新
  try {
    execSync(`git fetch origin ${phaseBranch}`, { stdio: "pipe" });
    execSync(`git branch -f ${phaseBranch} origin/${phaseBranch}`, { stdio: "pipe" });
  } catch {
    // ローカルブランチの更新失敗は警告のみ（リモートは更新済み）
    console.log(`   ⚠️ ローカルブランチの更新をスキップ: ${phaseBranch}`);
  }
}
