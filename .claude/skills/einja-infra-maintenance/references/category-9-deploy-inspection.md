# カテゴリ9: デプロイ検査・セットアップ

apps/構成検出 → 各インフラ（Vercel/Neon/GitHub Actions/Secrets/ブランチ保護）の整合性チェック → 不足分の自動セットアップを一気通貫で実行するオーケストレーションカテゴリ。

## 実行フロー

```
Step 1: apps/ スキャン → アプリ一覧取得 + Secret suffix 正規化
  - `ls apps/*/package.json` でアプリを検出
  - Secret suffix: echo "$APP" | tr '[:lower:]' '[:upper:]' | tr '-' '_' | sed 's/[^A-Z0-9_]//g'

Step 2: Vercel検査
  - 各アプリに対応するVercelプロジェクトが存在するか（apps/*/.vercel/project.json）
  - 未リンクのアプリ → カテゴリ3（Vercel管理）の初期設定を実行

Step 3: GitHub Secrets検査
  - 各アプリに対応する VERCEL_PROJECT_ID_<SECRET_SUFFIX> が設定済みか
  - DOTENV_PRIVATE_KEY_* が設定済みか
  - VERCEL_TOKEN, VERCEL_ORG_ID, TURBO_TOKEN, TURBO_TEAM が設定済みか
  - 不足分 → カテゴリ5（GitHub Secrets管理）の個別/一括設定を実行

Step 4: ブランチ検査
  - develop/staging ブランチが存在するか
  - ブランチ保護ルールが設定されているか
  - 未設定 → カテゴリ7（リポジトリ設定）を実行

Step 5: Neon検査
  - Neonプロジェクトが存在するか
  - 必要なブランチ（main/development）が存在するか
  - 未設定 → カテゴリ4（Neon管理）の初期設定を実行

Step 6: ワークフロー整合性検査
  - .github/app-config.json が存在し、apps/構成と整合しているか
  - deployTargets に検出アプリが全て含まれているか
  - ワークフローファイルが存在するか
  - 不整合 → app-config.json の自動生成/更新を提案

Step 7: 検査結果サマリー表示 + 未解決項目のアクション提案
```

## 検査コマンド

```bash
# Step 1: アプリ検出
APPS=()
for pkg in apps/*/package.json; do
  [ -f "$pkg" ] || continue
  APP=$(basename "$(dirname "$pkg")")
  SUFFIX=$(echo "$APP" | tr '[:lower:]' '[:upper:]' | tr '-' '_' | sed 's/[^A-Z0-9_]//g')
  APPS+=("$APP:$SUFFIX")
done
echo "検出アプリ: ${APPS[*]}"

# Step 2: Vercelリンク確認
for entry in "${APPS[@]}"; do
  APP="${entry%%:*}"
  if [ -f "apps/$APP/.vercel/project.json" ]; then
    PROJECT_ID=$(jq -r '.projectId' "apps/$APP/.vercel/project.json")
    echo "✅ $APP: リンク済み ($PROJECT_ID)"
  else
    echo "❌ $APP: 未リンク → カテゴリ3でセットアップ"
  fi
done

# Step 3: GitHub Secrets確認（gh CLIで検査）
for entry in "${APPS[@]}"; do
  APP="${entry%%:*}"
  SUFFIX="${entry##*:}"
  SECRET_NAME="VERCEL_PROJECT_ID_${SUFFIX}"
  if gh secret list | grep -q "^$SECRET_NAME"; then
    echo "✅ $SECRET_NAME: 設定済み"
  else
    echo "❌ $SECRET_NAME: 未設定 → カテゴリ5で設定"
  fi
done

# 共通Secrets
for SECRET in VERCEL_TOKEN VERCEL_ORG_ID TURBO_TOKEN TURBO_TEAM; do
  if gh secret list | grep -q "^$SECRET"; then
    echo "✅ $SECRET: 設定済み"
  else
    echo "❌ $SECRET: 未設定"
  fi
done

# DOTENV_PRIVATE_KEY_*
MISSING_DOTENV_KEYS=()
for ENV in DEVELOP STAGING PRODUCTION PREVIEW; do
  SECRET="DOTENV_PRIVATE_KEY_${ENV}"
  if gh secret list | grep -q "^$SECRET"; then
    echo "✅ $SECRET: 設定済み"
  else
    echo "❌ $SECRET: 未設定"
    MISSING_DOTENV_KEYS+=("$ENV")
  fi
done

# 未設定のDOTENV_PRIVATE_KEY_*を自動修正（.env.keys存在時）
if [ ${#MISSING_DOTENV_KEYS[@]} -gt 0 ] && [ -f ".env.keys" ]; then
  echo "🔧 .env.keys から未設定の DOTENV_PRIVATE_KEY_* を自動設定します..."
  for ENV in "${MISSING_DOTENV_KEYS[@]}"; do
    value=$(grep "DOTENV_PRIVATE_KEY_${ENV}" .env.keys | cut -d'=' -f2- | tr -d "\"'")
    if [ -n "$value" ]; then
      gh secret set "DOTENV_PRIVATE_KEY_${ENV}" --body "$value"
      echo "✅ DOTENV_PRIVATE_KEY_${ENV} を自動設定しました"
    else
      echo "⚠️ DOTENV_PRIVATE_KEY_${ENV} が .env.keys に見つかりません"
    fi
  done
elif [ ${#MISSING_DOTENV_KEYS[@]} -gt 0 ]; then
  echo "⚠️ .env.keys が存在しません。.env.keys を取得してからカテゴリ5で設定してください"
fi

# Step 4: ブランチ確認
for BRANCH in develop staging; do
  if git ls-remote --heads origin "$BRANCH" | grep -q "$BRANCH"; then
    echo "✅ $BRANCH: 存在"
  else
    echo "❌ $BRANCH: 未作成 → カテゴリ7で作成"
  fi
done

# Step 5: Neon検査
if command -v neonctl &>/dev/null; then
  NEON_PROJECTS=$(neonctl projects list --output json 2>/dev/null || echo "[]")
  if [ "$(echo "$NEON_PROJECTS" | jq length)" -gt 0 ]; then
    echo "✅ Neonプロジェクト: 存在"
    # ブランチ確認
    PROJECT_ID=$(echo "$NEON_PROJECTS" | jq -r '.[0].id')
    for BRANCH_NAME in main development; do
      if neonctl branches list --project-id "$PROJECT_ID" --output json 2>/dev/null | jq -e --arg b "$BRANCH_NAME" '.[] | select(.name == $b)' &>/dev/null; then
        echo "✅ Neonブランチ $BRANCH_NAME: 存在"
      else
        echo "❌ Neonブランチ $BRANCH_NAME: 未作成 → カテゴリ4で作成"
      fi
    done
  else
    echo "❌ Neonプロジェクト: 未作成 → カテゴリ4でセットアップ"
  fi
else
  echo "⚠️ neonctl未インストール → カテゴリ4参照"
fi

# Step 6: ワークフロー整合性
if [ -f ".github/app-config.json" ]; then
  for entry in "${APPS[@]}"; do
    APP="${entry%%:*}"
    HAS_TARGET=$(jq -e --arg app "$APP" '.deployTargets[$app]' .github/app-config.json 2>/dev/null)
    if [ $? -eq 0 ]; then
      echo "✅ app-config.json: $APP のマッピングあり"
    else
      echo "⚠️ app-config.json: $APP のマッピングなし → 更新推奨"
    fi
  done
else
  echo "⚠️ .github/app-config.json が存在しません → 自動生成を推奨"
fi
```

## 出力形式

```
=== デプロイ検査結果 ===

📦 検出アプリ: web, admin, dashboard

☁️ Vercel
  ✅ web: リンク済み (prj_xxx)
  ✅ admin: リンク済み (prj_yyy)
  ❌ dashboard: 未リンク → セットアップを実行しますか？

🔐 GitHub Secrets（命名規則: VERCEL_PROJECT_ID_<APP_SUFFIX>）
  ✅ VERCEL_PROJECT_ID_WEB
  ✅ VERCEL_PROJECT_ID_ADMIN
  ❌ VERCEL_PROJECT_ID_DASHBOARD → 設定しますか？
  ✅ DOTENV_PRIVATE_KEY_PRODUCTION
  ...

🌿 ブランチ
  ✅ develop: 存在 + 保護設定済み
  ❌ staging: 未作成 → 作成しますか？

🗄️ Neon
  ✅ プロジェクト: xxx
  ✅ ブランチ: main, development

⚙️ ワークフロー整合性
  ✅ deploy-stable-branches.yml: 存在
  ⚠️ app-config.json: dashboard のマッピングなし → 更新しますか？

--- 推奨アクション ---
1. dashboard の Vercel プロジェクトをセットアップ
2. VERCEL_PROJECT_ID_DASHBOARD を GitHub Secrets に設定
3. staging ブランチを作成 + 保護ルール設定
4. app-config.json を更新
→ すべて自動実行しますか？ [Y/n/個別選択]
```

## 注意事項
- API制限: Vercel/Neon/GitHub APIへの問い合わせが多いため、トークン有効性を事前検証し無効なら早期終了
- 既存カテゴリの呼び出し: 不足が検出された場合、該当カテゴリの手順を案内（提案ベース）。ただし `DOTENV_PRIVATE_KEY_*` は `.env.keys` 存在時に限り自動修正を実行する（デプロイ失敗の最も一般的な原因のため）
- Secret suffix命名規則: `upper(name).replace('-', '_').replace(/[^A-Z0-9_]/g, '')` — 衝突が起きないよう、同一suffixに正規化されるアプリ名は禁止
