# デプロイセットアップ手順

本番環境へのデプロイに必要な設定手順をまとめたドキュメントです。

設計方針については以下を参照してください：
- [デプロイメント・CI/CD設計方針](../steering/infrastructure/deployment.md)
- [環境変数設計方針](../steering/infrastructure/environment-variables.md)

---

## 目次

1. [必要なSecrets一覧](#1-必要なsecrets一覧)
2. [データベース設定](#2-データベース設定)
3. [Vercel設定](#3-vercel設定)
4. [Turborepo Remote Cache設定](#4-turborepo-remote-cache設定)
5. [Railway設定](#5-railway設定)
6. [GitHub Secrets登録](#6-github-secrets登録)
7. [Docker設定](#7-docker設定)
8. [動作確認](#8-動作確認)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. 必要なSecrets一覧

### 必須Secrets

| 変数名 | 説明 | 用途 | GitHub Actions | Vercel |
|--------|------|------|:--------------:|:------:|
| `DOTENV_PRIVATE_KEY_CI` | CI環境用復号鍵 | CI/CD | ◯ | - |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | 本番環境用復号鍵 | ビルド | ◯ | ◯ |
| `TURBO_TOKEN` | Turborepo Remote Cacheトークン | ビルド高速化 | ◯ | - |
| `TURBO_TEAM` | VercelチームID | ビルド高速化 | ◯ | - |

### オプション（手動デプロイ・拡張用）

| 変数名 | 説明 | 用途 | GitHub Actions | Vercel |
|--------|------|------|:--------------:|:------:|
| `VERCEL_TOKEN` | Vercelデプロイトークン | 手動デプロイ | ◯ | - |
| `VERCEL_ORG_ID` | Vercel組織ID | 手動デプロイ | ◯ | - |
| `VERCEL_WEB_PROJECT_ID` | webプロジェクトID | 手動デプロイ | ◯ | - |
| `RAILWAY_TOKEN` | Railway APIトークン | Railwayデプロイ | ◯ | - |
| `RAILWAY_SERVICE_ID` | RailwayサービスID | Railwayデプロイ | ◯ | - |

---

## 2. データベース設定

### Supabase（推奨）

```bash
# 1. https://supabase.com でアカウント作成

# 2. 「New Project」でプロジェクト作成
#    - Region: Northeast Asia (Tokyo)
#    - Database Password: 設定してメモ

# 3. Settings > Database > Connection string > URI をコピー

# 4. [YOUR-PASSWORD] を設定したパスワードに置換
```

### Neon

```bash
# 1. https://neon.tech でアカウント作成
# 2. 「Create a project」でプロジェクト作成
# 3. Connection Details > Connection string をコピー
```

### Vercel Postgres

```bash
# 1. Vercel Dashboard > Storage > Create Database > Postgres
# 2. 作成後、Connect タブから接続文字列を取得
```

---

## 3. Vercel設定

### プロジェクト作成

```bash
# 1. https://vercel.com でGitHubアカウントでログイン

# 2. 「Add New...」>「Project」でGitHubリポジトリを選択

# 3. 設定:
#    - Project Name: 任意（例: einja-web）
#    - Root Directory: apps/web
#    - Framework Preset: Next.js
#    - Build Command: cd ../.. && npx turbo run build --filter=web
#    - Output Directory: .next
#    - Install Command: pnpm install

# 4. 「Deploy」をクリック
```

### 環境変数設定

Vercel Dashboard > 対象プロジェクト > Settings > Environment Variables

| Key | Value | Environment |
|-----|-------|-------------|
| `DOTENV_PRIVATE_KEY_PRODUCTION` | `.env.keys`から取得 | Production |
| `DATABASE_URL` | 暗号化ファイルに含まれる | - |
| `NEXTAUTH_SECRET` | 暗号化ファイルに含まれる | - |

### ローカルからのVercel CLI操作

```bash
# Vercel CLIインストール
npm i -g vercel

# プロジェクトリンク
cd apps/web
vercel link

# プレビューデプロイ
vercel

# 本番デプロイ
vercel --prod
```

---

## 4. Turborepo Remote Cache設定

### Step 1: Turboアカウントログイン

```bash
npx turbo login
# ブラウザが開き、Vercelにログインを求められます
```

### Step 2: プロジェクトをリンク

```bash
npx turbo link
# プロンプトでVercelの組織/チームを選択
# リンク完了すると .turbo/config.json が生成されます
```

### Step 3: トークン取得

```bash
# TURBO_TOKEN: Vercel Dashboard > Account Settings > Tokens > Create Token
# トークン名: einja-ci-turbo-token
# Scope: Full Access（またはプロジェクト限定）

# TURBO_TEAM: .turbo/config.json から取得
cat .turbo/config.json
# {"teamId": "team_xxxxxxxxx", "apiUrl": "https://vercel.com/api"}
# teamId の値が TURBO_TEAM
```

### Step 4: GitHub Secretsに登録

```bash
gh secret set TURBO_TOKEN --body "取得したトークン"
gh secret set TURBO_TEAM --body "team_xxxxxxxxx"
```

---

## 5. Railway設定

### プロジェクト作成

```bash
# 1. https://railway.app でGitHubアカウントでログイン
# 2. 「New Project」>「Deploy from GitHub repo」
# 3. リポジトリを選択
# 4. Root Directory: apps/cron-worker
# 5. Variables タブで環境変数を設定
```

### railway.toml設定

**配置場所**: `apps/cron-worker/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/cron-worker/Dockerfile"

[deploy]
startCommand = "echo 'Cron worker deployed'"

# Cronジョブ定義
[[crons]]
command = "pnpm job:cleanup"
schedule = "0 0 * * *"  # 毎日午前0時

[[crons]]
command = "pnpm job:email-digest"
schedule = "0 9 * * *"  # 毎日午前9時

[[crons]]
command = "pnpm job:health-check"
schedule = "*/5 * * * *"  # 5分ごと
```

### Railway CLI操作

```bash
# Railway CLIインストール
npm i -g @railway/cli

# ログイン
railway login

# プロジェクトリンク
cd apps/cron-worker
railway link

# デプロイ
railway up

# 環境変数確認
railway variables

# 環境変数追加
railway variables set DATABASE_URL=postgresql://...
```

### GitHub Actionsからの自動デプロイ（オプション）

```bash
# Railway Dashboard > Account Settings > Tokens > Create Token
gh secret set RAILWAY_TOKEN --body "取得したトークン"

# Service > Settings > Service ID
gh secret set RAILWAY_SERVICE_ID --body "サービスID"
```

---

## 6. GitHub Secrets登録

### 登録手順

```bash
# 1. GitHub リポジトリ > Settings > Secrets and variables > Actions
# 2. 「New repository secret」で以下を追加

# 必須
gh secret set DOTENV_PRIVATE_KEY_CI --body "$(grep DOTENV_PRIVATE_KEY_CI .env.keys | cut -d= -f2)"
gh secret set TURBO_TOKEN --body "取得したトークン"
gh secret set TURBO_TEAM --body "team_xxxxxxxxx"

# オプション（手動デプロイ用）
gh secret set VERCEL_TOKEN --body "取得したトークン"
gh secret set VERCEL_ORG_ID --body "team_xxxxxxxxx"
gh secret set VERCEL_WEB_PROJECT_ID --body "prj_xxxxxxxxx"
```

### 登録確認

```bash
gh secret list
```

---

## 7. Docker設定

### Dockerfile（Cron Worker用）

**配置場所**: `apps/cron-worker/Dockerfile`

```dockerfile
FROM node:20-alpine AS base

# pnpmインストール
RUN npm install -g pnpm@8

# 依存関係インストール
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cron-worker/package.json ./apps/cron-worker/
COPY packages/*/package.json ./packages/
RUN pnpm install --frozen-lockfile

# ビルド
FROM base AS build
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
RUN pnpm turbo run build --filter=cron-worker

# 実行環境
FROM base AS runner
WORKDIR /app
COPY --from=build /app/apps/cron-worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production

CMD ["echo", "Cron worker ready"]
```

### Docker Compose（ローカル開発用）

**配置場所**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${POSTGRES_PORT:-35432}:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: einja
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 8. 動作確認

### Vercel

```bash
# デプロイ完了後、生成されたURLにアクセス
# ログイン機能が動作することを確認
```

### GitHub Actions

```bash
# PRを作成してCIが実行されることを確認
# Remote Cacheが有効な場合、ログに以下が表示される
# >>> TURBO Turborepo Remote Cache enabled
# web:build: cache hit, replaying logs
```

### Railway

```bash
# Dashboard > Deployments でデプロイ状況を確認
# Logs タブでアプリケーションログを確認

# 手動実行でテスト
railway run pnpm job:health-check
```

---

## 9. トラブルシューティング

### キャッシュが効かない

**原因**: `TURBO_TOKEN`または`TURBO_TEAM`が未設定

```bash
# GitHub Secretsを確認
gh secret list

# トークンを再設定
turbo login
turbo token
gh secret set TURBO_TOKEN --body "new-token"
```

### デプロイが失敗する

**原因**: 環境変数が未設定またはdotenvx復号エラー

```bash
# Vercel環境変数を確認
vercel env ls

# 秘密鍵が正しいか確認
dotenvx run -f .env.production -- echo "OK"

# 環境変数追加
vercel env add DOTENV_PRIVATE_KEY_PRODUCTION production
```

### ビルドが失敗する

**原因**: 型エラーまたは依存関係の不整合

```bash
# ローカルで再現
pnpm install
pnpm turbo run typecheck
pnpm turbo run build

# 依存関係をリセット
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Remote Caching is not enabled

**原因**: TURBO_TOKENまたはTURBO_TEAMが正しくない

```bash
# .turbo/config.jsonのteamIdとGitHub SecretsのTURBO_TEAMが一致するか確認
cat .turbo/config.json

# Vercelトークンの有効期限を確認
# Vercel Dashboard > Account Settings > Tokens
```

### Authorization failed

**原因**: TURBO_TOKENが無効または権限不足

```bash
# Vercel Dashboardで新しいトークンを生成
# トークンのScopeが適切か確認（Full AccessまたはRead/Write権限）
# GitHub Secretsを更新
gh secret set TURBO_TOKEN --body "new-token"
```

---

## 関連ドキュメント

- [環境変数セットアップ手順](./environment-setup.md)
- [デプロイメント・CI/CD設計方針](../steering/infrastructure/deployment.md)
- [環境変数設計方針](../steering/infrastructure/environment-variables.md)

## 参考リンク

- [Turborepo Remote Caching Documentation](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Vercel Dashboard - Tokens](https://vercel.com/account/tokens)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Railway Documentation](https://docs.railway.app/)
- [GitHub Actions - Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
