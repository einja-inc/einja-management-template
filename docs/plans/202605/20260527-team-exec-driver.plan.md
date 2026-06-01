# einja-team-exec 実行ドライバー化 — Agent Teams汎用基盤の整備

## Context

issue-exec系コマンドで「ディレクターがワーカーの状況をウォッチできない」不具合が発生。根本原因（シグナルファイル未作成）は修正済み（PR #151）だが、同様の問題はAgent Teamsを使う他の用途でも発生しうる。

現状、Agent Teams関連Skillは:
- `einja-team-exec` — 汎用ガイド（手順書のみ、駆動ロジックなし）
- `einja-issue-team-exec` — Issue専用の完全実行ドライバー（シグナル/監視/フォールバックあり）

**目標**: `einja-team-exec` を「ガイド」から「実行ドライバー」に昇格させ、Issue以外のAgent Teams作業でもシグナル検知・監視・フォールバック・品質ゲートが確実に動作する汎用基盤にする。`einja-issue-team-exec` はIssue固有ロジックのみ残し、汎用部分は `einja-team-exec` を参照する構造にする。

## 現状

### einja-team-exec（現状: ガイド）
- TeamCreate/SendMessage/TeamDeleteの概念説明
- 自然言語でのチーム起動テンプレート
- ファイル競合防止・コミット管理の方針
- **欠落**: シグナルファイル、監視ループ、タイムアウトフォールバック、TeamCreate直接呼び出し仕様、TaskList管理、エラーリトライ、worktree連携

### einja-issue-team-exec（現状: Issue専用ドライバー）
- 汎用部分とIssue固有部分が混在（調査で分類済み）
- 汎用: シグナル機構、監視ループ、フォールバック、Director pooling、verdict フロー、ピア通信、メッセージスキーマ
- Issue固有: spec読込、Phase管理、PR Gate、ブランチ命名、QAフェーズ、docs-updater

### 調査で発見した改善機会

| 発見 | 現状 | 改善案 |
|------|------|--------|
| `TeammateIdle`/`TaskCompleted` hook | 未使用 | 公式サポート確認後、シグナルファイルの上位互換として活用 |
| タスクリース + ハートビート | 未実装 | claim(task_id, ttl) + TTL stale検知 |
| MoA (Mixture of Agents) | 未実装 | 複数提案→合成パターンを品質ゲートに |
| Circuit breaker at governance plane | prompt内のmax retry | hook + 外部カウンターで制御 |
| File ownership registry | 事後検知（conflict-alert） | claim時にLeadが事前チェック |
| append-only shared state log | ステータスファイル個別管理 | `team-state.jsonl` で一元管理 |

## 変更内容

### 1. einja-team-exec/SKILL.md のフル書き直し

現在のガイド形式を完全な実行ドライバーに書き換え。以下の構造:

#### 1-A. 前提条件・環境検出
- Agent Teams有効確認（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`）
- 表示モード検出（tmux / in-process）→ 監視方式の自動選択
- フォールバック（Agent Teams無効時 → Agent tool + foreground subagent方式に自動切替）

#### 1-B. チーム設計フェーズ
- タスクDAG作成（TaskCreate + addBlockedBy）
- プールサイズ決定: `min(タスク数, 5)`
- ファイル所有権の事前分割（File ownership registry）
  - タスク内容から変更予定ファイルを推定
  - 重複検出時はLead がserial化指示
- Teammateロール定義テンプレート

#### 1-C. TeamCreate・Director spawn
- TeamCreate直接呼び出しパターン（パラメータ仕様）
- Director prompt テンプレート（`director-prompt-template.md` として分離）
  - self-claim ループ
  - Worker subagent起動（`run_in_background: true`）
  - worktree ライフサイクル（作成→作業→マージ→削除）
  - シグナルファイル作成ルール（メッセージ種別対応表）
  - ピア間通信ハンドラー
  - エラー処理 + Lead エスカレーション

#### 1-D. 監視ループ（モード別設計）

Agent Teams と tmux で監視方式を分離し、複雑さを抑える:

**Agent Teamsモード（in-process / tmux pane表示）**:
- Agent Teamsプラットフォームが自動でidle通知・メッセージ配送を管理するため、Leadは能動的ポーリング不要
- Leadは SendMessage 受信 + TaskList 確認で状況を把握する（プラットフォーム標準動作）
- **フォールバック**: TaskList の最終更新から10分以上変化がないDirectorを検出した場合、SendMessage で ping → 応答なしならユーザー報告

**tmuxモード（einja-issue-exec互換）**:
- シグナルファイル方式（`~/.einja/sessions/{session-id}/signals/*.signal`）
- bash待機ループ（120秒、2秒間隔）
- **タイムアウトフォールバック**: 120秒無検知 → ステータスファイル走査 + Worker pane生存確認（`tmux list-panes`）

**Platform hooks（補助・オプション）**:
- `TeammateIdle` / `TaskCompleted` hook が利用可能な環境ではシグナルファイル作成の補助として設定可能
- hooks設定形式（settings.jsonの既存スキーマに準拠）:
  ```json
  { "hooks": [{ "type": "command", "command": "bash .claude/hooks/einja/teammate-idle.sh" }] }
  ```
- **必須ではない** — hooks未設定でもシグナルファイル方式 or Agent Teamsプラットフォーム管理で動作する

#### 1-E. 品質ゲート（汎用verdict フロー）
Issue固有のFast Gate/Risk Gateは除外し、汎用的なパターンを定義:

```
Teammate完了報告
  → Lead が成果物を確認（git diff、テスト結果）
  → verdict: approved / fix_required / rejected
  → fix_required: 最大2回 → rejected → ユーザーエスカレーション
```

#### 1-F. エラーハンドリング・Circuit Breaker
- Teammate停止検知 → 新Teammate spawn（最大2回）→ ユーザー報告
- タスク連続失敗（3回同一失敗）→ タスク中断 → ユーザーエスカレーション
- 全体セッションタイムアウト（設定可能、デフォルト2h）→ graceful shutdown

#### 1-G. クリーンアップ
- shutdown_request送信 → TeamDelete → worktree/ブランチ削除
- セッションファイル保持（resume用）

### 2. director-prompt-template.md の新規作成

`einja-issue-team-exec/director-prompt.md` から汎用部分を抽出したテンプレート:

- self-claimループ
- Worker subagent起動・完了待機
- worktree作成→マージ→削除
- コミット・成果物報告
- シグナルファイル作成ルール表
- ピア間通信ハンドラー（conflict-alert、peer-review等）
- エラー処理パターン
- **プレースホルダー**: `{SESSION_PATH}`, `{BRANCH_PREFIX}`, `{QUALITY_GATE_STEPS}` でカスタマイズポイントを明示

### 3. message-schemas.md の新規作成（汎用版）

`einja-issue-team-exec/message-schemas.md` から汎用メッセージを抽出:

| メッセージ | 汎用 | Issue固有 |
|-----------|------|----------|
| `[task-claim]`, `[progress]`, `[idle]`, `[error]` | ✓ | |
| `[change-summary]`, `[conflict-alert]`, `[conflict-resolved]` | ✓ | |
| `[peer-review]`, `[peer-review-ack]`, `[ci-failure]` | ✓ | |
| `[pr-ready]`, `[verdict]` | ✓（汎用化） | |
| `[review-failed]`, `[qa-failed]` | | ✓（Issue固有） |

### 4. einja-issue-team-exec のリファクタリング

汎用部分を `einja-team-exec` への参照に置き換え:
- `> 汎用監視ループ・シグナル機構の詳細は einja-team-exec/SKILL.md を参照`
- Issue固有のStep（spec読込、Phase管理、PR Gate、ブランチ命名）のみ残す
- `director-prompt.md` は `einja-team-exec/director-prompt-template.md` を継承し、Issue固有の上書き（ブランチ命名、QA、Phase 99等）のみ記述

### 5. Platform hooks の設定追加（2段階: 調査→条件付き実装）

#### 5a. hooks仕様調査（先行必須）

Claude Code公式ドキュメント・settings.jsonスキーマで `TeammateIdle` / `TaskCompleted` イベントが hooks として利用可能かを確認する。現行の公式hooks は `PreToolUse` / `PostToolUse` / `UserPromptSubmit` の3種のみが確認されており、Agent Teams系イベントが hooks 対象になるかは未確認。

**調査方法**: `claude --help` / 公式ドキュメント / settings.json JSONSchema で hooksの有効イベント名を網羅確認

#### 5b. 条件付き実装（5aの結果に依存）

**5aでサポート確認できた場合のみ実施**:

`.claude/settings.json` に hooks を追加:

```json
{
  "hooks": {
    "TeammateIdle": [{ "hooks": [{ "type": "command", "command": "bash .claude/hooks/einja/teammate-idle.sh" }] }],
    "TaskCompleted": [{ "hooks": [{ "type": "command", "command": "bash .claude/hooks/einja/task-completed.sh" }] }]
  }
}
```

> **注意**: 形式は既存settings.jsonの`PreToolUse`等と同一スキーマに準拠。timeout指定は秒単位。

hook スクリプト:
- `teammate-idle.sh`: シグナルファイル作成（`~/.einja/sessions/*/signals/` にtouch）
- `task-completed.sh`: 同上
- **hookは補助的な役割** — hooks未設定でもAgent Teamsプラットフォーム管理 or シグナルファイル方式で動作する

**5aで未サポートと判明した場合**:
- タスク5bをスキップ
- タスク1（SKILL.md）のセクション1-D「Platform hooks」を「将来対応（現時点で未サポート）」と注記
- 改善機会テーブルの該当行を「⏳ 将来」に変更

### 6. tmux Worker起動のタイミング問題修正

**対象**: `.claude/skills/einja-issue-exec/SKILL.md` 行307-310, 行675-679

**問題**: `claude --dangerously-skip-permissions` の起動完了を待たずに即座に `/einja-task-exec` を send-keys しているため、claudeが起動する前にコマンドが消費されて空振りする。

**修正**: `claude` コマンド送信後、プロンプト出現を待つポーリングを挿入:

```bash
# claude起動完了を待つ（最大30秒、pane内のClaude Code起動メッセージを検知）
for i in $(seq 1 30); do
  pane_out=$(tmux capture-pane -t "$WORKER_PANE" -p -S -5 2>/dev/null)
  # Claude Code起動完了の確実な指標: "Type your prompt" または入力待ちカーソル行
  if echo "$pane_out" | grep -qE "(Type your prompt|claude-code|╭|❯)"; then
    break
  fi
  sleep 1
done
# タイムアウト時はsleep 3で最終フォールバック（claude起動が異常に遅い場合）
if [ "$i" -eq 30 ]; then sleep 3; fi
```

同じ修正を Worker起動（行307-310）と Director再起動（行675-679）の両方に適用。

### 7. AskUserQuestion サブエージェント安全化

**問題**: 多くのSkillがAskUserQuestionをサブエージェント/Teammate環境で使用し、実行が停止する。

**調査結果** — AskUserQuestion使用Skillのガード状況:

| 危険度 | スキル | AUQ箇所 | ガード |
|--------|-------|---------|--------|
| 🔴 高 | `einja-task-commit` | 9 | なし（毎回呼ばれる） |
| 🔴 高 | `_einja-task-qa` | 11 | なし |
| 🔴 高 | `einja-conflict-resolver` | 5 | なし |
| 🟡 中 | `einja-task-exec` | 5 | 部分的（--autoフラグ） |
| 🟡 中 | `einja-create-pr` | 4 | 部分的（--autoフラグ） |
| 🟠 低 | その他10+ Skill | 各1-6 | なし |

**修正方針（2段階）**:

**(A) サブエージェント検出の標準化（`EINJA_AGENT_ROLE` に統一）**

**明示的ロール情報**で検出する（ディレクトリ存在チェックは誤爆するため使わない）。

**環境変数一覧（正規定義）**:

| 変数名 | 値 | 設定タイミング | 用途 |
|--------|-----|--------------|------|
| `EINJA_AGENT_ROLE` | `worker` / `director` / `lead` | 各モードの起動時 | AUQガード判定、ロール別動作分岐 |
| `EINJA_SESSION_ID` | `issue-{N}` / `team-{UUID}` | セッション開始時 | シグナルファイルパス決定 |

> **注意**: 旧名 `EINJA_IS_SUBAGENT` は使用しない。`EINJA_AGENT_ROLE` に統一する。

```
tmuxモード:
  - issue-exec Worker起動時に環境変数をセット:
    export EINJA_AGENT_ROLE=worker
    export EINJA_SESSION_ID=issue-{N}
  - tmux send-keys で確実に伝播
  - Worker内で起動されるTask subagentにはプロンプトで
    「EINJA_AGENT_ROLE=worker 環境で動作中」と明記

Agent Teamsモード:
  - 環境変数はTeammateに伝播しない（instructionsはプロンプトであり環境変数ではない）
  - Teammate instructions 冒頭に以下を明記:
    「あなたは EINJA_AGENT_ROLE=director として動作しています。
     AskUserQuestionは使用せず、_einja-subagent-question-protocol の
     PENDING_QUESTIONS 形式で質問を返却すること」
  - Director内のWorker subagent promptにも同様のロール情報を注入
```

**(B) 基盤側でAUQ自動検知・自動対処（Skill側の修正不要）**

Skill作者に「ガードを書け」と求めるのは漏れが必発するためNG。基盤側で一括対処する:

**tmuxモード — Manager/Directorの監視ループにAUQ検知を追加**:
```
タイムアウトフォールバック時（120秒後）に追加:
1. tmux capture-pane で Worker pane の最新出力を取得
2. AUQプロンプトのパターン検出（選択肢表示、"?"で終わる質問文等）
3. 検出した場合:
   a. Manager/Directorが質問内容を読み取り、自力回答可能なら tmux send-keys で回答送信
   b. 自力回答不可なら AskUserQuestion でユーザーに転送し、回答を tmux send-keys で送信
4. Worker が回答を受け取り自動的に作業再開
```

**Agent Teamsモード — 既存プロトコルで対応済み**:
- Claude Code v2.0.56+ でsubagent内のAUQはシステムレベルでフィルタリングされる
- `_einja-subagent-question-protocol` が autoload 設定で全subagentに自動適用済み
- Skill がAUQを呼ぼうとすると失敗 → PENDING_QUESTIONS にフォールバック → 親エージェントが処理
- **追加対応不要**（既存の仕組みで動作する）

**(C) 質問転送フロー（実行モード別設計）**

AUQガードだけではWorkerは「質問したかったができない」状態で停止する。質問をManager/Leadに転送し、回答後に再開するフローが必要。**実行モードごとに再開メカニズムが異なるため、分離して設計する。**

**既存の骨格**: einja-issue-exec 行386-389に仕様記述あり。行583にファイルスキーマあり。行374にquestion-{UUID}.signalの言及あり。

**モード1: tmux Worker（独立Claude Codeプロセス）**

tmux Worker は独立プロセスなのでファイルポーリングで自ら再開可能:

```
Worker側:
1. 質問ファイル書込み: ~/.einja/sessions/{session-id}/questions/q-{UUID}.json
   { "id": "{UUID}", "workerId": "{X.Y}", "status": "pending",
     "question": "...", "options": [...], "context": "...", "createdAt": "ISO8601" }
2. シグナルファイル作成: touch ~/.einja/sessions/{session-id}/signals/question-{UUID}.signal
3. 回答待ちループ（15秒間隔、最大30分タイムアウト）:
   while q-{UUID}.json の status == "pending" && 経過 < 30分:
     sleep 15
   タイムアウト時: status を "timeout" に遷移、タスクを blocked にしてManager通知

Manager側:
1. question-{UUID}.signal を検知
2. q-{UUID}.json を読み、自力回答可能なら回答書込み、不可ならAskUserQuestionでユーザー転送
3. q-{UUID}.json の status="answered", answer フィールドに回答記録
4. Worker が次回ポーリングで検知して再開
```

**モード2: Agent tool subagent（einja-task-exec等から呼ばれるSkill内）**

subagent は停止後にファイルポーリングできない。既存の PENDING_QUESTIONS プロトコルに準拠:

```
Subagent側:
1. PENDING_QUESTIONS を出力に含めて停止（既存プロトコルそのまま）

親エージェント（einja-task-exec等）側:
1. Agent tool の出力に PENDING_QUESTIONS を検出
2. CLAUDE.md のルールに従い、自律解決可能なら解決、不可ならAskUserQuestion
3. 回答を含めた resume プロンプトで SendMessage（to: agentId）して subagent を再開
```

**モード3: Agent Teams Director → Lead**

Director内のWorker subagentが PENDING_QUESTIONS を返した場合:

```
Director側:
1. Worker subagent の TaskOutput で PENDING_QUESTIONS を検出
2. Director自身で判断可能 → 回答して Worker を resume（SendMessage to: agentId）
3. Director判断不可 → Lead に質問転送:
   SendMessage: `[question] Task {X.Y}: {質問概要}`
   + シグナルファイル作成（シグナルファイル作成ルール表の [error] と同等扱い）
   スキーマ: { questionId, taskId, subagentRunId, question, options, context, expiresAt }
4. Lead からの回答受信:
   `[answer] Task {X.Y}: {回答}`
5. Director が保持していた subagentRunId で Worker を resume
```

### 9. Worker停止パターンの予防強化

Codexレビューで発見されたWorker停止パターン（28件中22件未対策）のうち、最重要3件を追加対応する。

#### 9-A. einja-task-exec Workerプロンプトへの AUQ禁止指示追加

**問題**: Plan Section 7(B)はManager側の検知（tmux capture-pane）のみ。Worker側の予防指示がないため、einja-task-exec経由のWorkerがAskUserQuestionを直接呼び、tmux pane上で無応答ブロックする。

**修正**: `einja-task-exec/SKILL.md` のWorkerプロンプトテンプレートに以下を追加:
```
【必須】AskUserQuestionツールは使用禁止。質問が必要な場合は
_einja-subagent-question-protocol の PENDING_QUESTIONS 形式で返却すること。
```

対象: einja-task-exec の Worker subagent 起動プロンプト（task-executer agent prompt）

#### 9-B. tmux Worker起動後の権限モード検証

**問題**: `--dangerously-skip-permissions` が効いていない場合（フラグtypo、Claude Codeバージョン差異等）、最初のツール実行で権限確認プロンプトが出てブロックする。起動待ちポーリング（タスク6）は起動検知のみで権限モードは検証しない。

**修正**: タスク6のclaude起動待ちポーリング完了後に、権限モード検証を追加:
```bash
# 権限モード検証: pane出力に "dangerously-skip-permissions" or "bypass" が含まれるか確認
pane_out=$(tmux capture-pane -t "$WORKER_PANE" -p -S -20 2>/dev/null)
if ! echo "$pane_out" | grep -qiE "(dangerously-skip-permissions|bypass|auto-accept)"; then
  echo "[WARN] Worker may not have permissions bypassed. Check startup flags."
  # シグナルファイルでManagerに警告
  touch "$SESSION_DIR/signals/permission-warning-${WORKER_ID}.signal"
fi
```

対象: einja-issue-exec/SKILL.md の Worker起動セクション（タスク6に統合）

#### 9-C. Agent toolモード Worker の silent failure 検知

**問題**: `run_in_background: true` で起動したWorker subagentがエラーを返さず終了した場合、Managerが完了を検知できない。tmuxモードはシグナルファイルで検知するが、Agent toolモードにはこの仕組みがない。

**修正**: einja-team-exec/SKILL.md のAgent Teamsモード監視ループに以下を追加:
```
Agent toolモードのWorker完了検知:
1. run_in_background で起動した Worker の TaskList ステータスを定期確認（60秒間隔）
2. Worker の TaskList が completed だがシグナル（SendMessage）が来ていない場合 → silent failure と判定
3. silent failure 検知時: TaskOutput で結果を取得し、成果物なしならタスクを failed 扱いで再キュー
4. タイムアウト: Worker起動後30分以内にTaskListがcompleted/failedにならない場合 → ユーザーエスカレーション
```

対象: einja-team-exec/SKILL.md のセクション1-D（監視ループ）に追記

### 8. 改善機会テーブルのスコープ明確化

| 発見 | 今回のスコープ | 理由 |
|------|--------------|------|
| `TeammateIdle`/`TaskCompleted` hook | ✅ 調査→条件付き実装 | 公式サポート確認後に導入。未サポート時はスキップ |
| タスクリース + ハートビート | ⏳ 将来 | team-state.jsonl の設計が必要、今回はスコープ外 |
| MoA (Mixture of Agents) | ⏳ 将来 | 品質ゲートの高度化は別Plan |
| Circuit breaker (governance plane) | ✅ 部分実装 | エラーハンドリング・セッションタイムアウトとして実装 |
| File ownership registry | ✅ 実装 | claim時のLead事前チェックとして実装 |
| append-only shared state log (team-state.jsonl) | ⏳ 将来 | 今回はシグナルファイル方式を継続。jsonl化は次Plan |

## タスク概要

| ID | タスク | 使用Skill/ツール | 依存 |
|----|--------|-----------------|------|
| 0-1 | Planファイルを `docs/plans/` に配置 | [Bash] | — |
| 0-2 | worktree作成 | [EnterWorktree + _einja-worktree-guide] | 0-1 |
| 0-3 | Skill仕様策定（einja-skill-plan-guide ワークフローA） | [einja-skill-plan-guide] | — |
| 1 | einja-team-exec/SKILL.md フル書き直し（実行ドライバー化） | [Edit/Write] | 0-2, 0-3 |
| 2 | director-prompt-template.md 新規作成（汎用Directorテンプレート） | [Write] | 0-2, 1 |
| 3 | message-schemas.md 新規作成（汎用メッセージスキーマ） | [Write] | 0-2, 1 |
| 4 | einja-issue-team-exec リファクタ（汎用部分をeinja-team-exec参照に。Leadがテンプレート読込→プレースホルダー置換→instructions生成の手順を明文化） | [Edit] | 1, 2, 3 |
| 5a | Platform hooks 仕様調査（TeammateIdle/TaskCompleted の公式サポート確認） | [Bash/WebSearch] | 0-2 |
| 5b | Platform hooks 実装（5aでサポート確認時のみ） | [Write/Edit] | 5a |
| 6 | tmux Worker起動タイミング修正（claude起動待ちポーリング追加）**対象行: 307-310, 675-679** | [Edit] | 0-2 |
| 7 | AskUserQuestion安全化（tmux: Manager監視ループにAUQ検知+自動回答追加 **対象行: 監視ループセクション**。Agent Teams: 既存プロトコルで対応済み確認） | [Edit] | 0-2 |
| 8 | 質問転送フロー実装（Worker→Manager/Lead質問エスカレーション + 回答ポーリング再開。einja-issue-exec/einja-team-exec/einja-task-exec に追記） | [Edit] | 1, 7 |
| 9a | einja-task-exec Workerプロンプトへの AUQ禁止指示追加 | [Edit] | 0-2 |
| 9b | tmux Worker起動後の権限モード検証（タスク6のポーリングに統合） | [Edit] | 6 |
| 9c | Agent toolモード Worker の silent failure 検知（タスク1のSKILL.md監視ループに統合） | [Edit] | 1 |
| 99-1 | 観点別並列コードレビュー | [einja-review-code] | 1-9c全完了 |
| 99-2 | 動作確認（hookスクリプトパス検証、メッセージスキーマ網羅性、tmux起動待ちフロー） | [Bash] | 99-1 |
| 99-G | コミット承認ゲート | [AskUserQuestion] | 99-2 |
| 99-3 | コミット・プッシュ | [einja-task-commit] | 99-G |

## 並列実行計画

- **Phase 0**: タスク0-1, 0-2, 0-3
- **Phase A（並列）**: タスク5a, 6, 7, 9a（独立ファイル編集。6と7はeinja-issue-exec/SKILL.md内の対象行が異なるため並列可: 6→行307-310/675-679、7→監視ループセクション。9aはeinja-task-exec/SKILL.md）
- **Phase B（0-3依存）**: タスク1（Skill仕様策定完了後。9cのsilent failure検知仕様もSKILL.md監視ループに含める）
- **Phase B+（1依存、並列）**: タスク2, 3（SKILL.md完成後にメッセージスキーマとDirectorテンプレートを並列作成）
- **Phase B1.5（6依存）**: タスク9b（起動ポーリング完了後に権限モード検証を統合）
- **Phase B2（5a依存）**: タスク5b（hooks仕様調査結果に基づく条件付き実装）
- **Phase B3（1, 7依存）**: タスク8（einja-team-exec SKILL.md + AUQガード完了後に質問転送フロー実装）
- **Phase C（1, 2, 3依存）**: タスク4（全汎用部品完成後にeinja-issue-team-execリファクタ）
- worktree必要（複数ファイルの大規模変更）

## リスク・不明点

- **einja-issue-team-execとの循環参照リスク**: einja-issue-team-exec → einja-team-exec の一方向参照のみ許可
- **Platform hooks の動作確認**: TeammateIdle/TaskCompleted hookの公式サポート状況を事前確認。未サポートの場合はLayer 2/3のみで運用
- **後方互換性**: einja-issue-team-exec のリファクタで既存の動作が壊れないよう、参照先の内容が同一であることを確認
- **settings.json への hooks 追加**: 下流リポジトリに配布される。hookスクリプト不在時は無害であることを確認 or スクリプト側でAgent Teams有効時のみ動作するガードを入れる
- **agent-teams-guide（einja-commonプラグイン）との関係**: einja-team-exec が実行ドライバーに昇格するため、agent-teams-guide は概念ガイドとして残す（役割分担を明記）
- **EINJA_AGENT_ROLE 環境変数の伝播**: tmuxモードではexportで確実に渡せる。Agent Teamsモードでは環境変数が伝播しないため、teammate instructionsにロール情報を含める必要がある
- **Agent tool resume のTTL制約**: モード3（Director→Lead質問転送）でWorker subagentをresume可能な時間制限が不明。長時間経過後のresumeが失敗する場合、タスクblocked→新Worker起動方式にフォールバックする必要がある
- **Teammate環境での autoload Skill適用有無**: `_einja-subagent-question-protocol` の `autoload: true` がAgent Teams Teammate（独立Claude Codeインスタンス）にも適用されるか要確認

### Worker停止パターン（高・中リスク — 今回スコープ外だが認識必要）

| リスク | パターン | 発生条件 | 緩和策（将来） |
|:------:|---------|---------|--------------|
| 🟠 高 | APIレート制限（429） | 並列5 Workerで同時API呼び出し | poolSize動的調整、429検知時の自動バックオフ |
| 🟠 高 | zombie pane誤検知 | 長時間LLM推論中のWorkerを「ハング」と誤判定 | compaction中フラグ、追加ヒューリスティック |
| 🟠 高 | compaction後の文脈喪失 | Workerが再開しても作業内容を忘れる | Workerプロンプトの最小化、タスク記述の自己完結化 |
| 🟡 中 | git push SSH passphrase待ち | SSH agentなし環境でのpush | Step 0で `ssh-add -l` 確認を追加 |
| 🟡 中 | Agent toolモードのMCP tool権限プロンプト | mode未指定（CLAUDE.md準拠）でMCP操作時に確認 | Worker promptに必要ツールの事前許可リストを明示 |
| 🟡 中 | `git rebase -i` 等の対話エディタ起動 | task-executerがrebaseを試みる | `GIT_EDITOR=true` 環境変数の設定 |
| 🟡 中 | MCPサーバー応答なし | Figma MCP等がクラッシュ・タイムアウト | MCP呼び出しタイムアウト設定 |
| 🟡 中 | Issue チェックボックス同時更新の後勝ち | 複数Worker同時completed | Manager側でIssue更新を直列キュー化 |

## 検証・動作確認方法

1. einja-team-exec/SKILL.md が単体で実行可能なドライバーとして読めること
2. einja-issue-team-exec が einja-team-exec を参照しつつ、Issue固有のフローが動作すること
3. director-prompt-template.md のプレースホルダーが明確で、Issue版 director-prompt.md がテンプレートを正しく継承していること
4. message-schemas.md の全メッセージ定義が einja-issue-team-exec/message-schemas.md のスーパーセットであること
5. Platform hooks のスクリプトが正しいパスにシグナルファイルを作成すること
6. **tmux Worker起動テスト**: `tmux split-window` → `claude` 送信 → ポーリング待機 → `/einja-task-exec` 送信 の一連が確実に動作すること
7. **AskUserQuestionガードテスト**: `EINJA_AGENT_ROLE=worker` 環境下で `einja-task-commit`, `_einja-task-qa`, `einja-conflict-resolver` がPENDING_QUESTIONSプロトコルにフォールバックすること
8. **簡易E2Eテスト**: 3ファイル並列編集タスクでeinja-team-execを実行し、シグナル検知→品質ゲート→クリーンアップの一連フローが動作すること
9. **einja-task-exec AUQ禁止指示の検証**: einja-task-exec のWorker subagentプロンプトに AUQ禁止指示が含まれていること（grep確認）
10. **権限モード検証**: tmux Worker起動後のpane出力に権限バイパス指標が含まれ、未検出時にwarningシグナルが生成されること
11. **silent failure検知**: Agent toolモードでWorkerが無応答終了した場合、TaskListステータス確認でfailed判定されること
