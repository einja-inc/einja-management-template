import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import { checkAndInstallDependencies } from "@/lib/dependency-checker.js";
import { detectPackageManager } from "@/lib/package-manager.js";
import { loadPreset } from "@/lib/preset.js";
import { BatchProcessor } from "@/lib/sync/batch-processor.js";
import {
  createValidationErrorMessage,
  validateCategories,
} from "@/lib/sync/category-validator.js";
import { ConflictReporter } from "@/lib/sync/conflict-reporter.js";
import { OrphanCleaner } from "@/lib/sync/orphan-cleaner.js";
import { DiffEngine } from "@/lib/sync/diff-engine.js";
import { FileFilter } from "@/lib/sync/file-filter.js";
import { JsonProcessor } from "@/lib/sync/json-processor.js";
import { MarkerProcessor } from "@/lib/sync/marker-processor.js";
import { MetadataManager } from "@/lib/sync/metadata-manager.js";
import { ProjectPrivateSynchronizer } from "@/lib/sync/project-private-synchronizer.js";
import type { SyncOptions } from "@/types/index.js";
import type { JsonFileInfo, JsonOutput, SyncTarget } from "@/types/sync.js";

/**
 * ファイル内容にマーカーが含まれているかチェック
 */
function hasMarkers(content: string): boolean {
  return content.includes("@einja:managed:start") || content.includes("@einja:project-private:start") || content.includes("@einja:seed:start");
}

/**
 * マーカーベースのマージを実行する
 *
 * @param localContent - ローカルファイルの内容
 * @param templateContent - テンプレートファイルの内容
 * @param markerProcessor - MarkerProcessorインスタンス
 * @param projectPrivateSynchronizer - ProjectPrivateSynchronizerインスタンス
 * @returns マージ後の内容
 */
function mergeWithMarkers(
  localContent: string,
  templateContent: string,
  markerProcessor: MarkerProcessor,
  projectPrivateSynchronizer: ProjectPrivateSynchronizer
): string {
  // 1. ローカルのセクションをパース
  const localSections = markerProcessor.parseMarkers(localContent);

  // 2. managedセクションをテンプレート版で置換
  const afterManaged = markerProcessor.replaceManaged(localSections, templateContent);

  // 3. project-privateセクションを同期（ローカルに存在しないproject-privateを追加）
  const finalContent = projectPrivateSynchronizer.syncProjectPrivateSections(afterManaged, templateContent);

  return finalContent;
}

/**
 * CLAUDE.md.template のプレースホルダーを展開する
 */
function expandClaudeMdPlaceholders(content: string, pm: string): string {
  const replacements: [string, string][] = [
    ["{{INSTALL_COMMAND}}", `${pm} install`],
    ["{{DEV_BG_COMMAND}}", `${pm} dev:bg`],
    ["{{DEV_COMMAND}}", `${pm} dev`],
    ["{{BUILD_COMMAND}}", `${pm} build`],
    ["{{START_COMMAND}}", `${pm} start`],
    ["{{LINT_COMMAND}}", `${pm} lint`],
    ["{{FORMAT_COMMAND}}", `${pm} format`],
    ["{{TYPE_CHECK_COMMAND}}", `${pm} typecheck`],
    ["{{TEST_COMMAND}}", `${pm} test`],
  ];

  let result = content;
  for (const [placeholder, value] of replacements) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
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

  // パッケージマネージャーを検出（CLAUDE.md.templateのプレースホルダー展開用）
  const pm = await detectPackageManager(cwd);

  log(chalk.blue("\n🔄 テンプレート同期を開始...\n"), options);

  // 1. カテゴリのパース（--onlyオプション）
  let categories: string[] | undefined = undefined;

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
  const batchProcessor = new BatchProcessor(10); // バッチサイズ: 10ファイル
  const markerProcessor = new MarkerProcessor();
  const projectPrivateSynchronizer = new ProjectPrivateSynchronizer();
  const jsonProcessor = new JsonProcessor();
  const orphanCleaner = new OrphanCleaner(cwd, fileFilter);

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

  // 孤児検出（常に実行）
  const currentTemplateFiles = targets.map((t) => t.path);
  const orphans = await orphanCleaner.detectOrphans(metadata, currentTemplateFiles, categories);
  const orphanReport = orphanCleaner.createReport(orphans);

  // --force オプション時は全ファイルを対象にする
  const filesToProcess = options.force ? targets : changedFiles;

  if (filesToProcess.length === 0 && !orphanReport.hasOrphans) {
    log(chalk.green("\n✅ すでに最新です"), options);
    return;
  }

  // 変更ファイルなし & 孤児のみの場合
  if (filesToProcess.length === 0 && orphanReport.hasOrphans) {
    spinner.succeed("✓ 変更ファイルなし");

    if (options.dryRun) {
      log(orphanCleaner.formatReport(orphanReport), options);
      if (!options.clean) {
        log(orphanCleaner.formatHelpMessage(), options);
      }
      return;
    }

    // --clean 時: 孤児削除処理へ進む
    if (options.clean) {
      const existingOrphans = orphanReport.orphans.filter((o) => o.exists);

      if (existingOrphans.length > 0) {
        log(orphanCleaner.formatReport(orphanReport), options);

        // 確認プロンプト（--yes でスキップ）
        let proceedClean = options.yes ?? false;
        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: `${existingOrphans.length}ファイルを削除します。続行しますか？`,
              default: false,
            },
          ]);
          proceedClean = confirm;
        }

        if (proceedClean) {
          // ファイル削除
          let deletedCount = 0;
          for (const orphan of existingOrphans) {
            // パストラバーサル防御
            const normalized = path.normalize(orphan.path);
            if (normalized.includes('..') || path.isAbsolute(normalized)) {
              log(`  ⚠️  スキップ（不正なパス）: ${orphan.path}`, options);
              continue;
            }

            const fullPath = path.join(cwd, orphan.path);
            await fs.remove(fullPath);
            log(`  🗑️  削除: ${orphan.path}`, options);
            deletedCount++;
          }

          // メタデータから削除
          const orphanPaths = orphanReport.orphans.map((o) => o.path);
          const cleanedMetadata = metadataManager.removeFiles(metadata, orphanPaths);
          Object.assign(metadata, cleanedMetadata);
          await metadataManager.save(metadata);

          log(chalk.green(`\n✅ 孤児削除完了: ${deletedCount}ファイル`), options);
        }
      } else {
        // ディスク上に存在しない孤児のみ → メタデータだけクリーン
        const orphanPaths = orphanReport.orphans.map((o) => o.path);
        const cleanedMetadata = metadataManager.removeFiles(metadata, orphanPaths);
        Object.assign(metadata, cleanedMetadata);
        await metadataManager.save(metadata);
        log(chalk.green("\n✅ 孤児メタデータをクリーンアップしました"), options);
      }
      return;
    }

    // --clean なし: 警告表示のみ
    log(chalk.green("\n✅ すでに最新です"), options);
    log(orphanCleaner.formatReport(orphanReport), options);
    log(orphanCleaner.formatHelpMessage(), options);
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
      let templateContent = await fs.readFile(target.templatePath, "utf-8");

      // CLAUDE.md.template のプレースホルダーを展開
      if (target.templatePath.endsWith("CLAUDE.md.template")) {
        templateContent = expandClaudeMdPlaceholders(templateContent, pm);
      }

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
              "project-private": {},
            };

            const filePath = target.path;

            // baseContent の取得（3方向マージ用）
            const fileMetadata = metadata.files[target.path];
            const baseJson = fileMetadata?.baseContent
              ? JSON.parse(fileMetadata.baseContent) as Record<string, unknown>
              : undefined;

            const mergeResult = jsonProcessor.mergeJson(templateJson, localJson, jsonPaths, filePath, baseJson);

            if (mergeResult.conflicts.length > 0) {
              dryRunStats.conflicts++;
              // JSONコンフリクトをdryRunConflictsに変換（既存のフォーマットに合わせる）
              dryRunConflicts.set(target.path, mergeResult.conflicts.map((c) => ({
                line: 0,
                localContent: JSON.stringify(c.localValue),
                templateContent: JSON.stringify(c.templateValue),
              })));
              log(chalk.yellow(`  ⚠️  コンフリクト: ${target.path}`), options);
              for (const conflict of mergeResult.conflicts) {
                log(chalk.yellow(`      ${conflict.keyPath}: ローカル値を保持`), options);
              }
            } else {
              dryRunStats.updated++;
              log(chalk.cyan(`  📝 更新: ${target.path}`), options);
            }
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

    // 孤児レポート表示
    if (orphanReport.hasOrphans) {
      log(orphanCleaner.formatReport(orphanReport), options);
      if (!options.clean) {
        log(orphanCleaner.formatHelpMessage(), options);
      }
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

  // 8. ファイルマージ処理（並列処理でマージ計算、順次書き込み）
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
    let templateContent = await fs.readFile(target.templatePath, "utf-8");

    // CLAUDE.md.template のプレースホルダーを展開
    if (target.templatePath.endsWith("CLAUDE.md.template")) {
      templateContent = expandClaudeMdPlaceholders(templateContent, pm);
    }

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
    let localContent = await fs.readFile(projectPath, "utf-8");

    // 自動マイグレーション: 旧@einja:seedを検出したら@einja:project-privateに変換
    if (localContent.includes("@einja:seed:")) {
      const migratedContent = markerProcessor.migrateLegacySeedMarkers(localContent);
      // マイグレーション結果をファイルに書き戻す
      await fs.writeFile(projectPath, migratedContent, "utf-8");
      localContent = migratedContent;
    }

    // JSONファイルの場合はJsonProcessorを使用
    if (target.path.endsWith(".json")) {
      try {
        const templateJson = JSON.parse(templateContent);
        const localJson = JSON.parse(localContent);

        // jsonPathsの取得（メタデータに存在しない場合はデフォルト値）
        const jsonPaths = metadata.jsonPaths || {
          managed: {},
          "project-private": {},
        };

        const filePath = target.path;

        // baseContent の取得（3方向マージ用）
        const fileMetadata = metadata.files[target.path];
        const baseJson = fileMetadata?.baseContent
          ? JSON.parse(fileMetadata.baseContent) as Record<string, unknown>
          : undefined;

        const mergeResult = jsonProcessor.mergeJson(templateJson, localJson, jsonPaths, filePath, baseJson);
        const mergedContent = `${JSON.stringify(mergeResult.result, null, 2)}\n`;

        // JSONコンフリクトがあった場合
        if (mergeResult.conflicts.length > 0) {
          return {
            target,
            templateContent,
            mergeContent: mergedContent,
            success: false,
            conflicts: mergeResult.conflicts.map((c) => ({
              line: 0,
              localContent: JSON.stringify(c.localValue),
              templateContent: JSON.stringify(c.templateValue),
            })),
            action: "merged" as const,
          };
        }

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
      // project-privateのみ（managedなし）のファイル処理
      const hasManaged = localContent.includes("@einja:managed:start") ||
                         templateContent.includes("@einja:managed:start");
      const hasProjectPrivate = localContent.includes("@einja:project-private:start") ||
                                localContent.includes("@einja:seed:start") ||
                                templateContent.includes("@einja:project-private:start") ||
                                templateContent.includes("@einja:seed:start");

      if (!hasManaged && hasProjectPrivate) {
        // managedなしファイル: 3方向マージ + project-private保持
        const fileMetadata = metadata.files[target.path];
        const baseContent = fileMetadata
          ? (await metadataManager.getBaseContent(target.templatePath)).content
          : "";

        const result = projectPrivateSynchronizer.syncProjectPrivateOnlyFile(
          localContent, templateContent, baseContent, diffEngine
        );

        return {
          target,
          templateContent,
          mergeContent: result.content,
          success: result.success,
          conflicts: result.conflicts,
          action: "merged" as const,
        };
      }

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
        projectPrivateSynchronizer
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
    // JSONファイルの場合は baseContent（テンプレート内容）も保存
    const baseContent = result.target.path.endsWith(".json") ? result.templateContent : undefined;
    const updatedMetadata = await metadataManager.updateFileHash(
      metadata,
      result.target.path,
      result.templateContent,
      baseContent
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

  // 孤児削除処理（--clean 時のみ）
  let orphansDeleted = 0;
  if (options.clean && orphanReport.hasOrphans) {
    const existingOrphans = orphanReport.orphans.filter((o) => o.exists);

    if (existingOrphans.length > 0) {
      log(orphanCleaner.formatReport(orphanReport), options);

      // 確認プロンプト（--yes でスキップ）
      let proceedClean = options.yes ?? false;
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `${existingOrphans.length}ファイルを削除します。続行しますか？`,
            default: false,
          },
        ]);
        proceedClean = confirm;
      }

      if (proceedClean) {
        // ファイル削除
        for (const orphan of existingOrphans) {
          // パストラバーサル防御
          const normalized = path.normalize(orphan.path);
          if (normalized.includes('..') || path.isAbsolute(normalized)) {
            log(`  ⚠️  スキップ（不正なパス）: ${orphan.path}`, options);
            continue;
          }

          const fullPath = path.join(cwd, orphan.path);
          await fs.remove(fullPath);
          log(`  🗑️  削除: ${orphan.path}`, options);
          orphansDeleted++;
        }

        // メタデータから削除
        const orphanPaths = orphanReport.orphans.map((o) => o.path);
        const cleanedMetadata = metadataManager.removeFiles(metadata, orphanPaths);
        Object.assign(metadata, cleanedMetadata);
      }
    }
  }

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
        orphansDetected: orphanReport.total,
        orphansDeleted,
      },
      files: jsonFiles,
      metadata: {
        version: metadata.version,
        syncedAt: new Date().toISOString(),
      },
      orphans: orphanReport.hasOrphans ? orphanReport.orphans : undefined,
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

    // 孤児レポート
    if (orphanReport.hasOrphans) {
      if (options.clean && orphansDeleted > 0) {
        log(`  - 孤児削除: ${orphansDeleted}ファイル`, options);
      } else {
        log(orphanCleaner.formatReport(orphanReport), options);
        log(orphanCleaner.formatHelpMessage(), options);
      }
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
