import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import type { InitOptions } from "../types/index.js";
import { backupDirectory } from "../lib/file-system.js";
import {
	copyDocTemplates,
	copySteeringDocs,
	generateClaudeDirectory,
	generateClaudeMd,
} from "../lib/merger.js";
import { loadPreset, presetExists } from "../lib/preset.js";

export async function initCommand(options: InitOptions): Promise<void> {
	const spinner = ora();
	const cwd = process.cwd();
	const claudeDir = path.join(cwd, ".claude");
	const docsDir = path.join(cwd, "docs");
	const templatesDir = path.join(docsDir, "templates");
	const steeringDir = path.join(docsDir, "steering");
	const claudeMdPath = path.join(cwd, "CLAUDE.md");

	console.log(chalk.blue("\n🚀 Einja Claude CLI - .claude セットアップ\n"));

	// 1. プリセット読み込み（minimal 固定）
	const presetName = "minimal";

	if (!(await presetExists(presetName))) {
		console.log(chalk.red(`❌ プリセット "${presetName}" が見つかりません`));
		process.exit(1);
	}

	const preset = await loadPreset(presetName);

	// 2. 既存の.claude確認
	if (await fs.pathExists(claudeDir)) {
		if (!options.force) {
			const { proceed } = await inquirer.prompt([
				{
					type: "confirm",
					name: "proceed",
					message: ".claudeディレクトリが既に存在します。上書きしますか？",
					default: false,
				},
			]);

			if (!proceed) {
				console.log(chalk.yellow("\n⚠️ キャンセルしました"));
				return;
			}
		}

		// 3. バックアップ作成
		if (options.backup !== false) {
			spinner.start("バックアップを作成中...");
			const backupPath = await backupDirectory(claudeDir);
			spinner.succeed(`バックアップ作成: ${path.basename(backupPath)}`);
		}

		// 既存ディレクトリを削除
		await fs.remove(claudeDir);
	}

	// 4. ドライラン
	if (options.dryRun) {
		console.log(chalk.blue("\n[Dry Run] 以下の操作が実行されます:"));
		console.log(`  - ${claudeDir} を作成`);
		console.log(`  - プリセット "${preset.name}" の設定を適用`);
		console.log("  - コアエージェント・コマンドをコピー");
		console.log("  - プリセット固有のファイルをコピー");
		console.log("  - settings.json をマージ・生成");
		console.log(`  - ${templatesDir} にドキュメントテンプレートをコピー`);
		console.log(`  - ${steeringDir} にステアリングドキュメントをコピー`);
		console.log(`  - ${claudeMdPath} を生成`);
		return;
	}

	// 5. .claudeディレクトリを生成
	spinner.start(".claudeをセットアップ中...");

	try {
		await fs.ensureDir(claudeDir);
		await generateClaudeDirectory(claudeDir, preset.config);
		spinner.succeed(".claudeのセットアップ完了");
	} catch (error) {
		spinner.fail(".claudeのセットアップに失敗しました");
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	// 6. ドキュメントテンプレートをコピー
	spinner.start("ドキュメントテンプレートをセットアップ中...");

	try {
		await copyDocTemplates(templatesDir);
		spinner.succeed(`ドキュメントテンプレート: ${templatesDir}`);
	} catch (error) {
		spinner.fail("ドキュメントテンプレートのセットアップに失敗しました");
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	// 7. ステアリングドキュメントをコピー
	spinner.start("ステアリングドキュメントをセットアップ中...");

	try {
		await copySteeringDocs(steeringDir);
		spinner.succeed(`ステアリングドキュメント: ${steeringDir}`);
	} catch (error) {
		spinner.fail("ステアリングドキュメントのセットアップに失敗しました");
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	// 8. CLAUDE.mdを生成
	spinner.start("CLAUDE.mdを生成中...");

	try {
		await generateClaudeMd(claudeMdPath, preset.config.variables);
		spinner.succeed(`CLAUDE.md: ${claudeMdPath}`);
	} catch (error) {
		spinner.fail("CLAUDE.mdの生成に失敗しました");
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	// 9. 完了メッセージ
	console.log(chalk.green("\n✅ セットアップ完了!"));
	console.log(chalk.gray("\n生成されたファイル:"));
	console.log("  - .claude/           Claude Code設定");
	console.log("  - docs/einja/templates/    ドキュメントテンプレート");
	console.log("  - docs/einja/steering/     ステアリングドキュメント");
	console.log("  - CLAUDE.md          プロジェクト設定");
	console.log(chalk.gray("\n次のステップ:"));
	console.log("  1. CLAUDE.md をプロジェクトに合わせてカスタマイズ");
	console.log("  2. settings.local.json を必要に応じて作成");
	console.log("  3. claude code で開発を開始");
}
