/**
 * Worktree設定ローダー
 *
 * worktree.config.jsonファイルの読み込み・生成を提供する。
 */

import fs from "node:fs";
import path from "node:path";
import {
	type WorktreeConfig,
	defaultWorktreeConfig,
	worktreeConfigSchema,
} from "./worktree-config.js";

/** 設定ファイル名 */
const CONFIG_FILENAME = "worktree.config.json";

/**
 * プロジェクトルートを探索
 *
 * package.jsonが存在するディレクトリをプロジェクトルートとして検出。
 *
 * @param startDir - 探索開始ディレクトリ
 * @returns プロジェクトルートのパス、見つからない場合はnull
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
	let currentDir = startDir;

	while (currentDir !== path.dirname(currentDir)) {
		if (fs.existsSync(path.join(currentDir, "package.json"))) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}

	return null;
}

/**
 * Worktree設定を読み込む
 *
 * worktree.config.jsonが存在しない場合はデフォルト値を返す。
 * 設定ファイルが存在する場合はバリデーション後に返す。
 *
 * @param projectRoot - プロジェクトルートのパス（省略時は自動検出）
 * @returns Worktree設定
 * @throws {Error} 設定ファイルのパースやバリデーションに失敗した場合
 */
export function loadWorktreeConfig(projectRoot?: string): WorktreeConfig {
	const root = projectRoot ?? findProjectRoot();

	if (!root) {
		console.warn(
			"プロジェクトルートが見つかりません。デフォルト設定を使用します。",
		);
		return defaultWorktreeConfig;
	}

	const configPath = path.join(root, CONFIG_FILENAME);

	if (!fs.existsSync(configPath)) {
		// 設定ファイルが存在しない場合はデフォルト値を返す
		return defaultWorktreeConfig;
	}

	try {
		const configContent = fs.readFileSync(configPath, "utf-8");
		const rawConfig = JSON.parse(configContent);

		// Zodでバリデーション（デフォルト値も適用される）
		const result = worktreeConfigSchema.safeParse(rawConfig);

		if (!result.success) {
			console.error("Worktree設定のバリデーションエラー:");
			for (const issue of result.error.issues) {
				console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
			}
			throw new Error("Worktree設定のバリデーションに失敗しました");
		}

		return result.data;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`${CONFIG_FILENAME}のJSONパースに失敗しました: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Worktree設定ファイルを生成
 *
 * @param projectRoot - プロジェクトルートのパス
 * @param config - 書き込む設定（省略時はデフォルト設定）
 */
export function generateWorktreeConfig(
	projectRoot: string,
	config: Partial<WorktreeConfig> = {},
): void {
	const configPath = path.join(projectRoot, CONFIG_FILENAME);

	// デフォルト値とマージしてバリデーション
	const result = worktreeConfigSchema.safeParse(config);

	if (!result.success) {
		throw new Error(
			`設定のバリデーションに失敗しました: ${result.error.message}`,
		);
	}

	const content = JSON.stringify(result.data, null, "\t");
	fs.writeFileSync(configPath, `${content}\n`, "utf-8");
}

/**
 * 設定ファイルが存在するか確認
 *
 * @param projectRoot - プロジェクトルートのパス（省略時は自動検出）
 * @returns 設定ファイルが存在する場合true
 */
export function hasWorktreeConfig(projectRoot?: string): boolean {
	const root = projectRoot ?? findProjectRoot();

	if (!root) {
		return false;
	}

	return fs.existsSync(path.join(root, CONFIG_FILENAME));
}
