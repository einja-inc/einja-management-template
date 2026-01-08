import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import fsExtra from "fs-extra";
const { ensureDir: ensureDirFse } = fsExtra;

/**
 * ディレクトリを作成（存在しない場合）
 * @param dirPath - ディレクトリパス
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await ensureDirFse(dirPath);
}

/**
 * 競合戦略に基づくファイル書き込み
 * @param filePath - ファイルパス
 * @param content - ファイル内容
 * @param strategy - 競合戦略
 * @returns 書き込み実行の可否
 */
export function writeWithStrategy(
  filePath: string,
  content: string,
  strategy: "merge" | "overwrite" | "skip"
): boolean {
  const exists = existsSync(filePath);

  if (!exists) {
    // ファイルが存在しない場合は常に書き込み
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  // ファイルが存在する場合、戦略に応じて処理
  if (strategy === "skip") {
    return false;
  }

  if (strategy === "overwrite") {
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  if (strategy === "merge") {
    // マージ: 既存内容の末尾に追記
    const existingContent = readFileSync(filePath, "utf-8");
    const mergedContent = `${existingContent}\n${content}`;
    writeFileSync(filePath, mergedContent, "utf-8");
    return true;
  }

  return false;
}

/**
 * .gitignoreへの追記
 * @param projectPath - プロジェクトルートパス
 * @param pattern - 追加するignoreパターン
 */
export function appendToGitignore(
  projectPath: string,
  pattern: string
): void {
  const gitignorePath = `${projectPath}/.gitignore`;

  if (!existsSync(gitignorePath)) {
    // .gitignoreが存在しない場合は新規作成
    writeFileSync(gitignorePath, `${pattern}\n`, "utf-8");
    return;
  }

  // 既存の.gitignoreに追記
  const existingContent = readFileSync(gitignorePath, "utf-8");

  // 既に同じパターンが存在する場合はスキップ
  if (existingContent.includes(pattern)) {
    return;
  }

  appendFileSync(gitignorePath, `\n${pattern}\n`, "utf-8");
}
