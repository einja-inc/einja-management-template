# eenchow - ローカル開発サーバー環境構築ガイド（Worktree対応）

## クイックスタート（推奨）

すぐに開発を始めたい場合は、以下のコマンドを実行してください。

### ローカル環境
```bash
pnpm install
cp .env.example .env
pnpm setup:local  # 初回のみ
pnpm dev
```

### Worktree環境
```bash
pnpm setup:worktree && pnpm dev
# または
pnpm dev:worktree  # 全自動
```

以下、詳細な手順とトラブルシューティングを記載しています。

---

## 概要

eenchowは、Turborepo + Next.jsを使用したモノレポ構成のアプリケーションです。本ドキュメントでは、ローカル開発サーバーの起動、環境変数管理、Worktree環境での並行開発まで、開発メンバーが迷わず環境構築できるように手順を説明します。

### プロジェクト構成

- **apps/web**: エンドユーザー向けWebアプリケーション (Next.js 14 App Router)
- **apps/admin**: 管理画面アプリケーション (Next.js 14 App Router)
- **apps/cron-worker**: バックグラウンドジョブ実行アプリ (Next.js API Routes)
- **packages/server-core**: 共有サーバーロジック (Domain層 + Infrastructure層)

## 必要な環境

開発を始める前に、以下の環境を準備してください。

| ソフトウェア | バージョン | インストール確認コマンド |
|------------|----------|---------------------|
| Node.js | 20.x以上 | `node --version` |
| pnpm | 8.x以上 | `pnpm --version` |
| Docker | 24.x以上 | `docker --version` |
| Docker Compose | 2.x以上 | `docker compose version` |
| Git | 2.x以上 | `git --version` |

### インストール方法

#### Node.js & pnpm
```bash
# Node.jsのインストール（推奨: nvm使用）
nvm install 20
nvm use 20

# pnpmのインストール
npm install -g pnpm@8
```

#### Docker
- macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- Linux: [Docker Engine](https://docs.docker.com/engine/install/)

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd eenchow
```

### 2. 依存関係のインストール

```bash
pnpm install
```

このコマンドで、ルートおよびすべてのワークスペース（apps/*, packages/*）の依存関係が一括インストールされます。

### 3. 環境変数の設定

#### ルート.envファイルの作成

**重要**: 環境変数は**ルート.envファイル1つ**のみを作成します。各アプリケーション（apps/*）に個別の.envファイルは不要です。

```bash
# ルートディレクトリで実行
cp .env.example .env
```

#### .envファイルの内容

デフォルトの設定で開発できますが、必要に応じて編集してください。

```bash
# PostgreSQL接続設定
# PostgreSQLは固定ポート35432を使用（全ワークツリーで共有）
# database名はワークツリーごとに自動設定（einja_main, einja_feature_xxx など）
DATABASE_URL="postgresql://postgres:postgres@localhost:35432/einja_main?schema=public"

# NextAuth設定
AUTH_SECRET=your-nextauth-secret-key-here
AUTH_URL=http://localhost:3000
```

#### 環境変数の階層構造

環境変数は以下の優先順位で読み込まれます（下にいくほど優先度が高い）：

1. **ルート/.env** - 全アプリ共通の基本設定（Git管理対象）
2. **ルート/.env.local** - 開発者個人のカスタム設定（gitignore対象）
3. **apps/*/.env.local** - 特定アプリのみのカスタム設定（gitignore対象）

**開発者が作成するのはルート/.envのみ**で、ほとんどのケースで十分です。個人の開発環境に応じてポート番号を変更したい場合などは、.env.localを作成してください。

### 4. PostgreSQLの起動

```bash
# Docker Composeでデータベースを起動
docker compose up -d

# 起動確認
docker compose ps
```

正常に起動すると、PostgreSQLが`localhost:35432`で利用可能になります。

### 5. Prismaのセットアップ

```bash
# Prisma Clientの生成
pnpm db:generate

# データベースマイグレーション
pnpm db:migrate:dev
```

初回マイグレーション時にマイグレーション名を聞かれた場合は、`init`などの任意の名前を入力してください。

### 6. 開発サーバーの起動

セットアップが完了したら、開発サーバーを起動します。

```bash
pnpm dev
```

各アプリケーションが以下のポートで起動します：

- Web: http://localhost:3000
- Admin: http://localhost:4000
- Cron Worker: http://localhost:5000

## セットアップフロー図

```mermaid
flowchart TD
    Start([開発環境構築開始]) --> Clone[リポジトリクローン]
    Clone --> Install[pnpm install]
    Install --> CopyEnv[cp .env.example .env]
    CopyEnv --> EditEnv{環境変数を<br/>カスタマイズ?}
    EditEnv -->|はい| EditFile[.envファイル編集]
    EditEnv -->|いいえ| DockerUp
    EditFile --> DockerUp[docker compose up -d]
    DockerUp --> CheckDocker{Docker起動<br/>成功?}
    CheckDocker -->|いいえ| TroubleshootDocker[トラブルシューティング参照]
    CheckDocker -->|はい| PrismaGen[pnpm db:generate]
    PrismaGen --> PrismaMigrate[pnpm db:migrate:dev]
    PrismaMigrate --> DevServer[pnpm dev]
    DevServer --> Complete([セットアップ完了])
    TroubleshootDocker --> DockerUp

    style Start fill:#e1f5ff
    style Complete fill:#c8e6c9
    style TroubleshootDocker fill:#ffecb3
```

## 開発モード

### 通常開発（`pnpm dev`）

**用途**: 単一ブランチでの通常の開発作業

```bash
pnpm dev
```

#### 特徴:
- 固定ポート番号（web:3000, admin:4000, worker:5000）
- dotenv-cliがルート.envを自動読み込み
- 全アプリケーションを同時起動
- HMR（Hot Module Replacement）対応

#### 個別アプリの起動:
```bash
pnpm dev:web      # Webアプリのみ起動
pnpm dev:admin    # 管理画面のみ起動
pnpm dev:worker   # Cron Workerのみ起動
```

### Worktree開発（`pnpm dev:worktree`）

**用途**: 複数ブランチを同時開発（git worktree使用時）

```bash
pnpm dev:worktree
```

#### 特徴:
- **ポート番号の自動計算**: ブランチ名からSHA-256ハッシュで一意のポート番号を生成
- 複数ブランチを同時に起動可能（ポート競合なし）
- **PostgreSQLは共有インスタンス**: 全ワークツリーで同一のPostgreSQLコンテナ（port 35432）を使用
- **database名で分離**: ブランチごとに異なるデータベース名を自動生成（例: `einja_main`, `einja_feature_auth`）

#### ポート番号の採番ルール:

Worktreeモードでは、ブランチ名から決定論的にポート番号を計算します。同じブランチ名なら常に同じポート番号が割り当てられます。

```typescript
// scripts/worktree/dev.tsの実装
1. ブランチ名のSHA-256ハッシュを生成（例: "feature/auth" → "7a3d...")
2. ハッシュの最初の8文字を16進数として数値化
3. 各ポート番号を計算:
   - Web:        hashNum % 1000 + 3000  → 3000-3999
   - Admin:      hashNum % 1000 + 4000  → 4000-4999
4. PostgreSQL設定（全ワークツリーで共有）:
   - ポート:      35432（固定）
   - Database:   einja_<ブランチ名の正規化>（例: einja_feature_auth）
```

**採番の特徴:**
- ブランチ名が同じなら常に同じポート番号（再現性）
- Web/Adminは同じハッシュ部分を使うため連番になる
- PostgreSQLは全ワークツリーで共有（リソース節約）
- database名で完全に分離（データの独立性を保証）

#### ポート番号とデータベースの例:

| ブランチ名 | Web | Admin | PostgreSQL | Database |
|----------|-----|-------|------------|----------|
| main | 3195 | 4195 | 35432 | einja_main |
| feature/auth | 3122 | 4122 | 35432 | einja_feature_auth |
| feature/payment | 3087 | 4087 | 35432 | einja_feature_payment |

#### Worktree環境のセットアップ:

```bash
# 新しいWorktreeを作成
git worktree add ../eenchow-feature-auth feature/auth

# Worktreeディレクトリに移動
cd ../eenchow-feature-auth

# 依存関係インストール（必要に応じて）
pnpm install

# Worktreeモードで開発サーバー起動（全自動）
pnpm dev:worktree
```

**このコマンドは以下を自動実行します：**
1. ブランチ名からポート番号を自動計算
2. PostgreSQLを動的ポートで起動
3. データベース接続確認（ヘルスチェック）
4. Prismaマイグレーション実行
5. 全アプリケーションの開発サーバー起動

起動時の出力例：

```
現在のブランチ: feature/auth
データベース名: einja_feature_auth
計算されたポート: { web: 3122, admin: 4122 }
使用するポート: { web: 3122, admin: 4122 }
.env.localに書き込みました: /path/to/.env.local
✅ PostgreSQLは既に起動しています
🗄️  データベース「einja_feature_auth」を確認中...
📦 データベース「einja_feature_auth」を作成します...
✅ データベース「einja_feature_auth」を作成しました

===========================================
Worktree環境設定完了
===========================================
  Web:        http://localhost:3122
  Admin:      http://localhost:4122
  PostgreSQL: localhost:35432
  Database:   einja_feature_auth

  開発サーバー: pnpm dev
===========================================

開発サーバーを起動します...
```

#### PostgreSQL設定との連携:

`pnpm dev:worktree`は、PostgreSQLを自動管理します（共有インスタンス方式）。

**アーキテクチャ:**
- **PostgreSQLコンテナ**: 全ワークツリーで共有（1インスタンス）
- **ポート**: 固定 `35432`
- **データ分離**: database名で分離（`einja_main`, `einja_feature_auth`など）

**自動実行される処理:**

1. **環境変数の自動設定**（.env.localに書き込み）
   - `PORT_WEB`: 計算されたWebポート番号
   - `PORT_ADMIN`: 計算されたAdminポート番号
   - `DATABASE_URL`: `postgresql://postgres:postgres@localhost:35432/einja_<ブランチ名>`

2. **PostgreSQLコンテナの起動確認**
   - コンテナが起動していなければ `docker compose up -d postgres` を実行
   - コンテナ名: `einja-postgres`（共有）
   - ポート: `35432`（固定）

3. **ヘルスチェック**
   - 最大30秒間、PostgreSQLの起動を待機
   - `pg_isready`コマンドで接続確認

4. **データベースの自動作成**
   - ブランチ名からdatabase名を生成（例: `einja_feature_auth`）
   - 存在しなければ `CREATE DATABASE` で自動作成

**docker-compose.ymlの設定:**

```yaml
services:
  postgres:
    container_name: einja-postgres
    ports:
      - "35432:5432"
volumes:
  einja_postgres_data:  # 全ワークツリーで共有
```

**メリット:**
- リソース効率が良い（1つのPostgreSQLインスタンスを共有）
- 起動が速い（既に起動中の場合はdatabase作成のみ）
- database名で完全にデータ分離（並行開発が可能）

### Worktree完全セットアップフロー

```mermaid
flowchart TD
    Start([Worktree開発開始]) --> CreateWorktree[git worktree add]
    CreateWorktree --> CDWorktree[Worktreeディレクトリに移動]
    CDWorktree --> CheckDeps{依存関係<br/>最新?}
    CheckDeps -->|いいえ| InstallDeps[pnpm install]
    CheckDeps -->|はい| DevWorktree
    InstallDeps --> DevWorktree[pnpm dev:worktree実行]

    DevWorktree --> GetBranch[ブランチ名取得]
    GetBranch --> GenDbName[database名生成<br/>einja_ブランチ名]
    GenDbName --> CalcPorts[calculatePorts実行]
    CalcPorts --> HashBranch[SHA-256ハッシュ生成]
    HashBranch --> ExtractHash[ハッシュ8文字抽出]
    ExtractHash --> CalcWeb[Web: hashNum % 1000 + 3000]
    ExtractHash --> CalcAdmin[Admin: hashNum % 1000 + 4000]

    CalcWeb --> SetEnv[.env.local書き込み<br/>PORT_WEB, PORT_ADMIN, DATABASE_URL]
    CalcAdmin --> SetEnv

    SetEnv --> DisplayPorts[計算されたポート表示]
    DisplayPorts --> CheckPG{PostgreSQL<br/>起動中?}
    CheckPG -->|いいえ| StartPG[docker compose up -d postgres<br/>共有インスタンス起動]
    CheckPG -->|はい| CreateDB
    StartPG --> HealthCheck[PostgreSQLヘルスチェック<br/>pg_isready 最大30秒]
    HealthCheck --> CheckHealth{接続確認<br/>成功?}
    CheckHealth -->|いいえ| Retry{リトライ<br/>残あり?}
    Retry -->|はい| HealthCheck
    Retry -->|いいえ| Error([エラー終了])
    CheckHealth -->|はい| CreateDB[database作成確認<br/>CREATE DATABASE if not exists]

    CreateDB --> StartApps[各アプリ起動<br/>pnpm dev]
    StartApps --> Complete([Worktree環境起動完了])

    style Start fill:#e1f5ff
    style Complete fill:#c8e6c9
    style DevWorktree fill:#fff3e0
    style CalcPorts fill:#fff3e0
    style SetEnv fill:#fff3e0
    style StartPG fill:#e3f2fd
    style HealthCheck fill:#e3f2fd
    style CreateDB fill:#e3f2fd
    style Error fill:#ffcdd2
```

### 環境変数読み込みフロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant Root as ルートディレクトリ
    participant Dotenv as dotenv-cli
    participant Script as worktree/dev.ts
    participant Git as Git
    participant Docker as Docker
    participant App as アプリケーション

    alt 通常開発（pnpm dev）
        Dev->>Root: pnpm dev
        Root->>Dotenv: dotenv -e .env -e .env.local
        Dotenv->>Dotenv: .env読み込み
        Dotenv->>Dotenv: .env.local読み込み（オーバーライド）
        Dotenv->>App: 環境変数を渡してturbo run dev
        App->>App: 各アプリでさらに階層的に読み込み
        Note over App: app .env.local > root .env.local > root .env
        App-->>Dev: 開発サーバー起動（固定ポート）
    else Worktree開発（pnpm dev:worktree）
        Dev->>Root: pnpm dev:worktree
        Root->>Script: tsx scripts/worktree/dev.ts
        Script->>Git: git rev-parse --abbrev-ref HEAD
        Git-->>Script: ブランチ名（例: feature/auth）
        Script->>Script: database名生成
        Note over Script: einja_feature_auth
        Script->>Script: ポート計算（SHA-256）
        Note over Script: Web: 3122<br/>Admin: 4122
        Script->>Script: .env.local書き込み
        Note over Script: PORT_WEB=3122<br/>PORT_ADMIN=4122<br/>DATABASE_URL=postgresql://...@localhost:35432/einja_feature_auth
        Script->>Docker: PostgreSQL起動確認
        Docker-->>Script: 起動中 or 起動
        Script->>Docker: CREATE DATABASE einja_feature_auth
        Docker-->>Script: OK
        Script->>App: pnpm dev
        App->>App: 環境変数読み込み
        App-->>Dev: 開発サーバー起動（動的ポート）
    end
```

## よく使うコマンド一覧

### 開発サーバー

```bash
# 全アプリケーション起動
pnpm dev

# Worktree環境での起動
pnpm dev:worktree

# 個別アプリ起動
pnpm dev:web
pnpm dev:admin
pnpm dev:worker
```

### ビルド

```bash
# 全アプリケーションをビルド
pnpm build

# 本番モードで起動（ビルド後）
pnpm start
```

### コード品質

```bash
# リント（Biome）
pnpm lint

# フォーマット（Biome）
pnpm format

# リント + フォーマット + インポート整理
pnpm check

# 型チェック
pnpm type-check
```

### テスト

```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm test:e2e

# カバレッジ付きテスト
pnpm test:coverage
```

### データベース操作

```bash
# Prisma Clientを生成
pnpm db:generate

# 開発環境でマイグレーション実行
pnpm db:migrate:dev

# 本番環境でマイグレーション実行
pnpm db:migrate:deploy

# Prisma Studioを起動（GUI）
pnpm db:studio

# データベースをリセット（開発環境のみ）
pnpm db:reset
```

### Docker操作

```bash
# PostgreSQL起動
docker compose up -d

# PostgreSQL停止
docker compose down

# ログ確認
docker compose logs -f postgres

# コンテナ状態確認
docker compose ps
```

### クリーンアップ

```bash
# ビルド成果物を削除
pnpm clean

# node_modulesも含めて完全削除
pnpm clean:all
```

## トラブルシューティング

### ポート番号が競合している

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**原因**: 指定されたポートが既に使用されています。

**解決策**:

1. **既存プロセスを終了**:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9

   # Windows (PowerShell)
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
   ```

2. **ポート番号を変更**:
   ルート/.env.localを作成して、カスタムポートを設定：
   ```bash
   PORT_WEB=3001
   PORT_ADMIN=4001
   PORT_WORKER=5001
   ```

3. **Worktreeモードを使用**:
   ```bash
   pnpm dev:worktree
   ```
   自動的に空きポートが計算されます。

### PostgreSQLに接続できない

**症状**: `Error: Can't reach database server at localhost:35432`

**原因**: PostgreSQLが起動していない、またはポート設定が間違っています。

**解決策**:

1. **Dockerコンテナの状態確認**:
   ```bash
   docker compose ps
   ```

2. **PostgreSQLを再起動**:
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **ログを確認**:
   ```bash
   docker compose logs postgres
   ```

4. **ポート番号を確認**:
   .envファイルの`POSTGRES_PORT`が正しいか確認してください。

### Prismaマイグレーションが失敗する

**症状**: `Error: P1001: Can't reach database server`

**解決策**:

1. **DATABASE_URLを確認**:
   ```bash
   echo $DATABASE_URL
   ```

2. **Prisma Clientを再生成**:
   ```bash
   pnpm db:generate
   ```

3. **データベースをリセット**（開発環境のみ）:
   ```bash
   pnpm db:reset
   ```

### pnpm installが失敗する

**症状**: `ERR_PNPM_OUTDATED_LOCKFILE`

**解決策**:

1. **lockfileを更新**:
   ```bash
   pnpm install --no-frozen-lockfile
   ```

2. **キャッシュをクリア**:
   ```bash
   pnpm store prune
   pnpm install
   ```

### HMRが動作しない

**症状**: コード変更が反映されない

**解決策**:

1. **開発サーバーを再起動**:
   ```bash
   # Ctrl+C で停止後
   pnpm dev
   ```

2. **共有パッケージの変更の場合**:
   ```bash
   # packages/server-coreで変更した場合
   cd packages/server-core
   pnpm build

   # ルートに戻って開発サーバー再起動
   cd ../..
   pnpm dev
   ```

### Turborepoのキャッシュをクリアしたい

**症状**: 古いビルド結果が使われている

**解決策**:

```bash
# Turborepoキャッシュを削除
rm -rf .turbo

# ビルド成果物も削除
pnpm clean

# 再ビルド
pnpm build
```

## 環境変数リファレンス

### ルート/.env（必須）

| 変数名 | デフォルト値 | 説明 |
|-------|------------|------|
| `DATABASE_URL` | postgresql://postgres:postgres@localhost:35432/einja_main | データベース接続URL（ポート35432固定） |
| `AUTH_SECRET` | - | NextAuth.jsのシークレットキー |
| `AUTH_URL` | http://localhost:3000 | NextAuth.jsのベースURL |

### ルート/.env.local（オプション）

個人の開発環境に応じて作成。Gitには含まれません。Worktree環境では自動生成されます。

| 変数名 | 例 | 説明 |
|-------|-----|------|
| `PORT_WEB` | 3122 | Webアプリのポート（Worktreeで自動計算） |
| `PORT_ADMIN` | 4122 | 管理画面のポート（Worktreeで自動計算） |
| `DATABASE_URL` | postgresql://...einja_feature_auth | データベース接続URL（Worktreeでdatabase名が自動設定） |

### apps/*/.env.local（オプション）

特定のアプリケーションのみに適用する設定。通常は不要です。

```bash
# apps/web/.env.local の例
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 次のステップ

環境構築が完了したら、以下のドキュメントも参照してください：

- **[タスク実行ガイド](./task-execute.md)**: /task-execコマンドの使用方法
- **[アーキテクチャ設計書](../specs/tasks/monorepo/20251104-monorepo-turborepo-nextjs-setup/design/architecture.md)**: システム構成の詳細
- **[技術仕様書](../specs/tasks/monorepo/20251104-monorepo-turborepo-nextjs-setup/requirements/technical.md)**: 技術要件の詳細

## 質問・サポート

開発環境構築で困ったことがあれば、以下を確認してください：

1. このドキュメントのトラブルシューティングセクション
2. プロジェクトのREADME.md
3. GitHub Issuesで既存の問題を検索
4. チームメンバーに相談
