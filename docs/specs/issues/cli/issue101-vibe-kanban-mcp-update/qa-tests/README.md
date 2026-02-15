# QAテスト結果ディレクトリ構造

## 概要
このディレクトリは、vibe-kanban MCP破壊的変更対応のQAテスト結果を記録するためのものです。

## ディレクトリ構造
```
qa-tests/
├── README.md           # このファイル（QAテストガイド）
├── scenarios.md        # シナリオテスト仕様（必須）
├── story1/             # Story 1: API名変更対応
│   └── story1.md      # テスト仕様・結果
├── story2/             # Story 2: 組織対応
│   └── story2.md      # テスト仕様・結果
├── story3/             # Story 3: パラメータ変更対応
│   └── story3.md      # テスト仕様・結果
├── story4/             # Story 4: ステータス値統一
│   └── story4.md      # テスト仕様・結果
└── evidence/           # エビデンス格納先
    ├── story1-*.log
    ├── story2-*.log
    └── ...
```

## QAテストファイルの記載内容

1. **ヘッダー情報**: テスト対象Story、実装日、テスター、最終更新日時
2. **各タスクのテスト内容**: 受け入れ条件（AC番号）、テストシナリオ（表形式）、全体ステータス、主な問題点、対応策、エビデンス
3. **統合テスト結果サマリー**: Story全体の結果サマリー、次Storyへの引き継ぎ事項、改善提案
4. **報告と対応**: 失敗原因分類、差し戻し情報、修正優先度

## テスト結果の更新方針

- **上書き更新**: 実施結果セクションは最新の結果のみを記載。過去の履歴は保持しない（Gitで管理）。更新日時を必ず記載。
- **ステータス定義**:
  - ✅ PASS（すべての受け入れ条件を満たす）
  - ❌ FAIL（要修正）
  - ⚠️ PARTIAL（軽微な問題あり）
  - 🔄 未実施（テスト未実施）
- **エビデンスの保存**: `qa-tests/evidence/` 配下にログファイル、テストレポート等を保存。命名規則: `story{N}-{内容}.{拡張子}`

## テストシナリオの記載形式

### CLIコマンドテスト（簡潔な表形式 + コマンド実行例）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | vibe-kanban MCPサーバーを起動 | サーバーが正常起動 | "Server running" | - | - |
| 2 | `pnpm task:loop 123` を実行 | コマンドが正常起動 | エラーなし | - | - |
| 3 | - | 組織一覧が取得される | 組織リストが表示 | - | - |
| 4 | 組織を選択: 1 | - | - | - | - |
| 5 | プロジェクトを選択: 1 | - | - | - | - |
| 6 | - | タスクループが開始される | "Task loop started" | - | - |

**実行例**:
```bash
# vibe-kanban MCPサーバーを起動
cd /path/to/vibe-kanban-mcp
cargo run

# 別ターミナルで task-loop を実行
pnpm task:loop 123
```

**重要**:
- 手順は自然言語で簡潔に記述（例: 「組織を選択: 1」「プロジェクトを選択: 1」）
- コマンドの実行方法と確認方法を「実行例」セクションに記載
- 「-」は手順のみで確認項目がない場合に使用
- 備考欄はテストの区切りや注意事項を記載

### ログ確認テスト（簡潔な表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | タスクループ実行後、ログを確認 | API呼び出しログ | "list_issues" が出力される | - | - |
| 2 | - | エラーログがない | エラーログなし | - | - |
| 3 | ログファイルを保存 | - | - | - | evidence/story1-execution.log |

**実行例**:
```bash
# ログをファイルに保存
pnpm task:loop 123 > qa-tests/evidence/story1-execution.log 2>&1

# ログ内容を確認
grep "list_issues" qa-tests/evidence/story1-execution.log
```

### 型定義確認テスト（簡潔な表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | TypeScriptコンパイルを実行 | 型エラーがない | "Compilation successful" | - | - |
| 2 | types.ts を開く | `VibeKanbanOrganization` 型が定義されている | id, name プロパティ存在 | - | - |
| 3 | - | `VibeKanbanTask` の status 型 | "todo" \| "in-progress" \| "done" \| "cancelled" | - | - |

**実行例**:
```bash
# TypeScriptコンパイル
pnpm exec tsc --noEmit

# 型定義ファイルを確認
cat packages/cli/src/commands/task-loop/lib/types.ts | grep "VibeKanbanOrganization"
```

## テストツール使用例

### Bash（CLIコマンド実行・ログ確認）

```bash
# CLIコマンド実行
pnpm task:loop 123

# ログ確認（特定のAPI呼び出し）
pnpm task:loop 123 2>&1 | grep "list_issues"

# エラーログ確認
pnpm task:loop 123 2>&1 | grep -i "error"

# 型定義確認
pnpm exec tsc --noEmit
```

### 自動テスト実行

```bash
# ユニットテスト
pnpm run test

# Lintチェック
pnpm run lint

# 型チェック
pnpm run typecheck

# 全テスト
pnpm run prepush
```

## 特記事項

### CLIテストの特徴

このタスクは**CLIツールの修正**であり、ブラウザテスト（Playwright MCP）は不要です。以下の方法でテストを実施します：

1. **コマンド実行テスト**: `pnpm task:loop` を実行し、正常動作を確認
2. **ログ確認テスト**: コマンド実行時のログから、正しいAPI呼び出しが行われているか確認
3. **型定義確認テスト**: TypeScriptコンパイルで型エラーがないことを確認
4. **自動テスト実行**: `pnpm test`, `pnpm lint`, `pnpm typecheck` で自動チェック

### 環境構築

テスト実施前に、以下の環境を構築してください：

1. vibe-kanban MCPサーバーを起動（`cargo run`）
2. プロジェクトの依存関係をインストール（`pnpm install`）
3. 開発サーバーを起動（`pnpm dev:bg`）

### エビデンス管理

以下のエビデンスを `evidence/` ディレクトリに保存してください：

- **コマンド実行ログ**: `story{N}-execution.log`
- **エラーログ**: `story{N}-error.log`（エラー発生時のみ）
- **TypeScriptコンパイル結果**: `story{N}-tsc-output.log`
- **自動テスト結果**: `story{N}-test-results.log`
