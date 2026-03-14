import fsExtra from "fs-extra";
const { copySync, readFileSync, writeFileSync, existsSync, removeSync } = fsExtra;
import { glob } from "glob";
import { chmodSync } from "node:fs";
import { dirname, join, parse, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectConfig } from "@/prompts/project.js";
import { ensureDir } from "@/utils/fs.js";
import * as logger from "@/utils/logger.js";

/**
 * TemplateVariables型
 * テンプレート変数（プレースホルダー置換用）
 */
export interface TemplateVariables {
  projectName: string;
  packageName: string;
  description: string;
}

/**
 * package.jsonを上方探索してパッケージルートを特定する
 * @param startDir - 探索開始ディレクトリ
 * @returns パッケージルートパス（見つからない場合はnull）
 */
function findPackageRoot(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);
  while (dir !== root) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * テンプレートディレクトリのパスを取得
 * @param templateName - テンプレート名
 * @returns テンプレートディレクトリパス
 */
function getTemplatePath(templateName: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // バンドル後（dist/cli.js）とソース実行（src/generators/template.ts）の両方に対応
  // dist/cli.js -> ../templates/ (1階層上)
  // src/generators/template.ts -> ../../templates/ (2階層上)
  const distPath = join(__dirname, "../templates", templateName);
  const srcPath = join(__dirname, "../../templates", templateName);

  if (existsSync(distPath)) {
    return distPath;
  }
  if (existsSync(srcPath)) {
    return srcPath;
  }

  // フォールバック: package.jsonを上方探索してパッケージルートを特定し、
  // そこからの相対パスでテンプレートを探す（CI環境などでimport.meta.urlの
  // パス解決が想定と異なる場合の対策）
  const packageRoot = findPackageRoot(__dirname);
  if (packageRoot) {
    const fallbackPath = join(packageRoot, "templates", templateName);
    if (existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  // どちらも存在しない場合はdistPathを返す（エラーメッセージ用）
  return distPath;
}

/**
 * 認証方式に応じた除外パターンを取得
 * @param authMethod - 認証方式
 * @returns 除外パターン配列
 */
function getAuthExcludePatterns(authMethod: string): string[] {
  if (authMethod === "none") {
    return [
      "**/api/auth/**",
      "**/packages/auth/**",
      "**/signin/**",
      "**/signup/**",
    ];
  }
  return [];
}

/**
 * ファイル内容のプレースホルダー変数を置換
 * @param content - ファイル内容
 * @param variables - 置換する変数
 * @returns 置換後の内容
 */
export function replacePlaceholders(
  content: string,
  variables: TemplateVariables
): string {
  let result = content;

  // {{projectName}} の置換
  result = result.replaceAll("{{projectName}}", variables.projectName);

  // {{packageName}}/ の置換（長いパターンを先に置換）
  result = result.replaceAll("{{packageName}}/", `${variables.packageName}/`);

  // {{packageName}} の置換
  result = result.replaceAll("{{packageName}}", variables.packageName);

  // {{description}} の置換
  result = result.replaceAll("{{description}}", variables.description);

  // @repo/ の置換（パッケージスコープ）
  result = result.replaceAll("@repo/", `${variables.packageName}/`);

  return result;
}

/**
 * ファイルの変数置換処理
 * @param filePath - ファイルパス
 * @param variables - 置換する変数
 */
function processFileVariables(
  filePath: string,
  variables: TemplateVariables
): void {
  // バイナリファイルは処理しない
  const binaryExtensions = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot"];
  if (binaryExtensions.some((ext) => filePath.endsWith(ext))) {
    return;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const replaced = replacePlaceholders(content, variables);

    if (content !== replaced) {
      writeFileSync(filePath, replaced, "utf-8");
    }
  } catch (error) {
    // 読み込みに失敗した場合はスキップ（バイナリファイル等）
    logger.warn(`変数置換をスキップ: ${filePath}`);
  }
}

/**
 * .templateファイルのリネーム処理
 * @param targetPath - ターゲットディレクトリパス
 */
function renameTemplateFiles(targetPath: string): void {
  const templateFiles = glob.sync("**/*.template", {
    cwd: targetPath,
    absolute: true,
    dot: true,
  });

  for (const file of templateFiles) {
    const newPath = file.replace(/\.template$/, "");
    copySync(file, newPath);
    removeSync(file);
  }
}

/**
 * gitignoreファイルをリネーム処理（gitignore → .gitignore）
 * @param targetPath - ターゲットディレクトリパス
 */
function renameSpecialFiles(targetPath: string): void {
  const gitignoreFiles = glob.sync("**/gitignore", {
    cwd: targetPath,
    absolute: true,
    dot: true,
  });

  for (const file of gitignoreFiles) {
    const dir = dirname(file);
    const newPath = join(dir, ".gitignore");

    if (existsSync(file)) {
      copySync(file, newPath);
      removeSync(file);
    }
  }
}

/**
 * 認証方式に応じたファイル除外処理
 * @param targetPath - ターゲットディレクトリパス
 * @param authMethod - 認証方式
 */
function excludeAuthFiles(targetPath: string, authMethod: string): void {
  const excludePatterns = getAuthExcludePatterns(authMethod);

  if (excludePatterns.length === 0) {
    return;
  }

  logger.info("認証方式に応じたファイルを除外中...");

  for (const pattern of excludePatterns) {
    const files = glob.sync(pattern, {
      cwd: targetPath,
      absolute: true,
      dot: true,
    });

    for (const file of files) {
      removeSync(file);
    }
  }
}

/**
 * テンプレートを展開
 * @param config - プロジェクト設定
 * @param targetPath - ターゲットディレクトリパス
 */
export async function generateTemplate(
  config: ProjectConfig,
  targetPath: string
): Promise<void> {
  const templatePath = getTemplatePath(config.template);

  // テンプレートディレクトリの存在確認
  if (!existsSync(templatePath)) {
    throw new Error(`テンプレートが見つかりません: ${config.template}`);
  }

  logger.info("テンプレートをコピー中...");

  // ターゲットディレクトリの作成
  await ensureDir(targetPath);

  // テンプレートファイルをコピー
  copySync(templatePath, targetPath, {
    filter: (src: string): boolean => {
      const relativePath = relative(templatePath, src);

      // 除外パターン（ディレクトリ名やファイル名として完全一致するもの）
      // 注意: .env.*ファイルはテンプレートに含め、pnpm env:updateで再設定する
      const excludePatterns = [
        "node_modules",
        ".git",
        ".next",
        ".turbo",
        "out",
        "dist",
        "logs",
        ".env", // フェイルセーフ（暗号化キーファイル）
        ".DS_Store",
        "Thumbs.db",
        "coverage",
      ];

      // ファイル拡張子パターン（*.log など）
      const excludeExtensions = [".log"];

      // パスセグメントに分割（/ または \ で分割）
      const pathSegments = relativePath.split(/[/\\]/);

      // パスセグメント単位で完全一致チェック
      // これにより "out" は "out/" ディレクトリにマッチするが
      // "logout-button.tsx" にはマッチしない
      const matchesExcludePattern = excludePatterns.some((pattern) =>
        pathSegments.includes(pattern)
      );

      // 拡張子チェック
      const matchesExtension = excludeExtensions.some((ext) =>
        relativePath.endsWith(ext)
      );

      return !matchesExcludePattern && !matchesExtension;
    },
  });

  // 認証方式に応じたファイル除外
  excludeAuthFiles(targetPath, config.authMethod);

  // .templateファイルのリネーム
  renameTemplateFiles(targetPath);

  // gitignore → .gitignore リネーム
  renameSpecialFiles(targetPath);

  // 変数置換
  logger.info("プレースホルダー変数を置換中...");

  const variables: TemplateVariables = {
    projectName: config.projectName,
    packageName: config.packageScope,
    description: `${config.projectName} - Einja Management Template`,
  };

  const allFiles = glob.sync("**/*", {
    cwd: targetPath,
    absolute: true,
    nodir: true,
    dot: true,
  });

  for (const file of allFiles) {
    processFileVariables(file, variables);
  }

  // シェルスクリプトに実行権限を付与
  const shFiles = glob.sync("**/*.sh", {
    cwd: targetPath,
    absolute: true,
    dot: true,
  });
  for (const file of shFiles) {
    chmodSync(file, 0o755);
  }

  // worktreeConfig が指定されている場合、worktree.config.json を上書き
  if (config.worktreeConfig) {
    const worktreeConfigPath = join(targetPath, "worktree.config.json");
    const worktreeConfigContent = {
      schemaVersion: 1,
      postgres: config.worktreeConfig.postgres,
      apps: config.worktreeConfig.apps,
    };
    writeFileSync(
      worktreeConfigPath,
      JSON.stringify(worktreeConfigContent, null, "\t") + "\n",
      "utf-8"
    );
    logger.info("worktree.config.json をカスタム設定で上書きしました");
  }

  logger.success("テンプレート展開完了");
}
