import { glob } from "glob";
import type { SyncCategory } from "../types/index.js";
import * as logger from "../utils/logger.js";

/**
 * カテゴリとファイルパターンのマッピング
 * prompts/sync.ts の CATEGORY_CONFIGS と同じ定義
 */
const CATEGORY_PATTERNS: Record<SyncCategory, string[]> = {
  env: [".env*", ".envrc", ".volta", ".node-version"],
  tools: ["biome.json", ".prettierrc*", ".editorconfig", ".vscode/**"],
  git: [".gitignore", ".gitattributes"],
  "git-hooks": [".husky/**"],
  github: [".github/workflows/**", ".github/actions/**", ".github/dependabot.yml"],
  docker: ["Dockerfile*", "docker-compose*.yml", ".dockerignore"],
  monorepo: ["turbo.json", "pnpm-workspace.yaml"],
  "root-config": ["package.json", "tsconfig.json"],
  scripts: ["scripts/**"],
  apps: ["apps/**"],
  packages: ["packages/**"],
  docs: ["README.md", "docs/**"],
};

/**
 * envファイル保護ルール
 * これらのファイルは同期対象外（暗号化キーと個人設定）
 */
const ENV_FILE_PROTECTION = {
  protected: [".env.keys", ".env.personal"],
};

/**
 * envファイルが保護対象かチェック
 * @param filePath - ファイルパス
 * @returns 保護対象の場合 true
 */
function isProtectedEnvFile(filePath: string): boolean {
  return ENV_FILE_PROTECTION.protected.some((pattern) => filePath.endsWith(pattern));
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
    const patterns = extractPatternsFromCategories(categories, appsDetail, packagesDetail);

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

    // 3. 保護対象ファイルを除外
    const allFiles = Array.from(fileSet);
    const filteredFiles = allFiles.filter((file) => {
      // 保護対象envファイルを除外
      if (isProtectedEnvFile(file)) {
        logger.info(`保護対象ファイルを除外: ${file}`);
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
