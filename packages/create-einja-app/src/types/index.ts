/**
 * 競合戦略の型定義
 */
export type ConflictStrategy = "merge" | "overwrite" | "skip";

/**
 * ツール設定の型定義
 */
export type ToolConfig = {
  direnv: boolean;
  dotenvx: boolean;
  volta: boolean;
  biome: boolean;
  husky: boolean;
};

/**
 * プロジェクト設定の型定義
 */
export type ProjectConfig = {
  projectName: string;
  template: "turborepo-pandacss" | "minimal";
  authMethod: "google" | "credentials" | "github" | "none";
  tools: ToolConfig;
  setupEinjaCli: boolean;
  worktreeConfig?: WorktreeConfig;
};

/**
 * Worktree設定の型定義
 */
export type WorktreeConfig = {
  postgres: {
    port: number;
    containerName: string;
  };
  apps: App[];
};

/**
 * アプリケーション設定の型定義
 */
export type App = {
  id: string;
  portRangeStart: number;
  rangeSize: number;
};

/**
 * セットアップ設定の型定義
 */
export type SetupConfig = {
  tools: ToolConfig;
  conflictStrategy: ConflictStrategy;
};

/**
 * ツールセットアップオプションの型定義
 */
export type ToolSetupOptions = {
  targetDir: string;
  conflictStrategy: ConflictStrategy;
};
