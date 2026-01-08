import { join } from "node:path";
import type { ToolSetupOptions } from "../../types/index.js";
import { writeWithStrategy, appendToGitignore } from "../../utils/fs.js";

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
