/**
 * コマンドライン引数解析
 *
 * 使用例:
 *   pnpm task:loop 123
 *   pnpm task:loop 123 --max 4.2
 *   pnpm task:loop 123 --max 4.2 --base develop
 */

import minimist from "minimist";
import type { LoopArgs } from "./types.js";

interface ParsedArgs {
  _: (string | number)[];
  max?: string;
  base?: string;
  help?: boolean;
  h?: boolean;
}

/**
 * 使用方法を表示
 */
function printUsage(): void {
  console.log(`
使用方法: pnpm task:loop <issue-number> [options]

引数:
  <issue-number>    GitHub Issue 番号（必須）

オプション:
  --max <number>    最大タスク番号（例: 4, 4.2, all）
                    省略時は全タスクを実行
  --base <branch>   ベースブランチ名（例: main, develop）
                    省略時はリモートのデフォルトブランチを使用
  -h, --help        このヘルプを表示

例:
  pnpm task:loop 123                  # Issue #123 の全タスクを実行
  pnpm task:loop 123 --max 4          # Phase 4 まで実行
  pnpm task:loop 123 --max 4.2        # タスクグループ 4.2 まで実行
  pnpm task:loop 123 --base develop   # develop ブランチベースで実行
`);
}

/**
 * コマンドライン引数を解析
 * @param argv process.argv.slice(2) を渡す
 */
export function parseArgs(argv: string[]): LoopArgs | null {
  const parsed = minimist(argv, {
    string: ["max", "base"],
    boolean: ["help", "h"],
    alias: {
      h: "help",
    },
  }) as ParsedArgs;

  // ヘルプ表示
  if (parsed.help || parsed.h) {
    printUsage();
    return null;
  }

  // Issue 番号の取得
  const issueArg = parsed._[0];
  if (issueArg === undefined) {
    console.error("エラー: Issue 番号を指定してください");
    printUsage();
    return null;
  }

  const issueNumber = typeof issueArg === "number" ? issueArg : Number.parseInt(issueArg, 10);

  if (Number.isNaN(issueNumber) || issueNumber <= 0) {
    console.error(`エラー: 無効な Issue 番号です: ${issueArg}`);
    return null;
  }

  // 最大タスク番号の検証
  const maxTaskNumber = parsed.max;
  if (maxTaskNumber !== undefined && maxTaskNumber !== "all") {
    // 数値形式（4 or 4.2 or 4.2.1）の検証
    if (!/^\d+(\.\d+)*$/.test(maxTaskNumber)) {
      console.error(`エラー: 無効な最大タスク番号です: ${maxTaskNumber}`);
      console.error('  有効な形式: "4", "4.2", "4.2.1", "all"');
      return null;
    }
  }

  return {
    issueNumber,
    maxTaskNumber: maxTaskNumber ?? "all",
    baseBranch: parsed.base,
  };
}
