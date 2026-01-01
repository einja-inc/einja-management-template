import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";

const program = new Command();

program
	.name("einja-claude")
	.description("Einja Claude Code セットアップCLI - .claude設定をnpxでインストール")
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
