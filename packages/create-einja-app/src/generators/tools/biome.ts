import { join } from "node:path";
import type { ToolSetupOptions } from "../../types/index.js";
import { writeWithStrategy, ensureDir } from "../../utils/fs.js";
import { addDependencies, addScripts } from "../../utils/package-json.js";

const BIOME_CONFIG = `{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["node_modules", "dist", ".next", "out", "build", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 100
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  }
}
`;

const VSCODE_SETTINGS = `{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
`;

/**
 * Biomeのセットアップを実行する（--setupモードのみ）
 *
 * AC-006-1: biome.json が生成される
 * AC-006-2: package.jsonにlint/formatスクリプトが追加される
 * AC-006-3: VSCode設定が追加される
 */
export function setupBiome(options: ToolSetupOptions): void {
  const { targetDir, conflictStrategy } = options;

  const biomeConfigPath = join(targetDir, "biome.json");
  writeWithStrategy(biomeConfigPath, BIOME_CONFIG, conflictStrategy);

  addDependencies(
    targetDir,
    {
      "@biomejs/biome": "^1.9.4",
    },
    true
  );

  addScripts(targetDir, {
    lint: "biome lint .",
    "lint:fix": "biome lint --write .",
    format: "biome format .",
    "format:fix": "biome format --write .",
  });

  const vscodeDir = join(targetDir, ".vscode");
  ensureDir(vscodeDir);

  const vscodeSettingsPath = join(vscodeDir, "settings.json");
  writeWithStrategy(vscodeSettingsPath, VSCODE_SETTINGS, conflictStrategy);
}
