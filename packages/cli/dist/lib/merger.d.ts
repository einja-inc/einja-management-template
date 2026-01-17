import type { CoreSettings, PresetConfig } from "../types/index.js";
/**
 * コアsettings.jsonとプリセット設定をマージ
 */
export declare function mergeSettings(core: CoreSettings, preset: PresetConfig): CoreSettings;
/**
 * .claudeディレクトリを生成
 */
export declare function generateClaudeDirectory(targetPath: string, presetConfig: PresetConfig): Promise<void>;
/**
 * ドキュメントテンプレートをコピー
 */
export declare function copyDocTemplates(targetPath: string): Promise<void>;
/**
 * CLAUDE.mdを生成
 */
export declare function generateClaudeMd(targetPath: string, variables: Record<string, string>): Promise<void>;
/**
 * ステアリングドキュメントをコピー
 */
export declare function copySteeringDocs(targetPath: string): Promise<void>;
//# sourceMappingURL=merger.d.ts.map