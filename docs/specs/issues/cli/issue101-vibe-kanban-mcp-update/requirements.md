# vibe-kanban MCP 破壊的変更対応 要件定義書

## 概要
vibe-kanban MCP の破壊的変更に対応し、`pnpm task:loop` コマンドを正常動作させます。API名変更、パラメータ変更、新規API追加に対応し、型定義を整備することで、CLIツールの安定性と保守性を向上させます。

## AS-IS（現状）

### 現在の実装状況
- vibe-kanban MCPの旧APIに依存した実装
- `list_tasks`, `get_task`, `create_task`, `update_task` を使用
- `list_projects` に `organization_id` パラメータなし
- `list_repos` に `project_id` パラメータ指定
- `start_workspace_session` の古いパラメータ構造
- ステータス値 `"inprogress"` と `"in-progress"` が混在
- `VibeKanbanOrganization` 型が未定義

### 現状の課題
- PR #95-98 で部分対応したが不完全
- `pnpm task:loop` コマンドが動作しない
- 新しいMCPバージョンとの互換性がない
- 型定義の不整合によりTypeScriptエラーが発生
- 組織の概念が導入されたが未対応

## TO-BE（目標状態）

### 実現したい姿
- 最新のvibe-kanban MCP APIに完全対応
- `issue` 名前空間のAPI（`list_issues`, `get_issue`, `create_issue`, `update_issue`）を使用
- 組織一覧取得機能（`list_organizations`）の統合
- 新しいパラメータ構造に対応した実装
- ステータス値の統一（`"in-progress"`）
- 完全な型定義と型安全性の確保

### 期待される改善
- `pnpm task:loop` コマンドの正常動作
- 最新MCPバージョンとの互換性確保
- TypeScriptの型エラー解消
- 将来のAPI変更に対する耐性向上
- コードの保守性と可読性の改善

## ビジネス価値
- **問題**: vibe-kanban MCP の破壊的変更により、タスク自動実行ループが停止
- **解決策**: 最新APIへの完全移行と型定義の整備
- **期待効果**: CLIツールの安定稼働、開発者体験の向上、将来の変更への耐性

## スコープ
### 含まれるもの
- API名の変更（task → issue）
- 新規API `list_organizations` の統合
- パラメータ構造の変更対応
- 型定義の追加と修正（`VibeKanbanOrganization` 等）
- ステータス値の統一
- 既存機能の動作保証

### 含まれないもの
- UIの変更
- 新機能の追加
- パフォーマンスの最適化（API変更対応のみ）
- 他のMCPクライアントへの影響

## ユーザーストーリー

### Story 1: API名変更への対応（task → issue）
**As a** CLI開発者
**I want to** 新しいAPI名（issue）に対応したい
**So that** 最新のvibe-kanban MCPと連携できる

#### 受け入れ基準
- [ ] **AC1.1**: API名の変更
  - Given: vibe-kanban MCPが最新バージョン
  - When: `listTasks` メソッドを呼び出す
  - Then: 内部で `list_issues` ツールを呼び出し、Issue一覧が取得できる
  - 検証レベル: Integration

- [ ] **AC1.2**: 単一Issue取得
  - Given: vibe-kanban MCPが最新バージョン
  - When: `getTask(taskId)` メソッドを呼び出す
  - Then: 内部で `get_issue` ツールを呼び出し、指定Issueの詳細が取得できる
  - 検証レベル: Integration

- [ ] **AC1.3**: Issue作成
  - Given: vibe-kanban MCPが最新バージョンでプロジェクトIDが有効
  - When: `createTask(projectId, title, description)` を呼び出す
  - Then: 内部で `create_issue` ツールを呼び出し、新しいIssue IDが返される
  - 検証レベル: Integration

- [ ] **AC1.4**: Issueステータス更新
  - Given: vibe-kanban MCPが最新バージョンで有効なIssue IDが存在
  - When: `updateTask(taskId, status)` を呼び出す
  - Then: 内部で `update_issue` ツールを呼び出し、ステータスが更新される
  - 検証レベル: Integration

- [ ] **AC1.5**: 型定義の整合性
  - Given: TypeScriptプロジェクト
  - When: `VibeKanbanClient` のメソッドを呼び出す
  - Then: 型エラーが発生せず、戻り値の型が正しく推論される
  - 検証レベル: Unit

#### 実装の優先順位
P0 (必須)

---

### Story 2: 組織対応（list_organizations API）
**As a** CLI開発者
**I want to** 組織の概念に対応したい
**So that** 組織配下のプロジェクトを適切に管理できる

#### 受け入れ基準
- [ ] **AC2.1**: 組織一覧の取得
  - Given: vibe-kanban MCPが接続済み
  - When: `listOrganizations()` メソッドを呼び出す
  - Then: `list_organizations` ツールを呼び出し、組織一覧が取得できる
  - 検証レベル: Integration

- [ ] **AC2.2**: 組織IDを使用したプロジェクト一覧取得
  - Given: 有効な組織IDが存在
  - When: `listProjects(organizationId)` を呼び出す
  - Then: 指定された組織に属するプロジェクト一覧が取得できる
  - 検証レベル: Integration

- [ ] **AC2.3**: 組織型定義の追加
  - Given: TypeScriptプロジェクト
  - When: `VibeKanbanOrganization` 型を参照
  - Then: 型が正しく定義され、`id` と `name` プロパティが存在する
  - 検証レベル: Unit

- [ ] **AC2.4**: プロジェクト選択時の組織選択フロー
  - Given: 複数の組織が存在
  - When: `selectProject` を実行
  - Then: 組織を選択してからプロジェクトを選択できる
  - 検証レベル: Integration

#### 実装の優先順位
P0 (必須)

---

### Story 3: パラメータ構造の変更対応
**As a** CLI開発者
**I want to** 新しいパラメータ構造に対応したい
**So that** ワークスペースセッションを正常に開始できる

#### 受け入れ基準
- [ ] **AC3.1**: list_repos パラメータ削除
  - Given: vibe-kanban MCPが最新バージョン
  - When: `listRepos(projectId)` を呼び出す
  - Then: `project_id` パラメータなしで `list_repos` ツールを呼び出し、リポジトリ一覧が取得できる
  - 検証レベル: Integration

- [ ] **AC3.2**: start_workspace_session の新パラメータ
  - Given: 有効なIssue ID、executor、reposが存在
  - When: `startTaskAttempt(taskId, executor, repos)` を呼び出す
  - Then: `start_workspace_session` に `title`（必須）、`executor`（必須）、`repos`（必須）、`issue_id`（オプション）のパラメータを渡し、Attemptが開始される
  - 検証レベル: Integration

- [ ] **AC3.3**: title パラメータの自動生成
  - Given: Issue情報が存在
  - When: `startTaskAttempt` を呼び出す
  - Then: Issue のタイトルまたはタスクグループIDから `title` が自動生成される
  - 検証レベル: Unit

- [ ] **AC3.4**: 後方互換性の確保
  - Given: 既存のタスクループフローが存在
  - When: 新しい実装でタスクループを実行
  - Then: 既存の動作が維持され、エラーが発生しない
  - 検証レベル: E2E

#### 実装の優先順位
P0 (必須)

---

### Story 4: ステータス値の統一
**As a** CLI開発者
**I want to** ステータス値を統一したい
**So that** 型安全性を確保しバグを防止できる

#### 受け入れ基準
- [ ] **AC4.1**: ステータス型の統一
  - Given: TypeScriptプロジェクト
  - When: `TaskStatus` 型を参照
  - Then: `"pending" | "completed" | "in-progress"` の3値のみが許可される（`"inprogress"` は削除）
  - 検証レベル: Unit

- [ ] **AC4.2**: VibeKanbanTask のステータス型
  - Given: `VibeKanbanTask` 型定義
  - When: `status` プロパティを参照
  - Then: `"todo" | "in-progress" | "done" | "cancelled"` の4値のみが許可される
  - 検証レベル: Unit

- [ ] **AC4.3**: ステータス比較処理の修正
  - Given: タスクのステータスをチェックするコード
  - When: `task.status === "inprogress"` または `task.status === "in-progress"` で比較
  - Then: `"in-progress"` に統一され、正しく動作する
  - 検証レベル: Integration

- [ ] **AC4.4**: 既存データの互換性
  - Given: 旧ステータス値（`"inprogress"`）を持つタスクが存在
  - When: タスク一覧を取得
  - Then: `"in-progress"` に正規化されて処理される
  - 検証レベル: Integration

#### 実装の優先順位
P1 (重要)

---

## 詳細なビジネス要件

### API変更マッピング
#### 旧APIから新APIへの対応表
**要件内容**:
| 旧API名 | 新API名 | パラメータ変更 |
|---------|---------|--------------|
| `list_tasks` | `list_issues` | なし |
| `get_task` | `get_issue` | `task_id` → `issue_id` |
| `create_task` | `create_issue` | なし |
| `update_task` | `update_issue` | `task_id` → `issue_id` |

**OK例**:
- `list_issues({ project_id: "abc123" })` - 新API形式
- `get_issue({ issue_id: "issue-001" })` - 新パラメータ名

**NG例**:
- `list_tasks({ project_id: "abc123" })` - 旧API名（削除済み）
- `get_issue({ task_id: "issue-001" })` - 旧パラメータ名

### パラメータ変更詳細
#### list_projects の変更
**要件内容**:
- **旧**: パラメータなし
- **新**: `organization_id`（必須）

**実装例**:
```typescript
// 旧
await client.callTool({ name: "list_projects", arguments: {} })

// 新
await client.callTool({
  name: "list_projects",
  arguments: { organization_id: "org-123" }
})
```

#### list_repos の変更
**要件内容**:
- **旧**: `project_id`（必須）
- **新**: パラメータなし

**実装例**:
```typescript
// 旧
await client.callTool({
  name: "list_repos",
  arguments: { project_id: "proj-123" }
})

// 新
await client.callTool({ name: "list_repos", arguments: {} })
```

#### start_workspace_session の変更
**要件内容**:
- **旧パラメータ**: `task_id`, `executor`, `repos`
- **新パラメータ**: `title`(必須), `executor`(必須), `repos`(必須), `issue_id`(オプション)

**実装例**:
```typescript
// 旧
await client.callTool({
  name: "start_workspace_session",
  arguments: {
    task_id: "task-001",
    executor: "CLAUDE_CODE",
    repos: [{ repo_id: "repo-1", base_branch: "main" }]
  }
})

// 新
await client.callTool({
  name: "start_workspace_session",
  arguments: {
    title: "[Issue22 5.1] タスクグループ名",
    executor: "CLAUDE_CODE",
    repos: [{ repo_id: "repo-1", base_branch: "main" }],
    issue_id: "issue-001"  // オプション
  }
})
```

### 型定義要件
#### VibeKanbanOrganization 型
**要件内容**:
```typescript
export interface VibeKanbanOrganization {
  id: string;
  name: string;
}
```

#### ステータス型の統一
**要件内容**:
```typescript
// TaskStatus（内部管理用）
export type TaskStatus = "pending" | "completed" | "in-progress";

// VibeKanbanTask のステータス（MCP API）
export interface VibeKanbanTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done" | "cancelled";
}
```

## 非機能要件

### 後方互換性
- 既存の`pnpm task:loop`コマンドの動作を維持
- タスクループフローの変更なし
- 既存の設定ファイル（`.vibe-kanban.json`）との互換性

### 型安全性
- TypeScript strict モードでエラーなし
- すべてのMCP APIレスポンスに型定義
- パラメータの型チェックを厳格化

### エラーハンドリング
- API呼び出し失敗時の適切なエラーメッセージ
- 型不一致時のエラー検出
- 新旧API混在時の明確なエラー表示

## 技術的制約
- vibe-kanban MCP の最新バージョンに依存
- 既存の `@modelcontextprotocol/sdk` の使用継続
- TypeScript 5.x の型システムに準拠
- 既存のディレクトリ構造を維持

## 依存関係
- vibe-kanban MCP サーバー（最新バージョン）
- `@modelcontextprotocol/sdk`
- 既存のタスクループフロー実装
- GitHub CLI（`gh` コマンド）

## リスクと対策
| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| MCP API の更なる変更 | 高 | 中 | バージョン固定、変更検知の自動化 |
| 型定義の不整合 | 中 | 低 | strict型チェック、統合テスト |
| 既存データとの非互換 | 高 | 低 | ステータス値の正規化処理 |
| 組織選択フローの複雑化 | 中 | 中 | デフォルト組織の設定機能 |

## 成功指標
- `pnpm task:loop` コマンドが正常実行できる
- TypeScript型エラーが0件
- すべての統合テストが成功
- 既存機能の動作が100%維持される
- 新API対応のカバレッジが100%

## タイムライン
- Phase 1: 型定義の追加と修正（Story 4）
- Phase 2: API名変更とパラメータ対応（Story 1, 3）
- Phase 3: 組織対応の統合（Story 2）
- Phase 4: 統合テストと動作確認
