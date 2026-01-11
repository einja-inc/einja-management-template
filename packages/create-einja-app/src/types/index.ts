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

/**
 * 同期カテゴリの型定義
 */
export type SyncCategory =
  | "env" // .env*, .envrc, .volta, .node-version
  | "tools" // biome.json, .prettierrc, .editorconfig, .vscode/
  | "git" // .gitignore, .gitattributes
  | "git-hooks" // .husky/
  | "github" // .github/workflows/, .github/actions/
  | "docker" // Dockerfile*, docker-compose.yml, .dockerignore
  | "monorepo" // turbo.json, pnpm-workspace.yaml
  | "root-config" // package.json, tsconfig.json
  | "scripts" // scripts/**
  | "apps" // apps/** （詳細選択あり）
  | "packages" // packages/** （詳細選択あり）
  | "docs"; // README.md, docs/**

/**
 * 同期カテゴリ設定の型定義
 */
export type SyncCategoryConfig = {
  name: string;
  description: string;
  patterns: string[]; // globパターン
  defaultChecked?: boolean;
  requiresDetailSelection?: boolean; // apps/packagesで使用
};

/**
 * 同期詳細設定の型定義（apps/packages用）
 */
export type SyncDetailConfig = {
  category: "apps" | "packages";
  items: Array<{
    name: string;
    path: string;
    description: string;
    defaultChecked?: boolean;
  }>;
};

/**
 * package.json同期設定の型定義
 */
export type PackageJsonSyncConfig = {
  sections: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">;
  strategy: {
    scripts: "merge" | "replace";
    dependencies: "merge" | "replace";
    devDependencies: "merge" | "replace";
    engines: "merge" | "replace";
  };
};

/**
 * 同期オプションの型定義
 */
export type SyncOptions = {
  categories?: string[]; // --categories env,tools
  all?: boolean; // --all
  dryRun?: boolean; // --dry-run
  backup?: boolean; // --backup (default: true)
  rollback?: boolean; // --rollback
  force?: boolean; // --force（Git未コミット時に強制実行）
  conflictStrategy?: "merge" | "overwrite" | "skip";
  packageJsonSections?: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">;
};

/**
 * 同期結果の型定義
 */
export type SyncResult = {
  success: number;
  skipped: number;
  errors: number;
  conflicts: number;
  files: Array<{
    path: string;
    action: "copied" | "merged" | "skipped" | "error";
    reason?: string;
  }>;
};
