---
name: einja-issue-exec
description: "GitHub Issueの全タスクを並列実行するコマンド。Manager→Workerの2階層でIssueの全タスクを並列実行。tmux環境ではペイン分割で可視化、tmuxなし環境ではAskUserQuestionで実行モードを選択。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
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
Manager → Worker の2階層で GitHub Issue の全タスクを並列実行する。
各ロールの責務・ステータス遷移の詳細は issue-exec-protocol.md を参照。
本 Skill は tmux / Agent tool + git worktree を使った具体的な実行手順を定義する。

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
  1. label: "Phase 1のみ（推奨）"
     description: "Phase 1を実行し、完了後は待機モードに入る。レビュー・修正指示に対応可能"
  2. label: "特定Phaseまで"
     description: "Phase番号を指定して途中まで実行（Other欄にPhase番号を入力）。各Phase完了後に待機"
  3. label: "全Phase実行"
     description: "全Phaseを順次実行する。全完了後も待機モードに入り、レビュー指摘への修正に対応可能"

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

#### 1.5. 実行モード判定

1. `echo $TMUX` で現在 tmux セッション内かどうかを確認
2. **セッション内の場合**: `executionMode = "tmux"` → tmuxモードで実行
3. **セッション外の場合**: AskUserQuestionで確認:
   - **tmuxモードで再実行（推奨）**: 「tmuxセッション内で再実行してください。iTerm2をお使いの場合は `tmux -CC` で統合モードを推奨します（Workerがペイン分割で表示されます）」→ 停止
     - Note: Workerの進行状況がリアルタイムで見える。CLI環境向け
   - **Agent toolモードで続行**: `executionMode = "agent-tool"` で実行を続行
     - Note: Workerの可視性はないが、Desktop/VSCode等tmuxが使えない環境で利用可能
   - **逐次実行に切り替え**: `einja-task-exec` Skill で1タスクずつ実行
     - Note: 並列実行なし。最もシンプルだがタスク数が多いと時間がかかる

#### 2. ディレクトリ準備
- `~/.einja/sessions/` と `~/.einja/worktrees/` ディレクトリを確認・作成

#### 3. セッション復元
- `--resume` フラグがある場合、`~/.einja/sessions/issue-{N}/session.json` からセッション状態を復元
  - `executionMode` フィールドも復元する（未指定時は `"tmux"` をデフォルトとする）
  - Manager worktree の存在確認: `git worktree list | grep issue-{N}/manager`
    - 存在しない場合は再作成: `git worktree add ~/.einja/worktrees/issue-{N}/manager issue/{N}`
  - 未完了のPhaseのWorkerを再起動する

### Step 1: Issue パース
1. `gh issue view {issue番号} --json body,title,number` でIssue本文を取得
2. Issue本文からPhase構造をパース：
   - `### Phase N: {Phase名}` のセクションを抽出
   - 各Phase内のタスクグループ（X.Y形式）を抽出
   - タスクグループ間の依存関係を分析
3. `--max-phase` が指定されている場合、その番号以降のPhaseを除外

### Step 2: ブランチ & worktree 作成
> **注意**: `git branch` はHEADを変更しない（`git checkout -b` とは異なる）。これにより同一リポジトリで並行動作する他のClaude Codeセッションに影響を与えない。
> lock系エラー（`packed-refs.lock`, `FETCH_HEAD.lock`, `cannot lock ref`等）が発生した場合は、jitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）すること。

1. Issue ブランチ作成（冪等）:
   ```bash
   git fetch origin

   # Issue ブランチ作成（冪等）
   BRANCH="issue/{N}"
   BASE="origin/{baseBranch}"
   if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
     : # 既存ローカルブランチを再利用
   elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
     git branch "$BRANCH" "origin/$BRANCH"  # リモートからローカル作成
   else
     git branch "$BRANCH" "$BASE"  # 新規作成
   fi
   git push -u origin "$BRANCH" 2>/dev/null || true
   ```

2. Manager worktree 作成（冪等）:
   ```bash
   mkdir -p ~/.einja/worktrees/issue-{N}/

   # worktree作成（冪等）
   WORKTREE_PATH=~/.einja/worktrees/issue-{N}/manager
   WORKTREE_ABS=$(cd "$(dirname "$WORKTREE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$WORKTREE_PATH")" || echo "$WORKTREE_PATH")
   if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS"; then
     : # 既存worktreeを再利用
   else
     git worktree prune --expire now 2>/dev/null
     if [ -d "$WORKTREE_PATH" ]; then
       rm -rf "$WORKTREE_PATH"
     fi
     BRANCH="issue/{N}"
     if git worktree list --porcelain | grep -q "branch refs/heads/$BRANCH$"; then
       echo "ERROR: $BRANCH は別のworktreeで使用中" >&2
       exit 1
     fi
     git worktree add "$WORKTREE_PATH" "$BRANCH"
   fi
   ```
   - `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ

3. **以降の操作は全て Manager worktree 内から実行**（cwd: `~/.einja/worktrees/issue-{N}/manager`）

4. 各 Phase のブランチ作成（冪等）:
   ```bash
   # Phase ブランチ作成（冪等）
   BRANCH="issue/{N}-phase{M}"
   BASE="issue/{N}"
   if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
     : # 既存ローカルブランチを再利用
   elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
     git branch "$BRANCH" "origin/$BRANCH"
   else
     git branch "$BRANCH" "$BASE"
   fi
   git push -u origin "$BRANCH" 2>/dev/null || true
   ```

### Step 3: セッションファイル初期化
パス: `~/.einja/sessions/issue-{N}/`

```
session.json                    # セッション全体
phase-{M}/
  status.json                   # Phase状態
  task-{X.Y}.json               # 各タスクグループの状態
  spec-check.json              # specチェック結果（Worker起動準備時に作成）
questions/
  q-{uuid}.json                 # 質問ファイル
events.jsonl                    # イベントログ
```

session.json の初期状態:
```json
{
  "issueNumber": 123,
  "executionMode": "tmux",
  "mergeMode": "manual",
  "baseBranch": "main",
  "startedAt": "ISO8601",
  "managerPid": "PID",
  "phases": [
    { "number": 1, "name": "Phase名", "status": "pending", "branch": "issue/123-phase1" }
  ]
}
```

### Step 4: Worker起動準備

Phase の依存関係を考慮し、着手可能な Phase から Worker を起動する。
Managerは以下を直接実施する（旧Directorの責務を吸収）:

1. **spec事前一括チェック**: 詳細は issue-exec-protocol.md「spec事前一括チェック仕様」を参照。チェック結果を `phase-{M}/spec-check.json` に記録
2. **Phase内依存関係の詳細解析**: 詳細は issue-exec-protocol.md「依存関係解析仕様」を参照。解析結果を `events.jsonl` に `dependency_graph` イベントとして記録
3. **Worker起動**: 実行モードに応じた方式でWorkerを起動（Step 5参照）

### Step 5: Worker起動（モード別）

#### tmuxモード（executionMode = "tmux"）

tmuxセッションを作成し、Worker を tmux pane で起動する:

```bash
# tmuxセッション初期化（初回のみ）
# 既にtmuxセッション内にいる場合は現セッション内にペイン分割で起動、
# tmux外から実行している場合のみ新規セッションを作成する
if [ -n "$TMUX" ]; then
  EINJA_TMUX_SESSION=$(tmux display-message -p '#S')
  EINJA_TMUX_WINDOW=$(tmux display-message -p '#I')
  MANAGER_PANE=$(tmux display-message -p '#{pane_id}')
else
  EINJA_TMUX_SESSION="einja-{issue番号}"
  tmux new-session -d -s "$EINJA_TMUX_SESSION" -n manager -c ~/.einja/worktrees/issue-{N}/manager
  EINJA_TMUX_WINDOW="0"
  MANAGER_PANE="%0"
fi

# タスクブランチ作成（冪等）
BRANCH="task/{N}-{X.Y}"
BASE="issue/{N}-phase{M}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true

# worktree作成（冪等）
WORKTREE_PATH=~/.einja/worktrees/issue-{N}/task-{X.Y}
WORKTREE_ABS=$(cd "$(dirname "$WORKTREE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$WORKTREE_PATH")" || echo "$WORKTREE_PATH")
if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS"; then
  : # 既存worktreeを再利用
else
  git worktree prune --expire now 2>/dev/null
  if [ -d "$WORKTREE_PATH" ]; then
    rm -rf "$WORKTREE_PATH"
  fi
  if git worktree list --porcelain | grep -q "branch refs/heads/$BRANCH$"; then
    echo "ERROR: $BRANCH は別のworktreeで使用中" >&2
    exit 1
  fi
  git worktree add "$WORKTREE_PATH" "$BRANCH"
fi

# tmux pane で claude 起動（$EINJA_TMUX_SESSION, $EINJA_TMUX_WINDOW は Step 5 冒頭で設定済み）
# 現在のウィンドウを水平分割してWorkerペインを作成
WORKER_PANE=$(tmux split-window -t "$EINJA_TMUX_SESSION:$EINJA_TMUX_WINDOW" -h -c ~/.einja/worktrees/issue-{N}/task-{X.Y} -P -F '#{pane_id}')
# ManagerペインIDを環境変数としてWorkerに渡す（完了通知用）
tmux send-keys -t "$WORKER_PANE" "export EINJA_MANAGER_PANE=$MANAGER_PANE" Enter
# Worker識別用環境変数をセット（AUQ検知・セッション管理で使用）
tmux send-keys -t "$WORKER_PANE" "export EINJA_AGENT_ROLE=worker" Enter
tmux send-keys -t "$WORKER_PANE" "export EINJA_SESSION_ID=issue-{N}" Enter
tmux send-keys -t "$WORKER_PANE" 'claude --dangerously-skip-permissions' Enter

# claude起動完了を待つ（最大30秒、pane内のClaude Code起動メッセージを検知）
started=0
for i in $(seq 1 30); do
  pane_out=$(tmux capture-pane -t "$WORKER_PANE" -p -S -5 2>/dev/null)
  if echo "$pane_out" | grep -qE "(Type your prompt|claude-code|╭|❯)"; then
    started=1
    break
  fi
  sleep 1
done
if [ "$started" -eq 0 ]; then
  echo "[WARN] Claude Code startup not detected, additional wait (worker={X.Y})" >&2
  sleep 3
fi

# 権限モード検証（dangerously-skip-permissions が有効になっているか確認）
# 起動コマンド自体（claude --dangerously-skip-permissions）にもマッチするよう -S -50 で範囲拡大
SESSION_DIR=~/.einja/sessions/issue-{N}
mkdir -p "$SESSION_DIR/signals"
pane_out=$(tmux capture-pane -t "$WORKER_PANE" -p -S -50 2>/dev/null)
if ! echo "$pane_out" | grep -qiE "(dangerously-skip-permissions|--dangerously-skip|bypass permissions|bypass-permissions|auto-accept|accept edits)"; then
  echo "[WARN] Worker may not have permissions bypassed (worker={X.Y})" >&2
  touch "$SESSION_DIR/signals/permission-warning-{X.Y}.signal"
fi

# einja-task-exec Skill を実行
tmux send-keys -t "$WORKER_PANE" '/einja-task-exec #{N} {X.Y}' Enter
```

> **Worker完了通知**: einja-task-exec Skillはステータスファイル更新後に `touch ~/.einja/sessions/issue-{N}/signals/worker-{X.Y}.signal` でManagerの待機ループをトリガーする。これによりManagerは最大2秒以内に完了を検知する。

#### Agent toolモード（executionMode = "agent-tool"）

Agent tool（`isolation: "worktree"`）でWorkerを起動する:

1. **ブランチ事前作成**: Managerが Agent tool 起動**前に**明示的にブランチを作成する
   ```bash
   # タスクブランチ作成（冪等）
   BRANCH="task/{N}-{X.Y}"
   BASE="issue/{N}-phase{M}"
   if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
     : # 既存ローカルブランチを再利用
   elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
     git branch "$BRANCH" "origin/$BRANCH"  # リモートからローカル作成
   else
     git branch "$BRANCH" "$BASE"  # 新規作成
   fi
   git push -u origin "$BRANCH" 2>/dev/null || true
   ```
2. **Agent tool 起動**: 1メッセージ内で複数Agent toolを呼び出し、並列実行する
   - `isolation: "worktree"` でworktree自動作成
   - プロンプトに `/einja-task-exec #{N} {X.Y}` を含める
3. **並列度上限**: `poolSize = min(同一Layer内タスクグループ数, 5)`

> **注意**: lock系エラー（`packed-refs.lock`, `FETCH_HEAD.lock`, `cannot lock ref`等）が発生した場合は、jitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）すること。

### Step 6: 監視ループ

#### tmuxモード

Manager は以下を監視:

1. **ステータスファイル監視**（シグナルファイル方式）:
   - Managerは以下のBashコマンドで**シグナルファイルの出現を待機**する:
     ```bash
     # 最大120秒待機、2秒間隔でチェック。シグナルが出現したら収集して返る
     SIGNAL_DIR=~/.einja/sessions/issue-{N}/signals
     mkdir -p "$SIGNAL_DIR"
     SIGNALS=""
     for i in $(seq 1 60); do
       FOUND=$(ls "$SIGNAL_DIR"/*.signal 2>/dev/null)
       if [ -n "$FOUND" ]; then
         # 見つかったシグナルを全て収集（複数Worker同時完了対応）
         # シグナルは起床トリガーのため、収集と同時に即時削除する
         SIGNALS="$FOUND"
         for sig in $FOUND; do
           rm -f "$sig"
         done
         break
       fi
       sleep 2
     done
     echo "$SIGNALS"
     ```
   - **Worker側**: ステータスファイル更新後にシグナルファイルを作成する:
     ```bash
     # ステータスファイル更新を先に行い、シグナルは最後に作成する
     # シグナルファイル名にWorker IDを含めることで複数Worker対応
     touch ~/.einja/sessions/issue-{N}/signals/worker-{X.Y}.signal
     ```
   - これにより、Workerが完了すると**最大2秒以内**にManagerが検知する
   - Managerはシグナル受信後、**全Workerのステータスファイルを走査**してゲートチェック実施
   - 質問ファイルの pending 状態も同様にシグナルファイルで通知（`question-{UUID}.signal`）
   - **シグナルファイルはあくまで「起床トリガー」**。完了の判定はステータスファイルで行う

   **AskUserQuestion 検知（タイムアウトフォールバック時に実行）:**

   120秒のシグナル待機がタイムアウトした場合（`$SIGNALS` が空）、各 Worker pane の最新出力を走査して AskUserQuestion のプロンプトを検出する:

   ```bash
   # タイムアウト時: 全アクティブ Worker pane を走査して AUQ を検知
   if [ -z "$SIGNALS" ]; then
     # 現時点でアクティブな Worker pane を動的に取得（Manager pane は除外）
     ACTIVE_WORKER_PANES=$(tmux list-panes -t "$EINJA_TMUX_SESSION:$EINJA_TMUX_WINDOW" -F '#{pane_id}' 2>/dev/null | grep -vFx "$MANAGER_PANE" | tr '\n' ' ')
     for WORKER_PANE in $ACTIVE_WORKER_PANES; do
       AUQ_OUTPUT=$(tmux capture-pane -t "$WORKER_PANE" -p -S -20 2>/dev/null)

       # AUQ パターン検出: 選択肢番号表示、質問文末尾の "?"、"Select an option" 等
       if echo "$AUQ_OUTPUT" | grep -qE '(^[[:space:]]*[0-9]+\)|Select an option|Pick one|Other \(|その他（)'; then
         # 質問内容を抽出（最新20行から質問ブロックを取得）
         AUQ_QUESTION=$(echo "$AUQ_OUTPUT" | tail -20)

         # Manager/Director がコンテキストから自力回答を試みる
         # → 回答可能な場合: tmux send-keys で回答番号を送信
         # → 回答不可の場合: AskUserQuestion でユーザーに転送
         #
         # 判定基準:
         #   - spec/design.md に明記された仕様に基づく質問 → 自力回答
         #   - session.json の設定値で決まる質問 → 自力回答
         #   - ビジネス判断・要件判断が必要な質問 → ユーザーに転送
         #
         # 自力回答の場合:
         #   tmux send-keys -t "$WORKER_PANE" "{回答番号}" Enter
         #
         # ユーザー転送の場合:
         #   AskUserQuestion で質問内容を提示し、回答を取得後:
         #   tmux send-keys -t "$WORKER_PANE" "{ユーザーの回答}" Enter

         break  # 1つ検出したら処理（次ループで残りを処理）
       fi
     done
   fi
   ```

   **AUQ 検知の詳細フロー:**
   1. `tmux capture-pane -t "$WORKER_PANE" -p -S -20` で各 Worker pane の最新20行を取得
   2. AUQ パターンマッチング:
      - 選択肢番号表示: `1)`, `2)`, `3)` 等の行頭パターン
      - 質問文: `?` で終わる文
      - Claude Code 固有パターン: `Select an option`, `Pick one`, `Other (`
   3. 検出した場合の処理分岐:
      a. **Manager が自力回答可能な場合**: セッションコンテキスト（spec、design.md、session.json）を参照して回答を決定し、`tmux send-keys -t "$WORKER_PANE" "{回答番号}" Enter` で Worker pane に送信
      b. **自力回答不可の場合**: `AskUserQuestion` でユーザーに質問を転送（Worker ID・質問内容を含める）。ユーザーの回答を受け取り次第、`tmux send-keys -t "$WORKER_PANE" "{ユーザーの回答}" Enter` で Worker pane に送信
   4. Worker は回答を受け取り自動的に作業を再開する

2. **Worker完了後のゲートチェック**: 詳細は issue-exec-protocol.md「ゲートチェック仕様」を参照。ゲート通過後はマージモードに応じた**タスクPRマージ処理**（タスクPRはWorker側のeinja-task-exec Step 7.5で作成済み。ManagerはタスクPRを自ら作成しない） → **Issue説明文のチェックボックス更新**（protocol.md「2.3 completed 遷移時の必須アクション」参照）→ 他active Workerにsync通知。**Worker pane・worktreeはPhase完了まで維持する**（修正指示に備えるため）

3. **質問エスカレーション処理（tmux Worker質問転送フロー — モード1）**:

   tmuxモードのWorkerは AskUserQuestion を直接使えないため、ファイルベースで質問をManagerに転送する。

   **Worker側の手順**（einja-task-exec実行中にPENDING_QUESTIONSが発生した場合）:
   ```bash
   # 1. 質問ファイル書込み
   QUESTION_ID=$(uuidgen)
   QUESTION_DIR=~/.einja/sessions/issue-{N}/questions
   mkdir -p "$QUESTION_DIR"
   cat > "$QUESTION_DIR/q-${QUESTION_ID}.json" <<EOF
   {
     "id": "q-${QUESTION_ID}",
     "from": "worker-{X.Y}",
     "question": "...",
     "context": "...",
     "options": [{"label": "...", "description": "..."}],
     "status": "pending",
     "answer": null,
     "answeredBy": null
   }
   EOF

   # 2. シグナルファイル作成（Managerの起床トリガー）
   SIGNAL_DIR=~/.einja/sessions/issue-{N}/signals
   mkdir -p "$SIGNAL_DIR"
   touch "$SIGNAL_DIR/question-${QUESTION_ID}.signal"

   # 3. 回答待ちループ（15秒間隔、最大30分=120回）
   for i in $(seq 1 120); do
     STATUS=$(jq -r '.status' "$QUESTION_DIR/q-${QUESTION_ID}.json" 2>/dev/null)
     if [ "$STATUS" = "answered" ]; then
       ANSWER=$(jq -r '.answer' "$QUESTION_DIR/q-${QUESTION_ID}.json")
       echo "$ANSWER"  # 後続処理で使用
       break
     fi
     sleep 15
   done
   # タイムアウト時はタスクをfailed扱いで停止
   ```

   **Manager側の手順**:
   1. シグナル待機ループで `question-{UUID}.signal` を検知（通常の `worker-*.signal` と同じディレクトリ）
   2. 対応する `q-{UUID}.json` を読み込み、質問内容を解析
   3. **自力回答可否を判定**:
      - spec/design.md・session.json・既存設定から判定可能 → 自力で回答
      - ビジネス判断・要件判断が必要 → AskUserQuestion でユーザーに転送
   4. 回答を質問ファイルに書き込み:
      ```bash
      jq --arg ans "$USER_ANSWER" \
         --arg by "${ANSWERED_BY:-manager|human}" \
         '.status="answered" | .answer=$ans | .answeredBy=$by' \
         "$QUESTION_DIR/q-${QUESTION_ID}.json" > "$QUESTION_DIR/q-${QUESTION_ID}.json.tmp"
      mv "$QUESTION_DIR/q-${QUESTION_ID}.json.tmp" "$QUESTION_DIR/q-${QUESTION_ID}.json"
      ```
   5. Worker は回答書込みを次のポーリングサイクル（最大15秒以内）で検知して作業再開
   6. 回答内容のドキュメント還元先判定は issue-exec-protocol.md「質問エスカレーション意味論」を参照

   **タイムアウト処理**:
   - Worker側: 30分（120回×15秒）経過しても answered にならない場合、タスクを failed 扱いで停止し、`task-{X.Y}.json` に `failureReason: "question_timeout"` を記録
   - Manager側: ユーザーがAskUserQuestionを長時間放置した場合の救済として、Worker再起動時に同じ質問IDを引き継いで再ポーリング可能（質問ファイルが残っていれば answered を検知できる）

4. **Phase 完了処理**:
   - Phase完了条件（issue-exec-protocol.md参照）を満たしたら:
   - Phase PR 作成: `/einja-create-pr --auto --base issue/{N}`
   - マージモードに応じた処理（manual: 待機、auto: 自動マージ）
   - 他 active Phase への変更伝播通知

5. **PHASE_ESCALATE チェック**（Phase完了後の追加チェック）:
   - Phase内の全 `task-{X.Y}.json` を走査し、`status == "phase_escalated"` のタスクが存在するか確認する
   - 存在する場合、Worker レベルの fix_required とは独立した Manager レベルのエスカレーション処理を実施する:

   ```
   // PHASE_ESCALATE: 個別タスク修正では対応できない根本問題

   AskUserQuestion で以下を提示:
   「Phase {N} でフェーズ全体に影響する根本問題が検出されました。

   根本原因: [phase-reviewerの根本原因レポート（task-{X.Y}.json の escalationReason フィールドから取得）]
   影響範囲: [phase_escalated となったタスクグループ一覧]

   どう対応しますか？

   a) spec-createフェーズに戻って仕様を修正する（ui-design-url.mdも更新）
      Note: 仕様レベルの根本問題がある場合。要件定義・設計からやり直す
   b) Figma（ui-design-url.md）を更新してから当Phaseを再実装する
      Note: UIデザイン・設計は合っているが、デザイン成果物の更新が必要な場合
   c) 前Phaseの成果物を修正してから当Phaseを再実装する
      Note: 前Phaseの実装品質や設計が原因の場合。当Phaseのブランチをリセットして再実装
   d) この問題を次Phase以降で対応する（リスクあり）
      Note: 影響が限定的でフェーズを跨いで対処可能な場合。known issueとして記録して進行する
   e) その他（自由入力）
      Note: 上記に当てはまらない場合
   」

   ユーザーの選択に応じた処理:
   - a/b/c の場合:
     - PR が未作成ならば当 Phase のブランチを `git reset --hard` でリセット（ブランチごと破棄はしない）
     - PR が作成済みならばクローズして、ブランチを再起点（Phase の base ブランチ）まで巻き戻し
     - セッションファイル（`phase-{M}/status.json`, `phase-{M}/task-{X.Y}.json`）を pending 状態にリセット
     - 指定されたフェーズでの作業をユーザーが完了させ次第、当 Phase を再実行する
   - d の場合:
     - `phase-{M}/status.json` に `knownIssues` フィールドを追記してエスカレーション詳細を記録
     - CONDITIONAL ステータスとして次 Phase に進む
   - e の場合:
     - ユーザーの自由入力指示に従って処理する
   ```

   > **注意**: PHASE_ESCALATE は issue-exec-protocol.md の状態機械（approved / fix_required / rejected）とは独立した Manager レベルの処理である。Worker の fix_required サイクルを超えた根本問題に対応するためのエスカレーションであり、既存のゲートチェックフローを上書きしない。

6. **Worker 消失検知**（30秒間隔）:
   - Worker の tmux pane が消失した場合のリカバリ処理（`tmux display-message -t "$WORKER_PANE" -p '#P' 2>/dev/null` で存在確認）
   - Worker のステータスを確認 → 未完了 Worker のみ再実行
   - リトライポリシー（fixCount / retryCount の上限、エスカレーション条件）は issue-exec-protocol.md を参照

#### Agent toolモード

Agent tool は完了時に結果を返すため、ポーリング不要:

1. **完了検知**: Agent tool 戻り値からWorker結果を取得
   - 成功: ゲートチェック実施（tmuxモードと同じ）
   - 失敗: Agent tool エラー応答 → Managerがリトライ判定（上限はprotocol.mdに従う）
   - 質問: PENDING_QUESTIONS が戻り値に含まれる → Managerが処理

2. **Worker完了後のゲートチェック**: tmuxモードと同じ

3. **Phase 完了処理**: tmuxモードと同じ

4. **リトライ**: Agent tool 再呼び出しで再起動

### Step 7: Phase完了 → 待機モード

指定Phaseの実行が完了したら、**セッションを維持したまま待機モード**に入る:

1. Phase PR作成（未作成の場合）: `/einja-create-pr --auto --base issue/{N}`
2. 完了報告をユーザーに表示:
   - 完了したPhase番号、作成されたPR一覧
   - 残りのPhase（ある場合）
3. **AskUserQuestion で次のアクションを確認**:
   - **次のPhaseを実行**: 次のPhaseの実行を開始
     - Note: 現在のPhaseがマージ済みであることを確認してから開始
   - **修正を実施**: レビュー指摘やテスト結果に基づく修正を実行
     - Note: 修正対象のPR番号・指摘内容を入力。該当Workerを再起動して修正
   - **セッションを終了**: worktree・セッションファイルをクリーンアップして終了
     - Note: 後で `--resume` で再開も可能
   - **その他（自由入力）**: 追加指示を入力

### Step 8: 全Phase完了 → 最終PR・待機

全Phaseが完了した場合:
1. 最終PR作成: `/einja-create-pr --auto --base {baseBranch}` を実行
2. PR URL を表示
3. **セッションを維持したまま待機モード**に入る（クリーンアップしない）
4. **AskUserQuestion で次のアクションを確認**:
   - **修正を実施**: マージ後のレビュー指摘・テスト失敗への修正
     - Note: 修正対象のPR番号・指摘内容を入力
   - **セッションを終了**: クリーンアップして完全終了
   - **その他（自由入力）**: 追加指示を入力

## マージモード詳細

各モード（manual / task-group-auto / auto）の動作テーブルは issue-exec-protocol.md「マージモード仕様」を参照。

## ブランチ構成

```
{baseBranch}
 └── issue/{N}                        Manager worktree
      ├── issue/{N}-phase1             Phase1ブランチ（worktreeなし）
      │    ├── task/{N}-1.1            Worker1.1 worktree
      │    ├── task/{N}-1.2            Worker1.2 worktree
      │    └── task/{N}-1.3            Worker1.3 worktree
      └── issue/{N}-phase2             Phase2ブランチ（worktreeなし）
           └── task/{N}-2.1            Worker2.1 worktree
```

## worktree 物理パス
```
~/.einja/worktrees/issue-{N}/
├── manager/                      ← Manager cwd
├── task-{X.Y}/                   ← Worker cwd（tmuxモード）
```
> Agent toolモードでは `isolation: "worktree"` により自動作成されるため、パスはAgent tool管理。

## ステータスファイル詳細

### session.json
```json
{
  "issueNumber": 123,
  "executionMode": "tmux",
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
  "managerPid": "12345",
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
{"timestamp":"2025-01-01T00:01:00Z","pid":"12346","event_type":"worker_started","data":{"phase":1,"taskId":"1.1"}}
```

## エラーリカバリ

リトライポリシー（fixCount / retryCount の上限、エスカレーション条件）とCI待機タイムアウトの詳細は issue-exec-protocol.md を参照。

以下は tmux/worktree 固有の検知・リカバリ手順:

| 障害 | 検知方法 | リカバリ |
|---|---|---|
| Worker異常終了（PR作成前・tmux） | tmux pane消失 + ステータス未更新 | Managerが自力リトライ → 上限超過時はユーザーにエスカレーション |
| Worker異常終了（PR作成前・Agent tool） | Agent tool エラー応答 | Managerがリトライ判定 → 上限超過時はユーザーにエスカレーション |
| Worker異常終了（PR作成済み） | tmux pane消失 or Agent tool エラー + PRあり | スキップ（PRマージ待ち継続） |
| Worker異常終了（修正中・tmux） | tmux pane消失 + status=awaiting_review + directorVerdict=fix_required | Managerが自力リトライ（fixCount引き継ぎ）→ 上限超過時はユーザーにエスカレーション |
| Worker異常終了（修正中・Agent tool） | Agent tool エラー応答 + directorVerdict=fix_required | Managerが再起動（fixCount引き継ぎ）→ 上限超過時はユーザーにエスカレーション |
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

## Worker 起動コマンド（Manager が実行）

tmuxモードの場合の起動手順。詳細は Step 5 を参照。

```bash
# 1. タスクブランチ作成 & worktree 追加（冪等パターン）
# ※ git branch はHEADを変更しない。lock系エラー発生時はjitter付き1〜2秒待機 → 再試行（最大3回）
BRANCH="task/{N}-{X.Y}"
BASE="issue/{N}-phase{M}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true

WORKTREE_PATH=~/.einja/worktrees/issue-{N}/task-{X.Y}
WORKTREE_ABS=$(cd "$(dirname "$WORKTREE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$WORKTREE_PATH")" || echo "$WORKTREE_PATH")
if git worktree list --porcelain | grep -qFx "worktree $WORKTREE_ABS"; then
  : # 既存worktreeを再利用
else
  git worktree prune --expire now 2>/dev/null
  if [ -d "$WORKTREE_PATH" ]; then
    rm -rf "$WORKTREE_PATH"
  fi
  if git worktree list --porcelain | grep -q "branch refs/heads/$BRANCH$"; then
    echo "ERROR: $BRANCH は別のworktreeで使用中" >&2
    exit 1
  fi
  git worktree add "$WORKTREE_PATH" "$BRANCH"
fi

# 2. tmux pane で claude 起動（$EINJA_TMUX_SESSION, $EINJA_TMUX_WINDOW は Step 5 冒頭で設定済み）
WORKER_PANE=$(tmux split-window -t "$EINJA_TMUX_SESSION:$EINJA_TMUX_WINDOW" -h -c ~/.einja/worktrees/issue-{N}/task-{X.Y} -P -F '#{pane_id}')
# Worker識別用環境変数をセット（AUQ検知・セッション管理で使用）
tmux send-keys -t "$WORKER_PANE" "export EINJA_AGENT_ROLE=worker" Enter
tmux send-keys -t "$WORKER_PANE" "export EINJA_SESSION_ID=issue-{N}" Enter
tmux send-keys -t "$WORKER_PANE" 'claude --dangerously-skip-permissions' Enter

# claude起動完了を待つ（最大30秒、pane内のClaude Code起動メッセージを検知）
started=0
for i in $(seq 1 30); do
  pane_out=$(tmux capture-pane -t "$WORKER_PANE" -p -S -5 2>/dev/null)
  if echo "$pane_out" | grep -qE "(Type your prompt|claude-code|╭|❯)"; then
    started=1
    break
  fi
  sleep 1
done
if [ "$started" -eq 0 ]; then
  echo "[WARN] Claude Code startup not detected, additional wait" >&2
  sleep 3
fi

# 3. einja-task-exec Skill を実行
# claude 起動後に以下を送信:
tmux send-keys -t "$WORKER_PANE" '/einja-task-exec #{N} {X.Y}' Enter
```

## セッションクリーンアップ

**ユーザーが明示的に「セッションを終了」を選択した場合のみ実行する。** Phase完了・全Phase完了時には自動クリーンアップしない。

以下を削除:
- `~/.einja/sessions/issue-{N}/` （セッションファイル）
- `~/.einja/worktrees/issue-{N}/` （worktree。事前に `git worktree remove` を各ディレクトリに対して実行）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/task-{X.Y}`（Worker）
  - `git worktree remove ~/.einja/worktrees/issue-{N}/manager`（Manager - 最後に削除）
- ローカルブランチのクリーンアップ（task/*, issue/*-phase*）

## 注意事項

- 全プロセスは**対話モード**（`claude --dangerously-skip-permissions`、非 `-p`）で起動。質問エスカレーションのため。`--dangerously-skip-permissions` を使用するため、Workerプロセスは確認プロンプトなしで全ツールを実行する。CLAUDE.mdのgit安全ルールへの準拠はプロンプト指示に依存する
- Worker 内部のタスク並列実行は既存の einja-task-exec Skill フロー（Task ツール + run_in_background）をそのまま活用
- ステータスファイルの `status.json` 更新には `flock` による排他制御を使用
- 質問ファイルは1ファイル1質問のためロック不要（UUID でアトミック書き込み）
- Worker は各タスク完了毎 + PR作成前にステータスファイルをチェック（sync_required検知時は次タスク開始前にrebase）
