# デプロイ環境構築ガイド

本番環境へのデプロイに必要な設定手順をまとめたドキュメントです。

---

## 環境変数・Secrets一覧

| 変数名 | 説明 | 用途 | 取得元 | GitHub Actions | Vercel |
|--------|------|------|--------|:--------------:|:------:|
| `DATABASE_URL` | PostgreSQL接続文字列 | DB接続 | Supabase / Neon / Vercel Postgres | - | ◯ |
| `AUTH_SECRET` | NextAuth.jsシークレット | 認証 | 自己生成 | - | ◯ |
| `AUTH_URL` | 認証ベースURL | 認証 | Vercelデプロイ後のURL | - | ◯ |
| `TURBO_TOKEN` | Turborepo Remote Cacheトークン | ビルド高速化 | Vercel | ◯ | - |
| `TURBO_TEAM` | VercelチームID | ビルド高速化 | Vercel | ◯ | - |
| `OPENAI_API_KEY` | OpenAI APIキー | AI機能 | OpenAI | - | ◯ |
| `PINECONE_API_KEY` | Pinecone APIキー | RAG機能 | Pinecone | - | ◯ |
| `PINECONE_INDEX_HOST` | PineconeインデックスURL | RAG機能 | Pinecone | - | ◯ |
| `PINECONE_INDEX_NAME` | インデックス名 | RAG機能 | Pinecone | - | ◯ |

### オプション（通常不要）

| 変数名 | 説明 | 用途 | 取得元 | GitHub Actions | Vercel |
|--------|------|------|--------|:--------------:|:------:|
| `VERCEL_TOKEN` | Vercelデプロイトークン | 手動デプロイ | Vercel | ◯ | - |
| `VERCEL_ORG_ID` | Vercel組織ID | 手動デプロイ | Vercel | ◯ | - |
| `VERCEL_WEB_PROJECT_ID` | webプロジェクトID | 手動デプロイ | Vercel | ◯ | - |
| `VERCEL_ADMIN_PROJECT_ID` | adminプロジェクトID | 手動デプロイ | Vercel | ◯ | - |
| `RAILWAY_TOKEN` | Railway APIトークン | Railwayデプロイ | Railway | ◯ | - |
| `RAILWAY_SERVICE_ID` | RailwayサービスID | Railwayデプロイ | Railway | ◯ | - |

---

## 1. データベース（PostgreSQL）

### Supabase（推奨）

1. https://supabase.com でアカウント作成
2. 「New Project」でプロジェクト作成
   - Region: `Northeast Asia (Tokyo)`
   - Database Password: 設定してメモ
3. Settings > Database > Connection string > URI をコピー
4. `[YOUR-PASSWORD]` を設定したパスワードに置換

### Neon

1. https://neon.tech でアカウント作成
2. 「Create a project」でプロジェクト作成
3. Connection Details > Connection string をコピー

### Vercel Postgres

1. Vercel Dashboard > Storage > Create Database > Postgres
2. 作成後、Connect タブから接続文字列を取得

---

## 2. Vercel（フロントエンド）

### プロジェクト作成

1. https://vercel.com でGitHubアカウントでログイン
2. 「Add New...」>「Project」
3. GitHubリポジトリを選択
4. 設定:
   - **Project Name**: 任意（例: `eenchow-web`）
   - **Root Directory**: `apps/web`
5. 「Deploy」をクリック

adminアプリも同様に作成（Root Directory: `apps/admin`）

### 環境変数の設定

1. Vercel Dashboard > 対象プロジェクト > Settings > Environment Variables
2. 以下を追加:

| Key | Value | Environment |
|-----|-------|-------------|
| `DATABASE_URL` | 接続文字列 | Production, Preview |
| `AUTH_SECRET` | `openssl rand -base64 32`で生成 | Production, Preview |
| `AUTH_URL` | デプロイ後のURL | Production |

### Turborepo Remote Cache（GitHub Actions用）

1. Vercel Dashboard > Account Settings > Tokens > Create Token
2. トークンをコピー → GitHub Secrets に `TURBO_TOKEN` として登録
3. Vercel Dashboard > Team Settings > General > Team ID をコピー
4. GitHub Secrets に `TURBO_TEAM` として登録

---

## 3. OpenAI

1. https://platform.openai.com/api-keys にアクセス
2. 「Create new secret key」をクリック
3. キーをコピー（一度しか表示されない）
4. Vercel環境変数に `OPENAI_API_KEY` として登録

---

## 4. Pinecone（RAG機能）

1. https://app.pinecone.io でアカウント作成
2. 「Create Index」でインデックス作成
   - Dimensions: `1536`（text-embedding-3-small用）
   - Metric: `cosine`
3. API Keys > Create API Key でキー作成
4. 以下をVercel環境変数に登録:

| Key | 取得場所 |
|-----|----------|
| `PINECONE_API_KEY` | API Keys |
| `PINECONE_INDEX_HOST` | Indexes > 対象Index > Host |
| `PINECONE_INDEX_NAME` | 作成したIndex名 |

---

## 5. Railway（cron-worker）

1. https://railway.app でGitHubアカウントでログイン
2. 「New Project」>「Deploy from GitHub repo」
3. リポジトリを選択
4. 設定:
   - **Root Directory**: `apps/cron-worker`
5. Variables タブで環境変数を設定

### GitHub Actionsからのデプロイ（オプション）

1. Railway Dashboard > Account Settings > Tokens > Create Token
2. GitHub Secrets に登録:
   - `RAILWAY_TOKEN`: 作成したトークン
   - `RAILWAY_SERVICE_ID`: Service > Settings > Service ID

---

## 6. GitHub Secrets登録

1. GitHub リポジトリ > Settings > Secrets and variables > Actions
2. 「New repository secret」で以下を追加:

| Secret | 値 |
|--------|-----|
| `TURBO_TOKEN` | Vercelトークン |
| `TURBO_TEAM` | VercelチームID |

---

## 7. 動作確認

### Vercel

- デプロイ完了後、生成されたURLにアクセス
- ログイン機能が動作することを確認

### GitHub Actions

- PRを作成してCIが実行されることを確認
- Remote Cacheが有効な場合、ログに `cache hit` が表示される

### Railway

- Dashboard > Deployments でデプロイ状況を確認
- Logs タブでアプリケーションログを確認
