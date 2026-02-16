# Story 2: 組織対応（list_organizations API） QAテスト結果

## テスト対象タスク
- **Story ID**: Story 2
- **Story名**: 組織対応（list_organizations API）
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

**エビデンス**: `qa-tests/evidence/story2-tsc-output.log`

### Lintチェック
**実行コマンド**: `pnpm run lint`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story2-lint-output.log`

### ユニットテスト
**実行コマンド**: `pnpm run test`

**結果**: - （未実施）

**エビデンス**: `qa-tests/evidence/story2-test-results.log`

---

## AC2.1: 組織一覧の取得（list_organizations）

### 受け入れ条件
- **AC2.1**: 組織一覧の取得
  - Given: vibe-kanban MCPが接続済み
  - When: `listOrganizations()` メソッドを呼び出す
  - Then: `list_organizations` ツールを呼び出し、組織一覧が取得できる
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | vibe-kanban MCPサーバーを起動 | サーバーが正常起動 | "Server running" | - | - |
| 2 | `pnpm task:loop 123 > qa-tests/evidence/story2-ac2.1.log 2>&1` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 3 | ログを確認: `grep "list_organizations" qa-tests/evidence/story2-ac2.1.log` | `list_organizations` ツールが呼び出される | マッチあり | - | - |
| 4 | ログを確認 | 組織一覧が表示される | "1. Organization A", "2. Organization B" | - | - |
| 5 | ログを確認 | 組織の id と name が含まれる | `{id: "xxx", name: "Org A"}` | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story2-ac2.1.log 2>&1

# ログ確認
grep "list_organizations" qa-tests/evidence/story2-ac2.1.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story2-ac2.1.log` - コマンド実行ログ

---

## AC2.2: 組織IDを使用したプロジェクト一覧取得

### 受け入れ条件
- **AC2.2**: 組織IDを使用したプロジェクト一覧取得
  - Given: 有効な組織IDが存在
  - When: `listProjects(organizationId)` を呼び出す
  - Then: 指定された組織に属するプロジェクト一覧が取得できる
  - 検証レベル: Integration

### テストシナリオ

#### API呼び出し確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm task:loop 123` を実行 | 組織選択画面が表示される | "Select organization:" | - | - |
| 2 | 組織を選択: 1 | - | - | - | - |
| 3 | ログを確認: `grep "list_projects" qa-tests/evidence/story2-ac2.2.log` | `list_projects` ツールが呼び出される | マッチあり | - | - |
| 4 | ログを確認: `grep "organization_id" qa-tests/evidence/story2-ac2.2.log` | パラメータに `organization_id` が含まれる | `organization_id: xxx` | - | 旧: パラメータなし |
| 5 | ログを確認 | 選択した組織のプロジェクトのみ表示される | 組織Aのプロジェクトリスト | - | - |

**実行例**:
```bash
# task-loopを実行（ログをファイルに保存）
pnpm task:loop 123 > qa-tests/evidence/story2-ac2.2.log 2>&1

# ログ確認
grep "organization_id" qa-tests/evidence/story2-ac2.2.log
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story2-ac2.2.log` - コマンド実行ログ

---

## AC2.3: 組織型定義の追加（VibeKanbanOrganization）

### 受け入れ条件
- **AC2.3**: 組織型定義の追加
  - Given: TypeScriptプロジェクト
  - When: `VibeKanbanOrganization` 型を参照
  - Then: 型が正しく定義され、`id` と `name` プロパティが存在する
  - 検証レベル: Unit

### テストシナリオ

#### 型定義確認テスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm exec tsc --noEmit > qa-tests/evidence/story2-ac2.3.log 2>&1` を実行 | TypeScriptコンパイル成功 | エラーなし | - | - |
| 2 | types.ts を開く | `VibeKanbanOrganization` 型が定義されている | interface が存在 | - | - |
| 3 | types.ts を確認: id プロパティ | `id: string` が定義されている | id: string | - | - |
| 4 | types.ts を確認: name プロパティ | `name: string` が定義されている | name: string | - | - |

**実行例**:
```bash
# TypeScriptコンパイル（型チェックのみ）
pnpm exec tsc --noEmit > qa-tests/evidence/story2-ac2.3.log 2>&1

# types.ts を確認
cat packages/cli/src/commands/task-loop/lib/types.ts | grep "VibeKanbanOrganization"
```

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story2-ac2.3.log` - TypeScriptコンパイル結果

---

## AC2.4: プロジェクト選択時の組織選択フロー

### 受け入れ条件
- **AC2.4**: プロジェクト選択時の組織選択フロー
  - Given: 複数の組織が存在
  - When: `selectProject` を実行
  - Then: 組織を選択してからプロジェクトを選択できる
  - 検証レベル: Integration

### テストシナリオ

#### 組織選択フローテスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | `pnpm task:loop 123` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 2 | - | 組織一覧が表示される | "Select organization:" | - | - |
| 3 | - | 複数の組織が選択肢として表示される | "1. Org A", "2. Org B" | - | - |
| 4 | 組織を選択: 1 | - | - | - | - |
| 5 | - | プロジェクト一覧が表示される | "Select project:" | - | - |
| 6 | - | 選択した組織のプロジェクトのみ表示される | 組織Aのプロジェクトリスト | - | - |
| 7 | プロジェクトを選択: 1 | - | - | - | - |
| 8 | - | 選択結果が保存される | ".vibe-kanban.json updated" | - | - |

**実行例**:
```bash
# 既存の設定ファイルを削除（クリーンな状態でテスト）
rm .vibe-kanban.json

# task-loopを実行
pnpm task:loop 123 > qa-tests/evidence/story2-ac2.4.log 2>&1

# 設定ファイルを確認
cat .vibe-kanban.json
```

#### 組織が1つだけの場合のテスト

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 組織が1つだけの環境を準備 | - | - | - | - |
| 2 | `pnpm task:loop 123` を実行 | 組織選択をスキップ | "Using organization: xxx" | - | - |
| 3 | - | 直接プロジェクト選択画面に遷移 | "Select project:" | - | - |

### 全体ステータス: - （未実施）

#### 主な問題点
- （実施後に記載）

#### 対応策
- （実施後に記載）

#### エビデンス
- `qa-tests/evidence/story2-ac2.4.log` - コマンド実行ログ
- `qa-tests/evidence/story2-ac2.4-config.json` - 生成された設定ファイル

---

## 統合テスト結果サマリー

### Story 2全体結果
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
