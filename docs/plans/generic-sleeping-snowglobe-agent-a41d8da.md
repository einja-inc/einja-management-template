# 計画レビュー結果: generic-sleeping-snowglobe

## レビュー完了日時
2026-03-04

## 総評
⚠️ PARTIAL - 3件の重要な問題を検出。修正後に実装可能。

## 問題点と修正指示

### 問題1: Step 2 に Manager worktree 作成が記述されていない【最重要】

**箇所:** `.claude/commands/einja/issue-exec.md` L124-137

**現状:**
```markdown
### Step 2: ブランチ & worktree 作成
1. Issue ブランチ作成: `issue/{issue番号}`（base ブランチから）
2. 各 Phase のブランチ作成: `issue/{issue番号}-phase{N}`（issue ブランチから）
3. git worktree 作成:
   mkdir -p ~/.einja/worktrees/issue-{N}/
   git worktree add ~/.einja/worktrees/issue-{N}/phase{M} issue/{N}-phase{M}
```

**修正後:**
```markdown
### Step 2: ブランチ & worktree 作成
1. Issue ブランチ作成: `issue/{issue番号}`（base ブランチから）
2. Manager worktree 作成（メインリポジトリから）:
   ```bash
   mkdir -p ~/.einja/worktrees/issue-{N}/
   git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}
   git push -u origin issue/{N}
   ```
3. **以降の操作は全て Manager worktree 内から実行する**（cwd: `~/.einja/worktrees/issue-{N}/manager`）
4. 各 Phase のブランチ作成（Manager worktree から）: `issue/{issue番号}-phase{N}`（issue ブランチから）
5. Phase worktree 作成（Manager worktree から）:
   ```bash
   git worktree add ~/.einja/worktrees/issue-{N}/phase{M} issue/{N}-phase{M}
   git push -u origin issue/{N}-phase{M}
   ```
```

**理由:** 計画の中核である「Manager を worktree 化」が実装記述に反映されていない

---

### 問題2: Step 4 tmux セッション起動ディレクトリ未指定

**箇所:** `.claude/commands/einja/issue-exec.md` L166-168

**現状:**
```bash
tmux new-session -d -s einja-{issue番号} -n manager
```

**修正後:**
```bash
tmux new-session -d -s einja-{issue番号} -n manager -c ~/.einja/worktrees/issue-{N}/manager
```

**理由:** Manager が worktree 内で動作するよう cwd を明示する必要がある

---

### 問題3: worktree 物理パス構成図に manager/ が欠落

**箇所:** `.claude/commands/einja/issue-exec.md` L266-270

**現状:**
```markdown
## worktree 物理パス
```
~/.einja/worktrees/issue-{N}/
├── phase{M}/                     ← Director cwd
├── task-{X.Y}/                   ← Worker cwd
```
```

**修正後:**
```markdown
## worktree 物理パス
```
~/.einja/worktrees/issue-{N}/
├── manager/                      ← Manager cwd（NEW）
├── phase{M}/                     ← Director cwd
├── task-{X.Y}/                   ← Worker cwd
```
```

**理由:** 計画で明記された構成図との整合性

---

## 改善提案

### 提案1: Step 0-3 セッション復元に Manager worktree 再作成を追記

**箇所:** `.claude/commands/einja/issue-exec.md` L112-114

**現状:**
```markdown
#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - 未完了のPhaseのDirectorを再起動する
```

**追記案:**
```markdown
#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - Manager worktree の存在確認: `git worktree list | grep issue-{N}/manager`
    - 存在しない場合は再作成: `git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}`
  - 未完了のPhaseのDirectorを再起動する
```

**理由:** 計画で明記されているが、実装記述に含まれていない

---

### 提案2: セッションクリーンアップに Manager worktree 削除を追加

**箇所:** `.claude/commands/einja/issue-exec.md` L390-395

**現状:**
```markdown
## セッションクリーンアップ

Issue完了時に以下を自動削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を実行）
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*）
```

**追記案:**
```markdown
## セッションクリーンアップ

Issue完了時に以下を自動削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を各ディレクトリに対して実行）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/manager`
  - `git worktree remove ~/.einja/worktrees/issue-{N}/phase{M}`
  - `git worktree remove ~/.einja/worktrees/issue-{N}/task-{X.Y}`
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*, issue/{N}）
```

**理由:** Manager worktree も削除対象に含める必要がある

---

## 検証済み項目

### ✅ 技術的正確性
- worktree内から `git worktree add` / `git branch` / `git push` が動作することを確認済み（計画に記載あり）

### ✅ 複数Issue同時実行の安全性
- 各 Manager が独立した worktree で動作するため race condition は発生しない
- ブランチ名も `issue/{N}` で分離されており衝突しない

### ✅ 後方互換性
- Director/Worker の起動方法は変更なし
- ステータスファイル構造は絶対パスで管理されており影響なし

### ✅ その他の変更なし箇所
- Director/Worker 起動方法
- ステータスファイル構造
- `gh pr create` コマンド
- `einja-team-exec` Skill
- `task-exec` コマンド

---

## 次のステップ

1. 上記3件の問題を修正する
2. 改善提案2件を検討・適用する
3. 修正後、issue-exec.md の全体整合性を再確認する
4. `presets/default/` へのビルド反映は自動（CLAUDE.md記載のとおり）
