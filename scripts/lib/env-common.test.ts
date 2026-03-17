// @vitest-environment node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createKeyPair(): { privateKey: string; publicKey: string } {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.generateKeys();

  return {
    privateKey: ecdh.getPrivateKey("hex"),
    publicKey: ecdh.getPublicKey("hex", "compressed"),
  };
}

async function loadEnvCommon() {
  vi.resetModules();
  return import("./env-common");
}

describe("env-common", () => {
  const originalCwd = process.cwd();
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "env-common-"));
    process.chdir(tempRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  describe("computeCleanedKeys", () => {
    it("複数の秘密鍵候補を渡すと、公開鍵と一致する鍵だけが残る", async () => {
      // Given: 2つの秘密鍵候補と、現在有効な公開鍵を持つ .env.local がある
      const staleKeyPair = createKeyPair();
      const activeKeyPair = createKeyPair();
      fs.writeFileSync(
        path.join(tempRoot, ".env.keys"),
        [
          "# cleanup target",
          `DOTENV_PRIVATE_KEY_LOCAL=${staleKeyPair.privateKey},${activeKeyPair.privateKey}`,
          "CUSTOM_VALUE=keep",
          "",
        ].join("\n"),
        "utf-8",
      );
      fs.writeFileSync(
        path.join(tempRoot, ".env.local"),
        `DOTENV_PUBLIC_KEY_LOCAL=${activeKeyPair.publicKey}\n`,
        "utf-8",
      );

      const { computeCleanedKeys } = await loadEnvCommon();

      // When: .env.keys のクリーンアップ結果を計算する
      const result = computeCleanedKeys();

      // Then: 現在有効な秘密鍵だけに絞り込まれる
      expect(result.changed).toBe(true);
      expect(result.content).toContain(
        `DOTENV_PRIVATE_KEY_LOCAL=${activeKeyPair.privateKey}`,
      );
      expect(result.content).not.toContain(staleKeyPair.privateKey);
      expect(result.content).toContain("CUSTOM_VALUE=keep");
    });

    it("対応する環境ファイルが存在しないと、秘密鍵候補の行はそのまま維持される", async () => {
      // Given: 複数候補を持つ .env.keys があるが、対応する .env.local が存在しない
      const firstKeyPair = createKeyPair();
      const secondKeyPair = createKeyPair();
      const originalContent = `DOTENV_PRIVATE_KEY_LOCAL=${firstKeyPair.privateKey},${secondKeyPair.privateKey}\n`;
      fs.writeFileSync(path.join(tempRoot, ".env.keys"), originalContent, "utf-8");

      const { computeCleanedKeys } = await loadEnvCommon();

      // When: .env.keys のクリーンアップ結果を計算する
      const result = computeCleanedKeys();

      // Then: 判定不能なため元の内容が維持される
      expect(result.changed).toBe(false);
      expect(result.content).toBe(originalContent);
    });

    it("未対応の DOTENV_PRIVATE_KEY_* エントリを含むと、その行はそのまま維持される", async () => {
      // Given: ENVIRONMENTS に定義されていない秘密鍵エントリがある
      const firstKeyPair = createKeyPair();
      const secondKeyPair = createKeyPair();
      const originalContent = `DOTENV_PRIVATE_KEY_FUTURE=${firstKeyPair.privateKey},${secondKeyPair.privateKey}\n`;
      fs.writeFileSync(path.join(tempRoot, ".env.keys"), originalContent, "utf-8");

      const { computeCleanedKeys } = await loadEnvCommon();

      // When: .env.keys のクリーンアップ結果を計算する
      const result = computeCleanedKeys();

      // Then: 未対応エントリは削除されず元の内容が維持される
      expect(result.changed).toBe(false);
      expect(result.content).toBe(originalContent);
    });

    it("単一鍵とコメント行や空行を含むと、そのままの内容が維持される", async () => {
      // Given: 単一鍵とコメント行、空行、通常の環境変数行を含む .env.keys がある
      const keyPair = createKeyPair();
      const originalContent = [
        "# comment",
        "",
        `DOTENV_PRIVATE_KEY_LOCAL=${keyPair.privateKey}`,
        "CUSTOM_VALUE=keep",
        "",
      ].join("\n");
      fs.writeFileSync(path.join(tempRoot, ".env.keys"), originalContent, "utf-8");

      const { computeCleanedKeys } = await loadEnvCommon();

      // When: .env.keys のクリーンアップ結果を計算する
      const result = computeCleanedKeys();

      // Then: 単一鍵や非対象行は変更されない
      expect(result.changed).toBe(false);
      expect(result.content).toBe(originalContent);
    });
  });
});
