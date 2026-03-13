# カテゴリ8: デフォルトトークン管理

## 概要

組織共通のトークン（`dev@einja.net` アカウント）をグローバルデフォルトとして `~/.config/einja/defaults.json` に保存し、複数プロジェクトで再利用する機能。

> **クイック操作**: `pnpm env` → 「デフォルトトークン管理」を選択

## サブメニュー
- **トークンを設定/更新**: 個別にデフォルトトークンを入力
- **プロジェクトに適用**: デフォルトを `.env.personal` にコピー
- **トークンを検証**: API接続テスト

## 管理対象トークン

| キー | 用途 | 取得先 |
|------|------|--------|
| `VERCEL_TOKEN` | Vercel CLI認証 | https://vercel.com/account/tokens |
| `NEON_API_KEY` | Neon CLI認証 | https://console.neon.tech/app/settings/api-keys |
| `GITHUB_TOKEN` | GitHub API認証 | https://github.com/settings/tokens/new |
| `VERCEL_ORG_ID` | Vercel組織ID | `apps/*/.vercel/project.json` の `orgId` |

## 実行手順

### トークンを設定/更新
1. `pnpm env` → 「デフォルトトークン管理」→「トークンを設定/更新」
2. 各トークンについて設定するか確認（現在値をマスク表示）
3. 入力されたトークンを `~/.config/einja/defaults.json` に保存

### プロジェクトに適用
1. 「プロジェクトに適用」を選択
2. 各トークンについて `.env.personal` への適用を確認
3. 承認されたトークンのみ `.env.personal` に書き込み

### トークンを検証
各トークンのAPIエンドポイントに接続テスト:
- `GITHUB_TOKEN`: `https://api.github.com/user`
- `VERCEL_TOKEN`: `https://api.vercel.com/v2/user`
- `NEON_API_KEY`: `https://console.neon.tech/api/v2/projects`

## トークン参照の優先順位

```
プロジェクト .env.personal  >  グローバルデフォルト (~/.config/einja/defaults.json)
```

## セキュリティ

| 項目 | 詳細 |
|------|------|
| 保存形式 | プレーンテキスト JSON（`.env.personal` と同等のリスクレベル） |
| ディレクトリ権限 | `~/.config/einja/` を `0700` で作成 |
| ファイル権限 | `defaults.json` を `0600` で作成 |
| CI環境 | `process.env.CI` が truthy の場合、読み書きともにスキップ |

## 参照ドキュメント
- `docs/einja/instructions/environment-setup.md`
- `docs/einja/steering/infrastructure/environment-variables.md`
