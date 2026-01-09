import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { ToolSetupOptions } from "../../types/index.js";
import { ensureDir } from "../../utils/fs.js";
import { addDependencies, addScripts, addLintStaged } from "../../utils/package-json.js";

const PRE_COMMIT_HOOK = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
`;

/**
 * Husky + lint-stagedのセットアップを実行する（--setupモードのみ）
 *
 * AC-007-1: .husky/ ディレクトリが生成される
 * AC-007-2: pre-commitフックが設定される
 * AC-007-3: lint-staged設定が追加される
 */
export function setupHusky(options: ToolSetupOptions): void {
  const { targetDir } = options;

  addDependencies(
    targetDir,
    {
      husky: "^9.1.7",
      "lint-staged": "^15.2.11",
    },
    true
  );

  addScripts(targetDir, {
    prepare: "husky",
  });

  addLintStaged(targetDir, {
    "*.{js,jsx,ts,tsx}": ["biome format --write", "biome lint --write"],
    "*.{json,md,yml,yaml}": ["biome format --write"],
  });

  const huskyDir = join(targetDir, ".husky");
  ensureDir(huskyDir);

  const preCommitPath = join(huskyDir, "pre-commit");
  writeFileSync(preCommitPath, PRE_COMMIT_HOOK, { mode: 0o755 });
}
