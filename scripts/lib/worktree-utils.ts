import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * git worktreeのメインリポジトリのパスを取得
 * worktreeでない場合はnullを返す
 */
export function getMainWorktreePath(): string | null {
	try {
		const result = execSync("git worktree list --porcelain", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const lines = result.trim().split("\n");
		for (const line of lines) {
			if (line.startsWith("worktree ")) {
				const mainPath = line.substring("worktree ".length);
				if (mainPath !== process.cwd()) {
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
export function copyEnvKeysFromMainWorktree(targetPath: string): boolean {
	const mainPath = getMainWorktreePath();
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
