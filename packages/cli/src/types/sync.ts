import { z } from "zod";

/**
 * ファイルメタデータのZodスキーマ
 */
export const FileMetadataSchema = z.object({
  hash: z.string(),
  syncedAt: z.string(),
  conflicts: z.array(z.string()).optional(),
});

/**
 * JSON パス設定の Zod スキーマ
 * managed: テンプレート値で上書き
 * project-private: ローカル優先（キーが存在しない場合のみコピー）
 */
export const JsonPathsConfigSchema = z.object({
  managed: z.record(z.string(), z.array(z.string())),
  "project-private": z.record(z.string(), z.array(z.string())),
});

/**
 * 同期メタデータのZodスキーマ
 */
export const SyncMetadataSchema = z.object({
  version: z.string(),
  lastSync: z.string(),
  templateVersion: z.string(),
  files: z.record(z.string(), FileMetadataSchema),
  jsonPaths: JsonPathsConfigSchema.optional(),
});

/**
 * ファイルメタデータの型定義
 */
export type FileMetadata = z.infer<typeof FileMetadataSchema>;

/**
 * JSON パス設定の型定義
 */
export type JsonPathsConfig = z.infer<typeof JsonPathsConfigSchema>;

/**
 * 同期メタデータの型定義
 */
export type SyncMetadata = z.infer<typeof SyncMetadataSchema>;

/**
 * ベースコンテンツの型定義
 */
export interface BaseContent {
  content: string;
  hash: string;
}

/**
 * スキャンオプションの型定義
 */
export interface ScanOptions {
  /** フィルタするカテゴリのリスト */
  categories?: string[];
  /** 追加の除外パターンのリスト */
  excludePatterns?: string[];
}

/**
 * 同期対象ファイルの型定義
 */
export interface SyncTarget {
  /** 相対パス */
  path: string;
  /** カテゴリ */
  category: string;
  /** テンプレートファイルパス */
  templatePath: string;
  /** ローカルに存在するか */
  exists: boolean;
}

/**
 * コンフリクト情報の型定義
 */
export interface Conflict {
  /** コンフリクトが発生した行番号 */
  line: number;
  /** ローカル版の内容 */
  localContent: string;
  /** テンプレート版の内容 */
  templateContent: string;
}

/**
 * マージ結果の型定義
 */
export interface MergeResult {
  /** マージが成功したか（コンフリクトなし） */
  success: boolean;
  /** マージ後の内容 */
  content: string;
  /** コンフリクト一覧 */
  conflicts: Conflict[];
}

/**
 * マーカーセクションの種別
 */
export type MarkerSectionType = "managed" | "unmanaged" | "project-private";

/**
 * マーカーエラーの種別
 */
export type MarkerErrorType =
  | "unpaired_start"
  | "unpaired_end"
  | "nested"
  | "project_private_without_id"
  | "duplicate_id";

/**
 * マーカーセクションの型定義
 */
export interface MarkerSection {
  /** セクション種別 */
  type: MarkerSectionType;
  /** 開始行番号（1始まり） */
  startLine: number;
  /** 終了行番号（1始まり） */
  endLine: number;
  /** セクション内容 */
  content: string;
  /** セクションID（managedまたはproject-privateマーカーにID属性がある場合） */
  id?: string;
}

/**
 * マーカーエラーの型定義
 */
export interface MarkerError {
  /** エラー行番号（1始まり） */
  line: number;
  /** エラーメッセージ */
  message: string;
  /** エラー種別 */
  type: MarkerErrorType;
}

/**
 * マーカー検証結果の型定義
 */
export interface MarkerValidationResult {
  /** 検証結果 */
  valid: boolean;
  /** エラー一覧 */
  errors: MarkerError[];
}

/**
 * JSON出力用のファイル情報
 */
export interface JsonFileInfo {
  /** ファイルパス */
  path: string;
  /** ステータス（success, conflict, skipped） */
  status: "success" | "conflict" | "skipped";
  /** 実行されたアクション */
  action: "merged" | "created" | "marked" | "skipped";
  /** コンフリクト情報（status=conflictの場合のみ） */
  conflicts?: Array<{
    line: number;
    local: string;
    template: string;
  }>;
}

/**
 * JSON出力の型定義
 */
export interface JsonOutput {
  /** ステータス（success, partial_success, error） */
  status: "success" | "partial_success" | "error";
  /** サマリー情報 */
  summary: {
    /** 総ファイル数 */
    total: number;
    /** 変更されたファイル数 */
    changed: number;
    /** 成功したファイル数 */
    succeeded: number;
    /** コンフリクトが発生したファイル数 */
    conflicts: number;
    /** スキップされたファイル数 */
    skipped: number;
    /** 孤児検出数 */
    orphansDetected?: number;
    /** 孤児削除数 */
    orphansDeleted?: number;
  };
  /** ファイル情報の配列 */
  files: JsonFileInfo[];
  /** メタデータ情報 */
  metadata: {
    /** メタデータバージョン */
    version: string;
    /** 同期実行日時 */
    syncedAt: string;
  };
  /** 孤児ファイル情報 */
  orphans?: OrphanFile[];
}

/**
 * 孤児ファイルの型定義
 */
export interface OrphanFile {
  /** ファイルパス */
  path: string;
  /** カテゴリ */
  category: string | null;
  /** ディスク上に実在するか */
  exists: boolean;
}

/**
 * 孤児レポートの型定義
 */
export interface OrphanReport {
  /** 孤児が存在するか */
  hasOrphans: boolean;
  /** 孤児ファイル一覧 */
  orphans: OrphanFile[];
  /** 孤児ファイル総数 */
  total: number;
  /** ディスク上に実在する孤児の数 */
  existingCount: number;
}
