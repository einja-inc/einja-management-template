#!/usr/bin/env tsx
/**
 * cli-template:update スクリプト
 *
 * プロジェクトの最新コンテンツをCLIプリセットに反映する内部開発用スクリプト。
 *
 * 使用例:
 *   pnpm cli-template:update                # 全プリセット更新
 *   pnpm cli-template:update --dry-run      # 差分確認のみ
 *   pnpm cli-template:update --preset minimal  # 特定プリセットのみ
 *   pnpm cli-template:update --force        # 強制上書き
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CLIRepoDetector } from "../packages/cli/src/lib/preset-update/cli-repo-detector.js";
import { PresetFinder } from "../packages/cli/src/lib/preset-update/preset-finder.js";
import { FileCopier } from "../packages/cli/src/lib/preset-update/file-copier.js";
import type {
  Preset,
  CopyResult,
} from "../packages/cli/src/types/preset-update.js";

/**
 * コマンドラインオプション
 */
interface CliOptions {
  /** 更新対象のプリセット名（minimal, turborepo-pandacss, all） */
  preset: string;
  /** ドライランモード（ファイル変更なし） */
  dryRun: boolean;
  /** 強制上書き（確認プロンプトなし） */
  force: boolean;
  /** JSON形式で結果を出力 */
  json: boolean;
}

/**
 * スクリプト実行結果
 */
interface ExecutionResult {
  status: "success" | "error";
  summary?: {
    totalFiles: number;
    updated: number;
    skipped: number;
  };
  presets?: Record<
    string,
    {
      files: Array<{
        source: string;
        destination: string;
        action: "copied" | "skipped";
      }>;
      count: number;
    }
  >;
  error?: string;
}

/**
 * コマンドライン引数を解析
 */
function parseArguments(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    preset: "all",
    dryRun: false,
    force: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--preset":
      case "-p":
        options.preset = args[++i] || "all";
        break;
      case "--dry-run":
      case "-d":
        options.dryRun = true;
        break;
      case "--force":
      case "-f":
        options.force = true;
        break;
      case "--json":
      case "-j":
        options.json = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * ヘルプメッセージを表示
 */
function printHelp(): void {
  console.log(`
Usage: pnpm cli-template:update [options]

Options:
  -p, --preset <name>  更新対象のプリセット名（minimal, turborepo-pandacss, all）
  -d, --dry-run        実際の変更を行わず、コピー予定のファイル一覧を表示
  -f, --force          確認プロンプトなしで上書き実行
  -j, --json           JSON形式で結果を出力
  -h, --help           このヘルプメッセージを表示

Examples:
  pnpm cli-template:update
  pnpm cli-template:update --dry-run
  pnpm cli-template:update --preset turborepo-pandacss
  pnpm cli-template:update --force
  `);
}

/**
 * 確認プロンプトを表示
 */
async function confirmOverwrite(
  presets: Preset[],
  fileCount: number
): Promise<boolean> {
  const rl = readline.createInterface({ input, output });

  try {
    const presetNames = presets.map((p) => p.name).join(", ");
    const answer = await rl.question(
      `\n⚠️  ${presetNames}プリセットに${fileCount}ファイルをコピーします。\n既存ファイルを上書きします。続けますか？ (y/N): `
    );

    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

/**
 * 通常モードの出力
 */
function printNormalOutput(
  presets: Preset[],
  results: Map<string, CopyResult>,
  dryRun: boolean
): void {
  console.log("\n🔄 プリセット更新を開始...\n");

  let totalFiles = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const preset of presets) {
    const result = results.get(preset.name);
    if (!result) continue;

    console.log(`📁 ${preset.name}`);

    if (dryRun) {
      console.log(`  コピー予定: ${result.files.length}ファイル`);
      for (const file of result.files.slice(0, 5)) {
        console.log(`    ${file.source} → ${file.destination}`);
      }
      if (result.files.length > 5) {
        console.log(`    ... 他${result.files.length - 5}ファイル`);
      }
    } else {
      console.log(`  ✓ ${result.files.length}ファイル更新`);
    }

    if (result.skipped.length > 0) {
      console.log(`  スキップ: ${result.skipped.length}ファイル`);
    }

    totalFiles += result.files.length + result.skipped.length;
    totalUpdated += result.files.length;
    totalSkipped += result.skipped.length;

    console.log("");
  }

  if (dryRun) {
    console.log("✅ 差分確認完了（ファイル変更なし）");
  } else {
    console.log("✅ プリセット更新完了!");
  }

  console.log(`  - 合計: ${totalFiles}ファイル`);
  console.log(`  - 更新: ${totalUpdated}ファイル`);
  console.log(`  - スキップ: ${totalSkipped}ファイル\n`);
}

/**
 * JSON形式で結果を出力
 */
function printJsonOutput(
  presets: Preset[],
  results: Map<string, CopyResult>
): void {
  let totalFiles = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  const presetsData: ExecutionResult["presets"] = {};

  for (const preset of presets) {
    const result = results.get(preset.name);
    if (!result) continue;

    presetsData[preset.name] = {
      files: result.files,
      count: result.files.length,
    };

    totalFiles += result.files.length + result.skipped.length;
    totalUpdated += result.files.length;
    totalSkipped += result.skipped.length;
  }

  const output: ExecutionResult = {
    status: "success",
    summary: {
      totalFiles,
      updated: totalUpdated,
      skipped: totalSkipped,
    },
    presets: presetsData,
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * エラーを出力
 */
function printError(message: string, json: boolean): void {
  if (json) {
    const output: ExecutionResult = {
      status: "error",
      error: message,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.error(`\n❌ エラー: ${message}\n`);
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const options = parseArguments();

  // JSON出力モードの場合、標準エラー出力にログを出力
  const log = options.json ? console.error : console.log;

  try {
    // 1. CLIリポジトリかどうかを検証
    const detector = new CLIRepoDetector();
    const validation = await detector.validateRepository();

    if (!validation.valid) {
      printError(validation.error || "不明なエラー", options.json);
      process.exit(1);
    }

    const cliPackagePath = validation.cliPackagePath!;

    // 2. プリセットを検出
    const finder = new PresetFinder();
    let presetsToUpdate: Preset[] = [];

    if (options.preset === "all") {
      presetsToUpdate = await finder.findPresets(cliPackagePath);

      if (presetsToUpdate.length === 0) {
        printError("プリセットが見つかりませんでした", options.json);
        process.exit(1);
      }
    } else {
      const preset = await finder.getPreset(options.preset, cliPackagePath);

      if (!preset) {
        const availablePresets = await finder.findPresets(cliPackagePath);
        const presetNames = availablePresets.map((p) => p.name).join(", ");
        printError(
          `無効なプリセット: ${options.preset}。有効な値: ${presetNames}, all`,
          options.json
        );
        process.exit(1);
      }

      presetsToUpdate = [preset];
    }

    // 3. コピー対象ファイルをスキャン
    const copier = new FileCopier();
    const sourceFiles = await copier.scanSourceFiles(process.cwd());

    if (sourceFiles.length === 0) {
      printError("コピー対象ファイルが見つかりませんでした", options.json);
      process.exit(1);
    }

    // 4. 確認プロンプト（--forceまたは--dry-runでない場合）
    if (!options.force && !options.dryRun) {
      const confirmed = await confirmOverwrite(
        presetsToUpdate,
        sourceFiles.length
      );

      if (!confirmed) {
        if (!options.json) {
          log("\n処理がキャンセルされました\n");
        }
        process.exit(0);
      }
    }

    // 5. 各プリセットにコピー
    const results = new Map<string, CopyResult>();

    if (!options.json && !options.dryRun) {
      log("\n⚙️  プリセットへコピー中...\n");
    }

    for (const preset of presetsToUpdate) {
      const result = await copier.copyToPreset({
        preset,
        dryRun: options.dryRun,
        force: options.force,
      });

      results.set(preset.name, result);
    }

    // 6. 結果を出力
    if (options.json) {
      printJsonOutput(presetsToUpdate, results);
    } else {
      printNormalOutput(presetsToUpdate, results, options.dryRun);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    printError(message, options.json);
    process.exit(1);
  }
}

// スクリプト実行
main();
