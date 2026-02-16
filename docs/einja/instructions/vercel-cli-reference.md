# Vercel CLI/API リファレンス

## 概要

このドキュメントは、Vercelプロジェクトのセットアップにおいて、どの操作がCLI/API/vercel.jsonで可能かを明確にしたリファレンスです。

ダッシュボード操作中心のセットアップ手順は [デプロイセットアップ手順](./deployment-setup.md) を参照してください。

---

## 操作別対応表

| 操作 | CLI | API | vercel.json | Dashboard |
|------|:---:|:---:|:-----------:|:---------:|
| プロジェクト作成 | ✅ | ✅ | ❌ | ✅ |
| GitHubリポジトリ接続 | ✅ | ✅ | ❌ | ✅ |
| Root Directory設定 | ❌ | ✅ | ❌ | ✅ |
| ビルドコマンド設定 | ❌ | ✅ | ✅ | ✅ |
| インストールコマンド設定 | ❌ | ✅ | ✅ | ✅ |
| 環境変数追加（標準環境） | ✅ | ✅ | ❌ | ✅ |
| 環境変数追加（カスタム環境） | ❌ | ✅ | ❌ | ✅ |
| カスタム環境作成 | ❌ | ✅ | ❌ | ✅ |
| 環境変数の参照・一覧 | ✅ | ✅ | ❌ | ✅ |
| 環境変数のpull（.envファイル生成） | ✅ | ❌ | ❌ | ❌ |

### 凡例
- ✅: 対応（推奨または唯一の方法）
- ❌: 非対応

---

## CLIコマンドリファレンス

### 認証・チーム切り替え

```bash
# GitHubアカウントでログイン
vercel login --github

# チーム/スコープの切り替え
vercel switch <team-slug>

# 現在のログイン情報確認
vercel whoami
```

### プロジェクト操作

```bash
# プロジェクト一覧
vercel project ls

# プロジェクト詳細確認
vercel project inspect <project-name>

# プロジェクトとローカルディレクトリの紐付け
vercel link --project=<project-name> --yes

# プロジェクトの紐付け解除
vercel unlink
```

### Git接続

```bash
# GitHubリポジトリとの接続
vercel git connect <github-url> --yes

# 接続解除
vercel git disconnect --yes
```

### 環境変数管理

```bash
# 環境変数一覧
vercel env ls

# 環境変数追加（対話式）
vercel env add <name>

# 環境変数追加（値を指定）
echo "<value>" | vercel env add <name> <environment>
# environment: production, preview, development

# 環境変数削除
vercel env rm <name> <environment>

# 環境変数をローカル.envファイルにpull
vercel env pull .env.local
vercel env pull --environment=production .env.production.local
```

### デプロイ

```bash
# プレビューデプロイ
vercel

# 本番デプロイ
vercel --prod

# ビルドログの確認
vercel logs <deployment-url>
```

### CLIの制限事項

CLIでは以下の操作が**できません**：

1. **Root Directory設定**: `vercel.json`やAPIで設定が必要
2. **カスタム環境への環境変数設定**: APIまたはDashboardで設定が必要
3. **カスタム環境の作成**: APIまたはDashboardで作成が必要

---

## APIリファレンス

### 認証

```bash
# Bearer Token認証
Authorization: Bearer <VERCEL_TOKEN>
```

環境変数 `VERCEL_TOKEN` を設定するか、リクエスト時に指定します。

### プロジェクト設定変更

**エンドポイント**: `PATCH /v9/projects/{idOrName}`

Root Directoryやビルドコマンドを設定する際に使用します。

```bash
curl -X PATCH "https://api.vercel.com/v9/projects/<project-id-or-name>?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rootDirectory": "apps/<app-name>",
    "buildCommand": "pnpm turbo run build --filter=@repo/<app-name>...",
    "installCommand": "pnpm install",
    "framework": "nextjs"
  }'
```

**設定可能なフィールド**:

| フィールド | 説明 |
|-----------|------|
| `rootDirectory` | プロジェクトのルートディレクトリ |
| `buildCommand` | ビルドコマンド |
| `installCommand` | インストールコマンド |
| `outputDirectory` | 出力ディレクトリ |
| `framework` | フレームワーク（`nextjs`等） |

### カスタム環境作成

**エンドポイント**: `POST /v9/projects/{idOrName}/custom-environments`

```bash
curl -X POST "https://api.vercel.com/v9/projects/<project-id-or-name>/custom-environments?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "develop",
    "name": "Develop",
    "branchMatcher": {
      "type": "equals",
      "pattern": "develop"
    }
  }'
```

**branchMatcherのtype**:

| type | 説明 | 例 |
|------|------|-----|
| `equals` | 完全一致 | `develop` → developブランチのみ |
| `startsWith` | 前方一致 | `feature/` → feature/*ブランチ |
| `endsWith` | 後方一致 | `-hotfix` → *-hotfixブランチ |

### 環境変数追加（カスタム環境対応）

**エンドポイント**: `POST /v10/projects/{idOrName}/env`

```bash
curl -X POST "https://api.vercel.com/v10/projects/<project-id-or-name>/env?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DOTENV_PRIVATE_KEY_DEVELOP",
    "value": "<your-key>",
    "type": "encrypted",
    "target": ["preview"],
    "customEnvironmentIds": ["<custom-env-id>"]
  }'
```

**パラメータ**:

| パラメータ | 説明 |
|-----------|------|
| `key` | 環境変数名 |
| `value` | 値 |
| `type` | `plain`, `encrypted`, `secret` |
| `target` | `["production"]`, `["preview"]`, `["development"]` |
| `customEnvironmentIds` | カスタム環境のID配列（オプション） |

**重要**: `customEnvironmentIds`を指定することで、特定のカスタム環境にのみ環境変数を設定できます。

### カスタム環境一覧取得

**エンドポイント**: `GET /v9/projects/{idOrName}/custom-environments`

```bash
curl "https://api.vercel.com/v9/projects/<project-id-or-name>/custom-environments?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

レスポンスから `customEnvironmentIds` に使用するIDを取得できます。

---

## vercel.json設定リファレンス

`vercel.json` はリポジトリに配置する設定ファイルで、ビルド設定を定義します。

### 基本設定

```json
{
  "buildCommand": "bash scripts/vercel-build-safe.sh web",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 設定項目

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| `buildCommand` | ビルドコマンド | フレームワークに依存 |
| `installCommand` | 依存関係インストールコマンド | `npm install` |
| `outputDirectory` | ビルド出力ディレクトリ | フレームワークに依存 |
| `framework` | フレームワーク指定 | 自動検出 |
| `regions` | デプロイリージョン | `["iad1"]` |

### 注意事項

- `vercel.json` では**Root Directoryは設定できません**
- Root Directoryは Dashboard または API で設定する必要があります
- モノレポでは各アプリの `vercel.json` がそのアプリのビルド設定として使用されます

---

## 実践例：新規アプリのセットアップ手順

以下は、モノレポに新しいアプリ（例: `apps/admin`）を追加し、Vercelにデプロイする完全な手順です。

### 前提条件

- Vercel CLIがインストール済み（`npm i -g vercel`）
- `VERCEL_TOKEN` 環境変数が設定済み
- チームIDを把握している

### Step 1: vercel.jsonの作成

`apps/admin/vercel.json`:

```json
{
  "buildCommand": "bash scripts/vercel-build-safe.sh admin",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

### Step 2: CLIでプロジェクト作成・Git接続

```bash
# チーム切り替え
vercel switch <team-slug>

# プロジェクト作成とGit接続
vercel link --project=<project-name> --yes
vercel git connect https://github.com/<org>/<repo> --yes
```

### Step 3: APIでRoot Directory設定

CLIではRoot Directoryを設定できないため、APIを使用します。

```bash
curl -X PATCH "https://api.vercel.com/v9/projects/<project-name>?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rootDirectory": "apps/admin"
  }'
```

### Step 4: カスタム環境の作成（必要な場合）

```bash
# Develop環境を作成
curl -X POST "https://api.vercel.com/v9/projects/<project-name>/custom-environments?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "develop",
    "name": "Develop",
    "branchMatcher": {
      "type": "equals",
      "pattern": "develop"
    }
  }'
```

### Step 5: 環境変数の設定

**標準環境（Production/Preview）への設定 - CLIで可能**:

```bash
# Production環境
echo "<production-key>" | vercel env add DOTENV_PRIVATE_KEY_PRODUCTION production

# Preview環境（全プレビュー）
echo "<preview-key>" | vercel env add DOTENV_PRIVATE_KEY_PREVIEW preview
```

**カスタム環境への設定 - APIが必要**:

```bash
# カスタム環境ID取得
CUSTOM_ENV_ID=$(curl -s "https://api.vercel.com/v9/projects/<project-name>/custom-environments?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | jq -r '.environments[] | select(.slug=="develop") | .id')

# カスタム環境に環境変数設定
curl -X POST "https://api.vercel.com/v10/projects/<project-name>/env?teamId=<team-id>" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DOTENV_PRIVATE_KEY_DEVELOP",
    "value": "<develop-key>",
    "type": "encrypted",
    "target": ["preview"],
    "customEnvironmentIds": ["'"$CUSTOM_ENV_ID"'"]
  }'
```

### Step 6: デプロイ確認

```bash
# 手動デプロイ（プレビュー）
vercel

# 本番デプロイ
vercel --prod
```

---

## トラブルシューティング

### CLIで環境変数が設定できない

**症状**: `vercel env add` でカスタム環境を指定できない

**原因**: Vercel CLIはカスタム環境への環境変数設定をサポートしていません

**解決策**: APIを使用して `customEnvironmentIds` を指定して設定

### Root Directoryが反映されない

**症状**: vercel.jsonにrootDirectoryを設定しても反映されない

**原因**: vercel.jsonではRoot Directoryは設定できません

**解決策**: DashboardまたはAPIで設定

### APIでチームプロジェクトにアクセスできない

**症状**: 404エラーが返る

**原因**: `teamId`パラメータが不足している

**解決策**: URLに `?teamId=<team-id>` を追加

---

## GitHub Secrets設定（CI/CD用）

CI/CDワークフローで使用する環境変数は**GitHub Secrets**で管理します。

> **重要**: dotenvxの`.env.ci`ファイルは非推奨です。複数のenvファイルを読み込む際に変数の競合が発生し、デプロイ時に誤った値が使用されるリスクがあるため、GitHub Secretsに一元化しています。

### 必要なSecrets

| Secret名 | 説明 |
|---------|------|
| `VERCEL_TOKEN` | Vercel APIトークン |
| `VERCEL_ORG_ID` | VercelチームID |
| `VERCEL_PROJECT_ID_WEB` | WebアプリのプロジェクトID |
| `VERCEL_PROJECT_ID_ADMIN` | AdminアプリのプロジェクトID |
| `TURBO_TOKEN` | Turborepoリモートキャッシュトークン |
| `TURBO_TEAM` | TurborepoチームID |

### gh CLIでの設定

```bash
# Secret一覧確認
gh secret list --repo <owner>/<repo>

# Secret設定
gh secret set VERCEL_TOKEN --repo <owner>/<repo> --body "<token>"

# 複数Secretを一括設定
gh secret set VERCEL_ORG_ID --repo <owner>/<repo> --body "<org-id>"
gh secret set VERCEL_PROJECT_ID_WEB --repo <owner>/<repo> --body "<project-id>"
gh secret set VERCEL_PROJECT_ID_ADMIN --repo <owner>/<repo> --body "<project-id>"
gh secret set TURBO_TOKEN --repo <owner>/<repo> --body "<token>"
gh secret set TURBO_TEAM --repo <owner>/<repo> --body "<team-id>"
```

### CI/CDワークフローでの使用

```yaml
# .github/workflows/ci.yml
jobs:
  deploy-web:
    runs-on: ubuntu-latest
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_WEB }}
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

---

## 関連ドキュメント

- [デプロイセットアップ手順（Dashboard操作）](./deployment-setup.md)
- [環境変数セットアップ手順](./environment-setup.md)
- [デプロイメント設計方針](../steering/infrastructure/deployment.md)
- [Vercel CLI公式ドキュメント](https://vercel.com/docs/cli)
- [Vercel REST API公式ドキュメント](https://vercel.com/docs/rest-api)
- [GitHub CLI公式ドキュメント](https://cli.github.com/manual/)
