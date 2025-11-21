# CI/CDパイプライン

## 概要

このドキュメントでは、GitHub ActionsとTurborepoを使用したCI/CDパイプラインの設計と運用方法を説明します。

リモートキャッシュを活用した高速ビルド、並列実行、自動デプロイを実現します。

---

## 目次

1. [技術スタック](#1-技術スタック)
2. [CI/CDパイプラインフロー](#2-cicdパイプラインフロー)
3. [Turborepo設定](#3-turborepo設定)
4. [GitHub Actions ワークフロー](#4-github-actions-ワークフロー)
5. [リモートキャッシュ戦略](#5-リモートキャッシュ戦略)
6. [デプロイ戦略](#6-デプロイ戦略)
7. [環境変数管理](#7-環境変数管理)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. 技術スタック

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| CI/CD | GitHub Actions | ワークフロー自動化 |
| ビルドオーケストレーション | Turborepo | モノレポタスク管理 |
| リモートキャッシュ | Vercel Remote Cache | ビルド成果物キャッシュ |
| デプロイ（Web/Admin） | Vercel | Next.jsアプリデプロイ |
| デプロイ（Cron Worker） | Railway | Cronジョブ実行環境 |
| パッケージマネージャー | pnpm | 依存関係管理 |

---

## 2. CI/CDパイプラインフロー

### 全体フロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant GH as GitHub
    participant CI as GitHub Actions
    participant Turbo as Turborepo
    participant Cache as Vercel Cache
    participant Vercel as Vercel
    participant Railway as Railway

    Dev->>GH: git push
    GH->>CI: Workflow トリガー
    CI->>CI: 環境セットアップ
    CI->>Turbo: turbo login
    Turbo->>Cache: キャッシュ認証

    CI->>Turbo: turbo run lint
    Turbo->>Cache: キャッシュチェック
    Cache-->>Turbo: キャッシュヒット
    Turbo-->>CI: Lint完了(キャッシュ)

    CI->>Turbo: turbo run build
    Turbo->>Cache: キャッシュチェック
    Cache-->>Turbo: キャッシュミス
    Turbo->>Turbo: ビルド実行
    Turbo->>Cache: 結果アップロード
    Turbo-->>CI: ビルド完了

    CI->>Turbo: turbo run test
    Turbo-->>CI: テスト完了

    alt main ブランチ
        CI->>Vercel: web デプロイ
        CI->>Vercel: admin デプロイ
        CI->>Railway: cron-worker デプロイ（Cron実行用）
        Railway-->>CI: デプロイ完了
    end

    CI-->>Dev: ステータス通知
```

### CI/CDステージ

| ステージ | タスク | 並列実行 | キャッシュ |
|---------|-------|---------|----------|
| Setup | pnpm install, turbo login | - | ✅ |
| Lint | turbo run lint | ✅ | ✅ |
| Type Check | turbo run type-check | ✅ | ✅ |
| Test | turbo run test | ✅ | ✅ |
| Build | turbo run build | ✅ | ✅ |
| Deploy | Vercel, Railway | ✅ | ❌ |

---

## 3. Turborepo設定

### turbo.json

**配置場所**: `turbo.json`（リポジトリルート）

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", ".env.local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "db:migrate:dev": {
      "cache": false
    },
    "db:migrate:deploy": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    }
  }
}
```

### タスク定義

#### build

**説明**: アプリケーションのビルド

**依存関係**:
- `^build` - 依存パッケージのビルドが完了後に実行

**成果物**:
- `.next/**` - Next.jsビルド成果物
- `dist/**` - その他のビルド成果物

**環境変数**:
- `DATABASE_URL` - データベース接続URL
- `NEXT_PUBLIC_*` - クライアント側で使用する環境変数

**キャッシュ**: ✅ 有効

#### dev

**説明**: 開発サーバー起動

**依存関係**: なし

**キャッシュ**: ❌ 無効（persistent モード）

**理由**: 開発サーバーは継続的に実行されるため、キャッシュは不要

#### lint

**説明**: Biomeによるコードリント

**依存関係**:
- `^build` - 依存パッケージのビルドが完了後に実行

**キャッシュ**: ✅ 有効

**成果物**: なし

#### type-check

**説明**: TypeScriptの型チェック

**依存関係**:
- `^build` - 依存パッケージのビルドが完了後に実行

**キャッシュ**: ✅ 有効

**成果物**: なし

#### test

**説明**: ユニットテスト実行

**依存関係**:
- `^build` - 依存パッケージのビルドが完了後に実行

**キャッシュ**: ✅ 有効

**成果物**: `coverage/**` - カバレッジレポート

#### db:*

**説明**: Prismaデータベース操作

**キャッシュ**: ❌ 無効

**理由**: データベース操作は冪等性がないため、キャッシュは危険

---

## 4. GitHub Actions ワークフロー

### CI ワークフロー

**配置場所**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Cache pnpm modules
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Turborepo login
        run: pnpm turbo login
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      - name: Run lint
        run: pnpm turbo run lint

      - name: Run type-check
        run: pnpm turbo run type-check

      - name: Run tests
        run: pnpm turbo run test
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Run build
        run: pnpm turbo run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Deploy ワークフロー

**配置場所**: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run migrations
        run: pnpm db:migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel (web)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_WEB_PROJECT_ID }}
          working-directory: apps/web

      - name: Deploy to Vercel (admin)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_ADMIN_PROJECT_ID }}
          working-directory: apps/admin

      - name: Deploy to Railway (cron-worker)
        run: |
          curl -fsSL https://railway.app/install.sh | sh
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        working-directory: apps/cron-worker
```

---

## 5. リモートキャッシュ戦略

### Vercel Remote Cache

**セットアップ**:

```bash
# Turboアカウントログイン
pnpm turbo login

# チームトークン取得（CI用）
pnpm turbo token
```

**環境変数**:

| 変数 | 説明 | 取得方法 |
|------|------|---------|
| TURBO_TOKEN | Turboアクセストークン | `turbo token`コマンド |
| TURBO_TEAM | Turboチーム名 | Turboダッシュボード |

**GitHub Secrets設定**:

```bash
# GitHub Secretsに追加
gh secret set TURBO_TOKEN --body "your-turbo-token"
gh secret set TURBO_TEAM --body "your-team-name"
```

### キャッシュヒット率の確認

```bash
# CI実行ログから確認
turbo run build --summarize

# 出力例:
# Tasks: 3 successful, 3 total
# Cached: 2 (66.7%)
# Time: 15s (キャッシュなし: 45s)
```

### キャッシュの恩恵

| タスク | キャッシュなし | キャッシュあり | 削減率 |
|--------|--------------|--------------|--------|
| lint | 10s | 2s | 80% |
| type-check | 15s | 3s | 80% |
| build | 45s | 5s | 89% |
| test | 30s | 4s | 87% |
| **合計** | **100s** | **14s** | **86%** |

---

## 6. デプロイ戦略

### Vercel（web, admin）

**デプロイトリガー**:
- main ブランチへのpush（本番環境）
- PR作成時（プレビュー環境）

**環境変数**:

| 変数 | 説明 | 設定場所 |
|------|------|---------|
| DATABASE_URL | PostgreSQL接続URL | Vercel Dashboard |
| NEXT_PUBLIC_API_URL | API URL | Vercel Dashboard |
| JWT_SECRET | JWT署名シークレット | Vercel Dashboard |

**デプロイフロー**:

```mermaid
graph LR
    A[Git Push] --> B[GitHub Actions]
    B --> C[pnpm install]
    C --> D[turbo run build]
    D --> E[Vercel Deploy]
    E --> F[本番環境]
```

### Railway（cron-worker）

**デプロイ方法**:
- Dockerコンテナ化
- Railway CLI経由でデプロイ

**Cron設定例**:

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/cron-worker/Dockerfile"

[deploy]
startCommand = "echo 'Cron worker deployed'"

[[crons]]
command = "pnpm job:cleanup"
schedule = "0 0 * * *"  # 毎日午前0時

[[crons]]
command = "pnpm job:email-digest"
schedule = "0 9 * * *"  # 毎日午前9時
```

---

## 7. 環境変数管理

### GitHub Secrets

**必須シークレット**:

| シークレット名 | 説明 | 用途 |
|--------------|------|------|
| DATABASE_URL | PostgreSQL接続URL | マイグレーション、ビルド |
| TEST_DATABASE_URL | テスト用DB接続URL | テスト実行 |
| TURBO_TOKEN | Turbo Remote Cacheトークン | キャッシュ認証 |
| TURBO_TEAM | Turboチーム名 | キャッシュ認証 |
| VERCEL_TOKEN | Vercelデプロイトークン | デプロイ |
| VERCEL_ORG_ID | Vercel組織ID | デプロイ |
| VERCEL_WEB_PROJECT_ID | webプロジェクトID | Webアプリデプロイ |
| VERCEL_ADMIN_PROJECT_ID | adminプロジェクトID | 管理画面デプロイ |
| RAILWAY_TOKEN | Railwayデプロイトークン | Cronワーカーデプロイ |

### 環境別の環境変数

**開発環境** (`.env.local`):

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/dev"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

**テスト環境** (`GitHub Secrets`):

```bash
TEST_DATABASE_URL="postgresql://user:pass@test-db:5432/test"
```

**本番環境** (`Vercel Dashboard`):

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL="https://api.example.com"
JWT_SECRET="production-secret"
```

---

## 8. トラブルシューティング

### キャッシュが効かない

**原因**:
- `TURBO_TOKEN`または`TURBO_TEAM`が未設定
- 環境変数が変更された

**解決方法**:

```bash
# GitHub Secretsを確認
gh secret list

# トークンを再設定
turbo login
turbo token
gh secret set TURBO_TOKEN --body "new-token"
```

### ビルドが失敗する

**原因**:
- 型エラー
- 依存関係の不整合

**解決方法**:

```bash
# ローカルで再現
pnpm install
pnpm turbo run type-check
pnpm turbo run build

# 依存関係をリセット
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### デプロイが失敗する

**原因**:
- 環境変数が未設定
- マイグレーションエラー

**解決方法**:

```bash
# Vercel環境変数を確認
vercel env ls

# マイグレーションを手動実行
pnpm db:migrate:deploy
```

### テストが失敗する

**原因**:
- テストDBが起動していない
- マイグレーションが未実行

**解決方法**:

```bash
# テストDBを起動
docker-compose up -d test-db

# マイグレーション実行
DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate:deploy

# テスト実行
pnpm turbo run test
```

---

## まとめ

このCI/CDパイプラインに従うことで、以下を実現できます：

1. **高速ビルド**: Turborepo Remote Cacheにより86%の時間削減
2. **並列実行**: lint、type-check、testを同時実行
3. **自動デプロイ**: main ブランチへのpush時に自動デプロイ
4. **信頼性**: すべてのPRでlint、test、buildを実行
5. **スケーラビリティ**: モノレポ構成でも高速なCI/CD

すべてのCI/CD設定は、このガイドラインに従って実装してください。
