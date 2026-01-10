import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { AddOptions, SyncMetadata } from "../../types/index.js";
import { mergeAndWriteFile } from "../../utils/merger.js";
import * as logger from "../../utils/logger.js";

/**
 * プロジェクト直下の設定ファイルを追加
 */
export async function addConfigFiles(
  options: AddOptions,
  syncMetadata: SyncMetadata
): Promise<{ added: string[]; skipped: string[]; merged: string[] }> {
  const added: string[] = [];
  const skipped: string[] = [];
  const merged: string[] = [];

  const { targetDir, templateDir, config } = options;

  logger.info("Adding config files from template root");

  // 除外パターン
  const excludedPaths = new Set([
    ".claude",
    "docs/einja",
    "CLAUDE.md",
    ".mcp.json",
    "node_modules",
    ".turbo",
    "next-env.d.ts",
    "styled-system",
    "pnpm-lock.yaml",
    "package-lock.json",
    "packages",
    "apps",
  ]);

  // .gitignore のパターンを読み込み
  const gitignorePatterns = await loadGitignorePatterns(templateDir);

  await copyConfigDirectory(
    templateDir,
    targetDir,
    templateDir, // rootDir として templateDir を渡す
    { added, skipped, merged },
    config.dryRun,
    excludedPaths,
    gitignorePatterns,
    syncMetadata
  );

  return { added, skipped, merged };
}

/**
 * .gitignore のパターンを読み込み
 */
async function loadGitignorePatterns(templateDir: string): Promise<Set<string>> {
  const patterns = new Set<string>();
  const gitignorePath = join(templateDir, ".gitignore");

  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      // コメントと空行を除外
      if (trimmed && !trimmed.startsWith("#")) {
        // 先頭の / を削除
        const pattern = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
        patterns.add(pattern);
      }
    }
  } catch {
    // .gitignore が存在しない場合は無視
  }

  return patterns;
}

/**
 * 設定ファイルのディレクトリを再帰的にコピー
 */
async function copyConfigDirectory(
  srcDir: string,
  destDir: string,
  rootDir: string, // テンプレートルートディレクトリ
  result: { added: string[]; skipped: string[]; merged: string[] },
  dryRun: boolean,
  excludedPaths: Set<string>,
  gitignorePatterns: Set<string>,
  syncMetadata: SyncMetadata
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    // rootDir からの相対パスを計算（一貫性を保つ）
    const rawRelativePath = relative(rootDir, srcPath);
    // Windows対応: パス区切り文字をPOSIX形式（/）に正規化
    const relativePath = rawRelativePath.split(sep).join("/");

    // 除外パターンに一致するかチェック
    if (shouldExclude(relativePath, excludedPaths, gitignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyConfigDirectory(
        srcPath,
        destPath,
        rootDir, // rootDir を引き継ぐ
        result,
        dryRun,
        excludedPaths,
        gitignorePatterns,
        syncMetadata
      );
    } else {
      if (!dryRun) {
        const mergeResult = await mergeAndWriteFile(
          srcPath,
          destPath,
          syncMetadata
        );

        if (mergeResult.action === "created") {
          result.added.push(destPath);
        } else if (mergeResult.action === "skipped") {
          result.skipped.push(destPath);
        } else if (mergeResult.action === "merged") {
          result.merged.push(destPath);
        }
      } else {
        // dry-runモードではスキップ
        result.skipped.push(destPath);
      }
    }
  }
}

/**
 * パスを除外すべきか判定
 */
function shouldExclude(
  relativePath: string,
  excludedPaths: Set<string>,
  gitignorePatterns: Set<string>
): boolean {
  // 除外パスに完全一致または部分一致
  for (const excluded of excludedPaths) {
    if (relativePath === excluded || relativePath.startsWith(`${excluded}/`)) {
      return true;
    }
  }

  // .gitignore パターンに一致
  for (const pattern of gitignorePatterns) {
    // シンプルなパターンマッチング（ワイルドカード対応）
    if (matchPattern(relativePath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * シンプルなパターンマッチング
 */
function matchPattern(path: string, pattern: string): boolean {
  // パターンの最後が / の場合、ディレクトリのみ一致
  if (pattern.endsWith("/")) {
    const dirPattern = pattern.slice(0, -1);
    return path === dirPattern || path.startsWith(`${dirPattern}/`);
  }

  // * を含むパターン
  if (pattern.includes("*")) {
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  // 完全一致または部分一致
  return path === pattern || path.startsWith(`${pattern}/`);
}
