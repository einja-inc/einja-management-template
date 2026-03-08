#!/usr/bin/env tsx
/**
 * template:update スクリプト
 *
 * プロジェクトの最新コンテンツを@einja-inc/create-appテンプレートに反映する内部開発用スクリプト。
 *
 * 使用例:
 *   pnpm template:update                # テンプレート更新
 *   pnpm template:update --dry-run      # 差分確認のみ
 */

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { globSync } from "glob";
import ignore from "ignore";

/**
 * コマンドラインオプション
 */
interface CliOptions {
  /** ドライランモード（ファイル変更なし） */
  dryRun: boolean;
}

/**
 * テンプレート変数
 */
interface TemplateVariables {
  projectName: string;
  packageName: string;
  description: string;
}

/**
 * コマンドライン引数を解析
 */
function parseArguments(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
  };

  for (const arg of args) {
    switch (arg) {
      case "--dry-run":
      case "-d":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * ヘルプメッセージを表示
 */
function printHelp(): void {
  console.log(`
Usage: pnpm template:update [options]

Options:
  -d, --dry-run    実際の変更を行わず、コピー予定のファイル一覧を表示
  -h, --help       このヘルプメッセージを表示

Examples:
  pnpm template:update
  pnpm template:update --dry-run
  `);
}

/**
 * .templateignore を読み込んでignoreオブジェクトを生成
 */
function loadIgnorePatterns(rootDir: string): ReturnType<typeof ignore> {
  const ignoreFilePath = join(rootDir, ".templateignore");
  const ig = ignore();

  if (existsSync(ignoreFilePath)) {
    const ignoreContent = readFileSync(ignoreFilePath, "utf-8");
    ig.add(ignoreContent);
  }

  return ig;
}

/**
 * package.json のプレースホルダー変換
 */
function transformPackageJson(content: string, filePath: string): string {
  try {
    const packageJson = JSON.parse(content) as {
      name?: string;
      description?: string;
      [key: string]: unknown;
    };

    // ルートpackage.jsonのみ変換
    if (filePath === "package.json") {
      if (packageJson.name) {
        packageJson.name = "{{projectName}}";
      }
      if (packageJson.description) {
        packageJson.description = "{{description}}";
      }
    }

    return JSON.stringify(packageJson, null, 2) + "\n";
  } catch {
    // JSON パースエラー時はそのまま返す
    return content;
  }
}

/**
 * tsconfig.json のプレースホルダー変換
 */
function transformTsConfig(content: string): string {
  try {
    const tsconfig = JSON.parse(content) as {
      compilerOptions?: {
        paths?: Record<string, string[]>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };

    if (tsconfig.compilerOptions?.paths) {
      const newPaths: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(tsconfig.compilerOptions.paths)) {
        const newKey = key.replace(/@repo\//g, "{{packageName}}/");
        const newValue = value.map((v) => v.replace(/@repo\//g, "{{packageName}}/"));
        newPaths[newKey] = newValue;
      }
      tsconfig.compilerOptions.paths = newPaths;
    }

    return JSON.stringify(tsconfig, null, 2) + "\n";
  } catch {
    // JSON パースエラー時はそのまま返す
    return content;
  }
}

/**
 * import文のプレースホルダー変換
 */
function transformImports(content: string): string {
  return content.replace(/@repo\//g, "{{packageName}}/");
}

/**
 * @einja:excluded マーカーを除去し、除外後の空行・水平線をクリーンアップ
 */
function removeExcludeMarkers(content: string): string {
  const excludePattern =
    /<!-- @einja:excluded:start -->[\s\S]*?<!-- @einja:excluded:end -->/g;
  let result = content.replace(excludePattern, "");

  // 連続する水平線を1つに
  result = result.replace(/(\n---\s*){2,}/g, "\n---\n");

  // 3行以上の空行を2行に圧縮
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

/**
 * ファイル内容を変換
 */
function transformFileContent(filePath: string, content: string): string {
  const fileName = filePath.split("/").pop() || "";

  // ルートREADME.mdの変換（@einja:excluded マーカー除去）
  if (filePath === "README.md") {
    return removeExcludeMarkers(content);
  }

  // package.json の変換
  if (fileName === "package.json") {
    return transformPackageJson(content, filePath);
  }

  // tsconfig.json の変換
  if (fileName === "tsconfig.json") {
    return transformTsConfig(content);
  }

  // import文を含むファイルの変換（.ts, .tsx, .js, .jsx）
  if (/\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return transformImports(content);
  }

  // その他はそのまま
  return content;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const options = parseArguments();
  const rootDir = process.cwd();
  const templateDir = join(
    rootDir,
    "packages",
    "create-app",
    "templates",
    "default"
  );

  console.log("\n🔄 テンプレート更新を開始...\n");

  // 1. .templateignore を読み込み
  const ig = loadIgnorePatterns(rootDir);

  // 2. 既存テンプレートディレクトリを削除（--dry-runでない場合）
  if (!options.dryRun && existsSync(templateDir)) {
    console.log(`📁 既存テンプレートディレクトリを削除: ${templateDir}`);
    rmSync(templateDir, { recursive: true, force: true });
  }

  // 3. テンプレートディレクトリを作成
  if (!options.dryRun) {
    mkdirSync(templateDir, { recursive: true });
  }

  // 4. ルートディレクトリから全ファイルを列挙
  const allFiles = globSync("**/*", {
    cwd: rootDir,
    dot: true,
    nodir: true,
    ignore: ["node_modules/**", ".git/**"],
  });

  // 5. ignoreパターンでフィルタリング
  const filesToCopy = ig.filter(allFiles);

  console.log(`📦 コピー対象: ${filesToCopy.length}ファイル\n`);

  if (options.dryRun) {
    console.log("📋 コピー予定のファイル（最初の10件）:");
    for (const file of filesToCopy.slice(0, 10)) {
      console.log(`  ${file}`);
    }
    if (filesToCopy.length > 10) {
      console.log(`  ... 他${filesToCopy.length - 10}ファイル`);
    }
    console.log("\n✅ 差分確認完了（ファイル変更なし）\n");
    return;
  }

  // 6. ファイルをコピーし、プレースホルダー変換
  let copiedCount = 0;
  for (const file of filesToCopy) {
    const sourcePath = join(rootDir, file);
    const destPath = join(templateDir, file);

    // ファイルの存在確認
    if (!existsSync(sourcePath)) {
      continue;
    }

    // シンボリックリンクの場合はスキップ
    const stats = lstatSync(sourcePath);
    if (stats.isSymbolicLink()) {
      continue;
    }

    // ディレクトリの場合はスキップ（念のため）
    if (stats.isDirectory()) {
      continue;
    }

    // ディレクトリを作成
    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    // ファイル内容を読み込み、変換してコピー
    const content = readFileSync(sourcePath, "utf-8");
    const transformedContent = transformFileContent(file, content);
    writeFileSync(destPath, transformedContent, "utf-8");

    copiedCount++;
  }

  console.log(`✅ テンプレート更新完了!`);
  console.log(`  - コピー: ${copiedCount}ファイル`);
  console.log(`  - 出力先: ${relative(rootDir, templateDir)}\n`);
}

// スクリプト実行
main().catch((error) => {
  console.error("\n❌ エラー:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
