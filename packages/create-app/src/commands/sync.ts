import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import inquirer from "inquirer";
import { collectSyncFiles } from "@/generators/sync.js";
import {
  getAllSyncCategories,
  getSafeSyncCategories,
  promptSyncCategories,
} from "@/prompts/sync.js";
import type { SyncCategory, SyncMetadata, SyncOptions, SyncResult } from "@/types/index.js";
import { createBackup, getLatestBackup, restoreFromBackup } from "@/utils/backup.js";
import { checkGitStatusForSync } from "@/utils/git.js";
import * as logger from "@/utils/logger.js";
import {
  buildSyncFileMetadata,
  loadSyncMetadata,
  mergeAndWriteFile,
  saveSyncMetadata,
} from "@/utils/merger.js";
import { validatePlaceholders } from "@/utils/placeholder-validator.js";
import { detectProjectConfig } from "@/utils/project-detector.js";
import type { TemplateVariables } from "@/generators/template.js";

// 同期処理中のバックアップ情報を保持
let currentBackupDir: string | undefined;
let isSyncing = false;

/**
 * 中断時のクリーンアップ処理
 */
async function handleInterrupt(yes?: boolean): Promise<void> {
  if (!isSyncing) {
    // 同期処理開始前の中断は単純に終了
    logger.info("\n\n処理を中断しました");
    process.exit(0);
  }

  logger.info("\n\n🛑 同期処理を中断しています...");

  if (!currentBackupDir) {
    logger.info("バックアップが作成されていないため、クリーンアップは不要です");
    process.exit(0);
  }

  if (yes) {
    // --yes の場合、自動でロールバック
    logger.info("--yes モード: 自動でロールバックします");
    const targetDir = process.cwd();
    const success = await restoreFromBackup(currentBackupDir, targetDir);
    if (success) {
      logger.success("✓ ロールバック完了");
    } else {
      logger.error("❌ ロールバック失敗");
      logger.info(`手動で復元: cp -r ${currentBackupDir}/* .`);
    }
    process.exit(success ? 0 : 1);
  }

  // バックアップからのロールバック確認
  const answer = await inquirer.prompt([
    {
      type: "confirm",
      name: "rollback",
      message: "変更をロールバックしますか？",
      default: true,
    },
  ]);

  if (answer.rollback) {
    logger.info("バックアップから復元中...");
    const targetDir = process.cwd();
    const success = await restoreFromBackup(currentBackupDir, targetDir);

    if (success) {
      logger.success("✓ ロールバック完了");
    } else {
      logger.error("❌ ロールバック失敗");
      logger.info(`手動で復元: cp -r ${currentBackupDir}/* .`);
    }
  }

  process.exit(0);
}

/**
 * テンプレートパスを取得
 */
function getTemplatePath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const { existsSync } = fsExtra;

  // dist/cli.js → ../templates/default (1階層上)
  // src/commands/sync.ts → ../../templates/default (2階層上)
  const distPath = join(__dirname, "../templates/default");
  const srcPath = join(__dirname, "../../templates/default");

  if (existsSync(distPath)) {
    return distPath;
  }
  if (existsSync(srcPath)) {
    return srcPath;
  }

  throw new Error("テンプレートディレクトリが見つかりません");
}

/**
 * sync コマンドのメイン関数
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
  const { existsSync } = fsExtra;
  // Ctrl+C (SIGINT) ハンドラーを登録
  const sigintHandler = () => {
    handleInterrupt(options.yes).catch((error) => {
      logger.error(`クリーンアップ中にエラー: ${error}`);
      process.exit(1);
    });
  };

  process.on("SIGINT", sigintHandler);

  // 関数終了時にハンドラーを削除（正常終了時）
  const cleanup = () => {
    process.off("SIGINT", sigintHandler);
  };

  try {
    // ========================================
    // a) Rollback モード
    // ========================================
    if (options.rollback) {
      logger.info("🔄 バックアップからロールバック中...");

      const targetDir = process.cwd();
      const latestBackup = await getLatestBackup(targetDir);

      if (!latestBackup) {
        logger.error("❌ バックアップが見つかりません");
        process.exit(1);
      }

      logger.info(`バックアップ: ${latestBackup.name}`);

      const success = await restoreFromBackup(latestBackup.path, targetDir);
      if (success) {
        logger.success("✓ ロールバック完了");
      } else {
        logger.error("❌ ロールバック失敗");
        process.exit(1);
      }

      return;
    }

    // ========================================
    // b) Git チェック
    // ========================================
    const targetDir = process.cwd();
    checkGitStatusForSync(options.force || false, targetDir);

    // ========================================
    // c) プロンプトまたはデフォルト設定
    // ========================================
    const templatePath = getTemplatePath();

    let categories: SyncCategory[];
    let appsDetail: string[] | undefined;
    let packagesDetail: string[] | undefined;
    let conflictStrategy: "merge" | "overwrite" | "skip";
    let packageJsonSections:
      | Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">
      | undefined;

    if (options.categories) {
      // コマンドラインで指定されたカテゴリのみ（--yesや--allより優先）
      categories = options.categories as SyncCategory[];
      appsDetail = undefined;
      packagesDetail = undefined;
      conflictStrategy = "merge";

      logger.info(`指定されたカテゴリ: ${categories.join(", ")}`);
    } else if (options.all) {
      // --all: 全カテゴリ選択（apps, packages含む）
      categories = getAllSyncCategories();
      appsDetail = undefined; // 全apps
      packagesDetail = undefined; // 全packages
      conflictStrategy = "merge";

      logger.info("全カテゴリを同期対象に設定しました");
    } else if (options.yes) {
      // --yes: 安全なデフォルト（apps, packages除外）
      categories = getSafeSyncCategories();
      conflictStrategy = "merge";

      logger.info("安全なデフォルトカテゴリを同期対象に設定しました（apps, packagesを除外）");
    } else {
      // 対話式プロンプト
      const promptResult = await promptSyncCategories(templatePath);
      categories = promptResult.categories;
      appsDetail = promptResult.appsDetail;
      packagesDetail = promptResult.packagesDetail;
      conflictStrategy = promptResult.conflictStrategy;
      packageJsonSections = promptResult.packageJsonSections;
    }

    // ========================================
    // d) ファイル収集
    // ========================================
    logger.info("📁 同期対象ファイルを収集中...");

    const filesToSync = await collectSyncFiles(
      templatePath,
      categories,
      appsDetail,
      packagesDetail
    );

    if (filesToSync.length === 0) {
      logger.warn("⚠️ 同期対象のファイルが見つかりません");
      return;
    }

    logger.info(`同期対象: ${filesToSync.length}個のファイル`);

    // ========================================
    // d-2) プロジェクト設定の検出（テンプレート変数置換用）
    // ========================================
    let templateVariables: TemplateVariables | undefined;

    logger.info("🔍 プロジェクト設定を検出中...");
    const detectedConfig = await detectProjectConfig(targetDir);

    if (detectedConfig) {
      // 検出成功
      templateVariables = {
        projectName: detectedConfig.projectName,
        packageName: detectedConfig.packageScope,
        description: `${detectedConfig.projectName} - Einja Management Template`,
      };
      logger.info(`  ✓ プロジェクト名: ${detectedConfig.projectName}`);
      logger.info(`  ✓ パッケージスコープ: ${detectedConfig.packageScope}`);
    } else {
      // 検出失敗
      logger.warn("⚠️ プロジェクト設定を自動検出できませんでした");

      if (options.yes) {
        logger.error("❌ --yes モードではプロジェクト設定の自動検出が必須です");
        logger.error("プロジェクトのpackage.jsonにnameフィールドを設定してから再試行してください");
        process.exit(1);
      }

      // 対話的に入力を求める
      const inputAnswers = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "プロジェクト名を入力してください:",
          validate: (input: string) => {
            if (!input.trim()) {
              return "プロジェクト名は必須です";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "packageScope",
          message: "パッケージスコープを入力してください（例: @mycompany）:",
          validate: (input: string) => {
            if (!input.trim()) {
              return "パッケージスコープは必須です";
            }
            if (!input.startsWith("@")) {
              return "パッケージスコープは @ で始まる必要があります（例: @mycompany）";
            }
            return true;
          },
        },
      ]);

      templateVariables = {
        projectName: inputAnswers.projectName as string,
        packageName: inputAnswers.packageScope as string,
        description: `${inputAnswers.projectName} - Einja Management Template`,
      };
    }

    // ========================================
    // e) Dry-run モード
    // ========================================
    if (options.dryRun) {
      logger.info("\n📋 同期プレビュー (--dry-run)\n");

      for (const file of filesToSync) {
        logger.info(`  ✓ ${file}`);
      }

      logger.info(`\n合計: ${filesToSync.length}ファイル`);
      logger.info("--dry-run モードのため、実際のファイル変更は行われません");
      return;
    }

    // ========================================
    // f) バックアップ作成
    // ========================================
    let backupDir: string | undefined;

    if (options.backup !== false) {
      logger.info("💾 バックアップ作成中...");

      // 既存ファイルのみバックアップ
      const existingFiles = filesToSync.filter((file) => existsSync(join(targetDir, file)));

      if (existingFiles.length > 0) {
        backupDir = await createBackup(targetDir, existingFiles);
        currentBackupDir = backupDir; // グローバル変数に設定
      } else {
        logger.info("既存ファイルがないため、バックアップをスキップします");
      }
    }

    // ========================================
    // g) ファイル同期処理
    // ========================================
    logger.info("🔄 ファイル同期中...");

    isSyncing = true; // 同期処理開始をマーク

    // テンプレートの.mcp.jsonからサーバー名を取得してmanaged登録
    const templateMcpPath = join(templatePath, ".mcp.json");
    const mcpManagedPaths: string[] = [];
    if (existsSync(templateMcpPath)) {
      try {
        const mcpJson = JSON.parse(readFileSync(templateMcpPath, "utf-8"));
        if (mcpJson.mcpServers) {
          for (const serverName of Object.keys(mcpJson.mcpServers)) {
            mcpManagedPaths.push(`mcpServers.${serverName}`);
          }
        }
      } catch {
        // .mcp.json の読み取りに失敗した場合はmanaged pathsなしで続行
      }
    }

    const existingMetadata = await loadSyncMetadata(targetDir);

    // SyncMetadata の準備（前回sync情報を引き継ぎつつ managed paths を更新）
    const syncMetadata: SyncMetadata = {
      version: existingMetadata?.version ?? "1.1.0",
      lastSync: new Date().toISOString(),
      templateVersion: existingMetadata?.templateVersion ?? "0.3.20",
      files: existingMetadata?.files ?? {},
      jsonPaths: {
        managed: {
          ...(existingMetadata?.jsonPaths?.managed ?? {}),
          ...(mcpManagedPaths.length > 0 ? { ".mcp.json": mcpManagedPaths } : {}),
        },
        "project-private": existingMetadata?.jsonPaths?.["project-private"] ?? {},
      },
    };

    const result: SyncResult = {
      success: 0,
      skipped: 0,
      errors: 0,
      conflicts: 0,
      files: [],
    };

    for (const file of filesToSync) {
      try {
        const sourcePath = join(templatePath, file);
        const targetPath = join(targetDir, file);

        if (!existsSync(sourcePath)) {
          logger.warn(`スキップ: ${file} (テンプレートファイルが存在しません)`);
          result.skipped++;
          result.files.push({
            path: file,
            action: "skipped",
            reason: "テンプレートファイルが存在しません",
          });
          continue;
        }

        // マージまたはコピー（packageJsonSections と templateVariables を渡す）
        const mergeResult = await mergeAndWriteFile(
          sourcePath,
          targetPath,
          syncMetadata,
          file,
          packageJsonSections,
          conflictStrategy,
          templateVariables
        );

        // アクションをマッピング（mergeAndWriteFile の戻り値を SyncResult の型に変換）
        const mappedAction: "copied" | "merged" | "skipped" | "conflicted" =
          mergeResult.action === "created" || mergeResult.action === "overwritten"
            ? "copied"
            : mergeResult.action;

        if (mappedAction === "conflicted") {
          result.conflicts++;
        } else if (mappedAction === "skipped") {
          result.skipped++;
        } else {
          result.success++;
        }
        result.files.push({
          path: file,
          action: mappedAction,
          ...(mergeResult.conflicts.length > 0
            ? { reason: `${mergeResult.conflicts.length}件のコンフリクトを検出` }
            : {}),
        });

        syncMetadata.files[file] = buildSyncFileMetadata(mergeResult.templateContent, file);

        if (mappedAction === "conflicted") {
          logger.warn(`  ⚠ ${file} (${mergeResult.conflicts.length}件のコンフリクト)`);
        } else if (mappedAction === "skipped") {
          logger.info(`  → ${file} (スキップ)`);
        } else {
          logger.info(`  ✓ ${file}`);
        }
      } catch (error) {
        result.errors++;
        result.files.push({
          path: file,
          action: "error",
          reason: error instanceof Error ? error.message : "不明なエラー",
        });
        logger.error(`  ✗ ${file}: ${error}`);
      }
    }

    await saveSyncMetadata(targetDir, syncMetadata);

    // ========================================
    // h) 置換漏れ検証
    // ========================================
    const syncedFiles = result.files
      .filter((f) => f.action === "copied" || f.action === "merged")
      .map((f) => f.path);

    if (syncedFiles.length > 0) {
      const validation = await validatePlaceholders(targetDir, syncedFiles);
      if (!validation.isValid) {
        logger.warn("\n⚠ テンプレート変数の置換漏れを検出:");
        for (const v of validation.violations) {
          logger.warn(`  ${v.filePath}:${v.line} — ${v.placeholder}`);
        }
      }
    }

    // ========================================
    // i) 結果レポート
    // ========================================
    logger.info("\n📊 同期結果:");
    logger.info(`  成功: ${result.success}ファイル`);
    if (result.skipped > 0) {
      logger.info(`  スキップ: ${result.skipped}ファイル`);
    }
    if (result.conflicts > 0) {
      logger.warn(`  コンフリクト: ${result.conflicts}ファイル`);
    }
    if (result.errors > 0) {
      logger.error(`  エラー: ${result.errors}ファイル`);
    }

    if (result.errors > 0) {
      isSyncing = false; // エラー時もフラグをクリア

      logger.error("\n❌ 同期中にエラーが発生しました");
      if (backupDir) {
        logger.info("バックアップから復元: npx @einja-inc/create-app sync --rollback");
      }
      process.exit(1);
    }

    logger.success("\n✓ 同期完了");

    // 正常終了時はグローバル変数をクリア
    isSyncing = false;
    currentBackupDir = undefined;

    if (backupDir) {
      logger.info(`\nバックアップ: ${backupDir}`);
      logger.info("復元方法: npx @einja-inc/create-app sync --rollback");
    }
  } finally {
    cleanup();
  }
}
