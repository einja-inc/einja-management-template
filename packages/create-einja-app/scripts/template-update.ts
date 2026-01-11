#!/usr/bin/env tsx

import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { glob } from "glob";
import ignore from "ignore";
import fse from "fs-extra";
import chalk from "chalk";

/**
 * テンプレート更新スクリプト
 *
 * ルートディレクトリからファイルを収集し、プレースホルダー変数に変換して
 * templates/default/ にコピーします。
 *
 * 使い方:
 * - pnpm template:update - 実際にファイルをコピー
 * - pnpm template:update --dry-run - 変更内容をプレビュー
 */

// プロジェクトルートディレクトリ（einja-management-template）
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");

// テンプレート出力ディレクトリ
const TEMPLATE_DIR = path.join(
  import.meta.dirname,
  "../templates/default"
);

// .templateignore ファイルのパス
const TEMPLATE_IGNORE_PATH = path.join(import.meta.dirname, "../.templateignore");

interface TemplateUpdateOptions {
  dryRun: boolean;
}

/**
 * .templateignoreファイルを読み込み、ignoreオブジェクトを生成
 */
function loadIgnorePatterns(): ReturnType<typeof ignore> {
  if (!existsSync(TEMPLATE_IGNORE_PATH)) {
    console.warn(chalk.yellow(`警告: .templateignore が見つかりません: ${TEMPLATE_IGNORE_PATH}`));
    return ignore();
  }

  const ignoreContent = readFileSync(TEMPLATE_IGNORE_PATH, "utf-8");
  const ig = ignore();
  ig.add(ignoreContent);
  return ig;
}

/**
 * @einja:template-exclude マーカーを除去し、除外後の空行・水平線をクリーンアップ
 */
function removeExcludeMarkers(content: string): string {
  const excludePattern =
    /<!-- @einja:template-exclude:start -->[\s\S]*?<!-- @einja:template-exclude:end -->/g;
  let result = content.replace(excludePattern, "");

  // 連続する水平線を1つに
  result = result.replace(/(\n---\s*){2,}/g, "\n---\n");

  // 3行以上の空行を2行に圧縮
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

/**
 * プレースホルダー変数に変換
 *
 * - package.json: name, description を変換
 * - tsconfig.json: paths 内の @repo/* を {{packageName}}/* に変換
 * - import文: @repo/ を {{packageName}}/ に変換
 * - README.md（ルートのみ）: @einja:template-exclude マーカー除去
 */
function transformContent(filePath: string, content: string): string {
  const fileName = path.basename(filePath);

  // ルートREADME.mdの変換（@einja:template-exclude マーカー除去）
  if (filePath === "README.md") {
    content = removeExcludeMarkers(content);
  }

  // package.json の変換
  if (fileName === "package.json") {
    try {
      const pkg = JSON.parse(content);

      // name フィールドを {{projectName}} に置換
      // ただし、@repo/* パターン（共有パッケージ）は除外
      if (pkg.name && !pkg.name.startsWith("@repo/")) {
        pkg.name = "{{projectName}}";
      }

      // description フィールドを {{description}} に置換
      if (pkg.description) {
        pkg.description = "{{description}}";
      }

      return JSON.stringify(pkg, null, 2);
    } catch (error) {
      console.warn(chalk.yellow(`警告: package.jsonのパースに失敗しました: ${filePath}`));
      return content;
    }
  }

  // tsconfig.json の変換
  if (fileName === "tsconfig.json") {
    try {
      const tsconfig = JSON.parse(content);

      if (tsconfig.compilerOptions?.paths) {
        const newPaths: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(tsconfig.compilerOptions.paths)) {
          // @repo/* を {{packageName}}/* に変換
          const newKey = key.replace(/@repo\//g, "{{packageName}}/");
          const newValue = (value as string[]).map((v) =>
            v.replace(/@repo\//g, "{{packageName}}/")
          );
          newPaths[newKey] = newValue;
        }
        tsconfig.compilerOptions.paths = newPaths;
      }

      return JSON.stringify(tsconfig, null, 2);
    } catch (error) {
      console.warn(chalk.yellow(`警告: tsconfig.jsonのパースに失敗しました: ${filePath}`));
      return content;
    }
  }

  // import文の変換（TypeScript, JavaScript, TSX, JSXファイル）
  if (/\.(ts|tsx|js|jsx)$/.test(fileName)) {
    // import文の @repo/ を {{packageName}}/ に置換
    return content.replace(
      /from\s+["']@repo\//g,
      'from "{{packageName}}/'
    );
  }

  return content;
}

/**
 * テンプレート更新のメイン処理
 */
async function updateTemplate(options: TemplateUpdateOptions): Promise<void> {
  console.log(chalk.blue("\n🔄 テンプレート更新を開始します...\n"));

  // 1. .templateignoreを読み込み
  const ig = loadIgnorePatterns();

  // 2. 既存のテンプレートディレクトリを削除（dry-runでない場合）
  if (!options.dryRun) {
    if (existsSync(TEMPLATE_DIR)) {
      console.log(chalk.gray(`既存のテンプレートディレクトリを削除: ${TEMPLATE_DIR}`));
      await fse.emptyDir(TEMPLATE_DIR);
      await fse.remove(TEMPLATE_DIR);
    }
    await fse.ensureDir(TEMPLATE_DIR);
  }

  // 3. ルートディレクトリからファイルを列挙
  console.log(chalk.gray(`ファイルを列挙中: ${PROJECT_ROOT}`));
  const allFiles = await glob("**/*", {
    cwd: PROJECT_ROOT,
    dot: true,
    nodir: true,
    ignore: ["**/node_modules/**"], // node_modulesは確実に除外
  });

  console.log(chalk.gray(`合計 ${allFiles.length} 個のファイルを検出\n`));

  // 4. ignoreパターンでフィルタリング
  const filesToCopy = allFiles.filter((file) => !ig.ignores(file));

  console.log(chalk.green(`✅ コピー対象: ${filesToCopy.length} 個のファイル`));
  console.log(chalk.red(`❌ 除外: ${allFiles.length - filesToCopy.length} 個のファイル\n`));

  if (options.dryRun) {
    console.log(chalk.yellow("--dry-run モード: ファイルリストをプレビュー\n"));
    for (const file of filesToCopy.slice(0, 20)) {
      console.log(chalk.gray(`  - ${file}`));
    }
    if (filesToCopy.length > 20) {
      console.log(chalk.gray(`  ... 他 ${filesToCopy.length - 20} 個のファイル`));
    }
    console.log(chalk.blue("\n✨ --dry-run 完了。実際のコピーは行われませんでした。"));
    return;
  }

  // 5. ファイルをコピーして変換
  let copiedCount = 0;
  let transformedCount = 0;

  for (const file of filesToCopy) {
    const srcPath = path.join(PROJECT_ROOT, file);

    // .gitignore → gitignore にリネーム
    let destFile = file;
    if (file.endsWith('.gitignore')) {
      destFile = file.replace(/\.gitignore$/, 'gitignore');
    }

    const destPath = path.join(TEMPLATE_DIR, destFile);

    try {
      // ディレクトリを作成
      await fse.ensureDir(path.dirname(destPath));

      // ファイル内容を読み込み
      const content = await fse.readFile(srcPath, "utf-8");

      // プレースホルダー変換
      const transformed = transformContent(file, content);
      const wasTransformed = transformed !== content;

      // ファイルを書き込み
      await fse.writeFile(destPath, transformed, "utf-8");

      copiedCount++;
      if (wasTransformed) {
        transformedCount++;
      }
    } catch (error) {
      console.error(chalk.red(`エラー: ${file} のコピーに失敗しました`), error);
    }
  }

  // 6. 完了メッセージ
  console.log(chalk.green("\n✅ テンプレート更新が完了しました！"));
  console.log(chalk.gray(`  - コピー: ${copiedCount} 個のファイル`));
  console.log(chalk.gray(`  - 変換: ${transformedCount} 個のファイル`));
  console.log(chalk.gray(`  - 出力先: ${TEMPLATE_DIR}\n`));
}

// メイン実行
const isDryRun = process.argv.includes("--dry-run");

updateTemplate({ dryRun: isDryRun }).catch((error) => {
  console.error(chalk.red("エラーが発生しました:"), error);
  process.exit(1);
});
