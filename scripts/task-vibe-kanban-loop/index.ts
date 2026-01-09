#!/usr/bin/env tsx
/**
 * タスク自動実行ループ
 *
 * GitHub Issue からタスクを取得し、Vibe-Kanban に登録して実行を継続するループ
 *
 * 使用方法:
 *   pnpm task:loop <issue-number> [--max <number>] [--base <branch>]
 */

import { parseArgs } from "./lib/args-parser.js";
import {
  ensureIssueBranchWithoutCheckout,
  getPhaseBranchNameNew,
  mergePhaseBranchIntoIssue,
  syncPhaseBranch,
} from "./lib/branch-manager.js";
import { ensureGhSetup } from "./lib/gh-setup.js";
import {
  detectCircularDependencies,
  getCompletedPhaseNumbers,
  isAllTasksCompleted,
  selectExecutableTaskGroups,
} from "./lib/dependency-resolver.js";
import { getIssue, getRepoInfo } from "./lib/github-client.js";
import { parseIssueBody } from "./lib/issue-parser.js";
import { selectProject } from "./lib/project-selector.js";
import {
  TaskStateManager,
  extractIssueNumberFromTitle,
  extractTaskGroupIdFromTitle,
  generateVibeKanbanDescription,
  generateVibeKanbanTitle,
} from "./lib/task-state-manager.js";
import type { ParsedIssue } from "./lib/types.js";
import { VibeKanbanClient } from "./lib/vibe-kanban-client.js";

/** ポーリング間隔（ミリ秒） */
const POLLING_INTERVAL_MS = 15_000;

/**
 * 現在日時を YYYY/MM/DD HH:mm:ss 形式で取得
 */
function getTimestamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = now.toLocaleTimeString("ja-JP", { hour12: false });
  return `${date} ${time}`;
}

/**
 * 待機関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  // 引数解析
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    process.exit(1);
  }

  // GitHub CLI セットアップ確認
  ensureGhSetup();

  console.log(`\n🚀 タスク自動実行ループ開始 [${getTimestamp()}]\n`);

  // 設定表示
  const repoInfo = getRepoInfo();
  const baseBranch = args.baseBranch ?? "main";

  console.log("📋 設定:");
  console.log(`  - Issue番号: #${args.issueNumber}`);
  console.log(`  - 最大タスク番号: ${args.maxTaskNumber ?? "all"}`);
  console.log(`  - ベースブランチ: ${baseBranch}`);
  console.log(`  - リポジトリ: ${repoInfo.owner}/${repoInfo.name}`);
  console.log("");

  // GitHub Issue 取得・解析
  console.log("📥 GitHub Issue を取得中...");
  const issue = getIssue(args.issueNumber);
  let parsedIssue = parseIssueBody(issue);

  // 循環依存チェック
  const cycle = detectCircularDependencies(parsedIssue);
  if (cycle) {
    console.error("\n❌ エラー: タスクグループの循環依存を検出しました");
    console.error(`循環依存パス: ${cycle.join(" → ")}`);
    process.exit(1);
  }

  console.log(`✅ Issue 取得完了: ${parsedIssue.title}`);
  console.log(
    `   Phase 数: ${parsedIssue.phases.length}, タスクグループ数: ${parsedIssue.phases.reduce((sum, p) => sum + p.taskGroups.length, 0)}`
  );
  console.log("");

  // Issue ブランチを作成（チェックアウトなし）
  console.log("🌿 ブランチを準備中...");
  const issueBranch = ensureIssueBranchWithoutCheckout(args.issueNumber, baseBranch);
  // Phase ブランチはタスク着手時に作成・同期される
  console.log("📌 Phase ブランチはタスク着手時に作成・同期されます");
  console.log("");

  // Vibe-Kanban 接続
  const vibeKanban = new VibeKanbanClient();
  await vibeKanban.connect();

  // プロジェクト ID 取得（設定ファイルまたはインタラクティブ選択）
  const projectId = await selectProject(vibeKanban, args.issueNumber);

  // タスク状態マネージャー初期化
  const stateManager = new TaskStateManager();

  // 既存の Vibe-Kanban タスクを取得
  const existingTasks = await vibeKanban.listTasks(projectId);

  // descriptionキャッシュを作成（パフォーマンス改善: getTaskを複数回呼ばない）
  console.log(`📦 タスクのdescriptionをキャッシュ中...`);
  const descriptionCache = new Map<string, string | null>();
  for (const task of existingTasks) {
    let description = task.description ?? null;
    if (!description) {
      const fullTask = await vibeKanban.getTask(task.id);
      description = fullTask?.description ?? null;
    }
    descriptionCache.set(task.id, description);
  }
  console.log(`   ✅ ${descriptionCache.size} 件のタスクをキャッシュ`);

  // Done タスク ID を初期化（ログは対象Issue関連のみ表示）
  stateManager.initializeDoneTaskIds(existingTasks, args.issueNumber, descriptionCache);

  // デバッグ: 起動時のタスク状態を表示（対象Issue関連のみ）
  const issuePatternInDesc = `GitHub Issue #${args.issueNumber}`;
  const isTaskForThisIssue = (task: { title: string; id: string }) => {
    // 新形式: タイトルからIssue番号を抽出
    const titleIssueNum = extractIssueNumberFromTitle(task.title);
    if (titleIssueNum === args.issueNumber) return true;
    // 旧形式: descriptionで判定
    const desc = descriptionCache.get(task.id);
    return desc?.includes(issuePatternInDesc) ?? false;
  };

  const initialDoneTasks = existingTasks.filter((t) => t.status === "done" && isTaskForThisIssue(t));
  const initialInProgressTasks = existingTasks.filter((t) => t.status === "inprogress" && isTaskForThisIssue(t));
  console.log(`📊 起動時のタスク状態 (Issue #${args.issueNumber} 関連):`);
  console.log(`   - Done: ${initialDoneTasks.length > 0 ? initialDoneTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`);
  console.log(`   - InProgress: ${initialInProgressTasks.length > 0 ? initialInProgressTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`);

  // 既存タスクのマッピングを登録（対象Issueのタスクのみ）
  console.log(`📋 既存タスクのマッピング登録中 (Issue #${args.issueNumber} のみ)...`);
  for (const task of existingTasks) {
    const taskGroupId = extractTaskGroupIdFromTitle(task.title);
    if (!taskGroupId) {
      continue;
    }

    // 対象のGitHub Issueに属するタスクのみ登録
    if (isTaskForThisIssue(task)) {
      stateManager.registerTaskMapping(task.id, taskGroupId);
    }
    // Issue番号が一致しないタスクは何もしない（ログ出力も不要）
  }

  // 起動時に既存のDoneタスクのGitHub Issueを同期
  console.log("\n🔄 既存Doneタスクの同期チェック...");
  parsedIssue = await syncExistingDoneTasks(
    parsedIssue,
    existingTasks,
    args.issueNumber,
    stateManager,
    descriptionCache
  );

  try {
    // 初期化: 着手可能なタスクを全部 Doing に移す
    console.log("\n🔍 着手可能なタスクを選定中...");
    await startExecutableTasks(
      parsedIssue,
      args.maxTaskNumber,
      args.issueNumber,
      issueBranch,
      baseBranch,
      projectId,
      vibeKanban,
      stateManager
    );

    // メインループ
    let loopCount = 0;
    while (true) {
      loopCount++;
      console.log(`\n🔄 ポーリング #${loopCount} [${getTimestamp()}]`);

      // Vibe-Kanban のタスク状態を取得
      const currentTasks = await vibeKanban.listTasks(projectId);

      // 対象Issueに関連するDoneタスクの件数のみ表示
      const doneTasks = currentTasks.filter((t) => t.status === "done" && isTaskForThisIssue(t));
      const totalDoneTasks = currentTasks.filter((t) => t.status === "done").length;
      console.log(`   📊 Done: ${doneTasks.length}件 (対象Issue) / ${totalDoneTasks}件 (全体)`);

      // Done 増加を検知
      const newlyCompletedVibeTaskIds = stateManager.detectNewlyCompletedTasks(currentTasks);

      if (newlyCompletedVibeTaskIds.length > 0) {
        console.log(`✅ 新たに完了したタスク: ${newlyCompletedVibeTaskIds.length} 件`);

        // タスクグループ ID を取得
        const completedTaskGroupIds =
          stateManager.getCompletedTaskGroupIds(newlyCompletedVibeTaskIds);

        // GitHub Issue のチェックボックスを更新
        parsedIssue = await stateManager.markTaskGroupsAsCompleted(
          args.issueNumber,
          completedTaskGroupIds
        );

        // 新たに着手可能になったタスクを開始
        await startExecutableTasks(
          parsedIssue,
          args.maxTaskNumber,
          args.issueNumber,
          issueBranch,
          baseBranch,
          projectId,
          vibeKanban,
          stateManager
        );
      }

      // 全タスク完了チェック
      if (isAllTasksCompleted(parsedIssue, args.maxTaskNumber)) {
        console.log("\n🎉 すべてのタスクが完了しました！");
        break;
      }

      // 待機
      console.log(`   ⏳ ${POLLING_INTERVAL_MS / 1000}秒待機...`);
      await sleep(POLLING_INTERVAL_MS);
    }
  } finally {
    // Vibe-Kanban 切断
    await vibeKanban.disconnect();
  }

  console.log("\n✅ タスク自動実行ループ終了\n");
}

/** マージ済み Phase 番号を追跡（重複マージ防止） */
const mergedPhaseNumbers = new Set<number>();

/**
 * 完了した Phase を Issue ブランチにマージ
 */
async function mergeCompletedPhases(
  parsedIssue: ParsedIssue,
  issueNumber: number,
  issueBranch: string
): Promise<void> {
  const completedPhases = getCompletedPhaseNumbers(parsedIssue);

  for (const phaseNumber of completedPhases) {
    if (mergedPhaseNumbers.has(phaseNumber)) {
      continue;
    }

    console.log(`\n🔀 Phase ${phaseNumber} が完了 - Issue ブランチにマージします`);
    try {
      await mergePhaseBranchIntoIssue(issueNumber, phaseNumber, issueBranch);
      mergedPhaseNumbers.add(phaseNumber);
    } catch (error) {
      console.error(`   ❌ Phase ${phaseNumber} のマージに失敗:`, error);
      throw error;
    }
  }
}

/**
 * 着手可能なタスクを Vibe-Kanban に登録して実行開始
 */
async function startExecutableTasks(
  parsedIssue: ParsedIssue,
  maxTaskNumber: string | undefined,
  issueNumber: number,
  issueBranch: string,
  baseBranch: string,
  projectId: string,
  vibeKanban: VibeKanbanClient,
  stateManager: TaskStateManager
): Promise<void> {
  // 完了した Phase を Issue ブランチにマージ（新しい Phase のタスク開始前に実行）
  await mergeCompletedPhases(parsedIssue, issueNumber, issueBranch);

  // 着手可能なタスクグループを選定
  const executableGroups = await selectExecutableTaskGroups(parsedIssue, maxTaskNumber);

  if (executableGroups.length === 0) {
    console.log("   ⏸️  着手可能なタスクがありません");
    return;
  }

  console.log(`   📝 着手可能なタスク: ${executableGroups.length} 件`);

  // 既存の Vibe-Kanban タスクを取得（cancelled 以外）
  const existingTasks = await vibeKanban.listTasks(projectId);

  // 対象Issueに属する既存タスクのタスクグループIDを収集
  const existingTaskGroupIdsForThisIssue = new Set<string>();
  const issuePatternInDesc = `GitHub Issue #${issueNumber}`;
  for (const task of existingTasks) {
    if (task.status === "cancelled") {
      continue;
    }
    const taskGroupId = extractTaskGroupIdFromTitle(task.title);
    if (!taskGroupId) continue;

    // タイトルからIssue番号を抽出（新形式）
    const titleIssueNum = extractIssueNumberFromTitle(task.title);
    if (titleIssueNum === issueNumber) {
      existingTaskGroupIdsForThisIssue.add(taskGroupId);
      continue;
    }

    // 旧形式の場合はdescriptionで判定
    let description = task.description;
    if (!description) {
      const fullTask = await vibeKanban.getTask(task.id);
      description = fullTask?.description;
    }
    if (description?.includes(issuePatternInDesc)) {
      existingTaskGroupIdsForThisIssue.add(taskGroupId);
    }
  }

  // リポジトリ情報を取得（startTaskAttempt に必要）
  const repos = await vibeKanban.listRepos(projectId);

  // 各タスクグループを Vibe-Kanban に登録
  for (const taskGroup of executableGroups) {
    // 対象Issueで既に存在する場合はスキップ（タスクグループIDで判定）
    if (existingTaskGroupIdsForThisIssue.has(taskGroup.id)) {
      console.log(`   ⏭️  既存タスクをスキップ: ${taskGroup.id}`);
      continue;
    }

    const title = generateVibeKanbanTitle(taskGroup, issueNumber);

    const description = generateVibeKanbanDescription(taskGroup, issueNumber);

    // タスク開始前に Phase ブランチを同期（リモートの最新を取得）
    await syncPhaseBranch(issueNumber, taskGroup.phaseNumber, issueBranch, baseBranch);

    // タスク作成
    console.log(`   📌 タスク作成: ${taskGroup.id} - ${taskGroup.name}`);
    const taskId = await vibeKanban.createTask(projectId, title, description);

    // マッピング登録
    stateManager.registerTaskMapping(taskId, taskGroup.id);

    // ステータスを inprogress に更新
    await vibeKanban.updateTask(taskId, "inprogress");

    // タスク実行開始（Phase ブランチをベースに使用）
    const phaseBranch = getPhaseBranchNameNew(issueNumber, taskGroup.phaseNumber);
    try {
      const reposWithBranch = repos.map((repo) => ({
        repo_id: repo.id,
        base_branch: phaseBranch,
      }));
      const attempt = await vibeKanban.startTaskAttempt(taskId, "CLAUDE_CODE", reposWithBranch);
      console.log(
        `   ▶️  タスク開始: ${taskGroup.id} (base: ${phaseBranch}, attempt: ${attempt?.id ?? "unknown"})`
      );
    } catch (error) {
      console.error(`   ❌ Attempt開始失敗: ${taskGroup.id}`, error);
    }
  }
}

/**
 * タスクが指定されたGitHub Issueに属しているか確認
 *
 * タスクのdescriptionに "GitHub Issue #<issueNumber>" が含まれているかチェック
 */
function isTaskBelongsToIssue(
  task: { id: string; title: string; description?: string },
  issueNumber: number
): boolean {
  if (!task.description) {
    return false;
  }
  const issuePattern = `GitHub Issue #${issueNumber}`;
  return task.description.includes(issuePattern);
}

/**
 * 起動時に既存のDoneタスクについてGitHub Issueを同期
 *
 * Vibe-KanbanでDone状態なのにGitHub Issueで未完了のタスクを検出し、
 * GitHub Issueを更新する
 *
 * 注意: 同じプロジェクト内に複数のGitHub Issueのタスクが混在している可能性があるため、
 * タスクのdescriptionに含まれるIssue番号をチェックして、対象Issueのタスクのみを同期する
 */
async function syncExistingDoneTasks(
  parsedIssue: ParsedIssue,
  existingTasks: Array<{ id: string; title: string; status: string; description?: string }>,
  issueNumber: number,
  stateManager: TaskStateManager,
  descriptionCache: Map<string, string | null>
): Promise<ParsedIssue> {
  // Vibe-KanbanでDone状態のタスクを取得
  const doneTasks = existingTasks.filter((t) => t.status === "done");

  // GitHub Issueで未完了のタスクグループIDを取得
  const { getCompletedTaskGroupIds } = await import("./lib/issue-parser.js");
  const completedInIssue = getCompletedTaskGroupIds(parsedIssue);

  // Vibe-KanbanでDoneだがGitHub Issueで未完了のタスクを検出
  // 対象のGitHub Issueに属するタスクのみを処理（Issue番号が一致しないものは無視）
  const needsSync: string[] = [];
  const issuePattern = `GitHub Issue #${issueNumber}`;
  for (const task of doneTasks) {
    const taskGroupId = extractTaskGroupIdFromTitle(task.title);
    if (!taskGroupId) {
      continue;
    }

    // キャッシュからdescriptionを取得
    const taskDescription = descriptionCache.get(task.id);

    // 対象のGitHub Issueに属するタスクのみ処理
    // descriptionに "GitHub Issue #<issueNumber>" が含まれているタスクのみを対象とする
    if (!taskDescription?.includes(issuePattern)) {
      // Issue番号が一致しないタスクは何もしない（ログ出力も不要）
      continue;
    }

    if (!completedInIssue.has(taskGroupId)) {
      needsSync.push(taskGroupId);
      console.log(`   📝 同期が必要: ${taskGroupId} (Vibe-Kanban: Done, GitHub: 未完了)`);
    }
  }

  if (needsSync.length === 0) {
    console.log("   ✅ 同期が必要なタスクはありません");
    return parsedIssue;
  }

  // GitHub Issueを更新
  console.log(`   🔄 ${needsSync.length} 件のタスクをGitHub Issueに同期...`);
  return stateManager.markTaskGroupsAsCompleted(issueNumber, needsSync);
}

// エントリポイント
main().catch((error) => {
  console.error("\n❌ エラーが発生しました:", error);
  process.exit(1);
});
