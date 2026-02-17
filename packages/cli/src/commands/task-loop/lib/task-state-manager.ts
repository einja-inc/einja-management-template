/**
 * タスク状態管理
 *
 * - Done 状態の変化を検出
 * - GitHub Issue のチェックボックスを更新
 * - 着手可能なタスクを取得
 */

import { getIssue, markTaskGroupAsCompleted, updateIssueBody } from "./github-client.js";
import { parseIssueBody } from "./issue-parser.js";
import type { ParsedIssue, Phase, PhaseIssueMapping, TaskGroup, VibeKanbanTask } from "./types.js";

/**
 * タスク状態マネージャー
 */
export class TaskStateManager {
  private previousDoneTaskIds: Set<string> = new Set();
  /** Vibe-Kanban タスク ID -> タスクグループ ID のマッピング */
  private vibeTaskToGroupMap: Map<string, string> = new Map();
  /** 対象Issue番号（フィルタリング用） */
  private targetIssueNumber: number | null = null;
  /** Phase番号 -> 親Issue マッピング */
  private phaseToParentIssue: Map<number, PhaseIssueMapping> = new Map();
  /** 親Issue IDセット（フィルタリング用） */
  private parentIssueIds: Set<string> = new Set();

  /**
   * タスクが対象Issueに属するかチェック
   */
  private isTaskForTargetIssue(
    task: VibeKanbanTask,
    descriptionCache?: Map<string, string | null>
  ): boolean {
    if (this.targetIssueNumber === null) return true;

    // 新形式: タイトルからIssue番号を抽出
    const titleIssueNum = extractIssueNumberFromTitle(task.title);
    if (titleIssueNum === this.targetIssueNumber) return true;

    // 旧形式: descriptionで判定
    if (descriptionCache) {
      const desc = descriptionCache.get(task.id);
      if (desc?.includes(`GitHub Issue #${this.targetIssueNumber}`)) return true;
    }
    return false;
  }

  /**
   * Phase -> 親Issue マッピングを登録
   */
  registerPhaseMapping(phaseNumber: number, mapping: PhaseIssueMapping): void {
    // 既存マッピングの古いIDを削除（再登録時の孤立ID防止）
    const existing = this.phaseToParentIssue.get(phaseNumber);
    if (existing) {
      this.parentIssueIds.delete(existing.parentIssueId);
    }
    this.phaseToParentIssue.set(phaseNumber, mapping);
    this.parentIssueIds.add(mapping.parentIssueId);
    console.log(`   🔗 Phase マッピング登録: Phase ${phaseNumber} → ${mapping.parentIssueId}`);
  }

  /**
   * Phase番号から親Issueマッピングを取得
   */
  getParentIssueMapping(phaseNumber: number): PhaseIssueMapping | undefined {
    return this.phaseToParentIssue.get(phaseNumber);
  }

  /**
   * 親Issueかどうか判定（IDベース）
   * Done検知フィルタリングで使用
   */
  isParentIssue(issueId: string): boolean {
    return this.parentIssueIds.has(issueId);
  }

  /**
   * Vibe-Kanban タスク ID とタスクグループ ID のマッピングを登録
   */
  registerTaskMapping(vibeTaskId: string, taskGroupId: string): void {
    this.vibeTaskToGroupMap.set(vibeTaskId, taskGroupId);
    console.log(`   🔗 マッピング登録: ${vibeTaskId} → ${taskGroupId}`);
  }

  /**
   * 現在の Done タスク ID 一覧を設定（初期化用）
   * @param tasks 全タスク一覧
   * @param issueNumber 対象Issue番号（フィルタリング用、省略時は全件対象）
   * @param descriptionCache タスクID -> description のキャッシュ（旧形式タスクのIssue判定用）
   */
  initializeDoneTaskIds(
    tasks: VibeKanbanTask[],
    issueNumber?: number,
    descriptionCache?: Map<string, string | null>
  ): void {
    // Issue番号を保持
    if (issueNumber !== undefined) {
      this.targetIssueNumber = issueNumber;
    }

    // フィルタリング適用（対象Issue番号がある場合のみ）
    const doneTasks = tasks
      .filter((t) => t.status === "done")
      .filter((t) => this.isTaskForTargetIssue(t, descriptionCache));

    this.previousDoneTaskIds = new Set(doneTasks.map((t) => t.id));

    // ログ出力
    console.log(`🔧 初期化: previousDoneTaskIds に ${doneTasks.length} 件を登録`);
    if (issueNumber !== undefined && doneTasks.length > 0) {
      console.log(`   (Issue #${issueNumber} 関連: ${doneTasks.length} 件)`);
      for (const task of doneTasks) {
        const taskGroupId = extractTaskGroupIdFromTitle(task.title);
        console.log(`   - ${taskGroupId || task.title}`);
      }
    }
  }

  /**
   * Done 状態の変化を検出
   * @param currentTasks 現在のタスク一覧
   * @param descriptionCache タスクID -> description のキャッシュ（旧形式タスクのIssue判定用）
   * @returns 新たに Done になったタスクの ID 一覧
   */
  detectNewlyCompletedTasks(
    currentTasks: VibeKanbanTask[],
    descriptionCache?: Map<string, string | null>
  ): string[] {
    // 対象Issueに関連するタスクのみフィルタリング
    const relevantTasks = currentTasks.filter((t) =>
      this.isTaskForTargetIssue(t, descriptionCache)
    );

    const currentDoneIds = new Set(
      relevantTasks.filter((t) => t.status === "done").map((t) => t.id)
    );

    // デバッグ: 比較情報を出力
    console.log(
      `   🔍 Done検出: 現在Done=${currentDoneIds.size}件, 前回Done=${this.previousDoneTaskIds.size}件`
    );

    const newlyCompletedIds: string[] = [];
    for (const id of Array.from(currentDoneIds)) {
      if (!this.previousDoneTaskIds.has(id)) {
        newlyCompletedIds.push(id);
        console.log(`      🆕 新規完了検出: ${id}`);
      }
    }

    if (newlyCompletedIds.length === 0 && currentDoneIds.size > 0) {
      console.log("      ℹ️  全てのDoneタスクは既に検出済み");
    }

    // 状態を更新
    this.previousDoneTaskIds = currentDoneIds;

    return newlyCompletedIds;
  }

  /**
   * 新たに完了したタスクに対応するタスクグループ ID を取得
   */
  getCompletedTaskGroupIds(newlyCompletedVibeTaskIds: string[]): string[] {
    const taskGroupIds: string[] = [];
    for (const vibeTaskId of newlyCompletedVibeTaskIds) {
      const taskGroupId = this.vibeTaskToGroupMap.get(vibeTaskId);
      if (taskGroupId) {
        taskGroupIds.push(taskGroupId);
        console.log(`   📎 マッピング成功: ${vibeTaskId} → ${taskGroupId}`);
      } else {
        console.log(`   ⚠️ マッピング失敗: ${vibeTaskId} (登録されていません)`);
      }
    }
    return taskGroupIds;
  }

  /**
   * GitHub Issue のタスクグループを完了マークに更新
   */
  async markTaskGroupsAsCompleted(
    issueNumber: number,
    taskGroupIds: string[]
  ): Promise<ParsedIssue> {
    if (taskGroupIds.length === 0) {
      // 変更なし、現在の Issue を取得して返す
      const issue = getIssue(issueNumber);
      return parseIssueBody(issue);
    }

    // Issue 本文を取得
    const issue = getIssue(issueNumber);
    let updatedBody = issue.body;

    // 各タスクグループを完了マークに更新
    for (const taskGroupId of taskGroupIds) {
      updatedBody = markTaskGroupAsCompleted(updatedBody, taskGroupId);
      console.log(`✅ タスクグループ ${taskGroupId} を完了マークに更新`);
    }

    // Issue 本文を更新
    updateIssueBody(issueNumber, updatedBody);

    // 更新後の Issue を再取得して返す
    const updatedIssue = getIssue(issueNumber);
    return parseIssueBody(updatedIssue);
  }
}

/**
 * Vibe-Kanban タスクのタイトルからタスクグループ ID を抽出
 * タイトル形式: "[IssueXX Y.Z] タスク名" または "[Y.Z] タスク名"（後方互換）
 */
export function extractTaskGroupIdFromTitle(title: string): string | null {
  // 新形式: [Issue22 1.2] タスク名
  const newMatch = title.match(/\[Issue\d+\s+(\d+\.\d+)\]/);
  if (newMatch) return newMatch[1];

  // 旧形式: [1.2] タスク名（後方互換）
  const oldMatch = title.match(/\[(\d+\.\d+)\]/);
  return oldMatch ? oldMatch[1] : null;
}

/**
 * Vibe-Kanban タスクのタイトルから Issue 番号を抽出
 * タイトル形式: "[IssueXX Y.Z] タスク名" または "[IssueXX PhaseM] Phase名"
 */
export function extractIssueNumberFromTitle(title: string): number | null {
  // サブIssue形式: [Issue22 1.2] タスク名
  const subMatch = title.match(/\[Issue(\d+)\s+\d+\.\d+\]/);
  if (subMatch) return Number.parseInt(subMatch[1], 10);

  // 親Issue形式: [Issue22 Phase1] Phase名
  const parentMatch = title.match(/\[Issue(\d+)\s+Phase\d+\]/);
  if (parentMatch) return Number.parseInt(parentMatch[1], 10);

  return null;
}

/**
 * タスクグループ用の Vibe-Kanban タスクタイトルを生成
 */
export function generateVibeKanbanTitle(taskGroup: TaskGroup, issueNumber: number): string {
  return `[Issue${issueNumber} ${taskGroup.id}] ${taskGroup.name}`;
}

/**
 * Phase用の Vibe-Kanban 親Issueタイトルを生成
 * 形式: [Issue{N} Phase{M}] {Phase名}
 */
export function generateParentIssueTitle(phase: Phase, issueNumber: number): string {
  return `[Issue${issueNumber} Phase${phase.number}] ${phase.name}`;
}

/**
 * Phase用の Vibe-Kanban 親Issue説明文を生成
 */
export function generateParentIssueDescription(phase: Phase, issueNumber: number): string {
  const taskGroupList = phase.taskGroups
    .map((tg) => `- ${tg.id}: ${tg.name}`)
    .join("\n");

  return `## Phase ${phase.number}: ${phase.name}

GitHub Issue #${issueNumber} の Phase ${phase.number} を管理する親Issueです。

## 含まれるタスクグループ

${taskGroupList || "(タスクグループなし)"}

## 完了条件
Phase 内のすべてのサブIssue（タスクグループ）が完了すること。
`;
}

/**
 * 親IssueのタイトルからPhase番号を抽出
 * タイトル形式: "[IssueXX PhaseM] Phase名"
 */
export function extractPhaseNumberFromTitle(title: string): number | null {
  const match = title.match(/\[Issue\d+\s+Phase(\d+)\]/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * タスクグループ用の Vibe-Kanban タスク説明を生成
 */
export function generateVibeKanbanDescription(taskGroup: TaskGroup, issueNumber: number): string {
  const taskList = taskGroup.tasks
    .map((t) => `### タスク ${t.id}: ${t.name}\n${t.subtasks.map((s) => `- ${s}`).join("\n")}`)
    .join("\n\n");

  return `## 🚀 最初に実行するコマンド

以下のコマンドを実行してタスクを開始してください：

\`\`\`
claude "/einja:task-exec #${issueNumber} ${taskGroup.id}"
\`\`\`

---

## タスクファイル
\`GitHub Issue #${issueNumber}\`

## タスクグループ番号
${taskGroup.id}

## タスク一覧

${taskList || "(個別タスクなし)"}

## 完了条件
${taskGroup.completionCriteria || "(未定義)"}
`;
}
