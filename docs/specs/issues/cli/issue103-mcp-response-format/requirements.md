# 要件定義書: vibe-kanban MCP start_workspace_session レスポンス形式変更対応

## Issue情報

| 項目 | 値 |
|------|-----|
| Issue番号 | #103 |
| リポジトリ | einja-inc/einja-management-template |
| ブランチ | issue/103 |
| TDD適用 | はい |

---

## 1. 概要

vibe-kanban MCPの `start_workspace_session` ツールのレスポンス形式が変更されたため、`VibeKanbanAttempt.id` が正しく取得できない問題を修正する。

---

## 2. AS-IS（現状）

### 現在の実装状況

- `startTaskAttempt` メソッドは `start_workspace_session` を呼び出してAttempt情報を取得
- レスポンスを `VibeKanbanAttempt` 型（`{ id, task_id, executor, base_branch }`）としてパース
- `parseToolResult` がnullを返すと `"タスク実行の開始に失敗しました"` エラーをスロー

### 現状の課題

| 課題 | 詳細 |
|------|------|
| attempt.id取得不可 | MCPレスポンス形式変更により、`attempt.id` が取得できない |
| 表示の問題 | `pnpm task:loop` で `▶️ タスク開始: 3.1 (base: issue/133-phase3, attempt: unknown)` と表示 |
| Claude Code起動不可 | `attempt.id` が不明なため、Claude Codeが起動しない |
| 型定義の不一致 | `VibeKanbanAttempt` 型定義が実際のレスポンス構造と一致していない可能性 |

### 関連ファイル

| ファイル | 役割 |
|----------|------|
| `packages/cli/src/commands/task-loop/lib/vibe-kanban-client.ts` | MCPクライアント実装 |
| `packages/cli/src/commands/task-loop/lib/types.ts` | 型定義（VibeKanbanAttempt） |
| `packages/cli/src/commands/task-loop/lib/vibe-kanban-client.test.ts` | テスト |

---

## 3. TO-BE（目標状態）

### 実現したい姿

- 新しいMCPレスポンス形式に対応したパース処理
- `attempt.id` が正しく取得され、表示される（例: `attempt: abc123def`）
- Claude Codeが正常に起動する
- 型定義が実際のレスポンス構造と一致

### 期待される改善

| 改善項目 | 詳細 |
|----------|------|
| タスクループ正常動作 | `pnpm task:loop` が正常に動作 |
| デバッグ情報 | 正確なattempt IDが表示される |
| 柔軟な設計 | 後続のMCP API変更にも柔軟に対応できる設計 |

---

## 4. ビジネス価値

| 項目 | 内容 |
|------|------|
| **問題** | MCPレスポンス形式変更により、タスク自動実行ループが機能停止 |
| **解決策** | レスポンス形式を調査し、型定義とパース処理を修正 |
| **期待効果** | タスクループの復旧、開発効率の維持 |

---

## 5. スコープ

### 含まれるもの

- `start_workspace_session` の実際のレスポンス形式調査
- `VibeKanbanAttempt` 型定義の更新
- `parseToolResult` または `startTaskAttempt` のパース処理修正
- 既存テストの更新（新しいレスポンス形式に対応）
- ビルド・動作確認

### 含まれないもの

- 他のMCPツール（`list_issues`, `update_issue`等）のレスポンス形式変更対応
- `VibeKanbanTask` など他の型定義の変更
- MCP SDKのバージョンアップ
- エラーハンドリングの全面見直し（既存の枠組みを維持）

---

## 6. ユーザーストーリー

### Story 1: MCPレスポンス形式の調査

**As a** 開発者
**I want to** `start_workspace_session` の実際のレスポンス形式を確認したい
**So that** 正しい型定義とパース処理を実装できる

#### 受け入れ基準

| ID | 基準 | 検証レベル |
|----|------|-----------|
| AC1.1 | MCPレスポンス形式の確認 - `start_workspace_session` を実際に実行し、JSONレスポンスの構造（フィールド名、データ型、ネスト構造）が明確化される | Integration |
| AC1.2 | 旧形式との差分確認 - 新旧形式を比較し、変更点（フィールドの追加/削除/リネーム/ネスト変更）が特定される | Unit |

**実装の優先順位**: P0 (必須)

---

### Story 2: 型定義の更新（TDD: Red-Green-Refactor）

**As a** 開発者
**I want to** `VibeKanbanAttempt` 型定義を新しいレスポンス形式に合わせたい
**So that** TypeScriptの型チェックが正しく機能する

#### 受け入れ基準

| ID | 基準 | TDDフェーズ | 検証レベル |
|----|------|-------------|-----------|
| AC2.1 | 新しいレスポンス形式のテストケース追加 - 新しい形式のモックレスポンスでテストを作成し、テストが失敗することを確認 | Red | Unit |
| AC2.2 | `VibeKanbanAttempt` 型定義の更新 - `types.ts` の `VibeKanbanAttempt` インターフェースを新形式に更新し、AC2.1のテストが成功する | Green | Unit |
| AC2.3 | 型定義の命名・構造の最適化 - フィールド名の明確化、JSDocコメントの追加。テストが引き続き成功し、型定義が読みやすくなる | Refactor | Unit |

**実装の優先順位**: P0 (必須)

---

### Story 3: パース処理の修正（TDD: Red-Green-Refactor）

**As a** 開発者
**I want to** `startTaskAttempt` のパース処理を新形式に対応させたい
**So that** `attempt.id` が正しく取得できる

#### 受け入れ基準

| ID | 基準 | TDDフェーズ | 検証レベル |
|----|------|-------------|-----------|
| AC3.1 | 新形式レスポンスのパーステスト追加 - 新形式のモックレスポンスで `startTaskAttempt` のテストを作成し、テストが失敗することを確認 | Red | Unit |
| AC3.2 | パース処理の修正 - `parseToolResult` または `startTaskAttempt` のパース処理を修正し、AC3.1のテストが成功。`attempt.id` が正しく取得され、既存のテストも引き続き成功する（後方互換性） | Green | Unit |
| AC3.3 | パース処理のリファクタリング - 重複コードの削減、エラーハンドリングの改善、コメント追加。すべてのテストが引き続き成功し、コードが保守しやすくなる | Refactor | Unit |

**実装の優先順位**: P0 (必須)

---

### Story 4: テストの更新と動作確認

**As a** 開発者
**I want to** 既存テストを新形式に対応させ、実際に動作確認したい
**So that** リグレッションを防ぎ、タスクループが正常動作することを保証する

#### 受け入れ基準

| ID | 基準 | 検証レベル |
|----|------|-----------|
| AC4.1 | 既存テストの更新 - `vibe-kanban-client.test.ts` のモックレスポンスを新形式に更新し、すべてのテストが成功する | Unit |
| AC4.2 | ビルド確認 - `pnpm build` を実行し、ビルドエラーが発生しない | Integration |
| AC4.3 | 実際のタスクループ動作確認 - `pnpm task:loop --issue 103` を実行し、`▶️ タスク開始: X.X (base: issue/103, attempt: {実際のID})` と表示され、Claude Codeが正常に起動する | E2E |

**実装の優先順位**: P0 (必須)

---

## 7. 詳細なビジネス要件

### レスポンス形式の想定パターン

#### パターン1: フラット構造の変更

**想定**:
```json
{
  "attempt_id": "abc123",
  "issue_id": "issue-001",
  "executor": "CLAUDE_CODE",
  "base_branch": "main"
}
```

**対応方針**: フィールド名のマッピング変更（`id` → `attempt_id`, `task_id` → `issue_id`）

#### パターン2: ネスト構造の導入

**想定**:
```json
{
  "attempt": {
    "id": "abc123",
    "status": "in-progress"
  },
  "issue_id": "issue-001",
  "executor": "CLAUDE_CODE"
}
```

**対応方針**: パース処理でネストを解除（`result.attempt.id`）

#### パターン3: 配列形式

**想定**:
```json
{
  "attempts": [
    {
      "id": "abc123",
      "issue_id": "issue-001"
    }
  ]
}
```

**対応方針**: 最初の要素を取得（`result.attempts[0]`）

### エラーハンドリング要件

| 要件 | OK例 | NG例 |
|------|------|------|
| パース失敗時の詳細エラー | `parseToolResult` が詳細なエラーメッセージをログ出力 | 単に `null` を返してエラー詳細が不明 |
| 新旧両形式対応 | フォールバック処理で旧形式も試行 | 新形式のみ対応し、旧形式で即座にエラー |

---

## 8. 非機能要件

| 要件カテゴリ | 要件内容 |
|--------------|----------|
| **パフォーマンス** | レスポンスパース処理: 100ms以内、MCP接続のオーバーヘッド増加: 元々の接続時間の10%以内 |
| **後方互換性** | 可能な限り旧MCPバージョンでも動作、パース処理で新旧両形式を試行するフォールバック機構 |
| **保守性** | 型定義にJSDocコメントを追加、パース処理のロジックを明確に分離 |

---

## 9. 技術的制約

- `@modelcontextprotocol/sdk` の既存バージョンを維持
- `parseToolResult` メソッドの基本構造を変更しない（他のツールへの影響を避ける）
- TypeScript strictモードでエラーが出ないこと

---

## 10. 依存関係

- vibe-kanban MCP最新版（`npx -y vibe-kanban@latest --mcp`）
- `@modelcontextprotocol/sdk`
- 既存の `VibeKanbanClient` クラスの他メソッド

---

## 11. リスクと対策

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| 新形式が想定外の構造 | 高 | 中 | Story 1で入念に調査し、柔軟なパース処理を実装 |
| 旧MCPバージョンとの非互換 | 中 | 低 | フォールバック処理で新旧両形式に対応 |
| 他のMCPツールへの影響 | 高 | 低 | `parseToolResult` の変更は最小限に抑える |
| テストケース不足 | 中 | 中 | TDD適用で網羅的なテストを作成 |

---

## 12. 成功指標

| 指標 | 目標値 |
|------|--------|
| attempt ID表示 | `pnpm task:loop` で `attempt: {実際のID}` が表示される |
| Claude Code起動 | 正常に起動する |
| テスト成功率 | すべてのユニットテストが成功（カバレッジ80%以上） |
| ビルド | エラーが発生しない |

---

## 13. タイムライン

| Phase | 内容 | Story | 完了条件 |
|-------|------|-------|----------|
| Phase 1 | MCPレスポンス形式変更対応 | Story 1, 2, 3, 4 | `pnpm task:loop` で `attempt: {実際のID}` が表示され、Claude Codeが正常に起動する |

### Phase 1 タスクグループ

| タスクグループ | 内容 | TDD適用 |
|----------------|------|---------|
| 1.1 | MCPレスポンス形式の調査 | - |
| 1.2 | 型定義の更新 | Red-Green-Refactor |
| 1.3 | パース処理の修正 | Red-Green-Refactor |
| 1.4 | テストの更新と動作確認 | - |
