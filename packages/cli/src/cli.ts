import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { syncCommand } from "./commands/sync.js";
import { taskLoopCommand } from "./commands/task-loop/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

// 旧パッケージ名での実行時に非推奨警告を表示
const isLegacyPackageName =
  process.argv[1]?.includes("@einja/claude-cli") ||
  process.argv[1]?.includes("@einja/dev-cli");
if (isLegacyPackageName) {
  console.warn(
    chalk.yellow(
      "⚠️  警告: 旧パッケージ名は非推奨です。今後は @einja-inc/dev-cli をご使用ください。"
    )
  );
  console.warn(chalk.yellow("   新しいパッケージ名: npx @einja-inc/dev-cli\n"));
}

program
  .name("einja")
  .description("Einja CLI - .claude設定とテンプレート同期をnpxでインストール")
  .version(pkg.version);

program
  .command("init")
  .description(".claudeディレクトリをセットアップ")
  .option("-p, --preset <preset>", "使用するプリセット (デフォルト: default)", "default")
  .option("-f, --force", "既存の.claudeを強制上書き")
  .option("--no-backup", "バックアップを作成しない")
  .option("--dry-run", "実行内容を表示するだけで実際には変更しない")
  .option("--skip-deps", "依存関係のチェック・インストールをスキップ")
  .option("-y, --yes", "確認プロンプトをスキップ")
  .action(initCommand);

program.command("list").description("利用可能なプリセット一覧を表示").action(listCommand);

program
  .command("sync")
  .description("テンプレートから更新を同期")
  .option("-o, --only <categories>", "同期するカテゴリをカンマ区切りで指定")
  .option("-d, --dry-run", "実際の変更を行わず、差分のみ表示")
  .option("-f, --force", "ローカル変更を無視してテンプレートで上書き")
  .option("-y, --yes", "確認プロンプトをスキップ")
  .option("-j, --json", "JSON形式で結果を出力")
  .option("--clean", "テンプレートから削除されたファイル（孤児）を削除")
  .option("--skip-deps", "依存関係のチェック・インストールをスキップ")
  .action(syncCommand);

program
  .command("task:loop [issue]")
  .description("GitHub Issueのタスクを自動実行")
  .option("-m, --max-group <number>", "最大タスクグループ番号")
  .option("-b, --branch <name>", "ベースブランチ")
  .action(taskLoopCommand);

program.parse();
