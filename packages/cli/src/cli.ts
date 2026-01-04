import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";

const program = new Command();

// 旧パッケージ名での実行時に非推奨警告を表示
const isLegacyPackageName = process.argv[1]?.includes("@einja/claude-cli");
if (isLegacyPackageName) {
	console.warn(
		chalk.yellow(
			"⚠️  警告: @einja/claude-cli は非推奨です。今後は @einja/cli をご使用ください。",
		),
	);
	console.warn(chalk.yellow("   新しいパッケージ名: npx @einja/cli\n"));
}

program
	.name("einja-cli")
	.description("Einja CLI - .claude設定とテンプレート同期をnpxでインストール")
	.version("0.1.0");

program
	.command("init")
	.description(".claudeディレクトリをセットアップ")
	.option("-p, --preset <preset>", "使用するプリセット (turborepo-pandacss, minimal)")
	.option("-f, --force", "既存の.claudeを強制上書き")
	.option("--no-backup", "バックアップを作成しない")
	.option("--dry-run", "実行内容を表示するだけで実際には変更しない")
	.action(initCommand);

program
	.command("list")
	.description("利用可能なプリセット一覧を表示")
	.action(listCommand);

program.parse();
