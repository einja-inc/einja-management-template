/**
 * Git ブランチ操作
 */

import { execSync } from "node:child_process";

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
export function syncPhaseBranch(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string,
  issueBranchBase: string
): string {
  const branchName = `issue/${issueNumber}-phase${phaseNumber}`;

  // リモートの最新を取得
  fetchRemote();

  // Issue ブランチをリモートの最新に同期し、ベースブランチの変更も取り込む
  syncIssueBranch(issueBranch, issueBranchBase);

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
    mergeIssueBranchIntoPhase(branchName, issueBranch);
  } else if (branchExists(branchName)) {
    // ローカルのみに存在する場合: Issue ブランチの変更を取り込んでプッシュ
    console.log(`   📤 Phase ブランチをプッシュ: ${branchName}`);
    mergeIssueBranchIntoPhase(branchName, issueBranch);
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

  // 現在のブランチを保存
  const currentBranch = getCurrentBranch();

  try {
    // 対象ブランチをチェックアウト
    if (currentBranch !== branchName) {
      execSync(`git checkout ${branchName}`, { stdio: "inherit" });
    }

    // リモートをマージ
    try {
      execSync(`git merge origin/${branchName} --no-edit`, { stdio: "inherit" });
      console.log(`   ✅ リモートの変更をマージ: ${branchName}`);

      // マージ結果をプッシュ
      execSync(`git push origin ${branchName}`, { stdio: "inherit" });
    } catch {
      execSync(`git merge --abort`, { stdio: "ignore" });
      throw new Error(
        `ブランチ ${branchName} のリモート同期でコンフリクトが発生しました。手動で解決してください。`
      );
    }
  } finally {
    // 元のブランチに戻る
    if (currentBranch && currentBranch !== branchName) {
      try {
        execSync(`git checkout ${currentBranch}`, { stdio: "ignore" });
      } catch {
        // 元のブランチに戻れない場合は無視
      }
    }
  }
}

/**
 * Issue ブランチをリモートの最新に同期し、ベースブランチの変更も取り込む
 */
function syncIssueBranch(issueBranch: string, issueBranchBase: string): void {
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
  mergeBaseBranchIntoIssue(issueBranch, issueBranchBase);
}

/**
 * ベースブランチの変更を Issue ブランチに取り込む（マージ）
 * コンフリクトが発生した場合はエラーをスロー
 */
function mergeBaseBranchIntoIssue(issueBranch: string, issueBranchBase: string): void {
  // Issue ブランチがベースブランチの変更を既に含んでいるか確認
  const remoteBaseBranch = `origin/${issueBranchBase}`;
  const mergeBase = execSync(`git merge-base ${issueBranch} ${remoteBaseBranch}`, {
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

  // Issue ブランチにベースブランチの変更をマージ
  console.log(`   🔀 ベースブランチの変更を取り込み: ${issueBranchBase} → ${issueBranch}`);

  // 現在のブランチを保存
  const currentBranch = getCurrentBranch();

  try {
    // Issue ブランチをチェックアウト
    execSync(`git checkout ${issueBranch}`, { stdio: "inherit" });

    // ベースブランチをマージ（fast-forward 優先、コンフリクト時はエラー）
    try {
      execSync(`git merge ${remoteBaseBranch} --no-edit`, { stdio: "inherit" });
      console.log("   ✅ ベースブランチのマージ完了");

      // マージ結果をリモートにプッシュ
      execSync(`git push origin ${issueBranch}`, { stdio: "inherit" });
    } catch (_mergeError) {
      // マージコンフリクト発生時は中止
      execSync("git merge --abort", { stdio: "ignore" });
      throw new Error(
        `Issue ブランチ ${issueBranch} へのベースブランチ ${issueBranchBase} のマージでコンフリクトが発生しました。手動で解決してください。`
      );
    }
  } finally {
    // 元のブランチに戻る
    if (currentBranch && currentBranch !== issueBranch) {
      try {
        execSync(`git checkout ${currentBranch}`, { stdio: "ignore" });
      } catch {
        // 元のブランチに戻れない場合は無視
      }
    }
  }
}

/**
 * Phase ブランチを Issue ブランチにマージ（フェーズ完了時）
 * コンフリクトが発生した場合はエラーをスロー
 */
export function mergePhaseBranchIntoIssue(
  issueNumber: number,
  phaseNumber: number,
  issueBranch: string
): void {
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

  // Issue ブランチに Phase ブランチの変更をマージ
  console.log(`   🔀 Phase ブランチを Issue ブランチにマージ: ${phaseBranch} → ${issueBranch}`);

  // 現在のブランチを保存
  const currentBranch = getCurrentBranch();

  try {
    // ローカル Issue ブランチをリモートの最新に同期
    try {
      execSync(`git branch -D ${issueBranch}`, { stdio: "ignore" });
    } catch {
      // ローカルブランチが存在しない場合は無視
    }
    execSync(`git branch ${issueBranch} origin/${issueBranch}`, {
      stdio: "inherit",
    });

    // Issue ブランチをチェックアウト
    execSync(`git checkout ${issueBranch}`, { stdio: "inherit" });

    // Phase ブランチをマージ（--no-ff でマージコミットを作成）
    try {
      execSync(
        `git merge --no-ff origin/${phaseBranch} -m "Merge phase${phaseNumber} into ${issueBranch}"`,
        {
          stdio: "inherit",
        }
      );
      console.log(`   ✅ Phase ${phaseNumber} マージ完了`);

      // マージ結果をリモートにプッシュ
      execSync(`git push origin ${issueBranch}`, { stdio: "inherit" });
    } catch (_mergeError) {
      // マージコンフリクト発生時は中止
      execSync("git merge --abort", { stdio: "ignore" });
      throw new Error(
        `Issue ブランチ ${issueBranch} への Phase ブランチ ${phaseBranch} のマージでコンフリクトが発生しました。手動で解決してください。`
      );
    }
  } finally {
    // 元のブランチに戻る
    if (currentBranch && currentBranch !== issueBranch) {
      try {
        execSync(`git checkout ${currentBranch}`, { stdio: "ignore" });
      } catch {
        // 元のブランチに戻れない場合は無視
      }
    }
  }
}

/**
 * Issue ブランチの変更を Phase ブランチに取り込む（マージ）
 * コンフリクトが発生した場合はエラーをスロー
 */
function mergeIssueBranchIntoPhase(phaseBranch: string, issueBranch: string): void {
  // Phase ブランチが Issue ブランチの変更を既に含んでいるか確認
  const mergeBase = execSync(`git merge-base ${phaseBranch} ${issueBranch}`, {
    encoding: "utf-8",
  }).trim();
  const issueHead = execSync(`git rev-parse ${issueBranch}`, {
    encoding: "utf-8",
  }).trim();

  // Issue ブランチの HEAD が merge-base と同じなら、取り込み済み
  if (mergeBase === issueHead) {
    console.log("   ✅ Issue ブランチの変更は既に取り込み済み");
    return;
  }

  // Phase ブランチに Issue ブランチの変更をマージ
  console.log(`   🔀 Issue ブランチの変更を取り込み: ${issueBranch} → ${phaseBranch}`);

  // 現在のブランチを保存
  const currentBranch = getCurrentBranch();

  try {
    // Phase ブランチをチェックアウト
    execSync(`git checkout ${phaseBranch}`, { stdio: "inherit" });

    // Issue ブランチをマージ（fast-forward 優先、コンフリクト時はエラー）
    try {
      execSync(`git merge ${issueBranch} --no-edit`, { stdio: "inherit" });
      console.log("   ✅ マージ完了");

      // マージ結果をリモートにプッシュ
      execSync(`git push origin ${phaseBranch}`, { stdio: "inherit" });
    } catch (_mergeError) {
      // マージコンフリクト発生時は中止
      execSync("git merge --abort", { stdio: "ignore" });
      throw new Error(
        `Phase ブランチ ${phaseBranch} への Issue ブランチ ${issueBranch} のマージでコンフリクトが発生しました。手動で解決してください。`
      );
    }
  } finally {
    // 元のブランチに戻る
    if (currentBranch && currentBranch !== phaseBranch) {
      try {
        execSync(`git checkout ${currentBranch}`, { stdio: "ignore" });
      } catch {
        // 元のブランチに戻れない場合は無視
      }
    }
  }
}
