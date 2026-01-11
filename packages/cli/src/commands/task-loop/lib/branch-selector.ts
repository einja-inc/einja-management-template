/**
 * ブランチ選択モジュール
 *
 * ベースブランチのインタラクティブ選択
 */

import { type Interface, createInterface } from "node:readline";

/** 選択肢として表示するブランチ */
const BRANCH_OPTIONS = ["develop", "staging", "main"] as const;

/** 非TTY環境でのデフォルトブランチ */
const DEFAULT_BRANCH = "main";

/**
 * readline でユーザー入力を取得
 */
function askQuestion(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * ベースブランチを選択
 *
 * @param branchOption コマンドラインで指定されたブランチ名（未指定時は undefined）
 * @returns 選択されたベースブランチ名
 */
export async function selectBaseBranch(branchOption?: string): Promise<string> {
  // コマンドラインで指定されていれば、トリムして使用
  if (branchOption) {
    return branchOption.trim();
  }

  // 非TTY環境（CI/CD、パイプ入力など）ではデフォルト値を使用
  if (!process.stdin.isTTY) {
    console.log(`📌 非対話環境のため、デフォルトブランチを使用: ${DEFAULT_BRANCH}`);
    console.log(`   ヒント: --branch オプションでブランチを指定できます\n`);
    return DEFAULT_BRANCH;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await interactiveSelectBranch(rl);
  } finally {
    rl.close();
  }
}

/**
 * インタラクティブにブランチを選択
 */
async function interactiveSelectBranch(rl: Interface): Promise<string> {
  console.log("\n🌿 ベースブランチを選択してください:\n");

  // 固定選択肢を表示
  for (let i = 0; i < BRANCH_OPTIONS.length; i++) {
    console.log(`  ${i + 1}. ${BRANCH_OPTIONS[i]}`);
  }
  console.log("  ─────────────────");
  console.log(`  ${BRANCH_OPTIONS.length + 1}. その他（フリー入力）`);
  console.log("");

  while (true) {
    const answer = await askQuestion(rl, `番号を入力 (1-${BRANCH_OPTIONS.length + 1}): `);
    const num = Number.parseInt(answer, 10);

    if (Number.isNaN(num) || num < 1 || num > BRANCH_OPTIONS.length + 1) {
      console.log(`❌ 1〜${BRANCH_OPTIONS.length + 1} の数字を入力してください`);
      continue;
    }

    // 固定選択肢を選択
    if (num <= BRANCH_OPTIONS.length) {
      const selected = BRANCH_OPTIONS[num - 1];
      console.log(`\n✅ ベースブランチ: ${selected}\n`);
      return selected;
    }

    // フリー入力
    return await manualInputBranch(rl);
  }
}

/**
 * 手動でブランチ名を入力
 */
async function manualInputBranch(rl: Interface): Promise<string> {
  console.log("\n📝 ブランチ名を入力してください\n");

  while (true) {
    const answer = await askQuestion(rl, "ブランチ名: ");

    if (!answer) {
      console.log("❌ ブランチ名を入力してください");
      continue;
    }

    console.log(`\n✅ ベースブランチ: ${answer}\n`);
    return answer;
  }
}
