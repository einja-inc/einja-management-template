export interface PresetConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  variables: Record<string, string>;
  mcpServers: string[];
  additionalPermissions: string[];
  additionalAgents: string[];
  additionalCommands: string[];
  requirements?: RequirementsConfig;
}

export interface Preset {
  name: string;
  displayName: string;
  description: string;
  config: PresetConfig;
}

export interface InitOptions {
  preset?: string;
  force?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  skipDeps?: boolean;
  yes?: boolean;
}

export interface CoreSettings {
  includeCoAuthoredBy: boolean;
  permissions: {
    allow: string[];
    ask: string[];
  };
  enableAllProjectMcpServers: boolean;
  enabledMcpjsonServers: string[];
}

export interface SyncOptions {
  only?: string;
  dryRun?: boolean;
  force?: boolean;
  yes?: boolean;
  json?: boolean;
  skipDeps?: boolean;
  clean?: boolean;
}

/**
 * シンボリックリンクエントリ
 */
export interface SymlinkEntry {
  /** 作成するシンボリックリンクの相対パス（リポジトリルートから） */
  link: string;
  /** リンク先の相対パス（リンク元からの相対パス） */
  target: string;
}

/**
 * symlinks.json のフォーマット
 */
export interface SymlinksConfig {
  /** フォーマットバージョン（将来の互換性のため） */
  version: number;
  /** シンボリックリンクの配列 */
  symlinks: SymlinkEntry[];
}

/**
 * 依存関係の要件定義
 */
export interface RequirementsConfig {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  systemCommands?: SystemCommandRequirement[];
}

/**
 * システムコマンドの要件
 */
export interface SystemCommandRequirement {
  command: string;
  description: string;
  install: Partial<Record<"darwin" | "linux" | "win32", string>>;
}
