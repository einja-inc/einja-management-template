---
name: einja-issue-team-exec
description: "Agent TeamsによるIssue並列実行Skill。Manager(Lead)→Director(Teammate Pool)→Worker(Subagent)の3ロール体制で、共有TaskListとself-claimによるワーカープール方式で並列実行。tmux不要、Desktop対応。ARGUMENTS: 自然言語でIssue番号や実行オプションを指定（例: '#123 autoで全部やって', '45番 phase2まで'）"
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

# Issue 実行コマンド - Agent Teams版（Lead = Manager）

## 役割
GitHub Issue全体のタスクを Lead(Manager) → Teammate(Director Pool) → Subagent(Worker) の3ロール体制で並列実行する。
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
| 実行範囲（max-phase） | No | 全Phase | `phase2まで`, `phase1のみ` |
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
# ベースブランチの最新を取得
git fetch origin
git checkout ${baseBranch}
git pull origin ${baseBranch}

# issue ブランチ作成
git checkout -b issue/${N}
git push -u origin issue/${N}

# Phase 1 ブランチ作成
git checkout -b issue/${N}-phase1
git push -u origin issue/${N}-phase1
```

- resume 時は既存ブランチを再利用（作成済みブランチはスキップ）

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

    ## タスク一覧
    - {X.Y.1}: {タスク名}
    - {X.Y.2}: {タスク名}
    ...
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
  teammates: [{poolSize}個の Teammate 定義]
```

### Director Teammate プロンプトテンプレート

各 Teammate の instructions に以下を設定:

```
あなたは Director Teammate です。Issue #{N} の並列実行チームの一員として、TaskList からタスクグループを self-claim して実行します。

## 動作ルール

1. **タスク claim**: TaskList から status=open かつ blocked でないタスクを1つ claim（TaskUpdate で status を in_progress に変更）
2. **作業環境準備**:
   - worktree 作成: `git worktree add ../${project-name}-worktrees/task-${N}-{X.Y}`
   - worktree ディレクトリに移動
   - `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ:
     - ブランチ名: `task/${N}-{X.Y}`、ベース: `origin/issue/${N}-phase{M}`
3. **タスク実行**: einja-task-exec Skill を使用して `#{N} {X.Y}` を実行
   - **進捗報告**: 各個別タスク（X.Y.Z）の開始時・完了時に Lead へ SendMessage で報告
   - 形式: `[progress] Task {X.Y.Z}: {started|completed} - {タスク名}`
4. **PR作成**: `gh pr create --base issue/${N}-phase{M} --head task/${N}-{X.Y}`
5. **完了報告**: Lead に SendMessage で報告（PR番号、タスク番号を含む）
6. **クリーンアップ**: worktree 削除
7. **次タスク claim**: TaskList から次の claimable タスクを探索 → claim → 2に戻る
8. **全タスク完了 or claimable なし**: Lead に idle 通知

## 共通プロトコル
issue-exec-protocol.md に準拠:
- ステータス遷移: pending → in_progress → awaiting_review → completed
- コンフリクト発生時: einja-conflict-resolver Skill 使用
- コミット: einja-task-commit Skill 使用
- PR作成: einja-create-pr Skill 使用

## ピア間通信プロトコル

### タスク開始宣言（claim時）
タスクを claim したら、主要編集予定ファイルを含めて broadcast:
- 形式: `[task-claim] Task {X.Y}: {タスク名}\nFiles: {編集予定ファイルリスト}\nDirector: {自分の名前}`
- 受信側: 自分の編集予定ファイルと重複がないかチェック → 重複時は `[conflict-alert]` で当事者間調整
- **宛先マップ管理**: 受信した `[task-claim]` から「誰がどのタスク・どのファイルを担当しているか」のマップを自身のコンテキスト内に保持する。ピアレビューやconflict-alertの宛先特定に使用

### 変更通知（タスク完了時）
タスク完了・PR作成後に、共有リソースの変化に絞って broadcast:
- **共有リソースの定義**: 以下のいずれかに該当するもの
  - `shared/`, `packages/*/src/` 配下の型定義・ユーティリティ関数
  - APIエンドポイント（追加・変更）
  - DBスキーマ（テーブル・カラム追加・変更）
  - 複数タスクグループから参照されるコンポーネント
- 形式:
  ```
  [change-summary] Task {X.Y}: {タスク名}
  PR: #{PR番号}
  Changed files: {全変更ファイルパス（カンマ区切り）}
  Changed shared: {shared/配下の変更ファイル or "なし"}
  New API: {エンドポイント or "なし"}
  New types: {型名 or "なし"}
  DB changes: {テーブル/カラム or "なし"}
  Note: {申し送り事項 or "なし"}
  ```

### ピアレビュー（アイドル時）
自タスク完了後、次タスクがclaimableでない場合またはCI待ち・マージ待ちのアイドル時間に実施:
- **中断条件**: claimableタスクが出現したらレビューを即中断し、claim優先
- レビュー観点: 重複実装、型/utilの共有化提案、API形式整合性、コンフリクト予防
- 提案は対象Directorに直接 message（broadcastではない）
- 宛先はtask-claimで保持したDirector-タスクマップから特定
- 形式: `[peer-review] Task {X.Y} へのレビュー\n{観点}: {提案内容}`
- 受信側: 採用/却下を判断し `[peer-review-ack]` で応答。迷う場合はLeadにエスカレーション

### コンフリクト予防プロトコル
- `[conflict-alert]` 受信時: 当事者間で編集範囲を調整（ファイル分割、作業順序の合意等）
- **タイブレークルール**: 合意できない場合、タスク番号が小さい側（先行タスク）が該当ファイルの優先編集権を持つ
- 調整完了後: `[conflict-resolved]` を Lead に報告
- タイムアウト: 5分以内に合意できない場合は Lead にエスカレーション

## エラー時
- einja-task-exec 失敗: Lead に SendMessage でエラー報告
- PR作成失敗: 再試行（認証エラーの場合は Lead にエスカレーション）
- コンフリクト: einja-conflict-resolver Skill で自力解消 → 解消不可なら Lead にエスカレーション
```

---

## Step 5: 監視（通知 + ポーリング）

Lead の監視ループ:

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
| `[ci-failure]`（Lead → Director） | CI失敗検知時、Lead が原因DirectorのPRを特定し修正指示を送信 |
| `[peer-review]` エスカレーション | Director が判断に迷った場合、`[peer-review]` をLeadに転送。Leadが最終判断 |

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
| `manual` | `gh pr list --state merged` を30秒間隔ポーリング → マージ検知 |
| `task-group-auto` | `gh pr merge --squash --auto` 実行 → CI通過で自動マージ |
| `auto` | CI通過確認後に `gh pr merge --squash` 実行 |

### 5-4. マージ後処理

1. TaskUpdate でタスク status を `completed` に更新
2. blockedBy 解除（依存タスクが claimable になる）
3. idle Director が次タスクを自動 claim

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

```bash
# Phase PR 作成
gh pr create --base issue/${N} --head issue/${N}-phase{M} \
  --title "Phase ${M}: {Phase名}" \
  --body "Phase ${M} の全タスクグループ完了"
```

マージモードに応じた処理:
- `manual`: ユーザーにPR URLを通知
- `task-group-auto` / `auto`: CI通過確認後にマージ

### マージ後の次Phase準備

```bash
# 次Phase ブランチ作成
git fetch origin
git checkout issue/${N}
git pull origin issue/${N}
git checkout -b issue/${N}-phase{M+1}
git push -u origin issue/${N}-phase{M+1}
```

- Phase {M+1} タスクを TaskList で unblock（blockedBy 解除）
- idle Director Teammates が Phase {M+1} タスクを claim 開始

---

## Step 7: 全Phase完了 → 最終PR

1. einja-create-pr Skill で最終PR作成:
   ```
   --auto --base ${baseBranch}
   head: issue/${N}
   ```
2. PR URL をユーザーに表示
3. Issue にコメント追加（実行結果サマリ）

---

## Step 8: クリーンアップ

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

Director間・Lead間の全メッセージは以下のプレフィックスで分類する:

| プレフィックス | 方向 | 用途 | 送信方式 |
|--------------|------|------|---------|
| `[progress]` | Director → Lead | タスク進捗報告 | message |
| `[task-claim]` | Director → All | タスク開始宣言 + 編集予定ファイル | broadcast |
| `[change-summary]` | Director → All | タスク完了時の変更サマリ | broadcast |
| `[conflict-alert]` | Director ↔ Director | ファイル競合警告 | message（当事者間） |
| `[conflict-resolved]` | Director → Lead | コンフリクト調整完了報告 | message |
| `[peer-review]` | Director → Director | ピアレビュー提案 | message（対象者のみ） |
| `[peer-review-ack]` | Director → Director | ピアレビュー応答 | message（提案元のみ） |
| `[ci-failure]` | Lead → Director | CI失敗通知・修正指示 | message |
| `[error]` | Director → Lead | エラー報告 | message |
| `[idle]` | Director → Lead | アイドル通知 | message |

### broadcastコスト管理

- **broadcast許可**: `[task-claim]`, `[change-summary]` の2種のみ
- **それ以外は全て message**（当事者間のみ）でコンテキスト消費を最小化
- broadcastコストはTeamサイズに比例するため、プールサイズ（最大5）を超えない設計で抑制

### メッセージスキーマ

#### [task-claim]
    [task-claim] Task {X.Y}: {タスク名}
    Files: {編集予定ファイルリスト（カンマ区切り）}
    Director: {Director名}

#### [change-summary]
    [change-summary] Task {X.Y}: {タスク名}
    PR: #{PR番号}
    Changed files: {全変更ファイルパス（カンマ区切り）}
    Changed shared: {shared/配下の変更ファイル or "なし"}
    New API: {エンドポイント or "なし"}
    New types: {型名 or "なし"}
    DB changes: {テーブル/カラム or "なし"}
    Note: {申し送り事項 or "なし"}

#### [peer-review]
    [peer-review] Task {X.Y} へのレビュー
    {観点}: {提案内容}

#### [peer-review-ack]
    [peer-review-ack] Task {X.Y} レビュー応答
    Status: {adopted|rejected|escalated}
    Comment: {対応内容 or 却下理由 or "Leadにエスカレーション"}

#### [conflict-alert]
    [conflict-alert] ファイル競合検知
    Conflicting files: {重複ファイルリスト}
    My task: {自分のタスク番号}
    Your task: {相手のタスク番号}
    Proposal: {調整提案}

---

## エラーハンドリング（Agent Teams固有）

| 障害 | 検知 | 対応 |
|------|------|------|
| Director Teammate 停止（PR作成前） | idle 通知 + タスク状態が in_progress のまま | Lead が新 Teammate spawn してリトライ（最大2回）→ 3回目失敗はユーザーエスカレーション |
| Director Teammate 停止（PR作成済み） | idle 通知 + PR あり | スキップ（PRマージ待ちのまま継続） |
| Director Teammate 停止（修正中: fix_required 対応中） | idle 通知 + fixCount > 0 | Lead が新 Teammate spawn（fixCount 引き継ぎ）→ 超過時はユーザーエスカレーション |
| タスク失敗（einja-task-exec 内部エラー） | Director からの SendMessage | Lead がリトライ判断（最大2回）→ 3回目はユーザーにエスカレーション |
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

---

## tmux版（einja-issue-exec）との違い

| 項目 | tmux版 | Agent Teams版（本Skill） |
|------|--------|------------------------|
| 実行環境 | CLI + tmux 必須 | CLI / Desktop 両対応 |
| Director 管理単位 | Phase（1 Director = Phase内の全タスクグループ） | タスクグループ（1 Director = 1タスクグループ、完了後に次を claim） |
| Director 数 | Phase数と同数（固定） | min(タスクグループ総数, 5) の固定プール |
| Worker の実体 | 独立 tmux window（claude 対話モード） | Director 内のサブエージェント（Agent tool） |
| タスク割り振り | Director が依存DAGに基づき Worker を順次起動 | Lead が TaskList に登録 + addBlockedBy、Director が self-claim |
| 通信 | ステータスファイルポーリング | SendMessage + broadcast + 自動idle通知 |
| 状態管理 | `~/.einja/sessions/` JSON | 共有TaskList |
| ゲートチェック実行者 | Director | Lead（Director 完了報告受信時） |
| セッション復旧 | `--resume` でステータスファイルから復元 | issue ブランチの状態から途中再開 |
| ピアレビュー | なし | Director間の非同期レビュー（アイドル時） |
| 変更通知 | なし | broadcast による変更サマリ共有 |
| コンフリクト予防 | なし（事後対応のみ） | 事前宣言 + 自動検知 + ピア調整 |
