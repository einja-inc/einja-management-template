import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import {
  promptAddConfig,
  getDefaultAddConfig,
} from "../prompts/add.js";
import type { AddConfig, AddOptions, SyncMetadata } from "../types/index.js";
import { addPackages } from "../generators/partials/packages.js";
import { addApps } from "../generators/partials/apps.js";
import { addConfigFiles } from "../generators/partials/config.js";
import {
  loadSyncMetadata,
  saveSyncMetadata,
} from "../utils/merger.js";
import * as logger from "../utils/logger.js";

/**
 * AddCommandOptions型
 * addコマンドのオプション
 */
export interface AddCommandOptions {
  skipPrompts: boolean;
  dryRun: boolean;
}

/**
 * テンプレートディレクトリのパスを取得
 * @param templateName - テンプレート名
 * @returns テンプレートディレクトリパス
 */
function getTemplatePath(templateName: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // バンドル後（dist/cli.js）とソース実行（src/commands/add.ts）の両方に対応
  // dist/cli.js -> ../templates/ (1階層上)
  // src/commands/add.ts -> ../../templates/ (2階層上)
  const distPath = join(__dirname, "../templates", templateName);
  const srcPath = join(__dirname, "../../templates", templateName);

  if (existsSync(distPath)) {
    return distPath;
  }
  if (existsSync(srcPath)) {
    return srcPath;
  }

  // どちらも存在しない場合はdistPathを返す（エラーメッセージ用）
  return distPath;
}

/**
 * テンプレートから.einja-sync.jsonを読み込む
 * @param templateDir - テンプレートディレクトリパス
 * @returns SyncMetadata または null（ファイルが存在しない場合）
 */
async function loadTemplateSyncMetadata(
  templateDir: string
): Promise<SyncMetadata | null> {
  const syncFilePath = join(templateDir, ".einja-sync.json");
  try {
    const content = await readFile(syncFilePath, "utf-8");
    return JSON.parse(content) as SyncMetadata;
  } catch {
    return null;
  }
}

/**
 * テンプレートと既存のSyncMetadataをマージ
 * @param template - テンプレートのSyncMetadata
 * @param existing - 既存のSyncMetadata
 * @returns マージされたSyncMetadata
 */
function mergeSyncMetadata(
  template: SyncMetadata | null,
  existing: SyncMetadata | null
): SyncMetadata {
  const now = new Date().toISOString();

  // テンプレートのjsonPathsを優先的に使用
  const jsonPaths =
    template?.jsonPaths ?? existing?.jsonPaths ?? { managed: {}, seed: {} };

  return {
    version: template?.version ?? existing?.version ?? "1.0.0",
    lastSync: now,
    templateVersion: template?.templateVersion ?? "1.0.0",
    files: { ...(existing?.files ?? {}), ...(template?.files ?? {}) },
    jsonPaths,
  };
}

/**
 * addコマンドの実装
 * @param options - コマンドオプション
 */
export async function addCommand(options: AddCommandOptions): Promise<void> {
  try {
    // Given: カレントディレクトリをターゲットとする
    const targetDir = process.cwd();

    // Given: プロンプトまたはデフォルト設定を取得
    let config: AddConfig;

    if (options.skipPrompts) {
      // When: skipPromptsが有効な場合、デフォルト設定を使用
      config = getDefaultAddConfig();
      logger.info("デフォルト設定を使用します（すべてのコンポーネントを選択）");
    } else {
      // When: 対話式プロンプトを実行
      config = await promptAddConfig(options.dryRun);
    }

    // Given: dry-runモードかどうかを設定に反映
    config.dryRun = options.dryRun;

    // When: dry-runモードの場合、プレビューを表示
    if (config.dryRun) {
      logger.warn("dry-runモード: 実際のファイル操作は行いません");
      logger.info("\n--- 追加予定のコンポーネント ---");

      if (config.components.packages) {
        logger.info(
          `- packages/: ${config.packageComponents.join(", ")}`
        );
      }

      if (config.components.apps) {
        logger.info(`- apps/: ${config.appComponents.join(", ")}`);
      }

      if (config.components.config) {
        logger.info("- 直下設定ファイル: turbo.json, pnpm-workspace.yaml 等");
      }

      logger.info("---\n");
    }

    // Given: テンプレートディレクトリのパスを取得
    const templateDir = getTemplatePath("default");

    // Given: テンプレートディレクトリの存在確認
    if (!existsSync(templateDir)) {
      throw new Error("テンプレートが見つかりません: default");
    }

    // Given: テンプレートのSyncMetadataを読み込む
    const templateMetadata = await loadTemplateSyncMetadata(templateDir);

    // Given: 既存のSyncMetadataを読み込む
    const existingMetadata = await loadSyncMetadata(targetDir);

    // When: テンプレートと既存のメタデータをマージ
    const syncMetadata = mergeSyncMetadata(templateMetadata, existingMetadata);

    // Given: AddOptionsを構築
    const addOptions: AddOptions = {
      targetDir,
      templateDir,
      config,
    };

    let totalAdded = 0;
    let totalMerged = 0;
    let totalSkipped = 0;

    // When: packages を追加
    if (config.components.packages && config.packageComponents.length > 0) {
      const spinner = ora("パッケージを追加中...").start();

      try {
        const result = await addPackages(
          addOptions,
          config.packageComponents,
          syncMetadata
        );

        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;

        spinner.succeed(
          `パッケージを追加しました（追加: ${result.added.length}, マージ: ${result.merged.length}, スキップ: ${result.skipped.length}）`
        );
      } catch (error) {
        spinner.fail("パッケージの追加に失敗しました");
        throw error;
      }
    }

    // When: apps を追加
    if (config.components.apps && config.appComponents.length > 0) {
      const spinner = ora("アプリを追加中...").start();

      try {
        const result = await addApps(
          addOptions,
          config.appComponents,
          syncMetadata
        );

        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;

        spinner.succeed(
          `アプリを追加しました（追加: ${result.added.length}, マージ: ${result.merged.length}, スキップ: ${result.skipped.length}）`
        );
      } catch (error) {
        spinner.fail("アプリの追加に失敗しました");
        throw error;
      }
    }

    // When: config を追加
    if (config.components.config) {
      const spinner = ora("設定ファイルを追加中...").start();

      try {
        const result = await addConfigFiles(addOptions, syncMetadata);

        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;

        spinner.succeed(
          `設定ファイルを追加しました（追加: ${result.added.length}, マージ: ${result.merged.length}, スキップ: ${result.skipped.length}）`
        );
      } catch (error) {
        spinner.fail("設定ファイルの追加に失敗しました");
        throw error;
      }
    }

    // When: SyncMetadataを更新して保存
    if (!config.dryRun) {
      syncMetadata.lastSync = new Date().toISOString();
      await saveSyncMetadata(targetDir, syncMetadata);
    }

    // Then: 結果サマリーを表示
    logger.success("\n✓ 追加完了！\n");

    if (config.dryRun) {
      logger.info("（dry-runモードのため、実際の変更は行われていません）\n");
    }

    logger.info(`追加されたファイル: ${totalAdded}個`);
    logger.info(`マージされたファイル: ${totalMerged}個`);
    logger.info(`スキップされたファイル: ${totalSkipped}個\n`);

    // When: @einja/cliがインストールされていない場合、案内メッセージを表示
    const packageJsonPath = join(targetDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = await import(packageJsonPath, {
        assert: { type: "json" },
      });

      const hasEinjaCli =
        packageJson.default?.devDependencies?.["@einja/dev-cli"] ||
        packageJson.default?.dependencies?.["@einja/dev-cli"];

      if (!hasEinjaCli) {
        logger.info("次のステップ:");
        logger.info("1. pnpm install");
        logger.info("2. pnpm dev:setup");
        logger.info("\n推奨:");
        logger.info("  einja開発支援CLI (@einja/dev-cli) のインストール:");
        logger.info("  pnpm add -D @einja/dev-cli\n");
      } else {
        logger.info("次のステップ:");
        logger.info("1. pnpm install");
        logger.info("2. pnpm dev:setup\n");
      }
    } else {
      logger.info("次のステップ:");
      logger.info("1. pnpm install");
      logger.info("2. pnpm dev:setup\n");
    }
  } catch (error) {
    logger.error("エラーが発生しました:");
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }
    process.exit(1);
  }
}
