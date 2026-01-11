/**
 * 環境変数表示スクリプト（非対話式）
 *
 * 指定した環境の.envファイルを復号して表示
 * 使用方法:
 *   pnpm env:show           → .env.local
 *   pnpm env:show staging   → .env.staging
 *   pnpm env:show production → .env.production
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const ENV_KEYS_PATH = path.join(cwd, ".env.keys");

interface EnvironmentConfig {
  name: string;
  file: string;
  privateKeyEnv: string;
}

const ENVIRONMENTS: EnvironmentConfig[] = [
  { name: "local", file: ".env.local", privateKeyEnv: "DOTENV_PRIVATE_KEY_LOCAL" },
  { name: "development", file: ".env.development", privateKeyEnv: "DOTENV_PRIVATE_KEY_DEVELOPMENT" },
  { name: "staging", file: ".env.staging", privateKeyEnv: "DOTENV_PRIVATE_KEY_STAGING" },
  { name: "preview", file: ".env.preview", privateKeyEnv: "DOTENV_PRIVATE_KEY_PREVIEW" },
  { name: "production", file: ".env.production", privateKeyEnv: "DOTENV_PRIVATE_KEY_PRODUCTION" },
  { name: "ci", file: ".env.ci", privateKeyEnv: "DOTENV_PRIVATE_KEY_CI" },
];

function parseEnvFile(filePath: string): Record<string, string> {
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

function getPrivateKey(privateKeyEnv: string): string | null {
  if (!fs.existsSync(ENV_KEYS_PATH)) {
    return null;
  }
  const keys = parseEnvFile(ENV_KEYS_PATH);
  return keys[privateKeyEnv] || null;
}

function showUsage(): void {
  console.log("使用方法: pnpm env:show [環境名]");
  console.log("");
  console.log("環境名:");
  for (const env of ENVIRONMENTS) {
    console.log(`  ${env.name.padEnd(12)} → ${env.file}`);
  }
  console.log("");
  console.log("例:");
  console.log("  pnpm env:show            # .env.local を表示");
  console.log("  pnpm env:show staging    # .env.staging を表示");
}

function main(): void {
  const arg = process.argv[2];

  // ヘルプ
  if (arg === "-h" || arg === "--help") {
    showUsage();
    process.exit(0);
  }

  // 環境を特定
  const envName = arg || "local";
  const env = ENVIRONMENTS.find((e) => e.name === envName);

  if (!env) {
    console.error(`❌ 不明な環境: ${envName}`);
    console.error("");
    showUsage();
    process.exit(1);
  }

  const envFilePath = path.join(cwd, env.file);

  if (!fs.existsSync(envFilePath)) {
    console.error(`❌ ${env.file} が見つかりません`);
    process.exit(1);
  }

  const privateKey = getPrivateKey(env.privateKeyEnv);
  if (!privateKey) {
    console.error(`❌ .env.keys に ${env.privateKeyEnv} が見つかりません`);
    console.error("   チームから .env.keys を共有してもらってください");
    process.exit(1);
  }

  // dotenvx で復号
  try {
    const decrypted = execSync(`dotenvx decrypt -f ${env.file} --stdout`, {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, [env.privateKeyEnv]: privateKey },
    });
    console.log(decrypted);
  } catch (error) {
    console.error("❌ 復号に失敗しました");
    console.error(error);
    process.exit(1);
  }
}

main();
