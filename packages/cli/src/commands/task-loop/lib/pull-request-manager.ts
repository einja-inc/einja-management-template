/**
 * Pull Request 自動作成マネージャー
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ParsedIssue } from "./types.js";

/**
 * 既存のPull Requestをチェック
 */
export function checkExistingPullRequest(
  headBranch: string,
  baseBranch: string
): { exists: boolean; url?: string; state?: string } {
  try {
    const result = execFileSync(
      "gh",
      [
        "pr",
        "list",
        "--head",
        headBranch,
        "--base",
        baseBranch,
        "--state",
        "all",
        "--json",
        "number,url,state",
      ],
      {
        encoding: "utf-8",
      }
    );
    const data = JSON.parse(result) as Array<{
      number: number;
      url: string;
      state: string;
    }>;

    if (data.length > 0) {
      return {
        exists: true,
        url: data[0].url,
        state: data[0].state,
      };
    }

    return { exists: false };
  } catch (error) {
    console.warn("⚠️  PR存在チェックに失敗しました:", error);
    return { exists: false };
  }
}

/**
 * PRタイトルを生成
 * - Issueタイトルが "feat:" などで始まる場合: "{issueTitle} (#N)"
 * - それ以外: "feat(#{N}): {issueTitle}"
 */
export function generatePrTitle(parsedIssue: ParsedIssue, issueNumber: number): string {
  const title = parsedIssue.title;
  const conventionalPrefixes = ["feat:", "fix:", "docs:", "style:", "refactor:", "test:", "chore:"];

  const hasPrefix = conventionalPrefixes.some((prefix) => title.toLowerCase().startsWith(prefix));

  if (hasPrefix) {
    return `${title} (#${issueNumber})`;
  }

  return `feat(#${issueNumber}): ${title}`;
}

/**
 * PR本文を生成
 */
export function generatePrBody(parsedIssue: ParsedIssue, issueNumber: number): string {
  const phaseCount = parsedIssue.phases.length;
  const taskGroupCount = parsedIssue.phases.reduce((sum, p) => sum + p.taskGroups.length, 0);

  let body = "## Summary\n";
  body += `- Closes #${issueNumber}\n`;
  body += `- 全${phaseCount}フェーズ、${taskGroupCount}タスクグループを完了\n\n`;

  body += "## Completed Tasks\n";

  for (const phase of parsedIssue.phases) {
    body += `### Phase ${phase.number}: ${phase.name}\n`;
    for (const taskGroup of phase.taskGroups) {
      const checkmark = taskGroup.status === "completed" ? "x" : " ";
      body += `  - [${checkmark}] ${taskGroup.id} ${taskGroup.name}\n`;
    }
    body += "\n";
  }

  body += "---\n";
  body += "*このPRは `pnpm task:loop` によって自動作成されました*\n";

  return body;
}

/**
 * Pull Requestを作成
 */
export function createPullRequest(
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string
): { success: boolean; url?: string; error?: string } {
  const tempFile = path.join(os.tmpdir(), `pr-body-${Date.now()}.md`);

  try {
    // 本文をファイルに書き出してから gh コマンドで作成（長い本文対策）
    fs.writeFileSync(tempFile, body, "utf-8");

    const result = execFileSync(
      "gh",
      [
        "pr",
        "create",
        "--head",
        headBranch,
        "--base",
        baseBranch,
        "--title",
        title,
        "--body-file",
        tempFile,
      ],
      {
        encoding: "utf-8",
      }
    );

    // gh pr create は作成されたPRのURLを返す
    const url = result.trim();

    return { success: true, url };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  } finally {
    // 一時ファイルを必ず削除
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * Pull Requestの作成を保証（既存チェック + 作成）
 */
export function ensurePullRequestCreated(
  issueNumber: number,
  headBranch: string,
  baseBranch: string,
  parsedIssue: ParsedIssue
): void {
  try {
    console.log(`\n🔍 PR存在チェック中... (${headBranch} → ${baseBranch})`);

    // 既存PRをチェック
    const existing = checkExistingPullRequest(headBranch, baseBranch);

    if (existing.exists) {
      console.log(`✅ PRは既に存在します: ${existing.url}`);
      console.log(`   状態: ${existing.state}`);
      return;
    }

    // PRタイトル・本文を生成
    const title = generatePrTitle(parsedIssue, issueNumber);
    const body = generatePrBody(parsedIssue, issueNumber);

    console.log("📝 PRを作成中...");

    // PR作成
    const result = createPullRequest(headBranch, baseBranch, title, body);

    if (result.success) {
      console.log(`✅ PRを作成しました: ${result.url}`);
    } else {
      console.warn("\n⚠️  PR作成に失敗しました");
      console.warn(`   エラー: ${result.error}`);
      console.warn("\n手動でPRを作成する場合は以下のコマンドを実行してください:");
      console.warn(`   gh pr create --head ${headBranch} --base ${baseBranch}`);
    }
  } catch (error) {
    console.warn("\n⚠️  PR作成処理中にエラーが発生しました:", error);
    console.warn("\n手動でPRを作成する場合は以下のコマンドを実行してください:");
    console.warn(`   gh pr create --head ${headBranch} --base ${baseBranch}`);
  }
}
