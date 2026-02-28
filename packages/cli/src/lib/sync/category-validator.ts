/**
 * カテゴリバリデーションユーティリティ
 * --onlyオプションで指定されたカテゴリの妥当性をチェック
 */

/**
 * 有効なカテゴリのリスト
 */
export const VALID_CATEGORIES = ["commands", "agents", "skills", "hooks", "docs", "scripts", "env", "tools"] as const;

/**
 * カテゴリの型定義
 */
export type ValidCategory = (typeof VALID_CATEGORIES)[number];

/**
 * カテゴリの説明マップ（エラーメッセージ・ヘルプ表示用）
 */
export const CATEGORY_DESCRIPTIONS: Record<ValidCategory, string> = {
  commands: "Claude Code コマンド (.claude/commands/)",
  agents: "Claude Code エージェント (.claude/agents/)",
  skills: "Claude Code スキル (.claude/skills/)",
  hooks: "Claude Code フック (.claude/hooks/)",
  docs: "ドキュメント (docs/einja/)",
  scripts: "ユーティリティスクリプト (scripts/)",
  env: "環境設定ファイル (.envrc)",
  tools: "開発ツール設定 (.vscode/settings.json)",
};

/**
 * カテゴリバリデーション結果
 */
export interface CategoryValidationResult {
  /** バリデーションが成功したか */
  valid: boolean;
  /** 有効なカテゴリのリスト */
  validCategories: string[];
  /** 無効なカテゴリのリスト */
  invalidCategories: string[];
}

/**
 * カテゴリ文字列をパースしてバリデーションする
 * @param categoryString カンマ区切りのカテゴリ文字列（例: "commands,agents"）
 * @returns バリデーション結果
 */
export function validateCategories(categoryString: string): CategoryValidationResult {
  // カンマで分割してトリム
  const categories = categoryString
    .split(",")
    .map((cat) => cat.trim())
    .filter((cat) => cat !== "");

  const validCategories: string[] = [];
  const invalidCategories: string[] = [];

  for (const category of categories) {
    if (VALID_CATEGORIES.includes(category as ValidCategory)) {
      validCategories.push(category);
    } else {
      invalidCategories.push(category);
    }
  }

  return {
    valid: invalidCategories.length === 0,
    validCategories,
    invalidCategories,
  };
}

/**
 * バリデーションエラーメッセージを生成する
 * @param invalidCategories 無効なカテゴリのリスト
 * @returns エラーメッセージ
 */
export function createValidationErrorMessage(invalidCategories: string[]): string {
  const invalidList = invalidCategories.join(", ");
  const validList = VALID_CATEGORIES
    .map((cat) => `${cat} - ${CATEGORY_DESCRIPTIONS[cat]}`)
    .join("\n  - ");

  return `無効なカテゴリ: ${invalidList}\n\n有効なカテゴリは以下のいずれかです:\n  - ${validList}`;
}
