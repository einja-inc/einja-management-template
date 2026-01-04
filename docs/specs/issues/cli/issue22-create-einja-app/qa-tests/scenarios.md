# create-einja-app シナリオテスト仕様

## 概要

このドキュメントでは、複数のタスクをまたぐ継続操作フローのテスト仕様を定義します。

## シナリオ一覧

| シナリオID | シナリオ名 | 実施タイミング |
|-----------|-----------|---------------|
| SCN-001 | 新規プロジェクト作成〜開発サーバー起動 | Phase 3完了後 |
| SCN-002 | 既存プロジェクトへのツール追加フロー | Phase 5完了後 |
| SCN-003 | テンプレート同期〜npm publish | Phase 7完了後 |
| SCN-004 | Worktree環境でのプロジェクト作成 | Phase 3完了後 |

---

## SCN-001: 新規プロジェクト作成〜開発サーバー起動

### 目的

`npx create-einja-app` でプロジェクトを作成し、開発サーバーが正常に起動するまでの一連のフローを検証する。

### 前提条件

- Node.js 20以上がインストールされている
- pnpmがインストールされている
- Dockerが起動している
- テスト用の空ディレクトリが用意されている

### テストステップ

| Step | 操作 | 期待結果 | AC対応 |
|------|------|---------|--------|
| 1 | `cd /tmp/test-workspace` | ディレクトリ移動 | - |
| 2 | `npx create-einja-app test-project` | 対話プロンプトが表示される | AC-001-4 |
| 3 | プロジェクト名: `test-project` を入力 | 次のプロンプトに進む | - |
| 4 | テンプレート: `turborepo-pandacss` を選択 | 次のプロンプトに進む | - |
| 5 | 認証方式: `Google OAuth` を選択 | 次のプロンプトに進む | AC-009-1 |
| 6 | 環境ツール: `direnv`, `dotenvx`, `Volta` を選択 | 次のプロンプトに進む | - |
| 7 | @einja/cli: `はい` を選択 | プロジェクト生成開始 | - |
| 8 | 生成完了を待機 | プロジェクトディレクトリが作成される | AC-001-1 |
| 9 | `cd test-project` | ディレクトリ移動 | - |
| 10 | ファイル構造確認 | 期待するファイルが存在する | AC-001-1 |
| 11 | `docker-compose up -d postgres` | PostgreSQLが起動する | - |
| 12 | `pnpm install` | 依存関係がインストールされる | AC-001-2 |
| 13 | `pnpm db:push` | データベーススキーマが適用される | - |
| 14 | `pnpm dev` | 開発サーバーが起動する | AC-001-3 |
| 15 | `curl http://localhost:3000` | HTMLレスポンスが返る | AC-001-3 |

### 期待するファイル構造

```
test-project/
├── apps/
│   └── web/
│       ├── src/
│       │   └── app/
│       │       ├── (authenticated)/
│       │       │   └── dashboard/
│       │       ├── signin/
│       │       └── api/auth/
│       └── package.json
├── packages/
│   ├── config/
│   ├── types/
│   ├── database/
│   ├── auth/
│   └── ui/
├── .envrc
├── .envrc.example
├── .env.example
├── .node-version
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── worktree.config.json
└── package.json
```

### クリーンアップ

```bash
docker-compose down
cd ..
rm -rf test-project
```

---

## SCN-002: 既存プロジェクトへのツール追加フロー

### 目的

`--setup` オプションで既存プロジェクトに環境ツールを追加し、既存ファイルとの競合を適切に処理できることを検証する。

### 前提条件

- 既存のNode.jsプロジェクトが存在する
- package.json が存在する

### テストステップ

| Step | 操作 | 期待結果 | AC対応 |
|------|------|---------|--------|
| 1 | 既存プロジェクトディレクトリを作成 | - | - |
| 2 | 既存の `.envrc` を作成（競合テスト用） | - | - |
| 3 | `cd existing-project && npx create-einja-app --setup` | 対話プロンプトが表示される | AC-002-1 |
| 4 | ツール選択: `direnv`, `Biome` を選択 | 次のプロンプトに進む | AC-002-3 |
| 5 | 競合時の動作: `マージ` を選択 | セットアップ開始 | AC-002-2 |
| 6 | セットアップ完了を待機 | 完了メッセージが表示される | - |
| 7 | `.envrc` の内容確認 | 既存内容が保持され、新しい設定が追加されている | AC-002-4 |
| 8 | `biome.json` の存在確認 | ファイルが作成されている | AC-006-1 |
| 9 | `package.json` の確認 | lint/format スクリプトが追加されている | AC-006-2 |

### 既存プロジェクトのセットアップ

```bash
mkdir existing-project
cd existing-project
pnpm init
echo 'export EXISTING_VAR=value' > .envrc
```

### 期待するマージ結果（.envrc）

```bash
# 既存の設定
export EXISTING_VAR=value

# create-einja-app によって追加
dotenv_if_exists .env
dotenv_if_exists .env.local
```

---

## SCN-003: テンプレート同期〜npm publish

### 目的

テンプレート同期から npm publish までの CI/CD フローを検証する。

### 前提条件

- リポジトリのクローンがある
- npm レジストリへの認証がある（CI環境では NPM_TOKEN）

### テストステップ

| Step | 操作 | 期待結果 | AC対応 |
|------|------|---------|--------|
| 1 | `pnpm template:sync` | テンプレートが同期される | AC-008-1 |
| 2 | 同期されたファイル数を確認 | 適切な数のファイルが同期されている | AC-008-1 |
| 3 | 除外ファイルの確認 | `.templateignore` のファイルが含まれていない | AC-008-2 |
| 4 | プレースホルダー確認 | `{{projectName}}` が正しく設定されている | AC-008-3 |
| 5 | `pnpm -F create-einja-app build` | ビルドが成功する | - |
| 6 | `pnpm -F create-einja-app pack` | tarball が作成される | - |
| 7 | tarball の内容確認 | templates/ が含まれている | - |

### 確認コマンド

```bash
# テンプレート同期
pnpm template:sync

# 同期されたファイル数を確認
find packages/create-einja-app/templates -type f | wc -l

# 除外ファイルの確認
ls packages/create-einja-app/templates/turborepo-pandacss/packages/cli 2>/dev/null && echo "ERROR: cli should be excluded"

# プレースホルダー確認
grep -r "{{projectName}}" packages/create-einja-app/templates/

# ビルド
pnpm -F create-einja-app build

# パッケージング
cd packages/create-einja-app && pnpm pack
tar -tzf create-einja-app-*.tgz | grep templates/
```

---

## SCN-004: Worktree環境でのプロジェクト作成

### 目的

Worktree設定をカスタマイズしてプロジェクトを作成し、複数ブランチの並行開発が可能なことを検証する。

### 前提条件

- Node.js 20以上がインストールされている
- pnpmがインストールされている
- Dockerが起動している

### テストステップ

| Step | 操作 | 期待結果 | AC対応 |
|------|------|---------|--------|
| 1 | `npx create-einja-app worktree-test` | 対話プロンプトが表示される | - |
| 2 | 基本設定を入力 | 次のプロンプトに進む | - |
| 3 | Worktree設定: `はい` を選択 | Worktree設定プロンプトが表示される | - |
| 4 | PostgreSQLポート: `25432` を入力 | 次のプロンプトに進む | AC-010-1 |
| 5 | Dockerコンテナ名: `worktree-test-postgres` を入力 | 次のプロンプトに進む | AC-010-2 |
| 6 | アプリ追加: `はい` → `web`, `3000`, `1000` を入力 | プロジェクト生成開始 | AC-010-4 |
| 7 | 生成完了を待機 | プロジェクトディレクトリが作成される | - |
| 8 | `worktree.config.json` の確認 | カスタム設定が反映されている | AC-010-3 |
| 9 | `docker-compose.yml` の確認 | カスタムポートが設定されている | AC-010-1 |
| 10 | `pnpm dev:bg` | 開発サーバーが起動する（ポート自動計算） | - |

### 期待する worktree.config.json

```json
{
  "schemaVersion": 1,
  "postgres": {
    "port": 25432,
    "containerName": "worktree-test-postgres"
  },
  "apps": [
    {
      "id": "web",
      "portRangeStart": 3000,
      "rangeSize": 1000
    }
  ]
}
```

---

## 合否判定基準

### 全シナリオ共通

- 全てのステップがエラーなく完了すること
- 期待結果が全て満たされていること
- クリーンアップが正常に完了すること

### シナリオ別追加基準

| シナリオ | 追加基準 |
|---------|---------|
| SCN-001 | 開発サーバーがHTTPレスポンスを返すこと |
| SCN-002 | 既存ファイルが破壊されていないこと |
| SCN-003 | tarball にテンプレートが含まれていること |
| SCN-004 | worktree.config.json が正しく生成されていること |

---

## 自動化スクリプト

### SCN-001 自動化

```bash
#!/bin/bash
# tests/e2e/scenario-001.sh

set -e

WORKSPACE=$(mktemp -d)
PROJECT_NAME="test-project-$(date +%s)"

cd "$WORKSPACE"

# プロジェクト作成（非対話モード）
npx create-einja-app "$PROJECT_NAME" --yes

cd "$PROJECT_NAME"

# ファイル存在確認
test -f package.json || exit 1
test -f turbo.json || exit 1
test -d apps/web || exit 1
test -d packages/database || exit 1

# Docker起動
docker-compose up -d postgres

# 依存関係インストール
pnpm install

# データベースセットアップ
pnpm db:push

# 開発サーバー起動
pnpm dev &
DEV_PID=$!

# サーバー起動待機
sleep 10

# HTTPレスポンス確認
curl -f http://localhost:3000 || exit 1

# クリーンアップ
kill $DEV_PID
docker-compose down
cd ..
rm -rf "$PROJECT_NAME"

echo "SCN-001: PASSED"
```
