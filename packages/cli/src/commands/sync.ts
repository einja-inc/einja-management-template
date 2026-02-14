import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import { checkAndInstallDependencies } from "../lib/dependency-checker.js";
import { detectPackageManager } from "../lib/package-manager.js";
import { loadPreset } from "../lib/preset.js";
import { BackupManager } from "../lib/sync/backup-manager.js";
import { BatchProcessor } from "../lib/sync/batch-processor.js";
import {
  createValidationErrorMessage,
  validateCategories,
} from "../lib/sync/category-validator.js";
import { ConflictReporter } from "../lib/sync/conflict-reporter.js";
import { DiffEngine } from "../lib/sync/diff-engine.js";
import { FileFilter } from "../lib/sync/file-filter.js";
import { JsonProcessor } from "../lib/sync/json-processor.js";
import { MarkerProcessor } from "../lib/sync/marker-processor.js";
import { MetadataManager } from "../lib/sync/metadata-manager.js";
import { SeedSynchronizer } from "../lib/sync/seed-synchronizer.js";
import type { SyncOptions } from "../types/index.js";
import type { JsonFileInfo, JsonOutput, SyncTarget } from "../types/sync.js";

/**
 * ファイル内容にマーカーが含まれているかチェック
 */
function hasMarkers(content: string): boolean {
  return (
    content.includes("@einja:managed:start") || content.includes("@einja:seed:start")
  );
}

/**
 * マーカーベースのマージを実行する
 *
 * @param localContent - ローカルファイルの内容
 * @param templateContent - テンプレートファイルの内容
 * @param markerProcessor - MarkerProcessorインスタンス
 * @param seedSynchronizer - SeedSynchronizerインスタンス
 * @returns マージ後の内容
 */
function mergeWithMarkers(
  localContent: string,
  templateContent: string,
  markerProcessor: MarkerProcessor,
  seedSynchronizer: SeedSynchronizer
): string {
  // 1. ローカルのセクションをパース
  const localSections = markerProcessor.parseMarkers(localContent);

  // 2. managedセクションをテンプレート版で置換
  const afterManaged = markerProcessor.replaceManaged(localSections, templateContent);

  // 3. seedセクションを同期（ローカルに存在しないseedを追加）
  const finalContent = seedSynchronizer.syncSeeds(afterManaged, templateContent);

  return finalContent;
}

/**
 * ログ出力用のユーティリティ関数
 * --jsonオプション時は標準エラー出力、それ以外は標準出力に出力
 */
function log(message: string, options: SyncOptions): void {
  if (options.json) {
    console.error(message);
  } else {
    console.log(message);
  }
}

/**
 * syncコマンドのエントリーポイント
 * テンプレートからの更新を同期し、ローカル変更を保持する
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
  // --jsonオプション時はspinnerを標準エラー出力に変更
  const spinner = ora({ stream: options.json ? process.stderr : process.stdout });
  const cwd = process.cwd();

  // パッケージのルートディレクトリを取得（ESモジュール対応）
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packageRoot = path.resolve(__dirname, "../..");
  const templateRoot = path.join(packageRoot, "presets", "default");

  log(chalk.blue("\n🔄 テンプレート同期を開始...\n"), options);

  // 1. カテゴリのパース（--onlyオプション）
  let categories: string[] | undefined ;

  if (options.only) {
    const validationResult = validateCategories(options.only);

    if (!validationResult.valid) {
      // 無効なカテゴリが含まれている場合、エラーメッセージを表示して終了
      // エラーは常に標準エラー出力
      console.error(chalk.red("\n❌ エラー:"));
      console.error(createValidationErrorMessage(validationResult.invalidCategories));
      process.exit(1);
    }

    categories = validationResult.validCategories;
  }

  // 2. 各マネージャーの初期化
  const metadataManager = new MetadataManager(cwd);
  const fileFilter = new FileFilter(cwd, templateRoot);
  const diffEngine = new DiffEngine();
  const conflictReporter = new ConflictReporter();
  const backupManager = new BackupManager(cwd);
  const batchProcessor = new BatchProcessor(10); // バッチサイズ: 10ファイル
  const markerProcessor = new MarkerProcessor();
  const seedSynchronizer = new SeedSynchronizer();
  const jsonProcessor = new JsonProcessor();

  // 3. メタデータ読み込み
  spinner.start("メタデータを読み込み中...");
  const metadata = await metadataManager.load();
  spinner.succeed("メタデータを読み込みました");

  // 4. 同期対象ファイルをスキャン
  spinner.start("📦 同期対象をスキャン中...");
  const targets = await fileFilter.scanSyncTargets({ categories });
  spinner.succeed(`✓ ${targets.length}ファイルを検出`);

  if (targets.length === 0) {
    log(chalk.yellow("\n⚠️ 同期対象のファイルがありません"), options);
    return;
  }

  // 5. 差分計算（並列処理）
  spinner.start("⚙️  差分を計算中...");
  const changedFilesFlags = await batchProcessor.processBatch(targets, async (target) => {
    const templateContent = await fs.readFile(target.templatePath, "utf-8");
    const fileMetadata = metadata.files[target.path];

    // 新規ファイルまたはテンプレートが変更されたファイルを判定
    if (!target.exists || !fileMetadata) {
      return { target, changed: true };
    }

    const currentHash = metadataManager.calculateHash(templateContent, target.templatePath);
    return { target, changed: fileMetadata.hash !== currentHash };
  });

  const changedFiles = changedFilesFlags
    .filter((result) => result.changed)
    .map((result) => result.target);

  // --force オプション時は全ファイルを対象にする
  const filesToProcess = options.force ? targets : changedFiles;

  if (filesToProcess.length === 0) {
    log(chalk.green("\n✅ すでに最新です"), options);
    return;
  }

  if (options.force) {
    spinner.succeed(`✓ ${filesToProcess.length}ファイルを強制同期`);
  } else {
    spinner.succeed(`✓ ${changedFiles.length}ファイルに変更あり`);
  }

  // 6. dry-runモード
  if (options.dryRun) {
    log(chalk.blue("\n🔍 [Dry Run] 差分を確認中...\n"), options);

    // dry-run時も差分計算とコンフリクト検出を実行
    const dryRunStats = {
      new: 0,
      updated: 0,
      conflicts: 0,
    };
    const dryRunConflicts = new Map<
      string,
      Array<{ line: number; localContent: string; templateContent: string }>
    >();

    for (const target of filesToProcess) {
      const templateContent = await fs.readFile(target.templatePath, "utf-8");

      if (!target.exists) {
        // 新規ファイル
        dryRunStats.new++;
        log(chalk.green(`  ✨ 新規: ${target.path}`), options);
      } else {
        // 既存ファイル：マージシミュレーション
        const projectPath = path.join(cwd, target.path);
        const localContent = await fs.readFile(projectPath, "utf-8");

        // JSONファイルの場合はJsonProcessorを使用
        if (target.path.endsWith(".json")) {
          try {
            const templateJson = JSON.parse(templateContent);
            const localJson = JSON.parse(localContent);

            // jsonPathsの取得（メタデータに存在しない場合はデフォルト値）
            const jsonPaths = metadata.jsonPaths || {
              managed: {},
              seed: {},
            };

            // ファイル名のみを抽出（create-einja-appの登録形式に合わせる）
            const fileName = target.path.split("/").pop() || target.path;
            jsonProcessor.mergeJson(templateJson, localJson, jsonPaths, fileName);

            // JSONマージは基本的に成功扱い
            dryRunStats.updated++;
            log(chalk.cyan(`  📝 更新: ${target.path}`), options);
          } catch (error) {
            // JSONのパースエラーの場合は3方向マージにフォールバック
            const fileMetadata = metadata.files[target.path];
            const baseContent = fileMetadata
              ? (await metadataManager.getBaseContent(target.templatePath)).content
              : "";

            const mergeResult = diffEngine.merge3Way(baseContent, localContent, templateContent);

            if (mergeResult.success) {
              dryRunStats.updated++;
              log(chalk.cyan(`  📝 更新: ${target.path}`), options);
            } else {
              dryRunStats.conflicts++;
              dryRunConflicts.set(target.path, mergeResult.conflicts);
              log(chalk.yellow(`  ⚠️  コンフリクト: ${target.path}`), options);
            }
          }
        } else {
          // 非JSONファイルの場合
          const fileMetadata = metadata.files[target.path];
          const baseContent = fileMetadata
            ? (await metadataManager.getBaseContent(target.templatePath)).content
            : "";

          const mergeResult = diffEngine.merge3Way(baseContent, localContent, templateContent);

          if (mergeResult.success) {
            dryRunStats.updated++;
            log(chalk.cyan(`  📝 更新: ${target.path}`), options);
          } else {
            dryRunStats.conflicts++;
            dryRunConflicts.set(target.path, mergeResult.conflicts);
            log(chalk.yellow(`  ⚠️  コンフリクト: ${target.path}`), options);
          }
        }
      }
    }

    // 差分サマリー表示
    log(chalk.blue("\n📊 差分サマリー:"), options);
    log(`  - 新規ファイル: ${dryRunStats.new}件`, options);
    log(`  - 更新ファイル: ${dryRunStats.updated}件`, options);
    log(`  - コンフリクト: ${dryRunStats.conflicts}件`, options);
    log(`  - 合計: ${filesToProcess.length}件\n`, options);

    // コンフリクト詳細表示
    if (dryRunConflicts.size > 0) {
      const conflictReport = conflictReporter.createReport(dryRunConflicts);
      log(chalk.yellow(conflictReporter.formatReport(conflictReport)), options);
      log(conflictReporter.formatHelpMessage(), options);
    } else {
      log(chalk.green("✅ コンフリクトは検出されませんでした。\n"), options);
    }

    return;
  }

  // 7. 確認プロンプト（--yes指定時はスキップ）
  if (!options.yes) {
    const promptConfig = options.force
      ? {
          message: chalk.red("⚠️  すべてのローカル変更が失われます。続けますか？"),
          default: false,
        }
      : {
          message: `${filesToProcess.length}ファイルを同期します。続行しますか？`,
          default: true,
        };

    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        ...promptConfig,
      },
    ]);

    if (!proceed) {
      log(chalk.yellow("\n⚠️ キャンセルしました"), options);
      return;
    }
  }

  // 8. バックアップ作成
  if (options.backup !== false) {
    spinner.start("バックアップを作成中...");
    const filesToBackup = filesToProcess.filter((f) => f.exists).map((f) => f.path);
    await backupManager.backupFiles(filesToBackup);
    spinner.succeed(`バックアップ作成完了: ${backupManager.getBackupDir()}`);
  }

  // 9. ファイルマージ処理（並列処理でマージ計算、順次書き込み）
  spinner.start("📝 ファイルをマージ中...");
  const conflictMap = new Map<
    string,
    Array<{ line: number; localContent: string; templateContent: string }>
  >();
  const jsonFiles: JsonFileInfo[] = [];
  let successCount = 0;
  let skipCount = 0;

  // マージ計算を並列実行
  const mergeResults = await batchProcessor.processBatch(filesToProcess, async (target) => {
    const templateContent = await fs.readFile(target.templatePath, "utf-8");
    const projectPath = path.join(cwd, target.path);

    if (!target.exists || options.force) {
      // 新規ファイルまたは強制上書き
      return {
        target,
        templateContent,
        mergeContent: templateContent,
        success: true,
        conflicts: [],
        action: (target.exists ? "merged" : "created") as "merged" | "created",
      };
    }

    // 既存ファイルの内容を読み込み
    const localContent = await fs.readFile(projectPath, "utf-8");

    // JSONファイルの場合はJsonProcessorを使用
    if (target.path.endsWith(".json")) {
      try {
        const templateJson = JSON.parse(templateContent);
        const localJson = JSON.parse(localContent);

        // jsonPathsの取得（メタデータに存在しない場合はデフォルト値）
        const jsonPaths = metadata.jsonPaths || {
          managed: {},
          seed: {},
        };

        // ファイル名のみを抽出（create-einja-appの登録形式に合わせる）
        const fileName = target.path.split("/").pop() || target.path;
        const mergedJson = jsonProcessor.mergeJson(
          templateJson,
          localJson,
          jsonPaths,
          fileName
        );

        const mergedContent = `${JSON.stringify(mergedJson, null, 2)}\n`;

        return {
          target,
          templateContent,
          mergeContent: mergedContent,
          success: true,
          conflicts: [],
          action: "merged" as const,
        };
      } catch (error) {
        // JSONのパースエラーの場合は3方向マージにフォールバック
        const fileMetadata = metadata.files[target.path];
        const baseContent = fileMetadata
          ? (await metadataManager.getBaseContent(target.templatePath)).content
          : "";
        const mergeResult = diffEngine.merge3Way(baseContent, localContent, templateContent);

        return {
          target,
          templateContent,
          mergeContent: mergeResult.content,
          success: mergeResult.success,
          conflicts: mergeResult.conflicts,
          action: "merged" as const,
        };
      }
    }

    // マーカーの有無をチェック（テンプレートまたはローカルにマーカーがある場合）
    const templateHasMarkers = hasMarkers(templateContent);
    const localHasMarkers = hasMarkers(localContent);

    if (templateHasMarkers || localHasMarkers) {
      // マーカーベースのマージ
      // 1. マーカーバリデーション
      const templateValidation = markerProcessor.validateMarkers(templateContent);
      const localValidation = markerProcessor.validateMarkers(localContent);

      if (!templateValidation.valid || !localValidation.valid) {
        // バリデーションエラーがある場合は3方向マージにフォールバック
        const fileMetadata = metadata.files[target.path];
        const baseContent = fileMetadata
          ? (await metadataManager.getBaseContent(target.templatePath)).content
          : "";
        const mergeResult = diffEngine.merge3Way(baseContent, localContent, templateContent);

        return {
          target,
          templateContent,
          mergeContent: mergeResult.content,
          success: mergeResult.success,
          conflicts: mergeResult.conflicts,
          action: "merged" as const,
        };
      }

      // 2. マーカーベースのマージを実行
      const mergedContent = mergeWithMarkers(
        localContent,
        templateContent,
        markerProcessor,
        seedSynchronizer
      );

      return {
        target,
        templateContent,
        mergeContent: mergedContent,
        success: true,
        conflicts: [],
        action: "merged" as const,
      };
    }

    // マーカーなしファイル：従来の3方向マージ
    const fileMetadata = metadata.files[target.path];
    const baseContent = fileMetadata
      ? (await metadataManager.getBaseContent(target.templatePath)).content
      : "";

    const mergeResult = diffEngine.merge3Way(baseContent, localContent, templateContent);

    return {
      target,
      templateContent,
      mergeContent: mergeResult.content,
      success: mergeResult.success,
      conflicts: mergeResult.conflicts,
      action: "merged" as const,
    };
  });

  // ファイル書き込みは順次実行（ファイルシステムの競合を避けるため）
  for (const result of mergeResults) {
    const projectPath = path.join(cwd, result.target.path);

    await fs.ensureDir(path.dirname(projectPath));
    await fs.writeFile(projectPath, result.mergeContent, "utf-8");

    if (result.success) {
      successCount++;
      log(`  ✓ ${result.target.path}`, options);

      jsonFiles.push({
        path: result.target.path,
        status: "success",
        action: result.action,
      });
    } else {
      conflictMap.set(result.target.path, result.conflicts);
      log(`  ⚠️ ${result.target.path} (コンフリクト)`, options);

      jsonFiles.push({
        path: result.target.path,
        status: "conflict",
        action: "marked",
        conflicts: result.conflicts.map((c) => ({
          line: c.line,
          local: c.localContent,
          template: c.templateContent,
        })),
      });
    }

    // メタデータ更新
    const updatedMetadata = await metadataManager.updateFileHash(
      metadata,
      result.target.path,
      result.templateContent
    );
    Object.assign(metadata, updatedMetadata);
  }

  skipCount = targets.length - filesToProcess.length;

  // スキップされたファイルのJSON出力データを追加
  for (const target of targets) {
    if (!filesToProcess.includes(target)) {
      jsonFiles.push({
        path: target.path,
        status: "skipped",
        action: "skipped",
      });
    }
  }

  spinner.succeed("ファイルマージ完了");

  // 10. メタデータ保存
  await metadataManager.save(metadata);

  // 11. コンフリクトレポート
  const conflictReport = conflictReporter.createReport(conflictMap);

  // 12. 結果出力
  if (options.json) {
    // JSON出力（設計書に準拠した形式）
    const jsonOutput: JsonOutput = {
      status: conflictReport.hasConflicts ? "partial_success" : "success",
      summary: {
        total: targets.length,
        changed: changedFiles.length,
        succeeded: successCount,
        conflicts: conflictReport.totalConflicts,
        skipped: skipCount,
      },
      files: jsonFiles,
      metadata: {
        version: metadata.version,
        syncedAt: new Date().toISOString(),
      },
    };
    // JSON出力は標準出力へ
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    // 通常出力
    log(chalk.green("\n✅ 同期完了!"), options);
    log(`  - 成功: ${successCount}ファイル`, options);
    if (conflictReport.totalConflicts > 0) {
      log(`  - コンフリクト: ${conflictReport.totalConflicts}ファイル`, options);
    }
    log(`  - スキップ: ${skipCount}ファイル`, options);

    if (conflictReport.hasConflicts) {
      log(conflictReporter.formatReport(conflictReport), options);
      log(conflictReporter.formatHelpMessage(), options);
    }
  }

  // 13. 依存関係チェック+インストール
  if (!options.skipDeps) {
    const packageJsonPath = path.join(cwd, "package.json");
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const preset = await loadPreset("default");
        if (preset.config.requirements) {
          log("", options); // 空行
          const pm = await detectPackageManager(cwd);
          await checkAndInstallDependencies(
            cwd,
            preset.config.requirements,
            pm,
            { yes: options.yes, dryRun: options.dryRun },
            true // silent: 全て満たされている場合は表示なし
          );
        }
      } catch {
        // プリセット読み込みエラーは無視
      }
    }
  }
}
