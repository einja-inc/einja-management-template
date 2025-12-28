import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * パッケージルートからの相対パスを解決
 */
export function getPackageRoot(): string {
	// dist/lib/file-system.js から packages/cli/ へ
	return path.resolve(__dirname, "../..");
}

/**
 * コアテンプレートのパスを取得
 */
export function getCorePath(): string {
	return path.join(getPackageRoot(), "core");
}

/**
 * プリセットディレクトリのパスを取得
 */
export function getPresetsPath(): string {
	return path.join(getPackageRoot(), "presets");
}

/**
 * 特定のプリセットのパスを取得
 */
export function getPresetPath(presetName: string): string {
	return path.join(getPresetsPath(), presetName);
}

/**
 * ディレクトリをバックアップ
 */
export async function backupDirectory(dirPath: string): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = `${dirPath}.backup-${timestamp}`;
	await fs.copy(dirPath, backupPath);
	return backupPath;
}

/**
 * ディレクトリをコピー（除外パターン対応）
 */
export async function copyDirectory(
	src: string,
	dest: string,
	options: { exclude?: string[] } = {},
): Promise<void> {
	const { exclude = [] } = options;

	await fs.copy(src, dest, {
		filter: (srcPath) => {
			const relativePath = path.relative(src, srcPath);
			return !exclude.some((pattern) => relativePath.includes(pattern));
		},
	});
}

/**
 * テンプレート変数を展開
 */
export async function processTemplateFile(
	filePath: string,
	variables: Record<string, string>,
): Promise<string> {
	let content = await fs.readFile(filePath, "utf-8");

	for (const [key, value] of Object.entries(variables)) {
		const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		content = content.replace(pattern, value);
	}

	return content;
}

/**
 * 利用可能なプリセット一覧を取得
 */
export async function getAvailablePresets(): Promise<string[]> {
	const presetsPath = getPresetsPath();

	if (!await fs.pathExists(presetsPath)) {
		return [];
	}

	const entries = await fs.readdir(presetsPath, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}
