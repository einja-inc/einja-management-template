---
name: _einja-worktree-guide
description: >-
  worktreeセットアップの共通ガイド。ローカルファイルコピー（.env系、settings.local.json、.serena）、
  安全なブランチ切り替え（既存ブランチ破壊防止）、依存関係インストールの手順を提供。
  CLAUDE.md実装フェーズ、issue-spec-create、issue-exec、issue-team-execから参照される内部Skill。
  Do NOT use for: worktree作成自体（→ EnterWorktree）、gitコンフリクト解消（→ einja-conflict-resolver）
user_invocable: false
---
<!-- ベース: CLAUDE.md「実装フェーズ（承認後）」セクション -->
<!-- 参考: git-worktree(1) man page -->

# Worktree セットアップガイド

## Planモード実装フェーズでの使い方

1. AskUserQuestionでベースブランチを確認（デフォルトブランチ / main / develop / その他）
2. 未コミット変更（新Skill、hook変更等）があればコミット＆プッシュ
3. `EnterWorktree`（worktree name: kebab-case。Issue紐付き → `issue-{N}-{作業内容}`、それ以外 → `{作業内容}`）
4. 以下のStep 1〜3を実行

## セットアップ手順

EnterWorktree または `git worktree add` でworktreeを作成した後、以下の手順でworktree内の環境をセットアップする。

## Step 1: ローカルファイルのコピー

worktreeは `.gitignore` 対象のファイルを共有しない。メインリポジトリから手動でコピーする必要がある。

```bash
# メインリポジトリのルートパスを取得
MAIN_REPO=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel 2>/dev/null || echo "")

if [ -z "$MAIN_REPO" ]; then
  echo "WARN: メインリポジトリを検出できません。ローカルファイルコピーをスキップします"
else
  # .env系ファイルをコピー（存在する場合のみ）
  for f in .env .env.local .env.keys .env.personal; do
    [ -f "$MAIN_REPO/$f" ] && cp "$MAIN_REPO/$f" .
  done

  # Claude Code設定をコピー（存在する場合のみ）
  [ -f "$MAIN_REPO/.claude/settings.local.json" ] && mkdir -p .claude && cp "$MAIN_REPO/.claude/settings.local.json" .claude/

  # Serena設定をコピー（存在する場合のみ）
  [ -d "$MAIN_REPO/.serena" ] && cp -r "$MAIN_REPO/.serena" .
fi
```

コピー対象のファイルが存在しない場合は無視してよい（全プロジェクトが全ファイルを持つわけではない）。

## Step 2: ブランチセットアップ（安全版）

特定のブランチで作業する必要がある場合（Issue ブランチ、Task ブランチ等）、以下の手順で安全に切り替える。

```bash
# ブランチ名とベースブランチを設定（呼び出し元から指定される）
BRANCH_NAME="issue/123"       # 例
BASE_BRANCH="origin/main"     # 例

# リモート最新を取得
git fetch origin

# 既存ブランチチェック → 安全な切り替え
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  # 既存ブランチがある場合はcheckoutのみ
  git checkout "$BRANCH_NAME"
  # リモートに存在する場合のみpull
  git ls-remote --exit-code origin "$BRANCH_NAME" &>/dev/null && git pull origin "$BRANCH_NAME" --rebase
else
  # 新規ブランチ作成
  git checkout -b "$BRANCH_NAME" "$BASE_BRANCH"
fi
```

### 禁止事項

| コマンド | 理由 |
|---------|------|
| `git checkout -B <branch>` | 既存ブランチのコミット履歴を破壊する |
| メインリポジトリでの `git checkout` | 他のworktreeやプロセスと競合する |

## Step 3: 依存関係インストール

| 作業内容 | pnpm install |
|---------|-------------|
| コード変更を伴う作業 | **必須** |
| ドキュメントのみの変更 | スキップ可能 |
| テスト実行が必要な作業 | **必須** |

```bash
pnpm install
```

## 注意事項

- **未コミット変更の事前処理**: worktree作成前に、実装に必要な未コミット変更（新Skill、hook変更等）があればメインリポジトリでコミット＆プッシュすること。worktreeはHEADの時点のコードを参照するため、未コミット変更はworktreeに反映されない
- **Planファイルの参照**: Planファイルはメインリポジトリの絶対パスで参照可能（worktree内からも `Read` ツールで読める）。worktree内にコピーする必要はない
- **メインリポジトリのcheckout変更禁止**: worktree内の操作でメインリポジトリのHEADを変更してはならない。ブランチ操作はすべてworktree内で完結させる
- **.gitignore対象ファイル**: `.env`, `.env.keys`, `.claude/settings.local.json`, `.serena/` 等はgitignoreされているため、Step 1のコピーが必要

<!-- @einja:project-private:start id="_einja-worktree-guide-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
