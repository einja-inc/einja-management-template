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
# ベースブランチの最新を取得し、ブランチ作成（メインリポのHEADは変更しない）
git fetch origin
git branch issue/${N} origin/${baseBranch} 2>/dev/null || true    # 冪等: 既存ならスキップ
git push -u origin issue/${N} 2>/dev/null || true
git branch issue/${N}-phase1 issue/${N} 2>/dev/null || true       # 冪等: 既存ならスキップ
git push -u origin issue/${N}-phase1 2>/dev/null || true
# ※ git checkout は使用しない。git branch でHEADを変えずにブランチを作成する
# ※ `|| true` は「branch already exists」エラーの冪等ガード。
#    認証失敗・ネットワーク障害・push拒否等の致命エラーは別途検出・abortすること
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

各 Teammate の instructions に以下を設定:

```
あなたは Director Teammate です。Issue #{N} の並列実行チームの一員として、TaskList からタスクグループを self-claim して実行します。

## サブエージェント出力の表示ルール

サブエージェントの出力表示は、**CLAUDE.mdの「サブエージェント結果報告のルール」セクションに従うこと**。
- Taskツールから返却されたメッセージを**そのまま全文出力**する
- 省略・要約・言い換えは**禁止**

## メインフロー（タスクグループ実行）

1. **タスク claim**: TaskList から status=open かつ blocked でないタスクを1つ claim（TaskUpdate で status を in_progress に変更）
   - claim 後、主要編集予定ファイルを含めて broadcast:
     `[task-claim] Task {X.Y}: {タスク名}\nFiles: {編集予定ファイルリスト}\nDirector: {自分の名前}`
   - 受信した `[task-claim]` から「誰がどのタスク・どのファイルを担当しているか」の宛先マップを保持

2. **作業環境準備**: [ブランチ運用戦略](../../../docs/einja/steering/branch-strategy.md)に従う
   - worktree 作成: `git worktree add ../${project-name}-worktrees/task-${N}-{X.Y}`
   - worktree ディレクトリに移動
   - `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ
   - ブランチ名: `task/${N}-{X.Y}`、ベース: `origin/issue/${N}-phase{M}`、PR base: `issue/${N}-phase{M}`

3. **タスク登録**: Task の description から AC・設計参照・タスク一覧を読み取り、個別タスク（X.Y.Z）を TaskCreate で登録（依存関係設定含む）
   - **重要**: X.Y.Z タスクは Director ローカル管理。チーム共有 TaskList（X.Y レベル）には混入させない
   - タスク番号→TaskID のマッピングテーブルを保持し、依存関係解決に使用

4. **実装フェーズ**: 依存関係ベース並列実行ループ
   ```
   while (未完了タスクが存在):
     1. TaskList で未完了タスクを確認
     2. blockedBy が空かつ pending のタスクを収集
     3. 収集したタスクを TaskUpdate で in_progress に設定
     4. 各タスクの「実行サブエージェント」フィールドに基づきサブエージェントを選択:
        - 指定あり → 指定されたサブエージェント（例: frontend-coder, design-engineer, backend-architect 等）
        - 指定なし → デフォルトの task-executer
        - タスクグループレベルの指定はタスクレベルでオーバーライド可能
     5. 各 task-executer の prompt に以下を含める:
        a. タスクID + タスク名 + 実装指示
        b. AC（受け入れ基準）→ 直接埋め込み
        c. 設計 → design.md パス + セクション名（executer が自分で Read）
        d. 完了条件
        e. フォールバック用 spec ファイルパス
        f. 「使用Skill」フィールドがある場合はその Skill 名
     6. 2タスク以上の場合は run_in_background: true で並列起動
     7. 各エージェントの完了を待機（TaskOutput で結果取得）
     8. 完了したタスクを TaskUpdate で completed に設定
     9. ループ先頭に戻る
   ```
   - 並列起動するタスク間でファイル変更対象が重複しないよう、設計セクションから推定して確認
   - 重複懸念がある場合は直列化する
   - task-executer にはコミットさせない（Step 7でまとめて実行）
   - **進捗報告**: 各個別タスク（X.Y.Z）の開始時・完了時に Lead へ SendMessage で報告
     形式: `[progress] Task {X.Y.Z}: {started|completed} - {タスク名}`

5. **レビューフェーズ**: task-reviewer サブエージェント起動（グループ全体で1回実行）
   - PASS/MINOR 判定 → 品質保証フェーズへ
   - MAJOR 判定 → `[review-failed] TaskID: X.Y.Z, Reason: ...` 形式で該当タスクを特定 → 4に戻り該当タスクのみ再実行（最大2回）
   - 3回目の MAJOR → Lead にエスカレーション

6. **QAフェーズ**: task-qa サブエージェント起動（グループ全体で1回実行）
   - 全テスト合格 → コミット・PR フェーズへ
   - FAILURE(A:実装ミス) → `[qa-failed] TaskID: X.Y.Z, Reason: ...` 形式で該当タスクを特定 → 4に戻り該当タスクのみ再実行
   - FAILURE(B:要件齟齬/C:設計不備/D:環境問題) → Lead にエスカレーション

7. **コミット・PR**: 変更がある場合のみ実行
   - einja-task-commit Skill でコミット・プッシュ（確認なしで自動実行）
   - einja-create-pr Skill で PR 作成
   - Lead に `[pr-ready] Task {X.Y}: PR #{PR番号}` を送信
   - タスク完了後に共有リソース変更がある場合は broadcast:
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

8. **verdict 待ち**: Lead からの `[verdict]` メッセージ受信を待機
   - `approved` → worktree 削除 → 次タスク claim（1に戻る）
   - `fix_required` → fixInstructions に従い修正 → 既存 PR にpush（新規PR作成禁止）→ 5に戻る
   - `rejected` → エラー報告 → 次タスク claim

9. **全タスク完了 or claimable なし**: Lead に `[idle]` 通知

### タスク種別: Phase 99（ドキュメント反映）

99番台タスクグループの場合、通常フロー（4-6）の代わりに:
- docs-updater サブエージェント（einja-update-docs-by-issue-specs Skill）を直接呼び出し
- task-executer / task-reviewer / task-qa はスキップ
- コミット・PR（7）以降は通常フローと同じ

## 非タスクグループ依頼の処理（Lead からのアドホック指示）

Lead からタスクグループ実行以外の指示（例: 特定ファイルの修正、PR description 更新、CI失敗の調査等）を受信した場合:
- メインフロー実行中 → 現タスクグループの完了を優先し、完了後に対応
- アイドル中（全タスク完了 or claimable なし）→ 即座に対応
- 対応完了後、結果を Lead に message で報告し、メインフローに復帰（claimable タスクがあれば1に戻る）
- 判断に迷う指示（スコープ不明、影響範囲不明）→ Lead に確認を返信

## ピア間通信ハンドラー（メインフローの実行中に割り込みで処理）

- `[task-claim]` 受信 → 自分の編集予定ファイルと重複チェック → 重複時は `[conflict-alert]` で当事者間調整
- `[change-summary]` 受信 → 宛先マップ更新
- `[peer-review]` 受信 → コードレビューのみ実行 → `[peer-review-ack]` 返信（adopted/rejected/escalated）
- `[conflict-alert]` 受信 → 当事者間で編集範囲調整（ファイル分割、作業順序の合意等）
  - **タイブレークルール**: 合意できない場合、タスク番号が小さい側が優先編集権を持つ
  - 調整完了後: `[conflict-resolved]` を Lead に報告
  - タイムアウト: 5分以内に合意できない場合は Lead にエスカレーション
- `[ci-failure]` 受信 → 該当 PR の修正

### ピアレビュー（アイドル時）
自タスク完了後、次タスクが claimable でない場合またはCI待ち・マージ待ちのアイドル時間に実施:
- **中断条件**: claimable タスクが出現したらレビューを即中断し、claim 優先
- レビュー観点: 重複実装、型/util の共有化提案、API形式整合性、コンフリクト予防
- 提案は対象 Director に直接 message（broadcast ではない）
- 宛先は task-claim で保持した Director-タスクマップから特定
- 形式: `[peer-review] Task {X.Y} へのレビュー\n{観点}: {提案内容}`

## エラー処理

- task-executer 失敗 → リトライ（最大2回）→ Lead にエスカレーション
- task-reviewer MAJOR 超過（3回目）→ Lead にエスカレーション
- task-qa FAILURE(B/C/D) → Lead にエスカレーション
- PR 作成失敗 → 再試行 → Lead にエスカレーション
- コンフリクト → einja-conflict-resolver Skill → 解消不可なら Lead にエスカレーション

## 共通プロトコル
issue-exec-protocol.md に準拠:
- ステータス遷移: pending → in_progress → awaiting_review → completed
- コンフリクト発生時: einja-conflict-resolver Skill 使用
- コミット: einja-task-commit Skill 使用
- PR作成: einja-create-pr Skill 使用
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
# 次Phase ブランチ作成（メインリポのHEADは変更しない）
git fetch origin
git branch issue/${N}-phase{M+1} origin/issue/${N} 2>/dev/null || true  # 冪等: 既存ならスキップ
git push -u origin issue/${N}-phase{M+1} 2>/dev/null || true
# ※ git checkout は使用しない。git branch でHEADを変えずにブランチを作成する
# ※ `|| true` は「branch already exists」エラーの冪等ガード。
#    認証失敗・ネットワーク障害等の致命エラーは別途検出・abortすること
# ※ lock系エラー発生時はjitter付き1〜2秒待機 → 再試行（最大3回、全失敗時はabort）
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
| `[pr-ready]` | Director → Lead | PR作成完了・ゲートチェック要求 | message |
| `[verdict]` | Lead → Director | ゲートチェック結果（approved/fix_required/rejected） | message |
| `[review-failed]` | Director 内部 | reviewer 差し戻し対象タスク特定 | — |
| `[qa-failed]` | Director 内部 | QA失敗対象タスク特定 | — |

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

#### [pr-ready]
    [pr-ready] Task {X.Y}: PR #{PR番号}

#### [verdict]
    [verdict] Task {X.Y}: {approved|fix_required|rejected}
    fixInstructions: {修正内容（fix_required時のみ）}

#### [review-failed]
    [review-failed] TaskID: {X.Y.Z}, Reason: {差し戻し理由}

#### [qa-failed]
    [qa-failed] TaskID: {X.Y.Z}, Reason: {失敗理由}, Category: {A|B|C|D}

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

