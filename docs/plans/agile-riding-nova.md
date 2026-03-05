# Plan: セットアップフロー統合ドキュメント作成

## Context

`scripts/init.sh`、`post-setup.ts`、`setup-dev.ts` など複数のセットアップ関連ファイルがあるが、
**どの操作でどのファイルが呼ばれ何が起きるか**を横断的にまとめたドキュメントが存在しない。
3つのシナリオ（create-einja-app初回 / einja sync / clone後セットアップ）ごとのフローを
mermaid図 + テーブルで整理したドキュメントを作成する。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `docs/einja/instructions/setup-flow.md` | **新規作成** セットアップフロー統合ドキュメント |
| `README.md` | 「パッケージ利用者向け」+「開発環境セットアップ」にドキュメント参照リンクを追加 |

> **NOTE**: `docs/einja/instructions/` はこのリポジトリが原本。ビルド時に `presets/default/` へ自動コピーされ、`einja sync` で各プロジェクトに配布される。直接 `presets/default/` を編集する必要はない。

## TODO

### TODO-1: `docs/einja/instructions/setup-flow.md` 新規作成

3シナリオのセットアップフローを網羅するドキュメントを作成する。

#### ドキュメント構成

```
# セットアップフローガイド

## 概要
  - 3つのシナリオの簡潔な説明

## シナリオ別フロー

### 1. npx create-einja-app（新規プロジェクト作成）
  - mermaid シーケンス図
  - 処理テーブル（ファイル → 処理内容）

### 2. git clone 後の環境構築（既存プロジェクトへの参加）
  - mermaid シーケンス図
  - 処理テーブル

### 3. einja sync（テンプレート同期）
  - mermaid シーケンス図
  - 処理テーブル（dev-cli sync / create-einja-app sync）

## ファイル別リファレンス
  - 各スクリプト/ファイルの役割と呼び出し元の逆引きテーブル

## 処理の重複と設計意図
  - init.sh と dev:setup の重複箇所の説明（冪等性の意図）
```

#### シナリオ1: `npx create-einja-app` フロー

```
ユーザー: npx create-einja-app my-app
  │
  ├── cli.ts → createCommand()
  │     ├── 対話プロンプト（プロジェクト名、スコープ、認証方式等）
  │     ├── generateTemplate() ← generators/template.ts
  │     │     └── テンプレートコピー + 変数置換 + リネーム
  │     └── execPostSetup() ← generators/post-setup.ts
  │           ├── Step 0: bash scripts/init.sh (stdio: inherit)
  │           │     ├── Step 1: Volta インストール（未導入時のみ）
  │           │     ├── Step 2: シェル設定（VOLTA_FEATURE_PNPM）
  │           │     ├── Step 3: Node.js / pnpm インストール
  │           │     ├── Step 4: pnpm install
  │           │     └── Step 5: direnv allow（direnv存在時のみ）
  │           ├── PATH補完（~/.volta/bin を process.env.PATH に追加）
  │           ├── Step 1: pnpm install + pnpm db:generate
  │           ├── Step 2: pnpm env:rotate-secrets --all --non-interactive
  │           ├── Step 3: git init + git add . + git commit
  │           ├── Step 4: npx @einja/dev-cli init（setupEinjaCli=true時のみ）
  │           └── 完了メッセージ表示
```

#### シナリオ2: clone後の環境構築フロー

```
開発者: git clone → cd project
  │
  ├── ./scripts/init.sh（手動実行・初回のみ）
  │     ├── Step 1: Volta インストール
  │     ├── Step 2: シェル設定
  │     ├── Step 3: Node.js / pnpm インストール
  │     ├── Step 4: pnpm install
  │     └── Step 5: direnv allow
  │
  ├── exec $SHELL（ターミナル再起動）
  │
  ├── pnpm dev:setup（= tsx scripts/setup-dev.ts）
  │     ├── Step 1-3: Volta確認 / シェル設定 / Node.js・pnpm インストール
  │     ├── Step 4: direnv インストール（macOS: brew install direnv）
  │     ├── Step 5: direnv hook シェル追記
  │     ├── Step 6: dotenvx インストール
  │     ├── Step 7: .env 作成（.env.local + .env.keys で復号）
  │     ├── Step 8: .env.personal 作成 + GITHUB_TOKEN（対話入力）
  │     ├── Step 9: direnv allow → .envrc評価（Serena MCP自動起動含む）
  │     ├── Step 10: PostgreSQL 起動（docker-compose up -d postgres）
  │     └── Step 11: pnpm db:generate + pnpm db:push
  │
  └── pnpm dev:bg（開発サーバー起動）
```

#### シナリオ3: einja sync フロー

```
開発者: einja sync（Claude Code Skill経由）
  │
  ├── dev-cli sync
  │     ├── 同期対象:
  │     │     ├── .claude/commands/einja/, .claude/agents/einja/
  │     │     ├── .claude/skills/einja-*/, .claude/hooks/
  │     │     ├── docs/einja/, scripts/
  │     │     ├── .envrc（envカテゴリ, 単一ファイル）
  │     │     └── .vscode/settings.json（toolsカテゴリ, 単一ファイル）
  │     ├── マージ: 3方向マージ + マーカーベース
  │     ├── コンフリクト解消（対話式）
  │     └── 依存関係チェック + インストール
  │
  └── create-einja-app sync
        ├── 同期対象: CI/CD, docker, monorepo設定, root config, scripts/
        ├── テンプレート変数置換あり
        └── バックアップ作成 + マージ
```

#### ファイル別リファレンステーブル

| ファイル | 役割 | 呼び出し元 |
|---------|------|-----------|
| `scripts/init.sh` | Volta/Node/pnpm/direnv 初期導入 | create-einja-app (post-setup.ts) / 手動実行 |
| `scripts/setup-dev.ts` | 環境構築一式（.env, DB, direnv等） | `pnpm dev:setup` |
| `scripts/ensure-serena.sh` | Serena MCP サーバー起動 | `.envrc` (direnv) |
| `scripts/env-rotate-secrets.ts` | 秘密鍵ローテーション | create-einja-app (post-setup.ts) / `pnpm env:rotate-secrets` |
| `.envrc` | dotenv読み込み + worktree間.env.personal共有 + Serena MCP起動 | direnv（シェルディレクトリ進入時に自動評価） |
| `generators/post-setup.ts` | プロジェクト作成後のセットアップ | create-einja-app create コマンド |
| `generators/template.ts` | テンプレート展開・変数置換 | create-einja-app create コマンド |
| `generators/sync.ts` | テンプレート同期 | create-einja-app sync コマンド |
| `packages/cli/src/commands/sync.ts` | Claude Code関連ファイル同期 | dev-cli sync コマンド |

### TODO-2: README.md に参照リンク追加

**対象**: `README.md` の「パッケージ利用者向け」セクション（L8付近）

「使い分けガイド」の後に、セットアップフローガイドへの参照を1行追加:

```markdown
> 📖 各シナリオのセットアップで何が実行されるかの詳細は [セットアップフローガイド](docs/einja/instructions/setup-flow.md) を参照してください。
```

また「パッケージ開発者向け > 開発環境セットアップ」セクション（L158付近）にも同様のリンクを追加。

## 検証

1. ドキュメントのmermaid図がGitHubで正しくレンダリングされるか確認
2. README.mdのリンクが正しいパスを指しているか確認
3. `git diff --stat` で意図しないファイルが含まれていないこと
