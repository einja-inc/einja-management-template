import fsExtra from "fs-extra";
const { copySync, readFileSync, writeFileSync, existsSync, removeSync } = fsExtra;
import { glob } from "glob";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectConfig } from "../prompts/project.js";
import { ensureDir } from "../utils/fs.js";
import * as logger from "../utils/logger.js";

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
function replacePlaceholders(
  content: string,
  variables: TemplateVariables
): string {
  let result = content;

  // {{projectName}} の置換
  result = result.replaceAll("{{projectName}}", variables.projectName);

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

      // node_modules, .git, .next などを除外
      const excludePatterns = [
        "node_modules",
        ".git",
        ".next",
        "out",
        "dist",
        "*.log",
        "logs",
        ".env",
        ".env.local",
        ".DS_Store",
        "Thumbs.db",
        "coverage",
      ];

      return !excludePatterns.some((pattern) => relativePath.includes(pattern));
    },
  });

  // 認証方式に応じたファイル除外
  excludeAuthFiles(targetPath, config.authMethod);

  // .templateファイルのリネーム
  renameTemplateFiles(targetPath);

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

  logger.success("テンプレート展開完了");
}
