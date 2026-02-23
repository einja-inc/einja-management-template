<!-- @einja:managed:start -->
# Neon CLI/API リファレンス

## 概要

このドキュメントは、Neonプロジェクトのセットアップにおいて、どの操作がCLI/API/Dashboardで可能かを明確にしたリファレンスです。

ダッシュボード操作中心のセットアップ手順は [デプロイセットアップ手順](./deployment-setup.md) を参照してください。

---

## 操作別対応表

| 操作 | CLI | API | Dashboard |
|------|:---:|:---:|:---------:|
| プロジェクト作成 | ✅ | ✅ | ✅ |
| プロジェクト一覧取得 | ✅ | ✅ | ✅ |
| プロジェクト削除 | ✅ | ✅ | ✅ |
| ブランチ作成 | ✅ | ✅ | ✅ |
| ブランチ一覧取得 | ✅ | ✅ | ✅ |
| ブランチ削除 | ✅ | ✅ | ✅ |
| 接続文字列取得 | ✅ | ✅ | ✅ |
| データベース作成 | ✅ | ✅ | ✅ |
| データベース一覧取得 | ✅ | ✅ | ✅ |
| ロール（ユーザー）管理 | ✅ | ✅ | ✅ |
| ブランチの自動サスペンド設定 | ❌ | ✅ | ✅ |

### 凡例
- ✅: 対応（推奨または唯一の方法）
- ❌: 非対応

---

## CLIコマンドリファレンス

### 認証

```bash
# 対話モード（手動操作用）
neonctl auth

# 環境変数認証（自動化用・Skill推奨）
export NEON_API_KEY=your_api_key

# コマンドオプション認証
neonctl projects list --api-key your_api_key
```

**自動化時の推奨方法**:
- `NEON_API_KEY` 環境変数の使用
- `--api-key` フラグは冗長になるため非推奨（環境変数で十分）

### プロジェクト操作

```bash
# プロジェクト一覧
neonctl projects list

# プロジェクト作成
neonctl projects create \
  --name einja-management \
  --region-id aws-ap-northeast-1

# プロジェクト削除
neonctl projects delete $PROJECT_ID

# プロジェクト詳細確認
neonctl projects get $PROJECT_ID
```

### ブランチ操作

```bash
# ブランチ一覧取得
neonctl branches list --project-id $PROJECT_ID

# ブランチ作成（親ブランチ指定なし）
neonctl branches create \
  --project-id $PROJECT_ID \
  --name production

# ブランチ作成（親ブランチ指定あり）
# --parent はブランチ名、ブランチID、タイムスタンプ、LSNを受け付ける
neonctl branches create \
  --project-id $PROJECT_ID \
  --name preview/pr-123 \
  --parent production

# ブランチ削除
neonctl branches delete $BRANCH_ID --project-id $PROJECT_ID

# ブランチ詳細確認
neonctl branches get $BRANCH_ID --project-id $PROJECT_ID
```

### 接続文字列取得

```bash
# デフォルトブランチの接続文字列
neonctl connection-string --project-id $PROJECT_ID

# 特定ブランチの接続文字列
neonctl connection-string $BRANCH_NAME --project-id $PROJECT_ID

# プール接続（Connection Pooling）
neonctl connection-string $BRANCH_NAME \
  --project-id $PROJECT_ID \
  --pooled

# 特定データベース指定
neonctl connection-string $BRANCH_NAME \
  --project-id $PROJECT_ID \
  --database-name neondb
```

### データベース操作

```bash
# データベース一覧（デフォルトブランチ）
neonctl databases list --project-id $PROJECT_ID

# データベース一覧（特定ブランチ）
neonctl databases list \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME

# データベース作成（デフォルトブランチ）
neonctl databases create \
  --project-id $PROJECT_ID \
  --name neondb

# データベース作成（特定ブランチ、オーナー指定）
neonctl databases create \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME \
  --name neondb \
  --owner-name $ROLE_NAME

# データベース削除
neonctl databases delete $DATABASE_NAME \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME
```

**注意**: `--project-id` はマルチプロジェクトアカウントの場合のみ必須。`--branch` はオプション（省略時はデフォルトブランチが使用される）。

### ロール（ユーザー）管理

```bash
# ロール一覧（デフォルトブランチ）
neonctl roles list --project-id $PROJECT_ID

# ロール一覧（特定ブランチ）
neonctl roles list \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME

# ロール作成（デフォルトブランチ）
neonctl roles create \
  --project-id $PROJECT_ID \
  --name $ROLE_NAME

# ロール作成（特定ブランチ）
neonctl roles create \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME \
  --name $ROLE_NAME

# ロール作成（ログイン不可）
neonctl roles create \
  --project-id $PROJECT_ID \
  --name $ROLE_NAME \
  --no-login

# ロール削除
neonctl roles delete $ROLE_NAME \
  --project-id $PROJECT_ID \
  --branch $BRANCH_NAME
```

**注意**:
- `--project-id` はマルチプロジェクトアカウントの場合のみ必須
- `--branch` はオプション（省略時はデフォルトブランチが使用される）
- `--name` フラグが必須で、位置引数 `<role-name>` ではない点に注意（公式ドキュメント準拠）

### CLIの制限事項

CLIでは以下の操作が**できません**：

1. **ブランチの自動サスペンド設定**: APIまたはDashboardで設定が必要
2. **プロジェクトのリージョン変更**: プロジェクト作成時のみ指定可能
3. **接続プール設定の詳細調整**: Dashboardで設定が必要

---

## APIリファレンス

### 認証

```bash
# Bearer Token認証
Authorization: Bearer $NEON_API_KEY

# ベースURL
https://console.neon.tech/api/v2
```

環境変数 `NEON_API_KEY` を設定するか、リクエスト時に指定します。

### 接続文字列取得（connection_uri API）

**エンドポイント**: `GET /projects/{project_id}/connection_uri`

このAPIは接続文字列を直接返すため、sedやjqでのパース不要です。

```bash
# 直接接続（pooled=false）
curl -s \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&pooled=false&database_name=neondb" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json" | jq -r '.uri'

# プール接続（pooled=true）
curl -s \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&pooled=true&database_name=neondb" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json" | jq -r '.uri'
```

**パラメータ**:

| パラメータ | 説明 | 必須 |
|-----------|------|:----:|
| `branch_id` | ブランチID | ✅ |
| `pooled` | Connection Pooling有効化 | ❌ |
| `database_name` | データベース名 | ❌ |
| `role_name` | ロール名 | ❌ |

**注意**: このAPIは `uri` フィールドに完全な接続文字列を返すため、GitHub Actionsでのマスキング（`::add-mask::`）を忘れずに実施してください。

### ブランチ一覧取得（ページネーション対応）

**エンドポイント**: `GET /projects/{project_id}/branches`

```bash
# 基本的な取得（最大100件）
curl -s \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches?limit=100" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json"

# ページネーション（cursor使用）
CURSOR=""
ALL_BRANCHES="[]"
while true; do
  URL="https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches?limit=100"
  if [ -n "$CURSOR" ]; then
    URL="${URL}&cursor=${CURSOR}"
  fi
  RESPONSE=$(curl -s "$URL" \
    -H "Authorization: Bearer $NEON_API_KEY" \
    -H "Accept: application/json")
  PAGE=$(echo "$RESPONSE" | jq '.branches')
  ALL_BRANCHES=$(echo "$ALL_BRANCHES $PAGE" | jq -s '.[0] + .[1]')
  NEXT=$(echo "$RESPONSE" | jq -r '.pagination.next // empty')
  if [ -z "$NEXT" ]; then
    break
  fi
  CURSOR="$NEXT"
done
```

**パラメータ**:

| パラメータ | 説明 | デフォルト |
|-----------|------|----------|
| `limit` | 最大取得件数 | 100 |
| `cursor` | ページネーションカーソル | - |
| `search` | ブランチ名で検索 | - |

### ブランチ作成（自動サスペンド設定付き）

**エンドポイント**: `POST /projects/{project_id}/branches`

```bash
curl -X POST \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "preview/pr-123",
      "parent_id": "$PARENT_BRANCH_ID"
    },
    "endpoints": [
      {
        "type": "read_write",
        "autoscaling_limit_min_cu": 0.25,
        "autoscaling_limit_max_cu": 0.25,
        "suspend_timeout_seconds": 86400
      }
    ]
  }'
```

**パラメータ**:

| パラメータ | 説明 | デフォルト |
|-----------|------|----------|
| `branch.name` | ブランチ名 | 必須 |
| `branch.parent_id` | 親ブランチID | - |
| `endpoints[].suspend_timeout_seconds` | 自動サスペンドまでの秒数 | 300 |
| `endpoints[].autoscaling_limit_min_cu` | 最小CU（Compute Units） | 0.25 |
| `endpoints[].autoscaling_limit_max_cu` | 最大CU | 0.25 |

**自動サスペンドの設定**:
- `86400` 秒（1日間）アクセスなしでサスペンド
- コスト削減に有効

### ブランチ削除

**エンドポイント**: `DELETE /projects/{project_id}/branches/{branch_id}`

```bash
curl -X DELETE \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json"
```

### ブランチ存在確認（search + 完全一致）

```bash
# 検索API（部分一致）
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches?search=production" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json")

# 完全一致確認（jqで絞り込み）
BRANCH_EXISTS=$(curl -s \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches?search=production" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json" | jq -r ".branches[] | select(.name == \"production\") | .name")

if [ -n "$BRANCH_EXISTS" ]; then
  echo "Branch exists: production"
else
  echo "Branch not found: production"
fi
```

**注意**: `search` パラメータは部分一致のため、完全一致が必要な場合は `jq` で絞り込みが必要です。

---

## 実践例: ブランチ戦略セットアップ手順

### 前提条件

- Neonアカウント作成済み
- `NEON_API_KEY` 環境変数が設定済み
- `NEON_PROJECT_ID` を把握している

### Step 1: production（main）ブランチの確認

Neonプロジェクトのデフォルトブランチは自動的に `main` という名前で作成されます。このブランチを本番環境用として使用します。

```bash
# ブランチ一覧を確認
neonctl branches list --project-id $PROJECT_ID

# デフォルトブランチの接続文字列を取得
neonctl connection-string main --project-id $PROJECT_ID --pooled
```

**推奨**: デフォルトブランチ名を `production` にリネームする場合は、Neon Dashboardから変更してください（CLIでは非対応）。

### Step 2: developmentブランチの作成

```bash
# developmentブランチ作成（親: main）
# --parent にはブランチ名、ブランチID、タイムスタンプ、LSNを指定可能
neonctl branches create \
  --project-id $PROJECT_ID \
  --name development \
  --parent main

# 接続文字列を取得
neonctl connection-string development \
  --project-id $PROJECT_ID \
  --pooled
```

### Step 3: preview/pr-*ブランチの自動作成（GitHub Actions連携）

PR Preview用のブランチは、GitHub Actionsで自動作成・削除します。ブランチ名はGitブランチ名に依存せず、PR番号から生成されます。

詳細は [デプロイメント設計方針](../steering/infrastructure/deployment.md) の「ブランチ別デプロイフロー」セクションを参照してください。

**自動作成の流れ**:

1. PR作成時: `deploy-pr-preview.yml` が `preview/pr-<PR番号>` ブランチを作成
   - 例: PR #123 → `preview/pr-123`
2. PR更新時: 既存ブランチを再利用（`connection_uri` APIで接続文字列取得）
3. PRクローズ時: `cleanup-pr-preview-on-close.yml` がブランチを即座削除
4. 定期クリーンアップ: `cleanup-pr-preview-db.yml` が孤立ブランチを削除（毎日00:00 UTC）

---

## 自動化時の注意点

### 非対話実行

`neonctl auth` は対話型のため、自動化には以下のいずれかを使用します:

1. **環境変数方式（推奨）**:
   ```bash
   export NEON_API_KEY=your_api_key
   neonctl projects list
   ```

2. **コマンドオプション方式**:
   ```bash
   neonctl projects list --api-key your_api_key
   ```

### エラーハンドリング

**既存リソース重複**:

```bash
# ブランチ作成時の重複チェック
BRANCH_EXISTS=$(curl -s \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches?search=preview/pr-123" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json" | jq -r ".branches[] | select(.name == \"preview/pr-123\") | .id")

if [ -z "$BRANCH_EXISTS" ]; then
  echo "Creating new branch..."
  # ブランチ作成処理
else
  echo "Branch already exists, reusing..."
  # 既存ブランチIDを使用
fi
```

### レート制限

Neon APIにはレート制限があります（詳細はドキュメント未公開）。

**推奨対策**:
- バッチ処理では適度な間隔（1秒程度）を空ける
- ページネーション時は一度に大量取得せず、必要な分のみ取得

### 出力フォーマット

CLIは `--output json` オプションをサポートしていますが、デフォルトで構造化されたJSON出力が得られます。

```bash
# JSON形式で出力（デフォルト）
neonctl branches list --project-id $PROJECT_ID

# jqでパース
neonctl branches list --project-id $PROJECT_ID | jq -r '.branches[] | .name'
```

---

## トラブルシューティング

### neonctl未インストール

**症状**: `command not found: neonctl`

**解決策**:

```bash
# npmでグローバルインストール
npm install -g neonctl

# pnpmでグローバルインストール
pnpm add -g neonctl

# バージョン確認
neonctl --version
```

### 認証エラー

**症状**: `401 Unauthorized` または `Error: Authentication required`

**原因**:
- `NEON_API_KEY` が未設定または無効
- APIキーの有効期限切れ

**解決策**:

```bash
# APIキーの確認
echo $NEON_API_KEY

# Neon Dashboard > Account Settings > API Keys から新しいAPIキーを生成
# 環境変数を再設定
export NEON_API_KEY=new_api_key
```

### ブランチ名の制約

**制約**:
- 小文字、数字、ハイフン（`-`）、スラッシュ（`/`）のみ使用可能
- 最大63文字
- スラッシュ（`/`）は許可されているが、階層構造を持たない

**良い例**:
- `production`
- `development`
- `preview/pr-123`

**悪い例**:
- `PRODUCTION` （大文字不可）
- `preview_pr_123` （アンダースコア不可）

### 接続文字列の問題

**症状**: 接続文字列が空または `null` になる

**原因**:
- ブランチIDが不正
- データベース名が存在しない
- APIリクエストが失敗している

**解決策**:

```bash
# ブランチIDを確認
neonctl branches list --project-id $PROJECT_ID

# データベース一覧を確認
neonctl databases list --project-id $PROJECT_ID --branch $BRANCH_NAME

# 手動でAPIを実行してレスポンスを確認
curl -v \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&pooled=true&database_name=neondb" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Accept: application/json"
```

### 孤立ブランチの削除

**症状**: PRがクローズされたのにNeonブランチが残っている

**原因**:
- `cleanup-pr-preview-on-close.yml` の実行失敗
- 手動削除漏れ

**解決策**:

```bash
# 定期クリーンアップワークフローを手動実行
gh workflow run cleanup-pr-preview-db.yml

# または手動削除
BRANCH_ID=$(neonctl branches list --project-id $PROJECT_ID | jq -r '.branches[] | select(.name == "preview/pr-123") | .id')
neonctl branches delete $BRANCH_ID --project-id $PROJECT_ID
```

---

## 関連ドキュメント

- [デプロイセットアップ手順（Neonセクション）](./deployment-setup.md)
- [デプロイメント設計方針（Neonブランチ戦略）](../steering/infrastructure/deployment.md)
- [環境変数設計方針](../steering/infrastructure/environment-variables.md)
- [Neon公式ドキュメント](https://neon.tech/docs)
- [Neon API公式リファレンス](https://api-docs.neon.tech/reference/getting-started-with-neon-api)
- [neonctl CLI公式ドキュメント](https://neon.tech/docs/reference/neon-cli)
<!-- @einja:managed:end -->

---

<!-- @einja:seed:start id="neon-cli-reference-project" -->
## プロジェクト固有の設定

<!-- このセクションはプロジェクト固有の内容を追記する場合はここに記載 -->
<!-- einja syncで上書きされません -->
<!-- @einja:seed:end -->
