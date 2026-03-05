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
	const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(\.git)?/);
	if (sshMatch) {
		return { org: sshMatch[1], repo: sshMatch[2] };
	}
	// HTTPS形式: https://github.com/org/repo.git
	const httpsMatch = url.match(
		/https:\/\/github\.com\/([^/]+)\/([^/.]+)(\.git)?/,
	);
	if (httpsMatch) {
		return { org: httpsMatch[1], repo: httpsMatch[2] };
	}
	return null;
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
		if (parsed) {
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
					const result = spawnSync("gh", ["secret", "set", name, "--body", value], {
						stdio: "pipe",
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
	console.log("");

	p.outro(colors.green("セットアップが完了しました"));
}

main().catch((error: unknown) => {
	console.error(colors.red("エラーが発生しました:"), error);
	process.exit(1);
});
