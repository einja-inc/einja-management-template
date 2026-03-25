import inquirer from "inquirer";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SyncCategory, SyncCategoryConfig } from "@/types/index.js";

/**
 * 同期プロンプト結果の型定義
 */
export type SyncPromptResult = {
  categories: SyncCategory[];
  appsDetail?: string[];
  packagesDetail?: string[];
  packageJsonSections?: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">;
  conflictStrategy: "merge" | "overwrite" | "skip";
};

/**
 * カテゴリとファイルパターンのマッピング
 */
const CATEGORY_CONFIGS: Record<SyncCategory, SyncCategoryConfig> = {
  env: {
    name: "環境設定",
    description: ".env*, .envrc, .volta, .node-version",
    patterns: [".env*", ".envrc", ".volta", ".node-version"],
    defaultChecked: true,
    firstRunDefault: true,
  },
  tools: {
    name: "開発ツール",
    description: "biome.json, .biomeignore, .vibe-kanban.json, .prettierrc, .editorconfig",
    patterns: ["biome.json", ".biomeignore", ".vibe-kanban.json", ".prettierrc*", ".editorconfig"],
    defaultChecked: true,
    firstRunDefault: true,
  },
  git: {
    name: "Git設定",
    description: ".gitignore, .gitattributes",
    patterns: [".gitignore", ".gitattributes"],
    defaultChecked: false,
    firstRunDefault: true,
  },
  "git-hooks": {
    name: "Git Hooks",
    description: ".husky/, .lintstagedrc.js",
    patterns: [".husky/", ".lintstagedrc.js"],
    defaultChecked: false,
    firstRunDefault: true,
  },
  github: {
    name: "CI/CD",
    description: ".github/workflows/, .github/actions/",
    patterns: [".github/workflows/", ".github/actions/", ".github/dependabot.yml"],
    defaultChecked: false,
  },
  docker: {
    name: "コンテナ",
    description: "Dockerfile*, docker-compose.yml, .dockerignore",
    patterns: ["Dockerfile*", "docker-compose*.yml", ".dockerignore"],
    defaultChecked: false,
  },
  monorepo: {
    name: "モノレポ構成",
    description: "turbo.json, pnpm-workspace.yaml",
    patterns: ["turbo.json", "pnpm-workspace.yaml"],
    defaultChecked: false,
    firstRunDefault: true,
  },
  "root-config": {
    name: "ルート設定",
    description: "package.json, tsconfig.json, vitest.config.ts, postcss.config.cjs, next.config.ts, components.json, worktree.config.json, .mcp.json",
    patterns: ["package.json", "tsconfig.json", "vitest.config.ts", "postcss.config.cjs", "next.config.ts", "components.json", "worktree.config.json", ".mcp.json"],
    defaultChecked: false,
    firstRunDefault: true,
  },
  scripts: {
    name: "スクリプト",
    description: "scripts/ 配下",
    patterns: ["scripts/**"],
    defaultChecked: false,
  },
  apps: {
    name: "アプリケーション",
    description: "apps/ 配下（次の画面で個別選択）",
    patterns: ["apps/**"],
    defaultChecked: false,
    firstRunDefault: true,
    requiresDetailSelection: true,
  },
  packages: {
    name: "共通パッケージ",
    description: "packages/ 配下（次の画面で個別選択）",
    patterns: ["packages/**"],
    defaultChecked: false,
    firstRunDefault: true,
    requiresDetailSelection: true,
  },
  docs: {
    name: "ドキュメント",
    description: "README.md, docs/",
    patterns: ["README.md", "docs/**"],
    defaultChecked: false,
  },
  claude: {
    name: "Claude Code",
    description: "CLAUDE.md, .claude/settings.json, .claude/rules/",
    patterns: ["CLAUDE.md", ".claude/**"],
    defaultChecked: true,
    firstRunDefault: true,
  },
};

/**
 * デフォルトの同期カテゴリを取得
 * skipPrompts=true 時に使用
 */
export function getDefaultSyncCategories(): SyncCategory[] {
  return Object.entries(CATEGORY_CONFIGS)
    .filter(([_key, config]) => config.defaultChecked)
    .map(([key, _config]) => key as SyncCategory);
}

/**
 * 全同期カテゴリを取得
 * --all 時に使用
 */
export function getAllSyncCategories(): SyncCategory[] {
  return Object.keys(CATEGORY_CONFIGS) as SyncCategory[];
}

/**
 * 安全な同期カテゴリを取得（requiresDetailSelection を除外）
 * --yes 時に使用（apps, packages を除く）
 */
export function getSafeSyncCategories(): SyncCategory[] {
  return Object.entries(CATEGORY_CONFIGS)
    .filter(([_key, config]) => !config.requiresDetailSelection)
    .map(([key, _config]) => key as SyncCategory);
}

/**
 * テンプレートディレクトリからアプリ一覧を取得
 * @param templateDir - テンプレートディレクトリのパス
 * @returns アプリ名の配列
 */
function getAvailableApps(templateDir: string): string[] {
  const appsDir = path.join(templateDir, "apps");
  try {
    if (!fs.existsSync(appsDir)) {
      return [];
    }
    return fs
      .readdirSync(appsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (error) {
    console.error(`Error reading apps directory: ${error}`);
    return [];
  }
}

/**
 * テンプレートディレクトリからパッケージ一覧を取得
 * @param templateDir - テンプレートディレクトリのパス
 * @returns パッケージ名の配列
 */
function getAvailablePackages(templateDir: string): string[] {
  const packagesDir = path.join(templateDir, "packages");
  try {
    if (!fs.existsSync(packagesDir)) {
      return [];
    }
    return fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (error) {
    console.error(`Error reading packages directory: ${error}`);
    return [];
  }
}

/**
 * カテゴリ選択プロンプトを実行（5段階）
 * @param templateDir - テンプレートディレクトリのパス
 * @param isFirstRun - 初回実行かどうか
 * @returns SyncPromptResult - 同期設定
 */
export async function promptSyncCategories(
  templateDir: string,
  isFirstRun = false,
): Promise<SyncPromptResult> {
  // ステージ1: 大カテゴリ選択
  const categoryAnswers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "categories",
      message: "同期する項目を選択してください（Spaceで選択、Enterで確定）:",
      choices: Object.entries(CATEGORY_CONFIGS).map(([key, config]) => ({
        name: `${config.name} - ${config.description}`,
        value: key,
        checked: isFirstRun
          ? (config.firstRunDefault ?? config.defaultChecked ?? false)
          : (config.defaultChecked ?? false),
      })),
    },
  ]);

  const selectedCategories = categoryAnswers.categories as SyncCategory[];
  const hasApps = selectedCategories.includes("apps");
  const hasPackages = selectedCategories.includes("packages");
  const hasRootConfig = selectedCategories.includes("root-config");

  let appsDetail: string[] | undefined;
  let packagesDetail: string[] | undefined;
  let packageJsonSections: Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines"> | undefined;
  let conflictStrategy: "merge" | "overwrite" | "skip" = "merge";

  // ステージ2: apps詳細選択（appsが選択された場合のみ）
  if (hasApps) {
    const availableApps = getAvailableApps(templateDir);
    if (availableApps.length > 0) {
      const appsAnswers = await inquirer.prompt([
        {
          type: "checkbox",
          name: "apps",
          message: "同期するアプリケーションを選択:",
          choices: availableApps.map((app) => ({
            name: app,
            value: app,
            checked: true,
          })),
          validate: (input: string[]): boolean | string => {
            if (input.length === 0) {
              return "少なくとも1つのアプリを選択してください";
            }
            return true;
          },
        },
      ]);
      appsDetail = appsAnswers.apps as string[];
    } else {
      console.warn("警告: apps/ ディレクトリが見つからないか、アプリが存在しません");
      appsDetail = [];
    }
  }

  // ステージ3: packages詳細選択（packagesが選択された場合のみ）
  if (hasPackages) {
    const availablePackages = getAvailablePackages(templateDir);
    if (availablePackages.length > 0) {
      const packagesAnswers = await inquirer.prompt([
        {
          type: "checkbox",
          name: "packages",
          message: "同期するパッケージを選択:",
          choices: availablePackages.map((pkg) => ({
            name: pkg,
            value: pkg,
            checked: true,
          })),
          validate: (input: string[]): boolean | string => {
            if (input.length === 0) {
              return "少なくとも1つのパッケージを選択してください";
            }
            return true;
          },
        },
      ]);
      packagesDetail = packagesAnswers.packages as string[];
    } else {
      console.warn("警告: packages/ ディレクトリが見つからないか、パッケージが存在しません");
      packagesDetail = [];
    }
  }

  // ステージ4: package.json セクション選択（root-configが選択された場合のみ）
  if (hasRootConfig) {
    const packageJsonAnswers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "sections",
        message: "package.jsonの同期セクションを選択:",
        choices: [
          { name: "scripts（推奨）", value: "scripts", checked: true },
          { name: "engines（推奨）", value: "engines", checked: true },
          { name: "dependencies", value: "dependencies", checked: false },
          { name: "devDependencies", value: "devDependencies", checked: false },
          { name: "peerDependencies", value: "peerDependencies", checked: false },
        ],
      },
    ]);
    packageJsonSections = packageJsonAnswers.sections as Array<"scripts" | "dependencies" | "devDependencies" | "peerDependencies" | "engines">;
  }

  // ステージ5: 競合解決戦略選択
  const strategyAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "conflictStrategy",
      message: "競合解決戦略を選択してください:",
      choices: [
        { name: "マーカーベースマージ（推奨）", value: "merge" },
        { name: "テンプレートで上書き", value: "overwrite" },
        { name: "既存ファイル優先", value: "skip" },
      ],
      default: "merge",
    },
  ]);
  conflictStrategy = strategyAnswers.conflictStrategy as "merge" | "overwrite" | "skip";

  return {
    categories: selectedCategories,
    appsDetail,
    packagesDetail,
    packageJsonSections,
    conflictStrategy,
  };
}
