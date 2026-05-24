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
GitHub Issue全体のタスクを Lead → Director(Teammate Pool) → Worker(Subagent) の3ロール体制で並列実行する。
Agent Teams の共有TaskListとself-claimによるワーカープール方式で、tmux不要、Desktop/CLI両対応。

## 共通プロトコル参照

共通ルール（ステータス遷移、ゲートチェック、リトライ、マージモード等）は以下を参照:
- [Issue実行共通プロトコル](../../../docs/einja/instructions/issue-exec-protocol.md)
- [ブランチ運用戦略](../../../docs/einja/steering/branch-strategy.md)
- [タスク管理ガイドライン](../../../docs/einja/steering/task-management.md)

---

## Step A〜C: 入力の解析

`$ARGUMENTS` を自然言語として解析し、以下の項目を抽出する:

### 抽出項目

| 項目 | 必須 | デフォルト | 例 |
|------|------|-----------|-----|
| Issue番号 | Yes | - | `#123`, `45番`, `issue 78` |
| マージモード | No | `manual` | `auto`, `task-group-auto`, `manual` |
| 実行範囲（max-phase） | No | Phase 1のみ | `phase2まで`, `phase1のみ`, `全部` |
| ベースブランチ | No | `main` | `develop`, `feature/xxx` |
| セッション復旧 | No | `false` | `resume`, `再開`, `途中から` |

### 解析ルール

1. Issue番号が見つからない場合 → AskUserQuestion で確認
2. マージモードが明示されない場合 → AskUserQuestion で確認:
   - `manual`（推奨）: PRを手動でマージ。Note: 各PRを目視レビューしてからマージ。安全だが手間がかかる
   - `task-group-auto`: タスクグループPRをCI通過後に自動マージ。Note: Phase PRは手動マージ。バランス型
   - `auto`: 全PRをCI通過後に自動マージ。Note: 最速だがレビュー機会が減る。信頼性の高いCI環境向け
3. `auto` や `全部やって` → マージモード `auto`
4. `resume` `再開` `途中から` → セッション復旧モード

---

## Step 0: 環境準備・前提条件チェック

### 0-1. Agent Teams 有効確認

```bash
# 環境変数の確認
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

- 無効な場合: ユーザーに以下を案内して停止:
  ```
  Agent Teams が有効になっていません。以下の方法で有効化してください:
  - CLI: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
  - Desktop: Settings → Experimental → Agent Teams を有効化

  または tmux版の einja-issue-exec Skill を使用してください。
  ```

### 0-1.5. tmuxセッション確認（TEAMMATE_MODE=tmux時）

```bash
echo $CLAUDE_CODE_TEAMMATE_MODE
echo $TMUX
```

- `CLAUDE_CODE_TEAMMATE_MODE=tmux` かつ `$TMUX` が空の場合: AskUserQuestionで確認:
  - **tmuxモードで再実行（推奨）**: 「tmuxセッション内で再実行してください。iTerm2をお使いの場合は `tmux -CC` で統合モードを推奨します（Teammateがペイン分割で表示されます）」→ 停止
    - Note: Teammateの進行状況がリアルタイムで見える。CLI環境向け
  - **プロセス内モードで続行**: tmux統合なしでAgent Teamsを実行（Teammateはバックグラウンドプロセスとして起動）
    - Note: Desktop/VSCode等tmuxが使えない環境で利用可能。Teammateの可視性は低い

### 0-2. GitHub CLI 確認

```bash
gh auth status
```

- 認証失敗 → ユーザーに `gh auth login` を案内して停止

### 0-3. 途中再開チェック（resume フラグ時）

```bash
# issue ブランチの存在確認
git branch -r | grep "origin/issue/${N}"

# Phase ブランチ・task ブランチの状態確認
git branch -r | grep "origin/issue/${N}-phase"
git branch -r | grep "origin/task/${N}-"

# 既存 PR の状態確認
gh pr list --search "issue/${N}" --state all --json number,title,state,headRefName,baseRefName
```

- 未完了タスクを特定し、Step 3 の TaskList に再登録
- 完了済みタスクは completed 状態で登録（依存解除のため）

---

## Step 1: Issue パース

```bash
gh issue view ${N} --json title,body,labels
```

Issue本文から以下を抽出:
- Phase構造（Phase 1, Phase 2, ...）
- 各Phase内のタスクグループ（X.Y 形式）
- タスクグループ内の個別タスク（X.Y.Z 形式）
- タスクグループ間の依存関係
- Phase間の暗黙的依存（Phase N+1 は Phase N 完了後に開始）

---

## Step 2: ブランチ作成

```bash
# ベースブランチの最新を取得（冪等ブランチ作成の前提）
git fetch origin

# Issue ブランチ作成（冪等）
BRANCH="issue/${N}"
BASE="origin/${baseBranch}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"  # リモートからローカル作成
else
  git branch "$BRANCH" "$BASE"  # 新規作成
fi
git push -u origin "$BRANCH" 2>/dev/null || true

# Phase ブランチ作成（冪等）
BRANCH="issue/${N}-phase1"
BASE="issue/${N}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"  # リモートからローカル作成
else
  git branch "$BRANCH" "$BASE"  # 新規作成
fi
git push -u origin "$BRANCH" 2>/dev/null || true

# ※ git checkout は使用しない。git branch でHEADを変えずにブランチを作成する
# ※ lock系エラー（packed-refs.lock, FETCH_HEAD.lock, cannot lock ref等）発生時は
#    jitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）
```

- resume 時は既存ブランチを再利用（作成済みブランチはスキップ）

---

## Step 2.5: spec読込 + AC抽出

**目的**: spec/Issue の読み込み・AC抽出を行い、TaskCreate の description に埋め込む。

1. **specディレクトリを探索**: `docs/specs/issues/*/issue{N}-*/` パターンで検索
2. **存在チェック**:
   - 完全なspec（requirements.md + design.md + qa-tests/） → 次へ
   - 部分的spec → エラー終了（`einja-issue-spec-create` Skill の実行を案内）
   - specなし → `_einja-general-context-loader` Skill を呼び出してコンテキスト収集
3. **requirements.md を読み込み**、各タスクグループのメタデータ（`**要件**: Story X`）に基づいてACを抽出
   - ACはGiven/When/Then形式で小さい（~50-100トークン/AC）ので直接保持
4. **design.md はパスのみ特定**（内容は読み込まない）
   - 各タスクの`**対応設計**: design.md「セクション名」`からセクション名を記録
5. 抽出結果を Step 3 の TaskCreate description に埋め込む

---

## Step 3: 共有 TaskList 作成（依存関係付き）

TaskCreate で各タスクグループを登録する。

### 登録ルール

各タスクグループについて:

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

    ※ [実行サブエージェント] 未指定の場合、Directorは task-executer をデフォルト使用
    ※ タスクグループレベルの指定はタスクレベルでオーバーライド可能

    ## specパス（フォールバック用）
    {specパス}/
```

### 依存関係の設定

- **Phase間依存**: Phase 2 のタスクは Phase 1 の**全タスク**を `addBlockedBy` に指定
- **Phase内依存**: Issue本文に明示された依存関係に基づき `addBlockedBy` を設定
- **依存なし**: Phase内で依存関係が明示されていないタスクは並列実行可能（blockedBy なし）

### resume 時の TaskList 再構築

- 完了済みタスク: status = `completed` で登録
- PR作成済み・未マージ: status = `in_progress` で登録
- 未着手: status = `open` で登録（依存関係も再設定）

---

## Step 4: TeamCreate → Director プール spawn

### プールサイズ決定

```
poolSize = min(タスクグループ総数, 5)
```

### チーム作成

```
TeamCreate:
  teamName: "issue-{N}-directors"
  mode: "bypassPermissions"
  teammates: [{poolSize}個の Teammate 定義]
```

### Teammate spawn時の権限モード

各 Teammate の `mode` に `"bypassPermissions"` を指定する。これにより Teammate 内のツール呼び出しで承認プロンプトが不要になる。

**安全ガード**: CLAUDE.md のルール（git安全ルール、破壊的操作禁止等）は引き続き適用される。

### Director Teammate プロンプトテンプレート

各 Teammate の instructions には [`director-prompt.md`](./director-prompt.md) の内容を設定する。

Lead は TeamCreate 時に `Read(".claude/skills/einja-issue-team-exec/director-prompt.md")` でプロンプトを取得し、`{N}` 等のプレースホルダーを置換して instructions に渡す。

---

## Step 5: 監視（シグナルファイル + SendMessage）

Lead の監視ループ:

> **重要**: Leadの監視待機にはシグナルファイル方式を使用する。`sleep` によるポーリングは禁止。
> ```bash
> # シグナルファイル待機（最大120秒、2秒間隔チェック、複数Director同時完了対応）
> SIGNAL_DIR=~/.einja/sessions/issue-{N}/signals
> mkdir -p "$SIGNAL_DIR"
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
> - DirectorはSendMessage送信**後に** `touch ~/.einja/sessions/issue-{N}/signals/director-{ID}.signal` を実行する
> - Leadはシグナル受信後、ステータスファイルとSendMessageキューを両方チェックして処理する
> - `processed_pr_numbers` セットにより同一イベントの二重処理を防止
>
> **タイムアウト時のフォールバック**: 120秒経過してもシグナルが検出されなかった場合、Leadは以下を実行する:
> 1. 全DirectorからのSendMessageキューに未読メッセージがないか確認する。`[pr-ready]`・`[error]`・`[idle]` 等のメッセージが届いていればシグナル受信時と同様に処理する
> 2. 未読メッセージがなければ、全Directorの最終応答時刻を確認し、長時間（10分以上）応答がないDirectorを検出する
> 3. 応答停止Directorがなければ監視ループの先頭に戻り、再度120秒のシグナル待機に入る
> 4. **最大待機上限**: 応答停止Director検出時、または連続15回（約30分間）未読メッセージも応答停止もない場合、全Directorの状態をユーザーに報告し手動介入を促す。正常に実装中のDirectorを誤検知しないよう、応答停止（SendMessage/TaskOutput が一定時間ない）を条件とする
> これはシグナルファイルの作成漏れ、Directorのハングに対する防御策である

### 5-1. Director からの SendMessage 受信

| メッセージ種別 | 対応 |
|--------------|------|
| `[progress]` 進捗報告 | ログとして記録（ユーザーへの表示は任意） |
| PR作成報告 | ゲートチェック実施（protocol.md 準拠の Fast Gate / Risk Gate） |
| `[error]` エラー報告 | リトライ判断 |
| `[idle]` idle 通知 | 次の Phase/タスク状況確認 |
| `[task-claim]`（broadcast） | ログ記録 + Director-ファイルマップ更新 |
| `[change-summary]`（broadcast） | ログ記録 + ファイル競合俯瞰チェック（→ Step 5-6） |
| `[conflict-resolved]` | ログ記録 + 調整内容の妥当性簡易確認 |
| `[conflict-alert]`（タイムアウト時） | Leadが調整方針を決定し両Directorに指示 |
| `[pr-ready] Task {X.Y}: PR #{PR番号}` | ゲートチェック実施（Fast Gate / Risk Gate）→ `[verdict]` をDirectorに返信 |
| `[ci-failure]`（Lead → Director） | CI失敗検知時、Lead が原因DirectorのPRを特定し修正指示を送信 |
| `[peer-review]` エスカレーション | Director が判断に迷った場合、`[peer-review]` をLeadに転送。Leadが最終判断 |

### 5-1a. verdict フロー（[pr-ready] 受信時）

1. Director から `[pr-ready] Task {X.Y}: PR #{PR番号}` を受信
2. ゲートチェック実施（protocol.md 準拠の Fast Gate / Risk Gate）
3. チェック結果に応じて Director に `[verdict]` を返信:
   - `[verdict] Task {X.Y}: approved` — Fast Gate / Risk Gate 通過
   - `[verdict] Task {X.Y}: fix_required fixInstructions: {修正内容}` — ゲートチェック失敗時の修正指示
   - `[verdict] Task {X.Y}: rejected` — fixCount超過またはユーザーエスカレーション後の却下
4. fix_required 時: fixCount をインクリメント。最大2回まで修正指示 → 3回目NG → AskUserQuestion でユーザーにエスカレーション（ゲートチェックの詳細は Step 5-2 参照）

### 5-2. ゲートチェック（protocol.md 参照）

1. **Fast Gate 通過** → マージモードに応じた処理:
   - `manual`: PR URL をユーザーに通知、マージ待ち
   - `task-group-auto`: `gh pr merge --squash --auto` 実行
   - `auto`: CI通過確認後に `gh pr merge --squash` 実行

2. **Risk Gate 発火** → 追加確認（protocol.md の Risk Gate 条件に従う）

3. **不通過** → Director に修正指示:
   - SendMessage で修正内容を通知
   - fixCount をインクリメント
   - 最大2回まで修正指示 → 3回目NG → AskUserQuestion でユーザーにエスカレーション

### 5-3. マージ検知

| マージモード | 検知方法 |
|------------|---------|
| `manual` | AskUserQuestionでユーザーにマージ完了を確認（PRマージは外部イベントのためポーリング不適） |
| `task-group-auto` | `gh pr merge --squash --auto` 実行 → CI通過で自動マージ |
| `auto` | CI通過確認後に `gh pr merge --squash` 実行 |

### 5-4. マージ後処理

1. TaskUpdate でタスク status を `completed` に更新
2. **Issue説明文のチェックボックス更新**（protocol.md「2.3 completed 遷移時の必須アクション」参照）
3. blockedBy 解除（依存タスクが claimable になる）
4. idle Director が次タスクを自動 claim

### 5-5. ポーリング停止・再開（protocol.md 参照）

| 条件 | 動作 |
|------|------|
| 1時間無変化 | 停止、待機モードへ |
| 待機中 | 低頻度ハートビート（5分間隔） |
| トリガー検知 | 通常ポーリング復帰 |

- `processed_pr_numbers` セットで冪等処理を保証（同一PRの二重処理を防止）

### 5-6. ファイル競合俯瞰チェック

Director の `[task-claim]` と `[change-summary]` から、Director別の変更ファイルマップをメモリ保持する。

- `[task-claim]` 受信時: 宣言されたファイルリストをマップに登録
- `[change-summary]` 受信時: 実際の変更ファイルでマップを更新
- 重複ファイル検出時: 関係Directorに `[conflict-alert]` を送信
- Director自身の `[task-claim]` 時チェックのバックアップとして機能（Director間の非同期タイミングで漏れる場合のセーフティネット）

---

## Step 6: Phase 完了処理

### Phase完了条件（protocol.md 準拠: 全3条件）

1. Phase内の全タスクグループPRがマージ済み
2. Phase内の全タスクが `completed` ステータス
3. 処理中（inflight）のタスクがないこと

### 完了時の処理

Phase PR 作成: einja-create-pr Skill で作成
  - `--auto --base issue/${N}`
  - `--head issue/${N}-phase{M}`

> **changeset生成について**: Phase PRでは`einja-create-pr`のchangesetスキップ条件「`apps/` 配下に変更がない」に自然に該当するケースが多い。該当しない場合もchangesetが生成されるが、Phase PRでは無害（squash merge時に消える）。

マージモードに応じた処理:
- `manual`: ユーザーにPR URLを通知
- `task-group-auto` / `auto`: CI通過確認後にマージ

### マージ後の次Phase準備

```bash
# 次Phase ブランチ作成（冪等）
git fetch origin
BRANCH="issue/${N}-phase{M+1}"
BASE="origin/issue/${N}"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  : # 既存ローカルブランチを再利用
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git branch "$BRANCH" "origin/$BRANCH"  # リモートからローカル作成
else
  git branch "$BRANCH" "$BASE"  # 新規作成
fi
git push -u origin "$BRANCH" 2>/dev/null || true
# ※ git checkout は使用しない。git branch でHEADを変えずにブランチを作成する
# ※ lock系エラー発生時はjitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）
```

- Phase {M+1} タスクを TaskList で unblock（blockedBy 解除）
- idle Director Teammates が Phase {M+1} タスクを claim 開始

---

## Step 7: Phase完了 → 待機モード

指定Phaseの実行が完了したら、**チームを維持したまま待機モード**に入る:

1. Phase PR作成（未作成の場合）: einja-create-pr Skill で作成
2. 完了報告をユーザーに表示（完了Phase、作成PR一覧、残りPhase）
3. **AskUserQuestion で次のアクションを確認**:
   - **次のPhaseを実行**: 次のPhaseの実行を開始。idle Director が新タスクを claim
     - Note: 現在のPhaseがマージ済みであることを確認してから開始
   - **修正を実施**: レビュー指摘やテスト結果に基づく修正を実行
     - Note: 修正対象のPR番号・指摘内容を入力。該当Directorに修正指示を SendMessage
   - **セッションを終了**: チーム解散・クリーンアップして終了
     - Note: 後で `--resume` で再開も可能
   - **その他（自由入力）**: 追加指示を入力

## Step 8: 全Phase完了 → 最終PR・待機

全Phaseが完了した場合:
1. einja-create-pr Skill で最終PR作成:
   ```
   --auto --base ${baseBranch}
   head: issue/${N}
   ```
2. PR URL をユーザーに表示
3. Issue にコメント追加（実行結果サマリ）
4. **チームを維持したまま待機モード**に入る（クリーンアップしない）
5. **AskUserQuestion で次のアクションを確認**:
   - **修正を実施**: マージ後のレビュー指摘・テスト失敗への修正
     - Note: 修正対象のPR番号・指摘内容を入力
   - **セッションを終了**: チーム解散・クリーンアップして完全終了
   - **その他（自由入力）**: 追加指示を入力

## Step 9: クリーンアップ（ユーザー指示時のみ）

**ユーザーが明示的に「セッションを終了」を選択した場合のみ実行する。**

1. 全 Director に `shutdown_request` を SendMessage で送信
2. TeamDelete でチーム解散:
   ```
   TeamDelete:
     teamName: "issue-{N}-directors"
   ```
3. ローカルブランチ・worktree のクリーンアップ:
   ```bash
   # worktree 削除
   git worktree list | grep "task-${N}-" | awk '{print $1}' | xargs -I {} git worktree remove {} --force

   # ローカル task ブランチ削除
   git branch | grep "task/${N}-" | xargs git branch -D
   ```

---

## メッセージプレフィックス規約

プレフィックス一覧・broadcastルール・スキーマの詳細は [`message-schemas.md`](./message-schemas.md) を参照。

Lead・Director 双方がメッセージ送受信時にこのファイルを参照する。

---

## エラーハンドリング（Agent Teams固有）

| 障害 | 検知 | 対応 |
|------|------|------|
| Director Teammate 停止（PR作成前） | idle 通知 + タスク状態が in_progress のまま | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗はユーザーエスカレーション |
| Director Teammate 停止（PR作成済み） | idle 通知 + PR あり | スキップ（PRマージ待ちのまま継続） |
| Director Teammate 停止（修正中: fix_required 対応中） | idle 通知 + fixCount > 0 | Lead が新 Teammate spawn（fixCount 引き継ぎ）→ 超過時はユーザーエスカレーション |
| タスク失敗（task-executer 実行エラー） | Director からの SendMessage | Director がリトライ（最大2回）→ 3回目は Lead にエスカレーション → ユーザーにエスカレーション |
| レビュー不合格（task-reviewer MAJOR 超過） | Director からの SendMessage | Director が該当タスク再実行（最大2回）→ 3回目は Lead にエスカレーション |
| QA失敗（task-qa FAILURE B/C/D） | Director からの SendMessage | Lead がユーザーにエスカレーション（実装ミス(A)は Director が自動再実行） |
| PR作成失敗 | `gh pr create` エラー | Director が再試行（認証エラーの場合は Lead にエスカレーション） |
| マージコンフリクト | git merge/rebase 失敗 | `einja-conflict-resolver` Skill 呼び出し |
| CI 失敗 | `gh run` status チェック | Director が修正 → 再push → 再CI待機 |
| CI 待機タイムアウト | 30分超過 | Lead がユーザーに AskUserQuestion で通知 |
| GitHub API 認証失敗 | gh コマンドエラー | Lead がユーザーに通知して停止 |
| Lead セッション断絶 | - | session resume 不可（Agent Teams の既知制限）。再実行時に issue ブランチの状態から途中再開 |

---

## ブランチ構成

```
{baseBranch}
 └── issue/{N}                    ← Lead が作成
      ├── issue/{N}-phase1        ← Lead が作成
      │    ├── task/{N}-1.1       ← Teammate A が作成・作業・PR (base: phase1)
      │    └── task/{N}-1.2       ← Teammate B が作成・作業・PR (base: phase1)
      └── issue/{N}-phase2        ← Lead が Phase 1 完了後に作成
           └── task/{N}-2.1      ← Teammate C が作成・作業・PR (base: phase2)
```

