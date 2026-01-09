import { join } from "node:path";
import { execSync } from "node:child_process";
import inquirer from "inquirer";
import type { ToolSetupOptions } from "../../types/index.js";
import { writeWithStrategy, appendToGitignore } from "../../utils/fs.js";
import * as logger from "../../utils/logger.js";

const ENVRC_CONTENT = `# direnv configuration
# Load .env if it exists
dotenv_if_exists

# Allow local overrides
dotenv_if_exists .env.local
`;

const ENVRC_EXAMPLE_CONTENT = `# Example direnv configuration
# Copy this file to .envrc and run 'direnv allow'

# Load environment variables from .env
dotenv_if_exists

# Load local overrides
dotenv_if_exists .env.local
`;

/**
 * direnvのセットアップを実行する
 *
 * AC-003-1: .envrc ファイルが生成される
 * AC-003-2: .envrc.example ファイルが生成される
 * AC-003-3: .gitignore に .envrc が追加される
 */
export function setupDirenv(options: ToolSetupOptions): void {
  const { targetDir, conflictStrategy } = options;

  const envrcPath = join(targetDir, ".envrc");
  const envrcExamplePath = join(targetDir, ".envrc.example");

  writeWithStrategy(envrcPath, ENVRC_CONTENT, conflictStrategy);

  writeWithStrategy(envrcExamplePath, ENVRC_EXAMPLE_CONTENT, conflictStrategy);

  appendToGitignore(targetDir, ".envrc");
}

/**
 * direnv allowの確認プロンプトを表示し、実行する
 *
 * AC-003-4: 確認後 `direnv allow` が実行される
 *
 * @param targetDir - ターゲットディレクトリ
 */
export async function promptDirenvAllow(targetDir: string): Promise<void> {
  try {
    const { shouldAllow } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow を実行しますか？（環境変数を有効化します）",
        default: true,
      },
    ]);

    if (shouldAllow) {
      try {
        execSync("direnv allow", { cwd: targetDir, stdio: "inherit" });
        logger.success("direnv allow を実行しました");
      } catch (error) {
        logger.warn("direnv allow の実行に失敗しました");
        logger.info("後で手動で 'direnv allow' を実行してください");
      }
    } else {
      logger.info("direnv allow をスキップしました");
      logger.info("後で手動で 'direnv allow' を実行してください");
    }
  } catch (error) {
    // プロンプトがキャンセルされた場合など
    logger.info("direnv allow をスキップしました");
  }
}
