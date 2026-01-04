import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type {
  CopiedFile,
  CopyOptions,
  CopyResult,
  Preset,
  SourceFile,
} from "../../types/preset-update.js";

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
      destination: ".claude/skills/einja",
      category: "skills",
    },
    {
      source: "docs/steering",
      destination: "docs/einja/steering",
      category: "docs",
    },
    {
      source: "docs/templates",
      destination: "docs/einja/templates",
      category: "docs",
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
        const destinationPath = this.calculateDestinationPath(
          sourceFile,
          preset
        );

        // ドライランモードでない場合のみコピー実行
        if (!dryRun) {
          // コピー先ディレクトリを作成
          const destDir = dirname(destinationPath);
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }

          // ファイルコピー
          copyFileSync(sourceFile.absolutePath, destinationPath);
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

    for (const mapping of this.directoryMappings) {
      const sourceDir = join(projectRoot, mapping.source);

      // ソースディレクトリが存在しない場合はスキップ
      if (!existsSync(sourceDir)) {
        continue;
      }

      // ディレクトリ内のファイルを再帰的にスキャン
      const files = this.scanDirectory(sourceDir, projectRoot);

      // カテゴリ情報を付与
      for (const file of files) {
        sourceFiles.push({
          ...file,
          category: mapping.category,
        });
      }
    }

    return sourceFiles;
  }

  /**
   * ディレクトリを再帰的にスキャン
   *
   * @param dir - スキャン対象のディレクトリ（絶対パス）
   * @param projectRoot - プロジェクトルートの絶対パス
   * @returns ファイル一覧
   */
  private scanDirectory(
    dir: string,
    projectRoot: string
  ): Omit<SourceFile, "category">[] {
    const files: Omit<SourceFile, "category">[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const absolutePath = join(dir, entry);
        const stat = statSync(absolutePath);

        if (stat.isDirectory()) {
          // einjaサブディレクトリはスキップ（既にeinja/に配置されているファイルを除外）
          if (entry === "einja") {
            continue;
          }

          // ディレクトリの場合は再帰的にスキャン
          files.push(...this.scanDirectory(absolutePath, projectRoot));
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
   * - .DS_Store等の隠しファイル
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
  private calculateDestinationPath(
    sourceFile: SourceFile,
    preset: Preset
  ): string {
    // 適用すべきマッピングを探す
    const mapping = this.directoryMappings.find((m) =>
      sourceFile.relativePath.startsWith(m.source)
    );

    if (!mapping) {
      throw new Error(
        `マッピングが見つかりません: ${sourceFile.relativePath}`
      );
    }

    // ソースディレクトリからの相対パスを計算
    const relativeFromSource = relative(
      mapping.source,
      sourceFile.relativePath
    );

    // コピー先パス = プリセットパス + マッピング先 + 相対パス
    return join(preset.path, mapping.destination, relativeFromSource);
  }
}
