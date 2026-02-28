<!-- @einja:managed:start -->
# 環境変数セットアップ手順

開発環境およびデプロイ環境の環境変数設定手順をまとめたドキュメントです。

設計方針については以下を参照してください：
- [環境変数設計方針](../steering/infrastructure/environment-variables.md)

---

## 🔑 環境変数ファイルの仕組み

```
.env.local（暗号化・Git共有）
       ↓ pnpm dev:setup で復号
.env（作業用・毎回再生成）+ .env.personal（個人トークン）
       ↓ direnv で自動読み込み
    開発サーバー
```

| ファイル | Git | 用途 |
|---------|:---:|------|
| `.env.local` | ✅ | チーム共有の秘密情報（暗号化） |
| `.env` | ❌ | 作業用（pnpm devで毎回再生成） |
| `.env.personal` | ❌ | 個人トークン（GITHUB_TOKEN等） |

> 📖 **詳しい仕組み・FAQは「[環境変数設計方針](../steering/infrastructure/environment-variables.md#2-ローカル開発のファイル構成)」を参照**

---

## 目次

1. [ローカル開発環境セットアップ](#1-ローカル開発環境セットアップ)
2. [dotenvxの使用方法](#2-dotenvxの使用方法)
3. [環境変数ファイルの作成](#3-環境変数ファイルの作成)
4. [暗号化手順](#4-暗号化手順)
5. [秘密鍵の管理](#5-秘密鍵の管理)
6. [CI/CD環境での使用](#6-cicd環境での使用)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. ローカル開発環境セットアップ

### 自動セットアップ（推奨）

```bash
# 開発環境の一括セットアップ
pnpm dev:setup

# セットアップ内容:
# - Volta（Node.jsバージョン管理）
# - direnv（環境変数自動読み込み）
# - dotenvx（環境変数暗号化）
# - .env ファイル作成
# - GITHUB_TOKEN設定（対話式）
```

### 環境変数の設定・変更（対話式ウィザード）

```bash
# 環境変数設定ウィザードを起動
pnpm env:update
```

対話式で以下の操作ができます：
- **個人トークンを設定** - GITHUB_TOKEN等を`.env.personal`に設定
- **チーム共有設定を変更** - `.env.local`の復号→編集→再暗号化
- **現在の状態を確認** - 環境変数ファイルの存在状況を表示

### 手動セットアップ

#### Step 1: dotenvxインストール

```bash
# macOS/Linux（推奨）
curl -sfS https://dotenvx.sh/install.sh | sh

# または npm経由
npm install -g @dotenvx/dotenvx

# インストール確認
dotenvx --version
```

#### Step 2: 環境変数ファイルの復号・作成

```bash
# .env.local（暗号化済み）を復号して .env を作成
# ※ .env.keys に秘密鍵が必要（チームから共有を受けてください）
dotenvx decrypt -f .env.local -o .env

# 個人用トークンファイルをテンプレートからコピー
cp .env.personal.example .env.personal
```

#### Step 3: 個人用トークンを設定

```bash
# .env.personal を編集（GITHUB_TOKEN等の個人トークン）
# ※ .env は直接編集しない（.env.local から自動生成されるため）
```

#### Step 4: direnv有効化

```bash
direnv allow
```

---

## 2. dotenvxの使用方法

### 基本コマンド

```bash
# 環境変数を読み込んでコマンド実行
dotenvx run -- <command>

# 特定の環境ファイルを指定
dotenvx run -f .env.production -- <command>

# 複数ファイルを指定（後勝ち）
dotenvx run -f .env -f .env.local -- <command>

# 環境変数を暗号化
dotenvx encrypt -f .env.production

# 暗号化ファイルを復号（確認用）
dotenvx decrypt -f .env.production
```

### package.jsonでの使用例

```json
{
  "scripts": {
    "build": "dotenvx run -f .env.production -- turbo run build",
    "build:dev": "dotenvx run -f .env.develop -- turbo run build",
    "build:local": "turbo run build"
  }
}
```

---

## 3. 環境変数ファイルの作成

### ファイル構成

```
プロジェクトルート/
├── .env.example            # .envの参考テンプレート（Git追跡）
├── .env.personal.example   # 個人用トークンのテンプレート（Git追跡）
├── .env.local              # ローカル開発用（暗号化・Git追跡）★
├── .env.develop            # dev検証サーバー用（暗号化・Git追跡）
├── .env.production         # 本番環境用（暗号化・Git追跡）
├── .env.keys               # 秘密鍵（Git除外・1Password等で共有）
├── .env                    # .env.localを復号したもの（Git除外）
└── .env.personal           # 個人用トークン（Git除外）
```

**★ポイント**: `.env.local` は暗号化されてGitで共有。`pnpm dev:setup` で復号して `.env` が生成される。

### .env.personal.example（個人用トークンテンプレート）

```bash
# GitHub MCP接続用（Claude Code開発時に必要）
# 取得方法: https://github.com/settings/tokens/new
# 必要なスコープ: repo, read:org
GITHUB_TOKEN=

# その他の個人用トークン（必要に応じて）
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
```

### デプロイ環境ファイル作成

```bash
# 開発サーバー用
cat > .env.develop << 'EOF'
# Development Environment
DATABASE_URL="postgresql://user:pass@dev-db:5432/einja_dev"
NEXTAUTH_SECRET="dev-secret-key"
NEXTAUTH_URL="https://dev.example.com"
NODE_ENV="development"
EOF

# 本番環境用
cat > .env.production << 'EOF'
# Production Environment
DATABASE_URL="postgresql://user:pass@prod-db:5432/einja"
NEXTAUTH_SECRET="production-secret-key-generate-with-openssl"
NEXTAUTH_URL="https://example.com"
NODE_ENV="production"
EOF

# CI/CD用
cat > .env.ci << 'EOF'
# CI Environment
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/einja_test"
NEXTAUTH_SECRET="ci-test-secret"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="test"
EOF
```

---

## 4. 暗号化手順

### Step 1: 環境ファイルを暗号化

```bash
# 各環境ファイルを暗号化
dotenvx encrypt -f .env.develop
dotenvx encrypt -f .env.production
dotenvx encrypt -f .env.ci
```

### Step 2: 暗号化結果の確認

暗号化後、ファイルは以下のような形式になります：

```bash
# .env.production（暗号化後）
#/-------------------[DOTENV_PUBLIC_KEY]--------------------/
#/            public-key encryption for .env files          /
#/       [how it works](https://dotenvx.com/encryption)     /
#/----------------------------------------------------------/
DOTENV_PUBLIC_KEY_PRODUCTION="03762856de9995b05b0bab64d15f4d23..."

# Production Environment
DATABASE_URL=encrypted:BKWps41fS2ZxysyF8QaWcaywV8koGwQB31/3...
NEXTAUTH_SECRET=encrypted:BIsPWaPuZKcIShhWg/mkQ4hAIb5XfJxHq8...
NEXTAUTH_URL=encrypted:BGqfAinM4i1q4jyFHGgDieBnatHXGHLbMsC1...
NODE_ENV=encrypted:BDqRRvYcNnJ5rYo4c8Zhu/lThghcW8b6+7u4+M...
```

### Step 3: 秘密鍵の確認

```bash
# .env.keys に秘密鍵が生成される
cat .env.keys

# 出力例:
# DOTENV_PRIVATE_KEY_DEVELOP=8afef18fa6e433593a5116cc406c83a44c4385b3f4f7d4cc25750e39f2baa320
# DOTENV_PRIVATE_KEY_STAGING=548887285654af264275d8c58e87c82dd7958ac6e99760fb5aa5eca8e1efb35d
# DOTENV_PRIVATE_KEY_PREVIEW=bdb34e98e0312b3e06d10475901a841d9da69590993416d5e4141fd4d96b62ba
# DOTENV_PRIVATE_KEY_PRODUCTION=73890d5288241cb6738b7172d5ee1bf2dd4aac8319442d951e31d123304f180d
# DOTENV_PRIVATE_KEY_CI=4165a821b257a073b2b0a4b4e180b86accc76eec773ec53c6443626615c7d979
```

### Step 4: Gitにコミット

```bash
# 暗号化されたファイルをコミット
git add .env.develop .env.production .env.ci
git commit -m "chore: 環境変数ファイルを暗号化"
```

### 📝 チーム共有設定（.env.local）を変更するとき

ローカル開発用の共通設定を変更したい場合の手順：

```bash
# 1. 現在の暗号化ファイルを復号（テンポラリファイルに出力）
dotenvx decrypt -f .env.local -o .env.local.tmp

# 2. テンポラリファイルを編集
vi .env.local.tmp  # または好みのエディタで編集

# 3. 元のファイルを削除して、編集済みファイルをリネーム
rm .env.local
mv .env.local.tmp .env.local

# 4. 再暗号化
dotenvx encrypt -f .env.local

# 5. コミット＆プッシュ
git add .env.local
git commit -m "chore: ローカル開発設定を更新"
git push

# 6. チームメンバーへの通知
# → メンバーは git pull 後に pnpm dev:setup で反映
```

**注意**: `.env.keys` に対応する秘密鍵（`DOTENV_PRIVATE_KEY_LOCAL`）が必要です。

---

## 5. 秘密鍵の管理

### 保管場所

| 保管場所 | 用途 | アクセス権限 |
|---------|------|------------|
| 1Password | チーム共有 | 開発者全員 |
| GitHub Secrets | CI/CD | GitHub Actions |
| Vercel Dashboard | 本番デプロイ | 管理者のみ |
| Railway Variables | Cronワーカー | 管理者のみ |

### 1Passwordへの保存

```bash
# .env.keys の内容を1Passwordに保存
# Vault: Development
# Item Name: einja-dotenvx-keys
# Type: Secure Note
```

### GitHub Secretsへの登録

```bash
# CI用秘密鍵を登録
gh secret set DOTENV_PRIVATE_KEY_CI --body "$(grep DOTENV_PRIVATE_KEY_CI .env.keys | cut -d= -f2 | tr -d '"'"'"')"

# Preview用秘密鍵を登録（Preview環境を使う場合）
gh secret set DOTENV_PRIVATE_KEY_PREVIEW --body "$(grep DOTENV_PRIVATE_KEY_PREVIEW .env.keys | cut -d= -f2 | tr -d '"'"'"')"

# 本番用秘密鍵を登録（必要に応じて）
gh secret set DOTENV_PRIVATE_KEY_PRODUCTION --body "$(grep DOTENV_PRIVATE_KEY_PRODUCTION .env.keys | cut -d= -f2 | tr -d '"'"'"')"
```

### Vercel環境変数への登録

```bash
# Vercel CLIで設定
vercel env add DOTENV_PRIVATE_KEY_PRODUCTION production

# または Vercel Dashboard から設定
# Settings > Environment Variables > Add
```

---

## 6. CI/CD環境での使用

### GitHub Actions設定例

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.14.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.16.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm db:generate

      - name: Run TypeScript type check
        run: pnpm typecheck

      - name: Run lint
        run: pnpm lint

      - name: Run tests
        run: pnpm test
```

### 本番ビルド時の使用

```yaml
# デプロイワークフローでの使用例
- name: Build for production
  run: pnpm build
  env:
    DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
```

---

## 7. トラブルシューティング

### dotenvxコマンドが見つからない

```bash
# PATHを確認
which dotenvx

# 再インストール
curl -sfS https://dotenvx.sh/install.sh | sh

# または npm経由
npm install -g @dotenvx/dotenvx
```

### 復号エラー: "missing private key"

**原因**: 秘密鍵が環境変数にセットされていない

```bash
# 秘密鍵を確認
echo $DOTENV_PRIVATE_KEY_PRODUCTION

# .env.keys から読み込み
source .env.keys
dotenvx run -f .env.production -- echo "OK"

# または直接指定
DOTENV_PRIVATE_KEY_PRODUCTION=xxx dotenvx run -f .env.production -- echo "OK"
```

### 暗号化エラー: "file already encrypted"

**原因**: 既に暗号化済みのファイルを再暗号化しようとした

```bash
# 一度復号してから再暗号化
dotenvx decrypt -f .env.production
# ファイルを編集
dotenvx encrypt -f .env.production
```

### direnvで環境変数が読み込まれない

```bash
# direnvを許可
direnv allow

# シェルフックを確認
# .zshrc または .bashrc に以下があるか確認
eval "$(direnv hook zsh)"  # または bash

# シェルを再起動
exec $SHELL
```

### CI/CDで環境変数が見えない

**原因**: GitHub Secretsの設定ミス

```bash
# Secretsを確認
gh secret list

# Secretを再設定
gh secret set DOTENV_PRIVATE_KEY_CI --body "正しい秘密鍵"
```

### 環境変数の優先順位が期待と異なる

**ロード順序（後勝ち）**:
1. `.env` - 基本設定
2. `.env.local` - ローカルオーバーライド

```bash
# 明示的に順序を指定
dotenvx run -f .env -f .env.local -- <command>
```

---

## 関連ドキュメント

- [デプロイセットアップ手順](./deployment-setup.md)
- [環境変数設計方針](../steering/infrastructure/environment-variables.md)
- [デプロイメント・CI/CD設計方針](../steering/infrastructure/deployment.md)

## 参考リンク

- [dotenvx公式ドキュメント](https://dotenvx.com/docs)
- [dotenvx暗号化の仕組み](https://dotenvx.com/encryption)
- [direnv公式ドキュメント](https://direnv.net/)

## チーム共有設定変更フロー

チーム全体で共有する環境変数（`.env.develop`, `.env.preview`, `.env.production` 等）を変更する手順:

### 手順

1. **復号化**: 暗号化されたファイルを復号
   ```bash
   dotenvx decrypt -f .env.develop --stdout > .env.develop.tmp
   ```

2. **編集**: 一時ファイルを編集
   ```bash
   # エディタで .env.develop.tmp を編集
   ```

3. **元ファイルに反映**: 編集内容を元ファイルにコピー
   ```bash
   cp .env.develop.tmp .env.develop
   rm .env.develop.tmp
   ```

4. **再暗号化**: 変更を暗号化
   ```bash
   dotenvx encrypt -f .env.develop
   ```

5. **コミット**: 暗号化されたファイルをコミット
   ```bash
   git add .env.develop
   git commit -m "chore: develop環境の環境変数を更新"
   ```

> **⚠️ 警告**: `.env.production` を編集する場合は、本番環境への影響を十分に確認してから行ってください。

## 新規環境変数追加フロー

プロジェクトに新しい環境変数を追加する手順:

### 手順

1. **`.env.example` にキーを追加**（デフォルト値またはプレースホルダー）
   ```bash
   # .env.example に追記
   NEW_API_KEY=your-api-key-here
   ```

2. **各環境ファイルに追加**
   - `.env.local` - ローカル開発用の値
   - `.env.develop` - 開発環境用の値
   - `.env.preview` - プレビュー環境用の値
   - `.env.production` - 本番環境用の値
   - `.env.staging` - ステージング環境用の値（該当する場合）

3. **暗号化ファイルの編集**
   暗号化されたファイル（`.env.local`, `.env.develop`, `.env.production`, `.env.preview`）を編集する場合：
   ```bash
   # 復号してテンポラリファイルに出力
   dotenvx decrypt -f .env.local --stdout > .env.local.tmp

   # エディタで編集
   vi .env.local.tmp  # または好みのエディタ

   # 元ファイルを削除して編集済みファイルをリネーム
   rm .env.local
   mv .env.local.tmp .env.local

   # 再暗号化
   dotenvx encrypt -f .env.local
   ```

   **注意**: 同じ手順を他の環境ファイルにも適用してください。

4. **非暗号化ファイルの編集**
   非暗号化ファイル（`.env`, `.env.personal`）は直接編集可能：
   ```bash
   # .env.personal を直接編集（GITHUB_TOKEN等の個人トークン）
   vi .env.personal

   # .env は通常 .env.local から自動生成されるため、直接編集は非推奨
   # .env.local を編集して pnpm dev:setup を再実行する
   ```

5. **環境固有の変数かどうかを確認**
   新規変数が以下に該当する場合、他環境への展開要否を確認：
   - **全環境共通**: すべての環境ファイルに同じ値を追加
   - **環境固有**: 該当環境のみに追加（例: `PRODUCTION_ONLY_FLAG=true`）
   - **開発専用**: `.env.local`, `.env.develop`, `.env.preview` のみに追加

6. **暗号化ファイルの再暗号化**
   編集が完了したら、すべての環境ファイルを再暗号化：
   ```bash
   dotenvx encrypt -f .env.local
   dotenvx encrypt -f .env.develop
   dotenvx encrypt -f .env.preview
   dotenvx encrypt -f .env.production
   ```

7. **デプロイ環境への同期**
   新規環境変数をCI/CDやホスティングサービスに反映させる必要がある場合：

   - **GitHub Secrets（CI/CD用）**:
     秘密鍵が変更された場合は [デプロイメントセットアップ](./deployment-setup.md) のセクション6を参照
     ```bash
     # 新規Secretの追加
     gh secret set NEW_API_KEY --body "your-api-key-value"
     ```

   - **Vercel環境変数（本番/プレビュー用）**:
     初回は手動同期、以降はGitHub Actionsが自動同期
     ```bash
     # Vercel CLIで設定
     vercel env add NEW_API_KEY production
     vercel env add NEW_API_KEY preview
     ```

   - **詳細手順**: [deployment-setup.md](./deployment-setup.md) を参照

8. **コミット**
   暗号化ファイルと `.env.example` の変更をコミット：
   ```bash
   git add .env.example .env.local .env.develop .env.preview .env.production
   git commit -m "chore: NEW_API_KEY 環境変数を追加"
   git push
   ```

## .env.personal のセキュリティ

`.env.personal` は個人のAPIトークン・キーを管理するファイルです。

### 管理対象トークン

| トークン | 取得先 | 用途 |
|---------|-------|------|
| `VERCEL_TOKEN` | [Vercel Dashboard](https://vercel.com/account/tokens) | Vercel CLI認証 |
| `NEON_API_KEY` | [Neon Console](https://console.neon.tech/account/api-keys) | Neon CLI認証 |
| `GITHUB_TOKEN` | [GitHub Settings](https://github.com/settings/tokens) | GitHub API認証 |

### セキュリティルール

- **Git管理対象外**: `.gitignore` で除外済み
- **dotenvx暗号化対象外**: 個人ファイルのため暗号化不要
- **権限設定**: ファイル作成後は必ず実行
  ```bash
  chmod 600 .env.personal
  ```
- **ローテーション推奨**: 90日ごとにトークンを更新することを推奨
- **共有禁止**: 他の開発者とトークンを共有しないこと
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="environment-setup-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
