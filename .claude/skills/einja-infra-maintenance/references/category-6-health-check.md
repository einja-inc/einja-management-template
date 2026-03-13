# カテゴリ6: 環境状態確認（ヘルスチェック）

## 目次
- [概要](#概要)
- [チェック対象](#チェック対象)
- [結果表示](#結果表示)
- [推奨アクション提案](#推奨アクション提案)
- [参照ドキュメント](#参照ドキュメント)

## 概要

包括的な環境ヘルスチェックを実行する。Phase 1で既に実行済みのローカル環境チェック（envファイル、CLIツール、Docker、トークン検証等）は**再実行しない**。Phase 1の検出結果を前提として再利用し、外部サービスの確認のみ追加実行する。

## チェック対象

### ローカル環境（Phase 1結果を再利用）

Phase 1で検出済みの以下の結果をそのまま使用する（再実行不要）:
- 環境変数ファイルの存在確認
- 旧名envファイル検出
- CLIツールの存在確認
- Docker/PostgreSQL状態
- 開発サーバー状態
- デフォルトトークン設定状況
- トークン有効性検証

### 外部サービス確認（追加実行）

#### Vercel
```bash
vercel ls --scope $VERCEL_TEAM_SLUG
```

#### Neon
```bash
neonctl branches list --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID
```

#### GitHub
```bash
gh secret list
gh run list --limit 5
```

## 結果表示

Phase 1の結果と外部サービスの確認結果を統合し、以下の形式でサマリー表示する:

```
=== 環境ヘルスチェック結果 ===

📦 ローカル環境
  ✅ Node.js 22.16.0
  ✅ pnpm 10.14.0
  ✅ PostgreSQL 起動中
  ✅ 開発サーバー 起動中 (port 3195)
  ❌ .env.personal 不在

🔧 CLI ツール
  ✅ gh 2.x
  ✅ vercel 37.x
  ❌ neonctl 未インストール
  ✅ dotenvx 1.x

🔑 デフォルトトークン
  ✅ VERCEL_TOKEN 設定済み
  ✅ NEON_API_KEY 設定済み
  ✅ GITHUB_TOKEN 設定済み
  ❌ VERCEL_ORG_ID 未設定

🔑 トークン有効性
  ✅ GITHUB_TOKEN 有効
  ✅ VERCEL_TOKEN 有効
  ⚠️ NEON_API_KEY 未設定

☁️ Vercel
  ✅ 最新デプロイ: 2h ago (Ready)

🗄️ Neon
  ✅ ブランチ: 3個 (main, development, preview/feature-auth)

🔐 GitHub Secrets
  ✅ 10個のSecrets設定済み
  ✅ 最新CI: 成功 (2h ago)
```

## 推奨アクション提案

ヘルスチェック結果に❌がある場合、以下のルールで推奨アクションを提示する:

| 検出結果 | 推奨アクション |
|---------|--------------|
| `.env.keys`不在 / CLI未インストール | → カテゴリ1（ローカル環境セットアップ） |
| `.env.personal`不在 / トークン未設定 | → カテゴリ2（環境変数管理 > 個人トークン設定） |
| トークン無効/期限切れ | → カテゴリ2（環境変数管理 > 個人トークン再設定） |
| Vercel未リンク / デプロイエラー | → カテゴリ3（Vercel管理） |
| Neonブランチ取得失敗 | → カテゴリ4（Neon管理） |
| GitHub Secrets不足 | → カテゴリ5（GitHub Secrets管理） |
| CI失敗 | → カテゴリ7（GitHub Actions CI/CD管理 > 失敗調査） |
| デフォルトトークン未設定 | → カテゴリ8（デフォルトトークン管理） |

❌が3個以上の場合は「初期セットアップが必要です。カテゴリ1を実行してください」と表示。

## 参照ドキュメント
- `docs/einja/instructions/local-server-environment-and-worktree.md`（包括的ヘルスチェック）
