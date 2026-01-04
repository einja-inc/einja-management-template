/**
 * Worktree設定のスキーマ定義
 *
 * worktree.config.jsonファイルの型安全な読み込みを提供する。
 * create-einja-appやpnpm devで使用される設定を定義。
 */

import { z } from "zod";

/**
 * アプリケーション設定スキーマ
 *
 * 各アプリケーションのポート範囲を定義。
 * 新規アプリは配列に追加するだけで対応可能。
 */
export const appConfigSchema = z.object({
	/** アプリケーションID（例: "web", "admin", "api"） */
	id: z
		.string()
		.min(1)
		.regex(/^[a-z][a-z0-9_]*$/, {
			message: "IDは小文字英字で始まり、小文字英数字とアンダースコアのみ使用可能",
		}),
	/** ポート範囲の開始値（1024-65535） */
	portRangeStart: z.number().int().min(1024).max(65535),
	/** ポート範囲のサイズ（デフォルト: 1000） */
	rangeSize: z.number().int().min(1).max(10000).default(1000),
});

/**
 * PostgreSQL設定スキーマ
 */
export const postgresConfigSchema = z.object({
	/** PostgreSQLポート（デフォルト: 25432） */
	port: z.number().int().min(1024).max(65535).default(25432),
	/** Dockerコンテナ名（デフォルト: "einja-management-postgres"） */
	containerName: z.string().min(1).default("einja-management-postgres"),
});

/**
 * Worktree設定スキーマ
 *
 * worktree.config.jsonファイルの完全な構造を定義。
 */
export const worktreeConfigSchema = z.object({
	/** スキーマバージョン（将来の互換性のため） */
	schemaVersion: z.literal(1).default(1),
	/** PostgreSQL設定 */
	postgres: postgresConfigSchema.default({}),
	/** アプリケーション設定の配列 */
	apps: z
		.array(appConfigSchema)
		.default([{ id: "web", portRangeStart: 3000, rangeSize: 1000 }]),
});

/** Worktree設定の型 */
export type WorktreeConfig = z.infer<typeof worktreeConfigSchema>;

/** アプリケーション設定の型 */
export type AppConfig = z.infer<typeof appConfigSchema>;

/** PostgreSQL設定の型 */
export type PostgresConfig = z.infer<typeof postgresConfigSchema>;

/**
 * デフォルトのWorktree設定
 */
export const defaultWorktreeConfig: WorktreeConfig = {
	schemaVersion: 1,
	postgres: {
		port: 25432,
		containerName: "einja-management-postgres",
	},
	apps: [{ id: "web", portRangeStart: 3000, rangeSize: 1000 }],
};
