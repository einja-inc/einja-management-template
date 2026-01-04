/**
 * GitHub Issue Markdown パーサー
 *
 * Issue 本文からタスク構造を抽出
 */

import type { GitHubIssue, ParsedIssue, Phase, Task, TaskGroup, TaskStatus } from "./types.js";

/**
 * Issue 本文を解析してタスク構造を抽出
 */
export function parseIssueBody(issue: GitHubIssue): ParsedIssue {
  const phases = extractPhases(issue.body);

  return {
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body,
    phases,
  };
}

/**
 * Phase 構造を抽出
 */
function extractPhases(body: string): Phase[] {
  const phases: Phase[] = [];

  // "### Phase X:" または "### Phase X:" パターンを検索
  const _phasePattern = /^###\s*Phase\s*(\d+):\s*(.*)$/gim;
  const lines = body.split("\n");

  let currentPhase: Phase | null = null;
  let currentTaskGroupLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const phaseMatch = line?.match(/^###\s*Phase\s*(\d+):\s*(.*)$/i);

    if (phaseMatch) {
      // 前の Phase を保存
      if (currentPhase) {
        currentPhase.taskGroups = extractTaskGroups(
          currentTaskGroupLines.join("\n"),
          currentPhase.number
        );
        phases.push(currentPhase);
      }

      // 新しい Phase を開始
      currentPhase = {
        number: Number.parseInt(phaseMatch[1], 10),
        name: phaseMatch[2].trim(),
        taskGroups: [],
      };
      currentTaskGroupLines = [];
    } else if (currentPhase && line !== undefined) {
      currentTaskGroupLines.push(line);
    }
  }

  // 最後の Phase を保存
  if (currentPhase) {
    currentPhase.taskGroups = extractTaskGroups(
      currentTaskGroupLines.join("\n"),
      currentPhase.number
    );
    phases.push(currentPhase);
  }

  return phases;
}

/**
 * タスクグループを抽出
 */
function extractTaskGroups(content: string, phaseNumber: number): TaskGroup[] {
  const taskGroups: TaskGroup[] = [];

  // タスクグループパターン: - [ ] **X.Y タスク名** or - [x] **X.Y タスク名**
  const lines = content.split("\n");

  let currentTaskGroup: Partial<TaskGroup> | null = null;
  let currentTaskGroupContent: string[] = [];

  for (const line of lines) {
    // タスクグループ行のマッチ
    // ボールドあり: - [ ] **1.1 名前**
    // ボールドなし: - [ ] 1.1 名前
    const taskGroupMatch =
      line.match(/^(\s*)-\s*\[([ xX])\]\s*\*\*(\d+\.\d+)\s+(.+?)\*\*\s*$/) ||
      line.match(/^(\s*)-\s*\[([ xX])\]\s*(\d+\.\d+)\s+(.+)$/);

    if (taskGroupMatch) {
      // 前のタスクグループを保存
      if (currentTaskGroup?.id) {
        const fullContent = currentTaskGroupContent.join("\n");
        const metadata = parseMetadata(fullContent, currentTaskGroup.id);
        const tasks = extractTasks(fullContent, currentTaskGroup.id);

        taskGroups.push({
          id: currentTaskGroup.id,
          name: currentTaskGroup.name ?? "",
          phaseNumber,
          status: currentTaskGroup.status ?? "pending",
          dependencies: metadata.dependencies,
          completionCriteria: metadata.completionCriteria,
          tasks,
        });
      }

      // 新しいタスクグループを開始
      const checkboxStatus = taskGroupMatch[2];
      const taskGroupId = taskGroupMatch[3];
      const taskGroupName = taskGroupMatch[4];

      // ステータスはチェックボックスのみで判定
      // 着手中かどうかはVibe-Kanbanのタスク存在で判定する
      const status: TaskStatus = checkboxStatus.toLowerCase() === "x" ? "completed" : "pending";

      currentTaskGroup = {
        id: taskGroupId,
        name: taskGroupName.trim(),
        status,
      };
      currentTaskGroupContent = [line];
    } else if (currentTaskGroup) {
      currentTaskGroupContent.push(line);
    }
  }

  // 最後のタスクグループを保存
  if (currentTaskGroup?.id) {
    const fullContent = currentTaskGroupContent.join("\n");
    const metadata = parseMetadata(fullContent, currentTaskGroup.id);
    const tasks = extractTasks(fullContent, currentTaskGroup.id);

    taskGroups.push({
      id: currentTaskGroup.id,
      name: currentTaskGroup.name ?? "",
      phaseNumber,
      status: currentTaskGroup.status ?? "pending",
      dependencies: metadata.dependencies,
      completionCriteria: metadata.completionCriteria,
      tasks,
    });
  }

  return taskGroups;
}

/**
 * 個別タスクを抽出
 */
function extractTasks(content: string, taskGroupId: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");

  // タスクパターン: - X.Y.Z タスク名 または X.Y.Z タスク名
  const taskPattern = new RegExp(`^\\s*-?\\s*(${escapeRegex(taskGroupId)}\\.\\d+)\\s+(.+)$`);

  for (const line of lines) {
    const match = line.match(taskPattern);
    if (match) {
      tasks.push({
        id: match[1],
        name: match[2].trim(),
        subtasks: [],
      });
    }
  }

  return tasks;
}

/**
 * メタデータを抽出（依存関係、完了条件）
 *
 * 依存関係のパターン:
 * - タスクグループ間: X.Y（例: 1.1, 2.3）
 * - Phase間: Phase X完了
 * - Issue間: #123
 *
 * サブタスク間の依存関係（X.Y.Z形式）はタスクグループID（X.Y）に変換する
 * 自己参照（自分自身への依存）は除外する
 *
 * @param content タスクグループのコンテンツ
 * @param taskGroupId 処理中のタスクグループID（自己参照除外用）
 */
function parseMetadata(
  content: string,
  taskGroupId: string
): {
  dependencies: string[];
  completionCriteria: string;
} {
  const dependencies: string[] = [];
  let completionCriteria = "";

  const lines = content.split("\n");

  for (const line of lines) {
    // 依存関係: **依存関係**: ...
    const depMatch = line.match(/\*\*依存関係\*\*:\s*(.+)$/);
    if (depMatch) {
      const depText = depMatch[1].trim();
      if (depText === "なし" || depText === "-" || depText === "") {
        // 依存関係なし
      } else {
        // カンマ区切りまたは単一の依存関係
        const deps = depText.split(/[,、]/).map((d) => d.trim());
        // サブタスクID（X.Y.Z形式）をタスクグループID（X.Y）に変換
        for (const dep of deps) {
          let resolvedDep = dep;
          const subtaskMatch = dep.match(/^(\d+\.\d+)\.\d+$/);
          if (subtaskMatch) {
            // サブタスクID（X.Y.Z）をタスクグループID（X.Y）に変換
            resolvedDep = subtaskMatch[1];
          }
          // 自己参照を除外
          if (resolvedDep !== taskGroupId) {
            dependencies.push(resolvedDep);
          }
        }
      }
    }

    // 完了条件: **完了条件**: ...
    const criteriaMatch = line.match(/\*\*完了条件\*\*:\s*(.+)$/);
    if (criteriaMatch) {
      completionCriteria = criteriaMatch[1].trim();
    }
  }

  // 重複を除去
  const uniqueDeps = [...new Set(dependencies)];
  return { dependencies: uniqueDeps, completionCriteria };
}

/**
 * 正規表現のエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * タスクグループ ID からタスクグループを取得
 */
export function findTaskGroupById(parsedIssue: ParsedIssue, taskGroupId: string): TaskGroup | null {
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      if (taskGroup.id === taskGroupId) {
        return taskGroup;
      }
    }
  }
  return null;
}

/**
 * 全タスクグループをフラットなリストで取得
 */
export function getAllTaskGroups(parsedIssue: ParsedIssue): TaskGroup[] {
  const taskGroups: TaskGroup[] = [];
  for (const phase of parsedIssue.phases) {
    taskGroups.push(...phase.taskGroups);
  }
  return taskGroups;
}

/**
 * 完了済みタスクグループの ID 一覧を取得
 */
export function getCompletedTaskGroupIds(parsedIssue: ParsedIssue): Set<string> {
  const completedIds = new Set<string>();
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      if (taskGroup.status === "completed") {
        completedIds.add(taskGroup.id);
      }
    }
  }
  return completedIds;
}

/**
 * 未着手タスクグループの一覧を取得
 */
export function getPendingTaskGroups(parsedIssue: ParsedIssue): TaskGroup[] {
  const pending: TaskGroup[] = [];
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      if (taskGroup.status === "pending") {
        pending.push(taskGroup);
      }
    }
  }
  return pending;
}
