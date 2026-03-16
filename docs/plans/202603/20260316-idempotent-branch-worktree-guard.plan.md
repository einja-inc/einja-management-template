# 既存ブランチ・worktree の冪等ガード追加

## Context

einja-issue-team-exec / einja-issue-exec で Issue を再実行する際、ブランチやworktreeが既に存在するとエラーで停止する。
resume フロー以外でも、以下のケースでエラーなく既存リソースを再利用できるようにする:
- ローカルブランチが既に存在
- リモートブランチが既に存在（ローカルにはない）
- worktree ディレクトリが既に存在（正常 or orphaned）
- ブランチが別worktreeでチェックアウト済み

## 現状

### 冪等ガードの状況

| 箇所 | ブランチ作成 | worktree作成 | push |
|------|------------|-------------|------|
| **team-exec** Step 2 (L133-136) | `\|\| true` あり | N/A | `\|\| true` あり |
| **team-exec** Step 6 (L356-357) | `\|\| true` あり | N/A | `\|\| true` あり |
| **team-exec** director-prompt (L19) | なし（`-b`付きworktree add） | ガードなし | N/A |
| **team-exec** director-prompt (L41) | なし（`-b`付きworktree add） | ガードなし | N/A |
| **issue-exec** Step 2 (L148-155) | テキスト記述のみ（コマンドなし） | ガードなし | ガードなし |
| **issue-exec** Step 5 tmux (L214-216) | `\|\| true` あり | ガードなし | `\|\| true` あり |
| **issue-exec** Step 5 agent-tool (L232-233) | `\|\| true` あり | N/A（isolation） | `\|\| true` あり |
| **issue-exec** Worker起動 (L448-451) | `\|\| true` あり | ガードなし | `\|\| true` あり |

## 変更内容

### 方針: 共通冪等パターンを定義し、全箇所に一貫適用

**前提**: 全パターンの前に `git fetch origin` が実行されていること（リモートブランチ検出に必要）

#### ブランチ作成の冪等パターン

```bash
# 前提: git fetch origin 済み
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  git branch "${BRANCH}" "origin/${BRANCH}"  # リモートからローカル作成
else
  git branch "${BRANCH}" "${BASE}"  # 新規作成
fi
git push -u origin "${BRANCH}" 2>/dev/null || true
```

#### worktree作成の冪等パターン

```bash
# 1. 絶対パスで厳密判定（相対パス不一致を防止）
WORKTREE_ABS=$(cd "$(dirname "${WORKTREE_PATH}")" 2>/dev/null && echo "$(pwd)/$(basename "${WORKTREE_PATH}")" || echo "${WORKTREE_PATH}")
if git worktree list --porcelain | grep -qFx "worktree ${WORKTREE_ABS}"; then
  : # 既存worktreeを再利用
else
  # 2. orphaned worktree をクリーンアップ
  git worktree prune --expire now 2>/dev/null
  # 3. ディレクトリ残骸があれば削除（git管理外の残骸）
  if [ -d "${WORKTREE_PATH}" ]; then
    rm -rf "${WORKTREE_PATH}"
  fi
  # 4. ブランチが別worktreeでチェックアウト済みか確認
  if git worktree list --porcelain | grep -q "branch refs/heads/${BRANCH}$"; then
    echo "ERROR: ${BRANCH} は別のworktreeで使用中" >&2
    exit 1
  fi
  git worktree add "${WORKTREE_PATH}" "${BRANCH}"
fi
```

### 対象ファイルと修正箇所

#### 1. `.claude/skills/einja-issue-team-exec/director-prompt.md`

**L19** — Director worktree作成:
```bash
# 現状
git worktree add ../${project-name}-worktrees/task-${N}-{X.Y} -b task/${N}-{X.Y} origin/issue/${N}-phase{M}

# 修正後:
git fetch origin

# ブランチ作成（冪等）
BRANCH="task/${N}-{X.Y}"
BASE="origin/issue/${N}-phase{M}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi

# worktree作成（冪等）
WORKTREE_PATH="../${project-name}-worktrees/task-${N}-{X.Y}"
# （worktree冪等パターンを展開）
```

**L41** — Worker worktree作成: 同パターン（BASEが `task/${N}-{X.Y}` に変わるだけ）

#### 2. `.claude/skills/einja-issue-exec/SKILL.md`

**Step 2 (L148-156)** — Issue ブランチ + Manager worktree:
```bash
# 修正後: テキスト記述を具体コマンドに変更
git fetch origin

# Issue ブランチ作成（冪等）
BRANCH="issue/{N}"
BASE="origin/{IssueBranchBase}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true

# Manager worktree作成（冪等）
mkdir -p ~/.einja/worktrees/issue-{N}/
WORKTREE_PATH=~/.einja/worktrees/issue-{N}/manager
# （worktree冪等パターンを展開）
```

**Step 5 tmux (L214-216)** — Worker worktree:
```bash
# 修正後: git branch行は既存の || true を冪等パターンに置換
# git worktree add行に冪等ガード追加
WORKTREE_PATH=~/.einja/worktrees/issue-{N}/task-{X.Y}
BRANCH="task/{N}-{X.Y}"
# （worktree冪等パターンを展開）
```

**Worker起動 (L448-451)** — Step 5 tmuxと同じパターン（重複記述箇所）

#### 3. `.claude/skills/einja-issue-team-exec/SKILL.md`

**Step 2 (L132-136)** — `git fetch origin` は既存。`|| true` パターンを冪等パターンに置換:
```bash
git fetch origin

# Issue ブランチ（冪等）
BRANCH="issue/${N}"
BASE="origin/${baseBranch}"
# （ブランチ冪等パターンを展開）

# Phase ブランチ（冪等）
BRANCH="issue/${N}-phase1"
BASE="issue/${N}"
# （ブランチ冪等パターンを展開）
```

**Step 6 (L354-361)** — 次Phase ブランチ作成: 同じ冪等パターン適用

## タスク概要

| ID | タスク | 依存 | Skill/サブエージェント |
|----|--------|------|----------------------|
| 0-0 | TaskCreate一括登録 | - | - |
| 0-1 | Planファイルリネーム | 0-0 | [Bash] |
| 1-1 | director-prompt.md 修正（L19, L41） | 0-1 | [general-purpose] |
| 1-2 | einja-issue-exec/SKILL.md 修正（Step 2, Step 5, Worker起動） | 0-1 | [general-purpose] |
| 1-3 | einja-issue-team-exec/SKILL.md 修正（Step 2, Step 6） | 0-1 | [general-purpose] |
| 99-1 | 観点別並列コードレビュー | 1-1,1-2,1-3 | [einja-review-code] |
| 99-G | コミット承認ゲート | 99-1 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

- **1-1, 1-2, 1-3** は独立した3ファイルへの修正のため並列実行可能

## リスク・不明点

- **低リスク**: Skillドキュメント（手順書）の修正のみ。実行コードではないため、既存動作を壊すリスクは低い
- `git worktree prune --expire now` はorphaned worktreeのみをクリーンアップするため、稼働中のworktreeには影響しない
- orphaned ディレクトリの `rm -rf` は worktree管理外であることを確認済みの場合のみ実行される

## 検証・動作確認方法

- 各ファイルの `git worktree add` / `git branch` コマンドすべてに冪等ガードが付いていることをGrepで確認
- コードブロック内のbashシンタックスが正しいことを目視確認
- 対処すべきケース網羅チェック: ローカルのみ / リモートのみ / 両方 / orphaned / 別worktreeでチェックアウト済み
