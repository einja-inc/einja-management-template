import fsExtra from "fs-extra";
import { join, dirname, relative } from "node:path";
import * as logger from "./logger.js";

/**
 * バックアップ情報
 */
export interface BackupInfo {
  /** バックアップディレクトリパス */
  path: string;
  /** バックアップディレクトリ名 */
  name: string;
  /** 作成日時 */
  timestamp: Date;
}

const { copy, ensureDir, readdir, remove, pathExists } = fsExtra;

/**
 * 現在のタイムスタンプを取得（YYYY-MM-DD_HH-mm-ss形式）
 * @returns タイムスタンプ文字列
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * バックアップディレクトリ名からタイムスタンプを抽出
 * @param dirName - バックアップディレクトリ名
 * @returns タイムスタンプのDate オブジェクト（失敗時は null）
 */
function parseBackupTimestamp(dirName: string): Date | null {
  const match = dirName.match(/^\.einja-sync-backup-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
  if (!match || !match[1]) {
    return null;
  }

  const timestampStr = match[1];
  const parts = timestampStr.split("_");
  if (parts.length !== 2) {
    return null;
  }

  const [datePart, timePart] = parts;
  if (!datePart || !timePart) {
    return null;
  }

  const dateParts = datePart.split("-").map(Number);
  const timeParts = timePart.split("-").map(Number);

  if (dateParts.length !== 3 || timeParts.length !== 3) {
    return null;
  }

  const [year, month, day] = dateParts;
  const [hours, minutes, seconds] = timeParts;

  if (
    year === undefined || month === undefined || day === undefined ||
    hours === undefined || minutes === undefined || seconds === undefined
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * 同期前のバックアップを作成
 * @param targetDir - 対象ディレクトリ
 * @param filesToBackup - バックアップするファイルのリスト
 * @returns バックアップディレクトリパス
 */
export async function createBackup(
  targetDir: string,
  filesToBackup: string[]
): Promise<string> {
  const timestamp = getTimestamp();
  const backupDirName = `.einja-sync-backup-${timestamp}`;
  const backupDir = join(targetDir, backupDirName);

  try {
    // バックアップディレクトリを作成
    await ensureDir(backupDir);

    // ファイルをバックアップ
    for (const file of filesToBackup) {
      const sourcePath = join(targetDir, file);
      const destPath = join(backupDir, file);

      // ファイルが存在するか確認
      if (!(await pathExists(sourcePath))) {
        continue;
      }

      // 宛先ディレクトリを作成
      await ensureDir(dirname(destPath));

      // ファイルをコピー
      await copy(sourcePath, destPath);
    }

    return backupDir;
  } catch (error) {
    logger.error(`バックアップの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * バックアップから復元
 * @param backupDir - バックアップディレクトリパス
 * @param targetDir - 復元先ディレクトリ
 * @returns 成功の場合 true
 */
export async function restoreFromBackup(
  backupDir: string,
  targetDir: string
): Promise<boolean> {
  try {
    // バックアップディレクトリの存在確認
    if (!(await pathExists(backupDir))) {
      logger.error(`バックアップディレクトリが見つかりません: ${backupDir}`);
      return false;
    }

    // バックアップ内のファイル一覧を取得
    const files = await getAllFiles(backupDir);

    // ファイルを復元
    for (const file of files) {
      const sourcePath = join(backupDir, file);
      const destPath = join(targetDir, file);

      // 宛先ディレクトリを作成
      await ensureDir(dirname(destPath));

      // ファイルをコピー（上書き）
      await copy(sourcePath, destPath, { overwrite: true });
    }

    return true;
  } catch (error) {
    logger.error(`バックアップからの復元に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * ディレクトリ内のすべてのファイルを再帰的に取得
 * @param dirPath - ディレクトリパス
 * @param baseDir - ベースディレクトリ（相対パス計算用）
 * @returns ファイルパスの配列（相対パス）
 */
async function getAllFiles(dirPath: string, baseDir?: string): Promise<string[]> {
  const base = baseDir ?? dirPath;
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, base);
      files.push(...subFiles);
    } else {
      files.push(relative(base, fullPath));
    }
  }

  return files;
}

/**
 * 利用可能なバックアップ一覧を取得
 * @param targetDir - 対象ディレクトリ
 * @returns バックアップ情報の配列
 */
export async function listBackups(targetDir: string): Promise<BackupInfo[]> {
  try {
    // ディレクトリの存在確認
    if (!(await pathExists(targetDir))) {
      return [];
    }

    const entries = await readdir(targetDir, { withFileTypes: true });
    const backups: BackupInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const timestamp = parseBackupTimestamp(entry.name);
      if (!timestamp) {
        continue;
      }

      backups.push({
        path: join(targetDir, entry.name),
        name: entry.name,
        timestamp,
      });
    }

    // タイムスタンプでソート（新しい順）
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backups;
  } catch (error) {
    logger.error(`バックアップ一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 古いバックアップを削除
 * @param targetDir - 対象ディレクトリ
 * @param retentionDays - 保持日数（デフォルト: 7）
 * @returns 削除したバックアップ数
 */
export async function cleanOldBackups(
  targetDir: string,
  retentionDays = 7
): Promise<number> {
  try {
    const backups = await listBackups(targetDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const backup of backups) {
      const age = now - backup.timestamp.getTime();
      if (age > retentionMs) {
        await remove(backup.path);
        deletedCount++;
        logger.info(`古いバックアップを削除しました: ${backup.name}`);
      }
    }

    return deletedCount;
  } catch (error) {
    logger.error(`バックアップの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

/**
 * 最新のバックアップを取得
 * @param targetDir - 対象ディレクトリ
 * @returns 最新のバックアップ情報（存在しない場合は null）
 */
export async function getLatestBackup(targetDir: string): Promise<BackupInfo | null> {
  const backups = await listBackups(targetDir);
  return backups.length > 0 ? backups[0] ?? null : null;
}
