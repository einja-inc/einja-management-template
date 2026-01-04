/**
 * preset:update スクリプト関連の型定義
 */

/**
 * リポジトリ検証結果
 */
export interface ValidationResult {
  /**
   * 検証結果（trueの場合、CLIリポジトリ内で実行されている）
   */
  valid: boolean;

  /**
   * エラーメッセージ（validがfalseの場合のみ）
   */
  error?: string;

  /**
   * packages/cli/ディレクトリのパス（validがtrueの場合のみ）
   */
  cliPackagePath?: string;
}

/**
 * プリセット情報
 */
export interface Preset {
  /**
   * プリセット名（例: "minimal", "turborepo-pandacss"）
   */
  name: string;

  /**
   * プリセットディレクトリの絶対パス
   */
  path: string;

  /**
   * プリセットの説明（オプション）
   */
  description?: string;
}
