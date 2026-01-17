import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * パッケージルートからの相対パスを解決
 */
export function getPackageRoot() {
    // dist/lib/file-system.js から packages/cli/ へ
    return path.resolve(__dirname, "../..");
}
/**
 * コアテンプレートのパスを取得
 */
export function getCorePath() {
    return path.join(getPackageRoot(), "core");
}
/**
 * プリセットディレクトリのパスを取得
 */
export function getPresetsPath() {
    return path.join(getPackageRoot(), "presets");
}
/**
 * テンプレートディレクトリのパスを取得
 */
export function getTemplatesPath() {
    return path.join(getPackageRoot(), "templates");
}
/**
 * スキャフォールドディレクトリのパスを取得
 */
export function getScaffoldsPath() {
    return path.join(getPackageRoot(), "scaffolds");
}
/**
 * 特定のプリセットのパスを取得
 */
export function getPresetPath(presetName) {
    return path.join(getPresetsPath(), presetName);
}
/**
 * ディレクトリをバックアップ
 */
export async function backupDirectory(dirPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${dirPath}.backup-${timestamp}`;
    await fs.copy(dirPath, backupPath);
    return backupPath;
}
/**
 * ディレクトリをコピー（除外パターン対応）
 */
export async function copyDirectory(src, dest, options = {}) {
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
export async function processTemplateFile(filePath, variables) {
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
export async function getAvailablePresets() {
    const presetsPath = getPresetsPath();
    if (!await fs.pathExists(presetsPath)) {
        return [];
    }
    const entries = await fs.readdir(presetsPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}
//# sourceMappingURL=file-system.js.map