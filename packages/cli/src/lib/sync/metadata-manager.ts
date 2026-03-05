import { createHash } from "node:crypto";
import type { BaseContent, FileMetadata, SyncMetadata } from "@/types/sync.js";
import { SyncMetadataSchema } from "@/types/sync.js";
import fs from "fs-extra";
import { HashCache } from "./hash-cache.js";

/**
 * メタデータ管理クラス
 * .einja-sync.jsonファイルの読み込み・保存・検証を担当
 */
export class MetadataManager {
  private metadataPath: string;
  private hashCache: HashCache;

  constructor(projectRoot: string, hashCache?: HashCache) {
    this.metadataPath = `${projectRoot}/.einja-sync.json`;
    this.hashCache = hashCache ?? new HashCache();
  }

  /**
   * メタデータファイルを読み込む
   * ファイルが存在しない場合は初期値を返す
   */
  async load(): Promise<SyncMetadata> {
    try {
      if (!(await fs.pathExists(this.metadataPath))) {
        return this.getDefaultMetadata();
      }

      const content = await fs.readFile(this.metadataPath, "utf-8");
      const data = JSON.parse(content);

      // マイグレーション: jsonPaths.seed → jsonPaths["project-private"]
      if (data.jsonPaths && "seed" in data.jsonPaths && !("project-private" in data.jsonPaths)) {
        data.jsonPaths["project-private"] = data.jsonPaths.seed;
        data.jsonPaths.seed = undefined;
      }

      return this.validate(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`メタデータの読み込みに失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * メタデータファイルに保存する
   */
  async save(metadata: SyncMetadata): Promise<void> {
    try {
      const validated = this.validate(metadata);
      await fs.writeFile(this.metadataPath, JSON.stringify(validated, null, 2), "utf-8");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`メタデータの保存に失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * メタデータの妥当性を検証する
   */
  validate(data: unknown): SyncMetadata {
    try {
      return SyncMetadataSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`メタデータのバリデーションに失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ファイルのベースコンテンツとハッシュを取得する
   */
  async getBaseContent(filePath: string): Promise<BaseContent> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const hash = this.calculateHash(content, filePath);
      return { content, hash };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ファイル「${filePath}」の読み込みに失敗しました: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * ファイルハッシュを更新する
   *
   * @param metadata - 現在のメタデータ
   * @param filePath - 対象ファイルパス
   * @param content - ファイルの内容（ハッシュ計算に使用）
   * @param baseContent - 前回sync時のテンプレートコンテンツ（3方向マージ用）
   */
  async updateFileHash(
    metadata: SyncMetadata,
    filePath: string,
    content: string,
    baseContent?: string
  ): Promise<SyncMetadata> {
    const hash = this.calculateHash(content, filePath);
    const fileMetadata: FileMetadata = {
      hash,
      syncedAt: new Date().toISOString(),
      ...(baseContent !== undefined && { baseContent }),
    };

    return {
      ...metadata,
      files: {
        ...metadata.files,
        [filePath]: fileMetadata,
      },
    };
  }

  /**
   * SHA-256ハッシュを計算する（キャッシュあり）
   * 同一ファイル内容の場合、2回目以降はキャッシュから取得
   */
  calculateHash(content: string, filePath = ""): string {
    // キャッシュヒット判定
    if (filePath && this.hashCache.has(filePath, content)) {
      const cachedHash = this.hashCache.get(filePath, content);
      if (cachedHash) {
        return cachedHash;
      }
    }

    // ハッシュ計算
    const hash = createHash("sha256").update(content, "utf8").digest("hex");

    // キャッシュに保存
    if (filePath) {
      this.hashCache.set(filePath, content, hash);
    }

    return hash;
  }

  /**
   * ハッシュキャッシュをクリアする
   */
  clearHashCache(): void {
    this.hashCache.clear();
  }

  /**
   * メタデータから指定ファイルのエントリを削除する
   */
  removeFiles(metadata: SyncMetadata, filePaths: string[]): SyncMetadata {
    const updatedFiles = { ...metadata.files };
    for (const filePath of filePaths) {
      delete updatedFiles[filePath];
    }
    return {
      ...metadata,
      files: updatedFiles,
    };
  }

  /**
   * デフォルトのメタデータを返す
   */
  private getDefaultMetadata(): SyncMetadata {
    return {
      version: "1.0.0",
      lastSync: new Date().toISOString(),
      templateVersion: "0.1.0",
      files: {},
      jsonPaths: {
        managed: {
          ".claude/settings.json": ["plansDirectory", "includeCoAuthoredBy"],
          ".vscode/settings.json": [
            "editor.codeActionsOnSave",
            "editor.defaultFormatter",
            "editor.formatOnSave",
            "eslint.enable",
            "prettier.enable",
            "prettier.useEditorConfig",
            "[json]",
            "[jsonc]",
          ],
        },
        "project-private": {
          "package.json": ["name", "version", "private", "workspaces", "packageManager", "volta"],
        },
      },
    };
  }
}
