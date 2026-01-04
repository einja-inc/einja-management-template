import fs from "fs-extra";
import path from "node:path";

/**
 * バックアップ管理クラス
 * 同期前のファイルバックアップとリストア機能を提供
 */
export class BackupManager {
	private projectRoot: string;
	private backupDir: string;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		this.backupDir = path.join(projectRoot, ".einja-sync-backups");
	}

	/**
	 * バックアップディレクトリを作成する
	 */
	async ensureBackupDir(): Promise<void> {
		await fs.ensureDir(this.backupDir);
	}

	/**
	 * ファイルをバックアップする
	 * @param filePath - プロジェクトルートからの相対パス
	 * @returns バックアップファイルのパス
	 */
	async backupFile(filePath: string): Promise<string> {
		const sourcePath = path.join(this.projectRoot, filePath);
		if (!(await fs.pathExists(sourcePath))) {
			throw new Error(`バックアップ対象ファイルが存在しません: ${filePath}`);
		}

		await this.ensureBackupDir();

		// バックアップファイル名：タイムスタンプ付き
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = path.basename(filePath);
		const backupFileName = `${fileName}.${timestamp}.bak`;
		const backupPath = path.join(this.backupDir, backupFileName);

		await fs.copy(sourcePath, backupPath);
		return backupPath;
	}

	/**
	 * 複数のファイルをバックアップする
	 * @param filePaths - バックアップするファイルパスのリスト
	 * @returns バックアップファイルパスのマップ
	 */
	async backupFiles(
		filePaths: string[],
	): Promise<Map<string, string>> {
		const backupMap = new Map<string, string>();

		for (const filePath of filePaths) {
			try {
				const backupPath = await this.backupFile(filePath);
				backupMap.set(filePath, backupPath);
			} catch (error) {
				// ファイルが存在しない場合はスキップ
				if (error instanceof Error && error.message.includes("存在しません")) {
					continue;
				}
				throw error;
			}
		}

		return backupMap;
	}

	/**
	 * バックアップファイルをリストアする
	 * @param backupPath - バックアップファイルのパス
	 * @param targetPath - リストア先のパス
	 */
	async restoreFile(backupPath: string, targetPath: string): Promise<void> {
		if (!(await fs.pathExists(backupPath))) {
			throw new Error(`バックアップファイルが存在しません: ${backupPath}`);
		}

		const targetFullPath = path.join(this.projectRoot, targetPath);
		await fs.copy(backupPath, targetFullPath, { overwrite: true });
	}

	/**
	 * すべてのバックアップファイルをリストアする
	 * @param backupMap - backupFilesで取得したマップ
	 */
	async restoreFiles(backupMap: Map<string, string>): Promise<void> {
		for (const [filePath, backupPath] of backupMap.entries()) {
			await this.restoreFile(backupPath, filePath);
		}
	}

	/**
	 * 古いバックアップファイルをクリーンアップする
	 * @param maxAge - 保持する最大日数（デフォルト: 7日）
	 */
	async cleanupOldBackups(maxAge = 7): Promise<number> {
		if (!(await fs.pathExists(this.backupDir))) {
			return 0;
		}

		const files = await fs.readdir(this.backupDir);
		const now = Date.now();
		const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
		let deletedCount = 0;

		for (const file of files) {
			const filePath = path.join(this.backupDir, file);
			const stat = await fs.stat(filePath);

			if (now - stat.mtime.getTime() > maxAgeMs) {
				await fs.remove(filePath);
				deletedCount++;
			}
		}

		return deletedCount;
	}

	/**
	 * すべてのバックアップファイルを削除する
	 */
	async clearAllBackups(): Promise<void> {
		if (await fs.pathExists(this.backupDir)) {
			await fs.remove(this.backupDir);
		}
	}

	/**
	 * バックアップディレクトリのパスを取得する
	 */
	getBackupDir(): string {
		return this.backupDir;
	}
}
