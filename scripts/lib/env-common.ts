/**
 * 環境変数管理の共通処理
 *
 * scripts/env.ts と scripts/env-rotate-secrets.ts で共有される
 * 共通のユーティリティ関数と型定義を提供します。
 */

import crypto from "node:crypto";
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

/**
 * カンマ区切りの秘密鍵文字列から、指定の公開鍵と一致するものを特定して返す
 *
 * @param commaKeys - カンマ区切りの秘密鍵文字列
 * @param publicKey - 照合対象の公開鍵（66文字のcompressed hex）
 * @returns 一致する秘密鍵。見つからない場合はnull
 */
export function resolvePrivateKey(
  commaKeys: string,
  publicKey: string,
): string | null {
  const candidates = commaKeys.split(",");
  for (const candidate of candidates) {
    const privateKey = candidate.trim();
    if (!privateKey) continue;
    try {
      const ecdh = crypto.createECDH("secp256k1");
      ecdh.setPrivateKey(Buffer.from(privateKey, "hex"));
      const derivedPublicKey = ecdh.getPublicKey("hex", "compressed");
      if (derivedPublicKey === publicKey) {
        return privateKey;
      }
    } catch {
      // 不正な鍵フォーマット等はスキップして次の鍵を試す
      continue;
    }
  }
  return null;
}

/**
 * 全環境について resolvePrivateKey() で有効な鍵を特定し、
 * 新しい .env.keys 内容を計算して返す読み取り専用関数
 *
 * ファイル読み取りのみ行い、書き込みは行わない（呼び出し元の責務）
 *
 * @returns content: 新しい .env.keys の内容文字列, changed: 元の内容と異なる場合 true
 */
export function computeCleanedKeys(): { content: string; changed: boolean } {
  if (!fs.existsSync(ENV_KEYS_PATH)) {
    return { content: "", changed: false };
  }

  const originalContent = fs.readFileSync(ENV_KEYS_PATH, "utf-8");
  const lines = originalContent.split("\n");
  const resultLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // コメント行や空行はそのまま保持
    if (!trimmed || trimmed.startsWith("#")) {
      resultLines.push(line);
      continue;
    }

    // DOTENV_PRIVATE_KEY_*=値 形式の行を検出
    const match = trimmed.match(/^(DOTENV_PRIVATE_KEY_([^=]+))=(.*)$/);
    if (!match) {
      resultLines.push(line);
      continue;
    }

    const [, keyName, envNameUpper, rawValue] = match;
    let value = rawValue.trim();
    // クォートを除去
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // カンマが含まれない場合（単一鍵）はそのまま保持
    if (!value.includes(",")) {
      resultLines.push(line);
      continue;
    }

    // 対応する環境名を特定
    const envName = envNameUpper.toLowerCase();
    const envConfig = ENVIRONMENTS.find((e) => e.name === envName);
    if (!envConfig) {
      // ENVIRONMENTS に定義されていない環境はそのまま保持
      resultLines.push(line);
      continue;
    }

    // 対応する .env.{環境名} ファイルから公開鍵を取得
    const envFilePath = path.join(cwd, envConfig.file);
    if (!fs.existsSync(envFilePath)) {
      // .env.{環境名} ファイルが存在しない場合はそのまま保持
      resultLines.push(line);
      continue;
    }

    const envVars = parseEnvFile(envFilePath);
    const publicKeyVarName = `DOTENV_PUBLIC_KEY_${envNameUpper}`;
    const publicKey = envVars[publicKeyVarName];

    if (!publicKey) {
      // 公開鍵が取得できない場合はそのまま保持
      resultLines.push(line);
      continue;
    }

    // resolvePrivateKey で有効な秘密鍵を特定
    const resolved = resolvePrivateKey(value, publicKey);
    if (resolved) {
      resultLines.push(`${keyName}=${resolved}`);
    } else {
      // 見つからない場合はそのまま保持
      resultLines.push(line);
    }
  }

  const content = resultLines.join("\n");
  return { content, changed: content !== originalContent };
}
