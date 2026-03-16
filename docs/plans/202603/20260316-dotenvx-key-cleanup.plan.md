# dotenvx鍵ローテーション時の古い鍵蓄積問題の修正

## Context

`dotenvx set` や `dotenvx rotate` を実行すると、新しい暗号化鍵が `.env.keys` にカンマ区切りで追記される。古い鍵は自動削除されないため、鍵が蓄積し続ける。

## 問題の本質

dotenvxの**復号**はカンマ区切り鍵を全て試すため動作する。問題は**暗号化/set時**：
- `dotenvx encrypt` / `dotenvx set` は `keypair(existingPrivateKey)` で秘密鍵から公開鍵を再導出する
- カンマ区切り文字列がそのまま渡ると `Invalid private key` エラーになりうる
- `getPrivateKey()` がカンマ区切り文字列をそのまま返すため、自前スクリプト（`env-rotate-secrets.ts`, `env.ts`）で暗号化に使う際に問題が発生する

副次的な問題:
- どの鍵が現在有効か判別困難
- セキュリティ上、露出面積が不要に大きい

## 現状

- `scripts/lib/env-common.ts` の `getPrivateKey()`: `.env.keys` をパースしてカンマ区切り文字列をそのまま返す
- `scripts/env-rotate-secrets.ts` の `rotateDotenvKey()`: `dotenvx rotate` 実行後、古い鍵のクリーンアップなし
- `scripts/env.ts`: 暗号化時に `getPrivateKey()` の値を環境変数に渡す
- `scripts/env-show.ts`: 独自に `getPrivateKey` 相当の実装あり（要確認）
- 各 `.env.{環境名}` ファイルに `DOTENV_PUBLIC_KEY_{ENV}` が記載されている

## 変更内容

### 1. `scripts/lib/env-common.ts` に鍵解決関数を追加

- **`resolvePrivateKey(commaKeys, publicKey)`**: カンマ区切りの秘密鍵文字列から、指定の公開鍵と一致するものを特定して返す
  - `crypto.createECDH('secp256k1')` で秘密鍵→公開鍵を導出。**`getPublicKey("hex", "compressed")`** で66文字のcompressed公開鍵を生成（dotenvxは `eciesjs` の `publicKey.toHex()` = compressed形式を使用）
  - `.env.{環境名}` 内の `DOTENV_PUBLIC_KEY_*` と照合し、一致する秘密鍵を返す
  - 一致する鍵が見つからない場合はnull
- **`getPrivateKey()`** はそのまま維持（生値取得の責務を変えない）
- **`computeCleanedKeys()`**: 全環境について `resolvePrivateKey()` で有効な鍵を特定し、**新しい `.env.keys` 内容を計算して返す純粋関数**（I/Oを行わない）
  - **解決不能なエントリ（対応する `.env.*` ファイルが存在しない等）はそのまま保持する**（鍵を誤削除しない）
  - backup/restore/ファイル書き込みは呼び出し元の責務

### 2. `scripts/env-rotate-secrets.ts` にクリーンアップを統合

- `rotateDotenvKey()` 完了後に `computeCleanedKeys()` で新しい鍵内容を計算
- `rotateWithRecovery()` の保護下（backup/restore）でファイル書き込みを実行（backup名は `.env.keys.cleanup.bak` 等、既存の `.env.keys.bak` と衝突しない名前を使用）
- 非対話モード（`runNonInteractive()`）でもクリーンアップ完了後にログ出力

### 3. `scripts/env-cleanup-keys.ts` スタンドアロンスクリプト作成

- `computeCleanedKeys()` で新しい鍵内容を計算し、**このスクリプトがbackup/原子的更新(temp+rename)/復元を担う**
- `package.json` に `env:cleanup-keys` を追加

### 4. `scripts/env-show.ts` の確認・修正（必要に応じて）

- `getPrivateKey` 相当の独自実装がある場合、`env-common.ts` の共通関数を使うように統一

## タスク概要

| ID | 内容 | 依存 |
|----|------|------|
| 0-0 | TaskCreate一括登録 | - |
| 0-1 | Planファイルリネーム → `docs/plans/202603/20260316-dotenvx-key-cleanup.plan.md` | - |
| 1 | `scripts/lib/env-common.ts` に `resolvePrivateKey()` と `computeCleanedKeys()` を実装 [`general-purpose`] | - |
| 2 | `scripts/env-rotate-secrets.ts` に `rotateWithRecovery()` 内クリーンアップ統合（backup名衝突回避）+ 非対話モード対応 [`general-purpose`] | 1 |
| 3 | `scripts/env-cleanup-keys.ts` スタンドアロンスクリプト + `package.json` 追加 [`general-purpose`] | 1 |
| 4 | `scripts/env-show.ts` の独自鍵取得を `env-common.ts` に統一（必要な場合のみ） [`general-purpose`] | 1 |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | 1,2,3,4 |
| 99-2 | 動作確認 [`Bash`] | 1,2,3,4 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | 99-1, 99-2 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | 99-G |

## 並列実行計画

- タスク1 → 完了後にタスク2, 3, 4を並列実行

## リスク・不明点

- **secp256k1依存**: Node.js標準の `crypto.createECDH('secp256k1')` で公開鍵導出可能（検証済み）。外部ライブラリ不要
- **環境ファイルが存在しない場合**: `resolvePrivateKey()` は公開鍵が取得できない環境をスキップする
- **`.env.keys` の原子的更新**: temp file → rename パターンで中間状態での破損を防止。失敗時はバックアップから復元
- **`.env.keys` はgitignore対象**: コミット対象はスクリプトファイルとpackage.jsonのみ

## 検証・動作確認方法

1. `.env.keys` の任意の環境にダミーの古い鍵をカンマ追記
2. `pnpm env:cleanup-keys` 実行
3. 正しい鍵（公開鍵と一致するもの）だけが残ることを確認
4. `dotenvx get` で各環境の復号が成功することを確認
5. `dotenvx encrypt -f .env.local` 等で再暗号化が成功することを確認（encrypt時のkeypairエラーが起きないこと）
6. 対応する `.env.*` ファイルが存在しない環境の鍵がcleanup後も保持されていることを確認

## 対象ファイル

| ファイル | 変更種別 |
|---------|---------|
| `scripts/lib/env-common.ts` | 関数追加（`resolvePrivateKey`, `computeCleanedKeys`） |
| `scripts/env-rotate-secrets.ts` | クリーンアップ呼び出し追加 |
| `scripts/env-cleanup-keys.ts` | 新規作成 |
| `scripts/env-show.ts` | 共通関数への統一（要確認） |
| `package.json` | `env:cleanup-keys` スクリプト追加 |

## Planレビュー結果

### レビュー1回目
- general-purpose: **MINOR**（getPrivateKeyのシグネチャ、タスク粒度、エラーハンドリング等）
- codex-agent: **MAJOR**（問題の本質誤認、鍵判定アルゴリズム、getPrivateKey責務、原子的更新）
- → Plan修正実施

### レビュー2回目
- codex-agent: **MAJOR**（解決不能エントリの保持、compressed公開鍵形式、backup責務の二重化）
- → Plan修正実施（本版）

全指摘を反映済み。残存MAJOR指摘なし。
