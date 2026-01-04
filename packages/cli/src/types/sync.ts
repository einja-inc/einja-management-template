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
 * 同期メタデータのZodスキーマ
 */
export const SyncMetadataSchema = z.object({
	version: z.string(),
	lastSync: z.string(),
	templateVersion: z.string(),
	files: z.record(z.string(), FileMetadataSchema),
});

/**
 * ファイルメタデータの型定義
 */
export type FileMetadata = z.infer<typeof FileMetadataSchema>;

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
