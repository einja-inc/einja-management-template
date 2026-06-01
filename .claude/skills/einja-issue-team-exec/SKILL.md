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

### resume 時の TaskList 再構築

共有 TaskList の status は共通プロトコル（[Issue 実行共通プロトコル](../../../docs/einja/instructions/issue-exec-protocol.md)）に準拠し、以下の 4 状態のみを使用する:

| status | 用途 |
|--------|------|
| `pending` | 未着手。Director の self-claim 対象 |
| `in_progress` | Director が claim 済み・作業中 |
| `awaiting_review` | Worker 完了後、レビュー/QA/PR Gate 待ち |
| `completed` | PR マージ完了 |

resume 時の再登録ルール:

- 完了済みタスク: `status=completed` で登録
- PR 作成済み・未マージ: `status=awaiting_review` で登録（PR Gate / マージ待ち）
- claim 済みで PR 未作成（実行途中）: `status=in_progress` で登録
- 未着手: `status=pending` で登録（依存関係も再設定）

> **注意**: `open` は使用しない。過去仕様で `open` を用いていた箇所はすべて `pending` に置換済み。

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

### Issue 固有の追加ハンドラ

| メッセージ種別 | Issue 固有処理 |
|--------------|-------------|
| `[pr-ready] Task {X.Y}: PR #{PR番号}` | Issue 固有の **PR Gate**（Fast Gate / Risk Gate）を実施 → `[verdict]` を返信 |
| `[ci-failure]`（Lead → Director） | CI 失敗検知時、Lead が原因 Director の PR を特定して修正指示を送信 |
| `[error]` で `[review-failed]` / `[qa-failed]` 内部マーカーを含む内容 | これらは Director 内部のパース用マーカー（SendMessage では送出されない）。Director が解決不可と判断した場合、`[error]` で包んで Lead に転送される。Issue 仕様レベルの問題なら AskUserQuestion でユーザーへエスカレーション |

### 5-1a. verdict フロー（[pr-ready] 受信時）

1. Director から `[pr-ready] Task {X.Y}: PR #{PR番号}` を受信
2. **Issue 固有の PR Gate チェック**（protocol.md 準拠の Fast Gate / Risk Gate）
3. チェック結果に応じて `[verdict]` を返信:
   - `[verdict] Task {X.Y}: approved` — Fast Gate / Risk Gate 通過
   - `[verdict] Task {X.Y}: fix_required fixInstructions: {修正内容}` — ゲート失敗
   - `[verdict] Task {X.Y}: rejected` — fixCount 超過 or ユーザーエスカレーション後の却下
4. fix_required 時: fixCount をインクリメント。最大2回 → 3回目 NG → AskUserQuestion でユーザーエスカレーション

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

### 5-4. マージ後処理

1. TaskUpdate でタスク status を `completed` に更新
2. **Issue 説明文のチェックボックス更新**（protocol.md「2.3 completed 遷移時の必須アクション」参照）
3. blockedBy 解除（依存タスクが claimable になる）
4. idle Director が次タスクを自動 claim

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

```bash
gh pr create --base issue/${N} --head issue/${N}-phase{M} \
  --title "Phase ${M}: {Phase名}" \
  --body "Phase ${M} の全タスクグループ完了"
```

マージモード別処理:

- `manual`: ユーザーに PR URL 通知
- `task-group-auto` / `auto`: CI 通過確認後にマージ

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

## Step 9: クリーンアップ（ユーザー指示時のみ）

> **汎用クリーンアップ手順は [`einja-team-exec/SKILL.md` Step 1-G](../einja-team-exec/SKILL.md#step-1-g-クリーンアップ) を参照。**

ユーザーが明示的に「セッションを終了」を選択した場合のみ実行する。Issue 固有の差分:

```
TeamDelete:
  teamName: "issue-{N}-directors"
```

```bash
# Issue 固有の worktree / ブランチ削除
git worktree list | grep "task-${N}-" | awk '{print $1}' | xargs -I {} git worktree remove {} --force
git branch | grep "task/${N}-" | xargs git branch -D
```

セッションファイル（`~/.einja/sessions/issue-{N}/`）は resume 用に保持する。

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
| Director 停止（PR 作成済み） | idle 通知 + PR あり | スキップ（PR マージ待ち継続） |
| Director 停止（修正中: fix_required 対応中） | idle 通知 + fixCount > 0 | 新 Teammate spawn（fixCount 引き継ぎ） |
| タスク失敗（task-executer 実行エラー） | Director SendMessage | Director がリトライ（最大2回）→ Lead エスカレーション |
| レビュー不合格（task-reviewer MAJOR 超過） | Director SendMessage | Director が該当タスク再実行（最大2回）→ Lead エスカレーション |
| QA 失敗（task-qa FAILURE B/C/D） | Director SendMessage | Lead がユーザーエスカレーション（A: 実装ミスは Director が自動再実行） |
| PR 作成失敗 | `gh pr create` エラー | 再試行（認証エラーは Lead エスカレーション） |
| CI 失敗 | `gh run` status チェック | Director が修正 → 再 push → 再 CI 待機 |
| CI 待機タイムアウト | 30 分超過 | Lead が AskUserQuestion でユーザー通知 |
| GitHub API 認証失敗 | gh コマンドエラー | ユーザー通知して停止 |
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
