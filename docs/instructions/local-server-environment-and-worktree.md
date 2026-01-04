# ローカル開発サーバー環境構築ガイド（Worktree対応）

## クイックスタート（推奨）

すぐに開発を始めたい場合は、以下のコマンドを実行してください。

```bash
pnpm install
pnpm dev  # これだけでOK（.env自動生成、DB起動、マイグレーション実行）
```

**初回のみ秘密情報の設定が必要です:**
```bash
cp .env.local.example .env.local
# .env.localを編集して秘密情報を設定
```

以下、詳細な手順とトラブルシューティングを記載しています。

---

## 概要

このプロジェクトは、Turborepo + Next.jsを使用したモノレポ構成のアプリケーションです。本ドキュメントでは、ローカル開発サーバーの起動、環境変数管理、Worktree環境での並行開発まで、開発メンバーが迷わず環境構築できるように手順を説明します。

### プロジェクト構成

- **apps/web**: エンドユーザー向けWebアプリケーション (Next.js App Router)
- **packages/config**: 共通設定（TypeScript, Biome, Panda CSS, Worktree設定）
- **packages/database**: Prismaスキーマとクライアント
- **packages/auth**: NextAuth設定と認証ロジック
- **packages/ui**: 共通UIコンポーネント

## 必要な環境

開発を始める前に、以下の環境を準備してください。

| ソフトウェア | バージョン | インストール確認コマンド |
|------------|----------|---------------------|
| Node.js | 22.x以上 | `node --version` |
| pnpm | 10.x以上 | `pnpm --version` |
| Docker | 24.x以上 | `docker --version` |
| Docker Compose | 2.x以上 | `docker compose version` |
| Git | 2.x以上 | `git --version` |

### インストール方法

#### Node.js & pnpm
```bash
# Node.jsのインストール（推奨: Volta使用）
volta install node@22
volta install pnpm@10

# または fnm/nvm を使用
fnm install 22
fnm use 22
npm install -g pnpm@10
```

#### Docker
- macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- Linux: [Docker Engine](https://docs.docker.com/engine/install/)

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd <project-name>
```

### 2. 依存関係のインストール

```bash
pnpm install
```

このコマンドで、ルートおよびすべてのワークスペース（apps/*, packages/*）の依存関係が一括インストールされます。

### 3. 開発サーバーの起動

```bash
pnpm dev
```

**このコマンドは以下を自動実行します：**
1. ブランチ名からポート番号を自動計算
2. `.env.example`をベースに`.env`を自動生成
3. PostgreSQLコンテナを起動（未起動の場合）
4. データベースを作成（存在しない場合）
5. Prismaマイグレーション実行
6. 全アプリケーションの開発サーバー起動

### 4. 秘密情報の設定（初回のみ）

GitHub MCPやOAuth認証を使用する場合は、`.env.local`を作成します：

```bash
cp .env.local.example .env.local
# エディタで.env.localを開き、秘密情報を設定
```

## 環境変数ファイル

### ファイルの責務

| ファイル | 責務 | git管理 | 生成方法 |
|---------|------|--------|---------|
| `.env.example` | `.env`生成のテンプレート | ✅ | 手動作成 |
| `.env` | ブランチ固有の環境変数 | ❌ | `pnpm dev`で自動生成 |
| `.env.local.example` | `.env.local`の参考テンプレート | ✅ | 手動作成 |
| `.env.local` | マシン固有の秘密情報 | ❌ | `.env.local.example`からコピー |

### ファイル関係図

```
[git管理]                      [git管理外]

.env.example ──[pnpm dev]───→ .env（自動生成）
                                    ↓
                              Next.js起動時にマージ
                                    ↓
.env.local.example ──[手動コピー]→ .env.local ──→ 最終的な環境変数
```

### 環境変数の優先順位

環境変数は以下の優先順位で読み込まれます（下にいくほど優先度が高い）：

1. **ルート/.env** - 全アプリ共通の基本設定（自動生成）
2. **ルート/.env.local** - 開発者個人のカスタム設定・秘密情報（gitignore対象）

## 開発モード

### 統合開発コマンド（`pnpm dev`）

**用途**: すべての開発作業（単一ブランチ・Worktree問わず）

```bash
pnpm dev
```

#### 特徴:
- ブランチ名からポート番号を自動計算（Worktree対応）
- `.env`を自動生成（毎回上書き）
- PostgreSQL自動起動・データベース自動作成
- マイグレーション自動実行
- 全アプリケーションを同時起動
- HMR（Hot Module Replacement）対応

#### ポート番号の採番ルール:

ブランチ名から決定論的にポート番号を計算します。同じブランチ名なら常に同じポート番号が割り当てられます。

```typescript
// scripts/worktree/dev.tsの実装
1. ブランチ名のSHA-256ハッシュを生成（例: "feature/auth" → "7a3d...")
2. ハッシュの最初の8文字を16進数として数値化
3. 各アプリのポート番号を計算:
   - PORT_WEB: hashNum % rangeSize + portRangeStart
```

**採番の特徴:**
- ブランチ名が同じなら常に同じポート番号（再現性）
- PostgreSQLは全ワークツリーで共有（リソース節約）
- database名で完全に分離（データの独立性を保証）

#### ポート番号とデータベースの例:

| ブランチ名 | PORT_WEB | PostgreSQL | Database |
|----------|----------|------------|----------|
| main | 3195 | (設定ファイルのポート) | main |
| feature/auth | 3122 | (設定ファイルのポート) | feature_auth |
| feature/payment | 3087 | (設定ファイルのポート) | feature_payment |

### その他のコマンド

```bash
# 環境準備のみ（devサーバー起動しない）
pnpm env:prepare

# 環境準備をスキップして直接起動
pnpm dev:skip-setup
```

## Worktree設定のカスタマイズ

### worktree.config.json

プロジェクトルートの`worktree.config.json`でポート番号やコンテナ名をカスタマイズできます。

```json
{
  "schemaVersion": 1,
  "postgres": {
    "port": 25432,
    "containerName": "myproject-postgres"
  },
  "apps": [
    { "id": "web", "portRangeStart": 3000, "rangeSize": 1000 }
  ]
}
```

#### 設定項目

| 項目 | 説明 | デフォルト値 |
|------|------|-------------|
| `postgres.port` | PostgreSQLの公開ポート | 25432 |
| `postgres.containerName` | Dockerコンテナ名 | einja-management-postgres |
| `apps[].id` | アプリケーションID | web |
| `apps[].portRangeStart` | ポート範囲の開始値 | 3000 |
| `apps[].rangeSize` | ポート範囲のサイズ | 1000 |

**新規アプリ追加**: `apps`配列に追加するだけで対応可能（コード変更不要）

## Worktree環境でのセットアップ

### 新しいWorktreeを作成して開発

```bash
# 新しいWorktreeを作成
git worktree add ../project-feature-auth feature/auth

# Worktreeディレクトリに移動
cd ../project-feature-auth

# 依存関係インストール（必要に応じて）
pnpm install

# 開発サーバー起動（全自動）
pnpm dev
```

起動時の出力例：

```
現在のブランチ: feature/auth
データベース名: feature_auth
計算されたポート: { web: 3122 }
使用するポート: { web: 3122 }
.envに書き込みました
✅ PostgreSQLは既に起動しています
🗄️  データベース「feature_auth」を確認中...
📦 データベース「feature_auth」を作成します...
✅ データベース「feature_auth」を作成しました
🔄 マイグレーションを実行します...
✅ マイグレーション完了

===========================================
Worktree環境設定完了
===========================================
  Web:        http://localhost:3122
  PostgreSQL: localhost:25432
  Database:   feature_auth
  PORT_WEB: 3122
===========================================

🚀 開発サーバーを起動します...
```

### PostgreSQL設定との連携

`pnpm dev`は、PostgreSQLを自動管理します（共有インスタンス方式）。

**アーキテクチャ:**
- **PostgreSQLコンテナ**: 全ワークツリーで共有（1インスタンス）
- **ポート**: `worktree.config.json`で設定（デフォルト: 25432）
- **データ分離**: database名で分離（`main`, `feature_auth`など）

**自動実行される処理:**

1. **環境変数の自動設定**（.envに書き込み）
   - `PORT_WEB`: 計算されたWebポート番号
   - `DATABASE_URL`: `postgresql://...@localhost:<port>/<database_name>`
   - `NEXTAUTH_URL`: `http://localhost:<port>`

2. **PostgreSQLコンテナの起動確認**
   - コンテナが起動していなければ `docker compose up -d postgres` を実行
   - 設定されたポートとコンテナ名を使用

3. **ヘルスチェック**
   - 最大30秒間、PostgreSQLの起動を待機
   - `pg_isready`コマンドで接続確認

4. **データベースの自動作成**
   - ブランチ名からdatabase名を生成（例: `feature_auth`）
   - 存在しなければ `CREATE DATABASE` で自動作成

## よく使うコマンド一覧

### 開発サーバー

```bash
# 全自動で開発サーバー起動（推奨）
pnpm dev

# 環境準備のみ（devサーバー起動しない）
pnpm env:prepare

# 環境準備をスキップして直接起動
pnpm dev:skip-setup
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
pnpm lint:fix

# フォーマット（Biome）
pnpm format
pnpm format:fix

# 型チェック
pnpm typecheck
```

### テスト

```bash
# ユニットテスト
pnpm test

# ウォッチモード
pnpm test:watch

# UIモード
pnpm test:ui

# カバレッジ付きテスト
pnpm test:coverage
```

### データベース操作

```bash
# Prisma Clientを生成
pnpm db:generate

# スキーマをDBに反映（開発用）
pnpm db:push

# マイグレーション作成・実行
pnpm db:migrate

# Prisma Studioを起動（GUI）
pnpm db:studio
```

### Docker操作

```bash
# PostgreSQL起動
docker compose up -d postgres

# PostgreSQL停止
docker compose down

# ログ確認
docker compose logs -f postgres

# コンテナ状態確認
docker compose ps
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
   ```

2. **自動でリトライ**:
   `pnpm dev`は衝突を検出すると自動的に別のポートを試行します。

### PostgreSQLに接続できない

**症状**: `Error: Can't reach database server at localhost:25432`

**原因**: PostgreSQLが起動していない、またはポート設定が間違っています。

**解決策**:

1. **Dockerコンテナの状態確認**:
   ```bash
   docker compose ps
   ```

2. **PostgreSQLを再起動**:
   ```bash
   docker compose down
   docker compose up -d postgres
   ```

3. **ログを確認**:
   ```bash
   docker compose logs postgres
   ```

4. **ポート番号を確認**:
   `worktree.config.json`の`postgres.port`が正しいか確認してください。

### Prismaマイグレーションが失敗する

**症状**: `Error: P1001: Can't reach database server`

**解決策**:

1. **DATABASE_URLを確認**:
   ```bash
   cat .env | grep DATABASE_URL
   ```

2. **Prisma Clientを再生成**:
   ```bash
   pnpm db:generate
   ```

3. **環境を再セットアップ**:
   ```bash
   pnpm env:prepare
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
   パッケージを再ビルドしてから開発サーバーを再起動します。

### Turborepoのキャッシュをクリアしたい

**症状**: 古いビルド結果が使われている

**解決策**:

```bash
# Turborepoキャッシュを削除
rm -rf .turbo

# 再ビルド
pnpm build
```

## 環境変数リファレンス

### .env（自動生成）

| 変数名 | 説明 | 例 |
|-------|------|-----|
| `DATABASE_URL` | データベース接続URL | postgresql://...@localhost:25432/main |
| `NEXTAUTH_SECRET` | NextAuth.jsのシークレットキー | (自動生成) |
| `NEXTAUTH_URL` | NextAuth.jsのベースURL | http://localhost:3122 |
| `PORT_WEB` | Webアプリのポート | 3122 |
| `PORT` | 後方互換性用ポート | 3122 |

### .env.local（手動設定）

| 変数名 | 説明 | 例 |
|-------|------|-----|
| `GITHUB_TOKEN` | GitHub MCP接続用トークン | ghp_xxx |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | xxx.apps.googleusercontent.com |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | xxx |

## 次のステップ

環境構築が完了したら、以下のドキュメントも参照してください：

- **[タスク実行ガイド](./task-execute.md)**: /task-execコマンドの使用方法
- **[コーディング規約](../coding-standards.mdc)**: コードスタイルと規約
- **[テストガイドライン](../testing.mdc)**: Vitestを使用したテスト戦略

## 質問・サポート

開発環境構築で困ったことがあれば、以下を確認してください：

1. このドキュメントのトラブルシューティングセクション
2. プロジェクトのREADME.md
3. GitHub Issuesで既存の問題を検索
4. チームメンバーに相談
