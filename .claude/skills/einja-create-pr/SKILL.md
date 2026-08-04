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
$ARGUMENTS: [--auto] [--base <branch>] [--head <branch>] [--title <title>] [--with-review] [--no-review] [--force-review]
```

- `--auto`: 自動モード（確認なしで実行）。task-exec/issue-exec 経由での呼び出しを示す。Step 5.5 の PR自動レビュー発動条件にも影響する
- `--base`: PRのベースブランチ（デフォルト: 現在のブランチの上流を推測）
- `--head`: PRのヘッドブランチ（デフォルト: 現在のブランチ）
- `--title`: PRタイトル（指定なしの場合はコミットメッセージから生成）
- `--with-review`: 手動 `/einja-create-pr` 実行時に PR自動レビュー（`einja-pr-review`）を明示的にオプトイン発動する。`--auto` が付いていない場合の発動条件を満たすために使う（詳細は Step 5.5 参照）
- `--no-review`: PR自動レビューを明示的にスキップする。`--auto` / `--with-review` より優先される。緊急hotfix 等で使用
- `--force-review`: base=main/develop 判定をバイパスして PR自動レビューを強制発動する（動作確認・デバッグ用）。使用時は 2段階セーフガード（警告ログ + `EINJA_ALLOW_FORCE_REVIEW=1` 環境変数）が働く。**production では非推奨**（詳細は Step 5.5 参照）

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

### Step 5.5: PR自動レビュー（einja-pr-review 呼び出し）

Step 5 で PR作成が完了した後、以下の発動条件を満たす場合のみ `einja-pr-review` Skill を Skill tool 経由で呼び出す。sticky comment 投稿は `einja-pr-review` 側で完結するため、独立した Step 5.6 は設けない。

#### 発動条件判定

```bash
SHOULD_RUN_REVIEW=false
FORCE_REVIEW=false
SKIP_REVIEW=false

# 引数を配列化してトークン完全一致で判定（部分文字列マッチ回避）
# $ARGUMENTS は呼び出し元から渡されるSkill引数文字列
read -ra ARGS_ARRAY <<< "$ARGUMENTS"

has_flag() {
  local target="$1"
  for arg in "${ARGS_ARRAY[@]}"; do
    [ "$arg" = "$target" ] && return 0
  done
  return 1
}

# 0. --force-review フラグ（動作確認・デバッグ用、production では非推奨）
# 2段階セーフガード:
#   (a) 警告ログを stderr に出力
#   (b) EINJA_ALLOW_FORCE_REVIEW=1 が設定されていなければエラー終了
if has_flag "--force-review"; then
  echo "⚠️  --force-review is for debugging only. This bypasses base branch validation." >&2
  if [ "${EINJA_ALLOW_FORCE_REVIEW:-}" != "1" ]; then
    echo "❌ --force-review requires EINJA_ALLOW_FORCE_REVIEW=1 env var to be set." >&2
    echo "   ⚠️  For local development only. Do NOT set this in CI/production environment." >&2
    echo "   Rationale: bypassing base validation may trigger reviews on unrelated PRs." >&2
    exit 1
  fi
  FORCE_REVIEW=true
fi

# 1. --no-review フラグ（最優先スキップ）
if has_flag "--no-review"; then
  echo "ℹ️  --no-review specified → skip einja-pr-review" >&2
  SKIP_REVIEW=true
fi

# 2. base が main または develop か（--force-review 時はバイパス、--no-review 時は既にスキップ済み）
if [ "$SKIP_REVIEW" != "true" ] && [ "$FORCE_REVIEW" != "true" ]; then
  if [ "$BASE" != "main" ] && [ "$BASE" != "develop" ]; then
    echo "ℹ️  PR base is not main/develop (base=${BASE}) → skip einja-pr-review" >&2
    SKIP_REVIEW=true
  fi
fi

# 3. --auto モード（issue-exec 経由）または --with-review フラグ or --force-review
if [ "$SKIP_REVIEW" != "true" ]; then
  if [ "$FORCE_REVIEW" = "true" ] || has_flag "--auto" || has_flag "--with-review"; then
    SHOULD_RUN_REVIEW=true
  fi
fi

# 4. 発動 or スキップ
if [ "$SHOULD_RUN_REVIEW" = "true" ]; then
  # 発動理由を明示
  TRIGGER_REASON="--with-review"
  [ "$FORCE_REVIEW" = "true" ] && TRIGGER_REASON="--force-review"
  has_flag "--auto" && TRIGGER_REASON="--auto"
  echo "▶️  Triggering einja-pr-review for PR #${PR_NUMBER} (trigger: ${TRIGGER_REASON}, base: ${BASE})" >&2

  # Skill tool 呼び出し
  # 詳細は .claude/skills/einja-pr-review/SKILL.md 参照
  # sticky comment 投稿は einja-pr-review 側で完結（独立した Step 5.6 は設けない）
  # 呼び出し失敗時のリカバリ: /einja-pr-review <PR番号> で手動再実行
  ...
elif [ "$SKIP_REVIEW" != "true" ]; then
  # スキップ条件に該当しないが発動フラグもない（手動 /einja-create-pr のデフォルト）
  echo "ℹ️  einja-pr-review not triggered (base=${BASE}, no --auto/--with-review flag)" >&2
fi
```

#### Skill tool 呼び出し規約

- 発動条件を満たしたら、**Skill tool** で `einja-pr-review` を呼び出す
- `args` には Step 5 で作成された PR番号 `$PR_NUMBER` を渡す（例: `args: "<PR番号>"`）
- `einja-pr-review` は内部で以下を実行する（詳細は `.claude/skills/einja-pr-review/SKILL.md` 参照）:
  - PR差分・本文・関連Issue・仕様書・Asana情報の収集
  - `einja-review-code` / `einja-review-spec` の Skill tool 経由呼び出し
  - 4セクション（§1 PR概要 / §2 AIレビュー / §3 人間観点 / §4 指摘サマリー）の生成
  - **sticky comment としての PR コメント投稿**（マーカー `<!-- einja-pr-review:v1 -->` による既存Botコメント検出・更新）
- 呼び出しに失敗した場合はエラー出力しつつ Step 6 へ進む（`einja-create-pr` 全体は継続。開発者は `/einja-pr-review <PR番号>` で手動再実行可能）

#### 発動シナリオ一覧

| シナリオ | base | フラグ | einja-pr-review 発動 |
|--------|------|-------|:-------:|
| `einja-issue-exec` 最終PR: `/einja-create-pr --auto --base main` | main | --auto | ✅ |
| `einja-issue-exec` 最終PR: `/einja-create-pr --auto --base develop` | develop | --auto | ✅ |
| `einja-issue-exec` Phase PR: `/einja-create-pr --auto --base issue/{N}` | issue/* | --auto | ❌（base不一致） |
| `einja-task-exec` タスクPR: base=phase/* | phase/* | --auto | ❌（base不一致） |
| 手動 `/einja-create-pr`（デフォルト、base=main） | main | なし | ❌（フラグなし） |
| 手動 `/einja-create-pr --with-review`（base=main） | main | --with-review | ✅ |
| 手動 `/einja-create-pr --with-review --no-review` | main | --with-review + --no-review | ❌（--no-review 優先） |
| 手動 `/einja-create-pr --with-review`（base=feature/xxx） | feature/* | --with-review | ❌（base不一致） |
| 開発者が `gh pr create` 直接使用 | 任意 | - | ❌（einja-create-pr を経由しない） |
| `einja-issue-spec-create` Spec PR: `mcp__github__create_pull_request` 直接 | main等 | - | ❌（einja-create-pr を経由しない。既に einja-review-spec × 3回で高品質レビュー済み） |
| 動作確認用: `/einja-create-pr --with-review --force-review --base <skill-branch>` | 任意 | --with-review + --force-review | ✅（base判定バイパス、デバッグ用途） |

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
