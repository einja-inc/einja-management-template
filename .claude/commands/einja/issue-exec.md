---
description: "GitHub Issueの全タスクを階層的に並列実行するコマンド。Manager→Director→Workerの3階層でtmux+worktreeを使用。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
allowed-tools: Task, TaskCreate, TaskUpdate, TaskList, TaskGet, TaskOutput, Skill, Read, Write, Edit, MultiEdit, Bash, Grep, Glob, WebFetch, AskUserQuestion, mcp__github__*
---

# Issue 実行コマンド（Manager）

## 役割
GitHub Issue全体のタスクを Manager → Director → Worker の3階層で並列実行する。
tmux セッション、git worktree、ステータスファイルを使って全プロセスを管理する。

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

## 処理フロー

### Step 0: 環境準備

#### 1. tmux インストール確認・自動導入

1. `command -v tmux` で tmux の存在を確認
2. **インストール済みの場合**: `tmux -V` でバージョン表示し、次のステップへ進む
3. **未インストールの場合**: `uname -s` で OS を判定し、以下のフローで自動導入を提案

**macOS（`uname -s` = `Darwin`）:**
1. `command -v brew` で Homebrew を確認
2. Homebrew あり:
   - AskUserQuestion で「`brew install tmux` を実行してよいか？」確認 → 承認後に実行
3. Homebrew なし:
   - 以下を表示して**停止**:
     > tmux のインストールには Homebrew が必要です。
     > 以下のコマンドで Homebrew をインストール後、再度 issue-exec を実行してください:
     > `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**Linux（`uname -s` = `Linux`）:**
1. パッケージマネージャーを検出（上から優先）:
   - `command -v apt-get` → `apt-get update && apt-get install -y tmux`
   - `command -v dnf` → `dnf install -y tmux`
   - `command -v yum` → `yum install -y tmux`
   - いずれも検出できない場合 → 「対応パッケージマネージャーが見つかりません。手動で tmux をインストールしてください」と表示して**停止**
2. 権限判定とインストール:
   - `id -u` が 0（root）→ sudo 不要。AskUserQuestion で「`<pm> install tmux` を実行してよいか？」確認 → 承認後に実行
   - root でない場合 → `sudo -n true 2>/dev/null` で sudo 権限を確認
     - sudo 可能 → AskUserQuestion で「`sudo <pm> install tmux` を実行してよいか？」確認 → 承認後に実行
     - sudo 不可 → AskUserQuestion で「tmux のインストールには sudo 権限が必要です。パスワード入力が求められる場合があります。`sudo <pm> install tmux` を実行しますか？それとも手動でインストールしますか？」と確認
       - 手動を選択 → インストールコマンドを表示して**停止**

**その他（`MINGW*`, `MSYS*`, `CYGWIN*`, 不明な OS）:**
- 以下を表示して**停止**:
  > issue-exec は tmux を必須としており、この環境では利用できません。
  > WSL2 環境での実行を推奨します。
  > 代替: `/einja:task-exec` で個別タスクグループを逐次実行することは可能です。

**インストール後の検証:**
- `hash -r` で PATH をリフレッシュし、`command -v tmux && tmux -V` で成功確認
- 失敗した場合 → 「tmux のインストールは完了しましたが、PATH に反映されていません。シェルを再起動して再度実行してください」と表示して**停止**

#### 2. ディレクトリ準備
- `~/.einja/sessions/` と `~/.einja/worktrees/` ディレクトリを確認・作成

#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - 未完了のPhaseのDirectorを再起動する

### Step 1: Issue パース
1. `gh issue view {issue番号} --json body,title,number` でIssue本文を取得
2. Issue本文からPhase構造をパース：
   - `### Phase N: {Phase名}` のセクションを抽出
   - 各Phase内のタスクグループ（X.Y形式）を抽出
   - タスクグループ間の依存関係を分析
3. `--max-phase` が指定されている場合、その番号以降のPhaseを除外

### Step 2: ブランチ & worktree 作成
1. Issue ブランチ作成: `issue/{issue番号}`（base ブランチから）
2. 各 Phase のブランチ作成: `issue/{issue番号}-phase{N}`（issue ブランチから）
3. git worktree 作成:
   ```bash
   mkdir -p ~/.einja/worktrees/issue-{N}/
   git worktree add ~/.einja/worktrees/issue-{N}/phase{M} issue/{N}-phase{M}
   ```
4. worktree 作成時は必ずリモートにpush:
   ```bash
   git push -u origin issue/{N}
   git push -u origin issue/{N}-phase{M}
   ```

### Step 3: セッションファイル初期化
パス: `~/.einja/sessions/issue-{N}/`

```
session.json                    # セッション全体
phase-{M}/
  status.json                   # Phase状態
  task-{X.Y}.json               # 各タスクグループの状態
questions/
  q-{uuid}.json                 # 質問ファイル
events.jsonl                    # イベントログ
```

session.json の初期状態:
```json
{
  "issueNumber": 123,
  "mergeMode": "manual",
  "baseBranch": "main",
  "startedAt": "ISO8601",
  "managerPid": "PID",
  "phases": [
    { "number": 1, "name": "Phase名", "status": "pending", "branch": "issue/123-phase1" }
  ]
}
```

### Step 4: tmux セッション作成
```bash
tmux new-session -d -s einja-{issue番号} -n manager
```

### Step 5: Director 起動（Phase単位）
Phase の依存関係を考慮し、着手可能な Phase から Director を起動。

1. Phase worktree のディレクトリに移動
2. tmux window で `claude` を対話モードで起動
3. 初期プロンプトとして以下を送信（tmux send-keys）:

```
tmux new-window -t einja-{N} -n director-phase{M}
tmux send-keys -t einja-{N}:director-phase{M} 'cd ~/.einja/worktrees/issue-{N}/phase{M} && claude' Enter
```

claude が起動したら、以下のプロンプトを送信:
```
tmux send-keys -t einja-{N}:director-phase{M} '
あなたは Director（Phase {M}）です。以下の Phase を管理してください。

## Phase情報
- Issue番号: #{issue番号}
- Phase: {M} - {Phase名}
- Phase ブランチ: issue/{N}-phase{M}
- マージモード: {mergeMode}
- セッションパス: ~/.einja/sessions/issue-{N}/phase-{M}/
- worktree パス: ~/.einja/worktrees/issue-{N}/

## タスクグループ一覧
{タスクグループ一覧（番号、名前、依存関係を含む）}

## 責務
1. 依存関係のないタスクグループは並列でWorkerを起動してください
2. 各Worker には tmux window + claude 対話モードで起動:
   - worktree作成: git worktree add ~/.einja/worktrees/issue-{N}/task-{X.Y} task/{N}-{X.Y}
   - tmux: tmux new-window + claude 起動 + /einja:task-exec #{N} {X.Y} を実行
3. Worker完了後:
   - ステータスファイルでPR番号を確認
   - マージモードに応じたPR処理
   - 他active Workerにsync通知
   - 完了したworktree削除
4. 質問対応: Workerからの質問にspec/design/issueベースで回答。回答不可ならManagerにエスカレーション
5. Phase完了時: ステータスファイルで Manager に報告
6. GitHub Issue のチェックボックス更新

## 質問エスカレーション
回答不可な質問は ~/.einja/sessions/issue-{N}/questions/ にJSONファイルを作成してManagerに通知してください。
' Enter
```

### Step 6: 監視ループ
Manager は以下を定期的に監視:

1. **ステータスファイル監視**（30秒間隔）:
   - 各 Phase の status.json をチェック
   - Phase 完了を検知したら Phase PR を作成
   - 質問ファイルの pending 状態を検知

2. **質問エスカレーション処理**:
   - `~/.einja/sessions/issue-{N}/questions/` の pending 質問を検知
   - AskUserQuestion で人間に質問を表示
   - 回答をステータスファイルに書き込み

3. **Phase 完了処理**:
   - Phase PR 作成: `gh pr create --base issue/{N} --head issue/{N}-phase{M}`
   - マージモードに応じた処理（manual: 待機、auto: 自動マージ）
   - マージ後、Phase worktree 削除
   - 他 active Phase への変更伝播通知

4. **tmux window 消失検知**:
   - Director/Worker の tmux window が消失した場合のリカバリ処理

### Step 7: 全Phase完了 → 最終PR
1. 最終PR作成: `gh pr create --base {baseBranch} --head issue/{N}`
2. PR URL を表示
3. セッションクリーンアップ（worktree 削除、セッションファイル削除）

## マージモード詳細

| モード | タスクPR (task→phase) | Phase PR (phase→issue) | 最終PR (issue→base) |
|---|---|---|---|
| `manual` | 人間マージ待ち | 人間マージ待ち | 人間マージ待ち |
| `task-group-auto` | CI通過後に自動マージ | 人間マージ待ち | 人間マージ待ち |
| `auto` | CI通過後に自動マージ | CI通過後に自動マージ | 人間マージ待ち（常に手動） |

## ブランチ構成

```
{baseBranch}
 └── issue/{N}                        Manager管理
      ├── issue/{N}-phase1             Director1 worktree
      │    ├── task/{N}-1.1            Worker1.1 worktree
      │    ├── task/{N}-1.2            Worker1.2 worktree
      │    └── task/{N}-1.3            Worker1.3 worktree
      └── issue/{N}-phase2             Director2 worktree
           └── task/{N}-2.1            Worker2.1 worktree
```

## worktree 物理パス
```
~/.einja/worktrees/issue-{N}/
├── phase{M}/                     ← Director cwd
├── task-{X.Y}/                   ← Worker cwd
```

## ステータスファイル詳細

### session.json
```json
{
  "issueNumber": 123,
  "mergeMode": "manual",
  "baseBranch": "main",
  "startedAt": "2025-01-01T00:00:00Z",
  "managerPid": "12345",
  "phases": [
    { "number": 1, "name": "基盤構築", "status": "in_progress", "branch": "issue/123-phase1" },
    { "number": 2, "name": "機能実装", "status": "pending", "branch": "issue/123-phase2" }
  ]
}
```

### phase-{M}/status.json
```json
{
  "phaseNumber": 1,
  "status": "in_progress",
  "directorPid": "12346",
  "startedAt": "2025-01-01T00:00:00Z"
}
```

### phase-{M}/task-{X.Y}.json
```json
{
  "taskGroup": "1.1",
  "status": "completed",
  "branch": "task/123-1.1",
  "workerPid": "12347",
  "prNumber": 456,
  "startedAt": "2025-01-01T00:00:00Z",
  "completedAt": "2025-01-01T01:00:00Z"
}
```

### questions/q-{uuid}.json
```json
{
  "id": "q-001",
  "from": "worker-1.1",
  "question": "ユーザー認証にJWTとセッションのどちらを使うべきか？",
  "context": "design.md にはどちらの記載もない",
  "status": "pending",
  "escalatedTo": null,
  "answer": null,
  "answeredBy": null,
  "docUpdate": null
}
```

### events.jsonl
各行が1つのイベント:
```json
{"timestamp":"2025-01-01T00:00:00Z","pid":"12345","event_type":"session_started","data":{"issueNumber":123}}
{"timestamp":"2025-01-01T00:01:00Z","pid":"12346","event_type":"director_started","data":{"phase":1}}
```

## エラーリカバリ

| 障害 | 検知方法 | リカバリ |
|---|---|---|
| Worker異常終了（PR作成前） | tmux window消失 + ステータス未更新 | リトライ（最大2回）→ 失敗時はManagerに報告 → 人間判断 |
| Worker異常終了（PR作成済み） | tmux window消失 + PRあり | スキップ（PRマージ待ち継続） |
| Director異常終了 | tmux window消失 + ステータス未更新 | 各Workerのステータスを確認 → 未完了Workerのみ再実行 |
| Manager異常終了 | ユーザー手動 | `--resume` でセッション復元 |
| rebaseコンフリクト | git rebase失敗 | conflict-resolverで自力解消 |
| CI失敗 | gh run status | 修正 → 再push → 再CI待機 |

## CI 待機タイムアウト
- デフォルト: 30分
- 超過時は AskUserQuestion でユーザーに通知

## 質問回答のドキュメント還元
質問エスカレーションで得られた回答のうち、ドキュメント未記載のものは適切なドキュメントに追記する。

回答ステータスファイルに追記先を記録:
```json
{
  "answer": "JWT を使用する",
  "answeredBy": "human",
  "docUpdate": {
    "target": "design.md",
    "section": "認証方式",
    "content": "認証方式は JWT を採用する。理由: ..."
  }
}
```

### 追記先の判定基準
| 回答の種類 | 追記先 |
|-----------|--------|
| 要件・仕様に関する判断 | requirements.md |
| 技術的な設計判断 | design.md |
| プロジェクト横断の方針 | docs/einja/memory/decisions.md |
| 再利用可能なパターン | docs/einja/memory/patterns.md |

## Worker 起動コマンド（Director が実行）

```bash
# 1. タスクブランチ作成 & worktree 追加
git branch task/{N}-{X.Y} issue/{N}-phase{M}
git push -u origin task/{N}-{X.Y}
git worktree add ~/.einja/worktrees/issue-{N}/task-{X.Y} task/{N}-{X.Y}

# 2. tmux window で claude 起動
tmux new-window -t einja-{N} -n worker-{X.Y}
tmux send-keys -t einja-{N}:worker-{X.Y} 'cd ~/.einja/worktrees/issue-{N}/task-{X.Y} && claude' Enter

# 3. task-exec コマンドを実行
# claude 起動後に以下を送信:
tmux send-keys -t einja-{N}:worker-{X.Y} '/einja:task-exec #{N} {X.Y}' Enter
```

## セッションクリーンアップ

Issue完了時に以下を自動削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を実行）
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*）

## 注意事項

- 全プロセスは**対話モード**（`claude`、非 `-p`）で起動。質問エスカレーションのため
- Worker 内部のタスク並列実行は既存の task-exec フロー（Task ツール + run_in_background）をそのまま活用
- ステータスファイルの `status.json` 更新には `flock` による排他制御を使用
- 質問ファイルは1ファイル1質問のためロック不要（UUID でアトミック書き込み）
- Worker は各タスク完了毎 + PR作成前にステータスファイルをチェック（sync_required検知時は次タスク開始前にrebase）
