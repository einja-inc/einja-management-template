import { createHash } from "node:crypto";
import fs from "fs-extra";
import type {
	BaseContent,
	FileMetadata,
	SyncMetadata,
} from "../../types/sync.js";
import { SyncMetadataSchema } from "../../types/sync.js";

/**
 * メタデータ管理クラス
 * .einja-sync.jsonファイルの読み込み・保存・検証を担当
 */
export class MetadataManager {
	private metadataPath: string;

	constructor(projectRoot: string) {
		this.metadataPath = `${projectRoot}/.einja-sync.json`;
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
			await fs.writeFile(
				this.metadataPath,
				JSON.stringify(validated, null, 2),
				"utf-8",
			);
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
			const hash = this.calculateHash(content);
			return { content, hash };
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`ファイル「${filePath}」の読み込みに失敗しました: ${error.message}`,
				);
			}
			throw error;
		}
	}

	/**
	 * ファイルハッシュを更新する
	 */
	async updateFileHash(
		metadata: SyncMetadata,
		filePath: string,
		content: string,
	): Promise<SyncMetadata> {
		const hash = this.calculateHash(content);
		const fileMetadata: FileMetadata = {
			hash,
			syncedAt: new Date().toISOString(),
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
	 * SHA-256ハッシュを計算する
	 */
	private calculateHash(content: string): string {
		return createHash("sha256").update(content, "utf8").digest("hex");
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
		};
	}
}
