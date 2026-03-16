# Issue実行時のタスクグループ完了チェックボックス更新

## Context

einja-issue-exec / einja-issue-team-exec の両Skillで、タスクグループ完了時にGitHub Issue説明文のチェックボックス（`- [ ]` → `- [x]`）を更新する処理が欠落している。Issue上でタスクの進捗が可視化されず、手動確認が必要になっている。

## 現状

- Issue説明文のタスクリスト形式: `- [ ] 1.1 タスクグループ名`（format-rules.md で定義済み）
- タスクグループ完了時の処理:
  - **issue-exec**: ゲートチェック通過 → PRマージ → worktree削除（チェック更新なし）
  - **issue-team-exec**: Step 5-4 マージ後処理 → TaskUpdate completed（チェック更新なし）
  - **issue-exec-protocol.md**: `completed`ステータス定義にIssue更新の記述なし

## 変更内容

### 1. issue-exec-protocol.md に共通ルールを追加
- **ファイル**: `docs/einja/instructions/issue-exec-protocol.md`
- **箇所**: `completed`ステータス遷移の処理定義（セクション2付近）
- **内容**: タスクグループが`completed`に遷移する際の必須アクションとして「GitHub Issueのチェックボックス更新」を追加
- **更新手順**:
  1. `gh issue view {N} --json body -q .body` でIssue本文を取得
  2. 該当行の `- [ ]` を `- [x]` に置換（正規表現: `^- \[ \] ${X}\.${Y} ` — 末尾スペースで `1.1` と `1.10` の部分一致を防止）
  3. 既に `- [x]` の場合はスキップ（冪等性確保）
  4. `gh issue edit {N} --body "$(updated_body)"` で更新

### 2. einja-issue-exec/SKILL.md にチェック更新ステップを追加
- **ファイル**: `.claude/skills/einja-issue-exec/SKILL.md`
- **箇所**: ゲートチェック通過後の処理フロー内、PR処理完了後かつsync通知前
- **内容**: 「Issue説明文のチェックボックス更新（protocol.md参照）」ステップを追加
- protocol.mdの共通ルールを参照する形で記述

### 3. einja-issue-team-exec/SKILL.md にチェック更新ステップを追加
- **ファイル**: `.claude/skills/einja-issue-team-exec/SKILL.md`
- **箇所**: Step 5-4 マージ後処理（行303-306付近）
- **内容**: TaskUpdate completed の直後に「Issue説明文のチェックボックス更新」ステップを追加
- protocol.mdの共通ルールを参照する形で記述

## タスク概要

| # | タスク | 使用Skill/ツール |
|---|--------|----------------|
| 0-1 | Planファイルリネーム | Bash |
| 1-1 | issue-exec-protocol.md にチェックボックス更新の共通ルール追加 | Edit |
| 1-2 | einja-issue-exec/SKILL.md にステップ追加 | Edit |
| 1-3 | einja-issue-team-exec/SKILL.md にステップ追加 | Edit |
| 99-1 | コードレビュー [einja-review-code] | einja-review-code |
| 99-G | コミット承認ゲート [AskUserQuestion] | AskUserQuestion |
| 99-3 | コミット・プッシュ [einja-task-commit] | einja-task-commit |

## 並列実行計画

- 1-1 → 1-2, 1-3（protocol.mdの記述確定後に両Skill修正を並列実行）
- 1-2, 1-3 は独立（異なるファイル）

## リスク・不明点

- **競合リスク**: 複数Directorが同時にIssue本文を更新する可能性あり → protocol.mdに「更新直前にIssue本文を再取得する」注意事項を記載
- **フォーマット不一致**: Issue説明文が想定フォーマットに従っていない場合 → マッチしない場合はスキップ（エラーにしない）
- **冪等性**: resume時や手動チェック済みの場合、既に`- [x]`の行を再更新しない（置換前に状態チェック）

## 検証・動作確認方法

- 3ファイルの変更差分を確認し、記述の一貫性を検証
- format-rules.mdのタスクリスト形式と更新コマンドの整合性を確認
