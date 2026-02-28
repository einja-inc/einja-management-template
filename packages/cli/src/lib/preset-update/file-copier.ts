import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type {
  CopiedFile,
  CopyOptions,
  CopyResult,
  Preset,
  SourceFile,
} from "@/types/preset-update.js";

/**
 * ディレクトリマッピング定義
 *
 * プロジェクトからCLIプリセットへのディレクトリマッピングを定義します。
 */
interface DirectoryMapping {
  /**
   * コピー元パス（プロジェクトルートからの相対パス）
   */
  source: string;

  /**
   * コピー先パス（プリセットルートからの相対パス）
   */
  destination: string;

  /**
   * カテゴリ名
   */
  category: string;
}

/**
 * ファイルコピーモジュール
 *
 * プロジェクトの.claude/とdocs/をCLIプリセットにコピーします。
 */
export class FileCopier {
  /**
   * ディレクトリマッピング
   *
   * プロジェクト → CLIプリセットのディレクトリマッピング定義
   */
  private readonly directoryMappings: DirectoryMapping[] = [
    {
      source: ".claude/commands",
      destination: ".claude/commands/einja",
      category: "commands",
    },
    {
      source: ".claude/agents",
      destination: ".claude/agents/einja",
      category: "agents",
    },
    {
      source: ".claude/skills",
      destination: ".claude/skills",
      category: "skills",
    },
    {
      source: ".claude/hooks",
      destination: ".claude/hooks",
      category: "hooks",
    },
    {
      source: "docs/einja/steering",
      destination: "docs/einja/steering",
      category: "docs",
    },
    {
      source: "docs/einja/templates",
      destination: "docs/einja/templates",
      category: "docs",
    },
    {
      source: "docs/einja/instructions",
      destination: "docs/einja/instructions",
      category: "docs",
    },
    {
      source: "docs/einja/example",
      destination: "docs/einja/example",
      category: "docs",
    },
  ];

  /**
   * 単一ファイルマッピング
   *
   * ディレクトリではなく個別ファイルのマッピング
   */
  private readonly singleFileMappings: { source: string; destination: string; category: string }[] =
    [
      {
        source: ".envrc",
        destination: ".envrc",
        category: "env",
      },
      {
        source: ".vscode/settings.json",
        destination: ".vscode/settings.json",
        category: "tools",
      },
    ];

  /**
   * プリセットへファイルをコピー
   *
   * @param options - コピーオプション
   * @returns コピー結果
   */
  async copyToPreset(options: CopyOptions): Promise<CopyResult> {
    const { preset, dryRun } = options;
    const copiedFiles: CopiedFile[] = [];
    const skippedFiles: string[] = [];

    try {
      // コピー対象ファイルをスキャン
      const sourceFiles = await this.scanSourceFiles(process.cwd());

      for (const sourceFile of sourceFiles) {
        // スキップ対象かチェック
        if (this.shouldSkip(sourceFile.relativePath)) {
          skippedFiles.push(sourceFile.relativePath);
          continue;
        }

        // コピー先パスを計算
        const destinationPath = this.calculateDestinationPath(sourceFile, preset);

        // ドライランモードでない場合のみコピー実行
        if (!dryRun) {
          try {
            // コピー先ディレクトリを作成
            const destDir = dirname(destinationPath);
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true });
            }

            // ファイルコピー
            copyFileSync(sourceFile.absolutePath, destinationPath);
          } catch (error) {
            // ファイル書き込みエラーの詳細を提供
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(
              `ファイルの書き込みに失敗しました: ${destinationPath}\n詳細: ${errorMessage}`
            );
          }
        }

        copiedFiles.push({
          source: sourceFile.relativePath,
          destination: destinationPath,
          action: "copied",
        });
      }

      return {
        success: true,
        files: copiedFiles,
        skipped: skippedFiles,
      };
    } catch (error) {
      // エラーメッセージをそのまま再スロー（既に詳細情報を含んでいる）
      if (error instanceof Error && error.message.includes("書き込みに失敗しました")) {
        throw error;
      }

      // その他のエラーはラップしてスロー
      throw new Error(
        `ファイルコピーに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * コピー対象ファイルをスキャン
   *
   * @param projectRoot - プロジェクトルートの絶対パス
   * @returns スキャンしたファイル一覧
   */
  async scanSourceFiles(projectRoot: string): Promise<SourceFile[]> {
    const sourceFiles: SourceFile[] = [];

    // ディレクトリマッピングの処理
    for (const mapping of this.directoryMappings) {
      const sourceDir = join(projectRoot, mapping.source);

      // ソースディレクトリが存在しない場合はスキップ
      if (!existsSync(sourceDir)) {
        continue;
      }

      // skillsカテゴリの場合、einja-プレフィックスでフィルタリング
      const prefixFilter = mapping.category === "skills" ? "einja-" : undefined;

      // ディレクトリ内のファイルを再帰的にスキャン
      const files = this.scanDirectory(sourceDir, projectRoot, prefixFilter);

      // カテゴリ情報を付与
      for (const file of files) {
        sourceFiles.push({
          ...file,
          category: mapping.category,
        });
      }
    }

    // 単一ファイルマッピングの処理
    for (const mapping of this.singleFileMappings) {
      const sourcePath = join(projectRoot, mapping.source);

      // ソースファイルが存在しない場合はスキップ
      if (!existsSync(sourcePath)) {
        continue;
      }

      sourceFiles.push({
        relativePath: mapping.source,
        absolutePath: sourcePath,
        category: mapping.category,
      });
    }

    return sourceFiles;
  }

  /**
   * ディレクトリを再帰的にスキャン
   *
   * @param dir - スキャン対象のディレクトリ（絶対パス）
   * @param projectRoot - プロジェクトルートの絶対パス
   * @param prefixFilter - トップレベルディレクトリのプレフィックスフィルタ（例: "einja-"）
   * @param isTopLevel - トップレベルディレクトリかどうか（内部使用）
   * @returns ファイル一覧
   */
  private scanDirectory(
    dir: string,
    projectRoot: string,
    prefixFilter?: string,
    isTopLevel = true
  ): Omit<SourceFile, "category">[] {
    const files: Omit<SourceFile, "category">[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const absolutePath = join(dir, entry);
        const stat = statSync(absolutePath);

        if (stat.isDirectory()) {
          // トップレベルでプレフィックスフィルタがある場合、プレフィックスで始まらないディレクトリはスキップ
          if (isTopLevel && prefixFilter && !entry.startsWith(prefixFilter)) {
            continue;
          }

          // ディレクトリの場合は再帰的にスキャン（サブディレクトリではフィルタ適用しない）
          files.push(...this.scanDirectory(absolutePath, projectRoot, prefixFilter, false));
        } else if (stat.isFile()) {
          // ファイルの場合は一覧に追加
          files.push({
            relativePath: relative(projectRoot, absolutePath),
            absolutePath,
          });
        }
      }

      return files;
    } catch (error) {
      throw new Error(
        `ディレクトリのスキャンに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * スキップ対象かどうかを判定
   *
   * 以下の条件でスキップします:
   * - _プレフィックスで始まるファイル
   * - .DS_Store等の隠しファイル（ただし単一ファイルマッピングで定義されたファイルは除く）
   *
   * @param filePath - ファイルパス（相対パス）
   * @returns スキップする場合true
   */
  shouldSkip(filePath: string): boolean {
    const fileName = basename(filePath);

    // _プレフィックスで始まるファイルはスキップ
    if (fileName.startsWith("_")) {
      return true;
    }

    // 単一ファイルマッピングで定義されたファイルはスキップしない
    if (this.singleFileMappings.some((m) => m.source === filePath)) {
      return false;
    }

    // .で始まるファイル（隠しファイル）はスキップ
    if (fileName.startsWith(".")) {
      return true;
    }

    return false;
  }

  /**
   * コピー先パスを計算
   *
   * ソースファイルとディレクトリマッピングに基づいて、
   * コピー先の絶対パスを計算します。
   *
   * @param sourceFile - ソースファイル情報
   * @param preset - プリセット情報
   * @returns コピー先の絶対パス
   */
  private calculateDestinationPath(sourceFile: SourceFile, preset: Preset): string {
    // 単一ファイルマッピングをチェック
    const singleFileMapping = this.singleFileMappings.find(
      (m) => m.source === sourceFile.relativePath
    );
    if (singleFileMapping) {
      return join(preset.path, singleFileMapping.destination);
    }

    // ディレクトリマッピングを探す
    const mapping = this.directoryMappings.find((m) =>
      sourceFile.relativePath.startsWith(m.source)
    );

    if (!mapping) {
      throw new Error(`マッピングが見つかりません: ${sourceFile.relativePath}`);
    }

    // ソースディレクトリからの相対パスを計算
    const relativeFromSource = relative(mapping.source, sourceFile.relativePath);

    // コピー先パス = プリセットパス + マッピング先 + 相対パス
    return join(preset.path, mapping.destination, relativeFromSource);
  }
}
