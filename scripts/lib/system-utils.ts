import { execSync } from "node:child_process";

/**
 * コマンドがシステムに存在するか確認
 */
export function commandExists(cmd: string): boolean {
	try {
		const checkCmd =
			process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
		execSync(checkCmd, { stdio: "ignore", shell: true });
		return true;
	} catch {
		return false;
	}
}
