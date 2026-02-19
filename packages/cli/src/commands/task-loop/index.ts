/**
 * タスク自動実行ループ
 *
 * GitHub Issue からタスクを取得し、Vibe-Kanban に登録して実行を継続するループ
 *
 * 使用方法:
 *   einja task:loop <issue-number> [--max <number>] [--base <branch>]
 */

import {
  ensureIssueBranchWithoutCheckout,
  getPhaseBranchNameNew,
  mergePhaseBranchIntoIssue,
  syncPhaseBranch,
} from "./lib/branch-manager.js";
import { selectBaseBranch } from "./lib/branch-selector.js";
import {
  detectCircularDependencies,
  getCompletedPhaseNumbers,
  isAllTasksCompleted,
  selectExecutableTaskGroups,
} from "./lib/dependency-resolver.js";
import { ensureGhSetup } from "./lib/gh-setup.js";
import { getIssue, getRepoInfo } from "./lib/github-client.js";
import { parseIssueBody } from "./lib/issue-parser.js";
import { selectProject } from "./lib/project-selector.js";
import { ensurePullRequestCreated } from "./lib/pull-request-manager.js";
import {
  TaskStateManager,
  extractIssueNumberFromTitle,
  extractPhaseNumberFromTitle,
  extractTaskGroupIdFromTitle,
  generateAgentPrompt,
  generateParentIssueDescription,
  generateParentIssueTitle,
  generateVibeKanbanDescription,
  generateVibeKanbanTitle,
} from "./lib/task-state-manager.js";
import type { ParsedIssue, VibeKanbanRepo } from "./lib/types.js";
import { VibeKanbanClient } from "./lib/vibe-kanban-client.js";
import { getWorktreePathByAttemptId, runDirenvAllow } from "./lib/worktree-utils.js";

export interface TaskLoopOptions {
  maxGroup?: string;
  branch?: string;
}

/** ポーリング間隔（ミリ秒） */
const POLLING_INTERVAL_MS = 15_000;

/** 親Issue自動Doneタイムアウト（ミリ秒） */
const PARENT_DONE_TIMEOUT_MS = 120_000;

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
 * task:loop コマンド
 * GitHub Issue からタスクを取得し、Vibe-Kanban に登録して実行を継続するループ
 */
export async function taskLoopCommand(
  issue: string | undefined,
  options: TaskLoopOptions
): Promise<void> {
  // Issue番号の確認
  if (!issue) {
    console.error("❌ Issue番号が指定されていません");
    console.log("\n使用例:");
    console.log("  einja task:loop 123");
    console.log("  einja task:loop 123 --max-group 1.3");
    process.exit(1);
  }

  // Issue番号を数値に変換
  const issueNumber = Number.parseInt(issue.replace(/^#/, ""), 10);
  if (Number.isNaN(issueNumber)) {
    console.error(`❌ 無効なIssue番号: ${issue}`);
    process.exit(1);
  }

  const maxTaskNumber = options.maxGroup;
  const baseBranch = await selectBaseBranch(options.branch);

  // GitHub CLI セットアップ確認
  ensureGhSetup();

  console.log(`\n🚀 タスク自動実行ループ開始 [${getTimestamp()}]\n`);

  // 設定表示
  const repoInfo = getRepoInfo();

  console.log("📋 設定:");
  console.log(`  - Issue番号: #${issueNumber}`);
  console.log(`  - 最大タスク番号: ${maxTaskNumber ?? "all"}`);
  console.log(`  - ベースブランチ: ${baseBranch}`);
  console.log(`  - リポジトリ: ${repoInfo.owner}/${repoInfo.name}`);
  console.log("");

  // GitHub Issue 取得・解析
  console.log("📥 GitHub Issue を取得中...");
  const issueData = getIssue(issueNumber);
  let parsedIssue = parseIssueBody(issueData);

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
  const issueBranch = ensureIssueBranchWithoutCheckout(issueNumber, baseBranch);
  // Phase ブランチはタスク着手時に作成・同期される
  console.log("📌 Phase ブランチはタスク着手時に作成・同期されます");
  console.log("");

  // Vibe-Kanban 接続
  const vibeKanban = new VibeKanbanClient();
  await vibeKanban.connect();

  // Vibe-Kanban に登録済みのリポジトリから現在のリポジトリを特定
  const allRepos = await vibeKanban.listRepos();
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/\.git$/, "")
      .split("/")
      .pop() ?? "";
  const normalizedRepoName = normalize(repoInfo.name);
  const matchedRepos = allRepos.filter((repo) => normalize(repo.name) === normalizedRepoName);

  if (matchedRepos.length === 0) {
    console.error(`❌ Vibe-Kanbanにリポジトリ "${repoInfo.name}" が見つかりません`);
    console.error(`   登録済みリポジトリ: ${allRepos.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
  if (matchedRepos.length > 1) {
    console.error(`❌ リポジトリ "${repoInfo.name}" に複数の候補が見つかりました`);
    console.error(`   候補: ${matchedRepos.map((r) => `${r.name} (${r.id})`).join(", ")}`);
    process.exit(1);
  }
  const currentRepo = matchedRepos[0];
  console.log(`✅ リポジトリ: ${currentRepo.name} (${currentRepo.id})`);

  // プロジェクト ID 取得（設定ファイルまたはインタラクティブ選択）
  const projectId = await selectProject(vibeKanban, issueNumber);

  // タスク状態マネージャー初期化
  const stateManager = new TaskStateManager();

  // 既存の Vibe-Kanban タスクを取得
  const existingTasks = await vibeKanban.listTasks(projectId);

  // descriptionキャッシュを作成（パフォーマンス改善: getTaskを複数回呼ばない）
  console.log("📦 タスクのdescriptionをキャッシュ中...");
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
  stateManager.initializeDoneTaskIds(existingTasks, issueNumber, descriptionCache);

  // デバッグ: 起動時のタスク状態を表示（対象Issue関連のみ）
  const issuePatternInDesc = `GitHub Issue #${issueNumber}`;
  const isTaskForThisIssue = (task: { title: string; id: string }) => {
    // 新形式: タイトルからIssue番号を抽出
    const titleIssueNum = extractIssueNumberFromTitle(task.title);
    if (titleIssueNum === issueNumber) return true;
    // 旧形式: descriptionで判定
    const desc = descriptionCache.get(task.id);
    return desc?.includes(issuePatternInDesc) ?? false;
  };

  const initialDoneTasks = existingTasks.filter(
    (t) => t.status === "Done" && isTaskForThisIssue(t)
  );
  const initialInProgressTasks = existingTasks.filter(
    (t) => t.status === "In Progress" && isTaskForThisIssue(t)
  );
  console.log(`📊 起動時のタスク状態 (Issue #${issueNumber} 関連):`);
  console.log(
    `   - Done: ${initialDoneTasks.length > 0 ? initialDoneTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`
  );
  console.log(
    `   - InProgress: ${initialInProgressTasks.length > 0 ? initialInProgressTasks.map((t) => extractTaskGroupIdFromTitle(t.title) || t.title).join(", ") : "なし"}`
  );

  // 既存タスクのマッピングを登録（対象Issueのタスクのみ）
  console.log(`📋 既存タスクのマッピング登録中 (Issue #${issueNumber} のみ)...`);
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
    issueNumber,
    stateManager,
    descriptionCache
  );

  // Phase毎に親Issue初期化
  console.log("\n📌 Phase 親Issue を初期化中...");
  for (const phase of parsedIssue.phases) {
    const parentTitle = generateParentIssueTitle(phase, issueNumber);

    // 既存チェック（再開サポート: 同一タイトルの既存親Issueを検索）
    const existingParent = existingTasks.find(
      (t) => t.title === parentTitle && t.status !== "Cancelled"
    );

    if (existingParent) {
      console.log(`   📌 既存の親Issueを使用: Phase ${phase.number} → ${existingParent.id}`);
      stateManager.registerPhaseMapping(phase.number, {
        phaseNumber: phase.number,
        parentIssueId: existingParent.id,
      });
    } else {
      const parentDesc = generateParentIssueDescription(phase, issueNumber);
      const parentIssueId = await vibeKanban.createParentIssue(projectId, parentTitle, parentDesc);
      console.log(`   ✅ 親Issue作成: Phase ${phase.number} → ${parentIssueId}`);
      stateManager.registerPhaseMapping(phase.number, {
        phaseNumber: phase.number,
        parentIssueId,
      });
    }
  }

  try {
    // 初期化: 着手可能なタスクを全部 Doing に移す
    console.log("\n🔍 着手可能なタスクを選定中...");
    await startExecutableTasks(
      parsedIssue,
      maxTaskNumber,
      issueNumber,
      issueBranch,
      baseBranch,
      projectId,
      vibeKanban,
      stateManager,
      currentRepo
    );

    // メインループ
    let loopCount = 0;
    while (true) {
      loopCount++;
      console.log(`\n🔄 ポーリング #${loopCount} [${getTimestamp()}]`);

      // Vibe-Kanban のタスク状態を取得
      const currentTasks = await vibeKanban.listTasks(projectId);

      // 対象Issueに関連するDoneタスクの件数のみ表示
      const doneTasks = currentTasks.filter((t) => t.status === "Done" && isTaskForThisIssue(t));
      const totalDoneTasks = currentTasks.filter((t) => t.status === "Done").length;
      console.log(`   📊 Done: ${doneTasks.length}件 (対象Issue) / ${totalDoneTasks}件 (全体)`);

      // 親Issueを除外してサブIssueのみDone検知（リスク#3 対策: IDベース）
      const subIssueTasks = currentTasks.filter((t) => !stateManager.isParentIssue(t.id));

      // Done 増加を検知
      const newlyCompletedVibeTaskIds = stateManager.detectNewlyCompletedTasks(
        subIssueTasks,
        descriptionCache
      );

      if (newlyCompletedVibeTaskIds.length > 0) {
        console.log(`✅ 新たに完了したタスク: ${newlyCompletedVibeTaskIds.length} 件`);

        // タスクグループ ID を取得
        const completedTaskGroupIds =
          stateManager.getCompletedTaskGroupIds(newlyCompletedVibeTaskIds);

        // GitHub Issue のチェックボックスを更新
        parsedIssue = await stateManager.markTaskGroupsAsCompleted(
          issueNumber,
          completedTaskGroupIds
        );

        // Phase完了チェック & ハンドリング
        await checkAndHandlePhaseCompletion(
          parsedIssue,
          issueNumber,
          issueBranch,
          vibeKanban,
          stateManager,
          currentRepo
        );

        // 新たに着手可能になったタスクを開始
        await startExecutableTasks(
          parsedIssue,
          maxTaskNumber,
          issueNumber,
          issueBranch,
          baseBranch,
          projectId,
          vibeKanban,
          stateManager,
          currentRepo
        );
      }

      // 全タスク完了チェック
      if (isAllTasksCompleted(parsedIssue, maxTaskNumber)) {
        console.log("\n🎉 すべてのタスクが完了しました！");

        // PR自動作成
        ensurePullRequestCreated(issueNumber, issueBranch, baseBranch, parsedIssue);

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
 * 将来的なフォールバック用として残す
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
 * Phase完了を検出し、親Issue Workspace作成 → PR作成・マージ → 親Issue Done 待機を実行
 */
async function checkAndHandlePhaseCompletion(
  parsedIssue: ParsedIssue,
  issueNumber: number,
  issueBranch: string,
  vibeKanban: VibeKanbanClient,
  stateManager: TaskStateManager,
  currentRepo: VibeKanbanRepo
): Promise<void> {
  const completedPhases = getCompletedPhaseNumbers(parsedIssue);

  for (const phaseNumber of completedPhases) {
    if (mergedPhaseNumbers.has(phaseNumber)) {
      continue;
    }

    const mapping = stateManager.getParentIssueMapping(phaseNumber);
    if (!mapping) {
      console.warn(`   ⚠️ Phase ${phaseNumber} の親Issueマッピングが見つかりません`);
      continue;
    }

    console.log(`\n🎯 Phase ${phaseNumber} が完了 - Phase完了処理を開始`);

    // Step 1: 親Issue用Workspace作成（target = issue/N）
    //   → Vibe-KanbanがPRマージを追跡できるように
    try {
      const reposWithIssueBranch = [{ repo_id: currentRepo.id, base_branch: issueBranch }];

      await vibeKanban.startTaskAttempt(
        `[Issue${issueNumber} Phase${phaseNumber}] Phase merge`,
        "CLAUDE_CODE",
        reposWithIssueBranch,
        mapping.parentIssueId
      );
      console.log(`   ✅ 親Issue Workspace作成完了: Phase ${phaseNumber}`);
    } catch (error) {
      console.warn(`   ⚠️ 親Issue Workspace作成失敗: ${error}`);
      // Workspace作成失敗でもマージは続行
    }

    // Step 2: PR作成・自動マージ
    try {
      await mergePhaseBranchIntoIssue(issueNumber, phaseNumber, issueBranch);
      mergedPhaseNumbers.add(phaseNumber);
      console.log(`   ✅ Phase ${phaseNumber} マージ完了`);
    } catch (error) {
      console.error(`   ❌ Phase ${phaseNumber} のマージに失敗:`, error);
      throw error;
    }

    // Step 3: 親Issue自動Done待機
    //   → Vibe-KanbanがPRマージ検知して自動Doneにするのを待つ
    //   → タイムアウト時はフォールバックで手動Done
    await waitForParentIssueDone(vibeKanban, mapping.parentIssueId, phaseNumber);
  }
}

/**
 * 親IssueのDone状態を待機（タイムアウト付きフォールバック）
 */
async function waitForParentIssueDone(
  vibeKanban: VibeKanbanClient,
  parentIssueId: string,
  phaseNumber: number
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < PARENT_DONE_TIMEOUT_MS) {
    const issue = await vibeKanban.getTask(parentIssueId);
    if (issue?.status === "Done") {
      console.log(`   ✅ 親Issue Done確認: Phase ${phaseNumber}`);
      return;
    }
    await sleep(15_000);
  }

  // タイムアウト: 手動でDoneに更新
  console.warn(`   ⚠️ 親Issue Phase ${phaseNumber} の自動Done検知がタイムアウト。手動更新します。`);
  try {
    await vibeKanban.updateTask(parentIssueId, "Done");
    console.log(`   ✅ 親Issue 手動Done完了: Phase ${phaseNumber}`);
  } catch (error) {
    console.error(`   ❌ 親Issue Done更新失敗: Phase ${phaseNumber}`, error);
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
  stateManager: TaskStateManager,
  currentRepo: VibeKanbanRepo
): Promise<void> {
  // 着手可能なタスクグループを選定
  const executableGroups = await selectExecutableTaskGroups(parsedIssue, maxTaskNumber);

  if (executableGroups.length === 0) {
    console.log("   ⏸️  着手可能なタスクがありません");
    return;
  }

  console.log(`   📝 着手可能なタスク: ${executableGroups.length} 件`);

  // 既存の Vibe-Kanban タスクを取得（Cancelled 以外）
  const existingTasks = await vibeKanban.listTasks(projectId);

  // 対象Issueに属する既存タスクのタスクグループIDを収集
  const existingTaskGroupIdsForThisIssue = new Set<string>();
  const issuePatternInDesc = `GitHub Issue #${issueNumber}`;
  for (const task of existingTasks) {
    if (task.status === "Cancelled") {
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

    // サブIssue作成（親Issueの子として）
    const phaseMapping = stateManager.getParentIssueMapping(taskGroup.phaseNumber);
    if (!phaseMapping) {
      console.error(`   ❌ Phase ${taskGroup.phaseNumber} の親Issueマッピングが見つかりません`);
      continue;
    }

    console.log(
      `   📌 サブIssue作成: ${taskGroup.id} - ${taskGroup.name} (parent: Phase ${taskGroup.phaseNumber})`
    );
    const taskId = await vibeKanban.createSubIssue(
      projectId,
      phaseMapping.parentIssueId,
      title,
      description
    );

    // マッピング登録
    stateManager.registerTaskMapping(taskId, taskGroup.id);

    // ステータスを In Progress に更新
    await vibeKanban.updateTask(taskId, "In Progress");

    // タスク実行開始（Phase ブランチをベースに使用）
    const phaseBranch = getPhaseBranchNameNew(issueNumber, taskGroup.phaseNumber);
    try {
      const reposWithBranch = [{ repo_id: currentRepo.id, base_branch: phaseBranch }];
      const agentPrompt = generateAgentPrompt(taskGroup, issueNumber);
      const attempt = await vibeKanban.startTaskAttempt(
        agentPrompt,
        "CLAUDE_CODE",
        reposWithBranch,
        taskId
      );
      console.log(
        `   ▶️  タスク開始: ${taskGroup.id} (base: ${phaseBranch}, attempt: ${attempt?.id ?? "unknown"})`
      );

      // direnv allow 自動実行
      if (attempt?.id) {
        const worktreePath = await getWorktreePathByAttemptId(attempt.id);
        if (worktreePath) {
          const result = runDirenvAllow(worktreePath);
          if (result.success) {
            console.log(`   ✅ direnv allow 完了: ${worktreePath}`);
          } else {
            console.warn(`   ⚠️ direnv allow 失敗: ${result.error}`);
          }
        }
      }
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
  const doneTasks = existingTasks.filter((t) => t.status === "Done");

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

    // タイトルからIssue番号を抽出（新形式: [Issue22 5.1]）
    const titleIssueNum = extractIssueNumberFromTitle(task.title);
    let isTargetIssue = false;

    if (titleIssueNum === issueNumber) {
      // タイトルで一致した場合は対象
      isTargetIssue = true;
    } else {
      // 旧形式: descriptionで判定
      const taskDescription = descriptionCache.get(task.id);
      if (taskDescription?.includes(issuePattern)) {
        isTargetIssue = true;
      }
    }

    if (!isTargetIssue) {
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
