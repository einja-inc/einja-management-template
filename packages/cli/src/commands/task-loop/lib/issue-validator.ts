/**
 * GitHub Issue タスク一覧バリデーター
 *
 * タスク管理ガイドラインに基づいてフォーマットを検証
 */

import type { ParsedIssue } from "./types.js";

/** バリデーションエラー種別 */
export type ValidationErrorType =
  | "phase_number_discontinuous"
  | "invalid_task_group_id"
  | "invalid_task_id"
  | "missing_metadata"
  | "invalid_dependency_format"
  | "missing_dependency_target"
  | "invalid_indent"
  | "too_many_phases"
  | "horizontal_split_detected";

/** バリデーションエラー */
export interface ValidationError {
  type: ValidationErrorType;
  taskId?: string;
  taskGroupId?: string;
  phaseNumber?: number;
  line?: number;
  message: string;
  fixSuggestion: string;
}

/** バリデーション結果 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/** 必須メタデータ一覧 */
const REQUIRED_METADATA = [
  "要件",
  "依存関係",
  "完了条件",
  "対応設計",
  "シナリオテスト",
] as const;

/**
 * Issue本文をバリデーション
 */
export function validateIssueBody(body: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Phase検証
  errors.push(...validatePhaseStructure(body));

  // インデント検証
  errors.push(...validateIndentation(body));

  // メタデータ検証
  errors.push(...validateMetadata(body));

  // 依存関係検証
  errors.push(...validateDependencies(body));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 解析済みIssueをバリデーション
 */
export function validateParsedIssue(
  parsedIssue: ParsedIssue
): ValidationResult {
  const errors: ValidationError[] = [];

  // Phase番号の連番チェック
  const phaseNumbers = parsedIssue.phases
    .map((p) => p.number)
    .sort((a, b) => a - b);
  for (let i = 0; i < phaseNumbers.length; i++) {
    const expected = i + 1;
    const actual = phaseNumbers[i];
    // Phase 99 はドキュメント反映専用なので例外
    if (actual !== expected && actual !== 99) {
      errors.push({
        type: "phase_number_discontinuous",
        phaseNumber: actual,
        message: `Phase番号が不連続です: 期待=${expected}, 実際=${actual}`,
        fixSuggestion: `Phase ${actual} を Phase ${expected} に変更してください`,
      });
    }
  }

  // Phase数チェック（99を除く）
  const regularPhases = parsedIssue.phases.filter((p) => p.number !== 99);
  if (regularPhases.length > 3) {
    errors.push({
      type: "too_many_phases",
      message: `Phase数が多すぎます: ${regularPhases.length}個（推奨: 2-3個）`,
      fixSuggestion: "関連するPhaseを統合してください",
    });
  }

  // タスクグループID形式チェック
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      if (!isValidTaskGroupId(taskGroup.id)) {
        errors.push({
          type: "invalid_task_group_id",
          taskGroupId: taskGroup.id,
          phaseNumber: phase.number,
          message: `タスクグループIDが不正です: ${taskGroup.id}`,
          fixSuggestion: "X.Y 形式（例: 1.1, 2.3）で記述してください",
        });
      }

      // タスクID形式チェック
      for (const task of taskGroup.tasks) {
        if (!isValidTaskId(task.id, taskGroup.id)) {
          errors.push({
            type: "invalid_task_id",
            taskId: task.id,
            taskGroupId: taskGroup.id,
            message: `タスクIDが不正です: ${task.id}`,
            fixSuggestion: `${taskGroup.id}.N 形式（例: ${taskGroup.id}.1）で記述してください`,
          });
        }
      }
    }
  }

  // 依存関係の参照先チェック
  const allTaskGroupIds = getAllTaskGroupIds(parsedIssue);
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      for (const dep of taskGroup.dependencies) {
        // "Phase X完了" 形式はスキップ
        if (dep.startsWith("Phase ")) continue;
        // Issue参照 (#123) はスキップ
        if (dep.startsWith("#")) continue;

        if (!allTaskGroupIds.has(dep)) {
          errors.push({
            type: "missing_dependency_target",
            taskGroupId: taskGroup.id,
            message: `存在しない依存関係: ${dep}（タスクグループ ${taskGroup.id}）`,
            fixSuggestion: `依存先 ${dep} が存在するか確認してください`,
          });
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Phase構造を検証
 */
function validatePhaseStructure(body: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const phasePattern = /^###\s*Phase\s*(\d+):/gim;
  const matches = [...body.matchAll(phasePattern)];

  const phaseNumbers = matches
    .map((m) => Number.parseInt(m[1], 10))
    .sort((a, b) => a - b);

  for (let i = 0; i < phaseNumbers.length; i++) {
    const expected = i + 1;
    const actual = phaseNumbers[i];
    if (actual !== expected && actual !== 99) {
      errors.push({
        type: "phase_number_discontinuous",
        phaseNumber: actual,
        message: `Phase番号が不連続です: 期待=${expected}, 実際=${actual}`,
        fixSuggestion: `Phase ${actual} を Phase ${expected} に変更してください`,
      });
    }
  }

  return errors;
}

/**
 * インデント検証
 */
function validateIndentation(body: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // タスク行の検証（X.Y.Z 形式）
    const taskMatch = line.match(/^(\s*)-\s*(\d+\.\d+\.\d+)\s/);
    if (taskMatch) {
      const indent = taskMatch[1].length;
      if (indent !== 2) {
        errors.push({
          type: "invalid_indent",
          line: i + 1,
          message: `タスクのインデントが不正です（期待: 2スペース、実際: ${indent}スペース）`,
          fixSuggestion: "タスク行は2スペースでインデントしてください",
        });
      }
    }

    // メタデータ行の検証（**要件**: など）
    const metadataMatch = line.match(
      /^(\s*)-?\s*\*\*(要件|依存関係|完了条件|対応設計|シナリオテスト)\*\*:/
    );
    if (metadataMatch) {
      const indent = metadataMatch[1].length;
      if (indent !== 4) {
        errors.push({
          type: "invalid_indent",
          line: i + 1,
          message: `メタデータのインデントが不正です（期待: 4スペース、実際: ${indent}スペース）`,
          fixSuggestion: "メタデータ行は4スペースでインデントしてください",
        });
      }
    }
  }

  return errors;
}

/**
 * メタデータ検証
 */
function validateMetadata(body: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = body.split("\n");

  // タスク（X.Y.Z）ごとにメタデータをチェック
  let currentTaskId: string | null = null;
  let currentTaskMetadata: Set<string> = new Set();
  let taskStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // 新しいタスク行の検出
    const taskMatch = line.match(/^\s*-\s*(\d+\.\d+\.\d+)\s/);
    if (taskMatch) {
      // 前のタスクのメタデータをチェック
      if (currentTaskId) {
        const missing = REQUIRED_METADATA.filter(
          (m) => !currentTaskMetadata.has(m)
        );
        for (const m of missing) {
          errors.push({
            type: "missing_metadata",
            taskId: currentTaskId,
            line: taskStartLine,
            message: `タスク ${currentTaskId} に必須メタデータがありません: ${m}`,
            fixSuggestion: `**${m}**: [内容] を追加してください`,
          });
        }
      }

      currentTaskId = taskMatch[1];
      currentTaskMetadata = new Set();
      taskStartLine = i + 1;
    }

    // メタデータ行の検出
    const metadataMatch = line.match(
      /\*\*(要件|依存関係|完了条件|対応設計|シナリオテスト)\*\*:/
    );
    if (metadataMatch && currentTaskId) {
      currentTaskMetadata.add(metadataMatch[1]);
    }

    // タスクグループ行（新しいセクション）の検出
    const taskGroupMatch = line.match(/^-\s*\[[ xX]\]\s*\d+\.\d+\s/);
    if (taskGroupMatch && currentTaskId) {
      // 前のタスクのメタデータをチェック
      const missing = REQUIRED_METADATA.filter(
        (m) => !currentTaskMetadata.has(m)
      );
      for (const m of missing) {
        errors.push({
          type: "missing_metadata",
          taskId: currentTaskId,
          line: taskStartLine,
          message: `タスク ${currentTaskId} に必須メタデータがありません: ${m}`,
          fixSuggestion: `**${m}**: [内容] を追加してください`,
        });
      }
      currentTaskId = null;
      currentTaskMetadata = new Set();
    }
  }

  // 最後のタスクのチェック
  if (currentTaskId) {
    const missing = REQUIRED_METADATA.filter(
      (m) => !currentTaskMetadata.has(m)
    );
    for (const m of missing) {
      errors.push({
        type: "missing_metadata",
        taskId: currentTaskId,
        line: taskStartLine,
        message: `タスク ${currentTaskId} に必須メタデータがありません: ${m}`,
        fixSuggestion: `**${m}**: [内容] を追加してください`,
      });
    }
  }

  return errors;
}

/**
 * 依存関係検証
 */
function validateDependencies(body: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const depMatch = line.match(/\*\*依存関係\*\*:\s*(.+)$/);
    if (depMatch) {
      const depText = depMatch[1].trim();
      if (depText === "なし" || depText === "-") continue;

      const deps = depText.split(/[,、]/).map((d) => d.trim());
      for (const dep of deps) {
        // 無効な形式をチェック
        if (dep.match(/^\d+\.\d+完了$/)) {
          errors.push({
            type: "invalid_dependency_format",
            line: i + 1,
            message: `依存関係の書式が不正です: "${dep}"（task:loop非互換）`,
            fixSuggestion: `"${dep}" → "${dep.replace("完了", "")}" に変更してください`,
          });
        }
        if (dep.match(/^タスク\d+\.\d+$/)) {
          errors.push({
            type: "invalid_dependency_format",
            line: i + 1,
            message: `依存関係の書式が不正です: "${dep}"（task:loop非互換）`,
            fixSuggestion: `"${dep}" → "${dep.replace("タスク", "")}" に変更してください`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * タスクグループIDの形式チェック
 */
function isValidTaskGroupId(id: string): boolean {
  return /^\d+\.\d+$/.test(id);
}

/**
 * タスクIDの形式チェック
 */
function isValidTaskId(taskId: string, taskGroupId: string): boolean {
  const pattern = new RegExp(`^${taskGroupId.replace(".", "\\.")}\\.\\d+$`);
  return pattern.test(taskId);
}

/**
 * 全タスクグループIDを取得
 */
function getAllTaskGroupIds(parsedIssue: ParsedIssue): Set<string> {
  const ids = new Set<string>();
  for (const phase of parsedIssue.phases) {
    for (const taskGroup of phase.taskGroups) {
      ids.add(taskGroup.id);
    }
  }
  return ids;
}

/**
 * エラーをMarkdown形式でフォーマット
 */
export function formatValidationErrors(
  result: ValidationResult,
  retryCount: number,
  maxRetries: number
): string {
  if (result.isValid) {
    return `## バリデーション結果: SUCCESS

タスク一覧のフォーマットは正しいです。
次のフェーズに進んでください。`;
  }

  const errorList = result.errors
    .map((error, index) => {
      const location = error.taskId
        ? `**タスク ${error.taskId}**`
        : error.taskGroupId
          ? `**タスクグループ ${error.taskGroupId}**`
          : error.line
            ? `**行 ${error.line}**`
            : `**Phase ${error.phaseNumber}**`;

      return `${index + 1}. ${location} - ${error.type}
   - 問題: ${error.message}
   - 修正案: ${error.fixSuggestion}`;
    })
    .join("\n\n");

  const remaining = maxRetries - retryCount;

  if (remaining <= 0) {
    return `## バリデーション結果: MAX_RETRIES_EXCEEDED

${maxRetries}回の試行で検証に合格しませんでした。

### 最終エラー一覧

${errorList}

### 次のアクション
ユーザーに手動での修正を依頼してください。
自動修正では解決できない構造的な問題がある可能性があります。`;
  }

  return `## バリデーション結果: FAILURE

### エラー一覧

${errorList}

### リトライ情報
- 現在の試行回数: ${retryCount}
- 最大試行回数: ${maxRetries}
- 残り試行回数: ${remaining}

### 次のアクション
spec-tasks-generator に差し戻し、上記エラーを修正した新しいタスク一覧を生成してください。`;
}
