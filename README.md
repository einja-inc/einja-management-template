# einja-management-template

いいんじゃ管理画面テンプレート - Turborepo + pnpm モノレポ構成

## プロジェクト構成

このプロジェクトは**Turborepo**を使用したモノレポ構成です。

```
einja-management-template/
├── apps/
│   └── web/                      # メイン管理画面アプリ
│       ├── src/
│       │   ├── app/              # Next.js App Router
│       │   ├── components/        # アプリ固有のコンポーネント
│       │   └── lib/              # アプリ固有のユーティリティ
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── config/                   # 共通設定（Biome, TypeScript, Panda CSS）
│   ├── types/                    # 共通型定義
│   ├── database/                 # Prismaスキーマとクライアント
│   ├── auth/                     # NextAuth設定と認証ロジック
│   └── ui/                       # 共通UIコンポーネント（shadcn/ui）
├── turbo.json                    # Turborepoの設定
├── pnpm-workspace.yaml          # pnpmワークスペース設定
└── package.json                  # ルートpackage.json
```

## 技術スタック

- **モノレポ**: Turborepo + pnpm workspaces
- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript (strict mode)
- **スタイリング**: Panda CSS
- **UI**: shadcn/ui + Radix UI
- **データベース**: PostgreSQL + Prisma
- **認証**: NextAuth.js v5
- **状態管理**: TanStack Query (React Query)
- **テスト**: Vitest + React Testing Library + Playwright
- **Linter/Formatter**: Biome
- **Git Hooks**: Husky + lint-staged

## 開発環境セットアップ

### 初回セットアップ（初めての方）

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd einja-management-template

# 2. Volta/Node/pnpmをインストール（初回のみ）
./scripts/init.sh

# 3. ターミナルを再起動
exec $SHELL

# 4. 環境セットアップ（.env、DB起動・初期化）
pnpm dev:setup

# 5. 開発サーバー起動（バックグラウンド）
pnpm dev:bg
```

ログは `log/dev.log` に出力されます。
ブラウザで http://localhost:3000（またはWorktreeで自動割り当てされたポート）を開く

---

### コマンドの役割

| コマンド | タイミング | 内容 |
|---------|-----------|------|
| `./scripts/init.sh` | 初回のみ | Volta/Node/pnpmのインストール |
| `pnpm dev:setup` | 初回 + 環境変更時 | .env作成、DB起動・初期化 |
| `pnpm dev:bg` | 毎回 | 開発サーバー起動（バックグラウンド・推奨） |
| `pnpm dev:status` | 随時 | 開発サーバーの状態確認 |
| `pnpm dev:stop` | 随時 | 開発サーバーを停止 |
| `pnpm env:update` | 随時 | 環境変数の設定・変更（対話式ウィザード） |

## 主要コマンド

### 開発

```bash
pnpm dev:bg           # 開発サーバーをバックグラウンドで起動（推奨）
pnpm dev:status       # 開発サーバーの状態確認
pnpm dev:logs         # ログをリアルタイム表示
pnpm dev:stop         # 開発サーバーを停止
pnpm dev              # フォアグラウンドで起動（ターミナル直接操作時のみ）
pnpm build            # 全アプリのプロダクションビルド
pnpm start            # プロダクションサーバーを起動
```

### コード品質

```bash
pnpm lint             # Biome linterでコードをチェック
pnpm lint:fix         # Biomeで自動的にlintの問題を修正
pnpm format           # Biomeでコードフォーマットをチェック
pnpm format:fix       # Biomeでコードを自動フォーマット
pnpm typecheck        # TypeScriptの型チェック
```

### テスト

```bash
pnpm test             # Vitestでテスト実行
pnpm test:watch       # Vitestウォッチモード
pnpm test:ui          # Vitest UIモード
pnpm test:coverage    # カバレッジ付きテスト
```

### データベース

```bash
pnpm db:generate      # Prismaクライアント生成
pnpm db:push          # データベースマイグレーション
pnpm db:migrate       # マイグレーションファイル作成＆実行
pnpm db:studio        # Prisma Studio起動
```

### ワークスペース固有のコマンド

```bash
# 特定のワークスペースでコマンド実行
pnpm --filter @einja/web dev
pnpm --filter @einja/web build
pnpm --filter @einja/web panda codegen
```

## データベース設定

### Docker Compose サービス

- **postgres**: PostgreSQL 15
  - ポート: `${POSTGRES_PORT:-25432}` (ホスト) → 5432 (コンテナ)
  - データベース: ブランチ名から自動生成（例: `main`, `feature_auth`）
  - ユーザー: `postgres`
  - パスワード: `postgres`

### 便利なコマンド

```bash
# ログを確認
docker-compose logs -f postgres

# データベースに直接接続
docker-compose exec postgres psql -U postgres -d einja_management

# データベースをリセット
docker-compose down -v
docker-compose up -d postgres
pnpm db:push

# Prisma Studio を起動
pnpm db:studio
```

## ディレクトリ構造の詳細

### apps/web

メイン管理画面アプリケーション

- **src/app**: Next.js App Router（ページ、レイアウト、API）
- **src/components**: アプリ固有のコンポーネント
  - `ui/`: 基本的なUIコンポーネント
  - `shared/`: 共通コンポーネント（Header, Sidebarなど）
- **src/lib**: ユーティリティ、認証設定など

### packages

- **@einja/config**: Biome, TypeScript, Panda CSSの共通設定
- **@einja/types**: 型定義（NextAuth型拡張など）
- **@einja/database**: Prismaクライアントとスキーマ
- **@einja/auth**: NextAuth設定と認証ガード
- **@einja/ui**: 共通UIコンポーネント（shadcn/ui）

## 開発ワークフロー

1. ブランチを作成
2. コードを変更
3. ホットリロードで即座に反映
4. データベーススキーマを変更した場合は `pnpm db:push`
5. Panda CSSのスタイル変更時は自動生成される
6. コミット前に自動的にlint-stagedが実行される
7. プルリクエストを作成

## トラブルシューティング

### Volta関連エラー

**`zsh: command not found: volta`**

ターミナルを開き直してください。それでも解決しない場合：
```bash
source ~/.zshrc
```

**`Volta error: Node is not available`**

Node.jsがインストールされていません：
```bash
volta install node@22.16.0 pnpm@10.14.0
```

**`pnpm: command not found`**

pnpmがインストールされていません：
```bash
volta install pnpm@10.14.0
```

### Panda CSS関連エラー

```bash
# styled-systemを再生成
pnpm --filter @einja/web panda codegen
```

### Prisma関連エラー

```bash
# Prismaクライアントを再生成
pnpm db:generate

# データベースをリセット
docker-compose down -v
docker-compose up -d postgres
pnpm db:push
```

### 依存関係の問題

```bash
# node_modulesをクリーンアップ
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm pnpm-lock.yaml
pnpm install
```

### Turborepoキャッシュのクリア

```bash
# .turboディレクトリを削除
rm -rf .turbo apps/*/.turbo packages/*/.turbo
```

## コーディング規約

詳細は以下のドキュメントを参照してください：

- [コーディング規約](./docs/coding-standards.mdc)
- [コンポーネント設計ガイドライン](./docs/component-design.mdc)
- [テスト戦略](./docs/testing.mdc)
- [コードレビューガイドライン](./docs/code-review.mdc)
- [GitHubワークフロー](./docs/github-workflow.mdc)

## ライセンス

Proprietary
