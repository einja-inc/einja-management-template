import fs from "fs-extra";
import path from "node:path";
import yaml from "js-yaml";
import type { Preset, PresetConfig } from "../types/index.js";
import { getPresetPath, getPresetsPath } from "./file-system.js";

/**
 * プリセット設定を読み込む
 */
export async function loadPreset(presetName: string): Promise<Preset> {
	const presetPath = getPresetPath(presetName);
	const configPath = path.join(presetPath, "preset.yaml");

	if (!await fs.pathExists(configPath)) {
		throw new Error(`プリセット "${presetName}" が見つかりません: ${configPath}`);
	}

	const content = await fs.readFile(configPath, "utf-8");
	const config = yaml.load(content) as PresetConfig;

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
export async function getAllPresets(): Promise<Preset[]> {
	const presetsPath = getPresetsPath();

	if (!await fs.pathExists(presetsPath)) {
		return [];
	}

	const entries = await fs.readdir(presetsPath, { withFileTypes: true });
	const presetDirs = entries.filter((entry) => entry.isDirectory());

	const presets: Preset[] = [];
	for (const dir of presetDirs) {
		try {
			const preset = await loadPreset(dir.name);
			presets.push(preset);
		} catch {
			// preset.yaml がないディレクトリはスキップ
		}
	}

	return presets;
}

/**
 * プリセットが存在するか確認
 */
export async function presetExists(presetName: string): Promise<boolean> {
	const configPath = path.join(getPresetPath(presetName), "preset.yaml");
	return fs.pathExists(configPath);
}
