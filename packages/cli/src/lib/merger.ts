import fs from "fs-extra";
import path from "node:path";
import type { CoreSettings, PresetConfig } from "../types/index.js";
import {
	getCorePath,
	getPresetPath,
	getScaffoldsPath,
	getTemplatesPath,
	processTemplateFile,
} from "./file-system.js";

/**
 * コアsettings.jsonとプリセット設定をマージ
 */
export function mergeSettings(
	core: CoreSettings,
	preset: PresetConfig,
): CoreSettings {
	return {
		...core,
		permissions: {
			allow: [...new Set([...core.permissions.allow, ...preset.additionalPermissions])],
			ask: [...core.permissions.ask],
		},
		enabledMcpjsonServers: preset.mcpServers,
	};
}

/**
 * .claudeディレクトリを生成
 */
export async function generateClaudeDirectory(
	targetPath: string,
	presetConfig: PresetConfig,
): Promise<void> {
	const corePath = getCorePath();
	const presetPath = getPresetPath(presetConfig.name);

	// 1. コアファイルをコピー
	await copyAndProcessDirectory(
		path.join(corePath, "agents"),
		path.join(targetPath, "agents"),
		presetConfig.variables,
	);

	await copyAndProcessDirectory(
		path.join(corePath, "commands"),
		path.join(targetPath, "commands"),
		presetConfig.variables,
	);

	// 2. コアsettings.jsonを読み込み・マージ
	const coreSettingsPath = path.join(corePath, "settings.json");
	if (await fs.pathExists(coreSettingsPath)) {
		const coreSettings = await fs.readJson(coreSettingsPath) as CoreSettings;
		const mergedSettings = mergeSettings(coreSettings, presetConfig);
		await fs.writeJson(path.join(targetPath, "settings.json"), mergedSettings, {
			spaces: "\t",
		});
	}

	// 3. プリセット固有のファイルをコピー（einja/サブディレクトリから）
	const presetAgentsPath = path.join(presetPath, ".claude", "agents", "einja");
	if (await fs.pathExists(presetAgentsPath)) {
		await copyAndProcessDirectory(
			presetAgentsPath,
			path.join(targetPath, "agents", "einja"),
			presetConfig.variables,
		);
	}

	const presetCommandsPath = path.join(presetPath, ".claude", "commands", "einja");
	if (await fs.pathExists(presetCommandsPath)) {
		await copyAndProcessDirectory(
			presetCommandsPath,
			path.join(targetPath, "commands", "einja"),
			presetConfig.variables,
		);
	}

	const presetSkillsPath = path.join(presetPath, ".claude", "skills", "einja");
	if (await fs.pathExists(presetSkillsPath)) {
		await copyAndProcessDirectory(
			presetSkillsPath,
			path.join(targetPath, "skills", "einja"),
			presetConfig.variables,
		);
	}
}

/**
 * ディレクトリをコピーしてテンプレート変数を展開
 */
async function copyAndProcessDirectory(
	srcDir: string,
	destDir: string,
	variables: Record<string, string>,
): Promise<void> {
	if (!await fs.pathExists(srcDir)) {
		return;
	}

	await fs.ensureDir(destDir);

	const entries = await fs.readdir(srcDir, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destDir, entry.name);

		if (entry.isDirectory()) {
			await copyAndProcessDirectory(srcPath, destPath, variables);
		} else if (entry.name.endsWith(".md") || entry.name.endsWith(".json")) {
			// テンプレート変数を展開
			const processed = await processTemplateFile(srcPath, variables);
			await fs.writeFile(destPath, processed);
		} else {
			// その他のファイルはそのままコピー
			await fs.copy(srcPath, destPath);
		}
	}
}

/**
 * ドキュメントテンプレートをコピー
 */
export async function copyDocTemplates(targetPath: string): Promise<void> {
	const templatesPath = getTemplatesPath();

	if (!await fs.pathExists(templatesPath)) {
		return;
	}

	await fs.ensureDir(targetPath);
	await fs.copy(templatesPath, targetPath);
}

/**
 * CLAUDE.mdを生成
 */
export async function generateClaudeMd(
	targetPath: string,
	variables: Record<string, string>,
): Promise<void> {
	const scaffoldsPath = getScaffoldsPath();
	const templatePath = path.join(scaffoldsPath, "CLAUDE.md.template");

	if (!await fs.pathExists(templatePath)) {
		return;
	}

	const processed = await processTemplateFile(templatePath, variables);
	await fs.writeFile(targetPath, processed);
}

/**
 * ステアリングドキュメントをコピー
 */
export async function copySteeringDocs(targetPath: string): Promise<void> {
	const scaffoldsPath = getScaffoldsPath();
	const steeringPath = path.join(scaffoldsPath, "steering");

	if (!await fs.pathExists(steeringPath)) {
		return;
	}

	await fs.ensureDir(targetPath);
	await fs.copy(steeringPath, targetPath);
}
