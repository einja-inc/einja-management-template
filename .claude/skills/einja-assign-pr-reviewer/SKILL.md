---
name: einja-assign-pr-reviewer
description: "Assigns a reviewer to an existing GitHub PR by adding the given GitHub account(s) as reviewers via gh CLI. Use when a PR has already been created and you want to request review from specific accounts. Triggers: 'PRにレビュアーを割り当てて', 'このPRのレビュアーを設定して', 'assign reviewer to PR', 'add reviewer'. Do NOT use for: creating a PR or merging it (→ einja-create-pr), setting an assignee, or performing the review itself."
user-invocable: true
allowed-tools:
  - Bash
---

# einja-assign-pr-reviewer

既存のGitHub PRに対して、指定したGitHubアカウントをレビュアーとして割り当てるSkill。`gh pr edit --add-reviewer` を用いてレビュー依頼を送り、設定結果を確認して報告する。

## 責務
PRのURL（または番号）とGitHubアカウントを受け取り、そのアカウントを対象PRのレビュアーに設定する。

## スコープ外（やらないこと）
- PRの作成は行わない（→ einja-create-pr の責務）
- Assignee（担当者）の設定は行わない
- レビューそのものの実施は行わない

## 使用タイミング
- 呼び出し元: ユーザー直接 / 他スキル
- 局面: PR作成後、レビュアーを割り当てたいとき

## 入力
### 必須入力
- `pr`: URL または 数値 — 対象PR。URLでも番号でも `gh pr edit` が受け付ける
- `reviewer`: 文字列 — レビュアーのGitHubアカウント名。スペース区切りで複数指定可

## 出力
- 形式: 文字列（実行結果メッセージ）
- 内容: 設定したレビュアーと対象PRのURL

## 依存スキル
| 依存スキル | 条件 |
|-----------|------|
| なし | 内部で他スキルは呼ばず、gh CLI を使用するのみ |

## 実行手順

### Step 1: 引数を受け取る
- `pr`（URLまたは番号）と `reviewer`（GitHubアカウント名）を受け取る。
- `pr` はURL・番号のどちらでも `gh pr edit` がそのまま解釈するため、変換は不要。

### Step 2: レビュアーを追加する
- 次のコマンドでレビュアーを割り当てる:
  ```bash
  gh pr edit <pr> --add-reviewer <reviewer>
  ```
- 複数レビュアーを指定する場合はカンマ区切りにする（スペース区切りの入力はカンマ区切りへ変換する）:
  ```bash
  gh pr edit <pr> --add-reviewer a,b
  ```
- 注記: gitコマンドと同様、sandbox環境では `gh` がネットワークアクセスを要するため、Bashツールでは `dangerouslyDisableSandbox: true` を指定して実行する。

### Step 3: 設定結果を確認して報告する
- 次のコマンドで設定結果を取得する:
  ```bash
  gh pr view <pr> --json reviewRequests,url
  ```
- `reviewRequests` に指定アカウントが含まれること、`url` を確認し、設定したレビュアーと対象PRのURLをユーザーへ報告する。

### Step 4: エラー時（権限エラー 403）
- 403（権限不足）が返った場合は、平易な言葉で次を報告する:
  「対象リポジトリへの write 権限を持つアカウントで実行する必要があります。現在のアカウントには権限がないため、レビュアーを設定できませんでした。」

## 使用例

呼び出し例:

```
pr=163 reviewer=t-hiroyoshi
```

期待される動作:
1. `gh pr edit 163 --add-reviewer t-hiroyoshi` を実行し、PR #163 のレビュアーに `t-hiroyoshi` を追加する。
2. `gh pr view 163 --json reviewRequests,url` で `t-hiroyoshi` が設定されたこととPR URLを確認する。
3. 「PR #163（<url>）のレビュアーに t-hiroyoshi を設定しました」と報告する。
