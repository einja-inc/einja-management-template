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

## 動作モード

| モード | トリガー | changeset確認 | ラベル確認 |
|--------|---------|--------------|-----------|
| 自動 | task-exec/issue-exec経由 | 推定値で自動決定 | 自動 |
| 対話 | 手動 `/einja-create-pr` | AskUserQuestionで確認 | AskUserQuestionで確認 |

呼び出し元がtask-exec/issue-execかどうかは、$ARGUMENTSに `--auto` フラグがあるかで判定する。

## 入力

```
$ARGUMENTS: [--auto] [--base <branch>] [--title <title>]
```

- `--auto`: 自動モード（確認なしで実行）
- `--base`: PRのベースブランチ（デフォルト: 現在のブランチの上流を推測）
- `--title`: PRタイトル（指定なしの場合はコミットメッセージから生成）

## 処理フロー

### Step 1: 差分分析

```bash
# ベースブランチの決定
BASE=$(git rev-parse --abbrev-ref HEAD@{upstream} 2>/dev/null | sed 's|origin/||' || echo "main")
# --base指定があればそちらを優先

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
変更ファイルのパスからパッケージを推定:
- `apps/web/**` → `@repo/web`
- `apps/admin/**` → `@repo/admin`
- `packages/**` は除外（内部パッケージ）

### Step 3: changeset生成

スキップ条件に該当しない場合のみ実行。

対話モードの場合は、推定した変更種別とサマリーをAskUserQuestionで確認。

```bash
# ランダムファイル名で.changesetファイルを作成
# フォーマット:
# ---
# "@repo/web": minor
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

## 出力

PR作成後、以下を出力:
- PR URL
- 付与したラベル
- changeset情報（生成した場合）
- CI確認結果（実行した場合）
