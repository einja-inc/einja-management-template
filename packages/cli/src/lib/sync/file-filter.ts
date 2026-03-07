import path from "node:path";
import type { ScanOptions, SyncTarget } from "@/types/sync.js";
import fs from "fs-extra";
import { glob } from "glob";
import ignore from "ignore";

/**
 * カテゴリマッピング
 */
const CATEGORY_MAPPING: Record<string, string> = {
  commands: ".claude/commands/einja",
  agents: ".claude/agents/einja",
  skills: ".claude/skills",
  hooks: ".claude/hooks",
  docs: "docs/einja",
  scripts: "scripts",
  env: ".",
  tools: ".vscode",
  "root-config": ".", // package.json, .mcp.json
  "claude-config": ".claude", // .claude/settings.json
  "claude-md": ".", // CLAUDE.md, AGENTS.md
};

/**
 * einja-プレフィックスでフィルタリングが必要なカテゴリ
 */
const EINJA_PREFIX_CATEGORIES = ["skills"];

/**
 * ファイルフィルタリングクラス
 * 同期対象ファイルのスキャンと除外判定を担当
 */
export class FileFilter {
  private projectRoot: string;
  private templateRoot: string;
  private ignoreFilter: ReturnType<typeof ignore> | null = null;

  constructor(projectRoot: string, templateRoot: string) {
    this.projectRoot = projectRoot;
    this.templateRoot = templateRoot;
  }

  /**
   * 同期対象ファイルをスキャンする
   */
  async scanSyncTargets(options: ScanOptions = {}): Promise<SyncTarget[]> {
    const targets: SyncTarget[] = [];

    // .gitignoreを読み込む
    await this.loadGitignore();

    // カテゴリごとにスキャン
    const categories = options.categories || Object.keys(CATEGORY_MAPPING);

    for (const category of categories) {
      const categoryPath = CATEGORY_MAPPING[category];
      if (!categoryPath) {
        continue;
      }

      // envカテゴリは.envrcファイルのみを対象とする特別処理
      if (category === "env") {
        const envrcPath = ".envrc";
        const templatePath = path.join(this.templateRoot, envrcPath);
        const projectPath = path.join(this.projectRoot, envrcPath);

        if (await fs.pathExists(templatePath)) {
          const exists = await fs.pathExists(projectPath);
          targets.push({
            path: envrcPath,
            category,
            templatePath,
            exists,
          });
        }
        continue;
      }

      // toolsカテゴリは.vscode/settings.jsonファイルのみを対象とする特別処理
      if (category === "tools") {
        const settingsPath = ".vscode/settings.json";
        const templatePath = path.join(this.templateRoot, settingsPath);
        const projectPath = path.join(this.projectRoot, settingsPath);

        if (await fs.pathExists(templatePath)) {
          const exists = await fs.pathExists(projectPath);
          targets.push({
            path: settingsPath,
            category,
            templatePath,
            exists,
          });
        }
        continue;
      }

      // root-configカテゴリはpackage.jsonと.mcp.jsonのみを対象とする特別処理
      if (category === "root-config") {
        for (const fileName of ["package.json", ".mcp.json"]) {
          const templatePath = path.join(this.templateRoot, fileName);
          const projectPath = path.join(this.projectRoot, fileName);

          if (await fs.pathExists(templatePath)) {
            const exists = await fs.pathExists(projectPath);
            targets.push({
              path: fileName,
              category,
              templatePath,
              exists,
            });
          }
        }
        continue;
      }

      // claude-configカテゴリは.claude/settings.jsonのみを対象とする特別処理
      if (category === "claude-config") {
        const settingsPath = ".claude/settings.json";
        const templatePath = path.join(this.templateRoot, settingsPath);
        const projectPath = path.join(this.projectRoot, settingsPath);

        if (await fs.pathExists(templatePath)) {
          const exists = await fs.pathExists(projectPath);
          targets.push({
            path: settingsPath,
            category,
            templatePath,
            exists,
          });
        }
        continue;
      }

      // claude-mdカテゴリはCLAUDE.md(.template)とAGENTS.mdを対象とする特別処理
      if (category === "claude-md") {
        // CLAUDE.md.template → CLAUDE.md
        const claudeMdTemplatePath = path.join(this.templateRoot, "CLAUDE.md.template");
        const claudeMdProjectPath = path.join(this.projectRoot, "CLAUDE.md");

        if (await fs.pathExists(claudeMdTemplatePath)) {
          const exists = await fs.pathExists(claudeMdProjectPath);
          targets.push({
            path: "CLAUDE.md",
            category,
            templatePath: claudeMdTemplatePath,
            exists,
          });
        }

        // AGENTS.md
        const agentsMdTemplatePath = path.join(this.templateRoot, "AGENTS.md");
        const agentsMdProjectPath = path.join(this.projectRoot, "AGENTS.md");

        if (await fs.pathExists(agentsMdTemplatePath)) {
          const exists = await fs.pathExists(agentsMdProjectPath);
          targets.push({
            path: "AGENTS.md",
            category,
            templatePath: agentsMdTemplatePath,
            exists,
          });
        }
        continue;
      }

      const templateDirPath = path.join(this.templateRoot, categoryPath);
      if (!(await fs.pathExists(templateDirPath))) {
        continue;
      }

      // テンプレートディレクトリ内のファイルをスキャン
      let pattern: string;

      // einja-プレフィックスフィルタリングが必要なカテゴリ
      if (EINJA_PREFIX_CATEGORIES.includes(category)) {
        // einja-で始まるディレクトリのみを対象にする
        pattern = `${categoryPath}/{einja-,_einja-}*/**/*`;
      } else {
        pattern = `${categoryPath}/**/*`;
      }

      const files = await glob(pattern, {
        cwd: this.templateRoot,
        nodir: true,
        dot: true,
      });

      for (const file of files) {
        // 除外対象チェック
        if (this.shouldExclude(file, options.excludePatterns)) {
          continue;
        }

        const templatePath = path.join(this.templateRoot, file);
        const projectPath = path.join(this.projectRoot, file);
        const exists = await fs.pathExists(projectPath);

        targets.push({
          path: file,
          category,
          templatePath,
          exists,
        });
      }
    }

    return targets;
  }

  /**
   * 除外対象かを判定する
   */
  shouldExclude(filePath: string, additionalPatterns?: string[]): boolean {
    const fileName = path.basename(filePath);

    // _プレフィックスで始まるファイルを除外
    if (fileName.startsWith("_")) {
      return true;
    }

    // .gitignoreパターンで除外
    if (this.ignoreFilter?.ignores(filePath)) {
      return true;
    }

    // 追加の除外パターンで除外
    if (additionalPatterns) {
      for (const pattern of additionalPatterns) {
        if (this.matchesPattern(filePath, pattern)) {
          return true;
        }
      }
    }

    // バイナリファイルを除外
    if (this.isBinaryFile(filePath)) {
      return true;
    }

    return false;
  }

  /**
   * カテゴリでフィルタリングする
   */
  filterByCategory(files: SyncTarget[], categories: string[]): SyncTarget[] {
    return files.filter((file) => categories.includes(file.category));
  }

  /**
   * パスからカテゴリを推測する
   */
  getCategoryFromPath(filePath: string): string | null {
    for (const [category, categoryPath] of Object.entries(CATEGORY_MAPPING)) {
      // envカテゴリは.envrcファイルのみを対象とする特別処理
      if (category === "env") {
        if (filePath === ".envrc") {
          return category;
        }
        continue;
      }

      // toolsカテゴリは.vscode/settings.jsonファイルのみ
      if (category === "tools") {
        if (filePath === ".vscode/settings.json") {
          return category;
        }
        continue;
      }

      // root-configカテゴリはpackage.jsonと.mcp.jsonのみ
      if (category === "root-config") {
        if (filePath === "package.json" || filePath === ".mcp.json") {
          return category;
        }
        continue;
      }

      // claude-configカテゴリは.claude/settings.jsonのみ
      if (category === "claude-config") {
        if (filePath === ".claude/settings.json") {
          return category;
        }
        continue;
      }

      // claude-mdカテゴリはCLAUDE.mdとAGENTS.mdのみ
      if (category === "claude-md") {
        if (filePath === "CLAUDE.md" || filePath === "AGENTS.md") {
          return category;
        }
        continue;
      }

      if (filePath.startsWith(categoryPath)) {
        // einja-プレフィックスフィルタリングが必要なカテゴリの場合
        if (EINJA_PREFIX_CATEGORIES.includes(category)) {
          // パスの次のセグメントがeinja-で始まるか確認
          const relativePath = filePath.slice(categoryPath.length + 1);
          const firstSegment = relativePath.split("/")[0];
          if (firstSegment?.startsWith("einja-") || firstSegment?.startsWith("_einja-")) {
            return category;
          }
          // einja-で始まらない場合はnull（対象外）
          return null;
        }
        return category;
      }
    }
    return null;
  }

  /**
   * .gitignoreを読み込む
   */
  private async loadGitignore(): Promise<void> {
    const gitignorePath = path.join(this.projectRoot, ".gitignore");
    if (!(await fs.pathExists(gitignorePath))) {
      this.ignoreFilter = null;
      return;
    }

    try {
      const content = await fs.readFile(gitignorePath, "utf-8");
      this.ignoreFilter = ignore().add(content);
    } catch {
      this.ignoreFilter = null;
    }
  }

  /**
   * パターンマッチング
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // シンプルなglobパターンマッチング
    // エスケープが必要な特殊文字を処理
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 正規表現の特殊文字をエスケープ
      .replace(/\*\*/g, "###DOUBLESTAR###") // **を一時的にプレースホルダーに置換
      .replace(/\*/g, "[^/]*") // *を[^/]*に置換
      .replace(/###DOUBLESTAR###/g, ".*") // **を.*に置換
      .replace(/\?/g, "[^/]"); // ?を[^/]に置換
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * バイナリファイルかを判定する
   */
  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".ico",
      ".mp4",
      ".webm",
      ".mp3",
      ".wav",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
    ];

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }
}
