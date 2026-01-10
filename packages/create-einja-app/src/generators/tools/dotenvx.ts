import { join } from "node:path";
import type { ToolSetupOptions } from "../../types/index.js";
import { writeWithStrategy } from "../../utils/fs.js";
import { addDependencies, addScripts } from "../../utils/package-json.js";

const ENV_EXAMPLE_CONTENT = `# Environment variables template
# Copy this file to .env and fill in the values

# Database
DATABASE_URL="postgresql://user:password@localhost:25432/dbname"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# OAuth (if using)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
`;

/**
 * dotenvxのセットアップを実行する
 *
 * AC-004-1: package.jsonに依存関係が追加される
 * AC-004-2: npm scriptsにdotenvxコマンドが追加される
 * AC-004-3: .env.example が生成される
 */
export function setupDotenvx(options: ToolSetupOptions): void {
  const { targetDir, conflictStrategy } = options;

  addDependencies(targetDir, {
    "@dotenvx/dotenvx": "^1.29.0",
  });

  addScripts(targetDir, {
    "env:encrypt": "dotenvx encrypt",
    "env:decrypt": "dotenvx decrypt",
  });

  const envExamplePath = join(targetDir, ".env.example");
  writeWithStrategy(envExamplePath, ENV_EXAMPLE_CONTENT, conflictStrategy);
}
