# create-einja-app

Einja Management Templateを使用したプロジェクトを素早く作成するCLIツールです。

## 概要

`create-einja-app`は、Turborepo + Next.js 15 + Auth.js + Prisma構成のプロジェクトテンプレートを一発で展開できるCLIパッケージです。新規プロジェクトの作成だけでなく、既存プロジェクトへの環境ツール追加もサポートしています。

### 主な機能

- 🚀 **新規プロジェクト作成**: `npx create-einja-app my-project` で即座にプロジェクトを作成
- 🛠️ **既存プロジェクトセットアップ**: `--setup` オプションで既存プロジェクトにツールを追加
- 🔧 **環境ツール統合**: direnv, dotenvx, Volta, Biome, Huskyなどのツールを自動セットアップ
- 🔐 **認証方式選択**: Google OAuth, Credentials, GitHub OAuth, 認証なしから選択可能
- 🔄 **対話式プロンプト**: わかりやすいプロンプトで設定を選択

---

## 使用方法

### 1. 新規プロジェクト作成

#### 基本使用法

```bash
npx create-einja-app my-project
```

対話式プロンプトが表示され、以下の設定を選択できます：

- プロジェクト名
- テンプレート（turborepo-pandacss, minimal）
- 認証方式（Google OAuth, Credentials, GitHub OAuth, なし）
- 環境ツール（direnv, dotenvx, Volta）
- @einja/cli自動セットアップ
- Worktree設定カスタマイズ

#### オプション付き実行

```bash
# デフォルト値で作成（プロンプトスキップ）
npx create-einja-app my-project --yes

# Git初期化をスキップ
npx create-einja-app my-project --skip-git

# 依存関係インストールをスキップ
npx create-einja-app my-project --skip-install

# テンプレート指定
npx create-einja-app my-project --template turborepo-pandacss
```

### 2. 既存プロジェクトへのツール追加

```bash
# 現在のディレクトリにツールを追加
cd existing-project
npx create-einja-app --setup
```

対話式プロンプトが表示され、以下を選択できます：

- セットアップするツール（direnv, dotenvx, Volta, Biome, Husky）
- 既存ファイルがある場合の動作（マージ, 上書き, スキップ）

---

## コマンドリファレンス

### `create-einja-app [project-name] [options]`

新規プロジェクトを作成します。

**引数:**

- `project-name` (オプション): プロジェクト名

**オプション:**

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--template <name>` | テンプレート名 | `turborepo-pandacss` |
| `--skip-git` | Git初期化をスキップ | false |
| `--skip-install` | 依存関係インストールをスキップ | false |
| `-y, --yes` | 対話プロンプトをスキップ（デフォルト値使用） | false |

**例:**

```bash
npx create-einja-app my-project --yes --skip-git
```

### `create-einja-app --setup`

既存プロジェクトにツールを追加します。

**例:**

```bash
cd existing-project
npx create-einja-app --setup
```

---

## プロジェクト構成

生成されるプロジェクトは以下の構成になります：

```
my-project/
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

# PostgreSQLを起動
docker-compose up -d postgres

# 開発サーバーを起動
pnpm dev
```

開発サーバーが起動したら、ブラウザで http://localhost:3000 にアクセスしてください。

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

---

## テンプレート更新

create-einja-appのメンテナ向け情報です。

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
- [npm パッケージ](https://www.npmjs.com/package/create-einja-app)

---

## サポート

問題が発生した場合は、GitHubのIssueで報告してください:
https://github.com/einja-inc/einja-management-template/issues
