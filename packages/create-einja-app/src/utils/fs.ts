import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ConflictStrategy } from "../types/index.js";

/**
 * 競合戦略に基づいてファイルを書き込む
 */
export function writeWithStrategy(
  filePath: string,
  content: string,
  strategy: ConflictStrategy
): boolean {
  const exists = existsSync(filePath);

  if (!exists) {
    ensureDir(dirname(filePath));
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  switch (strategy) {
    case "overwrite": {
      writeFileSync(filePath, content, "utf-8");
      return true;
    }

    case "merge": {
      const existingContent = readFileSync(filePath, "utf-8");
      const mergedContent = mergeContent(existingContent, content);
      writeFileSync(filePath, mergedContent, "utf-8");
      return true;
    }

    case "skip": {
      return false;
    }

    default: {
      const _exhaustiveCheck: never = strategy;
      throw new Error(`Unknown strategy: ${_exhaustiveCheck}`);
    }
  }
}

/**
 * 既存コンテンツと新規コンテンツをマージする
 */
function mergeContent(existing: string, newContent: string): string {
  if (existing.includes(newContent)) {
    return existing;
  }
  return `${existing}\n${newContent}`;
}

/**
 * ディレクトリが存在しない場合は作成する
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * .gitignoreに行を追加する
 */
export function appendToGitignore(targetDir: string, line: string): void {
  const gitignorePath = join(targetDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${line}\n`, "utf-8");
    return;
  }

  const content = readFileSync(gitignorePath, "utf-8");
  if (content.includes(line)) {
    return;
  }

  appendFileSync(gitignorePath, `\n${line}\n`, "utf-8");
}

/**
 * ファイルが存在するか確認する
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}
