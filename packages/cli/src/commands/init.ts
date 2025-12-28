import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import type { InitOptions } from "../types/index.js";
import { backupDirectory } from "../lib/file-system.js";
import { generateClaudeDirectory } from "../lib/merger.js";
import { getAllPresets, loadPreset, presetExists } from "../lib/preset.js";

export async function initCommand(options: InitOptions): Promise<void> {
	const spinner = ora();
	const cwd = process.cwd();
	const claudeDir = path.join(cwd, ".claude");

	console.log(chalk.blue("\n🚀 Einja Claude CLI - .claude セットアップ\n"));

	// 1. プリセット選択
	let presetName = options.preset;

	if (!presetName) {
		const presets = await getAllPresets();

		if (presets.length === 0) {
			console.log(chalk.red("❌ 利用可能なプリセットがありません"));
			process.exit(1);
		}

		const { selectedPreset } = await inquirer.prompt([
			{
				type: "list",
				name: "selectedPreset",
				message: "使用するプリセットを選択してください:",
				choices: presets.map((p) => ({
					name: `${p.displayName} - ${p.description}`,
					value: p.name,
				})),
			},
		]);

		presetName = selectedPreset as string;
	}

	// 2. プリセット存在確認
	if (!presetName || !await presetExists(presetName)) {
		console.log(chalk.red(`❌ プリセット "${presetName}" が見つかりません`));
		const presets = await getAllPresets();
		console.log(chalk.gray(`利用可能なプリセット: ${presets.map((p) => p.name).join(", ")}`));
		process.exit(1);
	}

	const preset = await loadPreset(presetName);
	console.log(chalk.gray(`📦 プリセット: ${preset.displayName}`));

	// 3. 既存の.claude確認
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

		// 4. バックアップ作成
		if (options.backup !== false) {
			spinner.start("バックアップを作成中...");
			const backupPath = await backupDirectory(claudeDir);
			spinner.succeed(`バックアップ作成: ${path.basename(backupPath)}`);
		}

		// 既存ディレクトリを削除
		await fs.remove(claudeDir);
	}

	// 5. ドライラン
	if (options.dryRun) {
		console.log(chalk.blue("\n[Dry Run] 以下の操作が実行されます:"));
		console.log(`  - ${claudeDir} を作成`);
		console.log(`  - プリセット "${preset.name}" の設定を適用`);
		console.log(`  - コアエージェント・コマンドをコピー`);
		console.log(`  - プリセット固有のファイルをコピー`);
		console.log(`  - settings.json をマージ・生成`);
		return;
	}

	// 6. .claudeディレクトリを生成
	spinner.start(".claudeをセットアップ中...");

	try {
		await fs.ensureDir(claudeDir);
		await generateClaudeDirectory(claudeDir, preset.config);
		spinner.succeed(".claudeのセットアップ完了");
	} catch (error) {
		spinner.fail("セットアップに失敗しました");
		console.error(chalk.red(error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}

	// 7. 完了メッセージ
	console.log(chalk.green("\n✅ セットアップ完了!"));
	console.log(chalk.gray("\n次のステップ:"));
	console.log("  1. settings.local.json を必要に応じて作成");
	console.log("  2. CLAUDE.md をプロジェクトに合わせてカスタマイズ");
	console.log("  3. claude code で開発を開始");
}
