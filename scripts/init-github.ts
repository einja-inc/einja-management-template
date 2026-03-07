import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";

// ANSI color codes
const colors = {
	blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
	green: (text: string) => `\x1b[32m${text}\x1b[0m`,
	yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
	gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
	red: (text: string) => `\x1b[31m${text}\x1b[0m`,
	cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
	bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

function commandExists(cmd: string): boolean {
	try {
		const checkCmd =
			process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
		execSync(checkCmd, { stdio: "ignore", shell: true });
		return true;
	} catch {
		return false;
	}
}

function succeed(message: string): void {
	console.log(`${colors.green("✓")} ${message}`);
}

function warn(message: string): void {
	console.log(`${colors.yellow("⚠")} ${message}`);
}

function fail(message: string): void {
	console.log(`${colors.red("✗")} ${message}`);
}

function step(num: number, message: string): void {
	console.log(`\n${colors.blue(`Step ${num}:`)} ${message}`);
}

/**
 * git remote URLからorg/repoを解析する
 */
function parseRemoteUrl(url: string): { org: string; repo: string } | null {
	// SSH形式: git@github.com:org/repo.git
	const sshMatch = url.trim().match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
	if (sshMatch) {
		return { org: sshMatch[1], repo: sshMatch[2] };
	}
	// HTTPS形式: https://github.com/org/repo.git
	const httpsMatch = url.trim().match(
		/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
	);
	if (httpsMatch) {
		return { org: httpsMatch[1], repo: httpsMatch[2] };
	}
	return null;
}

function isValidGitHubIdentifier(value: string): boolean {
	return /^[a-zA-Z0-9._-]+$/.test(value) && value.length <= 100;
}

/**
 * .env.keysファイルからDOTENV_PRIVATE_KEY_*のエントリを読み取る
 */
function parseEnvKeys(
	filePath: string,
): Array<{ name: string; value: string }> {
	const content = fs.readFileSync(filePath, "utf-8");
	const entries: Array<{ name: string; value: string }> = [];
	for (const line of content.split("\n")) {
		const match = line.match(
			/^(DOTENV_PRIVATE_KEY_\w+)=["']?([^"'\n]+)["']?/,
		);
		if (match) {
			entries.push({ name: match[1], value: match[2] });
		}
	}
	return entries;
}

async function main(): Promise<void> {
	const cwd = process.cwd();

	p.intro(colors.blue("GitHub リポジトリセットアップ"));

	// Step 1: gh CLIの確認
	step(1, "GitHub CLI (gh) の確認...");

	if (!commandExists("gh")) {
		fail("GitHub CLI (gh) がインストールされていません");
		console.log(colors.yellow("  インストール方法:"));
		console.log(colors.cyan("    brew install gh"));
		console.log(
			colors.gray("  詳細: https://cli.github.com/manual/installation"),
		);
		process.exit(1);
	}
	succeed("GitHub CLI (gh) がインストールされています");

	// Step 2: gh認証の確認
	step(2, "GitHub認証の確認...");

	try {
		execSync("gh auth status", { stdio: "pipe" });
		succeed("GitHub認証済みです");
	} catch {
		fail("GitHubに認証されていません");
		console.log(colors.yellow("  以下のコマンドでログインしてください:"));
		console.log(colors.cyan("    gh auth login"));
		process.exit(1);
	}

	// Step 3: リモートリポジトリの確認
	step(3, "リモートリポジトリの確認...");

	let org = "";
	let repo = "";
	let remoteUrl = "";

	try {
		remoteUrl = execSync("git remote get-url origin", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
	} catch {
		remoteUrl = "";
	}

	if (!remoteUrl) {
		// Step 4: リモートがない場合、新規作成
		step(4, "新規リポジトリの作成...");

		const dirName = path.basename(cwd);

		const orgInput = await p.text({
			message: "GitHub組織名（またはユーザー名）を入力してください",
			placeholder: "einja-inc",
			initialValue: "einja-inc",
		});
		if (p.isCancel(orgInput)) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}
		org = orgInput;
		if (!isValidGitHubIdentifier(org)) {
			fail("無効な組織名です（英数字, ., -, _ のみ使用可能）");
			process.exit(1);
		}

		const repoInput = await p.text({
			message: "リポジトリ名を入力してください",
			placeholder: dirName,
			defaultValue: dirName,
		});
		if (p.isCancel(repoInput)) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}
		repo = repoInput;
		if (!isValidGitHubIdentifier(repo)) {
			fail("無効なリポジトリ名です（英数字, ., -, _ のみ使用可能）");
			process.exit(1);
		}

		const visibility = await p.select({
			message: "リポジトリの公開設定を選択してください",
			options: [
				{ value: "private", label: "Private（非公開）", hint: "推奨" },
				{ value: "public", label: "Public（公開）" },
			],
			initialValue: "private",
		});
		if (p.isCancel(visibility)) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}

		const visibilityFlag =
			visibility === "public" ? "--public" : "--private";

		try {
			execSync(
				`gh repo create ${org}/${repo} ${visibilityFlag} --source=. --remote=origin`,
				{ stdio: "inherit", cwd },
			);
			succeed(`リポジトリ ${org}/${repo} を作成しました`);
		} catch (error) {
			fail("リポジトリの作成に失敗しました");
			console.log(colors.red(`  ${error}`));
			process.exit(1);
		}
	} else {
		// リモートが存在する場合、org/repoを解析
		const parsed = parseRemoteUrl(remoteUrl);
		if (parsed && isValidGitHubIdentifier(parsed.org) && isValidGitHubIdentifier(parsed.repo)) {
			org = parsed.org;
			repo = parsed.repo;
			succeed(`リモートリポジトリ: ${org}/${repo}`);
		} else {
			warn(`リモートURLの解析に失敗しました: ${remoteUrl}`);
			org = "";
			repo = "";
		}
	}

	// Step 5: mainブランチのプッシュ
	step(5, "mainブランチのプッシュ...");

	try {
		const trackingBranch = execSync(
			"git rev-parse --abbrev-ref --symbolic-full-name @{u}",
			{
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			},
		).trim();
		succeed(`リモート追跡ブランチ: ${trackingBranch}`);
	} catch {
		// 追跡ブランチがない場合はプッシュ
		try {
			execSync("git push -u origin main", { stdio: "inherit", cwd });
			succeed("mainブランチをプッシュしました");
		} catch (error) {
			warn("mainブランチのプッシュに失敗しました");
			console.log(colors.gray(`  ${error}`));
		}
	}

	// Step 6: ブランチ保護ルールの設定
	step(6, "ブランチ保護ルールの設定...");

	if (org && repo) {
		try {
			const protectionPayload = JSON.stringify({
				required_status_checks: {
					strict: true,
					contexts: [],
				},
				enforce_admins: false,
				required_pull_request_reviews: {
					dismiss_stale_reviews: true,
					require_code_owner_reviews: false,
					required_approving_review_count: 1,
				},
				restrictions: null,
				allow_force_pushes: false,
				allow_deletions: false,
			});

			execSync(
				`gh api repos/${org}/${repo}/branches/main/protection -X PUT --input - <<'EOF'\n${protectionPayload}\nEOF`,
				{
					stdio: "pipe",
					cwd,
					shell: true,
				},
			);
			succeed("ブランチ保護ルールを設定しました");
			console.log(colors.gray("  - PRレビュー必須（1名以上）"));
			console.log(colors.gray("  - ステータスチェック必須"));
			console.log(colors.gray("  - 古いレビューの自動却下"));
			console.log(colors.gray("  - フォースプッシュ禁止"));
		} catch (error) {
			warn("ブランチ保護ルールの設定に失敗しました");
			console.log(
				colors.gray(
					"  リポジトリの権限を確認してください（Freeプランでは制限あり）",
				),
			);
		}
	} else {
		warn("org/repoが不明のため、ブランチ保護ルールをスキップしました");
	}

	// Step 7: GitHub Secretsの設定
	step(7, "GitHub Secretsの設定（.env.keys）...");

	const envKeysPath = path.join(cwd, ".env.keys");

	if (fs.existsSync(envKeysPath)) {
		const keys = parseEnvKeys(envKeysPath);
		if (keys.length > 0) {
			let successCount = 0;
			let failCount = 0;

			for (const { name, value } of keys) {
				try {
					const result = spawnSync("gh", ["secret", "set", name], {
						input: value,
						stdio: ["pipe", "pipe", "pipe"],
						cwd,
					});
					if (result.status !== 0) {
						throw new Error(result.stderr?.toString() || "gh secret set failed");
					}
					successCount++;
				} catch {
					failCount++;
					warn(`  Secret ${name} の設定に失敗しました`);
				}
			}

			if (successCount > 0) {
				succeed(`${successCount}件のSecretを設定しました`);
			}
			if (failCount > 0) {
				warn(`${failCount}件のSecretの設定に失敗しました`);
			}
		} else {
			warn(
				".env.keys にDOTENV_PRIVATE_KEY_*エントリが見つかりませんでした",
			);
		}
	} else {
		warn(".env.keys が見つかりません（スキップ）");
		console.log(
			colors.gray(
				"  後で .env.keys を配置して再実行してください",
			),
		);
	}

	// Step 8: GitHub Environmentsの作成
	step(8, "GitHub Environmentsの作成...");

	if (org && repo) {
		const environments = ["production", "preview"];

		for (const envName of environments) {
			try {
				execSync(
					`gh api repos/${org}/${repo}/environments/${envName} -X PUT --input - <<'EOF'\n{}\nEOF`,
					{
						stdio: "pipe",
						cwd,
						shell: true,
					},
				);
				succeed(`Environment "${envName}" を作成しました`);
			} catch {
				warn(`Environment "${envName}" の作成に失敗しました`);
			}
		}
	} else {
		warn("org/repoが不明のため、Environmentsの作成をスキップしました");
	}

	// Step 9: 初回デプロイ状態の確認
	step(9, "初回デプロイ状態の確認...");

	// pendingSetupsをStep 9前に宣言（Step 9内外で使用）
	const pendingSetups: string[] = [];

	let vercelLinkedApps: string[] = [];
	let appDirs: string[] = [];
	let neonConfigured = false;

	// Vercel未リンクの検出
	try {
		const appsDir = path.join(cwd, "apps");
		appDirs = fs.existsSync(appsDir)
			? fs
					.readdirSync(appsDir)
					.filter((d) =>
						!d.startsWith(".") &&
						d !== "node_modules" &&
						fs.statSync(path.join(appsDir, d)).isDirectory(),
					)
			: [];
		vercelLinkedApps = appDirs.filter((app) => {
			const projectJsonPath = path.join(appsDir, app, ".vercel", "project.json");
			if (!fs.existsSync(projectJsonPath)) return false;
			try {
				const projectData = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
				return !!projectData.projectId;
			} catch {
				return false;
			}
		});

		if (vercelLinkedApps.length === 0 && appDirs.length > 0) {
			warn("Vercelプロジェクトが未リンクです");
			console.log(
				colors.yellow(
					"  以下のコマンドでVercelプロジェクトをリンクしてください:",
				),
			);
			console.log(
				colors.cyan(
					"    pnpm env  →  「デフォルトトークン管理」でVERCEL_TOKENを設定後",
				),
			);
			for (const app of appDirs) {
				console.log(
					colors.gray(`    cd apps/${app} && vercel link --yes`),
				);
			}
		} else if (vercelLinkedApps.length > 0) {
			succeed(`Vercelリンク済み: ${vercelLinkedApps.join(", ")}`);
			const unlinkedApps = appDirs.filter(
				(app) => !vercelLinkedApps.includes(app),
			);
			if (unlinkedApps.length > 0) {
				warn(`未リンクのアプリ: ${unlinkedApps.join(", ")}`);
			}
		}
	} catch (error) {
		warn("Vercel状態の確認中にエラーが発生しました");
		console.log(colors.gray(`  ${error}`));
	}

	// Neon未設定の検出
	try {
		const envPath = path.join(cwd, ".env");
		const envPreviewPath = path.join(cwd, ".env.preview");

		for (const checkPath of [envPreviewPath, envPath]) {
			if (neonConfigured) break;
			if (fs.existsSync(checkPath)) {
				const envContent = fs.readFileSync(checkPath, "utf-8");
				const neonMatch = envContent.match(/^NEON_PROJECT_ID=(.+)$/m);
				neonConfigured = !!(
					neonMatch &&
					neonMatch[1].trim() &&
					!neonMatch[1].includes("your-") &&
					!neonMatch[1].includes("placeholder")
				);
			}
		}

		if (!neonConfigured) {
			if (fs.existsSync(envPreviewPath)) {
				warn("Neonプロジェクトが未設定の可能性があります");
			} else {
				warn("Neonプロジェクトが未設定です（.env.preview が存在しません）");
			}
			console.log(
				colors.yellow(
					"  Neonデータベースの初期設定を実行してください:",
				),
			);
			console.log(
				colors.cyan(
					"    pnpm env  →  「デフォルトトークン管理」でNEON_API_KEYを設定後",
				),
			);
			console.log(
				colors.gray(
					"    neonctl projects create --name <project-name> --region-id aws-ap-northeast-1",
				),
			);
		} else {
			succeed("Neonプロジェクトが設定済みです");
		}
	} catch (error) {
		warn("Neon状態の確認中にエラーが発生しました");
		console.log(colors.gray(`  ${error}`));
	}

	// GitHub Secrets検出
	if (org && repo) {
		try {
			const secretsJson = execSync("gh secret list --json name", {
				encoding: "utf-8",
				cwd,
				stdio: ["pipe", "pipe", "pipe"],
			});
			const secrets: Array<{ name: string }> = JSON.parse(secretsJson);
			const secretNames = secrets.map((s) => s.name);
			const hasVercelProjectSecrets = secretNames.some((name) =>
				/VERCEL_PROJECT_ID_/i.test(name),
			);
			if (!hasVercelProjectSecrets) {
				warn("Vercel関連のGitHub Secretsが未設定です");
				console.log(
					colors.yellow(
						"  GitHub Secretsの一括設定を実行してください:",
					),
				);
				console.log(
					colors.cyan(
						"    pnpm env  →  「デフォルトトークン管理」でトークンを設定",
					),
				);
				console.log(
					colors.gray(
						"    または: /einja-infra-maintenance → カテゴリ5: GitHub Secrets管理",
					),
				);
				pendingSetups.push("GitHub Secrets（Vercel関連）");
			} else {
				succeed("Vercel関連のGitHub Secretsが設定済みです");
			}
		} catch {
			warn("GitHub Secretsの確認をスキップしました");
		}
	}

	// 完了サマリー
	console.log(colors.green("\n=========================================="));
	console.log(colors.green("✅ GitHubリポジトリのセットアップが完了しました！"));
	console.log(colors.green("==========================================\n"));

	if (org && repo) {
		console.log(`リポジトリ: ${colors.cyan(`https://github.com/${org}/${repo}`)}`);
		console.log("");
	}

	console.log("セットアップ内容:");
	console.log(colors.gray("  - リモートリポジトリの設定"));
	console.log(colors.gray("  - mainブランチの保護ルール"));
	console.log(colors.gray("  - GitHub Secrets（.env.keys）"));
	console.log(colors.gray("  - GitHub Environments（production, preview）"));
	console.log(colors.gray("  - 初回デプロイ状態の確認"));
	console.log("");

	// 未設定項目の案内
	if (vercelLinkedApps.length === 0 && appDirs.length > 0) {
		pendingSetups.push("Vercelプロジェクトリンク");
	}
	if (!neonConfigured) {
		pendingSetups.push("Neonデータベース設定");
	}

	if (pendingSetups.length > 0) {
		console.log(colors.yellow("\n📋 追加セットアップが必要:"));
		for (const item of pendingSetups) {
			console.log(colors.yellow(`  - ${item}`));
		}
		console.log(
			colors.cyan(
				"\n  → pnpm env で環境変数を設定した後、各サービスの初期設定を実行してください",
			),
		);
		console.log("");
	}

	p.outro(colors.green("セットアップが完了しました"));
}

main().catch((error: unknown) => {
	console.error(colors.red("エラーが発生しました:"), error);
	process.exit(1);
});
