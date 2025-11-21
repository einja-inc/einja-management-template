# デプロイメント戦略

## 概要

このドキュメントでは、Vercel、Railway、Dockerを使用したデプロイメント戦略と、Worktree対応の開発環境設定について説明します。

複数のプラットフォームに対応したハイブリッドデプロイメントと、ブランチごとの並行開発環境を実現します。

---

## 目次

1. [デプロイメントアーキテクチャ](#1-デプロイメントアーキテクチャ)
2. [Vercelデプロイ（Web/Admin）](#2-vercelデプロイwebadmin)
3. [Railwayデプロイ（Cron Worker）](#3-railwayデプロイcron-worker)
4. [環境変数管理](#4-環境変数管理)
5. [Worktree対応](#5-worktree対応)
6. [Docker化](#6-docker化)
7. [ロールバック戦略](#7-ロールバック戦略)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. デプロイメントアーキテクチャ

### デプロイメント構成

```mermaid
graph TB
    subgraph "GitHub Repository"
        Main[main branch]
        Feature[feature branches]
    end

    subgraph "Vercel Platform"
        WebProd[web - Production]
        AdminProd[admin - Production]
        WebPreview[web - Preview]
        AdminPreview[admin - Preview]
    end

    subgraph "Railway Platform"
        CronProd[cron-worker - Production]
        CronStaging[cron-worker - Staging]
    end

    subgraph "Database"
        DB[(PostgreSQL)]
    end

    Main -->|Auto Deploy| WebProd
    Main -->|Auto Deploy| AdminProd
    Main -->|Auto Deploy| CronProd

    Feature -->|PR Deploy| WebPreview
    Feature -->|PR Deploy| AdminPreview
    Feature -->|Manual Deploy| CronStaging

    WebProd --> DB
    AdminProd --> DB
    CronProd --> DB
```

### デプロイメント対象

| アプリケーション | プラットフォーム | デプロイトリガー | 環境 |
|----------------|--------------|--------------|------|
| web | Vercel | main push, PR作成 | Production, Preview |
| admin | Vercel | main push, PR作成 | Production, Preview |
| cron-worker | Railway | main push | Production |

---

## 2. Vercelデプロイ（Web/Admin）

### Vercel設定

**プロジェクト構成**:
- `web`: Next.js Webアプリケーション
- `admin`: Next.js 管理画面

**ビルド設定**:

| 設定項目 | 値 |
|---------|---|
| Framework Preset | Next.js |
| Build Command | `pnpm turbo run build --filter=web` |
| Output Directory | `.next` |
| Install Command | `pnpm install --frozen-lockfile` |
| Root Directory | `apps/web` (または `apps/admin`) |

### 環境変数設定

**Vercel Dashboard**:

```bash
# Production環境
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://api.example.com
JWT_SECRET=production-secret

# Preview環境
DATABASE_URL=postgresql://preview-...
NEXT_PUBLIC_API_URL=https://preview-api.example.com
JWT_SECRET=preview-secret
```

### デプロイフロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant GitHub as GitHub
    participant Vercel as Vercel
    participant DB as PostgreSQL

    Dev->>GitHub: git push main
    GitHub->>Vercel: Webhook通知
    Vercel->>Vercel: pnpm install
    Vercel->>Vercel: pnpm turbo run build
    Vercel->>Vercel: Next.js Standalone Build
    Vercel->>Vercel: デプロイ
    Vercel->>DB: マイグレーション実行
    Vercel-->>Dev: デプロイ完了通知
```

### Vercel CLI操作

**ローカルからのデプロイ**:

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

## 3. Railwayデプロイ（Cron Worker）

### Railway設定

**プロジェクト構成**:
- Dockerコンテナとしてデプロイ
- Cron機能でジョブをスケジュール実行

**railway.toml設定**:

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

### Dockerfile

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
COPY packages/server-core/package.json ./packages/server-core/
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

### Railway CLI操作

**デプロイ**:

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
```

---

## 4. 環境変数管理

### 階層的環境変数ロード

**ロード順序**（後勝ち）:
1. `root/.env` - モノレポ全体の共通設定
2. `root/.env.local` - ローカル環境でのオーバーライド
3. `apps/*/​.env.local` - アプリケーション固有のオーバーライド

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant Root as ルートディレクトリ
    participant Dotenv as dotenv-cli
    participant Turbo as Turborepo
    participant App as web/admin/cron-worker

    Dev->>Root: pnpm dev
    Root->>Dotenv: dotenv -e .env -e .env.local
    Dotenv->>Dotenv: .env読み込み
    Dotenv->>Dotenv: .env.local読み込み(オーバーライド)
    Dotenv->>Turbo: 環境変数セットしてturbo run dev
    Turbo->>App: 各アプリ起動
    App->>App: dotenv -e ../../.env -e ../../.env.local -e .env.local
    Note over App: 階層的環境変数適用<br/>app .env.local > root .env.local > root .env
    App->>App: Next.js dev起動
    App-->>Dev: 開発サーバー起動完了
```

### 環境変数ファイル例

**`root/.env`** (すべての環境で共通):

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/drlove"

# App Ports (デフォルト値)
PORT_WEB=3000
PORT_ADMIN=3001
PORT_WORKER=3002

# Postgres Port
POSTGRES_PORT=5432
```

**`root/.env.local`** (ローカル開発のみ):

```bash
# ローカル開発用のオーバーライド
DATABASE_URL="postgresql://user:pass@localhost:5432/drlove_dev"
```

**`apps/web/.env.local`** (webアプリ固有):

```bash
# Web固有の設定
NEXT_PUBLIC_APP_NAME="Dr.Love Web App"
```

### dotenv-cli設定

**package.json**:

```json
{
  "scripts": {
    "dev": "dotenv -e .env -e .env.local -- turbo run dev",
    "build": "dotenv -e .env -e .env.local -- turbo run build"
  }
}
```

**apps/web/package.json**:

```json
{
  "scripts": {
    "dev": "dotenv -e ../../.env -e ../../.env.local -e .env.local -- next dev"
  }
}
```

---

## 5. Worktree対応

### Worktreeの課題

**課題**: 複数のブランチを並行開発する際、ポート番号が衝突する

**解決策**: MD5ハッシュベースの動的ポート割り当て

### ポート計算ロジック

**実装ファイル**: `scripts/worktree/lib/calculate-ports.ts`

```typescript
import crypto from 'crypto'

export interface WorktreePorts {
  PORT_WEB: number
  PORT_ADMIN: number
  PORT_WORKER: number
  POSTGRES_PORT: number
}

export function calculatePorts(branchName: string): WorktreePorts {
  // ブランチ名からMD5ハッシュを生成
  const hash = crypto.createHash('md5').update(branchName).digest('hex')

  // ハッシュの最初の4文字を16進数として解釈
  const seed = parseInt(hash.substring(0, 4), 16)

  // 各ポート番号を計算（3000-9999の範囲）
  const PORT_WEB = 3000 + (seed % 7000)
  const PORT_ADMIN = PORT_WEB + 1
  const PORT_WORKER = PORT_WEB + 2
  const POSTGRES_PORT = 5432 + (seed % 1000)

  return {
    PORT_WEB,
    PORT_ADMIN,
    PORT_WORKER,
    POSTGRES_PORT,
  }
}
```

### Worktree起動スクリプト

**実装ファイル**: `scripts/worktree/dev.ts`

```typescript
import { execSync } from 'child_process'
import { calculatePorts } from './lib/calculate-ports'

// 現在のブランチ名を取得
const branchName = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()

console.log(`🌿 Worktree branch: ${branchName}`)

// ポート番号を計算
const ports = calculatePorts(branchName)

console.log(`📡 Ports assigned:`)
console.log(`  - Web:      ${ports.PORT_WEB}`)
console.log(`  - Admin:    ${ports.PORT_ADMIN}`)
console.log(`  - Worker:   ${ports.PORT_WORKER}`)
console.log(`  - Postgres: ${ports.POSTGRES_PORT}`)

// 環境変数を設定
process.env.PORT_WEB = String(ports.PORT_WEB)
process.env.PORT_ADMIN = String(ports.PORT_ADMIN)
process.env.PORT_WORKER = String(ports.PORT_WORKER)
process.env.POSTGRES_PORT = String(ports.POSTGRES_PORT)

// DATABASE_URLを組み立て
const dbUrl = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/drlove'
const updatedDbUrl = dbUrl.replace(/:\d+\//, `:${ports.POSTGRES_PORT}/`)
process.env.DATABASE_URL = updatedDbUrl

console.log(`🗄️  Database: ${updatedDbUrl}`)
console.log(``)

// Turborepoを起動
execSync('pnpm turbo run dev', { stdio: 'inherit' })
```

### Worktree開発フロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant Root as ルートディレクトリ
    participant Script as scripts/worktree/dev.ts
    participant Git as Git
    participant Calc as calculatePorts
    participant Turbo as Turborepo
    participant App as web/admin/cron-worker

    Dev->>Root: pnpm dev:worktree
    Root->>Script: tsx scripts/worktree/dev.ts
    Script->>Git: git branch --show-current
    Git-->>Script: ブランチ名(例: feature/auth)
    Script->>Calc: calculatePorts(branch)
    Calc->>Calc: MD5ハッシュ計算
    Calc-->>Script: ポート番号セット
    Note over Script: PORT_WEB=3120<br/>PORT_ADMIN=3121<br/>PORT_WORKER=3122<br/>POSTGRES_PORT=5452
    Script->>Script: process.env設定
    Script->>Script: DATABASE_URL組み立て
    Script->>Turbo: pnpm turbo run dev
    Note over Turbo: 環境変数が自動継承
    Turbo->>App: 各アプリ起動
    App->>App: 環境変数読み込み
    App->>App: Next.js dev起動
    App-->>Dev: ブランチ固有ポートで起動完了
```

### Worktree使用例

```bash
# Worktree作成
git worktree add ../drlove_feature_auth feature/auth

# Worktree移動
cd ../drlove_feature_auth

# 依存関係インストール
pnpm install

# Worktree対応起動
pnpm dev:worktree

# 出力例:
# 🌿 Worktree branch: feature/auth
# 📡 Ports assigned:
#   - Web:      3120
#   - Admin:    3121
#   - Worker:   3122
#   - Postgres: 5452
# 🗄️  Database: postgresql://user:pass@localhost:5452/drlove
```

### package.json設定

**root/package.json**:

```json
{
  "scripts": {
    "dev": "dotenv -e .env -e .env.local -- turbo run dev",
    "dev:worktree": "tsx scripts/worktree/dev.ts"
  }
}
```

---

## 6. Docker化

### Next.js Standalone Build

**next.config.js**:

```javascript
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone', // Standaloneビルド有効化
  reactStrictMode: true,
  transpilePackages: ["@repo/server-core"],
}
```

### マルチステージDockerfile

**Web/Adminアプリ用Dockerfile**:

```dockerfile
# Stage 1: 依存関係インストール
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@8
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/server-core/package.json ./packages/server-core/
RUN pnpm install --frozen-lockfile

# Stage 2: ビルド
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm@8
RUN pnpm turbo run build --filter=web

# Stage 3: 実行環境
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Standaloneビルド成果物をコピー
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
```

### Docker Compose（ローカル開発用）

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: drlove
    volumes:
      - postgres_data:/var/lib/postgresql/data

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "${PORT_WEB:-3000}:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/drlove
    depends_on:
      - postgres

volumes:
  postgres_data:
```

---

## 7. ロールバック戦略

### Vercelロールバック

**方法1: Vercel Dashboard**:
1. Vercel Dashboardにログイン
2. プロジェクトを選択
3. Deploymentsタブを開く
4. ロールバックしたいデプロイを選択
5. "Promote to Production" をクリック

**方法2: Vercel CLI**:

```bash
# デプロイ履歴確認
vercel ls

# 特定のデプロイをプロモート
vercel promote <deployment-url>
```

### Railwayロールバック

**方法1: Railway Dashboard**:
1. Railway Dashboardにログイン
2. プロジェクトを選択
3. Deploymentsタブを開く
4. ロールバックしたいデプロイを選択
5. "Rollback" をクリック

**方法2: Railway CLI**:

```bash
# デプロイ履歴確認
railway status

# ロールバック（再デプロイ）
railway up
```

---

## 8. トラブルシューティング

### デプロイが失敗する

**原因**: 環境変数が未設定

**解決方法**:

```bash
# Vercel環境変数確認
vercel env ls

# 環境変数追加
vercel env add DATABASE_URL production

# Railway環境変数確認
railway variables

# 環境変数追加
railway variables set DATABASE_URL=postgresql://...
```

### Worktreeでポートが衝突する

**原因**: 計算されたポートが既に使用中

**解決方法**:

```bash
# ポート使用状況確認
lsof -i :3120

# プロセスを終了
kill -9 <PID>

# または、ブランチ名を変更して異なるポートを使用
git branch -m feature/auth-v2
```

### マイグレーションエラー

**原因**: DATABASE_URLが不正

**解決方法**:

```bash
# 環境変数確認
echo $DATABASE_URL

# マイグレーション手動実行
pnpm db:migrate:deploy

# Prisma Studioで確認
pnpm db:studio
```

---

## まとめ

このデプロイメント戦略に従うことで、以下を実現できます：

1. **マルチプラットフォーム**: Vercel + Railway のハイブリッドデプロイ
2. **環境変数管理**: dotenv-cliによる階層的ロード
3. **Worktree対応**: MD5ハッシュベースの動的ポート割り当て
4. **Docker化**: Next.js Standaloneビルドによる効率的なコンテナ化
5. **ロールバック**: Vercel/Railway Dashboardから簡単にロールバック

すべてのデプロイメント操作は、このガイドラインに従って実施してください。
