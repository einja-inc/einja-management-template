import { spawn, execSync } from "node:child_process";

interface ConflictInfo {
  targetBranch: string;
  sourceBranch: string;
  operationType: "base" | "phase";
}

function hasConflicts(cwd?: string): boolean {
  try {
    const options = cwd ? { cwd, encoding: "utf-8" as const } : { encoding: "utf-8" as const };
    const status = execSync("git status --porcelain", options);
    return status.includes("UU ") || status.includes("AA ") || status.includes("DD ");
  } catch {
    return false;
  }
}

export async function resolveConflictWithClaude(
  info: ConflictInfo,
  worktreePath: string
): Promise<boolean> {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 コンフリクトが検出されました。Claude Code を起動します");
  console.log("");
  console.log(`   対象ブランチ: ${info.targetBranch}`);
  console.log(`   マージ元: ${info.sourceBranch}`);
  console.log(`   作業ディレクトリ: ${worktreePath}`);
  console.log("");
  console.log("   📌 終了時は /exit を使用してください（Ctrl+C は使わないでください）");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  const prompt = `${info.sourceBranch} を ${info.targetBranch} にマージ中にコンフリクトが発生しました。

作業ディレクトリ: ${worktreePath}

【必須手順】以下の手順で解消してください:

1. コンフリクトファイル一覧を確認 (git diff --name-only --diff-filter=U)
2. **各ファイルごとに** 以下を実行:
   - 双方の差分を表示して説明 (git diff --ours / git diff --theirs)
   - **AskUserQuestionツールで** ユーザーに解消方法を選択させる
   - ユーザーの選択に従って解消
3. 全ファイル解消後、git add してから merge/rebase を継続

⚠️ 禁止事項:
- ユーザー確認なしでの自動解消
- --ours や --theirs の無断使用
- 複数ファイルをまとめて処理すること

完了したら /exit で終了してください。`;

  return new Promise((resolve) => {
    const child = spawn("claude", [prompt], {
      stdio: "inherit",
      cwd: worktreePath,
    });

    child.on("close", () => {
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      if (hasConflicts(worktreePath)) {
        console.log("❌ コンフリクトがまだ残っています");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        resolve(false);
      } else {
        console.log("✅ コンフリクト解消を確認しました。処理を再開します");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        resolve(true);
      }
    });

    child.on("error", (err) => {
      console.error("❌ Claude Code の起動に失敗しました:", err.message);
      resolve(false);
    });
  });
}
