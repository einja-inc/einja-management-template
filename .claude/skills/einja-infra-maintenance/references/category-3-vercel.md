# カテゴリ3: Vercel管理

## 目次
- [サブメニュー](#サブメニュー)
- [実行手順](#実行手順)
  - [新規プロジェクト作成](#新規プロジェクト作成初回のみ)
  - [初期設定](#初期設定)
  - [環境変数同期](#環境変数同期)
  - [デプロイ状態確認](#デプロイ状態確認)
- [参照ドキュメント](#参照ドキュメント)

## サブメニュー
- **新規プロジェクト作成**: Vercelプロジェクトの新規作成（初回のみ）
- **初期設定**: プロジェクトリンク・Root Directory設定
- **環境変数同期**: dotenvx鍵のVercel同期
- **デプロイ状態確認**: 最新デプロイ情報表示

## 実行手順

> **非対話モードの必須オプション**: チームアカウントで `--yes` を使用する場合、`--scope $VERCEL_TEAM_SLUG` の指定が必須。省略すると `missing_scope` エラーになる。`$VERCEL_TEAM_SLUG` は `.env.personal` または `vercel team ls` から取得する。

### 新規プロジェクト作成（初回のみ）
> Vercelにプロジェクトが存在しない場合（ゼロ状態）のみ実行。VERCEL_TOKEN 取得済みが前提。

1. **プロジェクト名の推定・確認**:
   package.jsonのnameフィールドからプロジェクト名を推定（`@scope/name` → `name`、`-monorepo`/`-template`サフィックス除去）。
   フォールバック: Gitリポジトリ名から推定。
   ```bash
   BASE_NAME=$(cat package.json | jq -r '.name // empty' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')
   if [ -z "$BASE_NAME" ]; then
     BASE_NAME=$(basename "$(git remote get-url origin 2>/dev/null)" .git | sed 's/-template$//')
   fi
   # jq未インストール時のフォールバック
   if [ -z "$BASE_NAME" ]; then
     BASE_NAME=$(grep '"name"' package.json | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')
   fi
   ```
   推定した `${BASE_NAME}-web`, `${BASE_NAME}-admin` をAskUserQuestionでプロジェクト名と作成対象アプリ（web / admin / 両方）を確認。

2. **既存プロジェクトの確認**:
   ```bash
   vercel project ls --scope $VERCEL_TEAM_SLUG
   ```
   既にプロジェクトが存在する場合は「既にVercelに存在します。スキップしますか？」と確認。

3. **CLIでプロジェクト作成・Git接続**:
   ```bash
   # チーム切り替え（必要な場合）
   vercel switch <team-slug>

   # apps/ 配下のディレクトリを動的取得
   APP_DIRS=$(ls -d apps/*/  2>/dev/null | xargs -I{} basename {})
   for APP_NAME in $APP_DIRS; do
     (cd "apps/$APP_NAME" && vercel link --project="${BASE_NAME}-${APP_NAME}" --yes --scope $VERCEL_TEAM_SLUG)
     (cd "apps/$APP_NAME" && vercel git connect "https://github.com/${GH_ORG}/${GH_REPO}" --yes --scope $VERCEL_TEAM_SLUG)
   done
   ```
   > `vercel link` はプロジェクトが存在しない場合に自動作成する（`vercel-cli-reference.md` L287）

4. **APIでRoot Directory設定**（CLIでは不可: `vercel-cli-reference.md` L112）:
   ```bash
   # apps/ 配下のディレクトリを動的取得
   APP_DIRS=$(ls -d apps/*/  2>/dev/null | xargs -I{} basename {})
   for APP_NAME in $APP_DIRS; do
     PROJECT_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')
     VERCEL_ORG_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')
     # 注意: $VERCEL_TOKEN は事前に export されていること
     curl -s -X PATCH "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${VERCEL_ORG_ID}" \
       -H "Authorization: Bearer ${VERCEL_TOKEN}" \
       -H "Content-Type: application/json" \
       -d "{\"rootDirectory\": \"apps/${APP_NAME}\"}"
   done
   ```

4.5. **Git自動デプロイの無効化確認**:
   テンプレートの `apps/*/vercel.json` に `{"git": {"deploymentEnabled": false}}` が含まれているため、通常は自動適用される。既存プロジェクトや手動セットアップの場合は以下で確認:
   ```bash
   # 各アプリのvercel.jsonを確認
   for APP_NAME in $(ls -d apps/*/ 2>/dev/null | xargs -I{} basename {}); do
     if [ -f "apps/$APP_NAME/vercel.json" ]; then
       echo "$APP_NAME: $(cat apps/$APP_NAME/vercel.json)"
     else
       echo "⚠️ $APP_NAME: vercel.json が存在しません。Git自動デプロイが有効な可能性があります"
     fi
   done
   ```
   > **重要**: デプロイはGitHub Actions（`vercel build --prebuilt` + `vercel deploy`）で一元管理しているため、VercelのGit Integration自動デプロイは無効にする。有効のままだと二重デプロイが発生する。

5. **プロジェクトID/ORG IDを自動取得・表示**:
   ```bash
   # apps/ 配下のディレクトリを動的取得
   APP_DIRS=$(ls -d apps/*/  2>/dev/null | xargs -I{} basename {})
   for APP_NAME in $APP_DIRS; do
     echo "$(echo $APP_NAME | tr '[:lower:]' '[:upper:]'):"
     echo "  PROJECT_ID: $(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')"
     echo "  ORG_ID: $(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')"
   done
   ```
   GitHub Secretsへの登録を提案（→ カテゴリ5: 一括設定 Step 2）

### 初期設定
1. VERCEL_TOKEN確認 → 未設定時はURL案内 + `.env.personal`保存
2. AskUserQuestionでアプリ選択（web / admin）
3. `vercel link --project=$NAME --yes --scope $VERCEL_TEAM_SLUG` で接続
4. Root Directory設定:
   ```bash
   # 注意: $VERCEL_TOKEN は事前に export されていること
   curl -s -X PATCH "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_ORG_ID}" \
     -H "Authorization: Bearer ${VERCEL_TOKEN}" \
     -H "Content-Type: application/json" \
     -d "{\"rootDirectory\": \"apps/${APP_NAME}\"}"
   ```
5. `.vercel/project.json` からプロジェクトIDとORG IDを自動取得:
   ```bash
   VERCEL_PROJECT_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')
   VERCEL_ORG_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')
   ```
6. 取得結果を表示し、GitHub Secretsへの登録を提案（→ カテゴリ5）

### 環境変数同期
> **重要**: `vercel env add` は運用方針としてproduction環境のみで実行する。技術的にはpreview環境でもブランチ指定で可能だが、develop/staging/PRの環境変数はCI/CDワークフローの `vercel deploy --env` で実行時注入する運用としている。
> 以下の手動同期は**初回セットアップ時のみ**実行。

1. `.env.keys`からDOTENV_PRIVATE_KEY_*を抽出
2. AskUserQuestionで同期対象を確認（値はマスク表示）
3. 承認後、`vercel env rm --scope $VERCEL_TEAM_SLUG` + `vercel env add --scope $VERCEL_TEAM_SLUG` でVercelに同期
4. 設定結果を `vercel env ls --scope $VERCEL_TEAM_SLUG` で確認

> **詳細手順**: `docs/einja/instructions/vercel-cli-reference.md`の「環境変数同期自動化」を参照

### デプロイ状態確認
```bash
vercel ls --scope $VERCEL_TEAM_SLUG
```

## 参照ドキュメント
- `docs/einja/instructions/vercel-cli-reference.md`
- `docs/einja/instructions/deployment-setup.md`
