# シナリオテスト

## 概要
このファイルは、複数Storyをまたぐ継続操作のシナリオテストを定義します。
各Story完了後に、該当するシナリオテストを実行してください。

---

## シナリオ1: 完全なタスクループフロー（E2E）

### 目的
vibe-kanban MCP破壊的変更対応後、`pnpm task:loop`コマンドが正常動作し、組織選択からタスク実行まで完全なフローが成功することを確認する。

### 関連
- **受け入れ条件**: AC1.1, AC1.2, AC1.3, AC1.4, AC2.1, AC2.2, AC2.4, AC3.1, AC3.2, AC3.4, AC4.3
- **関連Story**: Story 1, Story 2, Story 3, Story 4（全Story）

### 実施タイミング
- **Story 1完了後**: Step 1-6まで実施可能（部分実行：新API名で動作確認）
- **Story 2完了後**: Step 1-10まで実施可能（部分実行：組織選択フロー追加）
- **Story 3完了後**: Step 1-14まで実施可能（部分実行：新パラメータ構造対応）
- **Story 4完了後**: 全Step実施（フル実行：ステータス統一で完全動作）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | vibe-kanban MCPサーバーを起動 | サーバーが正常起動 | "Server running on stdio" | - |
| 2 | `pnpm task:loop 123` を実行 | コマンドが正常起動 | エラーなし | - |
| 3 | - | MCP接続成功ログが表示 | "Connected to Vibe-Kanban MCP" | - |
| 4 | - | 組織一覧取得ログが表示 | "list_organizations called" | - |
| 5 | - | 組織リストが表示される | "1. Organization A", "2. Organization B" | - |
| 6 | 組織を選択: 1 | - | - | - |
| 7 | - | プロジェクト一覧取得ログが表示 | "list_projects called with organization_id" | - |
| 8 | - | プロジェクトリストが表示される | "1. Project X", "2. Project Y" | - |
| 9 | プロジェクトを選択: 1 | - | - | - |
| 10 | - | Issue一覧取得ログが表示 | "list_issues called" (旧: list_tasks) | - |
| 11 | - | Issueリストが表示される | タスクグループ一覧 | - |
| 12 | - | リポジトリ一覧取得ログが表示 | "list_repos called without project_id" | - |
| 13 | - | Attempt開始ログが表示 | "start_workspace_session called with title, executor, repos, issue_id" | - |
| 14 | - | タスクループが開始される | "Task loop started" | - |
| 15 | タスクステータスを確認 | ステータス値が統一されている | "in-progress" (旧: "inprogress") | - |
| 16 | タスクを完了状態に変更 | ステータス更新ログが表示 | "update_issue called" (旧: update_task) | - |
| 17 | - | ステータスが更新される | "Task status updated to done" | - |
| 18 | Ctrl+C でタスクループを停止 | 正常終了 | エラーなし | - |

### 実行ログ
（実施後に記載）

---

## シナリオ2: 新API名での動作確認（Integration）

### 目的
すべてのAPI呼び出しが新API名（issue名前空間）で行われ、旧API名（task名前空間）が使用されていないことを確認する。

### 関連
- **受け入れ条件**: AC1.1, AC1.2, AC1.3, AC1.4
- **関連Story**: Story 1

### 実施タイミング
- **Story 1完了後**: 全Step実施可能（フル実行）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | `pnpm task:loop 123 > qa-tests/evidence/api-name-check.log 2>&1` を実行 | コマンドが正常実行 | 正常終了 | - |
| 2 | ログファイルを確認: `grep "list_issues" qa-tests/evidence/api-name-check.log` | `list_issues` が呼び出されている | マッチあり | - |
| 3 | ログファイルを確認: `grep "get_issue" qa-tests/evidence/api-name-check.log` | `get_issue` が呼び出されている | マッチあり | - |
| 4 | ログファイルを確認: `grep "update_issue" qa-tests/evidence/api-name-check.log` | `update_issue` が呼び出されている | マッチあり（タスク更新時） | - |
| 5 | ログファイルを確認: `grep "list_tasks" qa-tests/evidence/api-name-check.log` | `list_tasks` が呼び出されていない | マッチなし | - |
| 6 | ログファイルを確認: `grep "get_task" qa-tests/evidence/api-name-check.log` | `get_task` が呼び出されていない | マッチなし | - |
| 7 | ログファイルを確認: `grep "update_task" qa-tests/evidence/api-name-check.log` | `update_task` が呼び出されていない | マッチなし | - |

### 実行ログ
（実施後に記載）

---

## シナリオ3: 組織選択フローの動作確認（Integration）

### 目的
組織一覧取得 → 組織選択 → プロジェクト一覧取得のフローが正常に動作することを確認する。

### 関連
- **受け入れ条件**: AC2.1, AC2.2, AC2.4
- **関連Story**: Story 2

### 実施タイミング
- **Story 2完了後**: 全Step実施可能（フル実行）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | `pnpm task:loop 123` を実行 | - | - | - |
| 2 | - | 組織一覧取得が実行される | "list_organizations called" | - |
| 3 | - | 複数の組織が表示される | "1. Org A", "2. Org B" | - |
| 4 | 組織を選択: 1 | - | - | - |
| 5 | - | プロジェクト一覧取得が実行される | "list_projects called with organization_id: xxx" | - |
| 6 | - | 選択した組織のプロジェクトのみ表示される | 組織Aのプロジェクトリスト | - |
| 7 | 別の組織を選択: 2 | - | - | - |
| 8 | - | プロジェクト一覧が再取得される | "list_projects called with organization_id: yyy" | - |
| 9 | - | 選択した組織のプロジェクトのみ表示される | 組織Bのプロジェクトリスト | - |
| 10 | 組織が1つだけの場合 | 自動選択される | "Using organization: xxx" | - |

### 実行ログ
（実施後に記載）

---

## シナリオ4: パラメータ構造変更の動作確認（Integration）

### 目的
新しいパラメータ構造（title必須、issue_id任意）でAttemptが正常に開始されることを確認する。

### 関連
- **受け入れ条件**: AC3.1, AC3.2, AC3.3
- **関連Story**: Story 3

### 実施タイミング
- **Story 3完了後**: 全Step実施可能（フル実行）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | `pnpm task:loop 123 > qa-tests/evidence/param-check.log 2>&1` を実行 | - | - | - |
| 2 | ログを確認: `list_repos` パラメータ | パラメータが空 | `list_repos called with arguments: {}` | - |
| 3 | ログを確認: `start_workspace_session` パラメータ | `title` が含まれる | `start_workspace_session called with title: ...` | - |
| 4 | ログを確認: `start_workspace_session` パラメータ | `executor` が含まれる | `executor: CLAUDE_CODE` | - |
| 5 | ログを確認: `start_workspace_session` パラメータ | `repos` が含まれる | `repos: [...]` | - |
| 6 | ログを確認: `start_workspace_session` パラメータ | `issue_id` が含まれる（任意） | `issue_id: xxx` または なし | - |
| 7 | ログを確認: title 自動生成 | Issue情報からtitleが生成される | `title: [Issue22 5.1] ...` 形式 | - |

### 実行ログ
（実施後に記載）

---

## シナリオ5: ステータス値統一の動作確認（Integration）

### 目的
ステータス値が `"in-progress"` に統一され、旧ステータス値（`"inprogress"`）が使用されていないことを確認する。

### 関連
- **受け入れ条件**: AC4.1, AC4.2, AC4.3, AC4.4
- **関連Story**: Story 4

### 実施タイミング
- **Story 4完了後**: 全Step実施可能（フル実行）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | types.ts を確認 | `VibeKanbanTask` の status 型定義 | `"todo" \| "in-progress" \| "done" \| "cancelled"` | - |
| 2 | types.ts を確認 | `"inprogress"` が削除されている | `"inprogress"` なし | - |
| 3 | `pnpm task:loop 123 > qa-tests/evidence/status-check.log 2>&1` を実行 | - | - | - |
| 4 | ログを確認: ステータス値 | `"in-progress"` が使用される | `status: "in-progress"` | - |
| 5 | ログを確認: ステータス値 | `"inprogress"` が使用されていない | `"inprogress"` なし | - |
| 6 | 旧データがある場合 | ステータス比較が正常動作 | エラーなし | - |
| 7 | TypeScriptコンパイル | 型エラーなし | "Compilation successful" | - |

### 実行ログ
（実施後に記載）

---

## シナリオ6: 後方互換性の確認（E2E）

### 目的
既存の設定ファイル（`.vibe-kanban.json`）が正常に動作し、既存フローが維持されることを確認する。

### 関連
- **受け入れ条件**: AC3.4
- **関連Story**: Story 3

### 実施タイミング
- **Story 3完了後**: 全Step実施可能（フル実行）

### テスト手順

| Step | 操作 | 確認項目 | 期待値 | 結果 |
|------|------|---------|--------|------|
| 1 | 旧バージョンの `.vibe-kanban.json` を用意 | ファイルが存在 | `{"project_id": "xxx"}` | - |
| 2 | `pnpm task:loop 123` を実行 | プロジェクト検証が実行される | "Validating project..." | - |
| 3 | プロジェクトが有効な場合 | 既存プロジェクトが使用される | "Using existing project: xxx" | - |
| 4 | プロジェクトが無効な場合 | 再選択フローに遷移 | "Project not found. Please select again." | - |
| 5 | 設定ファイルがない場合 | 新規選択フローに遷移 | "Please select organization and project" | - |
| 6 | タスクループが正常動作 | エラーなし | "Task loop started" | - |

### 実行ログ
（実施後に記載）

---

## 実行記録

### Story 1完了時の実施記録
（シナリオ1: Step 1-6、シナリオ2: 全Step）

### Story 2完了時の実施記録
（シナリオ1: Step 1-10、シナリオ3: 全Step）

### Story 3完了時の実施記録
（シナリオ1: Step 1-14、シナリオ4: 全Step、シナリオ6: 全Step）

### Story 4完了時の実施記録
（シナリオ1: 全Step、シナリオ5: 全Step）
