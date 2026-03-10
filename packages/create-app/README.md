# @einja-inc/create-app

Einja Management Templateを使用したプロジェクトを素早く作成するCLIツールです。

## 概要

`@einja-inc/create-app`は、Turborepo + Next.js 15 + Auth.js + Prisma構成のプロジェクトテンプレートを一発で展開できるCLIパッケージです。新規プロジェクトの作成だけでなく、既存プロジェクトへの環境ツール追加もサポートしています。

### 主な機能

- 🚀 **新規プロジェクト作成**: `npx @einja-inc/create-app my-project` で即座にプロジェクトを作成
- 🛠️ **既存プロジェクトセットアップ**: `setup` サブコマンドで既存プロジェクトにツールを追加
- 🔧 **環境ツール統合**: direnv, dotenvx, Volta, Biome, Huskyなどのツールを自動セットアップ
- 🔐 **認証方式選択**: NextAuth.js を使用するか選択可能
- 🔄 **対話式プロンプト**: わかりやすいプロンプトで設定を選択

---

## 使用方法

### 1. 新規プロジェクト作成

#### 基本使用法

```bash
npx @einja-inc/create-app my-project
```

対話式プロンプトが表示され、以下の設定を選択できます：

- プロジェクト名
- パッケージスコープ
- 認証機能（NextAuth.js を使用 / なし）
- @einja-inc/dev-cli自動セットアップ
- Worktree設定カスタマイズ

#### オプション付き実行

```bash
# Git初期化をスキップ
npx @einja-inc/create-app my-project --skip-git

# 依存関係インストールをスキップ
npx @einja-inc/create-app my-project --skip-install

```

### 2. 既存プロジェクトへのツール追加

```bash
# 現在のディレクトリにツールを追加
cd existing-project
npx @einja-inc/create-app setup
```

対話式プロンプトが表示され、以下を選択できます：

- セットアップするツール（direnv, dotenvx, Volta, Biome, Husky）
- 既存ファイルがある場合の動作（マージ, 上書き, スキップ）

---

## コマンドリファレンス

### `@einja-inc/create-app [project-name] [options]`

新規プロジェクトを作成します。

**引数:**

- `project-name` (オプション): プロジェクト名

**オプション:**

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--skip-git` | Git初期化をスキップ | false |
| `--skip-install` | 依存関係インストールをスキップ | false |

**例:**

```bash
npx @einja-inc/create-app my-project --skip-git
```

### `@einja-inc/create-app setup`

既存プロジェクトにツールを追加します。

**例:**

```bash
cd existing-project
npx @einja-inc/create-app setup
```

### `@einja-inc/create-app add [options]`

既存のモノレポにEinja標準構成を追加します。

**オプション:**

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--all` | 全コンポーネントを選択 | false |
| `--dry-run` | 変更をプレビュー（実際のファイル操作なし） | false |

**対話式フロー:**

```
$ npx @einja-inc/create-app add

? 追加するコンポーネントを選択:
  [x] packages/ - 共通パッケージ
  [x] apps/ - アプリテンプレート
  [x] 直下設定ファイル

? 追加するパッケージを選択:
  [x] front-core    [x] server-core
  [x] config        [x] ui

? 追加するアプリを選択:
  [x] web

✓ 追加完了！
```

**競合処理:**

ファイルの競合は以下のマーカーベースで処理されます：
- `@einja:managed` - テンプレートで上書き
- `@einja:project-private` - ローカル優先（初回のみコピー）
- マーカーなし - 既存ファイル優先

**JSONマージ設定 (.einja-sync.json):**

```json
{
  "jsonPaths": {
    "managed": {
      "package.json": ["scripts.dev", "scripts.build"]
    },
    "seed": {
      "package.json": ["scripts.custom"]
    }
  }
}
```

**除外されるファイル:**
- `.claude/`, `docs/einja/`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, `.envrc`, `.vscode/settings.json`, `scripts/` → @einja-inc/dev-cli管轄
- `.gitignore`に含まれるファイル
- 自動生成ファイル（node_modules/, styled-system/等）

**例:**

```bash
# 対話式で追加
npx @einja-inc/create-app add

# 全コンポーネントを追加（プロンプトスキップ）
npx @einja-inc/create-app add --all

# プレビューのみ
npx @einja-inc/create-app add --dry-run
```

---

## プロジェクト構成

生成されるプロジェクトは以下の構成になります：

```
my-project/
├── .vscode/                     # VS Code設定（Biome統合）
├── apps/
│   └── web/                      # Next.js 15アプリケーション
│       ├── src/
│       │   ├── app/              # App Router
│       │   ├── components/       # Reactコンポーネント
│       │   └── lib/              # ユーティリティ
│       └── package.json
├── packages/
│   ├── config/                   # 共通設定（Biome, TypeScript, Panda CSS）
│   ├── front-core/               # フロントエンド共通層（Auth設定等）
│   ├── server-core/              # バックエンド共通層（Prismaスキーマ等）
│   └── ui/                       # UIコンポーネント（shadcn/ui）
├── .claude/                      # Claude設定
├── docs/einja/                   # ドキュメント
├── docker-compose.yml            # PostgreSQL設定
├── turbo.json                    # Turborepo設定
├── pnpm-workspace.yaml          # pnpmワークスペース設定
└── package.json
```

---

## 次のステップ

プロジェクト作成後、以下の手順で開発を開始できます：

```bash
# プロジェクトディレクトリに移動
cd my-project

# 環境変数を設定（重要！）
pnpm env:update

# 開発サーバーを起動（PostgreSQLも自動起動）
pnpm dev
```

> ⚠️ **重要**: テンプレートにはサンプルの環境変数ファイルが含まれています。
> `pnpm env:update` を実行して、自分のプロジェクト用に環境変数を再設定してください。

開発サーバーが起動したら、ターミナルに表示されるURLにアクセスしてください。
（ポート番号はワークツリーのブランチ名から自動計算されます）

---

### デプロイ

本番環境へのデプロイ手順については、プロジェクト内の以下のドキュメントを参照してください：

📘 **[README.md](./README.md)** - プロジェクト全体の概要とクイックスタート

📘 **[docs/einja/instructions/deployment-setup.md](./docs/einja/instructions/deployment-setup.md)** - 詳細なデプロイ手順

---

## 環境ツール

### direnv

ディレクトリごとに環境変数を自動で切り替えます。

**生成されるファイル:**
- `.envrc`
- `.envrc.example`

**セットアップ後:**
```bash
direnv allow
```

### dotenvx

.envファイルを暗号化して安全に管理します。

**追加されるコマンド:**
```bash
pnpm env:encrypt  # 環境変数を暗号化
pnpm env:decrypt  # 環境変数を復号化
```

### Volta

チームメンバー全員が同じNode.jsバージョンを使用できます。

**生成されるファイル:**
- `.node-version`
- `package.json` に `volta` フィールドを追加

### Biome

一貫したコードスタイルとLintルールを適用します。

**追加されるコマンド:**
```bash
pnpm lint       # Lint実行
pnpm lint:fix   # Lint自動修正
pnpm format     # フォーマットチェック
pnpm format:fix # フォーマット自動修正
```

### Husky + lint-staged

コミット前に自動でLintとフォーマットを実行します。

**セットアップ後:**
- `git commit` 時に自動でlint-stagedが実行されます

---

## トラブルシューティング

### プロジェクト名が無効

**エラーメッセージ:**
```
プロジェクト名は英字で始まり、英数字・ハイフン・アンダースコアのみ使用できます（1〜50文字）
```

**解決方法:**
- プロジェクト名を英字で始めてください
- 使用できる文字: `a-z A-Z 0-9 _ -`
- 長さ: 1〜50文字

### ディレクトリが既に存在する

**エラーメッセージ:**
```
ディレクトリ 'my-project' は既に存在します
```

**解決方法:**
- 別のプロジェクト名を指定してください
- または既存ディレクトリを削除してください

### pnpmがインストールされていない

**エラーメッセージ:**
```
pnpmがインストールされていません
```

**解決方法:**
```bash
npm install -g pnpm
```

### Gitがインストールされていない

**警告メッセージ:**
```
Gitがインストールされていません
```

**解決方法:**
- Gitをインストールしてください: https://git-scm.com/downloads
- または `--skip-git` オプションを使用してください

### scripts/init.sh が Permission Denied

**エラーメッセージ:**
```
Permission denied: ./scripts/init.sh
```

**解決方法:**
```bash
# 方法1: bashコマンドで実行
bash scripts/init.sh

# 方法2: 実行権限を付与してから実行
chmod +x scripts/*.sh
./scripts/init.sh
```

### Volta環境でpnpmが見つからない

**エラーメッセージ:**
```
pnpm: command not found
```

**解決方法:**
```bash
# pnpmを手動でインストール
npm install -g pnpm@latest-10

# またはターミナルを再起動してVoltaのPATHを反映
exec $SHELL
```

---

## テンプレート更新

@einja-inc/create-appのメンテナ向け情報です。

### テンプレート同期

メインリポジトリの変更をテンプレートに反映する場合：

```bash
# テンプレートを更新
pnpm template:update

# 変更内容をプレビュー（ファイル書き込みなし）
pnpm template:update --dry-run
```

**注意:**
- `pnpm build` 実行時に `prebuild` で自動実行されます
- `.templateignore` に基づきファイルが除外されます

---

## 技術スタック

- **言語**: TypeScript
- **CLI**: Commander.js
- **プロンプト**: inquirer
- **プログレス表示**: ora
- **コマンド実行**: execa
- **ビルド**: tsup

---

## ライセンス

MIT

---

## リンク

- [GitHub リポジトリ](https://github.com/einja-inc/einja-management-template)
- [npm パッケージ](https://www.npmjs.com/package/@einja-inc/create-app)

---

## サポート

問題が発生した場合は、GitHubのIssueで報告してください:
https://github.com/einja-inc/einja-management-template/issues
