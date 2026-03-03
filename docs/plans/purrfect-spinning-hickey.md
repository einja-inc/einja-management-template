# Plan: infra-maintenance SKILL.md 自動化レベル強化

## Context

前回の修正（カテゴリ5全Secrets対応、ゼロ状態判定、Vercel新規プロジェクト作成）が適用済み。
Explore + Codex の並行調査+レビューで、以下の問題が発見された:

1. **CLI/APIで自動取得可能な値を人間に手動操作させている箇所が5件**
2. **Vercelプロジェクト作成がDashboard GUI操作のまま**（CLI自動化可能）
3. **Neonプロジェクト名がハードコード**（`einja-management` 固定）
4. **トークン有効性の検証なし**（存在確認のみ）

**設計原則**:
1. API/CLIで取得・生成可能な値は絶対に人間に操作させない
2. プロジェクト名は推定＋確認のハイブリッド方式
3. 人間に聞く場合は必ず取得手順を提示

---

## 共通: プロジェクト名推定ロジック

Vercel/Neon のプロジェクト作成時に使用:

```bash
# 1. package.json name から推定（優先）
BASE_NAME=$(cat package.json | jq -r '.name // empty' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')

# 2. フォールバック: Git リポジトリ名
if [ -z "$BASE_NAME" ]; then
  BASE_NAME=$(basename "$(git remote get-url origin 2>/dev/null)" .git | sed 's/-template$//')
fi

# 3. jq未インストール時のフォールバック
if [ -z "$BASE_NAME" ]; then
  BASE_NAME=$(grep '"name"' package.json | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')
fi
```

推定した `$BASE_NAME` を元に:
- **Vercel**: `${BASE_NAME}-web`, `${BASE_NAME}-admin`
- **Neon**: `${BASE_NAME}`

AskUserQuestionで推定名をデフォルト値として提示し、ユーザーに承認/変更してもらう。

---

## 修正計画

**対象ファイル**: `.claude/skills/einja-infra-maintenance/SKILL.md` のみ

### 修正1: Phase 1にトークン有効性検証を追加

**修正箇所**: L52-68（Phase 1: 環境状態の自動検出）

CLI存在確認の後に追加:
```bash
# === トークン有効性検証（.env.personal 存在時のみ） ===
if [ -f ".env.personal" ]; then
  # 並行実行で高速化（各コマンドにタイムアウト設定）
  timeout 5 gh auth status 2>/dev/null && echo "✅ GITHUB_TOKEN 有効" || echo "⚠️ GITHUB_TOKEN 無効/未設定" &
  timeout 5 vercel whoami 2>/dev/null && echo "✅ VERCEL_TOKEN 有効" || echo "⚠️ VERCEL_TOKEN 無効/未設定" &
  if [ -n "$NEON_API_KEY" ]; then
    timeout 5 neonctl projects list --api-key "$NEON_API_KEY" >/dev/null 2>&1 && echo "✅ NEON_API_KEY 有効" || echo "⚠️ NEON_API_KEY 無効/期限切れ" &
  else
    echo "⚠️ NEON_API_KEY 未設定"
  fi
  wait
fi
```

### 修正2: Phase 2推奨ロジックにトークン無効を追加

**修正箇所**: L94-104（推奨ロジック テーブル）

テーブルに追加:
```
| トークン無効/期限切れ | 環境変数管理（個人トークン再設定） |
```

### 修正3: カテゴリ1 `.env.keys` 自動コピー化

**修正箇所**: L143（エラー対処テーブル `.env.keys`不在 行）

現状: `AskUserQuestion: 「メインworktreeからコピー or 手動配置」`

修正後:
```
| `.env.keys`不在 | `git worktree list` でメインworktreeを検出し、`.env.keys` が存在すれば自動コピー。不在の場合は「チームメンバーから `.env.keys` ファイルを受け取り、プロジェクトルートに配置してください」と案内 |
```

### 修正4: カテゴリ3 Vercelプロジェクト作成をCLI自動化

**修正箇所**: L214-223（新規プロジェクト作成セクション）

現状: Dashboard GUIでの手動作成を案内

修正後: CLI（`vercel link` + `vercel git connect`）+ API（Root Directory）で自動化
> **根拠**: `vercel-cli-reference.md` L280-302 の「新規アプリのセットアップ手順」に準拠

```
#### 新規プロジェクト作成（初回のみ）
> Vercelにプロジェクトが存在しない場合（ゼロ状態）のみ実行。VERCEL_TOKEN 取得済みが前提。

1. **プロジェクト名の推定・確認**:
   共通推定ロジックで `$BASE_NAME` を取得し、`${BASE_NAME}-web`, `${BASE_NAME}-admin` を候補として生成。
   AskUserQuestionでプロジェクト名と作成対象アプリ（web / admin / 両方）を確認。

2. **既存プロジェクトの確認**:
   ```bash
   vercel project ls
   ```
   既にプロジェクトが存在する場合は「既にVercelに存在します。スキップしますか？」と確認。

3. **CLIでプロジェクト作成・Git接続**:
   ```bash
   # チーム切り替え（必要な場合）
   vercel switch <team-slug>

   # アプリごとにプロジェクト作成
   for APP_NAME in web admin; do
     cd "apps/$APP_NAME"
     vercel link --project="${BASE_NAME}-${APP_NAME}" --yes
     vercel git connect "https://github.com/${GH_ORG}/${GH_REPO}" --yes
     cd ../..
   done
   ```
   > `vercel link` はプロジェクトが存在しない場合に自動作成する（`vercel-cli-reference.md` L287）

4. **APIでRoot Directory設定**（CLIでは不可: `vercel-cli-reference.md` L112）:
   ```bash
   for APP_NAME in web admin; do
     PROJECT_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')
     VERCEL_ORG_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')
     curl -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$VERCEL_ORG_ID" \
       -H "Authorization: Bearer $VERCEL_TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"rootDirectory\": \"apps/$APP_NAME\"}"
   done
   ```

5. **プロジェクトID/ORG IDを自動取得・表示**:
   ```bash
   for APP_NAME in web admin; do
     echo "$(echo $APP_NAME | tr '[:lower:]' '[:upper:]'):"
     echo "  PROJECT_ID: $(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')"
     echo "  ORG_ID: $(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')"
   done
   ```
   GitHub Secretsへの登録を提案（→ カテゴリ5: 一括設定 Step 2）
```

### 修正5: カテゴリ3 初期設定の PROJECT_ID 自動取得

**修正箇所**: L225-237（初期設定セクション）

現状 L237: `プロジェクトID取得・表示`（手動）

修正後:
```
5. `.vercel/project.json` からプロジェクトIDとORG IDを自動取得:
   ```bash
   VERCEL_PROJECT_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.projectId')
   VERCEL_ORG_ID=$(cat "apps/$APP_NAME/.vercel/project.json" | jq -r '.orgId')
   ```
6. 取得結果を表示し、GitHub Secretsへの登録を提案（→ カテゴリ5）
```

### 修正6: カテゴリ4 Neonプロジェクト作成の自動化

**修正箇所**: L269-280（Neon初期設定セクション全体）

現状の問題:
- プロジェクト名 `einja-management` がハードコード
- 既存プロジェクトの存在チェックなし
- NEON_PROJECT_ID の `.env.preview` への設定が手動

修正後:
```
#### 初期設定
1. NEON_API_KEY確認 → 未設定時はURL案内 + `.env.personal`保存
   - 取得URL: https://console.neon.tech/app/settings/api-keys
   - **`neonctl auth`は使用しない**（理由: `neon-cli-reference.md`「認証方式」参照）

2. **既存プロジェクトの確認**:
   ```bash
   neonctl projects list --api-key $NEON_API_KEY
   ```
   既存プロジェクトがあれば一覧表示し、使用するプロジェクトをAskUserQuestionで確認。
   既存プロジェクトを使用する場合 → `neonctl projects get $PROJECT_ID` でIDを取得してステップ4へ。

3. **プロジェクト名の推定・確認・作成**:
   共通推定ロジックで `$BASE_NAME` を取得。AskUserQuestionで確認（デフォルト値として提示）。
   ```bash
   neonctl projects create --name "$NEON_PROJECT_NAME" --region-id aws-ap-northeast-1 --api-key $NEON_API_KEY
   ```
   作成後、`neonctl projects list` でプロジェクトIDを取得:
   ```bash
   NEON_PROJECT_ID=$(neonctl projects list --api-key $NEON_API_KEY | jq -r ".projects[] | select(.name==\"$NEON_PROJECT_NAME\") | .id")
   ```

4. **`.env.preview` に自動設定** → dotenvx暗号化:
   ```bash
   dotenvx decrypt -f .env.preview --stdout > .env.preview.tmp
   # 既存の同名変数を削除してから追加（重複防止）
   grep -v "^NEON_PROJECT_ID=" .env.preview.tmp | grep -v "^NEON_API_KEY=" > .env.preview.clean
   echo "NEON_PROJECT_ID=$NEON_PROJECT_ID" >> .env.preview.clean
   echo "NEON_API_KEY=$NEON_API_KEY" >> .env.preview.clean
   rm .env.preview && mv .env.preview.clean .env.preview
   dotenvx encrypt -f .env.preview
   ```

5. ブランチ戦略初期設定:
   - production（main）ブランチ確認
   - developmentブランチ作成
```

カテゴリ4サブメニューに追加:
```
- **プロジェクトID取得**: 既存プロジェクトのIDを `neonctl projects list` で自動取得
```

### 修正7: カテゴリ5 一括設定 Step 2 を自動取得に変更

**修正箇所**: L352-365（Step 2: Vercel関連Secrets）

現状: AskUserQuestionで4つの値を手動入力

修正後: VERCEL_TOKEN のみ人間入力、残り3つは自動取得
```
**Step 2: Vercel関連Secrets**

2-a. `VERCEL_TOKEN`（人間入力が必須）:
AskUserQuestionで値を入力してもらう。取得手順:
- Vercel Dashboard（https://vercel.com/account/tokens）> 「Create Token」
- Scope: Full Account を選択
- 入力後、`vercel whoami --token $TOKEN` で有効性を自動検証

2-b. `VERCEL_ORG_ID`（自動取得）:
```bash
# apps/web/.vercel/project.json から取得（vercel link 実行済みの場合）
VERCEL_ORG_ID=$(cat apps/web/.vercel/project.json 2>/dev/null | jq -r '.orgId')
# 未取得の場合はAPI経由
if [ -z "$VERCEL_ORG_ID" ] || [ "$VERCEL_ORG_ID" = "null" ]; then
  VERCEL_ORG_ID=$(curl -s "https://api.vercel.com/v2/teams" \
    -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.teams[0].id')
fi
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
echo "✅ VERCEL_ORG_ID = $VERCEL_ORG_ID を設定しました"
```

2-c. `VERCEL_PROJECT_ID_WEB` / `VERCEL_PROJECT_ID_ADMIN`（自動取得）:
```bash
for APP_NAME in web admin; do
  # apps/<app>/.vercel/project.json から取得（vercel link 実行済みの場合）
  PROJECT_ID=$(cat "apps/$APP_NAME/.vercel/project.json" 2>/dev/null | jq -r '.projectId')
  if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    # vercel link 未実行の場合: カテゴリ3（新規プロジェクト作成 or 初期設定）を先に実行するよう案内
    echo "⚠️ apps/$APP_NAME/.vercel/project.json が見つかりません。先にカテゴリ3でVercelプロジェクトをリンクしてください"
    continue
  fi
  SECRET_NAME="VERCEL_PROJECT_ID_$(echo $APP_NAME | tr '[:lower:]' '[:upper:]')"
  gh secret set "$SECRET_NAME" --body "$PROJECT_ID"
  echo "✅ $SECRET_NAME = $PROJECT_ID を設定しました"
done
```
```

### 修正8: カテゴリ5 一括設定 Step 3 の TURBO_TOKEN 自動化

**修正箇所**: L367-383（Step 3: Turborepo Remote Cache）

```
**Step 3: Turborepo Remote Cache**

3-a. `TURBO_TOKEN`:
VERCEL_TOKEN（Step 2-a で取得済み）と同じ値を使用（別トークンを使う場合のみAskUserQuestionで入力）:
```bash
gh secret set TURBO_TOKEN --body "$VERCEL_TOKEN"
echo "✅ TURBO_TOKEN を設定しました（VERCEL_TOKENと同一値）"
```

3-b. `TURBO_TEAM`（自動取得）:
```bash
TURBO_TEAM=$(cat .turbo/config.json 2>/dev/null | jq -r '.teamId // empty')
if [ -z "$TURBO_TEAM" ]; then
  echo "⚠️ .turbo/config.json 未生成。先に npx turbo login && npx turbo link を実行します"
  npx turbo login && npx turbo link
  TURBO_TEAM=$(cat .turbo/config.json | jq -r '.teamId')
fi
gh secret set TURBO_TEAM --body "$TURBO_TEAM"
echo "✅ TURBO_TEAM = $TURBO_TEAM を設定しました"
```
```

### 修正9: エラーハンドリング テーブルの改善

**修正箇所**: L607-613

修正後:
```
| CLI未インストール | 自動インストール実行: `brew install <cli>` または `npm i -g <cli>`。Docker のみ OrbStack インストール案内（GUI必須のため） |
| トークン未設定 | 取得URL案内 → AskUserQuestionで値入力 → `.env.personal`に保存 → API検証（`vercel whoami` / `gh auth status` / `neonctl projects list`）で有効性確認 |
| トークン無効/期限切れ | 再取得URL案内 → AskUserQuestionで新しい値入力 → `.env.personal`を更新 → API検証で有効性確認 |
```

### 修正10: カテゴリ6 ヘルスチェックにトークン検証追加

**修正箇所**: L394-416（カテゴリ6: ローカル環境チェック）

CLIツール確認の後に、修正1と同じトークン有効性検証ブロック（タイムアウト付き並行実行）を追加。

---

## 修正サマリー

| # | 箇所 | 変更内容 | 効果 |
|---|------|---------|------|
| 1 | Phase 1 | トークン有効性検証追加（並行・タイムアウト付き） | 期限切れ・無効トークンを自動検知 |
| 2 | Phase 2 | 推奨ロジックにトークン無効を追加 | 無効時に自動でカテゴリ2へ誘導 |
| 3 | カテゴリ1 | `.env.keys` 自動コピー化 | worktree存在時は人間操作不要 |
| 4 | カテゴリ3 | Vercelプロジェクト作成をCLI自動化（`vercel link` + `vercel git connect` + API Root Directory） | Dashboard操作不要 |
| 5 | カテゴリ3 | PROJECT_ID/ORG_ID を `apps/<app>/.vercel/project.json` から自動取得 | 手動入力不要 |
| 6 | カテゴリ4 | Neonプロジェクト名推定＋確認 / 既存チェック / ID自動取得 / `.env.preview` 自動設定（重複防止付き） | ハードコード解消 |
| 7 | カテゴリ5 Step 2 | VERCEL_ORG_ID/PROJECT_ID を `.vercel/project.json` から自動取得。VERCEL_TOKEN のみ手動 | 4値→1値のみ手動 |
| 8 | カテゴリ5 Step 3 | TURBO_TOKEN をVERCEL_TOKEN再利用で自動化 | 手動入力不要 |
| 9 | エラーハンドリング | CLI自動実行化 + トークン検証フロー | 提案→自動実行 |
| 10 | カテゴリ6 | トークン有効性検証追加 | ヘルスチェック精度向上 |

## 人間操作が必要な場面（技術的制約で自動化不可）

| 場面 | 理由 | 提供する取得手順 |
|------|------|----------------|
| VERCEL_TOKEN 入力 | Dashboard でのトークン生成が必須 | URL（https://vercel.com/account/tokens）+ 「Create Token」手順 |
| NEON_API_KEY 入力 | Console でのキー生成が必須 | URL（https://console.neon.tech/app/settings/api-keys）+ 手順 |
| GITHUB_TOKEN 入力 | Settings ページでの生成が必須 | URL（https://github.com/settings/tokens/new）+ 必要スコープ |
| Docker インストール | GUIインストーラーが必須 | `brew install orbstack` + 公式サイトURL |
| `.env.keys` 配置 | チーム内の秘密鍵共有（worktree不在時） | 「チームメンバーから受け取りプロジェクトルートに配置」 |
| プロジェクト名確認 | 命名はプロジェクト固有の判断 | 推定名をデフォルト提示、変更可 |

**上記以外の全ての値は CLI/API で自動取得・自動設定される。**

## レビュー指摘事項と対応

| 指摘 | 対応 |
|------|------|
| Vercel `POST /v9/projects` API未記載 | ❌廃止 → CLI `vercel link` + `vercel git connect` に変更（修正4） |
| Neon `--output json` レスポンス構造未確認 | `neonctl projects list` + `jq` パースに変更（修正6） |
| dotenvx `.env.preview` 重複追加リスク | `grep -v` で既存行を削除してから追加（修正6） |
| `.vercel/project.json` パス不統一 | 全箇所を `apps/<app>/.vercel/project.json` に統一（修正4,5,7） |
| `jq` 未インストール時のフォールバック | 共通推定ロジックに `grep` + `sed` フォールバック追加 |
| Phase 1 トークン検証のパフォーマンス | バックグラウンド並行実行 + `timeout 5` を追加（修正1） |

## 検証方法

1. `pnpm prepush` でlint/typecheck/testが通ることを確認
2. 全AskUserQuestion箇所を洗い出し、CLI/APIで代替可能な値がないことをgrepで確認
3. ゼロ状態シミュレーション:
   - VERCEL_TOKEN入力 → `vercel link` でプロジェクト作成 → `apps/<app>/.vercel/project.json` から ORG_ID/PROJECT_ID 自動取得 → Secrets 自動登録
   - NEON_API_KEY入力 → `neonctl projects create` → `neonctl projects list` でID取得 → `.env.preview` 自動設定（重複防止付き）
   - Phase 1 でトークン有効性検証（並行・タイムアウト付き）→ 期限切れ検知 → カテゴリ2 へ自動誘導
4. `.vercel/project.json` パスが全箇所で `apps/<app>/` 配下を参照していることを確認
