# カテゴリ5: GitHub Secrets管理

## 目次
- [サブメニュー](#サブメニュー)
- [実行手順](#実行手順)
  - [一覧表示](#一覧表示)
  - [個別設定](#個別設定)
  - [一括設定（全Secrets）](#一括設定全secrets)
- [参照ドキュメント](#参照ドキュメント)

## サブメニュー
- **一覧表示**: 現在のSecrets一覧
- **個別設定**: 指定したSecretを設定
- **一括設定**: `.env.keys`からdotenvx秘密鍵を一括設定

## 実行手順

### 一覧表示
```bash
gh secret list
```

### 個別設定
1. AskUserQuestionでSecret名と値を入力
2. `gh secret set $NAME --body "<value>"`
3. 設定確認: `gh secret list`

### 一括設定（全Secrets）
> **参照**: `docs/einja/instructions/deployment-setup.md`（セクション6）に全Secretsの取得手順あり

**Step 1: dotenvx秘密鍵を自動抽出**
```bash
for key_name in PREVIEW PRODUCTION DEVELOP STAGING; do
  value=$(grep "DOTENV_PRIVATE_KEY_${key_name}" .env.keys | cut -d'=' -f2 | tr -d "\"'")
  if [ -n "$value" ]; then
    gh secret set "DOTENV_PRIVATE_KEY_${key_name}" --body "$value"
    echo "✅ DOTENV_PRIVATE_KEY_${key_name} を設定しました"
  else
    echo "⚠️ DOTENV_PRIVATE_KEY_${key_name} が .env.keys に見つかりません"
  fi
done
```

**Step 2: Vercel関連Secrets**

2-a. `VERCEL_TOKEN`（人間入力が必須）:
AskUserQuestionで値を入力してもらう。取得手順:
- Vercel Dashboard（https://vercel.com/account/tokens）> 「Create Token」
- Scope: Full Account を選択
- 入力後、`vercel whoami --token $VERCEL_TOKEN` で有効性を自動検証

2-b. `VERCEL_ORG_ID`（自動取得）:
```bash
# apps/ 配下で最初に見つかった .vercel/project.json から取得（vercel link 実行済みの場合）
VERCEL_ORG_ID=$(for d in apps/*/; do [ -f "${d}.vercel/project.json" ] && jq -r '.orgId' "${d}.vercel/project.json" 2>/dev/null && break; done)
# 未取得の場合はAPI経由
if [ -z "$VERCEL_ORG_ID" ] || [ "$VERCEL_ORG_ID" = "null" ]; then
  VERCEL_ORG_ID=$(curl -s "https://api.vercel.com/v2/teams" \
    -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.teams[0].id')
fi
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
echo "✅ VERCEL_ORG_ID = $VERCEL_ORG_ID を設定しました"
```

2-c. `VERCEL_PROJECT_ID_*`（自動取得）:
```bash
# apps/ 配下のディレクトリを動的取得（.vercelが存在するもの）
for APP_NAME in $(for d in apps/*/; do [ -d "$d/.vercel" ] && basename "$d"; done); do
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

**Step 3: Turborepo Remote Cache**

3-a. `TURBO_TOKEN`:
VERCEL_TOKEN（Step 2-a で取得済み）と同じ値を使用（別トークンを使う場合のみAskUserQuestionで入力）:
```bash
gh secret set TURBO_TOKEN --body "$VERCEL_TOKEN"
echo "✅ TURBO_TOKEN を設定しました（VERCEL_TOKENと同一値）"
```

3-b. `TURBO_TEAM`（自動取得・設定）:

`npx turbo link` は対話モードでスタックすることがあるため、`.turbo/config.json` を直接作成する:
```bash
# VERCEL_ORG_IDはapps/*/.vercel/project.jsonから取得済み（Step 2-b）
TURBO_TEAM="$VERCEL_ORG_ID"
TURBO_TEAM_SLUG=$(vercel team ls --token $VERCEL_TOKEN 2>/dev/null | grep -E '^\s+\S+' | head -1 | awk '{print $1}')
# フォールバック: team slugが取得できない場合はVercel Dashboard (Settings > General > Team URL)から確認
if [ -z "$TURBO_TEAM_SLUG" ]; then
  echo "⚠️ TURBO_TEAM_SLUGを取得できません。AskUserQuestionでチームslugを確認してください"
fi

# .turbo/config.json を直接作成（npx turbo linkの代替）
mkdir -p .turbo
cat > .turbo/config.json <<EOF
{
  "teamId": "$TURBO_TEAM",
  "teamSlug": "$TURBO_TEAM_SLUG"
}
EOF

gh secret set TURBO_TEAM --body "$TURBO_TEAM"
echo "✅ TURBO_TEAM = $TURBO_TEAM を設定しました"
```

> **注意**: `npx turbo link` は非対話モードが不安定なため使用しない。`.turbo/config.json` を直接作成することで確実に設定できる。

## 参照ドキュメント
- `docs/einja/instructions/deployment-setup.md`（セクション6: GitHub Secrets登録）
