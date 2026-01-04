# QAテスト結果ディレクトリ構造

## 概要
このディレクトリは、playground環境でのTodoアプリ基本機能のQAテスト結果を記録するためのものです。
`pnpm task:loop`コマンドの検証用仮想タスク（Issue #33）として、タスク実装後のQAテスト結果を管理します。

## ディレクトリ構造
```
qa-tests/
├── README.md       # このファイル（QAテストガイド）
├── scenarios.md    # シナリオテスト仕様（必須）
├── phase1.md       # Phase 1（データ層）のテスト結果
├── phase2.md       # Phase 2（API層+UI層）のテスト結果
├── phase1/
│   └── evidence/   # スクリーンショット等のエビデンス
└── phase2/
    └── evidence/   # スクリーンショット等のエビデンス
```

## QAテストファイルの記載内容

各QAテストファイル（例：`phase1.md`、`phase2.md`）には以下を記載：

1. **ヘッダー情報**: テスト対象タスクID、タスク名、実装日、テスト実施日
2. **各タスクのテスト内容**: 受け入れ条件（AC番号）、テストシナリオ（表形式）、全体ステータス、主な問題点、対応策、エビデンス
3. **統合テスト結果サマリー**: フェーズ全体の結果サマリー、次フェーズへの引き継ぎ事項、改善提案
4. **報告と対応**: 失敗原因分類、差し戻し情報、修正優先度

## テスト結果の更新方針

- **上書き更新**: 実施結果セクションは最新の結果のみを記載。過去の履歴は保持しない（Gitで管理）。更新日時を必ず記載。
- **ステータス定義**: ✅ PASS（すべての受け入れ条件を満たす）、❌ FAIL（要修正）、⚠️ PARTIAL（軽微な問題あり）、🔄 未実施（テスト未実施）
- **エビデンスの保存**: `qa-tests/phase1/evidence/`、`qa-tests/phase2/evidence/` 配下にログファイル、スクリーンショット、テストレポート等を保存。命名規則: `{フェーズ番号}-{AC番号}-{内容}.{拡張子}`
- **実施タイミング**: タスク完了時（個別テスト）、フェーズ完了時（統合テスト）、リリース前（回帰テスト）

## テストシナリオの記載形式

### 画面操作テスト（簡潔な表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ブラウザで http://localhost:3000/playground/todo-app に移動 | ページ表示 | "Todo App"タイトルが表示される | - | - |
| 2 | スナップショット取得 | Todo一覧が表示される | Todo配列が表示される | - | - |
| 3 | フォームに"新しいTodo"と入力 | - | - | - | - |
| 4 | 送信ボタンをクリック | Todo追加 | 新しいTodoが一覧に追加される | - | - |

**重要**:
- 手順は自然言語で簡潔に記述（例: 「ブラウザで移動」「フォームに入力: 新しいTodo」）
- mcp__playwrightなどのコマンドは記載しない
- 「-」は手順のみで確認項目がない場合に使用
- 備考欄はテストの区切りや注意事項を記載

### APIテスト（簡潔な表形式 + curlコマンド）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "買い物に行く") | ステータスコード | 201 Created | - | - |
| 2 | - | レスポンスボディ | {"id":"...","title":"買い物に行く","completed":false,...} | - | - |
| 3 | GET /api/todos | 一覧取得 | 作成したTodoが含まれる | - | - |

**実行例**:
```bash
# Todo作成
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"買い物に行く"}'

# Todo一覧取得
curl -i http://localhost:3000/api/todos
```

### データモデル確認テスト（表形式）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | playground/todo-app/prisma/schema.prismaを開く | ファイル存在 | ファイルが存在する | - | データモデル定義 |
| 2 | - | Todoモデル定義 | model Todo { ... }が定義されている | - | - |
| 3 | pnpm db:push 実行 | マイグレーション実行 | 成功メッセージが表示される | - | - |

## テストツール使用例

### Playwright MCP（画面テスト実行）

**使用方法**:
```
1. browser_navigate で http://localhost:3000/playground/todo-app に移動
2. browser_snapshot でページ状態を取得
3. browser_type でフォームに"新しいTodo"と入力
4. browser_click で送信ボタンをクリック
5. browser_snapshot で一覧更新を確認
```

**注意事項**:
- Playwright MCPはtask-qa Skillが実行
- テスト仕様書には自然言語の手順のみを記載
- 具体的なMCPコマンドは記載しない

### Bash（APIテスト実行）

**使用方法**:
```bash
# APIエンドポイントテスト
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"テストTodo"}'

# データベース確認（Prisma Studio）
pnpm exec prisma studio

# マイグレーション状態確認
pnpm exec prisma migrate status
```

### 自動テスト実行

**必須自動テスト**（Phase 1, 2共通）:
```bash
# 1. ユニットテスト
pnpm test

# 2. Lintチェック
pnpm lint

# 3. ビルドチェック
pnpm build

# 4. 型チェック（TypeScript）
pnpm typecheck
```

**重要**: 上記のいずれか1つでも失敗した場合、全体ステータスは**❌ FAIL**となります。

## フェーズ別テスト概要

### Phase 1: データ層実装

**対象**: Story 1（Todoデータモデルの定義）

**テスト内容**:
- AC1.1: Todoデータモデル定義確認
- AC1.2: マイグレーション実行確認
- AC1.3: Prismaクライアント生成確認

**検証レベル**: Unit（スキーマバリデーション、型チェック）、Integration（実際のDB接続）

### Phase 2: API層+UI層実装

**対象**: Story 2～6（Todo CRUD API + UIコンポーネント）

**テスト内容**:
- Story 2: Todo一覧取得API（AC2.1-2.3）
- Story 3: Todo新規作成API（AC3.1-3.4）
- Story 4: Todo更新API（AC4.1-4.4）
- Story 5: Todo削除API（AC5.1-5.3）
- Story 6: TodoリストUIコンポーネント（AC6.1-6.6）

**検証レベル**: Unit（バリデーション）、Integration（API + DB）、Browser（Playwright MCP）

## シナリオテスト

**ファイル**: `scenarios.md`

**概要**: 複数タスクをまたぐ継続操作のシナリオテストを定義します。各タスク完了後に、該当するシナリオテストを実行してください。

**主要シナリオ**:
1. **Todo完全CRUDフロー**: 作成→一覧→更新→削除の一連のフロー
2. **バリデーションとエラーハンドリング**: 各種バリデーションエラーと異常系
3. **データ永続化と整合性**: DB永続化とリロード後のデータ保持
4. **ローディング状態とUX**: API呼び出し中のローディング表示
5. **空のTodoリスト表示**: Todoが1件も存在しない場合の表示

**実施タイミング**:
- **Phase 1完了後**: データモデル・マイグレーション部分のみ
- **Phase 2 API層完了後**: API統合テスト部分まで
- **Phase 2 UI層完了後**: 全シナリオ（完全なエンドツーエンド確認）
- **リグレッション**: 後続のバグ修正時に再実行

## エビデンス管理

### エビデンス保存場所
- `qa-tests/phase1/evidence/` - Phase 1のエビデンス
- `qa-tests/phase2/evidence/` - Phase 2のエビデンス

### 命名規則
```
{フェーズ番号}-{AC番号}-{内容}.{拡張子}

例:
phase1/evidence/
├── 1-AC1.2-migration.log           # マイグレーション実行ログ
├── 1-AC1.3-prisma-generate.log     # Prismaクライアント生成ログ

phase2/evidence/
├── 2-AC2.1-get-todos-response.json # Todo一覧取得レスポンス
├── 2-AC3.1-create-todo-response.json # Todo作成レスポンス
├── 2-AC6.1-todo-list-ui.png        # Todo一覧画面のスクリーンショット
├── 2-AC6.3-completed-todo.png      # 完了済みTodo表示
├── 2-AC6.6-error-display.png       # エラー表示画面
```

## 失敗原因分類（A/B/C/D）

QAテスト失敗時、以下の4分類のいずれかに分類し、適切な戻し先を決定します。

### 分類フローチャート

```
QAテスト失敗
    ↓
質問1: 実装コードに問題があるか？
  YES → 【A: 実装ミス】 → task-executer
  NO → 質問2へ
    ↓
質問2: requirements.md の受け入れ条件が不正確・不完全か？
  YES → 【B: 要件齟齬】 → requirements.md修正 → task-executer
  NO → 質問3へ
    ↓
質問3: design.md の設計・アーキテクチャに問題があるか？
  YES → 【C: 設計不備】 → design.md修正 → task-executer
  NO → 質問4へ
    ↓
質問4: 環境・インフラ・テストツールに問題があるか？
  YES → 【D: 環境問題】 → qa再実行
  NO → デフォルトで【A: 実装ミス】として扱う
```

### 各分類の定義

| 分類 | 定義 | 判定基準例 | 戻し先 |
|-----|------|----------|-------|
| **A: 実装ミス** | コードの論理エラー、バグ、実装漏れ | TypeScriptエラー、ランタイムエラー、ロジック不具合、単体テスト失敗 | task-executer |
| **B: 要件齟齬** | requirements.md の受け入れ条件が実際の要求と異なる | ACの期待結果が曖昧、ビジネスルール未記載、AC間の矛盾 | requirements.md修正 → task-executer |
| **C: 設計不備** | design.md のアーキテクチャ・設計方針に問題 | トランザクション設計不備、スキーマ設計ミス、インターフェース不備 | design.md修正 → task-executer |
| **D: 環境問題** | テスト環境、インフラ、ツールの問題 | DB接続エラー、Playwright接続失敗、タイムアウト、ポート競合 | qa再実行 |

## 参考情報

### 関連ドキュメント
- [要件定義書](../requirements.md)
- [設計書](../design.md)
- [QAテストガイドライン](/docs/steering/acceptance-criteria-and-qa-guide.md)
- [テスト用語辞書](/docs/steering/terminology.md)

### 検証レベル
- **Unit**: 単一モジュールのロジック検証（Vitest）
- **Integration**: 境界を超えた契約検証（API + DB、curl）
- **E2E**: Playwrightコードによる自動テスト（`pnpm test:e2e`）※本プロジェクトでは未使用
- **Browser**: Playwright MCPによるブラウザテスト（task-qa Skill）

詳細は `/docs/steering/terminology.md` を参照してください。

## トラブルシューティング

### よくある問題と解決策

#### 1. PostgreSQL接続エラー
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解決策**:
```bash
# PostgreSQLコンテナが起動しているか確認
docker-compose ps

# 起動していない場合は起動
docker-compose up -d postgres

# 接続確認
pnpm exec prisma db pull
```

#### 2. Prismaクライアント型エラー
```bash
Error: @prisma/client did not initialize yet
```

**解決策**:
```bash
# Prismaクライアントを再生成
pnpm db:generate

# 型チェック
pnpm typecheck
```

#### 3. マイグレーション競合
```bash
Error: P3006 - Migration conflict
```

**解決策**:
```bash
# マイグレーション状態確認
pnpm exec prisma migrate status

# リセット（開発環境のみ）
pnpm exec prisma migrate reset

# 再実行
pnpm db:push
```

#### 4. Playwright MCP接続エラー

**解決策**:
- ブラウザが起動しているか確認
- ポート3000でアプリが起動しているか確認
- `pnpm dev`で開発サーバーを起動

## まとめ

このQAテスト仕様は、`pnpm task:loop`コマンドの検証用として、Todoアプリの基本的なCRUD操作を網羅的にテストします。

**テスト実施の流れ**:
1. Phase 1完了後: データモデル・マイグレーション確認
2. Phase 2 API層完了後: API統合テスト実行
3. Phase 2 UI層完了後: ブラウザテスト実行、シナリオテスト実行
4. 全体完了後: リグレッションテスト実行

各フェーズのテスト結果は、`phase1.md`、`phase2.md`に記録してください。
