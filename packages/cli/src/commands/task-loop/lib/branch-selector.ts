/**
 * ブランチ選択モジュール
 *
 * ベースブランチのインタラクティブ選択
 */

import inquirer from "inquirer";

/** 非TTY環境でのデフォルトブランチ */
const DEFAULT_BRANCH = "main";

/**
 * ベースブランチを選択
 *
 * @param branchOption コマンドラインで指定されたブランチ名（未指定時は undefined）
 * @returns 選択されたベースブランチ名
 */
export async function selectBaseBranch(branchOption?: string): Promise<string> {
  // コマンドラインで指定されていれば使用
  if (branchOption) {
    return branchOption.trim();
  }

  // 非TTY環境ではデフォルト値を使用
  if (!process.stdin.isTTY) {
    console.log(`📌 非対話環境のため、デフォルトブランチを使用: ${DEFAULT_BRANCH}`);
    return DEFAULT_BRANCH;
  }

  // inquirer で選択
  const { branch } = await inquirer.prompt([
    {
      type: "list",
      name: "branch",
      message: "🌿 ベースブランチを選択してください:",
      choices: [
        { name: "main （推奨）", value: "main" },
        { name: "develop", value: "develop" },
        { name: "その他（自由入力）", value: "__other__" },
      ],
      default: "main",
    },
  ]);

  if (branch === "__other__") {
    const { customBranch } = await inquirer.prompt([
      {
        type: "input",
        name: "customBranch",
        message: "📝 ブランチ名を入力:",
        validate: (input) => input.trim() !== "" || "ブランチ名を入力してください",
      },
    ]);
    return customBranch.trim();
  }

  return branch;
}
