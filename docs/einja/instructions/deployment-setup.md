<!-- @einja:managed:start -->
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

## 0. ゼロからの統合初期構築フロー

新しいプロジェクトまたは新しい開発者が環境を構築する際の統合フローです。

### 前提条件

以下のツール・アカウントが必要です:

| ツール | インストール方法 | 用途 |
|--------|----------------|------|
| mise | `curl https://mise.run \| sh` | Node.jsバージョン管理 |
| pnpm | `mise install` | パッケージ管理 |
| Docker | macOS: [OrbStack](https://orbstack.dev/)（推奨）/ その他: [Docker Engine](https://docs.docker.com/engine/install/) | PostgreSQL実行 |
| GitHub CLI (`gh`) | `brew install gh` | GitHub操作 |
| Vercel CLI | `pnpm add -g vercel` | Vercelデプロイ |
| Neon CLI (`neonctl`) | `npm install -g neonctl` | Neonデータベース管理 |
| dotenvx | `brew install dotenvx/brew/dotenvx` | 環境変数暗号化 |

### 構築ステップ

#### Step 1: リポジトリのクローンと依存関係インストール

```bash
git clone <repository-url>
cd <project-name>
pnpm install
```

#### Step 2: Neon初期設定

1. [Neon Console](https://console.neon.tech/) でAPI Keyを取得
2. `.env.personal` に `NEON_API_KEY=<取得したキー>` を設定
3. プロジェクト作成・ブランチ設定

詳細は [Neon CLI リファレンス](./neon-cli-reference.md) のセクション5「実践例」を参照。

#### Step 3: Vercel初期設定

1. [Vercel Dashboard](https://vercel.com/account/tokens) でトークンを取得
2. `.env.personal` に `VERCEL_TOKEN=<取得したトークン>` を設定
3. `vercel link --project=<プロジェクト名> --yes` でプロジェクト接続

詳細は [Vercel CLI リファレンス](./vercel-cli-reference.md) を参照。

#### Step 4: GitHub Secrets一括設定

`.env.keys` から秘密鍵を自動抽出してGitHub Secretsに設定:

```bash
for key_name in PREVIEW PRODUCTION DEVELOP STAGING; do
  value=$(grep "DOTENV_PRIVATE_KEY_${key_name}" .env.keys | cut -d'=' -f2 | tr -d '"'"'"')
  [ -n "$value" ] && gh secret set "DOTENV_PRIVATE_KEY_${key_name}" --body "$value"
done
```

詳細はセクション6「GitHub Secrets登録」を参照。

#### Step 5: ローカル環境変数設定

```bash
pnpm env:update
```

ウィザードに従って個人トークンと環境変数を設定。
詳細は [環境変数セットアップ](./environment-setup.md) を参照。

#### Step 6: 初回起動

```bash
pnpm dev:setup    # 初回セットアップ（DB起動・マイグレーション含む）
pnpm dev:bg       # 開発サーバー起動
```

#### Step 7: 動作確認

- [ ] ローカル開発サーバーにアクセスできる
- [ ] ログインが正常に動作する
- [ ] PRを作成してCI（GitHub Actions）が正常に動作する
- [ ] Preview環境にデプロイされる

---

## 1. 必要なSecrets一覧

### 必須Secrets

| Secret名 | 説明 | 用途 |
|---------|------|------|
| `DOTENV_PRIVATE_KEY_PREVIEW` | Preview環境用復号鍵 | PR Previewデプロイ |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | 本番環境用復号鍵 | mainブランチデプロイ |
| `DOTENV_PRIVATE_KEY_DEVELOP` | 開発環境用復号鍵 | developブランチデプロイ |
| `DOTENV_PRIVATE_KEY_STAGING` | ステージング環境用復号鍵 | stagingブランチデプロイ |
| `VERCEL_TOKEN` | Vercel CLIデプロイトークン | 全デプロイ |
| `VERCEL_ORG_ID` | Vercel組織ID | 全デプロイ |
| `VERCEL_PROJECT_ID_WEB` | WebアプリのVercelプロジェクトID | Webデプロイ |
| `VERCEL_PROJECT_ID_ADMIN` | AdminアプリのVercelプロジェクトID | Adminデプロイ |
| `TURBO_TOKEN` | Turborepo Remote Cacheトークン | ビルド高速化 |
| `TURBO_TEAM` | VercelチームID | ビルド高速化 |

### オプション（手動デプロイ・拡張用）

| Secret名 | 説明 | 用途 |
|---------|------|------|
| `RAILWAY_TOKEN` | Railway APIトークン | Railwayデプロイ |
| `RAILWAY_SERVICE_ID` | RailwayサービスID | Railwayデプロイ |
| `VERCEL_DEV_DOMAIN_ADMIN` | develop環境のAdminカスタムドメイン | Adminエイリアス |
| `VERCEL_STG_DOMAIN_ADMIN` | staging環境のAdminカスタムドメイン | Adminエイリアス |

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

### Neon（Preview環境DBブランチ自動作成対応）

#### プロジェクト作成

```bash
# 1. https://neon.tech でアカウント作成

# 2. 「Create a project」でプロジェクト作成
#    - Region: AWS ap-northeast-1 (Tokyo)
#    - Postgres version: 16（推奨）
#    - Project name: einja-management（任意）

# 3. Connection Details > Connection string をコピー
#    例: postgresql://user:pass@ep-xxx-xxx.ap-northeast-1.aws.neon.tech/main
```

#### Neon環境変数の設定

Neonの環境変数は `.env.preview` で管理します。GitHub Secretsへの登録は不要です。

```bash
# pnpm env:update でNeon環境変数を追加
pnpm env:update

# 対話式ウィザードで以下を選択：
# 1. 「環境設定を変更」を選択
# 2. 「preview環境」を選択
# 3. NEON_API_KEY と NEON_PROJECT_ID を追加

# NEON_API_KEY: Neon Console > Account Settings > API Keys から取得
# NEON_PROJECT_ID: Neon Console > Project Settings > General > Project ID から取得
```

#### ブランチ命名規則

Preview環境用のDBブランチは以下のルールで自動作成されます：

| 環境 | PR番号 | DBブランチ名 | 説明 |
|------|-------|------------|------|
| production | - | production | 本番環境 |
| develop | - | development | 開発環境 |
| preview | #123 | preview/pr-123 | PR番号から自動生成 |

**重要**:
- DBブランチ名はGitブランチ名から自動変換（`/`→`-`、小文字化）
- プレフィックス `preview/` が自動付与
- PR作成時に自動作成、PRクローズ時に自動削除

> **Neon CLI/APIの詳細**: [Neon CLI リファレンス](./neon-cli-reference.md) を参照してください。

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

### GitHub Actions での Vercel CLI デプロイ

GitHub ActionsではVercel CLIの認証情報をGitHub Secretsで管理します。`.env.ci`への格納は不要です。

必要なSecrets:
- `VERCEL_TOKEN`: Vercel Dashboard > Account Settings > Tokens > Create Token
- `VERCEL_ORG_ID`: Vercel Dashboard > Team Settings > General > Team ID
- `VERCEL_PROJECT_ID_WEB`: Vercel Dashboard > Project Settings > General > Project ID
- `VERCEL_PROJECT_ID_ADMIN`: 同上（Adminプロジェクト）

登録方法は [GitHub Secrets登録](#6-github-secrets登録) を参照してください。

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

# --- 復号鍵（.env.keysから取得） ---
gh secret set DOTENV_PRIVATE_KEY_PREVIEW --body "$(grep DOTENV_PRIVATE_KEY_PREVIEW .env.keys | cut -d= -f2 | tr -d '"'"'"')"
gh secret set DOTENV_PRIVATE_KEY_PRODUCTION --body "$(grep DOTENV_PRIVATE_KEY_PRODUCTION .env.keys | cut -d= -f2 | tr -d '"'"'"')"
gh secret set DOTENV_PRIVATE_KEY_DEVELOP --body "$(grep DOTENV_PRIVATE_KEY_DEVELOP .env.keys | cut -d= -f2 | tr -d '"'"'"')"
gh secret set DOTENV_PRIVATE_KEY_STAGING --body "$(grep DOTENV_PRIVATE_KEY_STAGING .env.keys | cut -d= -f2 | tr -d '"'"'"')"

# --- Vercel ---
gh secret set VERCEL_TOKEN --body "取得したトークン"
gh secret set VERCEL_ORG_ID --body "team_xxxxxxxxx"
gh secret set VERCEL_PROJECT_ID_WEB --body "prj_xxxxxxxxx"
gh secret set VERCEL_PROJECT_ID_ADMIN --body "prj_xxxxxxxxx"

# --- Turborepo ---
gh secret set TURBO_TOKEN --body "取得したトークン"
gh secret set TURBO_TEAM --body "team_xxxxxxxxx"

# --- オプション（Railway使用時） ---
gh secret set RAILWAY_TOKEN --body "取得したトークン"
gh secret set RAILWAY_SERVICE_ID --body "サービスID"
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
- [Vercel 新リポ追加 オンボーディング手順](./vercel-repo-onboarding.md)

## 参考リンク

- [Turborepo Remote Caching Documentation](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Vercel Dashboard - Tokens](https://vercel.com/account/tokens)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Railway Documentation](https://docs.railway.app/)
- [GitHub Actions - Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="deployment-setup-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
