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
