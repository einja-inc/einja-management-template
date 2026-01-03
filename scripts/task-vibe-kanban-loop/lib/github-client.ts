/**
 * GitHub Issue 操作（gh CLI wrapper）
 */

import { execSync } from "node:child_process";
import type { GitHubIssue, RepoInfo } from "./types.js";

/**
 * GitHub Issue を取得
 */
export function getIssue(issueNumber: number): GitHubIssue {
  try {
    const result = execSync(`gh issue view ${issueNumber} --json number,title,body,state`, {
      encoding: "utf-8",
    });
    const data = JSON.parse(result) as {
      number: number;
      title: string;
      body: string;
      state: string;
    };
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state as "open" | "closed",
    };
  } catch (error) {
    throw new Error(`GitHub Issue #${issueNumber} の取得に失敗しました: ${error}`);
  }
}

/**
 * GitHub Issue の本文を更新
 */
export function updateIssueBody(issueNumber: number, newBody: string): void {
  try {
    // 本文をファイルに書き出してから gh コマンドで更新（長い本文対策）
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");

    const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
    fs.writeFileSync(tempFile, newBody, "utf-8");

    execSync(`gh issue edit ${issueNumber} --body-file "${tempFile}"`, {
      encoding: "utf-8",
    });

    // 一時ファイルを削除
    fs.unlinkSync(tempFile);
  } catch (error) {
    throw new Error(`GitHub Issue #${issueNumber} の更新に失敗しました: ${error}`);
  }
}

/**
 * GitHub Issue の状態を確認（Open/Closed）
 */
export function isIssueClosed(issueNumber: number): boolean {
  try {
    const result = execSync(`gh issue view ${issueNumber} --json state`, {
      encoding: "utf-8",
    });
    const data = JSON.parse(result) as { state: string };
    return data.state === "CLOSED";
  } catch {
    // Issue が見つからない場合は閉じられていないとみなす
    return false;
  }
}

/**
 * リポジトリ情報を取得
 */
export function getRepoInfo(): RepoInfo {
  try {
    const result = execSync("gh repo view --json owner,name,defaultBranchRef", {
      encoding: "utf-8",
    });
    const data = JSON.parse(result) as {
      owner: { login: string };
      name: string;
      defaultBranchRef: { name: string };
    };
    return {
      owner: data.owner.login,
      name: data.name,
      defaultBranch: data.defaultBranchRef.name,
    };
  } catch (error) {
    throw new Error(`リポジトリ情報の取得に失敗しました: ${error}`);
  }
}

/**
 * Issue 本文のタスクグループを完了マークに更新
 * - [ ] **X.Y タスク名** → - [x] **X.Y タスク名**
 */
export function markTaskGroupAsCompleted(issueBody: string, taskGroupId: string): string {
  // パターン: - [ ] **X.Y で始まる行のチェックボックスを更新
  // 着手中コメントも削除
  const pattern = new RegExp(`^(\\s*)- \\[ \\] (\\*\\*${escapeRegex(taskGroupId)}\\s)(.*)$`, "gm");

  return issueBody.replace(pattern, (_match, indent, prefix, rest) => {
    // 着手中コメントを削除
    const cleanedRest = rest.replace(/\s*<!--\s*🔄\s*着手中\s*-->\s*$/, "");
    return `${indent}- [x] ${prefix}${cleanedRest}`;
  });
}

/**
 * 正規表現のエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
