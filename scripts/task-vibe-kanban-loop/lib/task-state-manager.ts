/**
 * タスク状態管理
 *
 * - Done 状態の変化を検出
 * - GitHub Issue のチェックボックスを更新
 * - 着手可能なタスクを取得
 */

import { getIssue, markTaskGroupAsCompleted, updateIssueBody } from "./github-client.js";
import { parseIssueBody } from "./issue-parser.js";
import type { ParsedIssue, TaskGroup, VibeKanbanTask } from "./types.js";

/**
 * タスク状態マネージャー
 */
export class TaskStateManager {
  private previousDoneTaskIds: Set<string> = new Set();
  /** Vibe-Kanban タスク ID -> タスクグループ ID のマッピング */
  private vibeTaskToGroupMap: Map<string, string> = new Map();

  /**
   * Vibe-Kanban タスク ID とタスクグループ ID のマッピングを登録
   */
  registerTaskMapping(vibeTaskId: string, taskGroupId: string): void {
    this.vibeTaskToGroupMap.set(vibeTaskId, taskGroupId);
    console.log(`   🔗 マッピング登録: ${vibeTaskId} → ${taskGroupId}`);
  }

  /**
   * 現在の Done タスク ID 一覧を設定（初期化用）
   */
  initializeDoneTaskIds(tasks: VibeKanbanTask[]): void {
    const doneTasks = tasks.filter((t) => t.status === "done");
    this.previousDoneTaskIds = new Set(doneTasks.map((t) => t.id));
    console.log(`🔧 初期化: previousDoneTaskIds に ${doneTasks.length} 件を登録`);
    for (const task of doneTasks) {
      console.log(`   - ${task.id} (${task.title})`);
    }
  }

  /**
   * Done 状態の変化を検出
   * @returns 新たに Done になったタスクの ID 一覧
   */
  detectNewlyCompletedTasks(currentTasks: VibeKanbanTask[]): string[] {
    const currentDoneIds = new Set(
      currentTasks.filter((t) => t.status === "done").map((t) => t.id)
    );

    // デバッグ: 比較情報を出力
    console.log(`   🔍 Done検出: 現在Done=${currentDoneIds.size}件, 前回Done=${this.previousDoneTaskIds.size}件`);

    const newlyCompletedIds: string[] = [];
    for (const id of Array.from(currentDoneIds)) {
      if (!this.previousDoneTaskIds.has(id)) {
        newlyCompletedIds.push(id);
        console.log(`      🆕 新規完了検出: ${id}`);
      }
    }

    if (newlyCompletedIds.length === 0 && currentDoneIds.size > 0) {
      console.log(`      ℹ️  全てのDoneタスクは既に検出済み`);
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
 * タイトル形式: "[Issue番号 X.Y] タスク名" または "[X.Y] タスク名" (後方互換)
 */
export function extractTaskGroupIdFromTitle(title: string): string | null {
  // 新形式: [Issue番号 X.Y]
  const newMatch = title.match(/\[Issue\d+\s+(\d+\.\d+)\]/);
  if (newMatch) {
    return newMatch[1];
  }
  // 旧形式: [X.Y] (後方互換)
  const oldMatch = title.match(/\[(\d+\.\d+)\]/);
  return oldMatch ? oldMatch[1] : null;
}

/**
 * タスクグループ用の Vibe-Kanban タスクタイトルを生成
 * タイトル形式: "[Issue番号 X.Y] タスク名"
 */
export function generateVibeKanbanTitle(taskGroup: TaskGroup, issueNumber: number): string {
  return `[Issue${issueNumber} ${taskGroup.id}] ${taskGroup.name}`;
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
/task-exec #${issueNumber} ${taskGroup.id}
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
