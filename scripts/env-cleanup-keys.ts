/**
 * dotenvx鍵クリーンアップスクリプト
 *
 * .env.keys に蓄積された古い秘密鍵を削除し、
 * 現在の公開鍵と一致する鍵のみを残す。
 * 使用方法: pnpm env:cleanup-keys
 */

import fs from "node:fs";
import path from "node:path";
import { computeCleanedKeys, ENV_KEYS_PATH } from "./lib/env-common.js";

const cwd = process.cwd();

function main(): void {
  if (!fs.existsSync(ENV_KEYS_PATH)) {
    console.log("ℹ️  .env.keys が見つかりません");
    return;
  }

  const result = computeCleanedKeys();

  if (!result.changed) {
    console.log("✅ クリーンアップ不要：古い鍵は蓄積されていません");
    return;
  }

  const backupPath = path.join(cwd, ".env.keys.cleanup.bak");
  const tmpPath = path.join(cwd, ".env.keys.tmp");

  // バックアップ作成
  fs.copyFileSync(ENV_KEYS_PATH, backupPath);

  try {
    // temp file に書き込み → rename で原子的更新
    fs.writeFileSync(tmpPath, result.content);
    fs.renameSync(tmpPath, ENV_KEYS_PATH);

    // 成功したらバックアップを削除
    fs.unlinkSync(backupPath);

    console.log("✅ .env.keys から古い鍵をクリーンアップしました");
  } catch (error) {
    // temp file が残っていたら削除
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    // バックアップから復元
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, ENV_KEYS_PATH);
      fs.unlinkSync(backupPath);
      console.log("ℹ️  バックアップから .env.keys を復元しました");
    }
    console.error("❌ クリーンアップに失敗しました:", error);
    process.exit(1);
  }
}

main();
