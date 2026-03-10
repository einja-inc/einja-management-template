import inquirer from "inquirer";
import * as logger from "./logger.js";

/**
 * package.json の依存関係の型
 */
export interface PackageJsonDependencies {
  [key: string]: string;
}

/**
 * バージョン競合の情報
 */
export interface VersionConflict {
  packageName: string;
  existingVersion: string;
  templateVersion: string;
}

/**
 * マージ結果の型
 */
export interface PackageJsonMergeResult {
  merged: PackageJsonDependencies;
  conflicts: VersionConflict[];
}

/**
 * バージョンが異なるかチェック
 *
 * @param existingVersion - 既存のバージョン
 * @param templateVersion - テンプレートのバージョン
 * @returns バージョン競合がある場合 true
 */
function hasVersionConflict(
  existingVersion: string,
  templateVersion: string
): boolean {
  // Given: 完全一致の場合
  if (existingVersion === templateVersion) {
    // Then: 競合なし
    return false;
  }

  // Given: 範囲指定の正規化（^1.0.0 と 1.0.0 は同一とみなす等）
  const normalize = (v: string) => v.replace(/^[\^~]/, "");

  // When: 正規化したバージョンを比較
  // Then: 異なる場合は競合あり
  return normalize(existingVersion) !== normalize(templateVersion);
}

/**
 * 依存関係をマージし、バージョン競合を検出
 *
 * @param existing - 既存の依存関係
 * @param template - テンプレートの依存関係
 * @returns マージ結果と競合リスト
 */
export async function mergeDependenciesWithConflictDetection(
  existing: PackageJsonDependencies,
  template: PackageJsonDependencies
): Promise<PackageJsonMergeResult> {
  // Given: マージ結果と競合リストを初期化
  const merged: PackageJsonDependencies = { ...existing };
  const conflicts: VersionConflict[] = [];

  // When: テンプレートの各パッケージを処理
  for (const [packageName, templateVersion] of Object.entries(template)) {
    if (packageName in existing) {
      // Given: 既存パッケージが存在する場合
      const existingVersion = existing[packageName];

      if (existingVersion && hasVersionConflict(existingVersion, templateVersion)) {
        // When: バージョン競合が発生
        // Then: 競合リストに追加（この時点ではマージしない）
        conflicts.push({
          packageName,
          existingVersion,
          templateVersion,
        });
      } else {
        // When: バージョンが一致または正規化後一致
        // Then: テンプレートのバージョンを使用
        merged[packageName] = templateVersion;
      }
    } else {
      // Given: 新規パッケージの場合
      // Then: 無条件で追加
      merged[packageName] = templateVersion;
    }
  }

  // Then: マージ結果と競合リストを返す
  return { merged, conflicts };
}

/**
 * ユーザーにバージョン競合の解決方法を尋ねる
 *
 * @param conflicts - 競合リスト
 * @returns パッケージ名とバージョンのマップ
 */
export async function resolveVersionConflicts(
  conflicts: VersionConflict[]
): Promise<Map<string, string>> {
  // Given: 解決結果を格納するマップ
  const resolutions = new Map<string, string>();

  // When: 競合が存在する場合
  logger.warn(`\n⚠️ ${conflicts.length}個のパッケージでバージョン競合が検出されました:\n`);

  // When: 各競合について順次処理
  for (const conflict of conflicts) {
    logger.warn(`📦 ${conflict.packageName}`);
    logger.warn(`  既存: ${conflict.existingVersion}`);
    logger.warn(`  テンプレート: ${conflict.templateVersion}\n`);

    // When: ユーザーに選択を求める
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "version",
        message: "どちらのバージョンを使用しますか？",
        choices: [
          {
            name: `テンプレート (${conflict.templateVersion})`,
            value: "template",
          },
          {
            name: `既存 (${conflict.existingVersion})`,
            value: "existing",
          },
          {
            name: "スキップ（既存を維持）",
            value: "skip",
          },
        ],
      },
    ]);

    // Then: ユーザーの選択に応じて解決結果を記録
    if (answer.version === "template") {
      resolutions.set(conflict.packageName, conflict.templateVersion);
    } else if (answer.version === "existing") {
      resolutions.set(conflict.packageName, conflict.existingVersion);
    }
    // skip の場合は何もしない（既存を維持）
  }

  // Then: 解決結果を返す
  return resolutions;
}

/**
 * 依存関係を完全にマージ（競合解決含む）
 *
 * @param existingDeps - 既存の依存関係
 * @param templateDeps - テンプレートの依存関係
 * @param skipPrompts - プロンプトをスキップするかどうか
 * @returns マージされた依存関係
 */
export async function mergePackageJsonDependencies(
  existingDeps: PackageJsonDependencies,
  templateDeps: PackageJsonDependencies,
  skipPrompts = false
): Promise<PackageJsonDependencies> {
  // Given: 依存関係をマージして競合を検出
  const { merged, conflicts } = await mergeDependenciesWithConflictDetection(
    existingDeps,
    templateDeps
  );

  // Given: 競合がない場合
  if (conflicts.length === 0) {
    // Then: マージ結果をそのまま返す
    return merged;
  }

  // Given: プロンプトをスキップする場合
  if (skipPrompts) {
    // Then: 既存バージョンを優先（競合分は merged に含まれていない）
    logger.info(
      `バージョン競合が${conflicts.length}個ありますが、既存バージョンを維持します`
    );
    return merged;
  }

  // When: ユーザーに競合解決を尋ねる
  const resolutions = await resolveVersionConflicts(conflicts);

  // When: 解決結果をマージ結果に反映
  for (const [packageName, version] of resolutions.entries()) {
    merged[packageName] = version;
  }

  // Then: 最終的なマージ結果を返す
  return merged;
}
