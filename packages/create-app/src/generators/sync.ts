import { glob } from "glob";
import type { SyncCategory } from "@/types/index.js";
import * as logger from "@/utils/logger.js";

/**
 * カテゴリとファイルパターンのマッピング
 * prompts/sync.ts の CATEGORY_CONFIGS と同じ定義
 */
const CATEGORY_PATTERNS: Record<SyncCategory, string[]> = {
  env: [".env*", ".envrc", "mise.toml", ".node-version"],
  tools: ["biome.json", ".biomeignore", ".vibe-kanban.json", ".prettierrc*", ".editorconfig"],
  git: [".gitignore", ".gitattributes"],
  "git-hooks": [".husky/**", ".lintstagedrc.js"],
  github: [".github/workflows/**", ".github/actions/**", ".github/dependabot.yml", ".github/app-config.json"],
  docker: ["Dockerfile*", "docker-compose*.yml", ".dockerignore"],
  monorepo: ["turbo.json", "pnpm-workspace.yaml"],
  "root-config": ["package.json", "tsconfig.json", "vitest.config.ts", "postcss.config.cjs", "next.config.ts", "components.json", "worktree.config.json", ".mcp.json"],
  scripts: ["scripts/**"],
  apps: ["apps/**"],
  packages: ["packages/**"],
  docs: ["README.md", "docs/**"],
  claude: ["CLAUDE.md", ".claude/**"],
};

/**
 * envファイル保護ルール
 * これらのファイルは同期対象外（暗号化キーと個人設定）
 */
const ENV_FILE_PROTECTION = {
  // 同期から保護するファイル（秘密鍵・暗号化済み値を含む）
  protected: [
    ".env.keys",
    ".env.personal",
    ".env.develop",
    ".env.local",
    ".env.production",
    ".env.staging",
    ".env.preview",
  ],
  // 同期を許可するファイル（テンプレート・例示ファイル）
  allowed: [
    ".env.example",
    ".env.personal.example",
    ".envrc",
  ],
};

/**
 * 同期から除外するファイルパターン
 * ユーザー固有のデータやビルド生成物を除外
 */
const SYNC_EXCLUDE_PATTERNS = [
  "**/db/schema.ts",              // DBモデルはユーザー固有
  "**/db/migrations/**",          // マイグレーション履歴
  "**/db/seed.ts",                // シードデータはユーザー固有
  "**/drizzle.config.ts",         // drizzle 設定はユーザー固有
  "pnpm-lock.yaml",               // lockfile は sync すべきでない
  "**/node_modules/**",           // 依存関係
  "**/.git/**",                   // Git内部
];

/**
 * envファイルが保護対象かチェック（ホワイトリスト方式）
 * @param filePath - ファイルパス
 * @returns 保護対象の場合 true
 */
function isProtectedEnvFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() ?? "";

  // allowedリストに含まれる場合は保護しない（同期を許可）
  if (ENV_FILE_PROTECTION.allowed.some((pattern) => fileName === pattern)) {
    return false;
  }

  // protectedリストに含まれる場合は保護（同期を拒否）
  if (ENV_FILE_PROTECTION.protected.some((pattern) => fileName === pattern)) {
    return true;
  }

  // .env で始まるファイルはデフォルトで保護（allowedにない限り）
  if (fileName.startsWith(".env")) {
    return true;
  }

  return false;
}

/**
 * ファイルが除外パターンにマッチするかチェック
 * @param filePath - ファイルパス
 * @returns 除外対象の場合 true
 */
function isExcludedFile(filePath: string): boolean {
  for (const pattern of SYNC_EXCLUDE_PATTERNS) {
    // 簡易的なパターンマッチング（glob 互換）
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")  // ** → 任意のディレクトリ
      .replace(/\*/g, "[^/]*") // * → 任意の文字（ただし / 以外）
      .replace(/\./g, "\\.");  // . → エスケープ

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * apps/packagesの詳細フィルタリング
 * @param files - 全ファイルリスト
 * @param detail - 選択された詳細項目
 * @param prefix - "apps" or "packages"
 * @returns フィルタリング後のファイルリスト
 */
function filterDetailFiles(
  files: string[],
  detail: string[] | undefined,
  prefix: string
): string[] {
  if (!detail || detail.length === 0) {
    // 詳細指定なしの場合は全て含める
    return files;
  }

  // 選択されたアイテムのみをフィルタリング
  return files.filter((file) =>
    detail.some((item) => file.startsWith(`${prefix}/${item}/`))
  );
}

/**
 * カテゴリからglobパターンを抽出
 * @param categories - 選択されたカテゴリ
 * @param appsDetail - apps詳細選択（オプション）
 * @param packagesDetail - packages詳細選択（オプション）
 * @returns globパターン配列
 */
function extractPatternsFromCategories(
  categories: SyncCategory[],
  appsDetail?: string[],
  packagesDetail?: string[]
): string[] {
  const patterns: string[] = [];

  for (const category of categories) {
    const categoryPatterns = CATEGORY_PATTERNS[category];

    if (!categoryPatterns) {
      logger.warn(`不明なカテゴリ: ${category}`);
      continue;
    }

    // apps/packages は詳細選択に応じてパターンを調整
    if (category === "apps" && appsDetail && appsDetail.length > 0) {
      // 例: ["web"] → ["apps/web/**"]
      patterns.push(...appsDetail.map((app) => `apps/${app}/**`));
    } else if (category === "packages" && packagesDetail && packagesDetail.length > 0) {
      // 例: ["server-core"] → ["packages/server-core/**"]
      patterns.push(...packagesDetail.map((pkg) => `packages/${pkg}/**`));
    } else {
      // 通常のパターンをそのまま追加
      patterns.push(...categoryPatterns);
    }
  }

  return patterns;
}

/**
 * 同期対象ファイルを収集
 * @param templateDir - テンプレートディレクトリパス
 * @param categories - 選択されたカテゴリ
 * @param appsDetail - apps詳細選択（オプション）
 * @param packagesDetail - packages詳細選択（オプション）
 * @returns 収集されたファイルパスの配列
 */
export async function collectSyncFiles(
  templateDir: string,
  categories: SyncCategory[],
  appsDetail?: string[],
  packagesDetail?: string[]
): Promise<string[]> {
  try {
    logger.info("同期対象ファイルを収集中...");

    // 1. カテゴリからパターン抽出
    const patterns = extractPatternsFromCategories(
      categories,
      appsDetail,
      packagesDetail
    );

    if (patterns.length === 0) {
      logger.warn("同期対象のパターンがありません");
      return [];
    }

    // 2. globによるファイル収集（Set で重複除去）
    const fileSet = new Set<string>();

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: templateDir,
          dot: true, // .で始まるファイルも含める
          nodir: true, // ディレクトリは除外
        });

        for (const file of files) {
          fileSet.add(file);
        }
      } catch (error) {
        logger.warn(`パターン ${pattern} の処理中にエラー: ${error}`);
      }
    }

    // 3. 保護対象ファイルと除外パターンを除外
    const allFiles = Array.from(fileSet);
    const filteredFiles = allFiles.filter((file) => {
      // 保護対象envファイルを除外
      if (isProtectedEnvFile(file)) {
        logger.info(`保護対象ファイルを除外: ${file}`);
        return false;
      }

      // 除外パターンにマッチするファイルを除外
      if (isExcludedFile(file)) {
        logger.info(`除外パターンにマッチ: ${file}`);
        return false;
      }

      return true;
    });

    logger.success(`${filteredFiles.length}個のファイルを収集しました`);

    return filteredFiles.sort(); // ソートして返却
  } catch (error) {
    logger.error(`ファイル収集中にエラーが発生しました: ${error}`);
    throw error;
  }
}
