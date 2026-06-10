---
name: einja-team-exec
description: "Agent Teamsによるチーム並列実行を行うSkill。ユーザーが「チームで」「Teamで」「Agent Teamsで」「並列チームで」等と明示的にチーム実行を指示した場合に使用。通常のサブエージェント委託とは異なり、独立したClaude Codeインスタンスによるチーム協調を行う。Do NOT use for: 単一ファイル変更・サブエージェント1回で済むタスク（→ Task）、tmux環境での既存Issue並列実行（→ einja-issue-exec）"
user-invocable: true
allowed-tools:
  - TeamCreate
  - TeamDelete
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - TaskOutput
  - Skill
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

# Agent Teams チーム並列実行ドライバー（Lead）

## 役割

ユーザーから委託されたタスク群を Lead → Director(Teammate Pool) → Worker(Subagent) の3ロール体制で並列実行する。
Agent Teams の共有 TaskList と self-claim によるワーカープール方式で動作する。

### サブエージェントとの違い

| 項目 | Agent Teams (Teammates) | サブエージェント (Task) |
|------|------------------------|----------------------|
| 実体 | 独立したClaude Codeインスタンス | メインセッション内の子プロセス |
| コンテキスト | 各自独立（Leadの会話履歴は引き継がない） | メインの指示を引き継ぎ |
| 通信 | メンバー間で直接メッセージ可能 | メインにのみ結果を報告 |
| 協調 | 共有タスクリストで自己調整 | メインが全作業を管理 |
| 適用場面 | 議論・協調が必要な複雑な作業 | 結果のみが重要な集中タスク |

### 補助ファイル参照

| ファイル | 内容 |
|---------|------|
| [`director-prompt-template.md`](./director-prompt-template.md) | Director Teammate spawn 時のプロンプトテンプレート |
| [`message-schemas.md`](./message-schemas.md) | メッセージプレフィックス規約・スキーマ定義 |
| [`references/monitoring.md`](./references/monitoring.md) | Step 1-D 監視ループ詳細・シグナルファイル命名規則 |
| [`references/error-handling.md`](./references/error-handling.md) | Step 1-F エラーハンドリング詳細・Circuit Breaker AskUserQuestion |

---

## 前提条件

**処理開始前に必ず `einja-common:agent-teams-guide` Skill を Skill ツールで読み込むこと。**
TeamCreate/teammate 管理、ファイル競合防止、フォールバック手順の必守ルールが含まれている。

---

## Step 1-A: 環境検出

### Agent Teams 有効確認

```bash
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

| 結果 | 動作 |
|------|------|
| `1` | Agent Teams モードで続行 |
| 空 / 未設定 | **フォールバック**: Agent tool + foreground subagent 方式に自動切替（Step 1-A-fb 参照） |

### Lead 監視モード resolve

teammate の実効モード（tmux pane / in-process）を hook/SKILL から確実判定する公式手段は無い（`CLAUDE_CODE_TEAMMATE_MODE` は Claude Code が公式提供しない env var）。そのため **Lead 自身が監視モードを決める**。hooks はモード判定せず Agent Teams 有効時は常時シグナルを生成するため、Lead が in-process と判定した場合はシグナルを無視すればよい。

解決順（先に決まったものを採用）:
1. `EINJA_TEAMMATE_MONITOR_MODE`（einja 明示指定: `tmux` / `in-process`）
2. settings.json の top-level `teammateMode`（project → user。`tmux` / `in-process` / `auto`）
3. 既定 `auto`

```bash
MODE="${EINJA_TEAMMATE_MONITOR_MODE:-}"
# 未指定なら settings.json の top-level teammateMode を読む（project: ./.claude/settings.json → user: ~/.claude/settings.json）
# 読み取りは node（fs.readFileSync + JSON.parse。require 回避）優先、jq フォールバック。JSONCコメント非対応前提。
if [ -z "$MODE" ]; then
  for f in "$PWD/.claude/settings.json" "$HOME/.claude/settings.json"; do
    [ -f "$f" ] || continue
    v="$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(j.teammateMode!=null)process.stdout.write(String(j.teammateMode))}catch(e){}' "$f" 2>/dev/null \
      || jq -r '.teammateMode // empty' "$f" 2>/dev/null || true)"
    [ -n "$v" ] && { MODE="$v"; break; }
  done
fi
[ -z "$MODE" ] && MODE="auto"   # いずれも未取得なら既定 auto
# auto / tmux は実環境を確認して降格判定する:
#   $TMUX 非空 かつ `tmux list-panes` 成功 → tmux、それ以外/失敗 → in-process へ降格
if { [ "$MODE" = "tmux" ] || [ "$MODE" = "auto" ]; } && [ -n "${TMUX:-}" ] && tmux list-panes >/dev/null 2>&1; then
  MONITOR_MODE="tmux"
else
  MONITOR_MODE="in-process"
fi
```

| MONITOR_MODE | 監視方式 |
|------|---------|
| `tmux` | シグナルファイル + tmux pane監視。**併せて SendMessage / TaskList poll も実施**（#29207 の silent in-process fallback 保険として取りこぼしを防ぐ） |
| `in-process` | SendMessage受信 + TaskList確認。hooks のシグナルは取りこぼし検知の補助としてのみ使用 |

### フォールバック（Agent Teams 無効時）— Step 1-A-fb

Agent Teams が無効の場合、以下の方式で同等の並列実行を提供する:

1. TaskCreate でタスクを登録（依存関係付き）
2. 依存関係が解決済みのタスクを収集
3. 各タスクを Agent tool（`run_in_background: true`）で並列起動 [^1]
4. 完了を順次待機し、結果を集約
5. 品質ゲート（Step 1-E 相当）を Lead が直接実行

[^1]: 本起動は **Skill 内部実行** であり、CLAUDE.md §4「直接実装の禁止」末尾の例外条項（Skill内部・Teammate内部でのサブエージェント並列起動は `run_in_background: true` 禁止の対象外）に該当する。

**制限**: ピア間通信・self-claim は不可。Lead が全タスク割り当てを管理する。

---

## Step 1-B: チーム設計フェーズ

### 1. タスク DAG 作成

ユーザーの指示を分析し、TaskCreate + addBlockedBy でタスク依存グラフを登録する。

```
TaskCreate:
  title: "Task {ID}: {タスク名}"
  description: |
    ## タスク情報
    - 担当範囲: {ファイル/ディレクトリ}
    - 技術コンテキスト: {ライブラリ・パターン}
    - 完了条件: {成果物・検証方法}

    ## 編集予定ファイル
    - {file1}
    - {file2}
  addBlockedBy: [{依存タスクID}]
```

### 2. プールサイズ決定

```
poolSize = min(タスク数, 5)
```

- 3-5名が推奨（コスト・協調のバランス）
- 1 Director あたり 1 タスクグループを逐次処理

### 3. ファイル所有権の事前分割（File Ownership Registry）

タスク内容から各タスクの変更予定ファイルを推定し、所有権マップを作成する。

```
ownership_map = {
  "Task 1": ["src/app/auth/**", "src/components/auth/**"],
  "Task 2": ["src/server/api/**", "src/lib/db/**"],
  "Task 3": ["tests/e2e/**", "tests/unit/**"],
}
```

**重複検出時の処理**:
- 同一ファイルが複数タスクに出現 → Lead が serial 化指示（addBlockedBy で依存追加）
- 共有ファイル（設定ファイル等）→ 1つの Director に限定

### 4. Teammate ロール定義テンプレート

各 Teammate の instructions に含めるべき情報:

| 項目 | 必須 | 内容 |
|------|------|------|
| 担当タスク範囲 | Yes | 具体的なファイルパスやディレクトリ |
| 技術コンテキスト | Yes | 使用するライブラリ・フレームワーク・パターン |
| 編集禁止ファイル | Yes | 他 Teammate の担当範囲 |
| 完了条件 | Yes | 何をもって完了とするか |
| メッセージスキーマ | Yes | `message-schemas.md` への参照 |
| プロジェクト基本構成 | No | CLAUDE.md 経由で自動ロード |
| git安全ルール | No | CLAUDE.md 経由で自動適用 |

---

## Step 1-C: TeamCreate・Director spawn

### 共通プロトコル（必須環境変数）

TeamCreate の `instructions` には、すべての Teammate に対して以下の環境変数 export を**必ず含める**こと:

```bash
export EINJA_SESSION_ID={SESSION_NAME}
export EINJA_AGENT_ROLE=director
```

- `EINJA_SESSION_ID`: シグナルファイル配置先（`~/.einja/sessions/$EINJA_SESSION_ID/signals/`）特定に使用
- `EINJA_AGENT_ROLE`: プロセスのロール識別（hooks や監視ツールで利用）

### TeamCreate 呼び出し

```
TeamCreate:
  teamName: "{session-name}-directors"
  teammates:
    - name: "director-1"
      instructions: "{director-prompt-template.md の内容（プレースホルダー置換済み）}"
    - name: "director-2"
      instructions: "{同上}"
    ...（poolSize 個）
```

### Director プロンプトテンプレート参照

Lead は TeamCreate 時に以下の手順で Director プロンプトを構築する:

1. `Read(".claude/skills/einja-team-exec/director-prompt-template.md")` でテンプレート取得
2. プレースホルダーを置換:
   - `{SESSION_NAME}`: セッション名（`EINJA_SESSION_ID` にも同値を設定）
   - `{TASK_LIST}`: 担当可能タスクの概要
   - `{OWNERSHIP_MAP}`: ファイル所有権マップ
3. 共通プロトコル（環境変数 export）を冒頭に追加
4. `instructions` に設定

### Director の self-claim ループ

Director は以下のループで自律的にタスクを処理する:

```
while (true):
  1. TaskList から status=open かつ blocked でないタスクを1つ claim
     → claim 成功: TaskUpdate で status を in_progress に変更
     → claimable なし: Lead に [idle] 通知 → 新タスク待機
  2. 作業環境準備（worktree 作成）
  3. Worker subagent 起動（run_in_background: true）
  4. Worker 完了待機 → 成果物をマージ
  5. Lead に完了報告（[task-complete] メッセージ）
  6. worktree 削除 → 1 に戻る
```

### Worker 起動時のサブエージェント注意事項

Director が Agent tool で起動するサブエージェント（`task-executer` のみならず
`frontend-coder` / `design-engineer` / `backend-architect` / `codex-agent` 等）には、
**全エージェント共通で** 以下の指示をプロンプトに含めること:

- AskUserQuestion 禁止（Agent Teams 環境ではユーザーに表示できない）
- 不明点は PENDING_QUESTIONS 形式で返却（`_einja-subagent-question-protocol` Skill 参照）
- `einja-task-exec` 経由・直接呼び出しに関わらず、ユーザー対話禁止ルールはすべての Worker 種別に適用される

### worktree ライフサイクル

Director は各タスクに対して worktree を作成・管理する:

```bash
# 1. 作成（冪等）
BRANCH="task/{SESSION}-{TASK_ID}"
BASE="origin/{base-branch}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi

WORKTREE_PATH="../worktrees/{SESSION}-{TASK_ID}"
if ! git worktree list --porcelain | grep -qFx "worktree $(cd .. && pwd)/worktrees/{SESSION}-{TASK_ID}"; then
  git worktree prune --expire now 2>/dev/null
  [ -d "$WORKTREE_PATH" ] && rm -rf "$WORKTREE_PATH"
  git worktree add "$WORKTREE_PATH" "$BRANCH"
fi

# 2. 作業: Worker が worktree 内で実装
# 3. マージ: Director が成果物をマージ
# 4. 削除
git worktree remove "$WORKTREE_PATH" --force
git branch -d "$BRANCH"
```

### シグナルファイル作成ルール

Director は SendMessage 送信**後に**シグナルファイルを作成する。
**命名規則の全系統対応表は [`references/monitoring.md`](./references/monitoring.md) を参照。**

| メッセージ種別 | シグナルファイル名 |
|--------------|-----------------|
| `[task-complete]` | `director-{ID}-complete.signal` |
| `[error]` | `director-{ID}-error.signal` |
| `[idle]` | `director-{ID}-idle.signal` |
| `[task-claim]` | なし（broadcast のみ） |

```bash
SIGNAL_DIR=~/.einja/sessions/$EINJA_SESSION_ID/signals
mkdir -p "$SIGNAL_DIR"
touch "$SIGNAL_DIR/director-{ID}-{type}.signal"
```

### ピア間通信ハンドラー

Director はメインフロー実行中に以下の割り込みメッセージを処理する:

| 受信メッセージ | 処理 |
|--------------|------|
| `[task-claim]` | 自分の編集予定ファイルと重複チェック → 重複時は `[conflict-alert]` で当事者間調整 |
| `[change-summary]` | ファイルマップ更新 |
| `[conflict-alert]` | 当事者間で編集範囲調整（タイブレーク: タスク番号が小さい側が優先） |
| `[verdict]` | approved → 次タスク / fix_required → 修正 / rejected → エラー報告 |
| `[answer]` | Lead からの質問回答 → 該当 Worker に SendMessage で resume 指示 |

### Director→Lead 質問転送フロー（モード3 — Agent Teams）

Agent Teams モードでは Teammate も AskUserQuestion を直接ユーザーに表示できないため、Director→Lead→ユーザー の順で質問を転送する。

#### Worker（Agent tool subagent）の質問返却

Worker は PENDING_QUESTIONS 形式で Director に質問を返却する（`_einja-subagent-question-protocol` Skill参照）。Worker は AskUserQuestion を使ってはならない。

#### Director の処理

```
Worker出力にPENDING_QUESTIONS検出
  ↓
1. 自力判断試行:
   - spec/design.md・ownership_map・session状態から判定可能か検証
   - 判定可能 → 回答を決定し、SendMessage(to: workerAgentId, message: "[answer] resume: {回答}") で Worker resume
   - 判定不可 → Lead に転送（次ステップ）
  ↓
2. Lead 転送（SendMessage）:
   - SendMessage(to: "lead", message: "[question] Task {ID}: {質問内容}\n\nOptions:\n1) ...\n2) ...")
   - 質問の出所（taskId, workerAgentId, questionId）を含める
   - Director は Lead からの [answer] 返信を待機（メインフロー継続可、割り込み受信）
  ↓
3. Lead からの [answer] 受信:
   - Director が Worker に SendMessage(to: workerAgentId, message: "[answer] resume: {回答}") で resume 指示
   - Worker は resume プロトコルに従い作業再開
```

#### Lead の処理

```
Director から [question] 受信
  ↓
1. 自力回答可否判定:
   - Lead のコンテキスト（ユーザー指示・session状態・ownership_map）から判定可能 → 直接回答
   - ビジネス判断・要件判断が必要 → AskUserQuestion でユーザーに転送
  ↓
2. AskUserQuestion でユーザー転送（必要時）:
   - 質問内容・選択肢を提示
   - ユーザー回答を取得
  ↓
3. Director に SendMessage:
   - SendMessage(to: directorAgentId, message: "[answer] questionId={id}: {回答}")
   - Director がメッセージを受信して Worker に resume 指示を伝搬
```

#### タイムアウト

- Worker → Director: Worker は PENDING_QUESTIONS 返却後、resume メッセージを最大30分待機（Agent tool の resume タイムアウトに依存）
- Director → Lead: Lead 応答を最大30分待機。タイムアウト時は `[error] question_timeout` を Lead に送信してタスクを failed 扱い
- ユーザー → Lead: AskUserQuestion は同期ブロックのため Lead は応答を待ち続ける（長時間放置時はセッション全体がストール）

### エラー処理 + Lead エスカレーション

Director は以下の場合に Lead へエスカレーションする:

- Worker 失敗（リトライ2回超過）
- コンフリクト調整タイムアウト（5分）
- PR 作成失敗（認証エラー等）

形式: `[error] Task {ID}: {エラー内容}`

### EINJA_AGENT_ROLE 環境変数

各プロセスのロールを環境変数で識別する:

| ロール | 値 | 設定タイミング |
|-------|-----|--------------|
| Lead | 設定不要（Skill実行プロセス自体） | - |
| Director | `director` | TeamCreate の instructions 内で `export EINJA_AGENT_ROLE=director`（共通プロトコルにより必須） |
| Worker | `worker` | Director が Agent tool 起動時にプロンプト内で指示 |

---

## Step 1-D: 監視ループ（モード別設計）

**詳細仕様は [`references/monitoring.md`](./references/monitoring.md) を参照。**
ここでは概略のみ示す。

| モード | 監視方式 | 詳細 |
|-------|---------|------|
| Agent Teams in-process | SendMessage 受信 + TaskList 確認（メイン）/ シグナルファイル（補助） | [monitoring.md §Agent Teams モード](./references/monitoring.md#agent-teams-モードin-process) |
| Agent Teams tmux | シグナルファイル + bash 待機ループ（必須）+ SendMessage（内容） | [monitoring.md §tmux モード](./references/monitoring.md#tmux-モード) |
| Platform hooks（イベント signalizer） | hooks → シグナルファイル自動生成（常時） | [monitoring.md §Platform hooks](./references/monitoring.md#platform-hooksイベント-signalizer) |

### シグナルファイル命名規則（3系統サマリ）

| 系統 | ファイル名パターン | 用途 |
|------|------------------|------|
| tmux系（Worker→Director） | `worker-{X.Y}.signal` | Worker pane 終了通知 |
| Agent Teams系（Director→Lead） | `director-{ID}-{complete\|error\|idle}.signal` | Director ステータス通知 |
| Platform hooks系（補助） | `teammate-idle-{TEAMMATE}.signal`, `task-{TASK_ID}-completed.signal` | hooks 自動生成 |

詳細表・処理ルートは [`references/monitoring.md`](./references/monitoring.md#シグナルファイル命名規則3系統対応表) を参照。

---

## Step 1-E: 品質ゲート（汎用 verdict フロー）

Teammate（Director）からタスク完了報告を受信した場合:

```
Teammate 完了報告
  → Lead が成果物を確認（git diff、テスト結果）
  → verdict: approved / fix_required / rejected
  → fix_required: 最大2回修正指示 → 3回目NG → rejected
  → rejected: ユーザーエスカレーション
```

### verdict 送信

```
SendMessage:
  to: "director-{ID}"
  message: "[verdict] Task {ID}: {approved|fix_required|rejected}"
```

| verdict | Director の動作 |
|---------|----------------|
| `approved` | worktree 削除 → 次タスク claim |
| `fix_required` | fixInstructions に従い修正 → 再報告 |
| `rejected` | エラー報告 → 次タスク claim |

### 確認項目

| チェック | 方法 |
|---------|------|
| 変更ファイルの存在確認 | `git diff --stat` |
| テスト通過 | `pnpm test` / `pnpm typecheck` |
| lint 通過 | `pnpm lint` |
| 意図しないファイル変更なし | ownership_map との照合 |

---

## Step 1-F: エラーハンドリング・Circuit Breaker

**詳細仕様は [`references/error-handling.md`](./references/error-handling.md) を参照。**
ここでは概略のみ示す。

| 障害種別 | 対応概要 |
|---------|---------|
| Director 停止 | 再 spawn（最大2回）→ ユーザー報告 |
| タスク3回連続失敗（Circuit Breaker） | AskUserQuestion でエスカレーション（選択肢の 2層記述は [error-handling.md](./references/error-handling.md#askuserquestion-の選択肢2層記述)） |
| セッションタイムアウト（2時間） | graceful shutdown（Step 1-G） |
| git lock / マージコンフリクト / GitHub API 認証失敗 | 個別対応（詳細は [error-handling.md](./references/error-handling.md#その他のエラー)） |

---

## Step 1-G: クリーンアップ

### 通常終了（全タスク完了後）

1. 全 Director に `shutdown_request` を SendMessage で送信
2. 各 Director がシャットダウンを承認するまで待機
3. TeamDelete でチームリソースをクリーンアップ:
   ```
   TeamDelete:
     teamName: "{session-name}-directors"
   ```
4. worktree・ブランチ削除:
   ```bash
   # worktree 削除
   git worktree list | grep "{session-name}" | awk '{print $1}' | xargs -I {} git worktree remove {} --force

   # ローカルブランチ削除
   git branch | grep "task/{session-name}" | xargs git branch -D
   ```
5. ユーザーに最終結果を報告

### セッションファイル保持（resume 用）

`~/.einja/sessions/{session-name}/` ディレクトリは削除しない。以下を保持する:

| ファイル | 内容 |
|---------|------|
| `status.json` | セッション状態（完了タスク、未完了タスク、verdict 履歴） |
| `ownership-map.json` | ファイル所有権マップ |
| `signals/` | シグナルファイル（処理済みは削除済み） |

**重要**: クリーンアップは必ず Lead が実行する。Teammate からのクリーンアップは不整合を招く。

---

## 制限事項（実験機能）

- セッション再開（`/resume`）で in-process の Teammate は復元されない
- タスクステータスの更新が遅延することがある
- シャットダウンに時間がかかる場合がある（現在のリクエスト完了を待つ）
- 1セッションにつき1チームのみ
- nested teams（Teammate が自身のチームを作る）は不可
- Lead は固定（交代不可）
- split panes は tmux / iTerm2 が必要

<!-- @einja:project-private:start id="einja-team-exec-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
