# Story 1: API名変更対応（task → issue） QAテスト結果

## テスト対象タスク
- **Story ID**: Story 1
- **Story名**: API名変更対応（task → issue）
- **実装日**: TBD
- **テスター**: TBD
- **最終更新**: TBD

## テストサマリー
| ステータス | 件数 |
|----------|-----|
| ✅ PASS | 0 |
| ❌ FAIL | 0 |
| ⚠️ PARTIAL | 0 |
| 🔄 未実施 | 5 |

---

## 必須自動テスト結果

### TypeScriptコンパイル
**実行コマンド**: `pnpm exec tsc --noEmit`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story1-tsc-output.log`

### Lintチェック
**実行コマンド**: `pnpm run lint`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story1-lint-output.log`

### ユニットテスト
**実行コマンド**: `pnpm run test`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story1-test-results.log`

---

## AC1.1: API名の変更（list_issues）

### 受け入れ条件
- **AC1.1**: API名の変更
  - Given: vibe-kanban MCPが最新バージョン
  - When: `listTasks` メソッドを呼び出す
  - Then: 内部で `list_issues` ツールを呼び出し、Issue一覧が取得できる
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | vibe-kanban MCPサーバーを起動 | サーバーが正常起動 | "Server running" | - | - |
| 2 | `pnpm task:loop 123 > qa-tests/evidence/story1-ac1.1.log 2>&1` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 3 | ログを確認: `grep "list_issues" qa-tests/evidence/story1-ac1.1.log` | `list_issues` ツールが呼び出される | マッチあり | - | - |
| 4 | ログを確認: `grep "list_tasks" qa-tests/evidence/story1-ac1.1.log` | `list_tasks` ツールが呼び出されていない | マッチなし | - | - |
| 5 | ログを確認 | Issue一覧が取得される | Issueリストが出力される | - | - |

**実行例**:
```bash
# vibe-kanban MCPサーバーを起動（別ターミナル）
cd /path/to/vibe-kanban-mcp
cargo run

# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story1-ac1.1.log 2>&1

# ログ確認
grep "list_issues" qa-tests/evidence/story1-ac1.1.log
grep "list_tasks" qa-tests/evidence/story1-ac1.1.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story1-ac1.1.log` - コマンド実行ログ

---

## AC1.2: 単一Issue取得（get_issue）

### 受け入れ条件
- **AC1.2**: 単一Issue取得
  - Given: vibe-kanban MCPが最新バージョン
  - When: `getTask(taskId)` メソッドを呼び出す
  - Then: 内部で `get_issue` ツールを呼び出し、指定Issueの詳細が取得できる
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm task:loop 123` を実行（特定Issueが存在する状態） | コマンドが正常起動 | エラーなし | - | - |
| 2 | ログを確認: `grep "get_issue" qa-tests/evidence/story1-ac1.2.log` | `get_issue` ツールが呼び出される | マッチあり | - | - |
| 3 | ログを確認 | パラメータ名が `issue_id` | `issue_id: xxx` | - | 旧: task_id |
| 4 | ログを確認: `grep "get_task" qa-tests/evidence/story1-ac1.2.log` | `get_task` ツールが呼び出されていない | マッチなし | - | - |
| 5 | ログを確認 | Issue詳細が取得される | Issueのタイトル、説明等が出力 | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story1-ac1.2.log 2>&1

# ログ確認
grep "get_issue" qa-tests/evidence/story1-ac1.2.log
grep "issue_id" qa-tests/evidence/story1-ac1.2.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story1-ac1.2.log` - コマンド実行ログ

---

## AC1.3: Issue作成（create_issue）

### 受け入れ条件
- **AC1.3**: Issue作成
  - Given: vibe-kanban MCPが最新バージョンでプロジェクトIDが有効
  - When: `createTask(projectId, title, description)` を呼び出す
  - Then: 内部で `create_issue` ツールを呼び出し、新しいIssue IDが返される
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | タスクループで新しいタスクを作成 | コマンドが正常動作 | エラーなし | - | - |
| 2 | ログを確認: `grep "create_issue" qa-tests/evidence/story1-ac1.3.log` | `create_issue` ツールが呼び出される | マッチあり | - | - |
| 3 | ログを確認: `grep "create_task" qa-tests/evidence/story1-ac1.3.log` | `create_task` ツールが呼び出されていない | マッチなし | - | - |
| 4 | ログを確認 | 新しいIssue IDが返される | `Issue created: xxx` | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story1-ac1.3.log 2>&1

# ログ確認
grep "create_issue" qa-tests/evidence/story1-ac1.3.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story1-ac1.3.log` - コマンド実行ログ

---

## AC1.4: Issueステータス更新（update_issue）

### 受け入れ条件
- **AC1.4**: Issueステータス更新
  - Given: vibe-kanban MCPが最新バージョンで有効なIssue IDが存在
  - When: `updateTask(taskId, status)` を呼び出す
  - Then: 内部で `update_issue` ツールを呼び出し、ステータスが更新される
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | タスクループでタスクのステータスを変更 | コマンドが正常動作 | エラーなし | - | - |
| 2 | ログを確認: `grep "update_issue" qa-tests/evidence/story1-ac1.4.log` | `update_issue` ツールが呼び出される | マッチあり | - | - |
| 3 | ログを確認 | パラメータ名が `issue_id` | `issue_id: xxx` | - | 旧: task_id |
| 4 | ログを確認: `grep "update_task" qa-tests/evidence/story1-ac1.4.log` | `update_task` ツールが呼び出されていない | マッチなし | - | - |
| 5 | ログを確認 | ステータスが更新される | `Issue status updated` | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story1-ac1.4.log 2>&1

# ログ確認
grep "update_issue" qa-tests/evidence/story1-ac1.4.log
grep "issue_id" qa-tests/evidence/story1-ac1.4.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story1-ac1.4.log` - コマンド実行ログ

---

## AC1.5: 型定義の整合性

### 受け入れ条件
- **AC1.5**: 型定義の整合性
  - Given: TypeScriptプロジェクト
  - When: `VibeKanbanClient` のメソッドを呼び出す
  - Then: 型エラーが発生せず、戻り値の型が正しく推論される
  - 検証レベル: Unit

### テストシナリオ

#### 型定義確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm exec tsc --noEmit > qa-tests/evidence/story1-ac1.5.log 2>&1` を実行 | TypeScriptコンパイル成功 | エラーなし | - | - |
| 2 | vibe-kanban-client.ts を確認 | `listTasks` メソッドのシグネチャ | 戻り値の型が正しい | - | - |
| 3 | vibe-kanban-client.ts を確認 | `getTask` メソッドのシグネチャ | 戻り値の型が正しい | - | - |
| 4 | vibe-kanban-client.ts を確認 | `createTask` メソッドのシグネチャ | 戻り値の型が正しい | - | - |
| 5 | vibe-kanban-client.ts を確認 | `updateTask` メソッドのシグネチャ | 戻り値の型が正しい | - | - |

**実行例**:
```bash
# TypeScriptコンパイル（型チェックのみ）
pnpm exec tsc --noEmit > qa-tests/evidence/story1-ac1.5.log 2>&1

# エラーがないことを確認
echo $?  # 0 が返ればOK
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story1-ac1.5.log` - TypeScriptコンパイル結果

---

## 統合テスト結果サマリー

### Story 1全体結果
- **全体ステータス**: - （未実施）
- **完了AC**: 0/5
- **テスト合格率**: 0% (0/5)

### 修正が必要な項目
- （実施後に記載）

### 次Storyへの引き継ぎ事項
- （実施後に記載）

### 改善提案
- （実施後に記載）

---

## 報告と対応

### task-executerへの差し戻し
- （問題が見つかった場合に記載）

### 失敗原因分類
- **A: 実装ミス** -
- **B: 要件齟齬** -
- **C: 設計不備** -
- **D: 環境問題** -

### 修正優先度
- （問題が見つかった場合に記載）

### 回避策
- （問題が見つかった場合に記載）
