import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadDefaults, setDefault } from "./lib/defaults.js";
import { setEnvValue, parseEnvFile } from "./lib/env-common.js";
import { commandExists } from "./lib/system-utils.js";

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

function maskToken(token: string): string {
	if (token.length <= 4) return "***";
	return `${token.slice(0, 4)}...`;
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

async function setupMise(): Promise<void> {
	const platform = getPlatform();

	// 1. miseインストール確認
	step(1, "miseの確認...");

	const hasMise = commandExists("mise");

	if (!hasMise) {
		if (platform !== "macos") {
			warn("miseがインストールされていません");
			console.log(colors.yellow("  手動でインストールしてください:"));
			console.log(colors.gray("    curl -fsSL https://mise.run | sh"));
			console.log(
				colors.gray("  インストール後、再度このスクリプトを実行してください\n"),
			);
			process.exit(1);
		}

		console.log("  miseをインストール中...");
		try {
			execSync("curl -fsSL https://mise.run | sh", {
				stdio: "inherit",
				shell: "/bin/bash",
			});
			const miseBinDir = path.join(os.homedir(), ".local", "bin");
			if (!process.env.PATH?.includes(miseBinDir)) {
				process.env.PATH = `${miseBinDir}:${process.env.PATH}`;
			}
			succeed("miseをインストールしました");
		} catch {
			fail("miseのインストールに失敗しました");
			console.log(
				colors.yellow(
					"  手動でインストールしてください: curl -fsSL https://mise.run | sh",
				),
			);
			process.exit(1);
		}
	} else {
		succeed("miseは既にインストールされています");
	}

	// 2. シェル設定確認（mise activate）
	step(2, "miseシェル設定の確認...");

	const shell = process.env.SHELL || "";
	const shellName = path.basename(shell);
	const home = os.homedir();

	let rcFile: string | null = null;
	let activateCmd: string | null = null;

	switch (shellName) {
		case "zsh":
			rcFile = path.join(home, ".zshrc");
			activateCmd = 'eval "$(mise activate zsh)"';
			break;
		case "bash":
			rcFile = path.join(home, ".bashrc");
			activateCmd = 'eval "$(mise activate bash)"';
			break;
		case "fish":
			rcFile = path.join(home, ".config", "fish", "config.fish");
			activateCmd = "mise activate fish | source";
			break;
		default:
			rcFile = null;
			activateCmd = null;
			break;
	}

	if (rcFile && activateCmd) {
		const rcContent = fs.existsSync(rcFile)
			? fs.readFileSync(rcFile, "utf-8")
			: "";

		if (!rcContent.includes("mise activate")) {
			const miseConfig = `\n# mise\n${activateCmd}\n`;
			appendToRcFile(rcFile, miseConfig);
			succeed(`${rcFile} にmise activateを追加しました`);
		} else {
			succeed("miseシェル設定は既に存在します");
		}
	} else {
		warn("未対応のシェルです。手動でmise activateを設定してください");
	}

	// 3. Node.js/pnpmインストール（mise.tomlから自動読み取り）
	step(3, "Node.js/pnpmのインストール...");

	try {
		execSync("mise trust", {
			stdio: "inherit",
			cwd: process.cwd(),
		});
		execSync("mise install", {
			stdio: "inherit",
			cwd: process.cwd(),
		});
		succeed("mise.tomlに基づきNode.js/pnpmをインストールしました");
	} catch {
		warn("Node.js/pnpmのインストールに失敗しました（シェル再起動後に再実行してください）");
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

/**
 * Y/N の確認プロンプト
 */
async function promptConfirm(
	message: string,
	defaultYes = true,
): Promise<boolean> {
	const stdin = process.stdin;
	if (!stdin.isTTY) {
		return false;
	}

	const hint = defaultYes ? "[Y/n]" : "[y/N]";
	const readline = await import("node:readline");
	const rl = readline.createInterface({
		input: stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(`${message} ${hint} `, (answer) => {
			rl.close();
			const trimmed = answer.trim().toLowerCase();
			if (trimmed === "") {
				resolve(defaultYes);
			} else {
				resolve(trimmed === "y" || trimmed === "yes");
			}
		});
	});
}

async function main(): Promise<void> {
	const cwd = process.cwd();
	const platform = getPlatform();

	console.log(colors.blue("\n🚀 開発環境セットアップを開始します...\n"));

	// Step 1-3: miseセットアップ
	await setupMise();

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

	// 7. .env.keys 確認
	step(7, ".env.keys（環境変数の秘密鍵）の確認...");

	const envKeysPath = path.join(cwd, ".env.keys");
	if (!fs.existsSync(envKeysPath)) {
		warn(".env.keys が見つかりません");
		console.log(colors.gray("  .env.keys は .env.local の復号に必要な秘密鍵ファイルです"));
		console.log(colors.gray("  システム管理者から受け取ってプロジェクトルートに配置してください"));
		console.log(colors.gray("  受け取り後、以下のコマンドで鍵をローテーションしてください:"));
		console.log(colors.cyan("    pnpm env:rotate-secrets"));
		console.log(colors.gray("  ※ .env.keys がなくても .env.example フォールバックで開発可能です"));
		console.log(colors.gray("    （初回 pnpm dev 時に確認プロンプトが表示されます）\n"));
	} else {
		succeed(".env.keys が見つかりました");
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

	// デフォルトトークンの確認注入
	let skipManualTokenSetup = false;
	const defaults = loadDefaults();
	const hasDefaults = ["GITHUB_TOKEN", "VERCEL_TOKEN", "NEON_API_KEY"].some(
		(key) => defaults[key],
	);

	if (hasDefaults) {
		console.log(
			colors.yellow("\n  💡 組織共通のデフォルトトークンが見つかりました"),
		);
		const availableDefaults = Object.entries(defaults)
			.filter(([, v]) => v)
			.map(([k, v]) => `    ${k}: ${maskToken(v)}`);
		console.log(colors.gray(availableDefaults.join("\n")));

		const useDefaults = await promptConfirm(
			"  デフォルトトークンを使用しますか？",
			true,
		);

		if (useDefaults) {
			const currentEnv = parseEnvFile(envPersonalPath);
			for (const key of ["GITHUB_TOKEN", "VERCEL_TOKEN", "NEON_API_KEY"]) {
				const val = defaults[key];
				if (val) {
					if (currentEnv[key]) {
						succeed(`${key} は既に設定済みのためスキップしました`);
					} else {
						setEnvValue(envPersonalPath, key, val);
						succeed(`${key} をデフォルトから設定しました`);
					}
				}
			}
			// デフォルト適用後、GITHUB_TOKENが設定済みの場合のみ手動入力をスキップ
			const updatedEnv = parseEnvFile(envPersonalPath);
			skipManualTokenSetup = !!updatedEnv.GITHUB_TOKEN;
		} else {
			console.log(colors.gray("  手動入力フローへ進みます\n"));
		}
	}

	// GITHUB_TOKENの確認（デフォルト注入をスキップした場合のみ）
	if (!skipManualTokenSetup) {
		const currentEnv = parseEnvFile(envPersonalPath);
		const hasGithubToken = !!currentEnv.GITHUB_TOKEN;

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
				setEnvValue(envPersonalPath, "GITHUB_TOKEN", trimmedToken);
				succeed("GITHUB_TOKENを .env.personal に設定しました");

				// デフォルトへの保存を提案
				const saveAsDefault = await promptConfirm(
					"  このトークンをデフォルトに保存しますか？（他のプロジェクトでも使用可能）",
					true,
				);
				if (saveAsDefault) {
					setDefault("GITHUB_TOKEN", trimmedToken);
					succeed("GITHUB_TOKEN をデフォルトに保存しました");
				}
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
	}

	// 9. direnv有効化
	step(9, "direnvの有効化...");
	try {
		execSync("direnv allow", { cwd, stdio: "ignore" });
		succeed("direnvを有効化しました");
	} catch {
		warn("direnv allowに失敗（シェル再起動後に再実行してください）");
	}

	// 完了
	console.log(colors.green("\n=========================================="));
	console.log(colors.green("✅ ツールセットアップが完了しました！"));
	console.log(colors.green("==========================================\n"));

	console.log("開発を始めるには:");
	console.log(colors.cyan("  pnpm dev"));
	console.log(
		colors.gray(
			"  → .env自動生成（.env.local復号）、DB起動、マイグレーションを含みます",
		),
	);
	console.log("");

	console.log("GitHubリポジトリのセットアップ:");
	console.log(colors.cyan("  pnpm init:github"));
	console.log("");
}

main().catch((error: unknown) => {
	console.error(colors.red("エラーが発生しました:"), error);
	process.exit(1);
});
