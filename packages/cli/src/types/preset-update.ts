/**
 * cli-template:update スクリプト関連の型定義
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

/**
 * ファイルコピーオプション
 */
export interface CopyOptions {
  /**
   * 対象プリセット
   */
  preset: Preset;

  /**
   * ドライランモード（ファイル変更なし）
   */
  dryRun: boolean;

  /**
   * 強制上書きモード（確認プロンプトなし）
   */
  force: boolean;
}

/**
 * コピーされたファイル情報
 */
export interface CopiedFile {
  /**
   * コピー元パス（プロジェクトルートからの相対パス）
   */
  source: string;

  /**
   * コピー先パス（絶対パス）
   */
  destination: string;

  /**
   * 実行アクション
   */
  action: "copied" | "skipped";
}

/**
 * ファイルコピー結果
 */
export interface CopyResult {
  /**
   * コピー成功
   */
  success: boolean;

  /**
   * コピーしたファイル一覧
   */
  files: CopiedFile[];

  /**
   * スキップしたファイル一覧（ファイル名のみ）
   */
  skipped: string[];
}

/**
 * スキャンしたソースファイル情報
 */
export interface SourceFile {
  /**
   * ソースファイルの相対パス（プロジェクトルートから）
   */
  relativePath: string;

  /**
   * ソースファイルの絶対パス
   */
  absolutePath: string;

  /**
   * カテゴリ（commands/agents/skills/docs）
   */
  category: string;
}
