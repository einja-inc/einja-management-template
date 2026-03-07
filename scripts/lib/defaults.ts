/**
 * グローバルデフォルトトークン管理ライブラリ
 *
 * ユーザーのホームディレクトリ配下にデフォルトトークンを保存・読み込みする。
 * 保存先: ~/.config/einja/defaults.json（XDG_CONFIG_HOME対応）
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 保存を許可するキーのホワイトリスト */
export const ALLOWED_DEFAULT_KEYS = [
	"VERCEL_TOKEN",
	"NEON_API_KEY",
	"GITHUB_TOKEN",
	"VERCEL_ORG_ID",
] as const;

export type AllowedKey = (typeof ALLOWED_DEFAULT_KEYS)[number];

/** defaults.json のスキーマ */
interface DefaultsFile {
	version: number;
	tokens: Partial<Record<AllowedKey, string>>;
	updatedAt: string;
}

/**
 * 設定ディレクトリのパスを取得
 *
 * 優先順位:
 * 1. XDG_CONFIG_HOME 環境変数
 * 2. APPDATA 環境変数（Windows）
 * 3. ~/.config
 */
function getConfigDir(): string {
	const xdg = process.env.XDG_CONFIG_HOME;
	if (xdg && path.isAbsolute(xdg)) {
		return path.join(xdg, "einja");
	}
	const appData = process.env.APPDATA;
	if (appData && path.isAbsolute(appData)) {
		return path.join(appData, "einja");
	}
	return path.join(os.homedir(), ".config", "einja");
}

/** defaults.json のフルパスを取得 */
function getDefaultsFilePath(): string {
	return path.join(getConfigDir(), "defaults.json");
}

/**
 * キーがホワイトリストに含まれるか判定
 *
 * @param key - 検証するキー名
 * @returns ホワイトリストに含まれる場合 true
 */
function isAllowedKey(key: string): key is AllowedKey {
	return (ALLOWED_DEFAULT_KEYS as readonly string[]).includes(key);
}

/**
 * CI環境かどうかを判定
 *
 * @returns process.env.CI が "true" または "1" の場合 true
 */
function isCI(): boolean {
	return process.env.CI === "true" || process.env.CI === "1";
}

/**
 * デフォルトトークンを読み込む
 *
 * CI環境では常に空オブジェクトを返す。
 * ファイル不在時・JSON破損時は空オブジェクトにフォールバックする。
 *
 * @returns トークンのキーバリューペア
 */
export function loadDefaults(): Record<string, string> {
	if (isCI()) {
		return {};
	}

	const filePath = getDefaultsFilePath();
	try {
		if (!fs.existsSync(filePath)) {
			return {};
		}
		const content = fs.readFileSync(filePath, "utf-8");
		const data: DefaultsFile = JSON.parse(content);
		const raw = data.tokens ?? {};
		const filtered: Record<string, string> = {};
		for (const [key, value] of Object.entries(raw)) {
			if (isAllowedKey(key) && typeof value === "string") {
				filtered[key] = value;
			}
		}
		return filtered;
	} catch (error) {
		if (error instanceof SyntaxError) {
			console.warn(`defaults.json is corrupted (JSON parse error), using empty defaults`);
		} else {
			console.warn(`Failed to load defaults: ${error}`);
		}
		return {};
	}
}

/**
 * デフォルトトークンを保存する
 *
 * ホワイトリスト外のキーは無視される。
 * CI環境では書き込みをスキップする。
 *
 * Note: 対話型CLIからの呼び出しを想定。同時実行は想定外（read-modify-writeのatomicityは保証しない）
 *
 * @param tokens - 保存するトークンのキーバリューペア
 */
function saveDefaults(tokens: Record<string, string>): void {
	if (isCI()) {
		return;
	}

	try {
		const filtered: Record<string, string> = {};
		for (const [key, value] of Object.entries(tokens)) {
			if (isAllowedKey(key)) {
				filtered[key] = value;
			}
		}

		const configDir = getConfigDir();
		fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

		const filePath = getDefaultsFilePath();
		const data: DefaultsFile = {
			version: 1,
			tokens: filtered,
			updatedAt: new Date().toISOString(),
		};

		const tmpPath = filePath + ".tmp";
		try {
			fs.unlinkSync(tmpPath);
		} catch {}
		const fd = fs.openSync(tmpPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC, 0o600);
		try {
			fs.writeSync(fd, JSON.stringify(data, null, "\t"));
		} finally {
			fs.closeSync(fd);
		}
		try {
			fs.renameSync(tmpPath, filePath);
		} catch (renameErr) {
			try { fs.unlinkSync(tmpPath); } catch {}
			throw renameErr;
		}
	} catch (error) {
		console.error("Failed to save defaults:", error);
		return;
	}
}

/**
 * 個別のデフォルトトークンを取得する
 *
 * @param key - 取得するキー名
 * @returns トークンの値。存在しない場合は undefined
 */
export function getDefault(key: AllowedKey): string | undefined {
	const defaults = loadDefaults();
	return defaults[key];
}

/**
 * 個別のデフォルトトークンを設定する
 *
 * ホワイトリスト外のキーは無視される（エラーにはならない）。
 * CI環境では書き込みをスキップする。
 *
 * @param key - 設定するキー名
 * @param value - 設定する値
 */
export function setDefault(key: AllowedKey, value: string): void {
	if (isCI()) {
		return;
	}

	const defaults = loadDefaults();
	defaults[key] = value;
	saveDefaults(defaults);
}
