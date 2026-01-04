# Phase 2: API層+UI層実装 QAテスト結果

## テスト対象タスク
- **タスクID**: Story 2～6
- **タスク名**: API実装（CRUD操作）+ UIコンポーネント実装
- **実装日**: TBD
- **テスター**: TBD
- **最終更新**: -

## テストサマリー
| ステータス | 件数 |
|----------|-----|
| ✅ PASS | 0 |
| ❌ FAIL | 0 |
| ⚠️ PARTIAL | 0 |
| 🔄 未実施 | 20 |

---

## 必須自動テスト結果

### 実行コマンド
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

### 結果
| テスト項目 | ステータス | 備考 |
|----------|----------|------|
| ユニットテスト | - | 未実施 |
| Lintチェック | - | 未実施 |
| ビルドチェック | - | 未実施 |
| 型チェック | - | 未実施 |

**重要**: 上記のいずれか1つでも失敗した場合、全体ステータスは**❌ FAIL**となります。

---

## タスク Story 2: Todo一覧取得API実装

### 受け入れ条件
- **AC2.1**: GET /api/todos エンドポイント実装
  - Given: データベースにTodoレコードが存在する
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス200とTodo配列のJSON（id, title, completed, createdAt, updatedAt）が返る
  - 検証レベル: Integration（API + DB）

- **AC2.2**: 空のTodoリスト取得
  - Given: データベースにTodoレコードが存在しない
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス200と空配列[]が返る
  - 検証レベル: Integration（API + DB）

- **AC2.3**: エラーハンドリング
  - Given: データベース接続エラーが発生
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス500とエラーメッセージ{"error": "Internal Server Error"}が返る
  - 検証レベル: Integration（エラーケース）

### テストシナリオ

#### AC2.1: Todo一覧取得（正常系）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | Prisma Studioで2件のTodoを作成 | - | - | - | 事前準備 |
| 2 | GET /api/todos | ステータスコード | 200 OK | - | APIテスト |
| 3 | - | Content-Type | application/json | - | - |
| 4 | - | レスポンスボディ | Todo配列（2件） | - | - |
| 5 | - | Todoオブジェクト構造 | id, title, completed, createdAt, updatedAtが含まれる | - | - |
| 6 | - | ソート順 | 未完了が上、完了済みが下、createdAt降順 | - | 仕様確認 |

**実行例**:
```bash
curl -i http://localhost:3000/api/todos
```

**期待レスポンス例**:
```json
[
  {
    "id": "cm5abc123",
    "title": "買い物に行く",
    "completed": false,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  {
    "id": "cm5def456",
    "title": "レポート提出",
    "completed": true,
    "createdAt": "2025-01-15T09:00:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

#### AC2.2: 空のTodoリスト取得

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | Prisma Studioで全Todoを削除 | - | - | - | 事前準備 |
| 2 | GET /api/todos | ステータスコード | 200 OK | - | APIテスト |
| 3 | - | レスポンスボディ | [] | - | 空配列 |

**実行例**:
```bash
curl -i http://localhost:3000/api/todos
```

#### AC2.3: エラーハンドリング

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | PostgreSQLコンテナを停止 (docker-compose stop postgres) | - | - | - | エラー発生準備 |
| 2 | GET /api/todos | ステータスコード | 500 Internal Server Error | - | APIテスト |
| 3 | - | レスポンスボディ | {"error": "Internal Server Error"} | - | - |
| 4 | PostgreSQLコンテナを起動 (docker-compose start postgres) | - | - | - | 復旧 |

### 全体ステータス: - （未実施）

---

## タスク Story 3: Todo新規作成API実装

### 受け入れ条件
- **AC3.1**: POST /api/todos エンドポイント実装
  - Given: 有効なTodoデータ（title: "買い物に行く"）を送信
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス201と作成されたTodoオブジェクト（id, title, completed: false, createdAt, updatedAt）が返る
  - 検証レベル: Integration（API + DB）

- **AC3.2**: バリデーション - 必須フィールド
  - Given: titleが空文字または未指定
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Title is required"}が返る
  - 検証レベル: Unit（バリデーション）

- **AC3.3**: バリデーション - 文字数制限
  - Given: titleが255文字を超える
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Title must be 255 characters or less"}が返る
  - 検証レベル: Unit（バリデーション）

- **AC3.4**: データベース永続化確認
  - Given: 有効なTodoデータを送信
  - When: POST /api/todosにリクエストを送信し、その後GET /api/todosで一覧取得
  - Then: 作成したTodoが一覧に含まれる
  - 検証レベル: Integration（API + DB）

### テストシナリオ

#### AC3.1: Todo新規作成（正常系）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "買い物に行く") | ステータスコード | 201 Created | - | APIテスト |
| 2 | - | Content-Type | application/json | - | - |
| 3 | - | レスポンスボディ構造 | id, title, completed, createdAt, updatedAtが含まれる | - | - |
| 4 | - | titleフィールド | "買い物に行く" | - | - |
| 5 | - | completedフィールド | false | - | デフォルト値 |
| 6 | - | idフィールド | CUID形式の文字列 | - | - |
| 7 | - | createdAt/updatedAt | ISO 8601形式のタイムスタンプ | - | - |

**実行例**:
```bash
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"買い物に行く"}'
```

#### AC3.2: バリデーション - 必須フィールド

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (titleなし) | ステータスコード | 400 Bad Request | - | バリデーションエラー |
| 2 | - | レスポンスボディ | {"error": "Title is required"} | - | - |
| 3 | POST /api/todos (title: "") | ステータスコード | 400 Bad Request | - | 空文字バリデーション |
| 4 | - | レスポンスボディ | {"error": "Title is required"} | - | - |

**実行例**:
```bash
# titleなし
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{}'

# title空文字
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":""}'
```

#### AC3.3: バリデーション - 文字数制限

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: 256文字) | ステータスコード | 400 Bad Request | - | 文字数超過 |
| 2 | - | レスポンスボディ | {"error": "Title must be 255 characters or less"} | - | - |

**実行例**:
```bash
# 256文字のタイトル
curl -i -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"'$(printf 'a%.0s' {1..256})'"}'
```

#### AC3.4: データベース永続化確認

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "永続化テスト") | Todo作成 | 201 Created | - | - |
| 2 | レスポンスからidを取得 | - | - | - | - |
| 3 | GET /api/todos | 一覧取得 | 200 OK | - | - |
| 4 | - | 作成したTodoが含まれる | title: "永続化テスト"のTodoが配列に存在 | - | 永続化確認 |
| 5 | Prisma Studioで確認 | DBに保存されている | todosテーブルにレコードが存在 | - | DB確認 |

### 全体ステータス: - （未実施）

---

## タスク Story 4: Todo更新API実装

### 受け入れ条件
- **AC4.1**: PUT /api/todos/:id エンドポイント実装（完了状態切り替え）
  - Given: 未完了のTodo（id: "abc123", completed: false）が存在
  - When: PUT /api/todos/abc123 に{"completed": true}を送信する
  - Then: HTTPステータス200と更新されたTodoオブジェクト（completed: true, updatedAt更新済み）が返る
  - 検証レベル: Integration（API + DB）

- **AC4.2**: タイトル更新
  - Given: Todo（id: "abc123", title: "旧タイトル"）が存在
  - When: PUT /api/todos/abc123 に{"title": "新タイトル"}を送信する
  - Then: HTTPステータス200と更新されたTodoオブジェクト（title: "新タイトル", updatedAt更新済み）が返る
  - 検証レベル: Integration（API + DB）

- **AC4.3**: 存在しないTodoの更新
  - Given: 存在しないTodo ID（"nonexistent"）を指定
  - When: PUT /api/todos/nonexistentにリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（エラーケース）

- **AC4.4**: バリデーション - 無効なデータ
  - Given: 有効なTodo IDを指定
  - When: PUT /api/todos/:id に無効なデータ（例: completed: "invalid"）を送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Invalid data"}が返る
  - 検証レベル: Unit（バリデーション）

### テストシナリオ

#### AC4.1: 完了状態切り替え

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "テストTodo", completed: false) | Todo作成 | 201 Created | - | 事前準備 |
| 2 | レスポンスからidを取得 | - | - | - | - |
| 3 | PUT /api/todos/:id (completed: true) | ステータスコード | 200 OK | - | 更新テスト |
| 4 | - | completedフィールド | true | - | - |
| 5 | - | updatedAtフィールド | 作成時より後のタイムスタンプ | - | 自動更新確認 |
| 6 | GET /api/todos/:id | 更新確認 | completedがtrueのまま | - | 永続化確認 |

**実行例**:
```bash
# Todo作成
TODO_ID=$(curl -s -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"テストTodo"}' | jq -r '.id')

# 完了状態に更新
curl -i -X PUT http://localhost:3000/api/todos/$TODO_ID \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

#### AC4.2: タイトル更新

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "旧タイトル") | Todo作成 | 201 Created | - | 事前準備 |
| 2 | PUT /api/todos/:id (title: "新タイトル") | ステータスコード | 200 OK | - | 更新テスト |
| 3 | - | titleフィールド | "新タイトル" | - | - |
| 4 | - | updatedAtフィールド | 更新されている | - | - |

**実行例**:
```bash
curl -i -X PUT http://localhost:3000/api/todos/$TODO_ID \
  -H "Content-Type: application/json" \
  -d '{"title":"新タイトル"}'
```

#### AC4.3: 存在しないTodoの更新

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | PUT /api/todos/nonexistent | ステータスコード | 404 Not Found | - | エラーケース |
| 2 | - | レスポンスボディ | {"error": "Todo not found"} | - | - |

**実行例**:
```bash
curl -i -X PUT http://localhost:3000/api/todos/nonexistent \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

#### AC4.4: バリデーション - 無効なデータ

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | PUT /api/todos/:id (completed: "invalid") | ステータスコード | 400 Bad Request | - | 型バリデーション |
| 2 | - | レスポンスボディ | {"error": "Invalid data"} | - | - |

**実行例**:
```bash
curl -i -X PUT http://localhost:3000/api/todos/$TODO_ID \
  -H "Content-Type: application/json" \
  -d '{"completed":"invalid"}'
```

### 全体ステータス: - （未実施）

---

## タスク Story 5: Todo削除API実装

### 受け入れ条件
- **AC5.1**: DELETE /api/todos/:id エンドポイント実装
  - Given: Todo（id: "abc123"）が存在
  - When: DELETE /api/todos/abc123にリクエストを送信する
  - Then: HTTPステータス204（No Content）が返り、レスポンスボディは空
  - 検証レベル: Integration（API + DB）

- **AC5.2**: 削除確認
  - Given: Todo（id: "abc123"）を削除済み
  - When: GET /api/todos/abc123にリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（API + DB）

- **AC5.3**: 存在しないTodoの削除
  - Given: 存在しないTodo ID（"nonexistent"）を指定
  - When: DELETE /api/todos/nonexistentにリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（エラーケース）

### テストシナリオ

#### AC5.1: Todo削除（正常系）

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | POST /api/todos (title: "削除テスト") | Todo作成 | 201 Created | - | 事前準備 |
| 2 | レスポンスからidを取得 | - | - | - | - |
| 3 | DELETE /api/todos/:id | ステータスコード | 204 No Content | - | 削除テスト |
| 4 | - | レスポンスボディ | 空 | - | - |

**実行例**:
```bash
# Todo作成
TODO_ID=$(curl -s -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"削除テスト"}' | jq -r '.id')

# 削除
curl -i -X DELETE http://localhost:3000/api/todos/$TODO_ID
```

#### AC5.2: 削除確認

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 前の手順で削除したTodoのIDを使用 | - | - | - | - |
| 2 | GET /api/todos/:id | ステータスコード | 404 Not Found | - | 削除確認 |
| 3 | - | レスポンスボディ | {"error": "Todo not found"} | - | - |
| 4 | GET /api/todos | 一覧確認 | 削除したTodoが含まれない | - | - |
| 5 | Prisma Studioで確認 | DBから削除されている | レコードが存在しない | - | DB確認 |

**実行例**:
```bash
# 削除確認（404を期待）
curl -i http://localhost:3000/api/todos/$TODO_ID
```

#### AC5.3: 存在しないTodoの削除

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | DELETE /api/todos/nonexistent | ステータスコード | 404 Not Found | - | エラーケース |
| 2 | - | レスポンスボディ | {"error": "Todo not found"} | - | - |

**実行例**:
```bash
curl -i -X DELETE http://localhost:3000/api/todos/nonexistent
```

### 全体ステータス: - （未実施）

---

## タスク Story 6: TodoリストUIコンポーネント実装

### 受け入れ条件
- **AC6.1**: TodoList コンポーネント実装
  - Given: playground/todo-app/page.tsxが実装されている
  - When: ブラウザでページにアクセスする
  - Then: Todo一覧が表示され、各Todoにタイトル、チェックボックス、削除ボタンが含まれる
  - 検証レベル: Browser（Playwright MCP）

- **AC6.2**: TodoForm コンポーネント実装
  - Given: TodoListページを表示
  - When: フォームに新しいTodoタイトルを入力し送信ボタンをクリックする
  - Then: 新しいTodoが一覧に追加される
  - 検証レベル: Browser（Playwright MCP）

- **AC6.3**: 完了状態の切り替え
  - Given: 未完了のTodoが表示されている
  - When: チェックボックスをクリックする
  - Then: Todoが完了状態になり、視覚的に区別される（例: 取り消し線、グレーアウト）
  - 検証レベル: Browser（Playwright MCP）

- **AC6.4**: Todo削除操作
  - Given: Todoが一覧に表示されている
  - When: 削除ボタンをクリックする
  - Then: 確認ダイアログが表示され、OKを押すとTodoが一覧から消える
  - 検証レベル: Browser（Playwright MCP）

- **AC6.5**: ローディング状態表示
  - Given: API呼び出し中
  - When: データ取得・更新・削除処理が実行中
  - Then: ローディングインジケーター（スピナーまたはスケルトン）が表示される
  - 検証レベル: Browser（Playwright MCP）

- **AC6.6**: エラー表示
  - Given: API呼び出しが失敗
  - When: ネットワークエラーまたはサーバーエラーが発生
  - Then: ユーザーフレンドリーなエラーメッセージが表示され、リトライ可能な操作が提示される
  - 検証レベル: Browser（Playwright MCP）

### テストシナリオ

#### AC6.1: TodoList コンポーネント表示

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | APIで2件のTodoを作成（1件完了済み、1件未完了） | - | - | - | 事前準備 |
| 2 | ブラウザで http://localhost:3000/playground/todo-app に移動 | ページ表示 | "Todo App"タイトルが表示される | - | Browser |
| 3 | - | Todo一覧表示 | 2件のTodoが表示される | - | - |
| 4 | - | 各Todoの構成 | タイトル、チェックボックス、削除ボタンが含まれる | - | - |
| 5 | - | 未完了Todoの表示 | 通常のテキスト表示 | - | - |
| 6 | - | 完了済みTodoの表示 | 取り消し線とグレー表示 | - | - |
| 7 | - | 並び順 | 未完了が上、完了済みが下 | - | - |

**Playwright MCP使用手順**:
```
1. browser_navigate で http://localhost:3000/playground/todo-app に移動
2. browser_snapshot でページ状態を取得
3. "Todo App"タイトルの存在を確認
4. Todo一覧の表示を確認
5. 各Todoの要素（タイトル、チェックボックス、削除ボタン）を確認
```

#### AC6.2: TodoForm コンポーネント - Todo追加

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ブラウザで http://localhost:3000/playground/todo-app に移動 | - | - | - | Browser |
| 2 | フォームの入力欄に"新しいTodo"と入力 | - | - | - | - |
| 3 | 送信ボタン（"追加"）をクリック | ボタン状態 | 一時的に無効化される | - | ローディング |
| 4 | - | 一覧更新 | "新しいTodo"が一覧に追加される | - | - |
| 5 | - | フォームクリア | 入力欄が空になる | - | - |
| 6 | - | 新しいTodoの位置 | 一覧の最上部に表示される | - | - |

**Playwright MCP使用手順**:
```
1. browser_navigate でページに移動
2. browser_type でフォームに"新しいTodo"と入力
3. browser_click で送信ボタンをクリック
4. browser_snapshot で一覧更新を確認
5. 新しいTodoが追加されたことを確認
```

#### AC6.3: 完了状態の切り替え

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 未完了のTodoを表示 | - | - | - | 事前準備 |
| 2 | 未完了Todoのチェックボックスをクリック | 視覚的変化 | 取り消し線とグレー表示になる | - | Browser |
| 3 | - | チェックボックス状態 | チェックマークが付く | - | - |
| 4 | ページをリロード (F5) | 状態保持 | 完了状態が維持される | - | 永続化確認 |
| 5 | 完了済みTodoのチェックボックスをクリック | 視覚的変化 | 取り消し線とグレー表示が解除される | - | - |

**Playwright MCP使用手順**:
```
1. browser_click でチェックボックスをクリック
2. browser_snapshot で視覚的変化を確認
3. browser_navigate でページリロード
4. browser_snapshot で状態保持を確認
```

#### AC6.4: Todo削除操作

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | 削除対象のTodoを表示 | - | - | - | 事前準備 |
| 2 | 削除ボタンをクリック | 確認ダイアログ | "このTodoを削除しますか？"が表示される | - | Browser |
| 3 | キャンセルをクリック | Todoが残る | 一覧に変化なし | - | キャンセル動作 |
| 4 | 再度削除ボタンをクリック | 確認ダイアログ | "このTodoを削除しますか？"が表示される | - | - |
| 5 | OKをクリック | Todoが削除される | 一覧から消える | - | - |
| 6 | ページをリロード (F5) | 削除確認 | 削除されたTodoが表示されない | - | 永続化確認 |

**Playwright MCP使用手順**:
```
1. browser_click で削除ボタンをクリック
2. browser_snapshot で確認ダイアログを確認
3. ダイアログでOKをクリック
4. browser_snapshot でTodoが削除されたことを確認
```

#### AC6.5: ローディング状態表示

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | ブラウザで http://localhost:3000/playground/todo-app に移動 | 初回ローディング | "読み込み中..."が表示される | - | Browser |
| 2 | データ取得完了 | ローディング終了 | Todo一覧が表示される | - | - |
| 3 | フォームに"テスト"と入力して送信 | 送信中ローディング | ボタン無効化、スピナー表示 | - | - |
| 4 | 作成完了 | ローディング終了 | ボタンが再度有効化される | - | - |

**Playwright MCP使用手順**:
```
1. browser_navigate で初回ローディングを観察
2. browser_snapshot でローディング表示を確認
3. データ取得後のスナップショットで一覧表示を確認
```

#### AC6.6: エラー表示

| No | 手順 | 確認項目 | 期待値 | 結果 | 備考 |
|----|------|---------|--------|------|------|
| 1 | PostgreSQLコンテナを停止 (docker-compose stop postgres) | - | - | - | エラー発生準備 |
| 2 | ブラウザで http://localhost:3000/playground/todo-app に移動 | エラー表示 | "Todoの取得に失敗しました。再試行してください。"が表示される | - | Browser |
| 3 | - | 再試行ボタン | "再試行"ボタンが表示される | - | - |
| 4 | PostgreSQLコンテナを起動 (docker-compose start postgres) | - | - | - | 復旧 |
| 5 | 再試行ボタンをクリック | データ取得成功 | Todo一覧が表示される | - | - |

**Playwright MCP使用手順**:
```
1. browser_navigate でエラー状態のページに移動
2. browser_snapshot でエラーメッセージを確認
3. browser_click で再試行ボタンをクリック
4. browser_snapshot で回復を確認
```

### 全体ステータス: - （未実施）

---

## 統合テスト結果サマリー

### Phase 2全体結果
- **全体ステータス**: - （未実施）
- **完了タスク**: 0/5
- **テスト合格率**: 0% (0/20)

### 修正が必要な項目
- （実施後に記載）

### 次フェーズへの引き継ぎ事項
- Phase 2完了後、playground環境でのTodoアプリ基本機能が完成
- 本番環境への展開やE2Eテストコード化を検討

### 改善提案
- （実施後に記載）

---

## 報告と対応

### 失敗原因分類
<!-- 該当する分類にチェック -->
- [ ] **A: 実装ミス** → task-executerへ差し戻し
- [ ] **B: 要件齟齬** → requirements.md修正 → task-executerへ差し戻し
- [ ] **C: 設計不備** → design.md修正 → task-executerへ差し戻し
- [ ] **D: 環境問題** → qa再実行

### task-executerへの差し戻し（該当する場合）
- （失敗時に記載）

### 修正優先度
- （失敗時に記載）

### 回避策（該当する場合）
- （失敗時に記載）
