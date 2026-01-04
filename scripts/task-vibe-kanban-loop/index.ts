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

  // 既存の Vibe-Kanban タスクを取得して初期化
  const existingTasks = await vibeKanban.listTasks(projectId);
  stateManager.initializeDoneTaskIds(existingTasks);

  // デバッグ: 起動時のタスク状態を表示
  const initialDoneTasks = existingTasks.filter((t) => t.status === "done");
  const initialInProgressTasks = existingTasks.filter((t) => t.status === "inprogress");
  console.log(`📊 起動時のタスク状態:`);
  console.log(`   - Done: ${initialDoneTasks.length > 0 ? initialDoneTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`);
  console.log(`   - InProgress: ${initialInProgressTasks.length > 0 ? initialInProgressTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`);

  // 既存タスクのマッピングを登録
  for (const task of existingTasks) {
    const taskGroupId = extractTaskGroupIdFromTitle(task.title);
    if (taskGroupId) {
      stateManager.registerTaskMapping(task.id, taskGroupId);
    }
  }

  // 起動時に既存のDoneタスクのGitHub Issueを同期
  console.log("\n🔄 既存Doneタスクの同期チェック...");
  parsedIssue = await syncExistingDoneTasks(
    parsedIssue,
    existingTasks,
    args.issueNumber,
    stateManager
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

      // デバッグ: 現在のタスク状態を表示
      const doneTasks = currentTasks.filter((t) => t.status === "done");
      if (doneTasks.length > 0) {
        console.log(`   📊 Done状態のタスク: ${doneTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ")}`);
      }

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
function mergeCompletedPhases(
  parsedIssue: ParsedIssue,
  issueNumber: number,
  issueBranch: string
): void {
  const completedPhases = getCompletedPhaseNumbers(parsedIssue);

  for (const phaseNumber of completedPhases) {
    if (mergedPhaseNumbers.has(phaseNumber)) {
      continue;
    }

    console.log(`\n🔀 Phase ${phaseNumber} が完了 - Issue ブランチにマージします`);
    try {
      mergePhaseBranchIntoIssue(issueNumber, phaseNumber, issueBranch);
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
  mergeCompletedPhases(parsedIssue, issueNumber, issueBranch);

  // 着手可能なタスクグループを選定
  const executableGroups = await selectExecutableTaskGroups(parsedIssue, maxTaskNumber);

  if (executableGroups.length === 0) {
    console.log("   ⏸️  着手可能なタスクがありません");
    return;
  }

  console.log(`   📝 着手可能なタスク: ${executableGroups.length} 件`);

  // 既存の Vibe-Kanban タスクを取得（cancelled 以外）
  const existingTasks = await vibeKanban.listTasks(projectId);
  const existingTitles = new Set(
    existingTasks.filter((t) => t.status !== "cancelled").map((t) => t.title)
  );

  // リポジトリ情報を取得（startTaskAttempt に必要）
  const repos = await vibeKanban.listRepos(projectId);

  // 各タスクグループを Vibe-Kanban に登録
  for (const taskGroup of executableGroups) {
    const title = generateVibeKanbanTitle(taskGroup);

    // 既に存在する場合はスキップ
    if (existingTitles.has(title)) {
      console.log(`   ⏭️  既存タスクをスキップ: ${taskGroup.id}`);
      continue;
    }

    const description = generateVibeKanbanDescription(taskGroup, issueNumber);

    // タスク開始前に Phase ブランチを同期（リモートの最新を取得）
    syncPhaseBranch(issueNumber, taskGroup.phaseNumber, issueBranch, baseBranch);

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
 * 起動時に既存のDoneタスクについてGitHub Issueを同期
 *
 * Vibe-KanbanでDone状態なのにGitHub Issueで未完了のタスクを検出し、
 * GitHub Issueを更新する
 */
async function syncExistingDoneTasks(
  parsedIssue: ParsedIssue,
  existingTasks: Array<{ id: string; title: string; status: string }>,
  issueNumber: number,
  stateManager: TaskStateManager
): Promise<ParsedIssue> {
  // Vibe-KanbanでDone状態のタスクを取得
  const doneTasks = existingTasks.filter((t) => t.status === "done");

  // GitHub Issueで未完了のタスクグループIDを取得
  const { getCompletedTaskGroupIds } = await import("./lib/issue-parser.js");
  const completedInIssue = getCompletedTaskGroupIds(parsedIssue);

  // Vibe-KanbanでDoneだがGitHub Issueで未完了のタスクを検出
  const needsSync: string[] = [];
  for (const task of doneTasks) {
    const taskGroupId = extractTaskGroupIdFromTitle(task.title);
    if (taskGroupId && !completedInIssue.has(taskGroupId)) {
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
