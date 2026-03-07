# Director責務拡張計画

## Context

issue-execの3階層構造（Manager → Director → Worker）において、Directorの責務が「Workerの起動・監視」に限定されており、事前チェックやエラーリカバリをManagerに依存している。4階層目（Member）を追加するのではなく、Directorを「賢く」することでManagerの負担を軽減し、実行効率を向上させる。

## 対象ファイル

- `.claude/commands/einja/issue-exec.md` — Director責務拡張、監視ループ修正、エラーリカバリ表修正
- `.claude/skills/einja-task-exec/SKILL.md` — Worker完了後の承認待ちループ追加
- `docs/einja/instructions/issue-exec-workflow.md` — タスク完了フロー、各階層の責務、エラーリカバリ表を更新
- `docs/einja/steering/development-workflow.md` — マージ後の自動処理、Worker完了フロー図を更新

## 変更内容

### 1. spec存在チェックの事前一括実施（責務0を新設）

**Director初期プロンプト（L202付近）の責務セクション冒頭に挿入**

Worker起動前に全タスクグループのspec存在を一括確認:
- `docs/specs/issues/*/issue{N}-*/` パターンで検索
- 3分類: 完全spec → 正常 / 部分的spec → Managerにエスカレーション / specなし → 警告ログ（Worker内でフォールバック）
- 部分的specがある場合、揃っているタスクグループのWorkerは先行起動可
- チェック結果を `phase-{M}/spec-check.json` に記録

**task-exec Step 2は変更しない**（Directorは早期警告、Workerは実行時確認。冗長だが安全側）

### 2. Worker異常終了のリトライ（Director自力）（責務8を新設）

**Director初期プロンプトの責務セクション末尾に追加**

Worker起動後、15秒間隔の監視ループ:
- `tmux list-windows` でworker window存在確認 + ステータスファイル確認
- window消失 + status=in_progress（PRなし）→ 異常終了、リトライ（最大2回）
- 3回目失敗 → status="failed"、Managerに質問エスカレーション
- `task-{X.Y}.json` に `retryCount`, `lastRetryAt`, `failureReason` フィールド追加

**Step 6 監視ループ（L241-242）項目4を修正**:
- Worker消失 → Directorが検知・リトライ（15秒間隔）
- Director消失 → Managerが検知・リカバリ（30秒間隔、既存ロジック）
- ManagerはWorkerを直接監視しない（二重検知回避）

**エラーリカバリ表（L345）を修正**:
- 「リトライ」→「**Directorが自力リトライ**（最大2回）→ 3回目失敗時はManagerにエスカレーション」

### 3. Phase内依存関係の詳細解析（責務1を置換）

**Director初期プロンプト（L203）の責務1を置換**

現在: `依存関係のないタスクグループは並列でWorkerを起動してください`

置換後:
- Phase開始時にタスクグループ間の依存DAGを構築
- トポロジカルソートでLayer分け（Layer 0: 依存なし → 即時並列起動）
- 循環依存検知 → Managerにエスカレーション
- 1タスクグループ完了時、依存が全て満たされた次Layerのタスクグループを即時起動（Layer全体の完了を待たない）
- 解析結果を `events.jsonl` に `dependency_graph` イベントとして記録

### 4. Worker完了後の成果物ゲートチェック（責務3を拡張）

**Director初期プロンプトの責務3（Worker完了後）を拡張**

現在: ステータスファイルでPR番号確認 → マージ → sync通知 → worktree削除

拡張後: タスクPRマージ前に2段階ゲートチェックを実施:

#### Fast Gate（全タスクグループ、60-120秒目安）

1. **ステータス整合**: `task-{X.Y}.json` の status/prNumber/branch とPR実体が一致
2. **PR整合**: base/headが `task/{N}-{X.Y} → issue/{N}-phase{M}` であること
3. **成果物存在**: `qa-tests/story{N}.md` と `modifications/task-{X}-{Y}.md` が存在
4. **QA結果の最小内容確認**: qa-testsに `status=SUCCESS`、対象AC、実行記録（Playwright/curl/コマンド）がある
5. **CI結果確認**: PRのrequired checksが `success`（またはauto-merge予約済み）
6. **危険シグナル簡易検知**: `TODO/FIXME`、コンフリクト痕跡（`<<<<<<<`）、`PARTIAL/FAILURE` が差分内にないこと

- Fast Gate通過 → Workerに終了許可を送信 → マージモードに応じたPR処理へ進む
- Fast Gate不通過 → 段階的リカバリ（後述）

#### Risk Gate（条件付き、重要変更時のみ）

- 発火条件: auth/billing/prisma migration等の重要領域変更、差分行数が大きい、QA記録が薄い、CI再実行が多発
- 追加確認: Directorが代表シナリオ1本のスモークテスト実施（API→curl、UI→Playwright MCP）
- NG時: autoモードでもmanualに降格、段階的リカバリへ

#### Workerのライフサイクル変更（einja-task-execも修正）

現在: Worker完了 → ステータス更新 → tmux window終了
変更後: Worker完了 → ステータスを `awaiting_review` に更新 → **Directorの承認待ちループに入る**

```
Worker完了後の待機ループ:
while true:
  1. task-{X.Y}.json の directorVerdict を確認（15秒間隔）
  2. directorVerdict = "approved" → 正常終了
  3. directorVerdict = "fix_required" → fixInstructions を読み、修正実行 → 再度 awaiting_review に戻る
  4. directorVerdict = "rejected" → 失敗終了
  sleep 15
```

これにより:
- Directorのゲートチェックでの指摘に対し、**Workerがコンテキスト維持のまま修正できる**
- Worker再起動のコスト（コンテキスト再構築）が不要
- `tmux send-keys` ではなくステータスファイル経由の通信で安全

#### ゲートチェック不通過時のリカバリ

ゲートNG → Directorが `fixInstructions` をステータスファイルに書き込み → Workerが修正 → 再度 `awaiting_review` → 再チェック（最大2回）。3回目のゲートNG → `directorVerdict = "rejected"` → Worker終了 → Managerにエスカレーション。

#### マージモード別の運用

| モード | ゲート通過後の動作 |
|--------|------------------|
| `manual` | CI成功まで待機、検証結果サマリーを添えて人間マージ待ち |
| `task-group-auto` / `auto` | auto-merge設定まで実施、他の独立Workerを先に進める（依存タスクはマージ完了待ち） |

### 5. 開発フロードキュメント更新

#### `docs/einja/instructions/issue-exec-workflow.md`

- **L67-71 各階層の責務テーブル**: Directorの責務に「spec事前チェック、成果物ゲートチェック、Workerリトライ、依存グラフ解析」を追加
- **L206-239 タスク完了フロー**: Workerの完了フローに `awaiting_review` 待機ステップを追加。Directorのゲートチェック（Fast Gate / Risk Gate）を挟むフローに変更
- **L243-253 エラーリカバリ表**: Worker異常終了のリカバリ主体をDirectorに変更
- **L144 ステータスファイル**: `task-{X.Y}.json` に新フィールド（`directorVerdict`, `fixInstructions`, `retryCount`等）を追記

#### `docs/einja/steering/development-workflow.md`

- **L75-85 Workerフロー図**: Worker完了後に「Director ゲートチェック」ステップを挿入
- **L225-240 マージ後の自動処理**: DirectorがPRマージ前にゲートチェックを行うフローに変更
- **L193-195 実行後の流れ**: ステップ4を「Worker完了後、Directorがゲートチェック実施 → 通過後にPR処理」に修正

## 変更箇所サマリー

| 行番号 | セクション | 変更 |
|--------|-----------|------|
| L202付近 | Director責務0（新規） | spec一括チェック挿入 |
| L203 | Director責務1 | 依存グラフ解析に置換 |
| L207-211 | Director責務3 | 成果物ゲートチェック（Fast Gate + Risk Gate）に拡張 |
| L213付近 | Director責務8（新規） | Worker監視ループ・リトライ挿入 |
| L241-242 | Step 6 項目4 | Worker監視責務をDirectorに移管 |
| L345 | エラーリカバリ表 | Directorリトライに記述変更 |

## ステータスファイルへの影響

- 新規: `phase-{M}/spec-check.json`
- 既存変更: `task-{X.Y}.json` に以下フィールド追加:
  - `retryCount`, `lastRetryAt`, `failureReason` (リトライ用)
  - `directorVerdict` (`approved` / `fix_required` / `rejected`)
  - `fixInstructions` (修正指示テキスト)
  - `gateResult` (Fast Gate / Risk Gateの検証結果詳細)

## 検証方法

1. issue-exec.md の変更後、マークダウンのフォーマットが正しいか確認（テーブル、コードブロック）
2. Director初期プロンプトの責務番号が0-8で連続しているか確認
3. Step 6監視ループとDirector責務でWorker監視の責務が重複していないか確認
4. エラーリカバリ表がDirector/Manager/Workerの責務分離と整合しているか確認
5. `pnpm prepush` でlint/typecheck/testが通ること（.mdファイルのみの変更なので影響なし）
