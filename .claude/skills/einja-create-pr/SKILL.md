---
name: einja-create-pr
description: "PR作成時にchangeset自動生成 + ラベル付与 + PR作成を一括実行するSkill。task-exec/issue-exec経由では自動モード、手動 /einja-create-pr では対話モードで動作"
---

# einja-create-pr Skill

## 概要

PR作成時に以下を一括実行する:
1. changeset自動生成（必要な場合）
2. ラベル判定・付与
3. PR作成（`gh pr create`）

## Sandbox注意事項

**すべての `git` / `gh` コマンドは `dangerouslyDisableSandbox: true` で実行すること。**

## 動作モード

| モード | トリガー | changeset確認 | ラベル確認 |
|--------|---------|--------------|-----------|
| 自動 | task-exec/issue-exec経由 | 推定値で自動決定 | 自動 |
| 対話 | 手動 `/einja-create-pr` | AskUserQuestionで確認 | AskUserQuestionで確認 |

呼び出し元がtask-exec/issue-execかどうかは、$ARGUMENTSに `--auto` フラグがあるかで判定する。

## 入力

```
$ARGUMENTS: [--auto] [--base <branch>] [--head <branch>] [--title <title>]
```

- `--auto`: 自動モード（確認なしで実行）
- `--base`: PRのベースブランチ（デフォルト: 現在のブランチの上流を推測）
- `--head`: PRのヘッドブランチ（デフォルト: 現在のブランチ）
- `--title`: PRタイトル（指定なしの場合はコミットメッセージから生成）

## 処理フロー

### Step 1: 引数解析・重複チェック・差分分析

#### Step 1a: BASE/HEAD決定

```bash
# ベースブランチの決定
BASE=$(git rev-parse --abbrev-ref HEAD@{upstream} 2>/dev/null | sed 's|origin/||' || echo "main")
# --base指定があればそちらを優先

# ヘッドブランチの決定
HEAD_BRANCH="${HEAD:-$(git rev-parse --abbrev-ref HEAD)}"
```

#### Step 1b: 既存PR重複チェック

```bash
EXISTING_PR=$(gh pr list --head "$HEAD_BRANCH" --base "$BASE" --state open --json number,url --jq '.[0]')
if [ -n "$EXISTING_PR" ]; then
  PR_NUMBER=$(echo "$EXISTING_PR" | jq -r '.number')
  PR_URL=$(echo "$EXISTING_PR" | jq -r '.url')
  # [既存PR検出] PR #${PR_NUMBER} が既に存在するため作成をスキップ
  # Step 2〜6をすべてスキップし、既存PRのURL・番号を出力セクションの形式で返却する
fi
```

- `--head` + `--base` 両方でexact match（同一headでbase違いの誤検知を防止）
- 既存OPENあり → changeset生成もスキップして即座にPR情報を返却
- closed/merged PRは検出対象外（新規PR作成を許可）

#### Step 1c: 差分分析

```bash
# コミット履歴
git log --format="%s%n%b" origin/${BASE}..HEAD

# 変更ファイル一覧
git diff --name-only origin/${BASE}..HEAD
```

### Step 2: changeset生成判定

#### スキップ条件（以下のいずれかに該当する場合はchangeset生成をスキップ）:
- staging → main の昇格PR（ベースがmainで、HEADがstagingからのマージ）
- `apps/` 配下に変更がない（docs/、CI設定/、.claude/ のみの変更）
- 既に `.changeset/` 内に README.md 以外の .md ファイルが存在する

#### 変更種別の推定:
コミットメッセージのプレフィックスから最大値を選択:
- `feat!` or `BREAKING` → `major`
- `feat` → `minor`
- `fix`, `perf`, `refactor` → `patch`
- それ以外 → `patch`

#### パッケージ判定:
変更ファイルのパスから対象パッケージを動的に推定:
```bash
# 変更されたapps/配下のディレクトリからパッケージ名を取得
for app_dir in $(git diff --name-only origin/${BASE}..HEAD | grep '^apps/' | cut -d'/' -f2 | sort -u); do
  PKG_NAME=$(cat "apps/$app_dir/package.json" 2>/dev/null | jq -r '.name // empty')
  [ -n "$PKG_NAME" ] && echo "$PKG_NAME"
done
```
- `apps/<app>/**` → `apps/<app>/package.json` の `name` フィールドの値
- `packages/**` は除外（内部パッケージ）

### Step 3: changeset生成

スキップ条件に該当しない場合のみ実行。

対話モードの場合は、推定した変更種別とサマリーをAskUserQuestionで確認。

```bash
# ランダムファイル名で.changesetファイルを作成
# フォーマット:
# ---
# "<package.jsonのnameフィールド値>": minor
# ---
#
# サマリー（コミットメッセージの要約）
```

生成後、changesetファイルをコミット:
```bash
git add .changeset/*.md
git commit -m "chore: add changeset"
```

### Step 4: ラベル判定

PRタイトル（または最初のコミットメッセージ）のプレフィックスから単一ラベルを選択:

| プレフィックス | ラベル |
|-------------|--------|
| `feat!` / `BREAKING` | `breaking-change` |
| `feat` / `feature` | `enhancement` |
| `fix` / `bug` | `bug` |
| その他 (`chore`, `docs`, `refactor`, `ci`, `test`) | `maintenance` |

対話モードの場合は、推定ラベルをAskUserQuestionで確認。

### Step 5: PR作成

```bash
gh pr create \
  --base "${BASE}" \
  --head "${HEAD_BRANCH}" \
  --title "${TITLE}" \
  --body "$(cat <<'EOF'
## Summary
${SUMMARY}

## Changes
${CHANGED_FILES_LIST}

## Changeset
${CHANGESET_INFO}
EOF
)" \
  --label "${LABEL}"
```

#### レースコンディション対策

`gh pr create` が既存PRエラー（"A pull request already exists"）で失敗した場合:
1. `gh pr list --head "$HEAD_BRANCH" --base "$BASE" --state open --json number,url --jq '.[0]'` で再検索
2. 既存PRが見つかれば、そのPR情報を成功として返却（冪等）
3. 見つからなければエラーとして報告

### Step 6: CI確認（条件付き）

PR作成後、CIの結果を確認する。`_einja-ci-check` インナーSkillの手順に従う。

#### スキップ条件:
- `--auto` モード（task-exec/issue-exec経由）の場合はスキップ

#### 実行方法:
1. `.claude/skills/_einja-ci-check/SKILL.md` の手順に従う
2. `prNumber` パラメータに作成したPR番号を指定
3. その他パラメータはデフォルト値を使用（`maxRetries: 2`, `timeout: 300`）

## エラーハンドリング

| エラー | 対処 |
|-------|------|
| ベースブランチが見つからない | AskUserQuestionでベースブランチを質問 |
| リモートにpushされていない | `git push -u origin HEAD` を先に実行 |
| changeset生成でパッケージ不明 | ルートパッケージ（`einja-management-monorepo`）を使用 |
| gh CLIが未認証 | エラーメッセージを表示して停止 |
| 同一ブランチペアのOPEN PRが既に存在 | PR作成をスキップ、既存PR情報を返却（冪等） |
| `gh pr create` 既存PRエラー（422） | 再検索して既存PR情報を返却（レースコンディション対策） |

## 出力

PR作成後（または既存PR検出時）、以下を出力:
- PR URL
- PR番号
- 付与したラベル（新規作成時のみ）
- changeset情報（生成した場合のみ）
- CI確認結果（実行した場合のみ）
- `[既存PR検出]` ラベル（既存PR返却時のみ）
