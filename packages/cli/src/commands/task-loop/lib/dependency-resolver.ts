/**
 * 依存関係解析・タスク選定
 *
 * タスク選定ロジックの TypeScript 実装
 */

import { isIssueClosed } from "./github-client.js";
import { getAllTaskGroups, getCompletedTaskGroupIds } from "./issue-parser.js";
import { isWithinRange, sortTaskNumbers } from "./task-number-utils.js";
import type { ParsedIssue, Phase, TaskGroup } from "./types.js";

/**
 * 依存関係が満たされているかチェック
 */
export function isDependencySatisfied(
  taskGroup: TaskGroup,
  completedGroups: Set<string>,
  phases: Phase[]
): boolean {
  for (const dep of taskGroup.dependencies) {
    // Phase 依存: "Phase X完了" パターン
    const phaseDepMatch = dep.match(/Phase\s*(\d+)\s*完了/i);
    if (phaseDepMatch) {
      const phaseNumber = Number.parseInt(phaseDepMatch[1], 10);
      if (!isPhaseCompleted(phases, phaseNumber, completedGroups)) {
        return false;
      }
      continue;
    }

    // Issue 依存: "#123" パターン
    const issueDepMatch = dep.match(/^#(\d+)$/);
    if (issueDepMatch) {
      // 同期的にはチェックできないので、ここでは true を返す
      // 実際のチェックは checkExternalIssueDependencies で行う
      continue;
    }

    // タスクグループ依存: "X.Y" パターン
    if (!completedGroups.has(dep)) {
      return false;
    }
  }

  return true;
}

/**
 * 外部 Issue 依存をチェック（非同期）
 */
export async function checkExternalIssueDependencies(taskGroup: TaskGroup): Promise<boolean> {
  for (const dep of taskGroup.dependencies) {
    const issueDepMatch = dep.match(/^#(\d+)$/);
    if (issueDepMatch) {
      const issueNumber = Number.parseInt(issueDepMatch[1], 10);
      const closed = isIssueClosed(issueNumber);
      if (!closed) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Phase が完了しているかチェック
 */
export function isPhaseCompleted(
  phases: Phase[],
  phaseNumber: number,
  completedGroups: Set<string>
): boolean {
  const phase = phases.find((p) => p.number === phaseNumber);
  if (!phase) {
    return false;
  }

  // Phase 内のすべてのタスクグループが完了しているか
  return phase.taskGroups.every((tg) => completedGroups.has(tg.id));
}

/**
 * 完了した Phase 番号一覧を取得
 */
export function getCompletedPhaseNumbers(parsedIssue: ParsedIssue): number[] {
  const completedGroups = getCompletedTaskGroupIds(parsedIssue);
  return parsedIssue.phases
    .filter((phase) => isPhaseCompleted(parsedIssue.phases, phase.number, completedGroups))
    .map((phase) => phase.number);
}

/**
 * 実行可能なタスクグループを選定
 *
 * @param parsedIssue 解析済み Issue
 * @param maxTaskNumber 最大タスク番号（オプション）
 * @returns 実行可能なタスクグループの配列
 */
export async function selectExecutableTaskGroups(
  parsedIssue: ParsedIssue,
  maxTaskNumber?: string
): Promise<TaskGroup[]> {
  const completedGroups = getCompletedTaskGroupIds(parsedIssue);
  // pending または in-progress のタスクグループを対象とする
  // (in-progress は着手中マーク付きだが Vibe-Kanban 未登録の可能性がある)
  const candidateGroups = getAllTaskGroups(parsedIssue).filter((tg) => tg.status !== "completed");

  // 実行可能なタスクグループをフィルタ
  const executableGroups: TaskGroup[] = [];

  for (const taskGroup of candidateGroups) {
    // 最大タスク番号の範囲内かチェック
    if (!isWithinRange(taskGroup.id, maxTaskNumber)) {
      continue;
    }

    // 依存関係が満たされているかチェック
    if (!isDependencySatisfied(taskGroup, completedGroups, parsedIssue.phases)) {
      continue;
    }

    // 外部 Issue 依存をチェック
    const externalSatisfied = await checkExternalIssueDependencies(taskGroup);
    if (!externalSatisfied) {
      continue;
    }

    executableGroups.push(taskGroup);
  }

  // タスク番号順にソート
  return executableGroups.sort((a, b) => {
    const sorted = sortTaskNumbers([a.id, b.id]);
    return sorted[0] === a.id ? -1 : 1;
  });
}

/**
 * 次に実行すべきタスクグループを1つ選定
 *
 * @deprecated selectExecutableTaskGroups を使用してください
 */
export async function selectNextTaskGroup(
  parsedIssue: ParsedIssue,
  maxTaskNumber?: string
): Promise<TaskGroup | null> {
  const executableGroups = await selectExecutableTaskGroups(parsedIssue, maxTaskNumber);
  return executableGroups[0] ?? null;
}

/**
 * すべてのタスクが完了したかチェック
 */
export function isAllTasksCompleted(parsedIssue: ParsedIssue, maxTaskNumber?: string): boolean {
  const allTaskGroups = getAllTaskGroups(parsedIssue);

  for (const taskGroup of allTaskGroups) {
    // 最大タスク番号の範囲内のタスクのみチェック
    if (!isWithinRange(taskGroup.id, maxTaskNumber)) {
      continue;
    }

    if (taskGroup.status !== "completed") {
      return false;
    }
  }

  return true;
}

/**
 * 循環依存をチェック
 */
export function detectCircularDependencies(parsedIssue: ParsedIssue): string[] | null {
  const allTaskGroups = getAllTaskGroups(parsedIssue);
  const taskGroupMap = new Map<string, TaskGroup>();

  for (const tg of allTaskGroups) {
    taskGroupMap.set(tg.id, tg);
  }

  // DFS で循環検出
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(taskGroupId: string): string[] | null {
    if (recursionStack.has(taskGroupId)) {
      // 循環検出
      const cycleStart = path.indexOf(taskGroupId);
      return [...path.slice(cycleStart), taskGroupId];
    }

    if (visited.has(taskGroupId)) {
      return null;
    }

    visited.add(taskGroupId);
    recursionStack.add(taskGroupId);
    path.push(taskGroupId);

    const taskGroup = taskGroupMap.get(taskGroupId);
    if (taskGroup) {
      for (const dep of taskGroup.dependencies) {
        // タスクグループ依存のみチェック（X.Y 形式）
        if (/^\d+\.\d+$/.test(dep)) {
          const cycle = dfs(dep);
          if (cycle) {
            return cycle;
          }
        }
      }
    }

    recursionStack.delete(taskGroupId);
    path.pop();
    return null;
  }

  for (const tg of allTaskGroups) {
    const cycle = dfs(tg.id);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}
