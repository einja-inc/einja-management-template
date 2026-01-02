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
