import { execSync } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import type { RequirementsConfig, SystemCommandRequirement } from "@/types/index.js";
import {
  type PackageManager,
  getAddDevCommand,
  resolveScriptPlaceholders,
} from "./package-manager.js";

export interface DependencyCheckResult {
  missingDevDeps: string[];
  missingScripts: Record<string, string>;
  missingSystemCommands: SystemCommandRequirement[];
  allSatisfied: boolean;
}

export interface InstallResult {
  devDepsInstalled: boolean;
  scriptsAdded: string[];
  systemCommandsWarned: string[];
}

/**
 * npm パッケージがコマンドとして利用可能かチェック（モノレポ + Yarn PnP 対応）
 */
async function isPackageAvailable(packageName: string, cwd: string): Promise<boolean> {
  // パッケージ名からコマンド名を推定
  const commandMap: Record<string, string[]> = {
    "@biomejs/biome": ["biome --version"],
    typescript: ["tsc --version"],
  };

  const commands = commandMap[packageName];
  if (!commands) {
    // マッピングがない場合は package.json の devDependencies をチェック
    try {
      const packageJsonPath = path.join(cwd, "package.json");
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        return !!(
          packageJson.devDependencies?.[packageName] || packageJson.dependencies?.[packageName]
        );
      }
    } catch {
      // ignore
    }
    return false;
  }

  for (const cmd of commands) {
    try {
      execSync(`npx --yes ${cmd}`, {
        cwd,
        stdio: "pipe",
        timeout: 30000,
      });
      return true;
    } catch {
      // コマンド実行失敗 = パッケージが利用不可
    }
  }
  return false;
}

/**
 * システムコマンドが利用可能かチェック
 */
function isSystemCommandAvailable(command: string): boolean {
  try {
    const checkCmd = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
    execSync(checkCmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 依存関係をチェック
 */
export async function checkDependencies(
  cwd: string,
  requirements: RequirementsConfig
): Promise<DependencyCheckResult> {
  const missingDevDeps: string[] = [];
  const missingScripts: Record<string, string> = {};
  const missingSystemCommands: SystemCommandRequirement[] = [];

  // 1. devDependencies チェック（コマンド実行ベース）
  if (requirements.devDependencies) {
    for (const packageName of Object.keys(requirements.devDependencies)) {
      const available = await isPackageAvailable(packageName, cwd);
      if (!available) {
        missingDevDeps.push(packageName);
      }
    }
  }

  // 2. scripts チェック（キー存在のみ）
  if (requirements.scripts) {
    try {
      const packageJsonPath = path.join(cwd, "package.json");
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const existingScripts = packageJson.scripts || {};
        for (const [key, value] of Object.entries(requirements.scripts)) {
          if (!existingScripts[key]) {
            missingScripts[key] = value;
          }
        }
      }
    } catch {
      // パース失敗時はスキップ
    }
  }

  // 3. systemCommands チェック
  if (requirements.systemCommands) {
    for (const req of requirements.systemCommands) {
      if (!isSystemCommandAvailable(req.command)) {
        missingSystemCommands.push(req);
      }
    }
  }

  const allSatisfied =
    missingDevDeps.length === 0 &&
    Object.keys(missingScripts).length === 0 &&
    missingSystemCommands.length === 0;

  return { missingDevDeps, missingScripts, missingSystemCommands, allSatisfied };
}

/**
 * 非対話モードかどうかを判定
 */
function isNonInteractive(options: { yes?: boolean }): boolean {
  return !!(options.yes || process.env.CI || !process.stdout.isTTY);
}

/**
 * 依存関係チェック+インストールを実行
 *
 * @param cwd - プロジェクトルートディレクトリ
 * @param requirements - preset.yaml の requirements セクション
 * @param pm - 検出されたパッケージマネージャ
 * @param options - オプション（yes, dryRun）
 * @param silent - 全て満たされている場合にメッセージを表示しない（sync用）
 */
export async function checkAndInstallDependencies(
  cwd: string,
  requirements: RequirementsConfig,
  pm: PackageManager,
  options: { yes?: boolean; dryRun?: boolean },
  silent = false
): Promise<InstallResult> {
  const spinner = ora();
  const result: InstallResult = {
    devDepsInstalled: false,
    scriptsAdded: [],
    systemCommandsWarned: [],
  };

  // 依存関係チェック
  spinner.start("依存関係をチェック中...");
  const checkResult = await checkDependencies(cwd, requirements);

  if (checkResult.allSatisfied) {
    if (!silent) {
      spinner.succeed("依存関係: すべて満たされています");
    } else {
      spinner.stop();
    }
    return result;
  }

  spinner.succeed("依存関係: 不足項目があります");

  // dry-run モード
  if (options.dryRun) {
    if (checkResult.missingDevDeps.length > 0) {
      console.log(chalk.yellow("\n  [Dry Run] 不足 devDependencies:"));
      for (const dep of checkResult.missingDevDeps) {
        console.log(chalk.yellow(`    - ${dep}`));
      }
    }
    if (Object.keys(checkResult.missingScripts).length > 0) {
      console.log(chalk.yellow("\n  [Dry Run] 不足 scripts:"));
      for (const [key, value] of Object.entries(checkResult.missingScripts)) {
        console.log(chalk.yellow(`    - ${key}: ${value}`));
      }
    }
    if (checkResult.missingSystemCommands.length > 0) {
      console.log(chalk.yellow("\n  [Dry Run] 不足システムコマンド:"));
      for (const cmd of checkResult.missingSystemCommands) {
        console.log(chalk.yellow(`    - ${cmd.command}: ${cmd.description}`));
      }
    }
    return result;
  }

  // devDependencies インストール
  if (checkResult.missingDevDeps.length > 0) {
    const addCmd = getAddDevCommand(pm, checkResult.missingDevDeps);

    console.log(chalk.cyan("\n  不足している devDependencies:"));
    for (const dep of checkResult.missingDevDeps) {
      console.log(chalk.cyan(`    - ${dep}`));
    }

    let proceed = true;
    if (!isNonInteractive(options)) {
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: `devDependencies をインストールしますか？ (${addCmd})`,
          default: true,
        },
      ]);
      proceed = answer.proceed;
    }

    if (proceed) {
      spinner.start(`devDependencies をインストール中... (${addCmd})`);
      try {
        execSync(addCmd, { cwd, stdio: "pipe", timeout: 120000 });
        spinner.succeed(
          `devDependencies インストール完了: ${checkResult.missingDevDeps.join(", ")}`
        );
        result.devDepsInstalled = true;
      } catch (error) {
        spinner.fail("devDependencies のインストールに失敗しました");
        console.error(chalk.red(`    ${error instanceof Error ? error.message : String(error)}`));
      }
    } else {
      console.log(chalk.yellow("  devDependencies のインストールをスキップしました"));
    }
  }

  // scripts 追加
  if (Object.keys(checkResult.missingScripts).length > 0) {
    const resolvedScripts = resolveScriptPlaceholders(checkResult.missingScripts, pm);

    console.log(chalk.cyan("\n  不足している scripts:"));
    for (const [key, value] of Object.entries(resolvedScripts)) {
      console.log(chalk.cyan(`    - ${key}: "${value}"`));
    }

    let proceed = true;
    if (!isNonInteractive(options)) {
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "不足している scripts を package.json に追加しますか？",
          default: true,
        },
      ]);
      proceed = answer.proceed;
    }

    if (proceed) {
      try {
        const packageJsonPath = path.join(cwd, "package.json");
        const packageJson = await fs.readJson(packageJsonPath);
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }
        for (const [key, value] of Object.entries(resolvedScripts)) {
          if (!packageJson.scripts[key]) {
            packageJson.scripts[key] = value;
            result.scriptsAdded.push(key);
          }
        }
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
        console.log(chalk.green(`  ✓ scripts を追加しました: ${result.scriptsAdded.join(", ")}`));
      } catch (error) {
        console.error(
          chalk.red(
            `  scripts の追加に失敗: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    } else {
      console.log(chalk.yellow("  scripts の追加をスキップしました"));
    }
  }

  // システムコマンド（手順表示のみ）
  if (checkResult.missingSystemCommands.length > 0) {
    console.log(chalk.yellow("\n  ⚠️  不足しているシステムコマンド（手動インストールが必要）:"));
    for (const cmd of checkResult.missingSystemCommands) {
      console.log(chalk.yellow(`    ${cmd.command}: ${cmd.description}`));
      const platform = process.platform as "darwin" | "linux" | "win32";
      const installCmd = cmd.install[platform];
      if (installCmd) {
        console.log(chalk.gray(`      インストール: ${installCmd}`));
      }
      result.systemCommandsWarned.push(cmd.command);
    }
  }

  return result;
}
