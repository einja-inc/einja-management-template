# SKILL.md修正計画レビュー結果

## レビュー対象
- 計画: `docs/plans/purrfect-spinning-hickey.md`
- 対象ファイル: `.claude/skills/einja-infra-maintenance/SKILL.md`（640行）
- 修正箇所: 10箇所

---

## 1. SKILL.mdとの整合性

### ✅ 正確な箇所（問題なし）

| 修正# | 計画記載 | 実際 | 状態 |
|------|---------|------|------|
| 1 | L52-68（Phase 1） | L52-68でCLI確認後に挿入可能 | ✅ 正確 |
| 2 | L94-104（推奨ロジック テーブル） | L97-104がテーブル、追加可能 | ✅ 正確 |
| 3 | L143（`.env.keys`不在 行） | L143が該当行 | ✅ 正確 |
| 9 | L607-613（エラーハンドリング テーブル） | L607-613が該当テーブル | ✅ 正確 |
| 10 | L394-416（カテゴリ6） | L394-416がCLIツール確認セクション | ✅ 正確 |

### ⚠️ 修正が必要な箇所

#### 修正4: Vercelプロジェクト作成（L214-223）

**問題**: 計画のコードブロックに**変数の未定義参照**がある

L98-119の計画では以下の変数を使用しているが、定義箇所が不明:
- `$PROJECT_NAME` (L111) — AskUserQuestionの結果をどの変数に格納するか明記されていない
- `$APP_NAME` (L118) — web/adminのループ処理がない（単一アプリ用コード）
- `$APP_NAME_UPPER` (L126) — 大文字変換の実装がない

**修正提案**:
```bash
# 1. プロジェクト名の推定
BASE_NAME=$(cat package.json | jq -r '.name' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')
if [ -z "$BASE_NAME" ] || [ "$BASE_NAME" = "null" ]; then
  BASE_NAME=$(basename $(git remote get-url origin 2>/dev/null) .git | sed 's/-template$//')
fi

# 2. 既存プロジェクト確認（ORG_ID未取得時はAPI経由取得）
if [ -z "$VERCEL_ORG_ID" ]; then
  VERCEL_ORG_ID=$(curl -s "https://api.vercel.com/v2/teams" \
    -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.teams[0].id')
fi
EXISTING_PROJECTS=$(curl -s "https://api.vercel.com/v9/projects?teamId=$VERCEL_ORG_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.projects[].name')

# 3. AskUserQuestion: プロジェクト名と作成対象を確認
# 推定名を提示: ${BASE_NAME}-web, ${BASE_NAME}-admin
# 既存プロジェクトがある場合は「既に存在」と表示
# → ユーザー確認後、$VERCEL_PROJECT_NAME_WEB, $VERCEL_PROJECT_NAME_ADMIN に格納

# 4. GitHubリポジトリ情報を自動取得
GH_ORG=$(git remote get-url origin | sed 's|.*github.com[:/]\(.*\)/.*|\1|')
GH_REPO=$(basename $(git remote get-url origin) .git)

# 5. プロジェクト作成（web/admin両方のループ）
for APP_NAME in web admin; do
  APP_NAME_UPPER=$(echo "$APP_NAME" | tr '[:lower:]' '[:upper:]')
  if [ "$APP_NAME" = "web" ]; then
    PROJECT_NAME="$VERCEL_PROJECT_NAME_WEB"
  else
    PROJECT_NAME="$VERCEL_PROJECT_NAME_ADMIN"
  fi

  # 既存チェック（スキップ判定）
  if echo "$EXISTING_PROJECTS" | grep -q "^${PROJECT_NAME}$"; then
    echo "⚠️ ${PROJECT_NAME} は既に存在します。スキップします"
    continue
  fi

  # プロジェクト作成
  RESPONSE=$(curl -X POST "https://api.vercel.com/v9/projects?teamId=$VERCEL_ORG_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$PROJECT_NAME\",
      \"framework\": \"nextjs\",
      \"gitRepository\": {
        \"type\": \"github\",
        \"repo\": \"$GH_ORG/$GH_REPO\"
      },
      \"rootDirectory\": \"apps/$APP_NAME\"
    }")

  PROJECT_ID=$(echo "$RESPONSE" | jq -r '.id')
  echo "✅ ${PROJECT_NAME} を作成しました（ID: $PROJECT_ID）"

  # vercel link
  cd "apps/$APP_NAME" && vercel link --project="$PROJECT_NAME" --yes && cd ../..

  # GitHub Secrets登録
  gh secret set "VERCEL_PROJECT_ID_${APP_NAME_UPPER}" --body "$PROJECT_ID"
  echo "✅ VERCEL_PROJECT_ID_${APP_NAME_UPPER} を設定しました"
done
```

**注意**: L129の注記「`VERCEL_ORG_ID` は最初のプロジェクトの `vercel link` 後に `.vercel/project.json` から自動取得」は**矛盾**している。API呼び出し（L94-95）でORG_IDが必要なため、先にAPI経由で取得すべき。

#### 修正5: 初期設定の PROJECT_ID 自動取得（L225-237）

**問題**: L237「プロジェクトID取得・表示」の具体的内容が不明

計画のL139-145では `.vercel/project.json` からの自動取得を提案しているが、現在のSKILL.md L236には「プロジェクトID取得・表示」と簡潔にしか書かれていない。

**修正提案**: 計画通りに変更（明確な自動取得コードに置き換え）

#### 修正6: Neonプロジェクト作成（L269-280）

**問題1**: 既存プロジェクト確認のステップ（計画L162-168）が**ステップ2**として追加されるが、ステップ3の「プロジェクト名の推定・確認・作成」との整合性が不明確

**修正提案**: ステップ番号を修正
```
2. **既存プロジェクトの確認**:
   ```bash
   neonctl projects list --api-key $NEON_API_KEY --output json
   ```
   既存プロジェクトがあれば一覧表示し、AskUserQuestionで使用するプロジェクトを確認。
   - 既存プロジェクト使用 → IDを自動取得してステップ4へ
   - 新規作成 → ステップ3へ

3. **プロジェクト名の推定・確認・作成**:
   （以下計画通り）
```

**問題2**: 計画L173の「確認後にプロジェクト作成」コードで、変数`$NEON_PROJECT_NAME`が未定義

**修正提案**:
```bash
# AskUserQuestionの結果を $NEON_PROJECT_NAME に格納後
PROJECT_JSON=$(neonctl projects create --name "$NEON_PROJECT_NAME" --region-id aws-ap-northeast-1 --api-key $NEON_API_KEY --output json)
```

**問題3**: 計画L197「プロジェクトID取得」サブメニューは既にステップ2で実装されるため**重複**

**修正提案**: サブメニューから削除するか、「既存プロジェクトID確認」に変更

#### 修正7: カテゴリ5 一括設定 Step 2（L352-365）

**問題1**: 計画L233「カテゴリ3で作成したプロジェクト名（$VERCEL_PROJECT_NAME_WEB / $VERCEL_PROJECT_NAME_ADMIN）を使用」とあるが、**カテゴリ3とカテゴリ5の実行順序が保証されていない**

カテゴリ5を先に実行した場合、変数が未定義でエラーになる。

**修正提案**: 環境変数やファイルから推定するロジックを追加
```bash
# プロジェクト名の推定（カテゴリ3と同じロジック）
BASE_NAME=$(cat package.json | jq -r '.name' | sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//')
if [ -z "$BASE_NAME" ] || [ "$BASE_NAME" = "null" ]; then
  BASE_NAME=$(basename $(git remote get-url origin 2>/dev/null) .git | sed 's/-template$//')
fi

for app in web admin; do
  # デフォルトのプロジェクト名（AskUserQuestionで変更可能にする）
  DEFAULT_PROJECT_NAME="${BASE_NAME}-${app}"

  # .vercel/project.json から取得を優先
  PROJECT_ID=$(cat "apps/$app/.vercel/project.json" 2>/dev/null | jq -r '.projectId')

  if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    # AskUserQuestion: プロジェクト名を確認（デフォルト値を提示）
    # → $PROJECT_NAME に格納
    PROJECT_ID=$(curl -s "https://api.vercel.com/v9/projects/$PROJECT_NAME?teamId=$VERCEL_ORG_ID" \
      -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.id')
  fi

  # 以下同じ
done
```

**問題2**: L237「$PROJECT_ID = "null"」のチェックがあるが、L231で `cat` が失敗した場合、`$PROJECT_ID` は空文字列（not "null"）。jq出力が"null"の場合を想定しているなら問題ないが、混在リスクあり。

**修正提案**: 統一して `[ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]` でチェック

#### 修正8: TURBO_TOKEN 案内改善（L367-383）

**問題**: L260「別トークンを使用したい場合のみ AskUserQuestion で入力」のロジックが具体的でない

**修正提案**:
```bash
# Step 2-a で取得した VERCEL_TOKEN を再利用（デフォルト動作）
# AskUserQuestion: 「VERCEL_TOKENと同じ値を使用しますか？」
# → Yes: そのまま設定、No: 別のトークンを入力

if [ "$USE_VERCEL_TOKEN" = "yes" ]; then
  gh secret set TURBO_TOKEN --body "$VERCEL_TOKEN"
  echo "✅ TURBO_TOKEN を設定しました（VERCEL_TOKENと同一値）"
else
  # AskUserQuestionで別のトークンを入力
  gh secret set TURBO_TOKEN --body "$TURBO_TOKEN_INPUT"
fi
```

---

## 2. 設計原則の徹底確認

### 原則: API/CLIで取得・生成可能な値は絶対に人間に操作させない

修正後も**人間入力が残る箇所**を全てリストアップ:

| 箇所 | AskUserQuestionの内容 | CLI/API代替可否 | 判定 |
|------|---------------------|---------------|------|
| カテゴリ1 L143 | `.env.keys` メインworktreeからコピー or 手動配置 | ✅ 修正3で自動化 | ✅ 適切 |
| カテゴリ2 L168-172 | トークン値入力（GITHUB_TOKEN, VERCEL_TOKEN, NEON_API_KEY） | ❌ ブラウザ操作必須 | ✅ 適切 |
| カテゴリ2 L181 | チーム共有設定の対象ファイル選択 | ✅ 可能（編集したい変数名から推定） | ⚠️ 要改善 |
| カテゴリ2 L183 | 変更内容確認 | ✅ 可能（変数名と値を直接指定） | ⚠️ 要改善 |
| カテゴリ2 L190 | 新規変数追加の変数名・用途・対象環境 | ❌ 人間判断必須 | ✅ 適切 |
| カテゴリ2 L194 | 他環境への展開確認 | ❌ 人間判断必須 | ✅ 適切 |
| カテゴリ3 修正4 | プロジェクト名・作成対象アプリ確認 | ⚠️ 推定値をデフォルトとして提示（確認のみ） | ✅ 適切 |
| カテゴリ3 L227 | アプリ選択（web / admin） | ⚠️ 既存プロジェクトから自動推定可能 | ⚠️ 要改善 |
| カテゴリ3 L243 | 環境変数同期対象確認 | ✅ 可能（.env.keys全件が対象） | ⚠️ 要改善 |
| カテゴリ4 修正6 | 既存プロジェクト使用 or 新規作成 | ❌ 人間判断必須 | ✅ 適切 |
| カテゴリ4 修正6 | Neonプロジェクト名確認 | ⚠️ 推定値をデフォルトとして提示 | ✅ 適切 |
| カテゴリ5 L332 | 個別設定のSecret名と値 | ❌ 人間判断必須 | ✅ 適切 |
| カテゴリ5 修正7 | VERCEL_TOKENのみ入力（他は自動取得） | ❌ ブラウザ操作必須 | ✅ 適切 |
| カテゴリ5 修正8 | TURBO_TOKEN（VERCEL_TOKEN再利用 or 別入力） | ⚠️ デフォルト動作を自動化すべき | ⚠️ 要改善 |
| カテゴリ7 L524 | 失敗調査のrun-id選択 | ✅ 可能（最新の失敗を自動選択） | ⚠️ 要改善 |

### ⚠️ さらなる自動化が可能な箇所

#### カテゴリ2: チーム共有設定変更（L181, L183）

**現状**: ファイル選択・変更内容をAskUserQuestion

**改善案**: コマンド引数で変数名と値を直接指定
```bash
# 例: pnpm env:update set DATABASE_URL="postgres://..." --env=production
# → AskUserQuestionなしで .env.production を復号→編集→暗号化
```

Skill起動時の引数で指定可能にすれば、AskUserQuestionを削減できる。

#### カテゴリ3: 環境変数同期対象確認（L243）

**現状**: AskUserQuestionで同期対象を確認

**改善案**: `.env.keys` の全DOTENV_PRIVATE_KEY_*を自動同期（確認不要）
- 理由: GitHub Secretsと同じく、全件同期が標準動作
- マスク表示して確認を求める理由が不明（秘密鍵は全て同期すべき）

#### カテゴリ5 修正8: TURBO_TOKEN（L367-383）

**現状**: AskUserQuestionで「別トークン使用するか」確認

**改善案**: デフォルトでVERCEL_TOKENを再利用。別トークンが必要な場合のみ引数で指定
```bash
# デフォルト（確認なし）
gh secret set TURBO_TOKEN --body "$VERCEL_TOKEN"

# 別トークンが必要な場合のみ
# Skill起動時: /infra-maintenance カテゴリ5 --turbo-token-separate
```

#### カテゴリ7: 失敗調査のrun-id選択（L524）

**現状**: AskUserQuestionでrun-id選択

**改善案**: 最新の失敗を自動選択（複数ある場合のみ選択肢表示）
```bash
FAILED_RUNS=$(gh run list --status=failure --limit 5 --json databaseId,conclusion,workflowName)
COUNT=$(echo "$FAILED_RUNS" | jq '. | length')

if [ "$COUNT" -eq 1 ]; then
  RUN_ID=$(echo "$FAILED_RUNS" | jq -r '.[0].databaseId')
  echo "最新の失敗: $(echo "$FAILED_RUNS" | jq -r '.[0].workflowName') を調査します"
  gh run view "$RUN_ID" --log-failed
else
  # 複数ある場合のみAskUserQuestion
fi
```

---

## 3. プロジェクト名推定ロジックの妥当性

### ✅ 正常動作の検証

実際のリポジトリで検証:
```bash
# package.json name
"einja-management-monorepo"
  → sed 's/@[^/]*\///' → "einja-management-monorepo"
  → sed 's/-monorepo$//' → "einja-management"
  → sed 's/-template$//' → "einja-management" ✅

# Git リポジトリ名
"einja-management-template.git"
  → basename .git → "einja-management-template"
  → sed 's/-template$//' → "einja-management" ✅

# scoped package
"@repo/web"
  → sed 's/@[^/]*\///' → "web" ✅
```

### ⚠️ 潜在的な問題

#### 問題1: `-monorepo` と `-template` の除去順序

現在のロジック:
```bash
sed 's/@[^/]*\///' | sed 's/-monorepo$//' | sed 's/-template$//'
```

`einja-management-monorepo-template` のような名前の場合:
1. `sed 's/-monorepo$//'` → `einja-management-monorepo-template`（末尾が-templateなので変更なし）
2. `sed 's/-template$//'` → `einja-management-monorepo`（-monorepoが残る）

**修正提案**: 両方を同時に除去
```bash
sed 's/@[^/]*\///' | sed 's/-\(monorepo\|template\)$//'
```

または複数回適用:
```bash
sed 's/@[^/]*\///' | sed -e 's/-monorepo$//' -e 's/-template$//' -e 's/-monorepo$//'
```

#### 問題2: 他に除去すべきサフィックスはないか？

考慮すべきパターン:
- `-repo` （例: `my-project-repo`）
- `-workspace` （例: `my-project-workspace`）
- `-starter` （例: `my-project-starter`）
- `-boilerplate` （例: `my-project-boilerplate`）

**推奨**: 汎用的な正規表現に変更
```bash
# 一般的なサフィックスを除去
sed 's/@[^/]*\///' | sed 's/-\(monorepo\|template\|repo\|workspace\|starter\|boilerplate\)$//'
```

ただし、この変更は**このリポジトリ専用のSKILL.md**には不要かもしれない。他プロジェクトでも使う場合のみ検討。

#### 問題3: scoped packageの `name` フィールドが `@org/monorepo` の場合

`@einja/management-monorepo` → `sed 's/@[^/]*\///'` → `management-monorepo` → `management` ✅

問題なし。

---

## 4. 漏れている修正

### ⚠️ カテゴリ2: トークン有効性検証が不足

**修正1**（Phase 1）と**修正10**（カテゴリ6）でトークン検証を追加しているが、**カテゴリ2: 環境変数管理**の「個人トークン設定」（L168-178）では、トークン入力後の**有効性検証**が実装されていない。

計画の修正9（L287「API検証で有効性確認」）で言及されているが、カテゴリ2の該当箇所は修正対象に含まれていない。

**修正提案**: カテゴリ2 L172-178 に検証ブロックを追加
```bash
2. AskUserQuestionでトークン値を入力してもらう
3. `.env.personal`に保存
4. `chmod 600 .env.personal` 実行
5. API検証（可能な場合）:
   - GitHub: `gh auth status` で有効性確認。失敗時は再入力を促す
   - Vercel: `vercel whoami --token "$VERCEL_TOKEN"` で確認。失敗時は再入力を促す
   - Neon: `neonctl projects list --api-key "$NEON_API_KEY"` で確認。失敗時は再入力を促す
6. 検証成功後、「✅ トークンが有効です」と表示
```

### ✅ カテゴリ7: GitHub Actions CI/CD管理

計画に含まれていないが、このカテゴリは**現状でも十分に自動化されている**。追加の改善は不要。

---

## 5. 依存関係の確認

### ✅ 修正間の依存関係に問題なし

| 修正 | 依存元 | 依存先 | 状態 |
|------|--------|--------|------|
| 修正1 | - | - | 独立（Phase 1に追加） |
| 修正2 | 修正1 | - | 修正1の結果を推奨ロジックで使用 |
| 修正3 | - | - | 独立（`.env.keys`コピー） |
| 修正4 | - | 修正5, 修正7 | Vercelプロジェクト作成 → ID取得 → Secrets設定 |
| 修正5 | 修正4 | - | 修正4で作成したプロジェクトのID取得 |
| 修正6 | - | - | 独立（Neonプロジェクト作成） |
| 修正7 | 修正4, 修正5 | - | ⚠️ カテゴリ3未実行時の対応が必要（上記「修正7」参照） |
| 修正8 | 修正7 | - | VERCEL_TOKEN（修正7で取得）を再利用 |
| 修正9 | - | - | 独立（エラーハンドリング テーブル更新） |
| 修正10 | 修正1 | - | 修正1と同じロジックをカテゴリ6に追加 |

### ⚠️ 修正7の依存問題

前述の通り、**カテゴリ5を先に実行した場合**にカテゴリ3の変数（`$VERCEL_PROJECT_NAME_WEB`等）が未定義になる。

**対策**: 修正7のコードで、カテゴリ3と同じ推定ロジックを実装する（上記「修正7」参照）

---

## 総合評価

### ✅ 計画の優れた点

1. **設計原則が明確**: 「API/CLIで取得可能な値は自動化」が一貫している
2. **プロジェクト名推定ロジック**: package.json → Git repo のフォールバックが適切
3. **トークン検証の追加**: Phase 1とカテゴリ6での検証は有用
4. **修正箇所の大半が正確**: 10修正中7箇所は行番号が正確

### ⚠️ 修正が必要な問題

| 問題 | 重大度 | 影響 |
|------|--------|------|
| 修正4の変数未定義（`$PROJECT_NAME`, `$APP_NAME_UPPER`） | 🔴 高 | 実行時エラー |
| 修正7のカテゴリ間依存（プロジェクト名変数） | 🔴 高 | 先に実行するとエラー |
| 修正6のステップ番号不明確 | 🟡 中 | 混乱を招く |
| 修正8のAskUserQuestion具体性不足 | 🟡 中 | 実装時の曖昧さ |
| 修正4のORG_ID取得タイミング矛盾 | 🟡 中 | 設計の不整合 |
| カテゴリ2のトークン検証漏れ | 🟡 中 | ユーザー体験の低下 |
| プロジェクト名推定の複数サフィックス対応不足 | 🟢 低 | エッジケースのみ |

### 📋 推奨アクション

#### 必須修正（実装前に対応）

1. **修正4**: 変数定義とループ処理を追加（上記修正提案を適用）
2. **修正7**: プロジェクト名推定ロジックを追加（カテゴリ3非依存に）
3. **修正6**: ステップ番号を明確化（既存プロジェクト確認をステップ2に）
4. **修正8**: AskUserQuestionの具体的なロジックを記載

#### 推奨修正（優先度：高）

5. **カテゴリ2**: トークン有効性検証をL172-178に追加
6. **修正4**: ORG_ID取得を先頭に移動（API呼び出し前に取得）

#### オプション改善（優先度：中）

7. **カテゴリ3 L243**: 環境変数同期の確認を削除（全件自動同期）
8. **カテゴリ7 L524**: 最新失敗の自動選択ロジック追加

#### 将来検討（優先度：低）

9. **プロジェクト名推定**: 複数サフィックス対応（`-repo`, `-workspace`等）
10. **カテゴリ2**: コマンド引数による非対話モード対応

---

## レビュー完了

計画全体としては**非常に優れた自動化設計**ですが、変数定義・依存関係の部分で**実装前の修正が必須**です。上記の必須修正を適用すれば、実装可能な状態になります。
