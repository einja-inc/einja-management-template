/**
 * 秘密鍵ローテーションスクリプト
 *
 * AUTH_SECRETとDOTENV_PRIVATE_KEY_*のローテーションを可能にする
 * 使用方法: pnpm env:rotate-secrets
 */

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
	type EnvironmentConfig,
	ENVIRONMENTS,
	getPrivateKey,
	ENV_KEYS_PATH,
	computeCleanedKeys,
} from "./lib/env-common.js";

const cwd = process.cwd();

/**
 * ローテーションタイプ
 */
type RotationType = "auth" | "dotenv" | "both";

/**
 * AUTH_SECRETを生成
 *
 * @returns 生成されたAUTH_SECRET（64文字のランダム16進数文字列）
 */
function generateAuthSecret(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * ローテーションする秘密鍵を選択
 *
 * @returns 選択されたローテーションタイプ
 */
async function selectRotationType(): Promise<RotationType> {
	const rotationType = await p.select({
		message: "ローテーションする秘密鍵を選択してください",
		options: [
			{
				value: "auth" as const,
				label: "AUTH_SECRET",
				hint: "NextAuth署名鍵",
			},
			{
				value: "dotenv" as const,
				label: "DOTENV_PRIVATE_KEY",
				hint: "dotenvx暗号化鍵",
			},
			{
				value: "both" as const,
				label: "両方",
				hint: "AUTH_SECRET と DOTENV_PRIVATE_KEY",
			},
		],
	});

	if (p.isCancel(rotationType)) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	return rotationType;
}

/**
 * 対象環境を選択（複数選択可）
 *
 * @returns 選択された環境の配列
 */
async function selectTargetEnvironments(): Promise<EnvironmentConfig[]> {
	// 利用可能な環境をチェック
	const availableEnvs = ENVIRONMENTS.filter((env) => {
		const envFilePath = path.join(cwd, env.file);
		const hasFile = fs.existsSync(envFilePath);
		const hasKey = getPrivateKey(env.privateKeyEnv) !== null;
		return hasFile && hasKey;
	});

	if (availableEnvs.length === 0) {
		p.log.error("ローテーション可能な環境がありません");
		p.log.info("環境ファイルと秘密鍵が必要です");
		process.exit(1);
	}

	const envOptions = availableEnvs.map((env) => ({
		value: env.name,
		label: env.description,
		hint: env.file,
	}));

	const selectedEnvs = await p.multiselect({
		message: "対象環境を選択してください（スペースで選択、Enterで確定）",
		options: envOptions,
		required: true,
	});

	if (p.isCancel(selectedEnvs)) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	const selected = ENVIRONMENTS.filter((env) =>
		(selectedEnvs as string[]).includes(env.name),
	);

	// 本番環境が含まれる場合は追加確認
	const includesProduction = selected.some((env) => env.name === "production");
	if (includesProduction) {
		p.log.warn("⚠️  本番環境の秘密鍵を変更します");
		const confirmProd = await p.confirm({
			message: "本当に本番環境の秘密鍵を変更しますか？",
			initialValue: false,
		});

		if (p.isCancel(confirmProd) || !confirmProd) {
			p.cancel("キャンセルしました");
			process.exit(0);
		}
	}

	return selected;
}

/**
 * AUTH_SECRETをローテーション
 *
 * @param env - 対象環境
 */
async function rotateAuthSecret(env: EnvironmentConfig): Promise<void> {
	const envFilePath = path.join(cwd, env.file);
	const privateKey = getPrivateKey(env.privateKeyEnv);

	if (!privateKey) {
		throw new Error(
			`.env.keys に ${env.privateKeyEnv} が見つかりません`,
		);
	}

	// dotenvx実行時の環境変数
	const dotenvxEnv = { ...process.env, [env.privateKeyEnv]: privateKey };

	// 復号
	const decrypted = execSync(`dotenvx decrypt -f ${env.file} --stdout`, {
		cwd,
		encoding: "utf-8",
		env: dotenvxEnv,
	});

	// 新しいAUTH_SECRETを生成
	const newAuthSecret = generateAuthSecret();

	// AUTH_SECRET行を置換
	const updatedContent = decrypted.replace(
		/^AUTH_SECRET=.*$/m,
		`AUTH_SECRET=${newAuthSecret}`,
	);

	// テンポラリファイルに書き込み
	const tmpPath = path.join(cwd, `${env.file}.tmp`);
	fs.writeFileSync(tmpPath, updatedContent);

	try {
		// 元のファイルを削除してリネーム
		fs.unlinkSync(envFilePath);
		fs.renameSync(tmpPath, envFilePath);

		// 再暗号化
		execSync(`dotenvx encrypt -f ${env.file}`, {
			cwd,
			stdio: "pipe",
			env: dotenvxEnv,
		});

		p.log.success(`✅ AUTH_SECRET をローテーションしました (${env.name})`);
	} catch (error) {
		// テンポラリファイルを削除
		if (fs.existsSync(tmpPath)) {
			fs.unlinkSync(tmpPath);
		}
		throw error;
	}
}

/**
 * DOTENV_PRIVATE_KEYをローテーション
 *
 * @param env - 対象環境
 */
async function rotateDotenvKey(env: EnvironmentConfig): Promise<void> {
	const envFilePath = path.join(cwd, env.file);
	const privateKey = getPrivateKey(env.privateKeyEnv);

	if (!privateKey) {
		throw new Error(
			`.env.keys に ${env.privateKeyEnv} が見つかりません`,
		);
	}

	// dotenvx実行時の環境変数
	const dotenvxEnv = { ...process.env, [env.privateKeyEnv]: privateKey };

	// dotenvx rotate を実行（新しいキーペアが自動生成され、.env.keysが自動更新される）
	execSync(`dotenvx rotate -f ${env.file}`, {
		cwd,
		stdio: "pipe",
		env: dotenvxEnv,
	});

	p.log.success(`✅ DOTENV_PRIVATE_KEY をローテーションしました (${env.name})`);
}

/**
 * エラー時復元付きでローテーションを実行
 *
 * @param env - 対象環境
 * @param type - ローテーションタイプ
 */
async function rotateWithRecovery(
	env: EnvironmentConfig,
	type: RotationType,
): Promise<void> {
	const envFilePath = path.join(cwd, env.file);
	const backupPath = path.join(cwd, `${env.file}.bak`);
	const keysBackupPath = path.join(cwd, ".env.keys.bak");

	// バックアップ作成
	fs.copyFileSync(envFilePath, backupPath);
	fs.copyFileSync(ENV_KEYS_PATH, keysBackupPath);

	try {
		if (type === "auth" || type === "both") {
			await rotateAuthSecret(env);
		}

		if (type === "dotenv" || type === "both") {
			await rotateDotenvKey(env);
		}

		// dotenvキーローテーション後、古い鍵をクリーンアップ
		if (type === "dotenv" || type === "both") {
			const cleanupResult = computeCleanedKeys();
			if (cleanupResult.changed) {
				const cleanupBackupPath = path.join(cwd, ".env.keys.cleanup.bak");
				fs.copyFileSync(ENV_KEYS_PATH, cleanupBackupPath);
				const cleanupTmpPath = path.join(cwd, ".env.keys.cleanup.tmp");
				try {
					fs.writeFileSync(cleanupTmpPath, cleanupResult.content);
					fs.renameSync(cleanupTmpPath, ENV_KEYS_PATH);
					fs.unlinkSync(cleanupBackupPath);
					p.log.success(`✅ .env.keys から古い鍵をクリーンアップしました (${env.name})`);
				} catch {
					// クリーンアップ失敗時はバックアップから復元
					if (fs.existsSync(cleanupTmpPath)) {
						fs.unlinkSync(cleanupTmpPath);
					}
					if (fs.existsSync(cleanupBackupPath)) {
						fs.copyFileSync(cleanupBackupPath, ENV_KEYS_PATH);
						fs.unlinkSync(cleanupBackupPath);
					}
					p.log.warn(`⚠️ 古い鍵のクリーンアップに失敗しましたが、ローテーション自体は成功しています (${env.name})`);
				}
			}
		}

		// 成功したらバックアップを削除
		fs.unlinkSync(backupPath);
		if (type === "dotenv" || type === "both") {
			fs.unlinkSync(keysBackupPath);
		}
	} catch (error) {
		// エラー発生時はバックアップから復元
		p.log.error(`❌ エラーが発生しました: ${error}`);
		if (fs.existsSync(backupPath)) {
			fs.copyFileSync(backupPath, envFilePath);
			fs.unlinkSync(backupPath);
		}
		if (fs.existsSync(keysBackupPath)) {
			fs.copyFileSync(keysBackupPath, ENV_KEYS_PATH);
			fs.unlinkSync(keysBackupPath);
		}
		p.log.info("元のファイルを復元しました");
		throw error;
	}
}

/**
 * 次のステップを表示
 *
 * @param envs - ローテーションした環境の配列
 */
function showNextSteps(envs: EnvironmentConfig[]): void {
	const envFiles = envs.map((env) => env.file).join(" ");

	p.note(
		[
			`git diff ${envFiles} .env.keys`,
			`git add ${envFiles} .env.keys`,
			'git commit -m "chore: 秘密鍵をローテーション"',
			"",
			".env.keys をチームと共有（1Password等）",
		].join("\n"),
		"💡 次のステップ",
	);
}

/**
 * CLIフラグをパース
 */
function parseArgs(): { all: boolean; nonInteractive: boolean } {
	const args = process.argv.slice(2);
	return {
		all: args.includes("--all"),
		nonInteractive: args.includes("--non-interactive"),
	};
}

/**
 * 非対話モードで全環境のローテーションを実行
 * @einja-inc/create-app のセットアップ時に使用
 *
 * @returns 成功した環境数
 */
async function runNonInteractive(): Promise<number> {
	const rotationType: RotationType = "both";
	let successCount = 0;

	// 利用可能な環境をフィルタ
	const availableEnvs = ENVIRONMENTS.filter((env) => {
		const envFilePath = path.join(cwd, env.file);
		const hasFile = fs.existsSync(envFilePath);
		const hasKey = getPrivateKey(env.privateKeyEnv) !== null;
		return hasFile && hasKey;
	});

	if (availableEnvs.length === 0) {
		console.log("[env:rotate-secrets] ローテーション可能な環境がありません");
		return 0;
	}

	console.log(`[env:rotate-secrets] ${availableEnvs.length}環境の秘密鍵をローテーション中...`);

	for (const env of availableEnvs) {
		try {
			await rotateWithRecovery(env, rotationType);
			successCount++;
			console.log(`[env:rotate-secrets] ✅ ${env.name}: 完了`);
		} catch (error) {
			console.error(`[env:rotate-secrets] ⚠ ${env.name}: 失敗 - ${error}`);
			// 失敗時も続行（中断しない）
		}
	}

	console.log(`[env:rotate-secrets] ${successCount}/${availableEnvs.length}環境のローテーション完了`);
	return successCount;
}

/**
 * 対話モードのメイン処理
 */
async function runInteractive(): Promise<void> {
	p.intro("🔐 秘密鍵ローテーション");

	// ローテーションタイプを選択
	const rotationType = await selectRotationType();

	// 対象環境を選択
	const targetEnvs = await selectTargetEnvironments();

	// 確認
	const proceed = await p.confirm({
		message: "ローテーションを実行しますか？",
		initialValue: true,
	});

	if (p.isCancel(proceed) || !proceed) {
		p.cancel("キャンセルしました");
		process.exit(0);
	}

	const spinner = p.spinner();

	// バックアップを作成中
	spinner.start("バックアップを作成中...");
	await new Promise((resolve) => setTimeout(resolve, 500));
	spinner.stop("バックアップを作成しました");

	// 各環境でローテーション実行
	for (const env of targetEnvs) {
		try {
			await rotateWithRecovery(env, rotationType);
		} catch (error) {
			p.log.error(`${env.name} のローテーションに失敗しました`);
			process.exit(1);
		}
	}

	// 次のステップを表示
	showNextSteps(targetEnvs);

	p.outro("✅ 完了");
}

const flags = parseArgs();

if (flags.all && flags.nonInteractive) {
	runNonInteractive().catch((error: unknown) => {
		console.error(`[env:rotate-secrets] エラー: ${error}`);
		// 非対話モードではprocess.exit(1)を呼ばない（呼び出し元で制御）
	});
} else {
	runInteractive().catch((error: unknown) => {
		p.log.error(`エラーが発生しました: ${error}`);
		process.exit(1);
	});
}
