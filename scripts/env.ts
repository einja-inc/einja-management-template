/**
 * 環境変数設定ウィザード
 *
 * 対話的に環境変数を設定・更新するCLIツール
 * 使用方法: pnpm env
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
	type EnvironmentConfig,
	ENVIRONMENTS,
	parseEnvFile,
	getPrivateKey,
	ENV_KEYS_PATH,
} from "./lib/env-common.js";

const cwd = process.cwd();

// ファイルパス
const ENV_PATH = path.join(cwd, ".env");
const ENV_LOCAL_PATH = path.join(cwd, ".env.local");
const ENV_PERSONAL_PATH = path.join(cwd, ".env.personal");
const ENV_PERSONAL_EXAMPLE_PATH = path.join(cwd, ".env.personal.example");

/**
 * 環境変数ファイルに値を設定
 */
function setEnvValue(filePath: string, key: string, value: string): void {
	let content = "";
	if (fs.existsSync(filePath)) {
		content = fs.readFileSync(filePath, "utf-8");
	}

	const regex = new RegExp(`^${key}=.*$`, "m");
	if (regex.test(content)) {
		content = content.replace(regex, `${key}=${value}`);
	} else {
		content = content.trim() + `\n${key}=${value}\n`;
	}

	fs.writeFileSync(filePath, content);
}

/**
 * 現在の環境変数の状態を表示
 */
function showStatus(): void {
	p.note(
		[
			"📁 ファイル状態:",
			`   .env          : ${fs.existsSync(ENV_PATH) ? "✅ 存在" : "❌ なし"}`,
			`   .env.local    : ${fs.existsSync(ENV_LOCAL_PATH) ? "✅ 存在" : "❌ なし"}`,
			`   .env.personal : ${fs.existsSync(ENV_PERSONAL_PATH) ? "✅ 存在" : "❌ なし"}`,
			`   .env.keys     : ${fs.existsSync(ENV_KEYS_PATH) ? "✅ 存在" : "❌ なし"}`,
			"",
			"🔑 主要な環境変数:",
		].join("\n"),
		"環境変数の状態"
	);

	const envPersonal = parseEnvFile(ENV_PERSONAL_PATH);
	const env = parseEnvFile(ENV_PATH);

	const checkVars = [
		{ key: "GITHUB_TOKEN", file: ".env.personal" },
		{ key: "DATABASE_URL", file: ".env" },
		{ key: "AUTH_SECRET", file: ".env" },
	];

	for (const { key, file } of checkVars) {
		const value = file === ".env.personal" ? envPersonal[key] : env[key];
		const status = value ? "✅ 設定済み" : "❌ 未設定";
		const masked = value ? `${value.slice(0, 8)}...` : "-";
		console.log(`   ${key}: ${status} (${masked})`);
	}
}

/**
 * 個人トークンを設定
 */
async function setupPersonalTokens(): Promise<void> {
	// .env.personal がなければ作成
	if (!fs.existsSync(ENV_PERSONAL_PATH)) {
		if (fs.existsSync(ENV_PERSONAL_EXAMPLE_PATH)) {
			fs.copyFileSync(ENV_PERSONAL_EXAMPLE_PATH, ENV_PERSONAL_PATH);
			p.log.success(".env.personal を作成しました");
		} else {
			fs.writeFileSync(ENV_PERSONAL_PATH, "# 個人用トークン\n");
			p.log.success(".env.personal を新規作成しました");
		}
	}

	const current = parseEnvFile(ENV_PERSONAL_PATH);

	// GITHUB_TOKEN
	const currentGithubToken = current.GITHUB_TOKEN;
	const githubTokenStatus = currentGithubToken
		? `現在: ${currentGithubToken.slice(0, 8)}...`
		: "未設定";

	const updateGithubToken = await p.confirm({
		message: `GITHUB_TOKEN を設定しますか？ (${githubTokenStatus})`,
		initialValue: !currentGithubToken,
	});

	if (p.isCancel(updateGithubToken)) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	if (updateGithubToken) {
		p.log.info("GitHub Personal Access Token を入力してください");
		p.log.info("取得方法: https://github.com/settings/tokens/new");
		p.log.info("必要なスコープ: repo, read:org");

		const token = await p.password({
			message: "GITHUB_TOKEN:",
		});

		if (p.isCancel(token)) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}

		if (token) {
			setEnvValue(ENV_PERSONAL_PATH, "GITHUB_TOKEN", token);
			p.log.success("GITHUB_TOKEN を設定しました");

			// トークンの検証を試みる
			try {
				const result = execSync(
					`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${token}" https://api.github.com/user`,
					{ encoding: "utf-8" }
				).trim();
				if (result === "200") {
					p.log.success("✅ トークンの検証に成功しました");
				} else {
					p.log.warn(`⚠️ トークンの検証に失敗しました (HTTP ${result})`);
				}
			} catch {
				p.log.warn("⚠️ トークンの検証をスキップしました");
			}
		}
	}

	// 他のトークン（オプション）
	const addMore = await p.confirm({
		message: "他のトークンも設定しますか？ (OPENAI_API_KEY, ANTHROPIC_API_KEY等)",
		initialValue: false,
	});

	if (p.isCancel(addMore)) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	if (addMore) {
		const keyName = await p.text({
			message: "環境変数名を入力:",
			placeholder: "OPENAI_API_KEY",
		});

		if (p.isCancel(keyName) || !keyName) {
			return;
		}

		const keyValue = await p.password({
			message: `${keyName}:`,
		});

		if (p.isCancel(keyValue)) {
			return;
		}

		if (keyValue) {
			setEnvValue(ENV_PERSONAL_PATH, keyName, keyValue);
			p.log.success(`${keyName} を設定しました`);
		}
	}

	p.note(
		"direnv allow を実行するか、新しいターミナルを開くと反映されます",
		"💡 次のステップ"
	);
}


/**
 * 環境設定を変更（汎用）
 */
async function updateEnvironmentSettings(env: EnvironmentConfig): Promise<void> {
	const envFilePath = path.join(cwd, env.file);

	if (!fs.existsSync(envFilePath)) {
		p.log.error(`${env.file} が見つかりません`);
		return;
	}

	if (!fs.existsSync(ENV_KEYS_PATH)) {
		p.log.error(".env.keys が見つかりません（秘密鍵が必要です）");
		p.log.info("チームから .env.keys を共有してもらってください");
		return;
	}

	const privateKey = getPrivateKey(env.privateKeyEnv);
	if (!privateKey) {
		p.log.error(`.env.keys に ${env.privateKeyEnv} が見つかりません`);
		return;
	}

	// 本番環境の場合は追加確認
	if (env.name === "production") {
		p.log.warn("⚠️  本番環境の設定を変更しようとしています");
		const confirmProd = await p.confirm({
			message: "本当に本番環境の設定を変更しますか？",
			initialValue: false,
		});
		if (p.isCancel(confirmProd) || !confirmProd) {
			p.cancel("キャンセルしました");
			return;
		}
	}

	p.note(
		[
			`${env.description}（${env.file}）を変更します。`,
			"",
			"手順:",
			`1. ${env.file} を復号`,
			"2. エディタで編集",
			"3. 再暗号化",
			"4. git commit & push",
		].join("\n"),
		`📝 ${env.description}の変更`
	);

	const proceed = await p.confirm({
		message: "続行しますか？",
		initialValue: true,
	});

	if (p.isCancel(proceed) || !proceed) {
		p.cancel("キャンセルしました");
		return;
	}

	const spinner = p.spinner();
	const tmpPath = path.join(cwd, `${env.file}.tmp`);
	const backupPath = path.join(cwd, `${env.file}.bak`);

	// dotenvx実行時の環境変数
	const dotenvxEnv = { ...process.env, [env.privateKeyEnv]: privateKey };

	try {
		// 1. 復号
		spinner.start(`${env.file} を復号中...`);
		const decrypted = execSync(`dotenvx decrypt -f ${env.file} --stdout`, {
			cwd,
			encoding: "utf-8",
			env: dotenvxEnv,
		});
		fs.writeFileSync(tmpPath, decrypted);
		spinner.stop(`${env.file} を復号しました`);

		// 2. エディタで開く
		const editor = process.env.EDITOR || "vi";

		// vi/vimの場合はファイル先頭に使い方ヘルプをコメントとして追加
		const vimHelpMarker = "# === ↓↓↓ ここから下を編集（この行より上は保存時に自動削除）↓↓↓ ===";
		if (editor === "vi" || editor === "vim") {
			const vimHelp = `# ┌─────────────────────────────────────────────────┐
# │  vi/vim の基本操作                              │
# ├─────────────────────────────────────────────────┤
# │  【編集モードに入る】                           │
# │    i  ... カーソル位置から入力開始              │
# │    a  ... カーソルの次の位置から入力開始        │
# │    o  ... 次の行に新しい行を挿入して入力開始    │
# │                                                 │
# │  【編集モードから出る】                         │
# │    Esc ... ノーマルモードに戻る                 │
# │                                                 │
# │  【保存・終了】(Escを押してから)                │
# │    :wq  ... 保存して終了                        │
# │    :w   ... 保存のみ                            │
# │    :q!  ... 保存せず強制終了                    │
# │                                                 │
# │  【カーソル移動】                               │
# │    h j k l  または 矢印キー                     │
# └─────────────────────────────────────────────────┘
${vimHelpMarker}

`;
			const currentContent = fs.readFileSync(tmpPath, "utf-8");
			fs.writeFileSync(tmpPath, vimHelp + currentContent);
		}

		p.log.info(`${editor} で ${env.file}.tmp を開きます...`);

		execSync(`${editor} ${env.file}.tmp`, {
			cwd,
			stdio: "inherit",
		});

		// 3. 編集確認
		const confirmSave = await p.confirm({
			message: "変更を保存しますか？",
			initialValue: true,
		});

		if (p.isCancel(confirmSave) || !confirmSave) {
			fs.unlinkSync(tmpPath);
			p.log.info("変更をキャンセルしました");
			return;
		}

		// 4. バックアップ作成 → リネーム → 再暗号化
		spinner.start("再暗号化中...");

		// vi/vimヘルプコメントを削除（ファイル先頭から）
		if (editor === "vi" || editor === "vim") {
			let content = fs.readFileSync(tmpPath, "utf-8");
			const markerIndex = content.indexOf(vimHelpMarker);
			if (markerIndex !== -1) {
				// マーカー行の次の改行以降を残す
				const afterMarker = markerIndex + vimHelpMarker.length;
				content = content.substring(afterMarker).replace(/^\n+/, "");
			}
			fs.writeFileSync(tmpPath, content);
		}

		// 元のファイルをバックアップ
		fs.copyFileSync(envFilePath, backupPath);

		try {
			// テンポラリファイルを元のファイルにリネーム
			fs.unlinkSync(envFilePath);
			fs.renameSync(tmpPath, envFilePath);

			// 暗号化
			execSync(`dotenvx encrypt -f ${env.file}`, {
				cwd,
				stdio: "pipe",
				env: dotenvxEnv,
			});

			// 成功したらバックアップを削除
			fs.unlinkSync(backupPath);
			spinner.stop("再暗号化が完了しました");
		} catch (encryptError) {
			// 暗号化失敗時はバックアップから復元
			spinner.stop("暗号化に失敗しました");
			if (fs.existsSync(backupPath)) {
				fs.copyFileSync(backupPath, envFilePath);
				fs.unlinkSync(backupPath);
				p.log.info("元のファイルを復元しました");
			}
			throw encryptError;
		}

		p.note(
			[
				`git add ${env.file}`,
				`git commit -m "chore: ${env.description}設定を更新"`,
				"git push",
				"",
				env.name === "local"
					? "チームメンバーは git pull 後に pnpm dev:setup で反映"
					: "変更はデプロイ時に反映されます",
			].join("\n"),
			"💡 次のステップ"
		);
	} catch (error) {
		spinner.stop("エラーが発生しました");
		// テンポラリファイルを削除
		if (fs.existsSync(tmpPath)) {
			fs.unlinkSync(tmpPath);
		}
		// バックアップも削除
		if (fs.existsSync(backupPath)) {
			fs.unlinkSync(backupPath);
		}
		throw error;
	}
}

/**
 * 環境選択メニューを表示
 */
async function selectEnvironment(): Promise<void> {
	// 利用可能な環境をチェック
	const availableEnvs = ENVIRONMENTS.filter((env) => {
		const envFilePath = path.join(cwd, env.file);
		const hasFile = fs.existsSync(envFilePath);
		const hasKey = getPrivateKey(env.privateKeyEnv) !== null;
		return hasFile && hasKey;
	});

	if (availableEnvs.length === 0) {
		p.log.error("編集可能な環境がありません");
		p.log.info("環境ファイルと秘密鍵が必要です");
		return;
	}

	const envOptions = availableEnvs.map((env) => ({
		value: env.name,
		label: env.description,
		hint: env.file,
	}));

	const selectedEnv = await p.select({
		message: "編集する環境を選択してください",
		options: envOptions,
	});

	if (p.isCancel(selectedEnv)) {
		p.cancel("キャンセルしました");
		return;
	}

	const env = ENVIRONMENTS.find((e) => e.name === selectedEnv);
	if (env) {
		await updateEnvironmentSettings(env);
	}
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
	p.intro("🔧 環境変数設定ウィザード");

	const action = await p.select({
		message: "何をしますか？",
		options: [
			{
				value: "personal",
				label: "個人トークンを設定",
				hint: "GITHUB_TOKEN, API_KEY等",
			},
			{
				value: "environment",
				label: "環境設定を変更",
				hint: "local, staging, production, ci 等",
			},
			{
				value: "status",
				label: "現在の状態を確認",
				hint: "環境変数の設定状況を表示",
			},
		],
	});

	if (p.isCancel(action)) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	switch (action) {
		case "personal":
			await setupPersonalTokens();
			break;
		case "environment":
			await selectEnvironment();
			break;
		case "status":
			showStatus();
			break;
	}

	p.outro("✅ 完了");
}

main().catch((error: unknown) => {
	p.log.error(`エラーが発生しました: ${error}`);
	process.exit(1);
});
