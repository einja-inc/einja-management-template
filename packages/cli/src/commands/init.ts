import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import { checkAndInstallDependencies } from "@/lib/dependency-checker.js";
import { backupDirectory } from "@/lib/file-system.js";
import { setupMcpConfig } from "@/lib/mcp-config.js";
import {
  copyDocTemplates,
  copyPresetDirectory,
  copyPresetFile,
  copySteeringDocs,
  createSymlinks,
  generateClaudeDirectory,
  generateClaudeMd,
} from "@/lib/merger.js";
import { detectPackageManager } from "@/lib/package-manager.js";
import { loadPreset, presetExists } from "@/lib/preset.js";
import type { InitOptions } from "@/types/index.js";

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora();
  const cwd = process.cwd();
  const claudeDir = path.join(cwd, ".claude");
  const docsDir = path.join(cwd, "docs");
  const einjaDocsDir = path.join(docsDir, "einja");
  const templatesDir = path.join(einjaDocsDir, "templates");
  const steeringDir = path.join(einjaDocsDir, "steering");
  const claudeMdPath = path.join(cwd, "CLAUDE.md");
  const instructionsDir = path.join(einjaDocsDir, "instructions");
  const exampleDir = path.join(einjaDocsDir, "example");
  const scriptsDir = path.join(cwd, "scripts");
  const envrcPath = path.join(cwd, ".envrc");
  const vscodeSettingsPath = path.join(cwd, ".vscode", "settings.json");

  console.log(chalk.blue("\n🚀 Einja Claude CLI - .claude セットアップ\n"));

  // 1. プリセット読み込み（デフォルト: default）
  const presetName = options.preset ?? "default";

  if (!(await presetExists(presetName))) {
    console.log(chalk.red(`❌ プリセット "${presetName}" が見つかりません`));
    console.log(chalk.gray("  利用可能なプリセット: default"));
    process.exit(1);
  }

  const preset = await loadPreset(presetName);

  // 2. ドライラン（ファイル操作前にチェック）
  if (options.dryRun) {
    console.log(chalk.blue("\n[Dry Run] 以下の操作が実行されます:"));
    console.log(`  - ${claudeDir} を作成`);
    console.log(`  - プリセット "${preset.name}" の設定を適用`);
    console.log("  - コアエージェント・コマンドをコピー");
    console.log("  - プリセット固有のファイルをコピー");
    console.log("  - settings.json をマージ・生成");
    console.log(`  - ${templatesDir} にドキュメントテンプレートをコピー`);
    console.log(`  - ${steeringDir} にステアリングドキュメントをコピー`);
    console.log(`  - ${instructionsDir} にinstructionsドキュメントをコピー`);
    console.log(`  - ${exampleDir} にexampleドキュメントをコピー`);
    console.log(`  - ${scriptsDir} にスクリプトをコピー`);
    console.log(`  - ${envrcPath} をコピー`);
    console.log(`  - ${vscodeSettingsPath} をコピー`);
    console.log(`  - ${claudeMdPath} を生成`);
    console.log("  - シンボリックリンクを作成（symlinks.json に基づく）");
    console.log("    リンク先パスはインストール時に自動計算");
    console.log("  - .mcp.json をセットアップ（既存設定とマージ）");
    console.log("  - 依存関係をチェック・インストール");
    return;
  }

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

    // バックアップ作成
    if (options.backup !== false) {
      spinner.start("バックアップを作成中...");
      const backupPath = await backupDirectory(claudeDir);
      spinner.succeed(`バックアップ作成: ${path.basename(backupPath)}`);
    }

    // 既存ディレクトリを削除
    await fs.remove(claudeDir);
  }

  // 4. .claudeディレクトリを生成
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

  // 5. ドキュメントテンプレートをコピー
  spinner.start("ドキュメントテンプレートをセットアップ中...");

  try {
    await copyDocTemplates(templatesDir);
    spinner.succeed(`ドキュメントテンプレート: ${templatesDir}`);
  } catch (error) {
    spinner.fail("ドキュメントテンプレートのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6. ステアリングドキュメントをコピー
  spinner.start("ステアリングドキュメントをセットアップ中...");

  try {
    await copySteeringDocs(steeringDir);
    spinner.succeed(`ステアリングドキュメント: ${steeringDir}`);
  } catch (error) {
    spinner.fail("ステアリングドキュメントのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6A. instructionsドキュメントをコピー
  spinner.start("instructionsドキュメントをセットアップ中...");

  try {
    await copyPresetDirectory(instructionsDir, "docs/einja/instructions");
    spinner.succeed(`instructionsドキュメント: ${instructionsDir}`);
  } catch (error) {
    spinner.fail("instructionsドキュメントのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6B. exampleドキュメントをコピー
  spinner.start("exampleドキュメントをセットアップ中...");

  try {
    await copyPresetDirectory(exampleDir, "docs/einja/example");
    spinner.succeed(`exampleドキュメント: ${exampleDir}`);
  } catch (error) {
    spinner.fail("exampleドキュメントのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6C. scriptsディレクトリをコピー
  spinner.start("スクリプトをセットアップ中...");

  try {
    await copyPresetDirectory(scriptsDir, "scripts");
    spinner.succeed(`スクリプト: ${scriptsDir}`);
  } catch (error) {
    spinner.fail("スクリプトのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6D. .envrcをコピー
  spinner.start(".envrcをセットアップ中...");

  try {
    await copyPresetFile(envrcPath, ".envrc");
    spinner.succeed(`.envrc: ${envrcPath}`);
  } catch (error) {
    spinner.fail(".envrcのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 6E. .vscode/settings.jsonをコピー
  spinner.start(".vscode/settings.jsonをセットアップ中...");

  try {
    await copyPresetFile(vscodeSettingsPath, ".vscode/settings.json");
    spinner.succeed(`.vscode/settings.json: ${vscodeSettingsPath}`);
  } catch (error) {
    spinner.fail(".vscode/settings.jsonのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 7. CLAUDE.mdを生成
  spinner.start("CLAUDE.mdを生成中...");

  try {
    await generateClaudeMd(claudeMdPath, preset.config.variables);
    spinner.succeed(`CLAUDE.md: ${claudeMdPath}`);
  } catch (error) {
    spinner.fail("CLAUDE.mdの生成に失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  // 8. シンボリックリンクを作成
  spinner.start("シンボリックリンクをセットアップ中...");

  try {
    const symlinkResult = await createSymlinks(cwd, presetName);

    if (symlinkResult.created > 0 || symlinkResult.fallback > 0) {
      const successCount = symlinkResult.created + symlinkResult.fallback;
      spinner.succeed(`シンボリックリンク: ${successCount} 件作成`);

      // 詳細ログを表示
      if (symlinkResult.logs.length > 0) {
        for (const log of symlinkResult.logs) {
          if (log.startsWith("警告:") || log.startsWith("エラー:")) {
            console.log(chalk.yellow(`    ${log}`));
          } else if (log.startsWith("リンク作成:")) {
            console.log(chalk.gray(`    ${log}`));
          }
        }
      }

      if (symlinkResult.fallback > 0) {
        console.log(
          chalk.yellow(`    ⚠ ${symlinkResult.fallback} 件は実体ファイルにフォールバック`)
        );
      }
    } else if (symlinkResult.skipped > 0 || symlinkResult.errors > 0) {
      spinner.warn("シンボリックリンク: 一部スキップまたはエラー");
      for (const log of symlinkResult.logs) {
        console.log(chalk.yellow(`    ${log}`));
      }
    } else {
      spinner.info("シンボリックリンク: 対象なし");
    }
  } catch (error) {
    spinner.fail("シンボリックリンクのセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    // シンボリックリンクの失敗は致命的ではないので続行
  }

  // 9. .mcp.json をセットアップ
  spinner.start(".mcp.json をセットアップ中...");

  // セットアップ結果を記録
  let mcpSetupSuccess = false;

  try {
    const mcpResult = await setupMcpConfig(cwd);

    if (mcpResult.skipped) {
      spinner.info(".mcp.json: テンプレートが見つかりません（スキップ）");
    } else if (!mcpResult.success) {
      spinner.warn(".mcp.json: 既存ファイルの読み込みに失敗しました（スキップ）");
      console.log(chalk.yellow(`    ⚠ ${mcpResult.error}`));
      console.log(chalk.yellow("    既存の .mcp.json は保持されます"));
    } else if (mcpResult.result) {
      mcpSetupSuccess = true;
      const totalServers =
        mcpResult.result.added.length +
        mcpResult.result.overwritten.length +
        mcpResult.result.preserved.length;
      spinner.succeed(`.mcp.json: ${totalServers} 件のサーバー設定`);
      if (mcpResult.result.added.length > 0) {
        console.log(chalk.green(`    + 追加: ${mcpResult.result.added.join(", ")}`));
      }
      if (mcpResult.result.overwritten.length > 0) {
        console.log(chalk.yellow(`    ↻ 更新: ${mcpResult.result.overwritten.join(", ")}`));
      }
      if (mcpResult.result.preserved.length > 0) {
        console.log(chalk.gray(`    = 保持: ${mcpResult.result.preserved.join(", ")}`));
      }
    }
  } catch (error) {
    spinner.fail(".mcp.json のセットアップに失敗しました");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }

  // 10. 依存関係チェック+インストール
  const packageJsonPath = path.join(cwd, "package.json");
  if (!options.skipDeps && (await fs.pathExists(packageJsonPath)) && preset.config.requirements) {
    const pm = await detectPackageManager(cwd);
    await checkAndInstallDependencies(cwd, preset.config.requirements, pm, {
      yes: options.yes,
      dryRun: options.dryRun,
    });
  }

  // 11. 完了メッセージ
  console.log(chalk.green("\n✅ セットアップ完了!"));
  console.log(chalk.gray("\n生成されたファイル:"));
  console.log("  - .claude/           Claude Code設定");
  console.log("  - docs/einja/templates/    ドキュメントテンプレート");
  console.log("  - docs/einja/steering/     ステアリングドキュメント");
  console.log("  - docs/einja/instructions/ 操作手順書");
  console.log("  - docs/einja/example/      サンプル・参考例");
  console.log("  - scripts/           ユーティリティスクリプト");
  console.log("  - .envrc             環境設定");
  console.log("  - .vscode/           エディタ設定");
  console.log("  - CLAUDE.md          プロジェクト設定");
  if (mcpSetupSuccess) {
    console.log("  - .mcp.json          MCPサーバー設定");
  }
  console.log(chalk.gray("\n次のステップ:"));
  console.log("  1. CLAUDE.md をプロジェクトに合わせてカスタマイズ");
  console.log("  2. settings.local.json を必要に応じて作成");
  console.log("  3. claude code で開発を開始");
}
