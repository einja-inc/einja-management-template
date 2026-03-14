/**
 * 環境変数管理の共通処理
 *
 * scripts/env.ts と scripts/env-rotate-secrets.ts で共有される
 * 共通のユーティリティ関数と型定義を提供します。
 */

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

/** 環境変数ファイルのパス */
export const ENV_KEYS_PATH = path.join(cwd, ".env.keys");

/**
 * 環境設定の定義
 */
export interface EnvironmentConfig {
  name: string;
  file: string;
  privateKeyEnv: string;
  description: string;
}

/**
 * サポートされる環境の定義
 */
export const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    name: "local",
    file: ".env.local",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_LOCAL",
    description: "ローカル開発環境",
  },
  {
    name: "develop",
    file: ".env.develop",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_DEVELOP",
    description: "開発環境",
  },
  {
    name: "staging",
    file: ".env.staging",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_STAGING",
    description: "ステージング環境",
  },
  {
    name: "preview",
    file: ".env.preview",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_PREVIEW",
    description: "プレビュー環境",
  },
  {
    name: "production",
    file: ".env.production",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_PRODUCTION",
    description: "本番環境",
  },
  {
    name: "ci",
    file: ".env.ci",
    privateKeyEnv: "DOTENV_PRIVATE_KEY_CI",
    description: "CI環境",
  },
];

/**
 * 環境変数ファイルを読み込んでパース
 *
 * @param filePath - パースする環境変数ファイルのパス
 * @returns 環境変数のキーバリューペア
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // クォートを除去
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

/**
 * .env.keysから指定された環境の秘密鍵を取得
 *
 * @param privateKeyEnv - 秘密鍵の環境変数名（例: DOTENV_PRIVATE_KEY_LOCAL）
 * @returns 秘密鍵の値。見つからない場合はnull
 */
export function getPrivateKey(privateKeyEnv: string): string | null {
  if (!fs.existsSync(ENV_KEYS_PATH)) {
    return null;
  }
  const keys = parseEnvFile(ENV_KEYS_PATH);
  return keys[privateKeyEnv] || null;
}

/**
 * 環境変数ファイルに値を設定
 *
 * @param filePath - 環境変数ファイルのパス
 * @param key - 設定する環境変数のキー名
 * @param value - 設定する値
 */
export function setEnvValue(filePath: string, key: string, value: string): void {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }

  // 正規表現メタキャラクタをエスケープ
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedKey}=.*$`, "gm");
  const replaced = content.replace(regex, () => `${key}=${value}`);
  if (replaced !== content) {
    content = replaced;
  } else {
    content = content.trim() + `\n${key}=${value}\n`;
  }

  fs.writeFileSync(filePath, content);
}
