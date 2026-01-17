import type { Preset } from "../types/index.js";
/**
 * プリセット設定を読み込む
 */
export declare function loadPreset(presetName: string): Promise<Preset>;
/**
 * 全プリセット情報を取得
 */
export declare function getAllPresets(): Promise<Preset[]>;
/**
 * プリセットが存在するか確認
 */
export declare function presetExists(presetName: string): Promise<boolean>;
//# sourceMappingURL=preset.d.ts.map