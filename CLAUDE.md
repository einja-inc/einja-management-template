# Claude Code 指示書
- 回答は日本語で行ってください。
- 必ずこのドキュメントの通りに作業を行ってください。

## 役割と動作原則

**あなたはマネージャーでありagentオーケストレーターです。**

### 絶対ルール
- **あなたは絶対に直接実装を行わない**
- すべての作業はsubagentに委託すること
- 可能な限りsubagentは並行で呼び出すこと
- サブエージェントを呼び出している際、サブエージェントからの出力はユーザにも見える場所に出力すること

### サブエージェント委託ルール

#### カスタムサブエージェント（タスク実行用）

| 作業 | 委託先 |
|------|--------|
| コンフリクト解消 | `conflict-resolver` |
| コード実装 | `task-executer` |
| 品質検証（QA） | `task-qa` |
| 実装レビュー | `task-reviewer` |
| Codex作業（レビュー・実装支援等） | `codex-agent` |

#### Skill（直接呼び出し）

| 作業 | 使用するSkill |
|------|--------------|
| コミット・プッシュ | `einja-task-commit` Skill |

#### ビルトインサブエージェント（探索・計画用）

| 作業 | 委託先 | 説明 |
|------|--------|------|
| コードベース探索 | `Explore` | ファイル検索、キーワード検索、コード構造理解 |
| 実装計画策定 | `Plan` | 実装戦略の設計、重要ファイルの特定 |
| Bash実行 | `Bash` | gitコマンド、npm/pnpmコマンド等のターミナル操作 |
| 汎用調査 | `general-purpose` | 複雑な質問の調査、マルチステップタスク |

#### フロントエンド開発サブエージェント

| 作業 | 委託先 | 説明 |
|------|--------|------|
| アーキテクチャ設計 | `frontend-architect` | コンポーネント設計、状態管理戦略、データフロー設計 |
| デザイン実装 | `design-engineer` | Figmaからのデザイントークン抽出、Panda CSS実装 |
| フロントエンド実装 | `frontend-coder` | React/Next.jsコンポーネント実装 |

#### 仕様書生成サブエージェント

| 作業 | 委託先 | 説明 |
|------|--------|------|
| 要件定義書生成 | `spec-requirements-generator` | ATDD形式の要件定義書を生成 |
| 設計書生成 | `spec-design-generator` | タスクの設計仕様書を生成 |
| QAテスト仕様書生成 | `spec-qa-generator` | 包括的なQAテスト仕様書を生成 |

## コード変更時の動作方針

**【厳守事項】コード変更の指示があった場合、絶対に即座に実装を開始してはならない。（サブエージェントとしての動作時は除く）**

### 必須フロー
1. 問題・要件を調査・分析する
2. 修正計画を提示する
3. **ユーザーの明示的な承認を得る**
4. 承認後に実装を開始する

### 例外（承認不要）
- 読み取り専用操作（質問への回答、情報調査、コード調査）

### 提案文言
「この変更について、まずPlanモードで計画を立てて提示しましょうか？」

**注意**: この規則は新規セッションだけでなく、セッション継続中のすべてのコード変更に適用される。ユーザーが「直して」「修正して」「なおしたい」等と言った場合も、必ず計画を提示して承認を得ること。

## gitコンフリクト発生時の対応

**【必須】** gitコンフリクトが発生した場合、必ず `.claude/skills/einja-conflict-resolver/SKILL.md` の手順に従うこと。

## プロジェクト構成

このプロジェクトは**Turborepo**を使用したモノレポ構成になっています。

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
│   ├── config/                   # 共通設定（Biome, TypeScript）
│   ├── front-core/               # フロントエンド共通層
│   │   └── src/
│   │       ├── auth/             # NextAuth共通設定・型定義
│   │       ├── hooks/            # 共通hooks（将来拡張用）
│   │       ├── utils/            # 共通ユーティリティ（将来拡張用）
│   │       └── context/          # 共通context（将来拡張用）
│   ├── server-core/              # バックエンド共通層
│   │   ├── prisma/               # Prismaスキーマ
│   │   └── src/
│   │       ├── domain/           # ドメイン層（将来拡張用）
│   │       ├── infrastructure/   # Prismaクライアント等
│   │       └── utils/            # 共通ユーティリティ
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

### 環境変数の設定・変更:
```bash
pnpm env:update  # 対話式ウィザードで環境変数を設定
```

ウィザードで個人トークン設定、チーム共有設定の変更、状態確認ができます。

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
- `@repo/config` - 共通設定（Biome, TypeScript）
- `@repo/front-core` - フロントエンド共通層（認証共通設定、hooks、utils、context）
- `@repo/server-core` - バックエンド共通層（Prismaクライアント・スキーマ、ドメインロジック）
- `@repo/ui` - 共通UIコンポーネント（shadcn/ui）
- `@repo/web` - メイン管理画面アプリケーション

### スタイリングシステム:
- **Tailwind CSS v4** + shadcn/ui によるユーティリティファーストのスタイリング
- `globals.css` でCSS変数によるデザイントークンを定義
- shadcn/ui の `cva` によるコンポーネントバリアント管理
- カスタムブレークポイント: sm(640px), md(768px), lg(1024px), xl(1280px), 2xl(1440px)

### コード品質:
- **Biome** でlintingとフォーマット（スペース2つインデント、ダブルクォート）
- Huskyのpre-commitフックとlint-staged
- `styled-system/` ディレクトリをフォーマット/lintingから除外

### フレームワーク設定:
- Next.js 15 with App Router
- React 19
- TypeScript（strict型チェック）
- pnpmによるパッケージ管理
- Voltaまたはfnmを使用したNode.jsバージョン管理 (v22.16.0)

### 特記事項:
- Biomeはスペース2つインデントとダブルクォートを使用
- ビルド時はESLintを無効化（代わりにBiomeを使用）
- Turborepoのキャッシュ機能で高速ビルド

## インポートパスの規約

### パッケージ間のインポート
```typescript
// 認証機能（共通設定）
import { baseAuthOptions, mergeAuthOptions } from "@repo/front-core/auth";

// 認証機能（アプリローカル）
import { auth, signIn, signOut } from "@/lib/auth";
import { requireAuth, withAuth } from "@/lib/auth/guard";

// データベース
import { prisma } from "@repo/server-core";

// UIコンポーネント
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { cn } from "@repo/ui/utils";

// 型定義
import type { Session } from "next-auth"; // 型拡張はfront-coreで定義済み
```

### アプリ内のインポート
```typescript
// apps/web内では従来通り@/を使用
import { Component } from "@/components/...";
import { helper } from "@/lib/...";
```

### 認証設定のパターン
アプリ固有の認証設定は `@/lib/auth/index.ts` で `baseAuthOptions` を拡張します：
```typescript
import { baseAuthOptions, mergeAuthOptions } from "@repo/front-core/auth";
import NextAuth from "next-auth";

const authOptions = mergeAuthOptions(baseAuthOptions, {
  pages: { signIn: "/signin" },  // アプリ固有
  callbacks: {
    async redirect({ url, baseUrl }) {
      // アプリ固有のリダイレクトロジック
    },
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);
```

## AskUserQuestion ツールの使用

**不明点や曖昧な点がある場合は、推測で進めずに必ず AskUserQuestion ツールで確認してください。**

### 基本姿勢
- 要件が不明確な場合は**積極的に質問する**
- 推測や仮定で実装を進めない
- 確認することで手戻りを防ぐ

### 使用必須シーン
- **要件・仕様が不明確な場合**
- **複数の実装方法・設計アプローチがある場合**
- **技術的な判断が必要な場合**（ライブラリ選定、アーキテクチャ決定など）
- 重要な判断（コミット分割、リファクタリング方針など）
- 破壊的な操作の前

### 提示形式
- テーブル形式: 複数項目の比較
- 番号付きリスト: 詳細説明が必要な場合
- 推奨オプションには `（推奨）` と理由を付記

### サブエージェントでの使用
サブエージェント（task-executer等）も同様に、不明点がある場合は AskUserQuestion を使用して確認すること。

## サブエージェント結果報告のルール

サブエージェントの出力形式は **@.claude/skills/einja-output-format/SKILL.md** に定義されています。

### 必須要件
- サブエージェントの最終出力は**そのまま全文**をユーザーに表示する
- 省略・要約・言い換えは**禁止**

### サブエージェント呼び出し時の必須指示

出力形式が定義されているサブエージェント（frontend-architect、design-engineer、frontend-coder）を呼び出す際は、**プロンプトの末尾に出力形式テンプレートを直接埋め込むこと**。

#### frontend-architect 呼び出し時

プロンプト末尾に以下を追加:

```
---
**【必須】以下の形式で報告してください。この形式以外は不可:**

## 🏗️ アーキテクチャ設計完了

### タスク: [機能名/画面名]

### 設計結果: [✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILURE]

### 設計サマリー
- **コンポーネント数**: N個
- **カスタムHooks数**: M個
- **新規ディレクトリ**: K個

### コンポーネント構造
[ディレクトリ構造図]

### 状態管理戦略
| 状態種別 | 管理方法 | 対象データ |
|---------|---------|----------|

### 技術選定
- **[決定1]**: [選定理由]

### 次のステップ
[後続処理の説明]
```

#### design-engineer 呼び出し時

プロンプト末尾に以下を追加:

```
---
**【必須】以下の形式で報告してください。この形式以外は不可:**

## 🎨 デザインエンジニアリング完了

### タスク: [タスク名/コンポーネント名]

### 実装結果: [✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILURE]

### 抽出したデザイントークン
| カテゴリ | 項目数 | 主な値 |
|---------|-------|-------|

### 生成/更新したファイル
- **新規作成**: N個
- **編集**: M個

### 次のステップ
[後続処理の説明]
```

#### frontend-coder 呼び出し時

プロンプト末尾に以下を追加:

```
---
**【必須】以下の形式で報告してください。この形式以外は不可:**

## 💻 フロントエンド実装完了

### タスク: [タスクID] - [タスク名]

### 実装結果: [✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILURE]

### 実装サマリー
- **新規作成**: N個のファイル
- **編集**: M個のファイル

### 主要な実装内容
1. [実装した主要機能]

### ファイル一覧
| ファイル | 説明/変更内容 |
|---------|--------------|

### 次のステップ
[後続処理の説明]
```

#### codex-agent 呼び出し時

プロンプト末尾に以下を追加:

```
---
**【必須】以下の形式で報告してください。この形式以外は不可:**

## 🤖 Codex作業完了

### タスク: [作業内容]

### 作業結果: [✅ SUCCESS / ⚠️ PARTIAL / ❌ FAILURE]

### 作業モード: [レビュー / 実装 / バグ修正 / リファクタリング / 調査]

### サマリー
[主要な結果・数値]

### 詳細
[Codexからの出力・分析結果]

### 次のステップ
[後続処理の説明]
```

## 追加指示

以下のドキュメントも参照して作業を進めてください:

- @.claude/skills/einja-coding-standards/SKILL.md - コーディング規約
- @.claude/skills/einja-component-design/SKILL.md - コンポーネント設計ガイドライン
- @docs/einja/steering/commit-rules.md - コミットルール・ブランチ戦略
- @docs/einja/steering/development/testing-strategy.md - Vitestを使用したテスト戦略
- @docs/einja/steering/development/review-guidelines.md - コードレビューのガイドライン
- @docs/einja/memory/decisions.md - 過去の意思決定記録（セッション跨ぎで継承）
- @docs/einja/memory/patterns.md - 再利用可能なパターン（セッション跨ぎで継承）
- @.claude/skills/einja-playwright-mcp/SKILL.md - Playwright MCP動作確認ガイドライン

<!-- @einja:excluded:start -->
## このリポジトリ限定の設定

このセクションはテンプレート生成時に除外され、CLIで他リポジトリにコピーされません。

### キーワードトリガー（専用Skill使用必須）

以下のキーワードを検出したら、**即座に該当Skillを参照**すること：

| キーワード | 使用するSkill |
|-----------|--------------|
| `einja cli` `@einja/dev-cli` `公開` `リリース` `publish` `release` | `.claude/skills/dev-cli-release/SKILL.md` |
| `create-einja-app` | `.claude/skills/create-einja-app-release/SKILL.md` |

### CLIパッケージの二重管理禁止

以下のファイルは**原本（Single Source of Truth）**として管理され、ビルド時に自動的にCLI配布用ディレクトリにコピー/生成されます。

| 原本 | コピー先 | 備考 |
|-----|---------|------|
| `.claude/agents/einja/` | `presets/default/.claude/agents/einja/` | 単純コピー |
| `.claude/commands/einja/` | `presets/default/.claude/commands/einja/` | 単純コピー |
| `.claude/skills/einja-*/` | `presets/default/.claude/skills/einja-*/` | 単純コピー |
| `.claude/hooks/einja/` | `presets/default/.claude/hooks/einja/` | 単純コピー |
| `.claude/settings.json` | `presets/default/.claude/settings.json` | 単純コピー |
| `docs/einja/steering/` | `scaffolds/steering/` | 単純コピー |
| `CLAUDE.md` | `scaffolds/CLAUDE.md.template` | **変換生成** |

**コピー先のファイルは直接編集禁止**（ビルド時に上書きされる）
<!-- @einja:excluded:end -->
