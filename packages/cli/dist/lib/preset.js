import fs from "fs-extra";
import path from "node:path";
import yaml from "js-yaml";
import { getPresetPath, getPresetsPath } from "./file-system.js";
/**
 * プリセット設定を読み込む
 */
export async function loadPreset(presetName) {
    const presetPath = getPresetPath(presetName);
    const configPath = path.join(presetPath, "preset.yaml");
    if (!await fs.pathExists(configPath)) {
        throw new Error(`プリセット "${presetName}" が見つかりません: ${configPath}`);
    }
    const content = await fs.readFile(configPath, "utf-8");
    const config = yaml.load(content);
    return {
        name: presetName,
        displayName: config.displayName,
        description: config.description,
        config,
    };
}
/**
 * 全プリセット情報を取得
 */
export async function getAllPresets() {
    const presetsPath = getPresetsPath();
    if (!await fs.pathExists(presetsPath)) {
        return [];
    }
    const entries = await fs.readdir(presetsPath, { withFileTypes: true });
    const presetDirs = entries.filter((entry) => entry.isDirectory());
    const presets = [];
    for (const dir of presetDirs) {
        try {
            const preset = await loadPreset(dir.name);
            presets.push(preset);
        }
        catch (_a) {
            // preset.yaml がないディレクトリはスキップ
        }
    }
    return presets;
}
/**
 * プリセットが存在するか確認
 */
export async function presetExists(presetName) {
    const configPath = path.join(getPresetPath(presetName), "preset.yaml");
    return fs.pathExists(configPath);
}
//# sourceMappingURL=preset.js.map