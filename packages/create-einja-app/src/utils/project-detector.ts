import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * プロジェクト設定の型定義
 */
export interface ProjectConfig {
  projectName: string;
  packageScope: string; // e.g. "@mycompany"
}

/**
 * package.json からプロジェクト設定を検出する
 *
 * 検出の優先順位:
 * 1. ルート package.json の name フィールドから projectName を取得
 * 2. apps/ or packages/ 配下の package.json から name のスコープ部分を抽出
 *    例: "@mycompany/web" → "@mycompany"
 * 3. 検出できない場合は null を返す（呼び出し側で対話プロンプトにフォールバック）
 *
 * @param targetDir - ターゲットディレクトリパス
 * @returns プロジェクト設定、または検出失敗時は null
 */
export async function detectProjectConfig(
  targetDir: string
): Promise<ProjectConfig | null> {
  let projectName: string | null = null;
  let packageScope: string | null = null;

  // 1. ルート package.json から projectName を取得
  const rootPackageJsonPath = join(targetDir, "package.json");
  if (existsSync(rootPackageJsonPath)) {
    try {
      const rootPkg = JSON.parse(
        readFileSync(rootPackageJsonPath, "utf-8")
      ) as { name?: string };
      if (rootPkg.name) {
        projectName = rootPkg.name;
      }
    } catch {
      // JSONパースエラーは無視して次の検出方法にフォールバック
    }
  }

  // 2. apps/ or packages/ 配下の package.json からスコープを抽出
  const candidateDirs = [join(targetDir, "apps"), join(targetDir, "packages")];

  for (const dir of candidateDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const entryPath = join(dir, entry);

        // ディレクトリのみを対象
        if (!statSync(entryPath).isDirectory()) {
          continue;
        }

        const pkgJsonPath = join(entryPath, "package.json");
        if (!existsSync(pkgJsonPath)) {
          continue;
        }

        try {
          const pkg = JSON.parse(
            readFileSync(pkgJsonPath, "utf-8")
          ) as { name?: string };

          if (pkg.name) {
            // スコープの抽出（例: "@mycompany/web" → "@mycompany"）
            const match = pkg.name.match(/^(@[^/]+)\//);
            if (match?.[1]) {
              const detectedScope = match[1];

              // 既にスコープが検出されている場合は一致を検証
              if (packageScope && packageScope !== detectedScope) {
                // 異なるスコープが見つかった場合は警告（最初に見つかったものを使用）
                console.warn(
                  `警告: 異なるスコープが検出されました（${packageScope} vs ${detectedScope}）。最初に見つかった ${packageScope} を使用します。`
                );
              } else if (!packageScope) {
                packageScope = detectedScope;
              }
            }
          }
        } catch {
          // パースエラーは無視して次のファイルへ
        }
      }
    } catch {
      // ディレクトリ読み込みエラーは無視
    }
  }

  // 3. 検出結果を返す
  if (projectName && packageScope) {
    return { projectName, packageScope };
  }

  // どちらかが欠けている場合は null を返す
  return null;
}
