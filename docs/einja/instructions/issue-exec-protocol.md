<!-- @einja:managed:start -->
# Issue実行プロトコル（共通仕様）

このドキュメントは `einja-issue-exec`（tmux版）と `einja-issue-team-exec`（Agent Teams版）の**共通ルール**を定義する Single Source of Truth である。各方式固有のI/O形式（ステータスファイル、TaskList API等）は各SKILL.mdを参照すること。

---

## 1. 体制設計（3ロール定義）

### 1.1 ロール一覧

| ロール | 責務（共通） | 管理単位 |
|--------|-------------|----------|
| **Manager** | Issue全体の管理。Phase管理、ブランチ作成、タスクグループの実行管理（tmux版: 直接Worker起動、Agent Teams版: Teammateに委託）、Phase間マージ、質問エスカレーション（対人間）、エラー監視 | Issue全体 |
| **Director** | タスクグループの進行管理。タスクグループ内の各タスクを複数 Worker で協力して進行するよう導く。einja-task-exec 実行、PR作成、完了報告 | 方式により異なる（1.2参照） |
| **Worker** | 個別タスク（X.Y.Z）の実装。Director内のサブエージェントとして動作（task-executer, task-reviewer, task-qa） | タスク（X.Y.Z）1つ |

### 1.2 実行方式別のロールマッピング

| ロール | tmux版（issue-exec） | Agent Teams版（issue-team-exec） |
|--------|---------------------|--------------------------------|
| **Manager** | Claude Code カスタムコマンド（メインプロセス） | **Lead**（Agent Teams リーダー） |
| **Director** | **廃止**: Manager が直接 Worker を管理（2階層化） | **Teammate**（タスクグループ単位で1名spawn） |
| **Worker** | tmux window + einja-task-exec / Agent tool（タスクグループ単位で1名） | **Subagent**（Director teammate 内の Agent tool） |

### 1.3 方式別の責務差分

| 責務 | tmux版の実行者 | Agent Teams版の実行者 |
|------|--------------|---------------------|
| 成果物ゲートチェック（Fast Gate / Risk Gate） | Manager（Worker完了報告受信時にチェック） | Lead = Manager（Director 完了報告受信時にチェック） |
| spec事前一括チェック | Manager | Lead = Manager |
| 依存DAG解析・Layer分け | Manager | Lead = Manager（TaskList + addBlockedBy で表現） |
| Worker異常終了リトライ | Manager（最大2回） | Lead = Manager（Teammate idle 検知時） |

> 各方式固有の起動・通信手順は各SKILL.mdを参照。

---

## 2. ステータス遷移定義

### 2.1 状態遷移図

```
pending → in_progress → awaiting_review → completed
                                        → failed
```

### 2.2 各ステータスの定義

| ステータス | 定義 | 遷移条件 |
|-----------|------|---------|
| `pending` | 初期状態。未着手 | タスクグループ作成時に設定 |
| `in_progress` | 実行中。Workerがタスクを実装中 | Workerが起動し作業を開始した時点 |
| `awaiting_review` | Worker完了。Manager/Leadによるゲートチェック待ち | Workerが全タスク完了・PR作成後 |
| `completed` | ゲートチェック通過・PRマージ完了。Issueチェックボックス更新（2.3参照） | Fast Gate（+ 必要に応じてRisk Gate）通過後、PRがマージされた時点 |
| `failed` | 回復不能な失敗。エスカレーション必要 | リトライ上限超過、または致命的エラー発生時 |

> 各方式固有のステータス永続化形式（JSONファイル、TaskList等）は各SKILL.mdを参照。

### 2.3 completed 遷移時の必須アクション: Issue チェックボックス更新

タスクグループが `completed` に遷移した際、GitHub Issue 説明文の該当タスクグループのチェックボックスを `- [ ]` → `- [x]` に更新する。

#### 更新手順

```bash
# 1. Issue本文を取得（更新直前に必ず再取得すること — 複数Directorの同時更新による競合防止）
body=$(gh issue view {N} --json body -q .body)

# 2. 該当行のチェックボックスを更新
#    正規表現: ^- \[ \] ${X}\.${Y} （末尾スペースで 1.1 と 1.10 の部分一致を防止）
#    既に - [x] の場合はスキップ（冪等性確保）
updated_body=$(echo "$body" | sed "s/^- \[ \] ${X}\.${Y} /- [x] ${X}.${Y} /")

# 3. 変更がある場合のみ更新
if [ "$body" != "$updated_body" ]; then
  gh issue edit {N} --body "$updated_body"
fi
```

#### 注意事項

- **冪等性**: 既に `- [x]` の行は置換されない（sed パターンが `- [ ]` のみにマッチするため）
- **フォーマット不一致時**: マッチしない場合はスキップ（エラーにしない）。Issue説明文が format-rules.md の形式に従っていない場合でも処理を中断しない
- **競合リスク低減**: 更新直前に `gh issue view` で本文を再取得すること。完全な排他制御ではないため、複数Director/Workerが同時に完了する場合は後勝ちとなる可能性があるが、冪等性により再実行で回復可能

---

## 3. ゲートチェック仕様

### 3.1 Fast Gate（全タスクグループ対象、60-120秒目安）

以下の全項目を確認する:

| チェック項目 | 確認内容 |
|------------|---------|
| ステータス整合 | status/prNumber/branch とPR実体が一致すること |
| PR整合 | base/headが正しいブランチ構成（task→phase）であること |
| 成果物存在 | `qa-tests/story{N}.md` と `modifications/task-{X}-{Y}.md` が存在すること |
| QA結果の最小内容確認 | status=SUCCESS、対象AC、実行記録（Playwright/curl/コマンド）があること |
| CI結果確認 | PRのrequired checksが success であること |
| 危険シグナル簡易検知 | TODO/FIXME、コンフリクト痕跡（`<<<<<<<`）、PARTIAL/FAILURE が差分内にないこと |

- **通過時**: `directorVerdict = "approved"` → マージモードに応じたPR処理へ
- **不通過時**: `directorVerdict = "fix_required"` + `fixInstructions` → Worker修正へ（セクション4参照）

### 3.2 Risk Gate（条件付き、重要変更時のみ発火）

**発火条件**（いずれか1つ以上に該当）:
- auth/billing/prisma migration等の重要領域変更
- 差分行数が大きい
- QA記録が薄い
- CI再実行が多発

**追加確認**:
- 代表シナリオ1本のスモークテスト実施（API→curl、UI→Playwright MCP）

**NG時の動作**:
- autoモードでもmanualに降格し、段階的リカバリへ移行

---

## 4. エラーリトライポリシー

### 4.1 fixCount（ゲートチェック不通過時の修正試行）

- ゲートチェック（Fast Gate / Risk Gate）で不通過となった場合、Workerに修正指示を出す
- **最大2回**まで修正を試行する
- 3回目のNG（fixCount >= 2 の状態で再度不通過）→ `directorVerdict = "rejected"` → Managerにエスカレーション

### 4.2 retryCount（Worker/Teammate異常終了時のリトライ）

- Worker または Teammate（Agent Teams版）が異常終了（プロセス消失等）した場合、再起動を試行する
- **最大2回**まで再起動する
- 3回目の失敗（retryCount >= 2 の状態で再度異常終了）→ `status = "failed"` → Managerにエスカレーション

### 4.3 管理上の注意

- `fixCount` と `retryCount` は**別管理**とする。異常終了リトライ時にfixCountはリセットしない
- 修正中（fix_required対応中）にWorkerが異常終了した場合、retryCountを使用してリトライし、fixCountは引き継ぐ

---

## 5. マージモード仕様

### 5.1 モード一覧

| モード | タスクPR (task→phase) | Phase PR (phase→issue) | 最終PR (issue→base) |
|---|---|---|---|
| `manual` | 人間マージ待ち | 人間マージ待ち | 人間マージ待ち |
| `task-group-auto` | CI通過後に自動マージ | 人間マージ待ち | 人間マージ待ち |
| `auto` | CI通過後に自動マージ | CI通過後に自動マージ | 人間マージ待ち（常に手動） |

### 5.2 各モードの詳細動作

| モード | マージ検知・実行方法 |
|--------|-------------------|
| `manual` | `gh pr list --state merged` ポーリングでマージ検知 |
| `task-group-auto` | `gh pr merge --squash --auto` で自動マージ予約 |
| `auto` | CI通過確認後に `gh pr merge --squash` 実行 |

> 最終PR（issue→base）は全モードで人間マージ必須。

---

## 6. PR作成ルール

| PR種別 | base | head | 作成者 |
|--------|------|------|--------|
| タスクPR | `issue/{N}-phase{M}` | `task/{N}-{X.Y}` | Worker(einja-task-exec) / Teammate（Agent Teams版） |
| Phase PR | `issue/{N}` | `issue/{N}-phase{M}` | Manager/Lead |
| 最終PR | IssueBranchBase | `issue/{N}` | Manager/Lead |

> ブランチ命名規則の詳細は [ブランチ運用戦略](../steering/branch-strategy.md) を参照。

---

## 7. Phase完了条件

以下の**全3条件**を満たすこと:

1. 当該Phaseの全タスクPRが `merged` 状態であること
2. 全タスクグループの状態が `completed` であること
3. 処理中（inflight）のタスクがないこと

---

## 8. CI待機タイムアウト

- デフォルト: **30分**
- 超過時はユーザーに通知し、人間の判断を待つ

---

## 9. spec事前一括チェック仕様

### 9.1 検索パターン

`docs/specs/issues/*/issue{N}-*/` パターンでIssueに対応するspecディレクトリを検索する。

### 9.2 3分類

| 分類 | 条件 | 動作 |
|------|------|------|
| `full` | 完全spec（requirements.md + design.md + qa-tests/） | 正常続行 |
| `partial` | 部分的spec（一部ファイルが欠損） | Managerにエスカレーション。揃っているタスクグループは先行起動可 |
| `none` | specなし | Worker内で `_einja-general-context-loader` にフォールバック |

> 各方式固有のチェック結果永続化形式は各SKILL.mdを参照。

---

## 10. 依存関係解析仕様

### 10.1 DAG構築とLayer分け

- タスクグループ間の依存関係からDAG（有向非巡回グラフ）を構築する
- トポロジカルソートでLayer分けを行う
  - **Layer 0**（依存なし）→ 即時並列起動
  - **Layer 1以降** → 前Layer内の依存元が完了次第、起動可能

### 10.2 起動タイミング

- Layer全体の完了を待たない。1タスクグループ完了時、**依存が全て満たされた**次Layerのタスクグループを即時起動する

### 10.3 循環依存

- 循環依存を検知した場合 → 即座にManagerにエスカレーション（自動解決しない）

---

## 11. 質問エスカレーション

### 11.1 エスカレーションチェーン

```
tmux版（einja-issue-exec）: Worker → Manager → Human
Agent Teams版（einja-issue-team-exec）: Worker → Director(Teammate) → Lead(Manager) → Human
```

### 11.2 判断基準

各階層は spec/design/issue の情報に基づいて回答可能かを判断する。回答不可の場合は上位階層にエスカレーションする。

### 11.3 回答のドキュメント還元先

| 回答の種類 | 追記先 |
|-----------|--------|
| 要件・仕様に関する判断 | requirements.md |
| 技術的な設計判断 | design.md |
| プロジェクト横断の方針 | docs/einja/memory/decisions.md |
| 再利用可能なパターン | docs/einja/memory/patterns.md |

> 各方式固有の質問ファイル形式・通知メカニズムは各SKILL.mdを参照。

## 12. 複数Issue並行実行

### 12.1 前提ルール

複数のClaude Codeセッションが同一リポジトリで並行作業する場合、以下を遵守する:

- **メインリポのHEADに依存しない**: ブランチ作成には `git branch` を使用し、`git checkout` は自身のworktree内でのみ使用する
- **ブランチ操作の安全性**: `issue/{N}` と `issue/{N}-phase{M}` は **merge-only**（rebase/force-push禁止）。`task/{N}-{X.Y}` のみrebase可
- **ブランチ作成の冪等性**: `git branch ... 2>/dev/null || true` でガードし、resume/再試行時の失敗を防止

### 12.2 lock系エラーリトライポリシー

`git fetch`/`git branch`/`git push` でlock系エラーが発生した場合のリトライポリシー:

| 対象エラー | リトライ方法 |
|-----------|-------------|
| `packed-refs.lock` | jitter付き1〜2秒待機 → 再試行 |
| `FETCH_HEAD.lock` | jitter付き1〜2秒待機 → 再試行 |
| `cannot lock ref` | jitter付き1〜2秒待機 → 再試行 |
| その他lock系エラー | jitter付き1〜2秒待機 → 再試行 |

- **最大リトライ回数**: 3回
- **全リトライ失敗時**: abort（エラーをManagerにエスカレーション）
- **jitter**: `sleep $((RANDOM % 2 + 1))` 相当のランダム待機

### 12.3 IssueBranchBase自動同期プロトコル

Managerの監視ループでIssueBranchBaseの進行を検知し、Issueブランチに取り込むプロトコル。

#### 同期手順

1. **進行検知**: Manager監視ループ内で `git fetch origin` 実行時、`origin/{IssueBranchBase}` の HEAD が前回確認時から進行していることを検知
2. **Issueブランチへの取り込み**: Manager worktree内で以下を実行:
   ```bash
   cd <manager-worktree>
   git fetch origin
   git merge origin/{IssueBranchBase}
   git push origin issue/{N}
   ```
3. **成功時**: 各active Workerに `sync_required` を通知（tmux版）/ Teammate に通知（Agent Teams版）。Phaseブランチは直接更新しない
4. **Workerの同期（tmux版）/ Directorの同期（Agent Teams版）**: 安全ポイント（タスク開始前・マージ直後）で以下を実行:
   ```bash
   cd <phase-worktree>
   git fetch origin
   git merge origin/issue/{N}
   git push origin issue/{N}-phase{M}
   ```
   > tmux版の場合、Manager が Phase ブランチを最新化すれば Worker 側の個別同期は不要（Worker はタスク開始前に Manager が最新 Phase ブランチからブランチを切るため）
5. **merge失敗時**: `einja-conflict-resolver` Skill で解消 → 解消不可ならユーザーにエスカレーション

#### 同期のタイミング

| トリガー | 実行者 | 動作 |
|---------|--------|------|
| `git fetch` で IssueBranchBase の進行を検知 | Manager | Issueブランチに merge → Worker（tmux版）/ Teammate（Agent Teams版）に通知 |
| `sync_required` 通知の受信 | Worker（tmux版）/ Director（Agent Teams版） | 安全ポイントで Phase ブランチに merge |
| タスク開始前 | Manager（tmux版）/ Director（Agent Teams版） | Phase ブランチの最新を確認 |

### 12.4 複数Issue並行時のマージ順序

- 先にIssueBranchBase（main等）にマージしたIssueが勝ち（楽観的並行マージ）
- 後続Issueはmainの最新を merge で取り込み、PR を更新してからマージ
- Issue間依存がある場合は人間が実行順序を制御

---

## 13. コンフリクト解消ルール

- コンフリクト発生時は `einja-conflict-resolver` Skill を使用して解消する
- 自動解消できない場合はManagerにエスカレーションする

---

## 14. ポーリング停止・再開ルール

### 14.1 停止条件

- 1時間ポーリングしても状態変化なし → ポーリングを一旦停止し、待機モードへ遷移

### 14.2 待機モード中の動作

- **低頻度ハートビート**: 5分間隔で状態を確認（取りこぼし防止）
- 以下のトリガーで**通常ポーリング（30秒間隔）に即時復帰**:
  1. 人間からの報告
  2. Worker（tmux版）/ Teammate（Agent Teams版）からの通知
  3. ハートビートでマージ検知

### 14.3 冪等処理

- `processed_pr_numbers` セットで処理済みPRを管理する
- 同一PRの二重処理を防止する

---

## 関連ドキュメント

- [ブランチ運用戦略](../steering/branch-strategy.md) - ブランチ階層・命名規則・マージ戦略
- [タスク管理ガイドライン](../steering/task-management.md) - タスク階層・粒度基準・Issue構造
- [einja-issue-exec SKILL.md](../../.claude/skills/einja-issue-exec/SKILL.md) - tmux版の実装詳細
- [einja-issue-team-exec SKILL.md](../../.claude/skills/einja-issue-team-exec/SKILL.md) - Agent Teams版の実装詳細
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="issue-exec-protocol-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
