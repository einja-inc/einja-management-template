# Plan: issue-exec コマンドの入力を自然言語解析 + AskUserQuestion 対話型に変更

## Context

`issue-exec.md` の「入力の解析」セクションで `--merge-mode` 等のオプション引数を使っているが、ユーザーが覚えきれない。`$ARGUMENTS` を自然言語として解析し、読み取れなかった項目だけ `AskUserQuestion` で対話的に聞くように変更する。

## 対象ファイル

- `.claude/commands/einja/issue-exec.md`
  - L2: `description` を自然言語入力対応に更新
  - L12-22: 「入力の解析」セクションを全面書き換え

## 変更内容

### 1. description（L2）更新

```
description: "GitHub Issueの全タスクを階層的に並列実行するコマンド。Manager→Director→Workerの3階層でtmux+worktreeを使用。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
```

### 2. 「入力の解析」セクション（L12-22）を以下に置換

```markdown
## 入力の解析

### Step A: $ARGUMENTS を自然言語として解析

$ARGUMENTS をLLMとして自然言語解析し、以下の情報を抽出する:

| 項目 | 抽出例 |
|------|--------|
| Issue番号 | `#123`, `123`, `Issue 45`, `45番` → 数値を抽出 |
| マージモード | `autoで`, `自動マージ`, `全部自動` → auto / `タスクだけ自動` → task-group-auto / `手動で確認`, `慎重に` → manual |
| 実行範囲 | `phase2まで`, `フェーズ1だけ`, `全部` → max-phase 数値 or null |
| ベースブランチ | `developから`, `mainベース` → ブランチ名 |
| セッション復旧 | `再開`, `resume`, `続きから` → resume フラグ |

解析できなかった項目は「未指定」とする。曖昧な場合も無理に推測せず「未指定」とする。

### Step B: resume が検出された場合
セッション復旧フローへ直接進む（Step 0 の復旧処理）。以降の質問はスキップ。

### Step C: 未指定項目を AskUserQuestion で確認

**Issue番号** が未指定の場合、まず Issue番号を質問する。

残りの未指定オプションを **1回の AskUserQuestion** でまとめて質問する（指定済みの項目はスキップ）:

#### Q1: マージモード（未指定時のみ）
- header: "Merge mode"
- multiSelect: false
- options:
  1. label: "manual（推奨）"
     description: "タスクPR・Phase PRとも人間がマージ。変更内容を都度レビューしたい場合に最適"
  2. label: "task-group-auto"
     description: "タスクPR（task→phase）はCI通過後に自動マージ。Phase PRは人間マージ。スピードと安全性のバランス型"
  3. label: "auto"
     description: "タスクPR・Phase PRとも自動マージ。最終PR（issue→base）のみ人間マージ。最速だがリスクあり"

#### Q2: 実行範囲（未指定時のみ）
- header: "Phase範囲"
- multiSelect: false
- options:
  1. label: "全Phase実行（推奨）"
     description: "Issueに定義された全Phaseを順次実行する"
  2. label: "特定Phaseまで"
     description: "Phase番号を指定して途中まで実行。段階的に確認したい場合に有用（Other欄にPhase番号を入力）"

#### Q3: ベースブランチ（未指定時のみ）
- header: "Base branch"
- multiSelect: false
- options:
  1. label: "main（推奨）"
     description: "デフォルトのメインブランチからIssueブランチを作成"
  2. label: "develop"
     description: "developブランチがある場合。GitFlow運用向け"
```

## 検証

1. `issue-exec.md` の L2 description が自然言語対応の文言に更新されていること
2. 「入力の解析」セクション（旧 L12-22）が Step A/B/C の新内容に置換されていること
3. Step 0 以降の処理フローは一切変更なし
4. 自然言語解析の抽出例テーブルが記載されていること
