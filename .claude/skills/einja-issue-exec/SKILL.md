---
name: einja-issue-exec
description: "GitHub Issueの全タスクを階層的に並列実行するコマンド。Manager→Director→Workerの3階層でtmux+worktreeを使用。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
user-invocable: true
allowed-tools:
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - TaskOutput
  - Skill
  - Read
  - Write
  - Edit
  - MultiEdit
  - Bash
  - Grep
  - Glob
  - WebFetch
  - AskUserQuestion
  - mcp__github__*
---

# Issue 実行コマンド（Manager）

## 共通プロトコル参照

共通ルール（ステータス遷移、ゲートチェック、リトライ、マージモード等）は以下を参照:
- [Issue実行共通プロトコル](../../../docs/einja/instructions/issue-exec-protocol.md)
- [ブランチ運用戦略](../../../docs/einja/steering/branch-strategy.md)
- [タスク管理ガイドライン](../../../docs/einja/steering/task-management.md)

## 役割
Manager → Director → Worker の3階層で GitHub Issue の全タスクを並列実行する。
各ロールの責務・ステータス遷移の詳細は issue-exec-protocol.md を参照。
本 Skill は tmux セッション + git worktree を使った具体的な実行手順を定義する。

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
3. **未インストールの場合**: OS を判定し自動インストールする

**macOS（`uname -s` = `Darwin`）:**
- `brew install tmux` を実行（Homebrew がない場合は「Homebrew をインストールしてから再実行してください」と表示して**停止**）

**Linux（`uname -s` = `Linux`）:**
- パッケージマネージャーを検出し自動インストール:
  - `command -v apt-get` → `sudo apt-get update && sudo apt-get install -y tmux`
  - `command -v dnf` → `sudo dnf install -y tmux`
  - `command -v yum` → `sudo yum install -y tmux`
  - いずれもない場合 → 「手動で tmux をインストールしてください」と表示して**停止**

**その他（Windows等）:**
- 「issue-exec は tmux を必須としており、この環境では利用できません。WSL2 環境での実行を推奨します。代替: `einja-task-exec` Skill で逐次実行可能」と表示して**停止**

**インストール後の検証:**
- `hash -r && command -v tmux && tmux -V` で成功確認
- 失敗した場合 → シェル再起動を案内して**停止**

#### 1.5. tmux セッション確認

1. `echo $TMUX` で現在 tmux セッション内かどうかを確認
2. **セッション内の場合**: そのまま次のステップへ進む
3. **セッション外の場合**: 以下を表示して**停止**:
   > issue-exec は tmux セッション内で実行する必要があります。
   > 現在の Claude Code を終了し、以下の手順で再起動してください:
   >
   > 1. この Claude Code セッションを終了（`/exit` または Ctrl+C）
   > 2. tmux セッションを起動:
   >    ```
   >    tmux new-session -s einja
   >    ```
   > 3. tmux 内で Claude Code を再起動し、issue-exec を再実行:
   >    ```
   >    claude
   >    ```
   >
   > 既存の tmux セッションがある場合:
   > ```
   > tmux attach-session -t einja
   > ```

#### 2. ディレクトリ準備
- `~/.einja/sessions/` と `~/.einja/worktrees/` ディレクトリを確認・作成

#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - Manager worktree の存在確認: `git worktree list | grep issue-{N}/manager`
    - 存在しない場合は再作成: `git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}`
  - 未完了のPhaseのDirectorを再起動する

### Step 1: Issue パース
1. `gh issue view {issue番号} --json body,title,number` でIssue本文を取得
2. Issue本文からPhase構造をパース：
   - `### Phase N: {Phase名}` のセクションを抽出
   - 各Phase内のタスクグループ（X.Y形式）を抽出
   - タスクグループ間の依存関係を分析
3. `--max-phase` が指定されている場合、その番号以降のPhaseを除外

### Step 2: ブランチ & worktree 作成
1. Issue ブランチ作成（メインリポジトリから）: `issue/{issue番号}`（base ブランチから）
> **注意**: `git branch` はHEADを変更しない（`git checkout -b` とは異なる）。これにより同一リポジトリで並行動作する他のClaude Codeセッションに影響を与えない。
> lock系エラー（`packed-refs.lock`, `FETCH_HEAD.lock`, `cannot lock ref`等）が発生した場合は、jitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）すること。
2. Manager worktree 作成（メインリポジトリから）:
   ```bash
   mkdir -p ~/.einja/worktrees/issue-{N}/
   git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}
   git push -u origin issue/{N}
   ```
   - `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ
3. **以降の操作は全て Manager worktree 内から実行**（cwd: `~/.einja/worktrees/issue-{N}/manager`）
4. 各 Phase のブランチ作成（Manager worktree から）: `issue/{issue番号}-phase{N}`（issue ブランチから）
5. Phase worktree 作成（Manager worktree から）:
   ```bash
   git worktree add ~/.einja/worktrees/issue-{N}/phase{M} issue/{N}-phase{M}
   git push -u origin issue/{N}-phase{M}
   ```
   - `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ

### Step 3: セッションファイル初期化
パス: `~/.einja/sessions/issue-{N}/`

```
session.json                    # セッション全体
phase-{M}/
  status.json                   # Phase状態
  task-{X.Y}.json               # 各タスクグループの状態
  spec-check.json              # specチェック結果（Director起動時に作成）
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
tmux new-session -d -s einja-{issue番号} -n manager -c ~/.einja/worktrees/issue-{N}/manager
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
0. **spec事前一括チェック**: 詳細は issue-exec-protocol.md「spec事前一括チェック仕様」を参照。チェック結果を `phase-{M}/spec-check.json` に記録
1. **Phase内依存関係の詳細解析**: 詳細は issue-exec-protocol.md「依存関係解析仕様」を参照。解析結果を `events.jsonl` に `dependency_graph` イベントとして記録
2. 各Worker には tmux window + claude 対話モードで起動:
   - worktree作成: git worktree add ~/.einja/worktrees/issue-{N}/task-{X.Y} task/{N}-{X.Y}
   - tmux: tmux new-window + claude 起動 + einja-task-exec Skill で #{N} {X.Y} を実行
3. **Worker完了後の成果物ゲートチェック**: 詳細は issue-exec-protocol.md「ゲートチェック仕様」を参照。ゲート通過後はマージモードに応じたPR処理 → 他active Workerにsync通知 → 完了したworktree削除
4. Phase完了時: `/einja-create-pr --auto --base issue/{N}` でPhase PRを作成
5. 質問対応: Workerからの質問にspec/design/issueベースで回答。回答不可ならManagerにエスカレーション
6. Phase完了時: ステータスファイルで Manager に報告
7. GitHub Issue のチェックボックス更新
8. **Worker異常終了のリトライ**: 15秒間隔の監視ループでWorker状態を確認（リトライポリシーの詳細は issue-exec-protocol.md を参照）
   - `tmux list-windows` でworker window存在確認 + ステータスファイル確認
   - window消失 + status=in_progress（PRなし）→ 異常終了、リトライ
   - `task-{X.Y}.json` に `retryCount`, `lastRetryAt`, `failureReason` フィールドを使用

## 質問エスカレーション
回答不可な質問は ~/.einja/sessions/issue-{N}/questions/ にJSONファイルを作成してManagerに通知してください。
質問の意味論とエスカレーション基準の詳細は issue-exec-protocol.md を参照。
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

4. **Director 消失検知**（30秒間隔）:
   - Director の tmux window が消失した場合のリカバリ処理
   - 各 Worker のステータスを確認 → 未完了 Worker のみ再実行
   - **注意**: Worker消失はDirectorが検知・リトライする（二重検知回避のためManagerはWorkerを直接監視しない）

### Step 7: 全Phase完了 → 最終PR
1. 最終PR作成: `/einja-create-pr --auto --base {baseBranch}` を実行
   - changeset自動生成 + ラベル付与 + PR作成が一括実行される
2. PR URL を表示
3. セッションクリーンアップ（worktree 削除、セッションファイル削除）

## マージモード詳細

各モード（manual / task-group-auto / auto）の動作テーブルは issue-exec-protocol.md「マージモード仕様」を参照。

## ブランチ構成

```
{baseBranch}
 └── issue/{N}                        Manager worktree
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
├── manager/                      ← Manager cwd
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
  "completedAt": "2025-01-01T01:00:00Z",
  "retryCount": 0,
  "lastRetryAt": null,
  "failureReason": null,
  "directorVerdict": "approved",
  "fixInstructions": null,
  "fixCount": 0,
  "gateResult": {
    "fastGate": "passed",
    "riskGate": "skipped",
    "checkedAt": "2025-01-01T00:55:00Z"
  }
}
```

### phase-{M}/spec-check.json
```json
{
  "checkedAt": "2025-01-01T00:00:00Z",
  "taskGroups": {
    "1.1": { "result": "full", "specPath": "docs/specs/issues/auth/issue123-login/" },
    "1.2": { "result": "partial", "missing": ["design.md"], "escalated": true },
    "1.3": { "result": "none", "fallback": "general-context-loader" }
  },
  "summary": { "full": 1, "partial": 1, "none": 1 }
}
```

result の値:
- `full`: 完全spec（requirements.md + design.md + qa-tests/）
- `partial`: 部分的spec → Managerにエスカレーション
- `none`: specなし → Worker内で `_einja-general-context-loader` にフォールバック

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

リトライポリシー（fixCount / retryCount の上限、エスカレーション条件）とCI待機タイムアウトの詳細は issue-exec-protocol.md を参照。

以下は tmux/worktree 固有の検知・リカバリ手順:

| 障害 | 検知方法（tmux固有） | リカバリ |
|---|---|---|
| Worker異常終了（PR作成前） | tmux window消失 + ステータス未更新 | Directorが自力リトライ → 上限超過時はManagerにエスカレーション |
| Worker異常終了（PR作成済み） | tmux window消失 + PRあり | スキップ（PRマージ待ち継続） |
| Worker異常終了（修正中） | tmux window消失 + status=awaiting_review + directorVerdict=fix_required | Directorが自力リトライ（fixCount引き継ぎ）→ 上限超過時はManagerにエスカレーション |
| Director異常終了 | tmux window消失 + ステータス未更新 | 各Workerのステータスを確認 → 未完了Workerのみ再実行 |
| Manager異常終了 | ユーザー手動 | `--resume` でセッション復元 |
| rebaseコンフリクト | git rebase失敗 | einja-conflict-resolver Skillで自力解消 |
| CI失敗 | gh run status | 修正 → 再push → 再CI待機 |

## 質問回答のドキュメント還元
質問エスカレーションで得られた回答のうち、ドキュメント未記載のものは適切なドキュメントに追記する。
追記先の判定基準（還元先テーブル）は issue-exec-protocol.md「質問エスカレーション意味論・ドキュメント還元先」を参照。

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

## Worker 起動コマンド（Director が実行）

```bash
# 1. タスクブランチ作成 & worktree 追加（git branch はHEADを変更しない）
git branch task/{N}-{X.Y} issue/{N}-phase{M} 2>/dev/null || true  # 冪等: 既存ならスキップ
git push -u origin task/{N}-{X.Y} 2>/dev/null || true
git worktree add ~/.einja/worktrees/issue-{N}/task-{X.Y} task/{N}-{X.Y}
# ※ `|| true` は「branch already exists」エラーの冪等ガード。
#    認証失敗・ネットワーク障害等の致命エラーは別途検出・abortすること
# ※ lock系エラー発生時はjitter付き1〜2秒待機 → 再試行（最大3回）

# 2. tmux window で claude 起動
tmux new-window -t einja-{N} -n worker-{X.Y}
tmux send-keys -t einja-{N}:worker-{X.Y} 'cd ~/.einja/worktrees/issue-{N}/task-{X.Y} && claude' Enter

# 3. einja-task-exec Skill を実行
# claude 起動後に以下を送信:
tmux send-keys -t einja-{N}:worker-{X.Y} '/einja-task-exec #{N} {X.Y}' Enter
```

## セッションクリーンアップ

Issue完了時に以下を自動削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を各ディレクトリに対して実行）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/task-{X.Y}`（Worker）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/phase{M}`（Director）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/manager`（Manager - 最後に削除）
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*）

## 注意事項

- 全プロセスは**対話モード**（`claude`、非 `-p`）で起動。質問エスカレーションのため
- Worker 内部のタスク並列実行は既存の einja-task-exec Skill フロー（Task ツール + run_in_background）をそのまま活用
- ステータスファイルの `status.json` 更新には `flock` による排他制御を使用
- 質問ファイルは1ファイル1質問のためロック不要（UUID でアトミック書き込み）
- Worker は各タスク完了毎 + PR作成前にステータスファイルをチェック（sync_required検知時は次タスク開始前にrebase）
