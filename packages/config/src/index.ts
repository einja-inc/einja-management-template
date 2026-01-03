/**
 * @einja/config - 共通設定パッケージ
 *
 * Worktree設定スキーマとローダーを提供。
 */

// Worktree設定スキーマと型
export {
	worktreeConfigSchema,
	appConfigSchema,
	postgresConfigSchema,
	defaultWorktreeConfig,
	type WorktreeConfig,
	type AppConfig,
	type PostgresConfig,
} from "./worktree-config.js";

// Worktree設定ローダー
export {
	loadWorktreeConfig,
	generateWorktreeConfig,
	hasWorktreeConfig,
	findProjectRoot,
} from "./worktree-config-loader.js";
