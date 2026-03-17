import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type WorktreeFileSyncStatus =
	| "copied"
	| "already_exists"
	| "missing_source"
	| "not_worktree"
	| "copy_failed";

export type WorktreeFileSyncResult = {
	sourcePath: string | null;
	status: WorktreeFileSyncStatus;
	targetPath: string;
};

/**
 * git worktreeのメインリポジトリのパスを取得
 * worktreeでない場合はnullを返す
 */
export function getMainWorktreePath(currentPath = process.cwd()): string | null {
	try {
		const result = execSync("git worktree list --porcelain", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const lines = result.trim().split("\n");
		for (const line of lines) {
			if (line.startsWith("worktree ")) {
				const mainPath = line.substring("worktree ".length);
				if (mainPath !== currentPath) {
					return mainPath;
				}
				break;
			}
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * worktreeの親から.env.keysをコピー
 * 成功した場合はtrue、失敗またはworktreeでない場合はfalseを返す
 */
export function copyEnvKeysFromMainWorktree(
	targetPath: string,
	currentPath = process.cwd(),
): boolean {
	return ensureFileFromMainWorktree(".env.keys", targetPath, currentPath).status === "copied";
}

/**
 * 開発サーバーが参照すべき .env.personal の候補パスを返す
 * worktree側の .env.personal を優先しつつ、存在しない場合はメインworktreeを共有する
 */
export function getEnvPersonalCandidatePaths(projectRoot = process.cwd()): string[] {
	const candidates: string[] = [];
	const mainPath = getMainWorktreePath(projectRoot);
	if (mainPath) {
		const sharedEnvPersonalPath = path.join(mainPath, ".env.personal");
		if (fs.existsSync(sharedEnvPersonalPath)) {
			candidates.push(sharedEnvPersonalPath);
		}
	}

	const localEnvPersonalPath = path.join(projectRoot, ".env.personal");
	if (fs.existsSync(localEnvPersonalPath)) {
		candidates.push(localEnvPersonalPath);
	}

	return [...new Set(candidates)];
}

/**
 * current worktree に対象ファイルが無い場合のみ、メインworktreeから補完する
 */
export function ensureFileFromMainWorktree(
	fileName: string,
	targetPath: string,
	currentPath = process.cwd(),
): WorktreeFileSyncResult {
	if (fs.existsSync(targetPath)) {
		return {
			status: "already_exists",
			sourcePath: null,
			targetPath,
		};
	}

	const mainPath = getMainWorktreePath(currentPath);
	if (!mainPath) {
		return {
			status: "not_worktree",
			sourcePath: null,
			targetPath,
		};
	}

	const sourcePath = path.join(mainPath, fileName);
	if (!fs.existsSync(sourcePath)) {
		return {
			status: "missing_source",
			sourcePath,
			targetPath,
		};
	}

	try {
		fs.copyFileSync(sourcePath, targetPath);
		return {
			status: "copied",
			sourcePath,
			targetPath,
		};
	} catch {
		return {
			status: "copy_failed",
			sourcePath,
			targetPath,
		};
	}
}
