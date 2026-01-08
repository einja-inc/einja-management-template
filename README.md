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
│       │   ├── components/       # アプリ固有のコンポーネント
│       │   └── lib/
│       │       ├── auth/         # アプリ固有の認証設定
│       │       └── ...           # アプリ固有のユーティリティ
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── config/                   # 共通設定（Biome, TypeScript, Panda CSS）
│   ├── front-core/               # フロントエンド共通層
│   │   └── src/
│   │       ├── auth/             # NextAuth共通設定・型定義
│   │       ├── hooks/            # 共通hooks
│   │       ├── utils/            # 共通ユーティリティ
│   │       └── context/          # 共通context
│   ├── server-core/              # バックエンド共通層
│   │   ├── prisma/               # Prismaスキーマ
│   │   └── src/
│   │       ├── domain/           # ドメイン層
│   │       ├── infrastructure/   # Prismaクライアント等
│   │       └── utils/            # 共通ユーティリティ
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

### 環境変数の管理

対話式ウィザードで環境変数を設定・変更できます：

```bash
pnpm env:update
```

#### メニュー

1. **個人トークンを設定** - `GITHUB_TOKEN` 等の個人用トークンを `.env.personal` に設定
2. **環境設定を変更** - 各環境の暗号化された設定ファイルを編集
3. **現在の状態を確認** - 環境変数の設定状況を表示

#### 対応環境

| 環境 | ファイル | 用途 |
|------|----------|------|
| ローカル開発 | `.env.local` | ローカル開発環境 |
| 開発 | `.env.development` | 開発環境 |
| ステージング | `.env.staging` | ステージング環境 |
| 本番 | `.env.production` | 本番環境 |
| CI | `.env.ci` | CI環境 |

> **Note**: 環境設定の変更には `.env.keys` の秘密鍵が必要です。本番環境の変更時は追加の確認が表示されます。

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
pnpm --filter @repo/web dev
pnpm --filter @repo/web build
pnpm --filter @repo/web panda codegen
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

- **@repo/config**: Biome, TypeScript, Panda CSSの共通設定
- **@repo/front-core**: フロントエンド共通層（認証共通設定、hooks、utils、context）
- **@repo/server-core**: バックエンド共通層（Prismaクライアント・スキーマ、ドメインロジック）
- **@repo/ui**: 共通UIコンポーネント（shadcn/ui）
- **@einja/cli**: Claude Code設定配布CLI（[詳細](./packages/cli/README.md)）

## CLI パッケージ (@einja/cli)

Claude Code用の`.claude`設定ディレクトリを配布するCLIツールです。

```bash
# 新規プロジェクトへのセットアップ
npx @einja/cli init
```

### 配布内容

- `.claude/` - エージェント、コマンド、スキル、hooks
- `docs/einja/` - テンプレート、ステアリングドキュメント
- `CLAUDE.md` - プロジェクト設定テンプレート

### 関連ドキュメント

- [CLI README](./packages/cli/README.md) - 使用方法
- [ビルドプロセス](./packages/cli/docs/BUILD.md) - ビルドパイプラインの説明
- [NPM公開手順](./packages/cli/docs/PUBLISHING.md) - リリース手順
- [リリース手順](./packages/cli/RELEASING.md) - バージョン管理とタグプッシュ

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
pnpm --filter @repo/web panda codegen
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

- [コーディング規約](./.claude/skills/einja/coding-standards/SKILL.md)
- [コンポーネント設計ガイドライン](./.claude/skills/einja/component-design/SKILL.md)
- [テスト戦略](./docs/einja/steering/development/testing-strategy.md)
- [コードレビューガイドライン](./docs/einja/steering/development/review-guidelines.md)
- [コミットルール](./docs/einja/steering/commit-rules.md)

## ライセンス

Proprietary
