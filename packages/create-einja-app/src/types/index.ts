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
  packageScope: string;
  template: "default";
  authMethod: "default" | "none";
  tools: ToolConfig;
  setupEinjaCli: boolean;
  worktreeConfig?: WorktreeConfig;
  useCurrentDir: boolean;
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

/**
 * パッケージコンポーネントの型定義
 */
export type PackageComponent = "front-core" | "server-core" | "config" | "ui";

/**
 * アプリコンポーネントの型定義
 */
export type AppComponent = "web";

/**
 * 追加コンポーネントの型定義
 */
export type AddComponentType = "packages" | "apps" | "config";

/**
 * 追加設定の型定義
 */
export type AddConfig = {
  components: {
    packages: boolean;
    apps: boolean;
    config: boolean;
  };
  packageComponents: PackageComponent[];
  appComponents: AppComponent[];
  dryRun: boolean;
};

/**
 * 追加オプションの型定義
 */
export type AddOptions = {
  targetDir: string;
  templateDir: string;
  config: AddConfig;
};

/**
 * JSONパス設定の型定義（.einja-sync.json用）
 */
export type JsonPathsConfig = {
  managed: Record<string, string[]>;
  seed: Record<string, string[]>;
};

/**
 * 同期メタデータの型定義（.einja-sync.json）
 */
export type SyncMetadata = {
  version: string;
  lastSync: string;
  templateVersion: string;
  files: Record<string, { hash: string; syncedAt: string }>;
  jsonPaths?: JsonPathsConfig;
};
