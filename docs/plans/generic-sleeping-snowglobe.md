# Plan: issue-exec Manager を worktree 化し、複数Issue同時実行を可能にする

## Context

現在の `issue-exec` コマンドでは、Manager がメインリポジトリで直接動作する。
これにより:
1. 複数Issue同時実行時に git 状態の race condition リスクがある
2. Manager 実行中にメインリポジトリで手動作業ができない

Manager も worktree で動作させることで、これらを解消する。

**技術的前提**: Git 2.15+ では worktree 内から `git worktree add` / `git branch` / `git push` が可能（検証済み）。

## 変更対象

`.claude/commands/einja/issue-exec.md` （1ファイルのみ）

## 具体的な変更箇所（5箇所）

### 1. Step 2: ブランチ & worktree 作成（L124-137）

Manager worktree を最初に作成し、以降のgit操作はすべて Manager worktree 内から実行する。

```markdown
### Step 2: ブランチ & worktree 作成
1. Issue ブランチ作成（メインリポジトリから）: `issue/{issue番号}`（base ブランチから）
2. Manager worktree 作成（メインリポジトリから）:
   ```bash
   mkdir -p ~/.einja/worktrees/issue-{N}/
   git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}
   git push -u origin issue/{N}
   ```
3. **以降の操作は全て Manager worktree 内から実行**（cwd: `~/.einja/worktrees/issue-{N}/manager`）
4. 各 Phase のブランチ作成（Manager worktree から）: `issue/{issue番号}-phase{N}`（issue ブランチから）
5. Phase worktree 作成（Manager worktree から）:
   ```bash
   git worktree add ~/.einja/worktrees/issue-{N}/phase{M} issue/{N}-phase{M}
   git push -u origin issue/{N}-phase{M}
   ```
```

### 2. Step 4: tmux セッション作成（L166-168）

Manager の cwd を worktree に指定する。

```bash
tmux new-session -d -s einja-{issue番号} -n manager -c ~/.einja/worktrees/issue-{N}/manager
```

### 3. Step 0-3: セッション復元（L112-114）

Manager worktree の存在確認・再作成ロジックを追加。

```markdown
#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - Manager worktree の存在確認: `git worktree list | grep issue-{N}/manager`
    - 存在しない場合は再作成: `git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}`
  - 未完了のPhaseのDirectorを再起動する
```

### 4. worktree 物理パス構成図（L266-270）

`manager/` を追加。

```
~/.einja/worktrees/issue-{N}/
├── manager/                      ← Manager cwd
├── phase{M}/                     ← Director cwd
├── task-{X.Y}/                   ← Worker cwd
```

### 5. セッションクリーンアップ（L390-395）

Manager worktree を削除対象に追加。

```markdown
Issue完了時に以下を自動削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を各ディレクトリに対して実行）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/task-{X.Y}`（Worker）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/phase{M}`（Director）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/manager`（Manager - 最後に削除）
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*）
```

## ブランチ構成図の更新

```
{baseBranch}
 └── issue/{N}                        Manager worktree（← 変更点）
      ├── issue/{N}-phase1             Director1 worktree
      │    ├── task/{N}-1.1            Worker1.1 worktree
      ...
```

## 変更しない箇所

- Director/Worker の起動方法
- ステータスファイル構造（絶対パスで管理）
- `gh pr create` コマンド
- `task-exec` コマンド
- `einja-team-exec` Skill

## 検証方法

1. 変更後の `issue-exec.md` 全体を通読し、Step 0〜7の整合性を確認
2. worktree 構成図・ブランチ構成図が一致しているか確認
