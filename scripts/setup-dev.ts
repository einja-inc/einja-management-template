import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ANSI color codes
const colors = {
	blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
	green: (text: string) => `\x1b[32m${text}\x1b[0m`,
	yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
	gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
	red: (text: string) => `\x1b[31m${text}\x1b[0m`,
	cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

function getPlatform(): "macos" | "linux" | "windows" | "unknown" {
	switch (process.platform) {
		case "darwin":
			return "macos";
		case "linux":
			return "linux";
		case "win32":
			return "windows";
		default:
			return "unknown";
	}
}

function commandExists(cmd: string): boolean {
	try {
		// Use 'command -v' for POSIX compatibility, 'where' for Windows
		const checkCmd =
			process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
		execSync(checkCmd, { stdio: "ignore", shell: true });
		return true;
	} catch {
		return false;
	}
}

/**
 * git worktreeのメインリポジトリのパスを取得
 * worktreeでない場合はnullを返す
 */
function getMainWorktreePath(): string | null {
	try {
		const result = execSync("git worktree list --porcelain", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const lines = result.trim().split("\n");
		// 最初の "worktree /path/to/main" がメインリポジトリ
		for (const line of lines) {
			if (line.startsWith("worktree ")) {
				const mainPath = line.substring("worktree ".length);
				// 現在のディレクトリと異なる場合のみ返す（worktree環境の場合）
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
function copyEnvKeysFromMainWorktree(targetPath: string): boolean {
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

function getShellConfig(): { rcFile: string; hookCmd: string } | null {
	const shell = process.env.SHELL || "";
	const shellName = path.basename(shell);
	const home = os.homedir();

	switch (shellName) {
		case "zsh":
			return {
				rcFile: path.join(home, ".zshrc"),
				hookCmd: 'eval "$(direnv hook zsh)"',
			};
		case "bash":
			return {
				rcFile: path.join(home, ".bashrc"),
				hookCmd: 'eval "$(direnv hook bash)"',
			};
		case "fish":
			return {
				rcFile: path.join(home, ".config", "fish", "config.fish"),
				hookCmd: "direnv hook fish | source",
			};
		default:
			return null;
	}
}

function ensureFileExists(filePath: string): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, "");
	}
}

function appendToRcFile(rcFile: string, content: string): void {
	ensureFileExists(rcFile);
	fs.appendFileSync(rcFile, content);
}

function log(prefix: string, message: string): void {
	console.log(`${prefix} ${message}`);
}

function succeed(message: string): void {
	log(colors.green("✓"), message);
}

function warn(message: string): void {
	log(colors.yellow("⚠"), message);
}

function fail(message: string): void {
	log(colors.red("✗"), message);
}

function step(num: number, message: string): void {
	console.log(`\n${colors.blue(`Step ${num}:`)} ${message}`);
}

async function setupVolta(): Promise<void> {
	const platform = getPlatform();
	const home = os.homedir();

	// 1. Voltaインストール確認
	step(1, "Voltaの確認...");

	const hasVolta = commandExists("volta");

	if (!hasVolta) {
		if (platform !== "macos") {
			warn("Voltaがインストールされていません");
			console.log(colors.yellow("  手動でインストールしてください:"));
			console.log(colors.gray("    curl https://get.volta.sh | bash"));
			console.log(
				colors.gray("  インストール後、再度このスクリプトを実行してください\n"),
			);
			process.exit(1);
		}

		console.log("  Voltaをインストール中...");
		try {
			execSync("curl -fsSL https://get.volta.sh | bash", {
				stdio: "inherit",
				shell: "/bin/bash",
			});
			succeed("Voltaをインストールしました");
		} catch {
			fail("Voltaのインストールに失敗しました");
			console.log(
				colors.yellow(
					"  手動でインストールしてください: curl https://get.volta.sh | bash",
				),
			);
			process.exit(1);
		}
	} else {
		succeed("Voltaは既にインストールされています");
	}

	// 2. シェル設定確認（VOLTA_FEATURE_PNPM）
	step(2, "Voltaシェル設定の確認...");

	const shellConfig = getShellConfig();
	if (shellConfig) {
		const { rcFile } = shellConfig;
		const rcContent = fs.existsSync(rcFile)
			? fs.readFileSync(rcFile, "utf-8")
			: "";

		if (!rcContent.includes("VOLTA_FEATURE_PNPM")) {
			const voltaConfig = `
# Volta - pnpm support
export VOLTA_FEATURE_PNPM=1
`;
			appendToRcFile(rcFile, voltaConfig);
			succeed(`${rcFile} にVOLTA_FEATURE_PNPMを追加しました`);
		} else {
			succeed("Voltaシェル設定は既に存在します");
		}
	}

	// 3. Node.js/pnpmインストール
	step(3, "Node.js/pnpmのインストール...");

	const packageJsonPath = path.join(process.cwd(), "package.json");
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	const voltaConfig = packageJson.volta as
		| { node?: string; pnpm?: string }
		| undefined;

	if (voltaConfig) {
		const voltaPath = path.join(home, ".volta", "bin", "volta");
		const voltaCmd = fs.existsSync(voltaPath) ? voltaPath : "volta";

		try {
			if (voltaConfig.node) {
				execSync(`${voltaCmd} install node@${voltaConfig.node}`, {
					stdio: "inherit",
					env: { ...process.env, VOLTA_FEATURE_PNPM: "1" },
				});
			}
			if (voltaConfig.pnpm) {
				execSync(`${voltaCmd} install pnpm@${voltaConfig.pnpm}`, {
					stdio: "inherit",
					env: { ...process.env, VOLTA_FEATURE_PNPM: "1" },
				});
			}
			succeed(
				`Node.js ${voltaConfig.node}, pnpm ${voltaConfig.pnpm} をインストールしました`,
			);
		} catch {
			warn("Node.js/pnpmのインストールに失敗しました（シェル再起動後に再実行してください）");
		}
	} else {
		warn("package.jsonにvoltaフィールドがありません");
	}
}

async function promptPassword(message: string): Promise<string> {
	const stdin = process.stdin;

	// Non-TTY environment (e.g., piped input, CI) - skip interactive prompt
	if (!stdin.isTTY) {
		return "";
	}

	// Dynamic import for readline (ESM)
	const readline = await import("node:readline");
	const rl = readline.createInterface({
		input: stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		// Hide input for password
		process.stdout.write(`${message} `);
		let input = "";

		const wasRaw = stdin.isRaw;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");

		const onData = (char: string) => {
			switch (char) {
				case "\n":
				case "\r":
				case "\u0004": // Ctrl+D
					stdin.setRawMode(wasRaw ?? false);
					stdin.pause();
					stdin.removeListener("data", onData);
					console.log();
					rl.close();
					resolve(input);
					break;
				case "\u0003": // Ctrl+C
					stdin.setRawMode(wasRaw ?? false);
					stdin.pause();
					stdin.removeListener("data", onData);
					rl.close();
					process.exit(1);
					break;
				case "\u007F": // Backspace
					if (input.length > 0) {
						input = input.slice(0, -1);
						process.stdout.write("\b \b");
					}
					break;
				default:
					input += char;
					process.stdout.write("*");
					break;
			}
		};

		stdin.on("data", onData);
	});
}

async function main(): Promise<void> {
	const cwd = process.cwd();
	const platform = getPlatform();

	console.log(colors.blue("\n🚀 開発環境セットアップを開始します...\n"));

	// Step 1-3: Voltaセットアップ
	await setupVolta();

	// 4. direnvインストール確認・実行
	step(4, "direnvの確認...");

	const hasDirenv = commandExists("direnv");

	if (!hasDirenv) {
		if (platform === "macos") {
			console.log("  direnvをインストール中...");
			const result = spawnSync("brew", ["install", "direnv"], {
				stdio: "inherit",
			});
			if (result.error || result.status !== 0) {
				fail("direnvのインストールに失敗しました");
				console.log(
					colors.yellow("  手動でインストールしてください: brew install direnv"),
				);
				process.exit(1);
			}
			succeed("direnvをインストールしました");
		} else {
			warn("direnvがインストールされていません");
			console.log(colors.yellow("  手動でインストールしてください:"));
			console.log(colors.gray("    Linux: sudo apt install direnv"));
			console.log(
				colors.gray("    詳細: https://direnv.net/docs/installation.html"),
			);
			console.log(
				colors.gray("  インストール後、再度このスクリプトを実行してください\n"),
			);
			process.exit(1);
		}
	} else {
		succeed("direnvは既にインストールされています");
	}

	// 5. シェル設定
	step(5, "シェル設定の確認...");

	const shellConfig = getShellConfig();

	if (shellConfig) {
		const { rcFile, hookCmd } = shellConfig;
		const rcContent = fs.existsSync(rcFile)
			? fs.readFileSync(rcFile, "utf-8")
			: "";

		if (!rcContent.includes("direnv hook")) {
			appendToRcFile(rcFile, `\n# direnv\n${hookCmd}\n`);
			succeed(`${rcFile} に設定を追加しました`);
		} else {
			succeed("シェル設定は既に存在します");
		}
	} else {
		warn("未対応のシェルです。手動でdirenvフックを設定してください");
	}

	// 6. dotenvxインストール
	step(6, "dotenvxの確認...");

	const hasDotenvx = commandExists("dotenvx");

	if (!hasDotenvx) {
		if (platform === "macos" || platform === "linux") {
			console.log("  dotenvxをインストール中...");
			try {
				// 公式インストールスクリプトを使用
				execSync("curl -sfS https://dotenvx.sh/install.sh | sh", {
					stdio: "inherit",
					shell: "/bin/bash",
				});
				succeed("dotenvxをインストールしました");
			} catch {
				// フォールバック: npm経由でインストール
				try {
					execSync("npm install -g @dotenvx/dotenvx", { stdio: "inherit" });
					succeed("dotenvxをnpm経由でインストールしました");
				} catch {
					warn("dotenvxのインストールに失敗しました");
					console.log(colors.yellow("  手動でインストールしてください:"));
					console.log(
						colors.gray("    curl -sfS https://dotenvx.sh/install.sh | sh"),
					);
					console.log(
						colors.gray("    または: npm install -g @dotenvx/dotenvx"),
					);
				}
			}
		} else {
			warn("dotenvxがインストールされていません");
			console.log(colors.yellow("  手動でインストールしてください:"));
			console.log(
				colors.gray("    curl -sfS https://dotenvx.sh/install.sh | sh"),
			);
			console.log(colors.gray("    または: npm install -g @dotenvx/dotenvx"));
		}
	} else {
		succeed("dotenvxは既にインストールされています");
	}

	// 7. .env.local復号 → .env作成
	step(7, ".envファイルの作成（.env.localから復号）...");

	const envPath = path.join(cwd, ".env");
	const envLocalPath = path.join(cwd, ".env.local");
	const envKeysPath = path.join(cwd, ".env.keys");
	const envExamplePath = path.join(cwd, ".env.example");

	if (!fs.existsSync(envPath)) {
		// .env.local（暗号化済み）から復号して.envを作成
		if (fs.existsSync(envLocalPath) && fs.existsSync(envKeysPath)) {
			try {
				// .env.keysから秘密鍵を読み込む
				const keysContent = fs.readFileSync(envKeysPath, "utf-8");
				const localKeyMatch = keysContent.match(
					/DOTENV_PRIVATE_KEY_LOCAL=["']?([^"'\n]+)["']?/,
				);
				if (!localKeyMatch) {
					throw new Error("DOTENV_PRIVATE_KEY_LOCAL が .env.keys に見つかりません");
				}
				const privateKey = localKeyMatch[1];

				// dotenvxで復号
				execSync("npx dotenvx decrypt -f .env.local --stdout > .env", {
					shell: true,
					cwd,
					stdio: "pipe",
					env: { ...process.env, DOTENV_PRIVATE_KEY_LOCAL: privateKey },
				});
				succeed(".env.local を復号して .env を作成しました");
			} catch (error) {
				fail(".env.local の復号に失敗しました");
				console.log(colors.yellow("  秘密鍵が正しいか確認してください"));
				console.log(
					colors.gray("  .env.keys はチームから共有を受けてください"),
				);
				// フォールバック: .env.exampleからコピー
				if (fs.existsSync(envExamplePath)) {
					fs.copyFileSync(envExamplePath, envPath);
					warn("フォールバック: .env.example から .env を作成しました");
				}
			}
		} else if (!fs.existsSync(envKeysPath)) {
			// .env.keysがない場合、まずworktreeの親からコピーを試みる
			if (copyEnvKeysFromMainWorktree(envKeysPath)) {
				succeed("worktreeのメインリポジトリから .env.keys をコピーしました");
				// コピー成功後、復号を再試行
				try {
					const keysContent = fs.readFileSync(envKeysPath, "utf-8");
					const localKeyMatch = keysContent.match(
						/DOTENV_PRIVATE_KEY_LOCAL=["']?([^"'\n]+)["']?/,
					);
					if (localKeyMatch) {
						const privateKey = localKeyMatch[1];
						execSync("npx dotenvx decrypt -f .env.local --stdout > .env", {
							shell: true,
							cwd,
							stdio: "pipe",
							env: { ...process.env, DOTENV_PRIVATE_KEY_LOCAL: privateKey },
						});
						succeed(".env.local を復号して .env を作成しました");
					} else {
						throw new Error("DOTENV_PRIVATE_KEY_LOCAL が見つかりません");
					}
				} catch {
					warn(".env.keys のコピー後、復号に失敗しました");
					if (fs.existsSync(envExamplePath)) {
						fs.copyFileSync(envExamplePath, envPath);
						warn("フォールバック: .env.example から .env を作成しました");
					}
				}
			} else {
				// worktreeからのコピーも失敗した場合
				warn(".env.keys が見つかりません（秘密鍵ファイル）");
				console.log(
					colors.yellow("  チームから .env.keys を共有してもらってください"),
				);
				console.log(colors.gray("  または 1Password 等で共有されています"));
				// フォールバック: .env.exampleからコピー
				if (fs.existsSync(envExamplePath)) {
					fs.copyFileSync(envExamplePath, envPath);
					warn("フォールバック: .env.example から .env を作成しました");
				}
			}
		} else if (!fs.existsSync(envLocalPath)) {
			// .env.localがない場合（古いリポジトリ）
			if (fs.existsSync(envExamplePath)) {
				fs.copyFileSync(envExamplePath, envPath);
				succeed(".env.example から .env を作成しました（レガシーモード）");
			} else {
				fail(".env.example が見つかりません");
				process.exit(1);
			}
		}
	} else {
		succeed(".env は既に存在します");
	}

	// 8. .env.personal作成 & GITHUB_TOKEN設定（対話的）
	step(8, "個人用トークン設定（.env.personal）...");

	const envPersonalPath = path.join(cwd, ".env.personal");
	const envPersonalExamplePath = path.join(cwd, ".env.personal.example");

	// .env.personalがなければテンプレートからコピー
	if (!fs.existsSync(envPersonalPath)) {
		if (fs.existsSync(envPersonalExamplePath)) {
			fs.copyFileSync(envPersonalExamplePath, envPersonalPath);
			succeed(".env.personal.example から .env.personal を作成しました");
		} else {
			// テンプレートがない場合は最小限の内容で作成
			fs.writeFileSync(
				envPersonalPath,
				"# 個人用トークン\nGITHUB_TOKEN=\n",
			);
			succeed(".env.personal を新規作成しました");
		}
	}

	// GITHUB_TOKENの確認
	const envPersonalContent = fs.readFileSync(envPersonalPath, "utf-8");
	const hasGithubToken =
		envPersonalContent.includes("GITHUB_TOKEN=") &&
		!envPersonalContent.match(/GITHUB_TOKEN=\s*$/m) &&
		!envPersonalContent.match(/GITHUB_TOKEN=\s*\n/);

	if (!hasGithubToken) {
		console.log(colors.yellow("\n  ⚠️  GITHUB_TOKENが設定されていません"));
		console.log(colors.gray("  GitHub Personal Access Token が必要です"));
		console.log(
			colors.gray("  取得方法: https://github.com/settings/tokens/new"),
		);
		console.log(colors.gray("  必要なスコープ: repo, read:org\n"));

		const token = await promptPassword(
			"  GITHUB_TOKENを入力してください（スキップはEnter）:",
		);

		const trimmedToken = token.trim();
		if (trimmedToken) {
			let updatedContent: string;
			if (envPersonalContent.includes("GITHUB_TOKEN=")) {
				// Replace existing line
				updatedContent = envPersonalContent.replace(
					/GITHUB_TOKEN=.*/,
					`GITHUB_TOKEN=${trimmedToken}`,
				);
			} else {
				// Append new line
				updatedContent = envPersonalContent.endsWith("\n")
					? `${envPersonalContent}GITHUB_TOKEN=${trimmedToken}\n`
					: `${envPersonalContent}\nGITHUB_TOKEN=${trimmedToken}\n`;
			}
			fs.writeFileSync(envPersonalPath, updatedContent);
			succeed("GITHUB_TOKENを .env.personal に設定しました");
		} else {
			console.log(
				colors.yellow(
					"  スキップしました。後で .env.personal を編集してください",
				),
			);
		}
	} else {
		succeed("GITHUB_TOKENは既に設定されています");
	}

	// 9. direnv有効化
	step(9, "direnvの有効化...");
	try {
		execSync("direnv allow", { cwd, stdio: "ignore" });
		succeed("direnvを有効化しました");
	} catch {
		warn("direnv allowに失敗（シェル再起動後に再実行してください）");
	}

	// 10. データベース起動
	step(10, "データベース起動...");
	const hasDocker = commandExists("docker");

	if (hasDocker) {
		try {
			execSync("docker-compose up -d postgres", { cwd, stdio: "inherit" });
			succeed("PostgreSQLを起動しました");

			// 起動を待つ
			console.log(colors.gray("  データベースの起動を待機中..."));
			await new Promise((resolve) => setTimeout(resolve, 3000));

			// 11. Prismaセットアップ
			step(11, "データベース初期化...");
			execSync("pnpm db:generate", { cwd, stdio: "inherit" });
			execSync("pnpm db:push", { cwd, stdio: "inherit" });
			succeed("データベースを初期化しました");
		} catch {
			warn("データベースの起動または初期化に失敗しました");
			console.log(colors.gray("  手動で実行してください:"));
			console.log(colors.gray("    docker-compose up -d postgres"));
			console.log(colors.gray("    pnpm db:generate && pnpm db:push"));
		}
	} else {
		warn("Dockerがインストールされていません");
		if (platform === "macos") {
			console.log(colors.yellow("  OrbStack（Docker互換の軽量ツール）のインストールを推奨します:"));
			console.log(colors.cyan("    brew install orbstack"));
			console.log(colors.gray("  または: https://orbstack.dev/"));
		} else if (platform === "windows") {
			console.log(colors.yellow("  Dockerをインストールしてください:"));
			console.log(colors.gray("    https://docs.docker.com/desktop/install/windows-install/"));
		} else {
			console.log(colors.yellow("  Docker Engineをインストールしてください:"));
			console.log(colors.gray("    https://docs.docker.com/engine/install/"));
		}
		console.log(colors.gray("  インストール後、以下を実行してください:"));
		console.log(colors.gray("    docker-compose up -d postgres"));
		console.log(colors.gray("    pnpm db:generate && pnpm db:push"));
	}

	// 完了
	console.log(colors.green("\n=========================================="));
	console.log(colors.green("✅ 環境セットアップが完了しました！"));
	console.log(colors.green("==========================================\n"));

	console.log("開発を始めるには:");
	console.log(colors.cyan("  pnpm dev"));
	console.log("");

	console.log("GitHubリポジトリのセットアップ:");
	console.log(colors.cyan("  pnpm init:github"));
	console.log("");
}

main().catch((error: unknown) => {
	console.error(colors.red("エラーが発生しました:"), error);
	process.exit(1);
});
