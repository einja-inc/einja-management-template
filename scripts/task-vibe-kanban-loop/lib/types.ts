/**
 * タスク自動実行ループ - 型定義
 */

/** コマンドライン引数 */
export interface LoopArgs {
  issueNumber: number;
  maxTaskNumber?: string; // "all" | "1.2" | "4" (Phase) | "4.2" (タスクグループ)
  baseBranch?: string;
}

/** タスクのステータス */
export type TaskStatus = "pending" | "completed" | "in-progress";

/** 個別タスク */
export interface Task {
  id: string; // "1.1.1", "1.1.2" など
  name: string;
  subtasks: string[];
}

/** タスクグループ情報 */
export interface TaskGroup {
  id: string; // "1.1", "2.3" など
  name: string;
  phaseNumber: number;
  status: TaskStatus;
  dependencies: string[]; // ["1.1", "1.2"] or ["Phase 1完了"] or ["#123"]
  completionCriteria: string;
  tasks: Task[];
}

/** Phase情報 */
export interface Phase {
  number: number;
  name: string;
  taskGroups: TaskGroup[];
}

/** Issue解析結果 */
export interface ParsedIssue {
  issueNumber: number;
  title: string;
  body: string;
  phases: Phase[];
}

/** GitHub Issue の生データ */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
}

/** リポジトリ情報 */
export interface RepoInfo {
  owner: string;
  name: string;
  defaultBranch: string;
}

/** Vibe-Kanban プロジェクト */
export interface VibeKanbanProject {
  id: string;
  name: string;
  git_repo_path: string;
}

/** Vibe-Kanban タスク */
export interface VibeKanbanTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
}

/** Vibe-Kanban タスク実行試行 */
export interface VibeKanbanAttempt {
  id: string;
  task_id: string;
  executor: string;
  base_branch: string;
}

/** Vibe-Kanban リポジトリ */
export interface VibeKanbanRepo {
  id: string;
  name: string;
}

/** ループ状態 */
export interface LoopState {
  issueNumber: number;
  maxTaskNumber?: string;
  baseBranch: string;
  vibeKanbanProjectId: string;
  issueBranch: string;
  /** タスクグループID -> Vibe-KanbanタスクID */
  createdTaskIds: Map<string, string>;
  /** 前回のポーリング時点での Done タスクID一覧 */
  previousDoneTaskIds: Set<string>;
}

/** ログレベル */
export type LogLevel = "info" | "warn" | "error" | "debug";
