/**
 * 環境変数設定ウィザード
 *
 * 対話的に環境変数を設定・更新するCLIツール
 * 使用方法: pnpm env
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
	type EnvironmentConfig,
	ENVIRONMENTS,
	parseEnvFile,
	getPrivateKey,
	ENV_KEYS_PATH,
	setEnvValue,
} from "./lib/env-common.js";
import {
	type AllowedKey,
	loadDefaults,
	setDefault,
	getDefault,
	ALLOWED_DEFAULT_KEYS,
} from "./lib/defaults.js";

const cwd = process.cwd();

/** トークンの先頭4文字を表示し、残りをマスクする */
function maskToken(token: string): string {
	if (token.length <= 4) return "***";
	return `${token.slice(0, 4)}...`;
}

// ファイルパス
const ENV_PATH = path.join(cwd, ".env");
const ENV_LOCAL_PATH = path.join(cwd, ".env.local");
const ENV_PERSONAL_PATH = path.join(cwd, ".env.personal");
const ENV_PERSONAL_EXAMPLE_PATH = path.join(cwd, ".env.personal.example");

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
		const masked = value ? maskToken(value) : "-";
		console.log(`   ${key}: ${status} (${masked})`);
	}

	const defaults = loadDefaults();
	const defaultCount = Object.values(defaults).filter((v) => v).length;
	console.log("");
	console.log(
		`   デフォルトトークン: ${defaultCount > 0 ? `✅ ${defaultCount}個設定済み` : "❌ 未設定"}`
	);
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

	// デフォルトトークンが存在する場合、適用を提案
	const personalDefaults = loadDefaults();
	const hasDefaults = ["GITHUB_TOKEN", "VERCEL_TOKEN", "NEON_API_KEY"].some(
		(key) => personalDefaults[key],
	);

	if (hasDefaults) {
		const useDefaults = await p.confirm({
			message:
				"組織共通のデフォルトトークンを使用しますか？",
			initialValue: true,
		});

		if (p.isCancel(useDefaults)) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}

		if (useDefaults) {
			// デフォルトを適用（既存値があるキーはスキップ）
			const currentEnv = parseEnvFile(ENV_PERSONAL_PATH);
			for (const key of [
				"GITHUB_TOKEN",
				"VERCEL_TOKEN",
				"NEON_API_KEY",
			] as const) {
				const val = personalDefaults[key];
				if (val) {
					if (currentEnv[key]) {
						p.log.info(`${key} は既に設定済みのためスキップしました`);
					} else {
						setEnvValue(ENV_PERSONAL_PATH, key, val);
						p.log.success(`${key} をデフォルトから設定しました`);
					}
				}
			}
			// デフォルト適用後、GITHUB_TOKENが設定されていれば完了
			const updatedEnv = parseEnvFile(ENV_PERSONAL_PATH);
			if (updatedEnv.GITHUB_TOKEN) {
				p.note(
					"direnv allow を実行するか、新しいターミナルを開くと反映されます",
					"💡 次のステップ"
				);
				return;
			}
			// GITHUB_TOKENが未設定なら手動入力フローへ
		}
		// デフォルトを使わない場合は手動入力フローへ
	}

	// GITHUB_TOKEN
	const currentEnv = parseEnvFile(ENV_PERSONAL_PATH);
	const currentGithubToken = currentEnv.GITHUB_TOKEN;
	const githubTokenStatus = currentGithubToken
		? `現在: ${maskToken(currentGithubToken)}`
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
				const res = await fetch("https://api.github.com/user", {
					headers: { Authorization: `token ${token}` },
				});
				await res.text();
				if (res.ok) {
					p.log.success("✅ トークンの検証に成功しました");
				} else {
					p.log.warn(`⚠️ トークンの検証に失敗しました (HTTP ${res.status})`);
				}
			} catch {
				p.log.warn("⚠️ トークンの検証をスキップしました");
			}

			// デフォルトへの保存を提案
			if (token && !getDefault("GITHUB_TOKEN")) {
				const saveAsDefault = await p.confirm({
					message:
						"このトークンをデフォルトに保存しますか？（他のプロジェクトでも使用可能になります）",
					initialValue: true,
				});

				if (!p.isCancel(saveAsDefault) && saveAsDefault) {
					setDefault("GITHUB_TOKEN", token);
					p.log.success("デフォルトに保存しました");
				}
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
 * デフォルトトークン管理メニュー
 */
async function manageDefaults(): Promise<void> {
	const current = loadDefaults();

	// 現在の状態を表示
	p.note(
		[
			"📁 保存先: ~/.config/einja/defaults.json",
			"",
			...ALLOWED_DEFAULT_KEYS.map((key) => {
				const val = current[key];
				return val
					? `  ✅ ${key}: ${maskToken(val)}`
					: `  ❌ ${key}: 未設定`;
			}),
		].join("\n"),
		"デフォルトトークンの状態"
	);

	const action = await p.select({
		message: "操作を選択してください",
		options: [
			{
				value: "set",
				label: "トークンを設定/更新",
				hint: "個別にトークンを入力",
			},
			{
				value: "apply",
				label: "プロジェクトに適用",
				hint: "デフォルトを .env.personal にコピー",
			},
			{
				value: "verify",
				label: "トークンを検証",
				hint: "API接続テスト",
			},
		],
	});

	if (p.isCancel(action)) {
		p.cancel("キャンセルしました");
		return;
	}

	switch (action) {
		case "set":
			await setDefaultTokens();
			break;
		case "apply":
			await applyDefaultsToProject();
			break;
		case "verify":
			await verifyDefaultTokens();
			break;
	}
}

/**
 * デフォルトトークンを個別に設定/更新
 */
async function setDefaultTokens(): Promise<void> {
	const tokenConfigs = [
		{
			key: "VERCEL_TOKEN",
			label: "Vercel Token",
			url: "https://vercel.com/account/tokens",
			hint: "Scope: Full Account",
		},
		{
			key: "NEON_API_KEY",
			label: "Neon API Key",
			url: "https://console.neon.tech/app/settings/api-keys",
			hint: "",
		},
		{
			key: "GITHUB_TOKEN",
			label: "GitHub Token",
			url: "https://github.com/settings/tokens/new",
			hint: "スコープ: repo, read:org",
		},
		{
			key: "VERCEL_ORG_ID",
			label: "Vercel Org ID",
			url: "",
			hint: "apps/web/.vercel/project.json の orgId",
		},
	];

	for (const config of tokenConfigs) {
		const current = getDefault(config.key as AllowedKey);
		const status = current
			? `現在: ${maskToken(current)}`
			: "未設定";

		const update = await p.confirm({
			message: `${config.label} を設定しますか？ (${status})`,
			initialValue: !current,
		});

		if (p.isCancel(update)) {
			p.cancel("キャンセルしました");
			return;
		}

		if (update) {
			if (config.url) {
				p.log.info(`取得方法: ${config.url}`);
			}
			if (config.hint) {
				p.log.info(config.hint);
			}

			const value =
				config.key === "VERCEL_ORG_ID"
					? await p.text({
							message: `${config.label}:`,
							placeholder: "team_...",
						})
					: await p.password({ message: `${config.label}:` });

			if (p.isCancel(value)) {
				p.cancel("キャンセルしました");
				return;
			}

			if (value) {
				setDefault(config.key as AllowedKey, value);
				p.log.success(
					`${config.label} をデフォルトに保存しました`
				);
			}
		}
	}
}

/**
 * デフォルトトークンをプロジェクトの .env.personal に適用
 */
async function applyDefaultsToProject(): Promise<void> {
	const defaults = loadDefaults();
	const availableKeys = Object.entries(defaults).filter(([, v]) => v);

	if (availableKeys.length === 0) {
		p.log.warn(
			"デフォルトトークンが設定されていません。先に「トークンを設定/更新」を実行してください"
		);
		return;
	}

	// .env.personal がなければ作成
	if (!fs.existsSync(ENV_PERSONAL_PATH)) {
		if (fs.existsSync(ENV_PERSONAL_EXAMPLE_PATH)) {
			fs.copyFileSync(ENV_PERSONAL_EXAMPLE_PATH, ENV_PERSONAL_PATH);
		} else {
			fs.writeFileSync(ENV_PERSONAL_PATH, "# 個人用トークン\n");
		}
		p.log.success(".env.personal を作成しました");
	}

	const current = parseEnvFile(ENV_PERSONAL_PATH);
	const applyKeys = ["VERCEL_TOKEN", "NEON_API_KEY", "GITHUB_TOKEN"];

	for (const key of applyKeys) {
		const defaultVal = defaults[key];
		if (!defaultVal) continue;

		const currentVal = current[key];
		const status = currentVal
			? `現在: ${maskToken(currentVal)}`
			: "未設定";

		const apply = await p.confirm({
			message: `${key} にデフォルト値（${maskToken(defaultVal)}）を適用しますか？ (${status})`,
			initialValue: !currentVal,
		});

		if (p.isCancel(apply)) {
			p.cancel("キャンセルしました");
			return;
		}

		if (apply) {
			setEnvValue(ENV_PERSONAL_PATH, key, defaultVal);
			p.log.success(`${key} を .env.personal に適用しました`);
		}
	}

	p.note(
		"direnv allow を実行するか、新しいターミナルを開くと反映されます",
		"💡 次のステップ"
	);
}

/**
 * デフォルトトークンをAPI接続テストで検証
 */
async function verifyDefaultTokens(): Promise<void> {
	const defaults = loadDefaults();
	const spinner = p.spinner();

	// GITHUB_TOKEN検証
	const githubToken = defaults.GITHUB_TOKEN;
	if (githubToken) {
		spinner.start("GITHUB_TOKEN を検証中...");
		try {
			const res = await fetch("https://api.github.com/user", {
				headers: { Authorization: `token ${githubToken}` },
			});
			await res.text();
			if (res.ok) {
				spinner.stop("✅ GITHUB_TOKEN: 有効");
			} else {
				spinner.stop(`⚠️ GITHUB_TOKEN: 無効 (HTTP ${res.status})`);
			}
		} catch {
			spinner.stop("⚠️ GITHUB_TOKEN: 検証失敗");
		}
	} else {
		p.log.warn("GITHUB_TOKEN: 未設定");
	}

	// VERCEL_TOKEN検証
	const vercelToken = defaults.VERCEL_TOKEN;
	if (vercelToken) {
		spinner.start("VERCEL_TOKEN を検証中...");
		try {
			const res = await fetch("https://api.vercel.com/v2/user", {
				headers: { Authorization: `Bearer ${vercelToken}` },
			});
			await res.text();
			if (res.ok) {
				spinner.stop("✅ VERCEL_TOKEN: 有効");
			} else {
				spinner.stop(`⚠️ VERCEL_TOKEN: 無効 (HTTP ${res.status})`);
			}
		} catch {
			spinner.stop("⚠️ VERCEL_TOKEN: 検証失敗");
		}
	} else {
		p.log.warn("VERCEL_TOKEN: 未設定");
	}

	// NEON_API_KEY検証
	const neonKey = defaults.NEON_API_KEY;
	if (neonKey) {
		spinner.start("NEON_API_KEY を検証中...");
		try {
			const res = await fetch("https://console.neon.tech/api/v2/projects", {
				headers: { Authorization: `Bearer ${neonKey}` },
			});
			await res.text();
			if (res.ok) {
				spinner.stop("✅ NEON_API_KEY: 有効");
			} else {
				spinner.stop(`⚠️ NEON_API_KEY: 無効 (HTTP ${res.status})`);
			}
		} catch {
			spinner.stop("⚠️ NEON_API_KEY: 検証失敗");
		}
	} else {
		p.log.warn("NEON_API_KEY: 未設定");
	}
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
		const decryptResult = spawnSync("dotenvx", ["decrypt", "-f", env.file, "--stdout"], {
			cwd,
			encoding: "utf-8",
			env: dotenvxEnv,
		});
		if (decryptResult.error || decryptResult.status !== 0) {
			throw decryptResult.error ?? new Error(decryptResult.stderr?.toString() || "dotenvx decrypt failed");
		}
		const decrypted = decryptResult.stdout;
		fs.writeFileSync(tmpPath, decrypted, { mode: 0o600 });
		spinner.stop(`${env.file} を復号しました`);

		// 2. エディタで開く
		const editorEnv = (process.env.EDITOR || "vi").trim();
		const [editorBin, ...editorArgs] = editorEnv.split(/\s+/);

		// vi/vimの場合はファイル先頭に使い方ヘルプをコメントとして追加
		const vimHelpMarker = "# === ↓↓↓ ここから下を編集（この行より上は保存時に自動削除）↓↓↓ ===";
		if (editorBin === "vi" || editorBin === "vim") {
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
			fs.writeFileSync(tmpPath, vimHelp + currentContent, { mode: 0o600 });
		}

		p.log.info(`${editorEnv} で ${env.file}.tmp を開きます...`);

		const editResult = spawnSync(editorBin, [...editorArgs, `${env.file}.tmp`], {
			cwd,
			stdio: "inherit",
		});
		if (editResult.error || editResult.status !== 0) {
			try { fs.unlinkSync(tmpPath); } catch {}
			throw editResult.error ?? new Error(`エディタが異常終了しました (exit ${editResult.status})`);
		}

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
		if (editorBin === "vi" || editorBin === "vim") {
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
			const encryptResult = spawnSync("dotenvx", ["encrypt", "-f", env.file], {
				cwd,
				stdio: "pipe",
				env: dotenvxEnv,
			});
			if (encryptResult.error || encryptResult.status !== 0) {
				throw encryptResult.error ?? new Error(encryptResult.stderr?.toString() || "dotenvx encrypt failed");
			}

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
				value: "defaults",
				label: "デフォルトトークン管理",
				hint: "組織共通トークンの設定・確認",
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
		case "defaults":
			await manageDefaults();
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
