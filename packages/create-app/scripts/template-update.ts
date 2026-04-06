#!/usr/bin/env tsx

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";
import chalk from "chalk";

/**
 * テンプレート更新スクリプト
 *
 * ホワイトリスト方式でルートディレクトリからファイルを収集し、プレースホルダー変数に変換して
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

interface DirMapping {
  src: string;
  /** 直下サブディレクトリまたはファイルの除外パス（srcからの相対） */
  exclude?: string[];
  /** この文字で始まるファイル名を除外 */
  excludeFilePrefix?: string;
}

const dirMappings: DirMapping[] = [
  { src: "apps" },
  { src: "packages", exclude: ["cli", "create-app"] },
  { src: "prisma" },
  { src: "public" },
  {
    src: "scripts",
    exclude: [
      "task-vibe-kanban-loop",
      "sync-shared-sync-core.mts",
      "sync-shared-sync-core.test.mts",
    ],
    excludeFilePrefix: "_",
  },
  { src: "test" },
  { src: ".claude/rules" },
  { src: ".changeset" },
  { src: ".github", exclude: ["workflows/publish-packages.yml"] },
  { src: ".husky" },
  { src: ".serena" },
  { src: ".vscode" },
];

const fileMappings: string[] = [
  "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml",
  "tsconfig.json", "turbo.json", "biome.json",
  "next.config.ts", "postcss.config.cjs", "vitest.config.ts",
  "docker-compose.yml", "components.json",
  ".gitignore", ".envrc", ".env.local", ".env.example", ".npmrc",
  ".biomeignore", ".dockerignore", ".gitattributes",
  ".lintstagedrc.js", ".node-version",
  ".mcp.json",
  "README.md", "CLAUDE.md", "AGENTS.md",
  ".claude/settings.json",
  "worktree.config.json",
];

/** サブディレクトリ内でも常に除外するディレクトリ名 */
const GLOBAL_EXCLUDE_DIRS = new Set([
  "node_modules", ".next", "out", "dist", "build", ".turbo", ".git",
]);

/** ホワイトリスト外だが意図的に除外しているルート直下エントリ（警告抑制用） */
const knownIgnoreList: string[] = [
  // ビルド成果物・キャッシュ（GLOBAL_EXCLUDE_DIRSと重複するがルート直下の警告抑制用）
  "node_modules", ".next", "out", "dist", "build", ".turbo",
  // 一時ファイル
  "log", "tmp", "tsconfig.tsbuildinfo", "package-lock.json",
  // 環境変数
  ".env", ".env.develop", ".env.keys",
  ".env.personal", ".env.personal.example", ".env.preview",
  ".env.production", ".env.staging",
  // dev-cli sync で別途配布（.claude はホワイトリストに含まれるためここではルート直下のみ）
  "docs",
  // プロジェクト固有
  "modifications", "qa-tests", ".einja-sync.json", ".vibe-kanban.json",
  // IDE・ツール固有
  ".cursor", ".git",
  // ローカル実行環境
  ".playwright-mcp", ".serena-port",
];

interface TemplateUpdateOptions {
  dryRun: boolean;
}

/**
 * ディレクトリ内のファイルを再帰的に収集
 */
function collectFiles(
  baseDir: string,
  dir: string,
  mapping: DirMapping
): string[] {
  const fullDir = path.join(baseDir, dir);
  if (!existsSync(fullDir)) return [];

  const entries = readdirSync(fullDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name);
    // srcからの相対パス（exclude比較用）
    const relativeFromSrc = path.relative(mapping.src, relativePath);

    // excludeチェック
    if (mapping.exclude) {
      const shouldExclude = mapping.exclude.some(pattern => {
        if (pattern.includes("/")) {
          // パスパターン: 相対パスと完全一致
          return relativeFromSrc === pattern;
        }
        // ディレクトリ名: 直下エントリ名と一致、またはそのサブパス
        return entry.name === pattern && path.dirname(relativeFromSrc) === ".";
      });
      // パスパターンの場合はファイル単位で除外
      // ディレクトリの場合は再帰ごとスキップ
      if (shouldExclude) continue;
    }

    // excludeFilePrefixチェック
    if (mapping.excludeFilePrefix && entry.name.startsWith(mapping.excludeFilePrefix)) {
      continue;
    }

    if (entry.isDirectory()) {
      // グローバル除外ディレクトリをスキップ（node_modules, .next 等）
      if (GLOBAL_EXCLUDE_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(baseDir, relativePath, mapping));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
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
 * プレースホルダー変数に変換
 *
 * - package.json: name, description を変換
 * - tsconfig.json: paths 内の @repo/* を {{packageName}}/* に変換
 * - import文: @repo/ を {{packageName}}/ に変換
 * - README.md（ルートのみ）: @einja:excluded マーカー除去
 */
function sanitizeRootPackageJson(pkg: Record<string, unknown>): Record<string, unknown> {
  const scripts =
    pkg.scripts && typeof pkg.scripts === "object" && !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts as Record<string, string> }
      : null;

  if (!scripts) {
    return pkg;
  }

  // biome-ignore lint/performance/noDelete: JSON出力からキーを完全に除去する必要がある
  delete scripts["sync:shared:sync-core"];
  // biome-ignore lint/performance/noDelete: 同上
  delete scripts["sync:shared:check"];
  // biome-ignore lint/performance/noDelete: 同上
  delete scripts["test:sync:shared"];

  if (typeof scripts.test === "string") {
    scripts.test = scripts.test.replace(/^pnpm test:sync:shared &&\s*/, "");
  }

  if (typeof scripts.prepush === "string") {
    scripts.prepush = scripts.prepush.replace(/^pnpm sync:shared:check &&\s*/, "");
  }

  return {
    ...pkg,
    scripts,
  };
}

function sanitizeHuskyHook(content: string): string {
  const lines = content
    .split("\n")
    .filter((line) => line.trim() !== "pnpm sync:shared:check");

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function transformContent(filePath: string, content: string): string {
  const fileName = path.basename(filePath);

  // ルートREADME.mdの変換（@einja:excluded マーカー除去）
  if (filePath === "README.md") {
    return removeExcludeMarkers(content);
  }

  // package.json の変換
  if (fileName === "package.json") {
    try {
      let pkg = JSON.parse(content);

      // name フィールドを {{projectName}} に置換
      // ただし、@repo/* パターン（共有パッケージ）は除外
      if (pkg.name && !pkg.name.startsWith("@repo/")) {
        pkg.name = "{{projectName}}";
      }

      // description フィールドを {{description}} に置換
      if (pkg.description) {
        pkg.description = "{{description}}";
      }

      if (filePath === "package.json") {
        pkg = sanitizeRootPackageJson(pkg);
      }

      return JSON.stringify(pkg, null, 2);
    } catch (error) {
      console.warn(chalk.yellow(`警告: package.jsonのパースに失敗しました: ${filePath}`));
      return content;
    }
  }

  if (filePath.startsWith(".husky/")) {
    return sanitizeHuskyHook(content);
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
 * ホワイトリスト未登録のエントリを検出して警告
 */
function detectUnregisteredEntries(): void {
  const entries = readdirSync(PROJECT_ROOT, { withFileTypes: true });

  // ホワイトリストのトップレベルディレクトリ/ファイルを収集
  const whitelistedTopLevel = new Set<string>();
  for (const mapping of dirMappings) {
    // src の最初のパスセグメント（例: ".claude/rules" → ".claude"）
    const topLevel = mapping.src.split("/")[0];
    if (topLevel) whitelistedTopLevel.add(topLevel);
  }
  for (const file of fileMappings) {
    const topLevel = file.split("/")[0];
    if (topLevel) whitelistedTopLevel.add(topLevel);
  }

  const knownIgnoreSet = new Set(knownIgnoreList);
  const unregistered: string[] = [];

  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;
    if (whitelistedTopLevel.has(entry.name)) continue;
    if (knownIgnoreSet.has(entry.name)) continue;
    unregistered.push(entry.name);
  }

  if (unregistered.length > 0) {
    console.log(chalk.yellow("\n⚠ ホワイトリスト未登録のエントリを検出:"));
    for (const name of unregistered) {
      console.log(chalk.yellow(`  - ${name}（テンプレートに含めるべきか確認してください）`));
    }
  }
}

/**
 * テンプレート更新のメイン処理
 */
async function updateTemplate(options: TemplateUpdateOptions): Promise<void> {
  console.log(chalk.blue("\n🔄 テンプレート更新を開始します...\n"));

  // 2. 既存のテンプレートディレクトリを削除（dry-runでない場合）
  if (!options.dryRun) {
    if (existsSync(TEMPLATE_DIR)) {
      console.log(chalk.gray(`既存のテンプレートディレクトリを削除: ${TEMPLATE_DIR}`));
      await fse.emptyDir(TEMPLATE_DIR);
      await fse.remove(TEMPLATE_DIR);
    }
    await fse.ensureDir(TEMPLATE_DIR);
  }

  // 3. ホワイトリストからファイルを列挙
  console.log(chalk.gray("ホワイトリストからファイルを列挙中..."));
  const filesToCopy: string[] = [];

  // ディレクトリマッピングからファイルを収集
  for (const mapping of dirMappings) {
    const collected = collectFiles(PROJECT_ROOT, mapping.src, mapping);
    filesToCopy.push(...collected);
  }

  // 個別ファイルを追加
  for (const file of fileMappings) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (existsSync(fullPath)) {
      filesToCopy.push(file);
    } else {
      console.warn(chalk.yellow(`警告: ホワイトリストのファイルが見つかりません: ${file}`));
    }
  }

  console.log(chalk.green(`✅ コピー対象: ${filesToCopy.length} 個のファイル\n`));

  if (options.dryRun) {
    console.log(chalk.yellow("--dry-run モード: ファイルリストをプレビュー\n"));
    for (const file of filesToCopy.slice(0, 20)) {
      console.log(chalk.gray(`  - ${file}`));
    }
    if (filesToCopy.length > 20) {
      console.log(chalk.gray(`  ... 他 ${filesToCopy.length - 20} 個のファイル`));
    }
    detectUnregisteredEntries();
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

      // 元ファイルの実行権限を保持
      const srcStat = await fse.stat(srcPath);
      if (srcStat.mode & 0o111) {
        await fse.chmod(destPath, srcStat.mode);
      }

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

  detectUnregisteredEntries();
}

// メイン実行
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentFilePath = fileURLToPath(import.meta.url);

if (entryPath === currentFilePath) {
  const isDryRun = process.argv.includes("--dry-run");

  updateTemplate({ dryRun: isDryRun }).catch((error) => {
    console.error(chalk.red("エラーが発生しました:"), error);
    process.exit(1);
  });
}
