import path from "node:path";
import fs from "fs-extra";
import type { PresetConfig } from "../types/index.js";
import {
  getPresetPath,
  getScaffoldsPath,
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
  const scaffoldsPath = getScaffoldsPath();
  const templatePath = path.join(scaffoldsPath, "CLAUDE.md.template");

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
  const scaffoldsPath = getScaffoldsPath();
  const steeringPath = path.join(scaffoldsPath, "steering");

  if (!(await fs.pathExists(steeringPath))) {
    return;
  }

  await fs.ensureDir(targetPath);
  await fs.copy(steeringPath, targetPath);
}
