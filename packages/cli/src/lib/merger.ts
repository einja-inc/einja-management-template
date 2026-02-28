import path from "node:path";
import fs from "fs-extra";
import type { PresetConfig, SymlinksConfig } from "@/types/index.js";
import {
  getPresetPath,
  getTemplatesPath,
  processTemplateFile,
} from "./file-system.js";

/**
 * .claudeディレクトリを生成
 */
export async function generateClaudeDirectory(
  targetPath: string,
  presetConfig: PresetConfig
): Promise<void> {
  const presetPath = getPresetPath(presetConfig.name);
  const presetClaudePath = path.join(presetPath, ".claude");

  // プリセットの .claude/ を直接コピー
  if (await fs.pathExists(presetClaudePath)) {
    await copyAndProcessDirectory(presetClaudePath, targetPath, presetConfig.variables);
  }
}

/**
 * ディレクトリをコピーしてテンプレート変数を展開
 */
async function copyAndProcessDirectory(
  srcDir: string,
  destDir: string,
  variables: Record<string, string>
): Promise<void> {
  if (!(await fs.pathExists(srcDir))) {
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

  if (!(await fs.pathExists(templatesPath))) {
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
  variables: Record<string, string>
): Promise<void> {
  const presetPath = getPresetPath("default");
  const templatePath = path.join(presetPath, "CLAUDE.md.template");

  if (!(await fs.pathExists(templatePath))) {
    return;
  }

  const processed = await processTemplateFile(templatePath, variables);
  await fs.writeFile(targetPath, processed);
}

/**
 * ステアリングドキュメントをコピー
 */
export async function copySteeringDocs(targetPath: string): Promise<void> {
  const presetPath = getPresetPath("default");
  const steeringPath = path.join(presetPath, "docs", "einja", "steering");

  if (!(await fs.pathExists(steeringPath))) {
    return;
  }

  await fs.ensureDir(targetPath);
  await fs.copy(steeringPath, targetPath);
}

/**
 * プリセットのサブディレクトリをコピー
 * @param targetPath - コピー先のパス
 * @param presetSubPath - プリセット内の相対パス（例: "scripts", "docs/einja/instructions"）
 */
export async function copyPresetDirectory(
  targetPath: string,
  presetSubPath: string
): Promise<void> {
  const presetPath = getPresetPath("default");
  const srcPath = path.join(presetPath, presetSubPath);

  if (!(await fs.pathExists(srcPath))) {
    return;
  }

  await fs.ensureDir(targetPath);
  await fs.copy(srcPath, targetPath);
}

/**
 * プリセットの単一ファイルをコピー
 * @param targetPath - コピー先のファイルパス
 * @param presetSubPath - プリセット内の相対パス（例: ".envrc"）
 */
export async function copyPresetFile(
  targetPath: string,
  presetSubPath: string
): Promise<void> {
  const presetPath = getPresetPath("default");
  const srcPath = path.join(presetPath, presetSubPath);

  if (!(await fs.pathExists(srcPath))) {
    return;
  }

  await fs.ensureDir(path.dirname(targetPath));
  await fs.copy(srcPath, targetPath);
}

/**
 * シンボリックリンク作成の結果
 */
export interface CreateSymlinksResult {
  /** 作成に成功したリンク数 */
  created: number;
  /** スキップしたリンク数（リンク先が存在しない等） */
  skipped: number;
  /** フォールバックしたリンク数（Windowsで権限エラー時に実体コピー） */
  fallback: number;
  /** エラー数 */
  errors: number;
  /** 詳細ログ */
  logs: string[];
}

/**
 * symlinks.json を読み込んでシンボリックリンクを作成
 *
 * @param targetDir - ターゲットリポジトリのルートディレクトリ
 * @param presetName - プリセット名
 * @returns 作成結果
 */
export async function createSymlinks(
  targetDir: string,
  presetName: string
): Promise<CreateSymlinksResult> {
  const result: CreateSymlinksResult = {
    created: 0,
    skipped: 0,
    fallback: 0,
    errors: 0,
    logs: [],
  };

  const presetPath = getPresetPath(presetName);
  const symlinksPath = path.join(presetPath, "symlinks.json");

  // symlinks.json が存在しなければスキップ
  if (!(await fs.pathExists(symlinksPath))) {
    result.logs.push("symlinks.json が見つかりません（スキップ）");
    return result;
  }

  // symlinks.json を読み込み
  const symlinksContent = await fs.readFile(symlinksPath, "utf-8");
  const symlinksConfig: SymlinksConfig = JSON.parse(symlinksContent);

  // バージョンチェック
  if (symlinksConfig.version !== 1) {
    result.logs.push(
      `警告: symlinks.json のバージョンが不明です (version: ${symlinksConfig.version})`
    );
  }

  // 各シンボリックリンクを作成
  for (const { link, target } of symlinksConfig.symlinks) {
    const linkPath = path.join(targetDir, link);
    const linkDir = path.dirname(linkPath);

    // target はルートからの相対パス（例: docs/einja/steering/commit-rules.md）
    // 実体の絶対パスを計算
    const absoluteTarget = path.join(targetDir, target);
    if (!(await fs.pathExists(absoluteTarget))) {
      result.logs.push(`警告: リンク先が存在しません: ${target} (${link})`);
      result.skipped++;
      continue;
    }

    // リンク元ディレクトリからリンク先への相対パスを計算
    const relativeTarget = path.relative(linkDir, absoluteTarget);

    try {
      // リンク元ディレクトリを作成
      await fs.ensureDir(linkDir);

      // 既存ファイルがあれば処理
      if (await fs.pathExists(linkPath)) {
        const stat = await fs.lstat(linkPath);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          // ディレクトリの場合はエラー（手動対応を促す）
          result.logs.push(`エラー: ${link} にディレクトリが存在します。手動で削除してください。`);
          result.errors++;
          continue;
        }
        // ファイルまたはシンボリックリンクの場合は削除
        await fs.remove(linkPath);
      }

      // シンボリックリンクを作成（計算した相対パスを使用）
      await fs.symlink(relativeTarget, linkPath);
      result.logs.push(`リンク作成: ${link} → ${relativeTarget}`);
      result.created++;
    } catch (error) {
      // Windows での権限エラー時はフォールバック
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EPERM" &&
        process.platform === "win32"
      ) {
        result.logs.push(
          `警告: シンボリックリンクの作成に失敗しました（管理者権限が必要）: ${link}`
        );
        result.logs.push("  代替として実体ファイルをコピーします");
        try {
          await fs.copy(absoluteTarget, linkPath);
          result.fallback++;
        } catch (copyError) {
          result.logs.push(
            `エラー: ファイルコピーにも失敗しました: ${copyError instanceof Error ? copyError.message : String(copyError)}`
          );
          result.errors++;
        }
      } else {
        result.logs.push(
          `エラー: ${link} の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`
        );
        result.errors++;
      }
    }
  }

  return result;
}
