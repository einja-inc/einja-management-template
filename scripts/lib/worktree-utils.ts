import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
	const mainPath = getMainWorktreePath(currentPath);
	if (!mainPath) {
		return false;
	}

	const sourceEnvKeysPath = path.join(mainPath, ".env.keys");
	if (!fs.existsSync(sourceEnvKeysPath)) {
		return false;
	}

	try {
		fs.copyFileSync(sourceEnvKeysPath, targetPath);
		return true;
	} catch {
		return false;
	}
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
