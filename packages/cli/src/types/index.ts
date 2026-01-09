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
	backup?: boolean;
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
