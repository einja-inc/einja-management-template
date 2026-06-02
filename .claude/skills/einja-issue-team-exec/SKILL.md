---
name: einja-issue-team-exec
description: "Agent TeamsによるIssue並列実行Skill。Lead→Director(Teammate Pool)→Worker(Subagent)の3ロール体制で、共有TaskListとself-claimによるワーカープール方式で並列実行。tmux不要、Desktop対応。Do NOT use for: tmux環境での単一プロセス実行（→ einja-issue-exec）、Agent Teams未有効環境。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
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
  - MultiEdit
  - Bash
  - Grep
  - Glob
  - WebFetch
  - AskUserQuestion
  - mcp__github__*
  - mcp__playwright__*
---

# Issue 実行コマンド - Agent Teams版（Lead）

## 役割

GitHub Issue 全体のタスクを Lead → Director(Teammate Pool) → Worker(Subagent) の 3 ロール体制で並列実行する。

> **汎用フロー詳細は [`einja-team-exec/SKILL.md`](../einja-team-exec/SKILL.md) を参照。**
>
> 本 Skill は einja-team-exec の汎用実行ドライバーに、**Issue 並列実行固有の要素**（spec 読込、Phase 管理、PR Gate、ブランチ命名 `issue/{N}` / `issue/{N}-phase{M}`、QA フェーズ、docs-updater、Phase 99）を上乗せした派生 Skill である。

## 補助ファイル参照

| ファイル | 内容 |
|---------|------|
| [`director-prompt.md`](./director-prompt.md) | Issue 固有差分のみを記述（汎用テンプレートを継承） |
| [`message-schemas.md`](./message-schemas.md) | Issue 固有の **内部マーカー**（`[review-failed]` / `[qa-failed]`、SendMessage 不使用のパース用トークン）と、汎用 `[change-summary]` の Issue 固有拡張フィールド（`PR`）を定義。汎用メッセージは einja-team-exec を参照 |
| [Issue 実行共通プロトコル](../../../docs/einja/instructions/issue-exec-protocol.md) | ステータス遷移、ゲートチェック、リトライ、マージモード等 |
| [ブランチ運用戦略](../../../docs/einja/steering/branch-strategy.md) | ブランチ階層・命名規則 |
| [タスク管理ガイドライン](../../../docs/einja/steering/task-management.md) | TaskList 運用ルール |

---

## Step A〜C: 入力の解析

`$ARGUMENTS` を自然言語として解析し、以下を抽出する:

| 項目 | 必須 | デフォルト | 例 |
|------|------|-----------|-----|
| Issue 番号 | Yes | - | `#123`, `45番`, `issue 78` |
| マージモード | No | `manual` | `auto`, `task-group-auto`, `manual` |
| 実行範囲（max-phase） | No | Phase 1 のみ | `phase2まで`, `phase1のみ`, `全部` |
| ベースブランチ | No | `main` | `develop`, `feature/xxx` |
| セッション復旧 | No | `false` | `resume`, `再開`, `途中から` |

### 解析ルール

1. Issue 番号が見つからない場合 → AskUserQuestion で確認
2. マージモードが明示されない場合 → AskUserQuestion で確認:
   - `manual`（推奨）: PR を手動マージ。安全だが手間
   - `task-group-auto`: タスクグループ PR を CI 通過後に自動マージ。Phase PR は手動
   - `auto`: 全 PR を CI 通過後に自動マージ。最速だがレビュー機会が減る
3. `auto` や `全部やって` → マージモード `auto`
4. `resume` `再開` `途中から` → セッション復旧モード

---

## Step 0: 環境準備・前提条件チェック

> **【必須】処理開始前に `einja-common:agent-teams-guide` Skill を Skill ツールで読み込むこと。** TeamCreate / teammate 管理 / ファイル競合防止策 / フォールバック手順といった Agent Teams 利用時の必守ルールを参照するため、本 Skill 起動直後に最初に実行する。
>
> **汎用の Agent Teams 有効確認・表示モード検出は [`einja-team-exec/SKILL.md` Step 1-A](../einja-team-exec/SKILL.md#step-1-a-前提条件環境検出) を参照。**
>
> ### 【最重要・上書き】汎用 fallback の不継承
>
> [`einja-team-exec/SKILL.md` Step 1-A（およびフォールバック節 Step 1-A-fb）](../einja-team-exec/SKILL.md#step-1-a-前提条件環境検出) では「Agent Teams 無効時は Agent tool (Task) ベースの並列実行へ自動 fallback する」と定義されているが、**本 Skill（einja-issue-team-exec）ではこの汎用 fallback を継承しない**。
>
> 理由: Issue 並列実行は Issue 単位の Phase / タスクグループ / PR Gate / verdict フロー / docs-updater / Phase 99 等の前提に依存しており、Agent tool ベースの汎用 fallback では Issue 固有の Lead↔Director↔Worker メッセージング・PR ゲートチェック・Phase ブランチ運用が成立しないため。
>
> 本 Skill では Agent Teams が無効な場合、**実行を停止し** `einja-issue-exec`（tmux 版）への切替をユーザーに案内する仕様で固定する（詳細は下記「Issue 固有チェック」項目 1）。einja-team-exec を参照している他セクション（Step 4 / Step 5 / Step 9 など）でも、本オーバーライドが優先されることに留意すること。

### Issue 固有チェック

1. **Agent Teams 無効時の挙動（汎用 fallback の不継承）**: 上記「最重要・上書き」のとおり、Agent Teams が無効と判定された場合は **汎用 Agent tool fallback には進まず、本 Skill の実行を停止する**。AskUserQuestion 等でユーザーに以下を案内する:
   - tmux 環境がある場合 → `einja-issue-exec` への切り替え
   - tmux 環境もない場合 → Agent Teams を有効化（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 等）して再実行
   - いずれも不可な場合 → 単一 Issue でも `einja-task-exec` を順次実行することを案内
   汎用テンプレートに自動 fallback してはならない（Issue 固有の PR Gate / Phase 管理が無効化されるため）
2. **GitHub CLI 確認**:
   ```bash
   gh auth status
   ```
   認証失敗 → ユーザーに `gh auth login` を案内して停止
3. **途中再開チェック**（resume フラグ時）:
   ```bash
   git branch -r | grep "origin/issue/${N}"
   git branch -r | grep "origin/issue/${N}-phase"
   git branch -r | grep "origin/task/${N}-"
   gh pr list --search "issue/${N}" --state all --json number,title,state,headRefName,baseRefName
   ```
   未完了タスクを特定して Step 3 の TaskList に再登録。完了済みタスクは `completed` 状態で登録（依存解除のため）

---

## Step 1: Issue パース

```bash
gh issue view ${N} --json title,body,labels
```

Issue 本文から以下を抽出:

- Phase 構造（Phase 1, Phase 2, ...）
- 各 Phase 内のタスクグループ（X.Y 形式）
- タスクグループ内の個別タスク（X.Y.Z 形式）
- タスクグループ間の依存関係
- Phase 間の暗黙的依存（Phase N+1 は Phase N 完了後に開始）

---

## Step 2: ブランチ作成（Issue 固有）

汎用テンプレートの worktree 作成手順とは別に、Lead は Issue/Phase レベルのブランチを事前作成する:

```bash
git fetch origin

# Issue ブランチ作成（冪等）
BRANCH="issue/${N}"
BASE="origin/${baseBranch}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true

# Phase ブランチ作成（冪等）
BRANCH="issue/${N}-phase1"
BASE="issue/${N}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true
```

- **重要**: `git checkout` は使用しない。`git branch` で HEAD を変えずに作成する
- lock 系エラー（packed-refs.lock 等）→ jitter 付き 1〜2秒待機して再試行（最大3回、全失敗時は abort）
- resume 時は既存ブランチを再利用
- Director / Worker レベルのブランチ・worktree 作成は [`director-prompt.md`](./director-prompt.md) と汎用テンプレートを参照

---

## Step 2.5: spec 読込 + AC 抽出（Issue 固有）

**目的**: spec / Issue を読み込み、AC を抽出して TaskCreate の description に埋め込む。

1. **spec ディレクトリ探索**: `docs/specs/issues/*/issue{N}-*/` パターンで検索
2. **存在チェック**:
   - 完全な spec（`requirements.md` + `design.md` + `qa-tests/`） → 次へ
   - 部分的 spec → エラー終了（`einja-issue-spec-create` Skill 実行を案内）
   - spec なし → `_einja-general-context-loader` Skill でコンテキスト収集
3. **requirements.md を読み込み**、各タスクグループのメタデータ（`**要件**: Story X`）に基づいて AC 抽出
   - AC は Given/When/Then 形式で小さい（~50-100 トークン/AC）ので直接保持
4. **design.md はパスのみ特定**（内容は読み込まない）。各タスクの `**対応設計**: design.md「セクション名」` からセクション名を記録
5. 抽出結果を Step 3 の TaskCreate description に埋め込む

---

## Step 3: 共有 TaskList 作成（依存関係付き）

> **タスク DAG 作成・プールサイズ決定・File Ownership Registry の汎用フローは [`einja-team-exec/SKILL.md` Step 1-B](../einja-team-exec/SKILL.md#step-1-b-チーム設計フェーズ) を参照。**

Issue 固有の TaskCreate スキーマ:

```
TaskCreate:
  title: "Task {X.Y}: {タスクグループ名}"
  description: |
    ## タスク情報
    - Issue: #{N}
    - Phase: {M}
    - タスクグループ: {X.Y}
    - PR base: issue/${N}-phase{M}
    - マージモード: {mergeMode}

    ## 受け入れ基準（AC）
    Story {S}: {ストーリー名}
      Given: ...
      When: ...
      Then: ...

    ## 設計参照
    {specパス}/design.md → 「{セクション名}」セクション

    ## タスク一覧（X.Y.Z）
    - {X.Y.1}: {タスク名} [{実行サブエージェント}] blockedBy:[] {完了条件}
    - {X.Y.2}: {タスク名} [{実行サブエージェント}] blockedBy:[{X.Y.1}] Skill:{使用Skill} {完了条件}
    ...

    ※ [実行サブエージェント] 未指定の場合、Director は task-executer をデフォルト使用
    ※ タスクグループレベルの指定はタスクレベルでオーバーライド可能

    ## specパス（フォールバック用）
    {specパス}/
```

### 依存関係の設定

- **Phase 間依存**: Phase 2 のタスクは Phase 1 の**全タスク**を `addBlockedBy` に指定
- **Phase 内依存**: Issue 本文に明示された依存関係に基づき `addBlockedBy` を設定
- **依存なし**: Phase 内で依存関係が明示されていないタスクは並列実行可能

### session.json 状態永続化（Agent Teams 版固有）

共有 TaskList（API）とは別に、Lead は `~/.einja/sessions/issue-{N}/session.json` に Agent Teams 版固有のタスク状態を永続化する。これは worktree 消失後・Lead 停止後に**未回収成果物の手掛かり**を残し、resume 復元性を底上げするためのもの（Lead 自身のフル自動復旧はスコープ外）。

> **【スコープ限定】** 以下のフィールドは **Agent Teams 版固有**であり、tmux 版と共通の [`issue-exec-protocol.md`](../../../docs/einja/instructions/issue-exec-protocol.md)（status 遷移定義のみ）には持ち込まない。session.json のスキーマ定義は本 SKILL.md 内に閉じて完結させる。

```jsonc
// ~/.einja/sessions/issue-{N}/session.json
{
  "issue": 123,
  "mergeMode": "manual",
  "baseBranch": "main",
  "tasks": {
    "1.1": {
      "status": "in_progress",          // TaskList と同じ status（pending/in_progress/awaiting_review/completed/failed）
      "worktreePath": "/abs/path/to/worktrees/task-123-1.1",  // Director worktree の絶対パス
      "branch": "task/123-1.1",
      "lastCommitSha": "abc1234",        // 当該 worktree の最終コミット SHA
      "prNumber": 456,                    // 作成済み PR 番号（未作成は null）
      "fixCount": 0,                      // fix_required の累積回数（既存2回ループと共有）
      "retryCount": 0                     // Director 再 spawn 等のリトライ回数
    }
  },
  "processed_pr_numbers": [456]           // 二重処理防止セット（Step 5 の同名セットを永続化）
}
```

**更新タイミング**:

- **Director claim 時**: 当該タスクの `status=in_progress` / `worktreePath` / `branch` を記録（Director の `[task-claim]` 受信時に Lead が書き込む）
- **finalize 時**: `lastCommitSha` / `prNumber` を更新（`[pr-ready]` / `[change-summary]` 受信時）
- **verdict 時**: `fixCount` / `retryCount` を更新（`[verdict] fix_required` 発行時にインクリメント）
- **マージ後処理（5-4）**: `status=completed`、`processed_pr_numbers` に PR 番号を追記

### resume 時の TaskList 再構築

共有 TaskList の status は共通プロトコル（[Issue 実行共通プロトコル](../../../docs/einja/instructions/issue-exec-protocol.md)）に準拠し、通常運用では以下の 4 状態を使用する。失敗時のみ追加で `failed` を許容する:

| status | 用途 |
|--------|------|
| `pending` | 未着手。Director の self-claim 対象 |
| `in_progress` | Director が claim 済み・作業中 |
| `awaiting_review` | Worker 完了後、レビュー/QA/PR Gate 待ち |
| `completed` | PR マージ完了 |
| `failed` | 3回目の失敗で Manager にエスカレーション済み（[`issue-exec-protocol.md`](../../../docs/einja/instructions/issue-exec-protocol.md) §2.1 参照） |

resume 時の再登録ルール:

- 完了済みタスク: `status=completed` で登録
- PR 作成済み・未マージ: `status=awaiting_review` で登録（PR Gate / マージ待ち）
- claim 済みで PR 未作成（実行途中）: `status=in_progress` で登録
- 未着手: `status=pending` で登録（依存関係も再設定）
- エスカレーション済み: `status=failed` のまま再登録（Manager 判断待ち）

> **`in_progress` のまま中断したタスクは再検証（5-4 のマージ後再検証）から再開する。** マージ後再検証中の内部ラベル `awaiting_verification` は Lead のメモリ内にのみ存在し共有 TaskList には書かれないため、resume 時は `in_progress` として復元され、再検証ステップをやり直す（取りこぼし防止）。

**session.json からの復元（Agent Teams 版固有）**: resume 時は `~/.einja/sessions/issue-{N}/session.json` が存在すれば読み込み、以下の手掛かりを復元する:

- 各タスクの `worktreePath` を読み、worktree が残存していれば**未回収成果物の有無**を sanity check（変更後の Step 9 と同じ手順: `git -C <wt> status --short` / `git -C <wt> log --not --remotes HEAD --oneline`）で確認。未コミット/未push の完成成果物があれば finalize 引き取り候補として扱う
- 各タスクの `prNumber` を読み、**未 flip（チェックボックス未更新）の PR** について `gh pr view {PR} --json state` でマージ状態を再チェックし、`MERGED` であれば 5-4 のマージ後処理（再検証 → checkbox flip）を補完実行する（manual モードで未マージ解散後にユーザーがマージしたケースの取りこぼし防止）
- `fixCount` / `retryCount` を引き継いでリトライ上限判定を継続

> **注意**: `open` は使用しない。過去仕様で `open` を用いていた箇所はすべて `pending` に置換済み。`failed` は失敗エスカレーション時のみ使用（共通プロトコル `issue-exec-protocol.md` §2.1 と整合）。

---

## Step 4: TeamCreate → Director プール spawn

> **汎用 TeamCreate 手順・Director プロンプトテンプレート構築は [`einja-team-exec/SKILL.md` Step 1-C](../einja-team-exec/SKILL.md#step-1-c-teamcreatedirector-spawn) を参照。**

### Issue 固有の TeamCreate

```
TeamCreate:
  teamName: "issue-{N}-directors"
  mode: "bypassPermissions"
  teammates: [{poolSize}個の Teammate 定義]
```

> **注釈**: CLAUDE.md「サブエージェント起動時の権限ルール」では Agent tool の `mode` パラメータ指定を禁止しているが、これは **Agent tool（Task）でサブエージェントを起動するケース**に限定したルールである。**TeamCreate は別ツール**であり、Agent Teams の Teammate プロセスは独立した Claude Code インスタンスとして起動するためスコープが異なる。本 Skill では非対話的な並列実行を成立させるため `mode: "bypassPermissions"` を明示指定する（CLAUDE.md のルールは引き続き Agent tool 側に適用される）。

### Issue 固有の instructions 生成手順

Lead は以下の順序で各 Teammate の `instructions` を構築する:

1. **汎用テンプレート読込**: `Read(".claude/skills/einja-team-exec/director-prompt-template.md")`
2. **Issue 固有プロンプト読込**: `Read(".claude/skills/einja-issue-team-exec/director-prompt.md")`
3. **プレースホルダー値の決定**（Issue 固有値は `director-prompt.md` の冒頭表を参照）:
   - `{SESSION_NAME}` = `issue-{N}`
   - `{SESSION_PATH}` = `~/.einja/sessions/issue-{N}`
   - `{BRANCH_PREFIX}` = `task/{N}`
   - `{BASE_BRANCH}` = `origin/issue/{N}-phase{M}`
   - `{OWNERSHIP_MAP}` = Step 3 で構築したマップ
   - `{QUALITY_GATE_STEPS}` / `{ADDITIONAL_WORKER_INSTRUCTIONS}` = `director-prompt.md` 内の該当セクション
4. **instructions 文字列の組み立て**:
   ```
   [Issue 固有プロンプト本文]
   
   ---
   ## 参考: 汎用 Director フロー
   [汎用テンプレート本文（プレースホルダー置換済み）]
   ```
   または、汎用テンプレートをファイル参照させて Issue 固有プロンプトのみを instructions に渡す（Teammate が起動時に `Read` で展開）
5. `mode: "bypassPermissions"` を指定（上記注釈参照: TeamCreate と Agent tool はスコープが異なる。CLAUDE.md のルールは Agent tool 側に引き続き適用）

---

## Step 5: 監視（シグナルファイル + SendMessage）

> **汎用の監視ループ・通知チャネル役割分担・無応答検知・silent failure 検知は [`einja-team-exec/SKILL.md` Step 1-D](../einja-team-exec/SKILL.md#step-1-d-監視ループモード別設計) を参照。**

> **重要**: Leadの監視待機にはシグナルファイル方式を使用する。`sleep` のみの状態ポーリングは禁止。
> ```bash
> # 監視ループ初期化（Lead側で1度だけ実行）
> SIGNAL_DIR=~/.einja/sessions/issue-{N}/signals
> mkdir -p "$SIGNAL_DIR"
> declare -A processed_pr_numbers=()   # 同一 [pr-ready] 等の二重処理防止セット（PR番号をキーに登録）
> # 使用例（Lead の [pr-ready] ハンドラ内）:
> #   if [ "${processed_pr_numbers[$pr_num]+_}" ]; then continue; fi
> #   processed_pr_numbers[$pr_num]=1
> #   # ...（PR Gate / verdict 処理）
>
> # シグナルファイル待機（最大120秒、2秒間隔チェック、複数Director同時完了対応）
> for i in $(seq 1 60); do
>   FOUND=$(ls "$SIGNAL_DIR"/*.signal 2>/dev/null)
>   if [ -n "$FOUND" ]; then
>     for f in $FOUND; do rm -f "$f"; done
>     echo "$FOUND"
>     break
>   fi
>   sleep 2
> done
> ```
>
> **通知チャネルの役割分担**:
> - **シグナルファイル** = 起床トリガー（Leadのbash待機ループを即座に抜けさせる）
> - **SendMessage** = 内容通知（完了/エラー/進捗の詳細情報を運ぶ）
> - DirectorはSendMessage送信**後に** 用途別suffix付きシグナルファイルを `touch` する:
>   - 完了通知: `touch ~/.einja/sessions/issue-{N}/signals/director-{ID}-complete.signal`
>   - アイドル通知: `touch ~/.einja/sessions/issue-{N}/signals/director-{ID}-idle.signal`
>   - エラー通知: `touch ~/.einja/sessions/issue-{N}/signals/director-{ID}-error.signal`
> - Leadはシグナル受信後、TaskList / SendMessageキューを両方チェックして処理する
> - `processed_pr_numbers` セットにより同一イベントの二重処理を防止
>
> **タイムアウト時のフォールバック**: 120秒経過してもシグナルが検出されなかった場合、Leadは以下を実行する:
> 1. 全DirectorからのSendMessageキューに未読メッセージがないか確認する。`[pr-ready]`・`[error]`・`[idle]` 等のメッセージが届いていればシグナル受信時と同様に処理する
> 2. 未読メッセージがなければ、全Directorの最終応答時刻を確認し、長時間（10分以上）応答がないDirectorを検出する
> 3. 応答停止Directorがなければ監視ループの先頭に戻り、再度120秒のシグナル待機に入る
> 4. **最大待機上限**: 応答停止Director検出時、または連続15回（約30分間）未読メッセージも応答停止もない場合、全Directorの状態をユーザーに報告し手動介入を促す。正常に実装中のDirectorを誤検知しないよう、応答停止（SendMessage/TaskOutput が一定時間ない）を条件とする
> これはシグナルファイルの作成漏れ、Directorのハングに対する防御策である

### heartbeat / lease による stall 区別（誤検知防止）

Director は実装中も一定間隔（例 90 秒）で `[heartbeat] Task {X.Y}: alive, phase={implementing|reviewing|qa|finalizing}` を Lead へ送信する（lease 更新として扱う）。Lead 側の扱いは以下:

- **`[heartbeat]` は起床トリガーにしない**: シグナルファイルを `touch` させず、`[progress]` と同様に**キューでバックログ処理**する。Lead は既存のシグナル待機ループ（上記）を**抜けた際に**メッセージキューを読み、`[heartbeat]` を見つけたらログに記録しつつ「Director 別の最終 heartbeat 時刻」をメモリ保持（マップ）として更新する。heartbeat 単体では即時アクションを取らない。
- **heartbeat 継続中は誤 kill しない**: 最終 heartbeat が新しい Director は「長時間実装中」とみなし、stall 扱いにしない（応答停止検知の対象から除外）。
- **heartbeat 途絶 = stall 候補**: lease 失効（最終 heartbeat からの経過が **heartbeat 間隔 × 3**、例 270 秒超）を検知したら初めて stall 候補とし、worktree sanity check（後述の Step 9 / 変更4 と同じ手順: `git -C <wt> status --short` / `git -C <wt> log --not --remotes HEAD --oneline`）を実施 → 未回収成果物があれば finalize 引き取り、なければ再割当（新 Teammate spawn）。
- **検知遅延の限界**: Lead はスリープ後にキューを読むため、lease 失効検知の最大遅延は「シグナル待機間隔（最大 120 秒）＋ 処理時間」となる。stall は分単位の事象なので、この精度で十分（即時性は不要）。

> **2系統の閾値の権威関係**: heartbeat を送る Director に対しては **lease 失効（heartbeat 間隔 × 3）を一次基準**として stall 判定し、上記フォールバックの「10分以上応答なし」検知（370 行）は **heartbeat 非対応 Director または heartbeat 自体が届かないケースのバックストップ**として位置づける。両者は競合せず、lease 失効が先に発火する。

> `[heartbeat]` の本文規約は [`message-schemas.md`](./message-schemas.md)（および汎用 `einja-team-exec/message-schemas.md`）の SSOT に揃える。

### Issue 固有の追加ハンドラ

| メッセージ種別 | Issue 固有処理 |
|--------------|-------------|
| `[pr-ready] Task {X.Y}: PR #{PR番号}` | Issue 固有の **PR Gate**（Fast Gate / Risk Gate）を実施 → `[verdict]` を返信 |
| `[ci-failure]`（Lead → Director） | CI 失敗検知時、Lead が原因 Director の PR を特定して修正指示を送信 |
| `[error]` で `[review-failed]` / `[qa-failed]` 内部マーカーを含む内容 | これらは Director 内部のパース用マーカー（SendMessage では送出されない）。Director が解決不可と判断した場合、`[error]` で包んで Lead に転送される。Issue 仕様レベルの問題なら AskUserQuestion でユーザーへエスカレーション |

### 5-1a. verdict フロー（[pr-ready] 受信時）

1. Director から `[pr-ready] Task {X.Y}: PR #{PR番号}` を受信
2. **Lead-Owned Verification Gate（独立検証・下記 5-1b）を実行** — verdict 付与の**前**に必須。Director の自己申告（task-reviewer/task-qa は Director 配下＝自己採点）を信じず、Lead 側で機械的事実（exit code / bytes>0）に依拠して再検証する
3. **Issue 固有の PR Gate チェック**（protocol.md 準拠の Fast Gate / Risk Gate、下記 5-2）
4. チェック結果に応じて `[verdict]` を返信:
   - `[verdict] Task {X.Y}: approved` — Verification Gate ＋ Fast Gate / Risk Gate 通過
   - `[verdict] Task {X.Y}: fix_required fixInstructions: {修正内容}` — ゲート失敗
   - `[verdict] Task {X.Y}: rejected` — fixCount 超過 or ユーザーエスカレーション後の却下
5. fix_required 時: fixCount をインクリメント。最大2回 → 3回目 NG → AskUserQuestion でユーザーエスカレーション

### 5-1b. Lead-Owned Verification Gate（独立検証・9-1/9-2）

**目的**: 実装主体（Director）≠ 検証主体（Lead）を担保し、ハルシネーション「成功」報告・静的のみ（E2E 未実施）→ マージ後に動かない障害を構造的に排除する。**新 Teammate・新状態・新スキーマは追加しない**。独立性は「実装(Director)≠検証(Lead)＋機械的事実(exit code/bytes>0)依拠」で担保する。

**実行場所（最重要）**: Lead は worktree/checkout を持たず `git branch` のみで HEAD を動かさないため、Lead 自身は実行しない。**Director/phase worktree のパス（session.json の `worktreePath`）を渡した Lead-owned 監査サブエージェント**を spawn し、**そのworktree内で**実行させる（Director 配下の task-qa は流用しない＝独立性のため）。worktree が既に削除済みなら L1 はスキップし L0 のみで判定する。

#### L0 証跡実体検証（常時）

- Outcome Manifest（`artifacts/outcomes/{taskId}-outcome.json`、既存・task-executer/_einja-task-qa 生成）/ qa-tests / modifications の各 evidence が **bytes>0 ＋ exitCode==0 ＋ toolCallId/実ファイル到達可**であることを確認。「存在」ではなく「実体」を見る。空・欠落は即不合格。

#### L1 テスト再実行（常時・最低ライン）

- 監査サブエージェントが対象 worktree 内で `lint/typecheck/build/test`（monorepo は `pnpm --filter {影響package}` で限定）を**再実行**し、**Director の報告値ではなく自分の exit code** で判定。非0 → `fix_required`。

#### 危険シグナル再スキャン（常時）

- diff に `<<<<<<<` / `PARTIAL` / `FAILURE` / 未解決 `TODO`/`FIXME` が混入していないか再スキャン。

#### 結果記録（二枚鑑定）

- 結果を `artifacts/audit/{X.Y}-audit.json`（exit code・stdout 先頭・evidence 照合）に記録する。**この audit.json が無ければ `approved` を出さない**（Director 報告と audit.json の二枚鑑定）。

#### 動作確認の種別別必須化（9-2）

`[pr-ready]` 受信後、`gh pr diff {PR} --name-only` で差分ファイル種別を判定（軽量・常時実行可）し、種別に応じて以下を**必須**とする:

| レベル | 発火条件（差分種別） | 必須検証 |
|--------|--------------------|---------|
| L2（UI） | `.tsx` / `.jsx` / `.css` を含む | **Playwright MCP で代表シナリオ1本を必須実行**（画面表示だけでなく操作フロー到達まで）。Director/phase worktree 上で実行 |
| L2（API） | API/RPC 変更 | **curl で実エンドポイント打鍵必須**（モック不可） |
| L3 | 認証 / 課金 / migration / 外部 API 変更 | **人間受け入れ必須**（`auto` でも `manual` に降格） |
| 静的のみ | 純ロジック / util / docs のみ | L0/L1 で可、E2E スキップ |

> **原理的限界（誠実に明記）**: 本ゲートでも意図・UX・業務ルール解釈・AC 自体の誤りは防げない。→ **認証/課金/データ整合フローの人間受け入れ（L3・後述 Final Sweep）は省略不可**。「QA 漏れを劇的に減らす」ものであり「絶対に防ぐ」ものではない。

> **発火条件（コスト最小化）**: L0/L1 は常時、L2 は UI/API 変更時、L3 は認証等の該当時、Final Sweep（後述 Step 8.5）は解散前1回。fixCount は既存2回ループを流用（監査 FAIL も同ループに乗せる）。

### 5-2. ゲートチェック（protocol.md 参照）

1. **Fast Gate 通過** → マージモード別処理:
   - `manual`: PR URL をユーザーに通知、マージ待ち
   - `task-group-auto`: `gh pr merge --squash --auto`
   - `auto`: CI 通過確認後に `gh pr merge --squash`
2. **Risk Gate 発火** → 追加確認（protocol.md の Risk Gate 条件に従う）
3. **不通過** → Director に修正指示（SendMessage）。fixCount インクリメント。最大2回 → 3回目 NG → ユーザーエスカレーション

### 5-3. マージ検知

| マージモード | 検知方法 |
|------------|---------|
| `manual` | AskUserQuestion でユーザーにマージ完了を確認 |
| `task-group-auto` | `gh pr merge --squash --auto` → CI 通過で自動マージ |
| `auto` | CI 通過確認後に `gh pr merge --squash` |

### 5-4. マージ後処理（チェックボックス flip = 「検証済み done」に紐付け・変更8）

**チェックボックスを `[x]` にするのは「マージしたつもり」ではなく「実マージ＋成果物実在再検証」を表す。** 以下を必須実行し、**全通過時のみ** flip する（既存の「TaskUpdate completed → checkbox 更新」2手を「マージ確認 → 再検証 →（通過時）completed+checkbox /（不通過時）flag」へ拡張）:

1. **マージ実確認**: `gh pr view {PR} --json state,mergedAt,baseRefName` で `state == "MERGED"` を確認。
   - **manual モードの確認順序**: 5-3 の AskUserQuestion（ユーザーへマージ完了確認）の**後**、本 5-4 冒頭で `gh pr view` を**機械的な裏取り**として実行する。ユーザーが「マージ済」と答えたが `state != MERGED` の場合は、箱を付けず PR URL を提示して未チェックのまま次へ進む（二重質問はしない）。
   - PR が未マージなら箱は付けない。
2. **マージ先での再検証**（検証先は `gh pr view` の `baseRefName` ＝ phase ブランチ `issue/{N}-phase{M}`。**main/develop ではない**）:
   - **checkout/switch せず**: `git fetch origin` → `git show origin/{baseRefName}:{path}` または `gh api repos/{owner}/{repo}/contents/{path}?ref={baseRefName}` で**成果物（変更ファイル・modifications/qa-tests 等）の実在**を確認。
   - AC スモークが要る場合は既存の Director/phase worktree 上で実行（Lead はメインツリーを汚さない）。
   - **軽量・冪等**: ファイル実在確認 + AC 代表コマンド1本程度（〜30秒目標）。`processed_pr_numbers` で既処理 PR はスキップ。
3. **不通過時**: 箱を `[x]` にせず、status を `completed` にしない。Lead が `[error]`/ユーザー報告で「マージしたが検証不通過（偽完了候補）」を flag し、必要なら fix ループへ戻す。
4. 全通過時: TaskUpdate でタスク status を `completed` に更新 → **Issue 説明文のチェックボックス更新**（protocol.md「2.3 completed 遷移時の必須アクション」の冪等 sed を**通過時のみ**流用）→ blockedBy 解除（依存タスクが claimable になる）→ idle Director が次タスクを自動 claim。

**再検証中の status（依存ブロック回避）**: マージ確認後〜再検証通過までは **`in_progress` 維持を推奨デフォルト**とし、`completed` 遷移は再検証通過後とする。`awaiting_verification` という呼称を内部で使う場合でも、それは**共有 TaskList には反映せず（TaskUpdate しない）Lead のメモリ内でのみ管理する Agent Teams 版固有の内部ラベル**であり、protocol.md の状態機械（`pending → in_progress → awaiting_review → completed/failed`）には持ち込まない。依存タスクの claim 解放は `completed` 後のままだが、再検証を軽量（〜30秒）に保つことで直列チェーンのスループット低下を最小化する。

**drain-gate（Step 9 / 変更3-0）との関係**: 「checkbox `[x]` = 実マージ＋検証済み」と「drain の終端（manual は PR作成＋push＝worktree 非依存）」は**別閾値**。manual で「PR作成済み・未マージ」は drain 上は安全に解散可（作業は保全）だが、**箱は付かない**（未マージ＝未 done を正しく表す）。

**manual 解散後の flip 主体消失への対処**: manual で未マージのまま解散すると、後でユーザーがマージしても箱を flip する Lead が居ない。→ Step 9 完了報告に「**未チェックで残ったタスクグループ一覧 + PR URL（マージ後に手動 flip 要）**」を必ず含める。加えて resume 時（session.json の `prNumber` 活用）に未 flip PR のマージ状態を再チェックして補完する（上記「session.json からの復元」参照）。

**統合チェーン全体への適用**: タスク箱は「task→phase（baseRefName）マージ＋検証」で flip。**Phase 完了時（Step 6 Phase PR）・最終統合時（issue→develop、Step 8）にも同じ「マージ実確認＋成果物実在再検証」を適用**し、Phase チェック/最終完了が「phase→develop 未到達」のまま done 扱いにならないようにする（#343 の phase→develop 未統合の再発防止）。Phase/最終レベルの検証先は各 PR の `baseRefName`。

### 5-5. ポーリング停止・再開（protocol.md 参照）

| 条件 | 動作 |
|------|------|
| 1時間無変化 | 停止、待機モードへ |
| 待機中 | 低頻度ハートビート（5分間隔） |
| トリガー検知 | 通常ポーリング復帰 |

- `processed_pr_numbers` セットで冪等処理を保証

### 5-6. ファイル競合俯瞰チェック

Director の `[task-claim]` と `[change-summary]` から Director 別の変更ファイルマップをメモリ保持し、重複検知時に `[conflict-alert]` を送信。Director 自身のチェックのバックアップとして機能。

---

## Step 6: Phase 完了処理（Issue 固有）

### Phase 完了条件（protocol.md 準拠: 全3条件）

1. Phase 内の全タスクグループ PR がマージ済み
2. Phase 内の全タスクが `completed` ステータス
3. 処理中（inflight）のタスクがないこと

### 完了時の処理

Phase PR 作成: einja-create-pr Skill で作成
  - `--auto --base issue/${N}`
  - `--head issue/${N}-phase{M}`
  - `--title "Phase ${M}: {Phase名}"`

> **changeset生成について**: Phase PRでは`einja-create-pr`のchangesetスキップ条件「`apps/` 配下に変更がない」に自然に該当するケースが多い。該当しない場合もchangesetが生成されるが、Phase PRでは無害（squash merge時に消える）。

### `_einja-phase-review` 接続（Phase 包括検証・9-3）

Phase PR 作成後、**Lead が `Skill` ツールで `_einja-phase-review` を直接呼ぶ**（既存の `phase-reviewer` Agent / `einja-task-exec` 差し戻し経路は team-exec に無いため経由しない）。Weighted Scorecard ＋ Playwright MCP ＋ フル回帰 ＋ Outcome Manifest 全件検証を再利用する。

- **実行場所**: checkout 済みツリーが前提のため、5-1b 同様に**対象ブランチ（phase ブランチ）を持つ worktree 上で実行**（Lead はメインツリーを汚さない）。diff 範囲は Phase PR の `baseRefName` を引数で渡す。
- **返却値マッピング（必須）**: Lead が `{verdict, score, fixRequired[]}` を受け取り、以下に振り分ける:

  | verdict | 動作 |
  |---------|------|
  | `PASS` / `CONDITIONAL` | Phase PR をマージ（下記マージモード別処理へ） |
  | `FAIL` | `fixRequired[]` を `[verdict] Task {X.Y}: fix_required fixInstructions: {...}` に変換し、該当 Director へ差し戻し（fixCount ループに乗せる） |
  | `PHASE_ESCALATE` | AskUserQuestion でユーザーへエスカレーション |

マージモード別処理（PASS/CONDITIONAL 時のみ）:

- `manual`: ユーザーに PR URL 通知
- `task-group-auto` / `auto`: CI 通過確認後にマージ

> **マージ後の Phase チェック**: Phase 完了の checkbox/done 扱いも 5-4 と同じ「マージ実確認＋成果物実在再検証」（検証先＝Phase PR の `baseRefName`）を経て確定する（phase→develop 未到達のまま done にしない）。

### マージ後の次 Phase 準備

```bash
git fetch origin
BRANCH="issue/${N}-phase{M+1}"
BASE="origin/issue/${N}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"
else
  git branch "$BRANCH" "$BASE"
fi
git push -u origin "$BRANCH" 2>/dev/null || true
```

- Phase {M+1} タスクを TaskList で unblock（blockedBy 解除）
- idle Director Teammates が Phase {M+1} タスクを claim 開始

---

## Step 7: Phase 完了 → 待機モード

指定 Phase の実行が完了したら、**チームを維持したまま待機モード**に入る:

1. Phase PR 作成（未作成時）: `einja-create-pr` Skill で作成
2. 完了報告をユーザーに表示（完了 Phase、作成 PR 一覧、残り Phase）
3. **AskUserQuestion で次のアクションを確認**:
   - **次の Phase を実行**: idle Director が新タスクを claim。現 Phase がマージ済みであることを確認してから開始
   - **修正を実施**: レビュー指摘やテスト結果に基づく修正。修正対象 PR 番号・指摘内容を入力 → 該当 Director に SendMessage
   - **セッションを終了**: チーム解散・クリーンアップ
   - **その他（自由入力）**: 追加指示

## Step 8: 全 Phase 完了 → 最終 PR・待機

全 Phase 完了時:

1. `einja-create-pr` Skill で最終 PR 作成:
   ```
   --auto --base ${baseBranch}
   head: issue/${N}
   ```
2. PR URL をユーザー表示
3. Issue にコメント追加（実行結果サマリ）
4. **チームを維持したまま待機モード**（クリーンアップしない）
5. **AskUserQuestion で次のアクション確認**:
   - **修正を実施**: マージ後のレビュー指摘・テスト失敗への対応
   - **セッションを終了**: チーム解散・クリーンアップして完全終了
   - **その他（自由入力）**: 追加指示

> **最終統合（issue→develop）の再検証タイミング（5-4 L479 の主張との整合）**:
> - **Final Sweep（Step 8.5）は解散前＝issue 最終 PR マージ前の検証**であり、`origin/issue/{N}` の成果物充足を確認するもの。develop（base）への到達自体は保証しない（マージはユーザーが後から実施するため）。
> - **最終 PR マージ後の再検証/flip**は、(a) **チーム維持中（本 Step 8 / Step 7 の待機モード）にユーザーマージを `gh pr view {最終PR} --json state` で検知して実行する**、または (b) **resume 時に session.json の最終 PR 番号でマージ状態を再チェックして補完する**（チーム解散後＝flip 主体の Lead 消失ケースの取りこぼし防止。「session.json からの復元」参照）。
> - これにより「issue→develop も同じマージ実確認＋成果物実在再検証を適用」（5-4 L479）の主張が、待機モード中の検知または resume 補完という**実体を伴う形**で満たされる。

## Step 8.5: Final Sweep（解散前の横断監査・9-4）

> **本 Step は Step 9 の drain-gate（変更3-0）のサブステップとして実行し、`shutdown_request` 送信の前に Final Sweep 通過を必須とする。** Director がまだ居る間に未充足を差し戻すため、解散シーケンスに入る前のここで実行する。

全 Phase 完了後・解散前に **Lead が `Skill` ツールで `_einja-phase-review` を直接呼ぶ**（横断監査。現状 Step 9 は TeamDelete + ブランチ削除のみで横断監査が無いため新設）。

- **検証先 = 最終 Issue ブランチ**: Lead が**一時検証 worktree**（メイン HEAD 非依存）を作成し、そこで実行 → 削除する:
  ```bash
  TMP_WT="$HOME/.einja/sessions/issue-${N}/final-sweep-wt"
  git fetch origin
  git worktree add "$TMP_WT" "origin/issue/${N}"
  # → このworktree内で _einja-phase-review を実行
  git worktree remove "$TMP_WT" --force
  ```
- **diff 範囲**: `git diff --name-only origin/${baseBranch}...origin/issue/${N}` を `_einja-phase-review` に引数で渡す（Issue→base の検証になるよう範囲を明示。Skill 内部の `origin/issue/{N}...HEAD` 固定では Issue→base 検証にならない点に注意）。
- **返却値の扱い**: 9-3 と同じマッピング。FAIL/未充足は**解散前（Director がまだ居る間）に該当 Director へ差し戻し**、修正後に再 sweep。
- **FAIL 時は意図的に再ドレインへ戻る**: Final Sweep FAIL 時は該当タスクが `in_progress` に戻りドレイン未完となる（9-0 ゲート条件「全タスク completed/PR作成済み」を一時的に満たさなくなる）。これは意図した再帰であり、**修正 →（修正 PR の再ゲート）→ 再 Final Sweep → ゲート通過後に shutdown** のサイクルを回す（解散フローには進まない）。
- **drain-gate の終端条件に「Final Sweep 通過」を含める**（Step 9 のゲート参照）。

## Step 9: クリーンアップ（ユーザー指示時のみ）

> **汎用クリーンアップ手順は [`einja-team-exec/SKILL.md` Step 1-G](../einja-team-exec/SKILL.md#step-1-g-クリーンアップ) を参照。**

ユーザーが明示的に「セッションを終了」を選択した場合のみ実行する。

> **【最重要・不変条件】「ドレイン完了 → 破棄」の順序を厳守する（teardown gate・変更3-0）。** Lead は**全ての in-flight 作業を終端まで運んでから**チームを破棄する。破棄時点で失う作業が原理的に存在しない状態を作る。`shutdown_request` / `TeamDelete` / worktree 削除を実行する**前に**、後述の「9-0 ドレインゲート」を必ず通すこと。ユーザー明示の「セッション終了」選択時も同じゲートを通す（即時 `TeamDelete` を禁止）。**例外**: ユーザーが「未完了作業を破棄してでも即終了」と明示した場合のみ、保全対象を報告した上で破棄する。

### 9-0. ドレインゲート（teardown gate・変更3-0）

`shutdown_request` / `TeamDelete` / worktree 削除の**前に**、以下を満たすことを必須ゲートとする:

1. 共有 TaskList に **未push の `in_progress`（claim 中）タスクが残っていない**（全タスクが `completed`、または PR作成済み＋push 確認済み、または明示的に abandoned-and-preserved）。
2. 各タスクグループの PR が **作成済み・ゲート（Verification / Fast / Risk Gate）通過済み**。マージは**マージモード依存**: `auto` / `task-group-auto` はマージ完了まで、`manual` は「**PR作成済み + push済み（worktree 非依存）**」を終端とみなす（ユーザーマージ待ちは終端扱いで可）。
3. 全 Director worktree が **safe-to-delete**（後述 9-3 の保全条件: push済み or PR存在 or マージ済み）。
4. **Final Sweep（Step 8.5・9-4）通過済み**。

**ドレイン手順**: 解散指示を受けたら Lead はまず「残作業の回収フェーズ」に入る — 進行中 Director は heartbeat 継続なら完了を待ち（変更6）、停止していれば sanity check → 引き取り（後述 9-2）。**全タスクが終端に達するまで `shutdown_request` を送らない**。

**manual モードのドレイン完了**: `manual` で「PR作成済み・未マージ」のまま解散指示が来た場合、不変条件は満たす（push済み＝worktree 非依存＝安全）が、Lead は AskUserQuestion で「**先に PR をマージしてから解散 / 未マージのまま解散（PR は残る）**」を確認する。未マージでも worktree 削除は安全なので無限待機はしない。

### 9-1. shutdown ハンドシェイク（安全化・変更3）

ドレインゲート通過後、以下の**ステップ順序**で実行する。**sanity check と引き取りは必ず `TeamDelete`・削除の前**:

1. **ドレインゲート確認**（9-0 の不変条件・Final Sweep 通過）
2. **`shutdown_request` 送信**（各 Director へ）
3. **`shutdown_response` 待機**（タイムアウト例 30 秒）。本文規約は [`message-schemas.md`](./message-schemas.md) の SSOT に揃える:
   ```
   shutdown_response: { approve: true|false, status: "approved"|"deferred", worktree: "{絶対パス or none}", reason: "{未finalize報告 or none}" }
   ```
4. **各 worktree の sanity check**（後述 9-2）
5. **未回収検知時は finalize 引き取り**（後述 9-2）
6. **`TeamDelete`**:
   ```
   TeamDelete:
     teamName: "issue-{N}-directors"
   ```
7. **worktree / branch cleanup**（後述 9-3 の保全条件付き）

### 9-2. worktree 削除前の Lead sanity check（finalize 引き取り・変更4）

worktree を削除する**直前**に、Lead が各 Director worktree で未コミット／未push の完成成果物を検知する:

```bash
# 未コミット差分（自 path 限定・cd しない・git add . 等のグローバル操作禁止）
git -C "$DIRECTOR_WORKTREE_ABS" status --short
# 未push（リモート未到達）コミット。upstream 未設定（初回push前）でも失敗しないよう @{u} は使わない。
# `--branches` を付けるとリポジトリ全体の全ブランチを走査し、別 local ブランチの未pushコミットで
# push済み worktree まで誤検知（過剰保全）するため、当該 worktree の HEAD のみを対象にする。
git -C "$DIRECTOR_WORKTREE_ABS" log --not --remotes HEAD --oneline
```

- 上記いずれかに出力があれば、**finalize 引き取りフロー**を実行する: Fast Gate 相当の検証（成果物存在・`<<<<<<<` / PARTIAL 等の danger-signal なし）に通れば、成果物を破棄せず Lead が `einja-task-commit`（未コミット時）+ `einja-create-pr`（PR 未作成時）を当該 worktree 対象に実行して引き取る。検証 NG のみ新 Teammate で当該タスク再実行。
- この引き取りは **stall 経路だけでなく shutdown/解散経路でも発火**させる（エラーハンドリング表の該当行も「stall **または** shutdown 時」に一般化）。
- **引き取り完了 or 保全判断が済むまで worktree を削除しない**。

### 9-3. worktree / branch cleanup（保全優先・変更2）

```bash
# 削除の前提条件: 当該 branch が (a) PR作成済み or (b) リモートにpush済み or (c) base へマージ済み
# のいずれかを満たす場合のみ削除可。未push かつ未PR かつ未マージは「削除しない・保全」する。
# ※ ループ内で safe-to-delete を明示判定してから削除する（コメントだけに頼らない）。

# worktree 削除（grep はパス基準。git worktree list は `<path> <sha> [<branch>]` 形式）
# grep は N=1 が task-12- に部分一致しないよう、N の直後が非数字であることを要求する。
git worktree list | grep -E "worktrees/task-${N}[^0-9]" | awk '{print $1}' | while read -r wt; do
  br=$(git -C "$wt" rev-parse --abbrev-ref HEAD)
  # safe-to-delete 判定: PR存在 or push済み(リモート到達) or base へマージ済み(未push差分なし) のいずれか
  if gh pr list --head "$br" --state all --json number -q '.[0].number' | grep -q . \
     || git rev-parse --verify --quiet "origin/$br" >/dev/null \
     || ! git -C "$wt" log --not --remotes HEAD --oneline | grep -q .; then
    git worktree remove "$wt" --force
    git branch -d "$br" 2>/dev/null || echo "[preserve] $br は未マージ・保全"
  else
    echo "[preserve] $wt: 未回収成果物あり（削除しない）"
  fi
done

# branch 削除（branch 基準。N の直後が非数字であることを要求し、N=12 が N=123 に部分一致するのを防止）
# 強制削除 -D は使わず -d（マージ済みのみ削除成功）。未マージで消す必要がある場合は
# push済み or PR存在を個別確認してから明示削除する。
# ※ 上の worktree ループで worktree とともに削除済みの branch はここでは「not found」になり無害。
git branch | sed 's/^[* ]*//' | grep -E "^task/${N}[^0-9]" | while read -r br; do
  git branch -d "$br" 2>/dev/null || echo "[preserve] $br は未マージのため保全（push済み/PR存在を確認して明示削除すること）"
done
```

- **未push かつ未PR かつ未マージ**の worktree は**削除しない・保全**し、Lead は `[error]` で「未回収成果物あり」をユーザーへ報告する（9-2 の sanity check と連動）。
- `git branch -D`（強制）→ `git branch -d`（マージ済みのみ削除成功）に変更。未マージで消す必要がある場合は「push済み or PR存在」を個別確認してから明示削除する。

### 9-4. 完了報告とセッション保持

- **完了報告に必ず含める**: 「**未チェックで残ったタスクグループ一覧 + PR URL（マージ後に手動 flip 要）**」（manual 未マージ解散時の flip 主体消失対策・変更8）。保全した worktree/branch があればその一覧も報告する。
- セッションファイル（`~/.einja/sessions/issue-{N}/`）と `session.json` は resume 用に保持する。

---

## メッセージプレフィックス規約

> **汎用メッセージプレフィックス・broadcast ルール・共通スキーマは [`einja-team-exec/message-schemas.md`](../einja-team-exec/message-schemas.md) を参照。**
>
> Issue 固有の **内部マーカー**（`[review-failed]` / `[qa-failed]`、Director 内部パース用・SendMessage 不使用）および汎用 `[change-summary]` の Issue 固有拡張フィールド（`PR`）は [`message-schemas.md`](./message-schemas.md) を参照。

---

## エラーハンドリング（Issue 固有差分）

> **汎用エラーハンドリング・Circuit Breaker は [`einja-team-exec/SKILL.md` Step 1-F](../einja-team-exec/SKILL.md#step-1-f-エラーハンドリングcircuit-breaker) を参照。**

Issue 固有の追加エラーと対応:

| 障害 | 検知 | 対応 |
|------|------|------|
| Director Teammate 停止/stall（finalize 前: 成果物が未完成） | idle 通知 + 成果物（modifications/qa-tests）未生成 | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗は Lead エスカレーション → ユーザーエスカレーション |
| Director stall（finalize 段階: 成果物は完成・未コミット、またはコミット済みだが PR 未作成）**または shutdown/解散時に未回収成果物を検知** | `[error]` 受信、または idle + Director worktree に完成成果物あり（未コミット or コミット済みで PR 未作成）、**または Step 9-2 の sanity check で未コミット/未push を検知** | Lead が `git -C "$DIRECTOR_WORKTREE_ABS" status/diff/log`（cd しない・自 path 限定、`git add .` 等グローバル操作禁止）で点検 → Fast Gate 相当の検証（成果物存在・`<<<<<<<` / PARTIAL 等の danger-signal なし）に通れば、成果物を破棄せず Lead が `einja-task-commit`（未コミット時）+ `einja-create-pr`（PR 未作成時）を当該 worktree 対象に実行して引き取る。検証 NG のみ新 Teammate で当該タスク再実行。**引き取り完了 or 保全判断が済むまで worktree を削除しない**（stall 経路・shutdown/解散経路の両方で発火） |
| Director Teammate 停止（PR 作成済み） | idle 通知 + PR あり | スキップ（PR マージ待ちのまま継続） |
| Director Teammate 停止（修正中: fix_required 対応中） | idle 通知 + fixCount > 0 | Lead が新 Teammate spawn（fixCount 引き継ぎ）→ 超過時は Lead エスカレーション → ユーザーエスカレーション |
| タスク失敗（task-executer 実行エラー） | Director からの SendMessage | Director がリトライ（最大2回）→ 3回目は Lead エスカレーション → ユーザーエスカレーション |
| レビュー不合格（task-reviewer MAJOR 超過） | Director からの SendMessage | Director が該当タスク再実行（最大2回）→ 3回目は Lead エスカレーション → ユーザーエスカレーション |
| QA 失敗（task-qa FAILURE B/C/D） | Director からの SendMessage | Lead エスカレーション → ユーザーエスカレーション（実装ミス(A) は Director が自動再実行） |
| PR 作成失敗 | `gh pr create` エラー | Director が再試行（認証エラーは Lead エスカレーション） |
| マージコンフリクト | git merge/rebase 失敗 | `einja-conflict-resolver` Skill 呼び出し |
| CI 失敗 | `gh run` status チェック | Director が修正 → 再 push → 再 CI 待機 |
| CI 待機タイムアウト | 30 分超過 | Lead が AskUserQuestion でユーザー通知 |
| GitHub API 認証失敗 | gh コマンドエラー | Lead がユーザー通知して停止 |
| Lead セッション断絶 | - | session resume 不可（Agent Teams 既知制限）。再実行時に issue ブランチの状態から途中再開 |

---

## ブランチ構成

```
{baseBranch}
 └── issue/{N}                    ← Lead が作成
      ├── issue/{N}-phase1        ← Lead が作成
      │    ├── task/{N}-1.1       ← Teammate A が作成・作業・PR (base: phase1)
      │    └── task/{N}-1.2       ← Teammate B が作成・作業・PR (base: phase1)
      └── issue/{N}-phase2        ← Lead が Phase 1 完了後に作成
           └── task/{N}-2.1       ← Teammate C が作成・作業・PR (base: phase2)
```
