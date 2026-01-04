import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SyncOptions } from "../types/index.js";
import type { SyncTarget } from "../types/sync.js";
import { BackupManager } from "../lib/sync/backup-manager.js";
import { ConflictReporter } from "../lib/sync/conflict-reporter.js";
import { DiffEngine } from "../lib/sync/diff-engine.js";
import { FileFilter } from "../lib/sync/file-filter.js";
import { MetadataManager } from "../lib/sync/metadata-manager.js";

/**
 * syncコマンドのエントリーポイント
 * テンプレートからの更新を同期し、ローカル変更を保持する
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
	const spinner = ora();
	const cwd = process.cwd();

	// パッケージのルートディレクトリを取得（ESモジュール対応）
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const packageRoot = path.resolve(__dirname, "../..");
	const templateRoot = path.join(packageRoot, "presets", "turborepo-pandacss");

	console.log(chalk.blue("\n🔄 テンプレート同期を開始...\n"));

	// 1. カテゴリのパース（--onlyオプション）
	const categories = options.only ? options.only.split(",") : undefined;

	// 2. 各マネージャーの初期化
	const metadataManager = new MetadataManager(cwd);
	const fileFilter = new FileFilter(cwd, templateRoot);
	const diffEngine = new DiffEngine();
	const conflictReporter = new ConflictReporter();
	const backupManager = new BackupManager(cwd);

	// 3. メタデータ読み込み
	spinner.start("メタデータを読み込み中...");
	const metadata = await metadataManager.load();
	spinner.succeed("メタデータを読み込みました");

	// 4. 同期対象ファイルをスキャン
	spinner.start("📦 同期対象をスキャン中...");
	const targets = await fileFilter.scanSyncTargets({ categories });
	spinner.succeed(`✓ ${targets.length}ファイルを検出`);

	if (targets.length === 0) {
		console.log(chalk.yellow("\n⚠️ 同期対象のファイルがありません"));
		return;
	}

	// 5. 差分計算
	spinner.start("⚙️  差分を計算中...");
	const changedFiles: SyncTarget[] = [];
	for (const target of targets) {
		const templateContent = await fs.readFile(target.templatePath, "utf-8");
		const fileMetadata = metadata.files[target.path];

		// 新規ファイルまたはテンプレートが変更されたファイルを抽出
		if (!target.exists || !fileMetadata) {
			changedFiles.push(target);
		} else {
			const currentHash = metadataManager.calculateHash(templateContent);
			if (fileMetadata.hash !== currentHash) {
				changedFiles.push(target);
			}
		}
	}

	if (changedFiles.length === 0) {
		console.log(chalk.green("\n✅ すでに最新です"));
		return;
	}

	spinner.succeed(`✓ ${changedFiles.length}ファイルに変更あり`);

	// 6. dry-runモード
	if (options.dryRun) {
		console.log(chalk.blue("\n🔍 [Dry Run] 差分を確認中...\n"));

		// dry-run時も差分計算とコンフリクト検出を実行
		const dryRunStats = {
			new: 0,
			updated: 0,
			conflicts: 0,
		};
		const dryRunConflicts = new Map<string, Array<{ line: number; localContent: string; templateContent: string }>>();

		for (const target of changedFiles) {
			const templateContent = await fs.readFile(target.templatePath, "utf-8");

			if (!target.exists) {
				// 新規ファイル
				dryRunStats.new++;
				console.log(chalk.green(`  ✨ 新規: ${target.path}`));
			} else {
				// 既存ファイル：マージシミュレーション
				const projectPath = path.join(cwd, target.path);
				const localContent = await fs.readFile(projectPath, "utf-8");
				const fileMetadata = metadata.files[target.path];
				const baseContent = fileMetadata
					? (await metadataManager.getBaseContent(target.templatePath)).content
					: "";

				const mergeResult = diffEngine.merge3Way(
					baseContent,
					localContent,
					templateContent,
				);

				if (mergeResult.success) {
					dryRunStats.updated++;
					console.log(chalk.cyan(`  📝 更新: ${target.path}`));
				} else {
					dryRunStats.conflicts++;
					dryRunConflicts.set(target.path, mergeResult.conflicts);
					console.log(chalk.yellow(`  ⚠️  コンフリクト: ${target.path}`));
				}
			}
		}

		// 差分サマリー表示
		console.log(chalk.blue("\n📊 差分サマリー:"));
		console.log(`  - 新規ファイル: ${dryRunStats.new}件`);
		console.log(`  - 更新ファイル: ${dryRunStats.updated}件`);
		console.log(`  - コンフリクト: ${dryRunStats.conflicts}件`);
		console.log(`  - 合計: ${changedFiles.length}件\n`);

		// コンフリクト詳細表示
		if (dryRunConflicts.size > 0) {
			const conflictReport = conflictReporter.createReport(dryRunConflicts);
			console.log(chalk.yellow(conflictReporter.formatReport(conflictReport)));
			console.log(conflictReporter.formatHelpMessage());
		} else {
			console.log(chalk.green("✅ コンフリクトは検出されませんでした。\n"));
		}

		return;
	}

	// 7. 確認プロンプト
	if (!options.yes && !options.force) {
		const { proceed } = await inquirer.prompt([
			{
				type: "confirm",
				name: "proceed",
				message: `${changedFiles.length}ファイルを同期します。続行しますか？`,
				default: true,
			},
		]);

		if (!proceed) {
			console.log(chalk.yellow("\n⚠️ キャンセルしました"));
			return;
		}
	}

	// 8. バックアップ作成
	if (options.backup !== false) {
		spinner.start("バックアップを作成中...");
		const filesToBackup = changedFiles
			.filter((f) => f.exists)
			.map((f) => f.path);
		await backupManager.backupFiles(filesToBackup);
		spinner.succeed(`バックアップ作成完了: ${backupManager.getBackupDir()}`);
	}

	// 9. ファイルマージ処理
	spinner.start("📝 ファイルをマージ中...");
	const conflictMap = new Map<string, Array<{ line: number; localContent: string; templateContent: string }>>();
	let successCount = 0;
	let skipCount = 0;

	for (const target of changedFiles) {
		const templateContent = await fs.readFile(target.templatePath, "utf-8");
		const projectPath = path.join(cwd, target.path);

		if (!target.exists || options.force) {
			// 新規ファイルまたは強制上書き
			await fs.ensureDir(path.dirname(projectPath));
			await fs.writeFile(projectPath, templateContent, "utf-8");
			successCount++;
			console.log(`  ✓ ${target.path}`);
		} else {
			// 既存ファイル：3方向マージ
			const localContent = await fs.readFile(projectPath, "utf-8");
			const fileMetadata = metadata.files[target.path];
			const baseContent = fileMetadata
				? (await metadataManager.getBaseContent(target.templatePath)).content
				: "";

			const mergeResult = diffEngine.merge3Way(
				baseContent,
				localContent,
				templateContent,
			);

			if (mergeResult.success) {
				// コンフリクトなし：マージ結果を書き込み
				await fs.writeFile(projectPath, mergeResult.content, "utf-8");
				successCount++;
				console.log(`  ✓ ${target.path}`);
			} else {
				// コンフリクトあり：コンフリクトマーカー付きで書き込み
				await fs.writeFile(projectPath, mergeResult.content, "utf-8");
				conflictMap.set(target.path, mergeResult.conflicts);
				console.log(`  ⚠️ ${target.path} (コンフリクト)`);
			}
		}

		// メタデータ更新
		const updatedMetadata = await metadataManager.updateFileHash(
			metadata,
			target.path,
			templateContent,
		);
		Object.assign(metadata, updatedMetadata);
	}

	skipCount = targets.length - changedFiles.length;
	spinner.succeed("ファイルマージ完了");

	// 10. メタデータ保存
	await metadataManager.save(metadata);

	// 11. コンフリクトレポート
	const conflictReport = conflictReporter.createReport(conflictMap);

	// 12. 結果出力
	if (options.json) {
		// JSON出力
		const result = {
			success: !conflictReport.hasConflicts,
			stats: {
				total: targets.length,
				success: successCount,
				conflicts: conflictReport.totalConflicts,
				skipped: skipCount,
			},
			conflicts: conflictReport.files,
		};
		console.log(JSON.stringify(result, null, 2));
	} else {
		// 通常出力
		console.log(chalk.green("\n✅ 同期完了!"));
		console.log(`  - 成功: ${successCount}ファイル`);
		if (conflictReport.totalConflicts > 0) {
			console.log(`  - コンフリクト: ${conflictReport.totalConflicts}ファイル`);
		}
		console.log(`  - スキップ: ${skipCount}ファイル`);

		if (conflictReport.hasConflicts) {
			console.log(conflictReporter.formatReport(conflictReport));
			console.log(conflictReporter.formatHelpMessage());
		}
	}
}
