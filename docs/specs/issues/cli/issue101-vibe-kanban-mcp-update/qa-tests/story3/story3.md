# Story 3: パラメータ変更対応 QAテスト結果

## テスト対象タスク
- **Story ID**: Story 3
- **Story名**: パラメータ構造の変更対応
- **実装日**: TBD
- **テスター**: TBD
- **最終更新**: TBD

## テストサマリー
| ステータス | 件数 |
|----------|-----|
| ✅ PASS | 0 |
| ❌ FAIL | 0 |
| ⚠️ PARTIAL | 0 |
| 🔄 未実施 | 4 |

---

## 必須自動テスト結果

### TypeScriptコンパイル
**実行コマンド**: `pnpm exec tsc --noEmit`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story3-tsc-output.log`

### Lintチェック
**実行コマンド**: `pnpm run lint`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story3-lint-output.log`

### ユニットテスト
**実行コマンド**: `pnpm run test`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story3-test-results.log`

---

## AC3.1: list_repos パラメータ削除

### 受け入れ条件
- **AC3.1**: list_repos パラメータ削除
  - Given: vibe-kanban MCPが最新バージョン
  - When: `listRepos(projectId)` を呼び出す
  - Then: `project_id` パラメータなしで `list_repos` ツールを呼び出し、リポジトリ一覧が取得できる
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm task:loop 123 > qa-tests/evidence/story3-ac3.1.log 2>&1` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 2 | ログを確認: `grep "list_repos" qa-tests/evidence/story3-ac3.1.log` | `list_repos` ツールが呼び出される | マッチあり | - | - |
| 3 | ログを確認 | パラメータが空 | `list_repos called with arguments: {}` | - | 旧: project_id あり |
| 4 | ログを確認 | リポジトリ一覧が取得される | リポジトリリストが出力される | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story3-ac3.1.log 2>&1

# ログ確認（パラメータが空であることを確認）
grep "list_repos" qa-tests/evidence/story3-ac3.1.log
grep "project_id" qa-tests/evidence/story3-ac3.1.log | grep -v "list_projects"
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story3-ac3.1.log` - コマンド実行ログ

---

## AC3.2: start_workspace_session の新パラメータ

### 受け入れ条件
- **AC3.2**: start_workspace_session の新パラメータ
  - Given: 有効なIssue ID、executor、reposが存在
  - When: `startTaskAttempt(taskId, executor, repos)` を呼び出す
  - Then: `start_workspace_session` に `title`（必須）、`executor`（必須）、`repos`（必須）、`issue_id`（オプション）のパラメータを渡し、Attemptが開始される
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm task:loop 123 > qa-tests/evidence/story3-ac3.2.log 2>&1` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 2 | タスクを選択してAttemptを開始 | - | - | - | - |
| 3 | ログを確認: `grep "start_workspace_session" qa-tests/evidence/story3-ac3.2.log` | `start_workspace_session` ツールが呼び出される | マッチあり | - | - |
| 4 | ログを確認: title パラメータ | `title` が含まれる（必須） | `title: "[Issue22 5.1] ..."` | - | 新規追加 |
| 5 | ログを確認: executor パラメータ | `executor` が含まれる（必須） | `executor: "CLAUDE_CODE"` | - | - |
| 6 | ログを確認: repos パラメータ | `repos` が含まれる（必須） | `repos: [...]` | - | - |
| 7 | ログを確認: issue_id パラメータ | `issue_id` が含まれる（任意） | `issue_id: "xxx"` または なし | - | 旧: task_id（必須） |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story3-ac3.2.log 2>&1

# ログ確認（新パラメータ構造）
grep "start_workspace_session" qa-tests/evidence/story3-ac3.2.log
grep "title:" qa-tests/evidence/story3-ac3.2.log
grep "executor:" qa-tests/evidence/story3-ac3.2.log
grep "repos:" qa-tests/evidence/story3-ac3.2.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story3-ac3.2.log` - コマンド実行ログ

---

## AC3.3: title パラメータの自動生成

### 受け入れ条件
- **AC3.3**: title パラメータの自動生成
  - Given: Issue情報が存在
  - When: `startTaskAttempt` を呼び出す
  - Then: Issue のタイトルまたはタスクグループIDから `title` が自動生成される
  - 検証レベル: Unit

### テストシナリオ

#### title生成ロジック確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | Issue情報が存在する場合 | title がIssueタイトルから生成される | `title: "Issue title"` | - | 優先順位1 |
| 2 | タスクグループIDが存在する場合 | title が `[IssueXX Y.Z]` 形式で生成される | `title: "[Issue22 5.1] Task name"` | - | 優先順位2 |
| 3 | 両方取得できない場合 | デフォルト値が使用される | `title: "Task Attempt"` | - | 優先順位3 |

**実行例**:
```bash
# ログ確認（title生成パターン）
grep "title:" qa-tests/evidence/story3-ac3.2.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story3-ac3.2.log` - コマンド実行ログ（AC3.2と共通）

---

## AC3.4: 後方互換性の確保

### 受け入れ条件
- **AC3.4**: 後方互換性の確保
  - Given: 既存のタスクループフローが存在
  - When: 新しい実装でタスクループを実行
  - Then: 既存の動作が維持され、エラーが発生しない
  - 検証レベル: E2E

### テストシナリオ

#### 既存フロー動作確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 旧バージョンの `.vibe-kanban.json` を配置 | ファイルが存在 | `{"project_id": "xxx"}` | - | - |
| 2 | `pnpm task:loop 123 > qa-tests/evidence/story3-ac3.4.log 2>&1` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 3 | ログを確認 | プロジェクト検証が実行される | "Validating project..." | - | - |
| 4 | プロジェクトが有効な場合 | 既存プロジェクトが使用される | "Using existing project: xxx" | - | - |
| 5 | ログを確認 | タスクループが正常動作 | "Task loop started" | - | - |
| 6 | ログを確認 | エラーログがない | エラーなし | - | - |

**実行例**:
```bash
# 既存の設定ファイルを用意
echo '{"project_id": "existing-project-id"}' > .vibe-kanban.json

# task-loopを実行
pnpm task:loop 123 > qa-tests/evidence/story3-ac3.4.log 2>&1

# エラーログがないことを確認
grep -i "error" qa-tests/evidence/story3-ac3.4.log
```

#### プロジェクトが無効な場合のテスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 無効なプロジェクトIDを設定 | - | - | - | - |
| 2 | `pnpm task:loop 123` を実行 | プロジェクト検証が失敗 | "Project not found" | - | - |
| 3 | - | 再選択フローに遷移 | "Please select organization and project" | - | - |
| 4 | 組織とプロジェクトを再選択 | 正常動作 | "Task loop started" | - | - |

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story3-ac3.4.log` - コマンド実行ログ
- `qa-tests/evidence/story3-ac3.4-existing-config.json` - 既存設定ファイル

---

## 統合テスト結果サマリー

### Story 3全体結果
- **全体ステータス**: - （未実施）
- **完了AC**: 0/4
- **テスト合格率**: 0% (0/4)

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
