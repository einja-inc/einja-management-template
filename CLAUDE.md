# Claude Code 指示書
- 回答は日本語で行ってください。
- 必ずこのドキュメントの通りに作業を行ってください。

## プロジェクト構成

このプロジェクトは**Turborepo**を使用したモノレポ構成になっています。

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

## 開発環境セットアップ

### データベース起動（PostgreSQL）:
```bash
# PostgreSQLコンテナを起動（ポート25432）
docker-compose up -d postgres

# データベースの状態確認
docker-compose ps

# データベース停止
docker-compose down
```

**注意**: DockerのPostgreSQLはポート**25432**を使用します（全ワークツリーで共有）。

### アプリケーション開発:
```bash
# 依存関係のインストール（pnpm使用）
pnpm install

# 初回セットアップ（.env作成、DB起動・初期化）
pnpm dev:setup

# 開発サーバー起動（バックグラウンド実行・ログはlog/dev.logに出力）
pnpm dev:bg
```

> **注意**: `pnpm dev:setup` は初回のみ必要です。2回目以降は `pnpm dev:bg` のみで起動できます。

### 開発サーバー管理:
```bash
pnpm dev:bg      # バックグラウンドで起動（推奨）
pnpm dev:status  # サーバーの状態確認
pnpm dev:logs    # ログをリアルタイム表示
pnpm dev:stop    # サーバーを停止
pnpm dev         # フォアグラウンドで起動（ターミナル直接操作時のみ）
```

### Worktree開発（複数ブランチ並行開発）:

Git worktreeを使用して複数のブランチを並行して開発する場合、以下のコマンドを使用します。

```bash
# Worktree環境をセットアップして開発サーバーを起動（推奨）
pnpm dev:bg

# セットアップのみ（開発サーバーは手動で起動）
pnpm env:prepare
```

**仕組み:**
- ブランチ名からSHA-256ハッシュを計算し、一意なポート番号を自動割り当て（3000-3999）
- PostgreSQLは全ワークツリーで共有（ポート25432固定）
- データベース名はブランチ名から自動生成（例: `main`, `feature_auth`）
- `.env.local`に環境変数が自動設定される

**ポート番号の例:**
| ブランチ名 | Webポート | データベース |
|-----------|----------|-------------|
| main | 3195 | main |
| feature/auth | 3122 | feature_auth |

### 主要な開発コマンド:
- `pnpm dev:bg` - 開発サーバーをバックグラウンドで起動（推奨・ログはlog/dev.log）
- `pnpm dev:status` - 開発サーバーの状態確認
- `pnpm dev:stop` - 開発サーバーを停止
- `pnpm build` - 全アプリのプロダクションビルド
- `pnpm start` - プロダクションサーバーを起動

### コード品質チェックコマンド:
- `pnpm lint` - Biome linterでコードをチェック（全ワークスペース）
- `pnpm lint:fix` - Biomeで自動的にlintの問題を修正
- `pnpm format` - Biomeでコードフォーマットをチェック
- `pnpm format:fix` - Biomeでコードを自動フォーマット
- `pnpm typecheck` - TypeScriptの型チェック（全ワークスペース）

### テスト:
- `pnpm test` - Vitestでテスト実行（全ワークスペース）
- `pnpm test:watch` - Vitestウォッチモード
- `pnpm test:ui` - Vitest UIモード
- `pnpm test:coverage` - カバレッジ付きテスト
- Playwrightで Chromiumブラウザーテスト

## アーキテクチャ

### モノレポ構成:
- **Turborepo** による高速ビルド・タスク実行
- **pnpm workspaces** によるパッケージ管理
- ワークスペース間の依存関係管理

### パッケージ構成:
- `@einja/config` - 共通設定（Biome, TypeScript, Panda CSS）
- `@einja/types` - 型定義（NextAuth型拡張など）
- `@einja/database` - Prismaクライアントとスキーマ
- `@einja/auth` - NextAuth設定と認証ガード
- `@einja/ui` - 共通UIコンポーネント（shadcn/ui）
- `@einja/web` - メイン管理画面アプリケーション

### スタイリングシステム:
- **Panda CSS** でデザイントークンとレシピを使用したスタイリング
- タイプセーフなスタイル生成によるCSS-in-JS
- スタイルコンポーネントは `apps/web/src/styled-system/` ディレクトリに出力
- カスタムブレークポイント: sm(640px), md(768px), lg(1024px), xl(1280px), 2xl(1440px)

### コード品質:
- **Biome** でlintingとフォーマット（タブインデント、ダブルクォート）
- Huskyのpre-commitフックとlint-staged
- `styled-system/` ディレクトリをフォーマット/lintingから除外

### フレームワーク設定:
- Next.js 15 with App Router
- React 19
- TypeScript（strict型チェック）
- pnpmによるパッケージ管理
- Voltaまたはfnmを使用したNode.jsバージョン管理 (v22.16.0)

### 特記事項:
- プロダクションビルド前に必ず`panda codegen`を実行
- Biomeはタブインデントとダブルクォートを使用
- ビルド時はESLintを無効化（代わりにBiomeを使用）
- Turborepoのキャッシュ機能で高速ビルド

## インポートパスの規約

### パッケージ間のインポート
```typescript
// 認証機能
import { auth, signIn, signOut } from "@einja/auth";
import { requireAuth, withAuth } from "@einja/auth/guard";

// データベース
import { prisma, User, Post } from "@einja/database";

// UIコンポーネント
import { Button } from "@einja/ui/button";
import { Card } from "@einja/ui/card";
import { cn } from "@einja/ui/utils";

// 型定義
import type { Session } from "@einja/types/next-auth";
```

### アプリ内のインポート
```typescript
// apps/web内では従来通り@/を使用
import { Component } from "@/components/...";
import { helper } from "@/lib/...";
```

## 追加指示

以下のドキュメントも参照して作業を進めてください:

- @docs/coding-standards.mdc - コーディング規約
- @docs/component-design.mdc - コンポーネント設計ガイドライン
- @docs/github-workflow.mdc - GitHubワークフロー・ブランチ戦略
- @docs/testing.mdc - Vitestを使用したテスト戦略とベストプラクティス
- @docs/code-review.mdc - コードレビューのガイドライン
