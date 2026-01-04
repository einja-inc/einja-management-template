# Todoアプリ基本機能 要件定義書

## 概要
playground環境でのTodoアプリ基本機能（CRUD操作）を実装し、`pnpm task:loop`コマンドの検証用仮想タスクとして活用します。シンプルなTodo管理機能を通じて、タスク間の依存関係、段階的な開発フロー、継続的な検証プロセスを実証します。

## AS-IS（現状）

### 現在の実装状況
- playground/todo-app ディレクトリは空の状態
- 検証用のタスク管理システムが存在しない
- 管理Issue #32、検証用Issue #33が作成済み
- 6タスク・3Phaseの構成で依存関係の検証を行う計画

### 現状の課題
- `pnpm task:loop`コマンドの実践的な検証環境がない
- タスク間の依存関係を実際のコードで検証できない
- 段階的な開発フローの有効性を実証できない
- 継続的な検証プロセスの実効性を確認できない

## TO-BE（目標状態）

### 実現したい姿
- 基本的なCRUD操作を持つTodoアプリの実装
- Prismaによるデータモデル定義とマイグレーション
- Next.js App Routerを使用したAPI実装
- Reactコンポーネントによる直感的なUI
- Vitestによる自動テスト

### 期待される改善
- `pnpm task:loop`コマンドの実践的な検証が可能
- タスク依存関係の管理手法が確立
- 段階的な開発フローの実証
- 継続的な検証プロセスの有効性確認

## ビジネス価値
- **問題**: `pnpm task:loop`コマンドの実践的な検証環境が不足
- **解決策**: シンプルなTodoアプリを通じて、タスク管理システムの有効性を実証
- **期待効果**: タスク依存関係の管理手法確立、開発フローの最適化

## スコープ
### 含まれるもの
- Todoデータモデルの定義（Prisma）
- CRUD APIエンドポイントの実装
- Todo一覧・作成・更新・削除のUIコンポーネント
- Vitestでのユニットテスト
- API統合テスト

### 含まれないもの
- ユーザー認証・認可機能
- Todoのカテゴリ分類・タグ付け
- 期限・リマインダー機能
- 複数ユーザー間でのTodo共有
- E2Eテスト（Playwrightコード）

## ユーザーストーリー

### Story 1: Todoデータモデルの定義
**As a** 開発者
**I want to** Todoエンティティのデータ構造を定義したい
**So that** データベースでTodo情報を永続化できる

#### 受け入れ基準
- [ ] **AC1.1**: Todoデータモデル定義
  - Given: Prismaスキーマファイル（schema.prisma）が存在する
  - When: Todoモデルを定義する
  - Then: id（String, CUID）、title（String, 必須）、completed（Boolean, デフォルトfalse）、createdAt（DateTime, 自動設定）、updatedAt（DateTime, 自動更新）のフィールドが含まれる
  - 検証レベル: Unit（スキーマバリデーション）

- [ ] **AC1.2**: マイグレーション実行
  - Given: Todoモデルが定義されている
  - When: `pnpm db:push`を実行する
  - Then: データベースにtodoテーブルが作成され、全フィールドが正しく定義される
  - 検証レベル: Integration（実際のDB接続）

- [ ] **AC1.3**: Prismaクライアント生成
  - Given: Todoモデルが定義されている
  - When: `pnpm db:generate`を実行する
  - Then: TypeScript型定義が生成され、prisma.todoオブジェクトが利用可能になる
  - 検証レベル: Unit（型チェック）

#### 実装の優先順位
P0 (必須)

---

### Story 2: Todo一覧取得API実装
**As a** フロントエンド開発者
**I want to** Todo一覧を取得するAPIを呼び出したい
**So that** UI上にTodoリストを表示できる

#### 受け入れ基準
- [ ] **AC2.1**: GET /api/todos エンドポイント実装
  - Given: データベースにTodoレコードが存在する
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス200とTodo配列のJSON（id, title, completed, createdAt, updatedAt）が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC2.2**: 空のTodoリスト取得
  - Given: データベースにTodoレコードが存在しない
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス200と空配列[]が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC2.3**: エラーハンドリング
  - Given: データベース接続エラーが発生
  - When: GET /api/todosにリクエストを送信する
  - Then: HTTPステータス500とエラーメッセージ{"error": "Internal Server Error"}が返る
  - 検証レベル: Integration（エラーケース）

#### 実装の優先順位
P0 (必須)

---

### Story 3: Todo新規作成API実装
**As a** ユーザー
**I want to** 新しいTodoを作成したい
**So that** やるべきタスクを記録できる

#### 受け入れ基準
- [ ] **AC3.1**: POST /api/todos エンドポイント実装
  - Given: 有効なTodoデータ（title: "買い物に行く"）を送信
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス201と作成されたTodoオブジェクト（id, title, completed: false, createdAt, updatedAt）が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC3.2**: バリデーション - 必須フィールド
  - Given: titleが空文字または未指定
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Title is required"}が返る
  - 検証レベル: Unit（バリデーション）

- [ ] **AC3.3**: バリデーション - 文字数制限
  - Given: titleが255文字を超える
  - When: POST /api/todosにリクエストを送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Title must be 255 characters or less"}が返る
  - 検証レベル: Unit（バリデーション）

- [ ] **AC3.4**: データベース永続化確認
  - Given: 有効なTodoデータを送信
  - When: POST /api/todosにリクエストを送信し、その後GET /api/todosで一覧取得
  - Then: 作成したTodoが一覧に含まれる
  - 検証レベル: Integration（API + DB）

#### 実装の優先順位
P0 (必須)

---

### Story 4: Todo更新API実装
**As a** ユーザー
**I want to** Todoの完了状態を切り替えたい
**So that** 完了したタスクを管理できる

#### 受け入れ基準
- [ ] **AC4.1**: PUT /api/todos/:id エンドポイント実装（完了状態切り替え）
  - Given: 未完了のTodo（id: "abc123", completed: false）が存在
  - When: PUT /api/todos/abc123 に{"completed": true}を送信する
  - Then: HTTPステータス200と更新されたTodoオブジェクト（completed: true, updatedAt更新済み）が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC4.2**: タイトル更新
  - Given: Todo（id: "abc123", title: "旧タイトル"）が存在
  - When: PUT /api/todos/abc123 に{"title": "新タイトル"}を送信する
  - Then: HTTPステータス200と更新されたTodoオブジェクト（title: "新タイトル", updatedAt更新済み）が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC4.3**: 存在しないTodoの更新
  - Given: 存在しないTodo ID（"nonexistent"）を指定
  - When: PUT /api/todos/nonexistentにリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（エラーケース）

- [ ] **AC4.4**: バリデーション - 無効なデータ
  - Given: 有効なTodo IDを指定
  - When: PUT /api/todos/:id に無効なデータ（例: completed: "invalid"）を送信する
  - Then: HTTPステータス400とエラーメッセージ{"error": "Invalid data"}が返る
  - 検証レベル: Unit（バリデーション）

#### 実装の優先順位
P0 (必須)

---

### Story 5: Todo削除API実装
**As a** ユーザー
**I want to** 不要なTodoを削除したい
**So that** リストを整理できる

#### 受け入れ基準
- [ ] **AC5.1**: DELETE /api/todos/:id エンドポイント実装
  - Given: Todo（id: "abc123"）が存在
  - When: DELETE /api/todos/abc123にリクエストを送信する
  - Then: HTTPステータス204（No Content）が返り、レスポンスボディは空
  - 検証レベル: Integration（API + DB）

- [ ] **AC5.2**: 削除確認
  - Given: Todo（id: "abc123"）を削除済み
  - When: GET /api/todos/abc123にリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（API + DB）

- [ ] **AC5.3**: 存在しないTodoの削除
  - Given: 存在しないTodo ID（"nonexistent"）を指定
  - When: DELETE /api/todos/nonexistentにリクエストを送信する
  - Then: HTTPステータス404とエラーメッセージ{"error": "Todo not found"}が返る
  - 検証レベル: Integration（エラーケース）

#### 実装の優先順位
P0 (必須)

---

### Story 6: TodoリストUIコンポーネント実装
**As a** ユーザー
**I want to** ブラウザでTodoリストを閲覧・操作したい
**So that** 直感的にタスクを管理できる

#### 受け入れ基準
- [ ] **AC6.1**: TodoList コンポーネント実装
  - Given: playground/todo-app/page.tsxが実装されている
  - When: ブラウザでページにアクセスする
  - Then: Todo一覧が表示され、各Todoにタイトル、チェックボックス、削除ボタンが含まれる
  - 検証レベル: Browser（Playwright MCP）

- [ ] **AC6.2**: TodoForm コンポーネント実装
  - Given: TodoListページを表示
  - When: フォームに新しいTodoタイトルを入力し送信ボタンをクリックする
  - Then: 新しいTodoが一覧に追加される
  - 検証レベル: Browser（Playwright MCP）

- [ ] **AC6.3**: 完了状態の切り替え
  - Given: 未完了のTodoが表示されている
  - When: チェックボックスをクリックする
  - Then: Todoが完了状態になり、視覚的に区別される（例: 取り消し線、グレーアウト）
  - 検証レベル: Browser（Playwright MCP）

- [ ] **AC6.4**: Todo削除操作
  - Given: Todoが一覧に表示されている
  - When: 削除ボタンをクリックする
  - Then: 確認ダイアログが表示され、OKを押すとTodoが一覧から消える
  - 検証レベル: Browser（Playwright MCP）

- [ ] **AC6.5**: ローディング状態表示
  - Given: API呼び出し中
  - When: データ取得・更新・削除処理が実行中
  - Then: ローディングインジケーター（スピナーまたはスケルトン）が表示される
  - 検証レベル: Browser（Playwright MCP）

- [ ] **AC6.6**: エラー表示
  - Given: API呼び出しが失敗
  - When: ネットワークエラーまたはサーバーエラーが発生
  - Then: ユーザーフレンドリーなエラーメッセージが表示され、リトライ可能な操作が提示される
  - 検証レベル: Browser（Playwright MCP）

#### 実装の優先順位
P0 (必須)

---

## 詳細なビジネス要件

### データモデル要件
#### Todoエンティティ仕様
**要件内容**:
- **id**: String型、CUID形式の一意識別子
- **title**: String型、必須、1〜255文字
- **completed**: Boolean型、デフォルトfalse
- **createdAt**: DateTime型、レコード作成時に自動設定
- **updatedAt**: DateTime型、レコード更新時に自動更新

**OK例**:
- `{ title: "買い物に行く", completed: false }` - 必須フィールドのみ指定
- `{ title: "レポート提出", completed: true }` - 完了済みTodo
- `{ title: "プロジェクトミーティング準備（資料作成、アジェンダ確認）", completed: false }` - 詳細なタイトル（255文字以内）

**NG例**:
- `{ completed: false }` - titleが未指定
- `{ title: "", completed: false }` - titleが空文字
- `{ title: "a".repeat(256), completed: false }` - titleが256文字以上

### API仕様要件
#### RESTful API設計
**要件内容**:
- **GET /api/todos**: Todo一覧取得
  - レスポンス: `200 OK`, `[{id, title, completed, createdAt, updatedAt}, ...]`
- **POST /api/todos**: Todo新規作成
  - リクエスト: `{title: string, completed?: boolean}`
  - レスポンス: `201 Created`, `{id, title, completed, createdAt, updatedAt}`
- **PUT /api/todos/:id**: Todo更新
  - リクエスト: `{title?: string, completed?: boolean}`
  - レスポンス: `200 OK`, `{id, title, completed, createdAt, updatedAt}`
- **DELETE /api/todos/:id**: Todo削除
  - レスポンス: `204 No Content`, ボディなし

**エラーレスポンス仕様**:
- `400 Bad Request`: `{"error": "エラーメッセージ"}`
- `404 Not Found`: `{"error": "Todo not found"}`
- `500 Internal Server Error`: `{"error": "Internal Server Error"}`

### バリデーション要件
#### 入力検証ルール
**要件内容**:
- **title フィールド**:
  - 必須チェック: 空文字・null・undefinedは不可
  - 文字数制限: 1〜255文字
  - 型チェック: String型のみ許可
- **completed フィールド**:
  - 型チェック: Boolean型のみ許可（true/false）
  - デフォルト値: 指定なしの場合false

**バリデーションエラーメッセージ**:
- title未指定: `"Title is required"`
- title空文字: `"Title cannot be empty"`
- title長すぎ: `"Title must be 255 characters or less"`
- completed型不正: `"Completed must be a boolean"`

### UIコンポーネント要件
#### TodoListコンポーネント仕様
**要件内容**:
- **表示要素**:
  - Todoアイテムリスト（未完了を上、完了済みを下に表示）
  - 各Todoアイテムにはチェックボックスとタイトルテキスト、削除ボタンを含む
  - 完了済みTodoは取り消し線とグレー表示
- **新規作成フォーム**:
  - テキスト入力欄（placeholder: "新しいTodoを入力"）
  - 送信ボタン（ラベル: "追加"）
- **状態管理**:
  - useState/useEffectでTodoリストを管理
  - API呼び出し中はローディング状態を表示
  - エラー発生時はエラーメッセージを表示

#### TodoItemコンポーネント仕様
**要件内容**:
- **Props**:
  - `todo: { id: string; title: string; completed: boolean }`
  - `onToggle: (id: string) => void`
  - `onDelete: (id: string) => void`
- **表示ロジック**:
  - completedがtrueの場合、タイトルに取り消し線とグレー表示
  - チェックボックスはcompletedの値と連動
- **アクセシビリティ**:
  - チェックボックスとラベルの適切な紐付け
  - 削除ボタンにaria-labelを設定

## 非機能要件

### パフォーマンス
- API応答時間: 平均100ms以内（データベース接続含む）
- Todo一覧表示: 初回レンダリング500ms以内
- Todo作成・更新・削除操作: 1秒以内にUI更新完了

### セキュリティ
- 入力値のサニタイゼーション（XSS対策）
- SQLインジェクション対策（Prismaの自動エスケープ活用）
- CSRF対策（Next.jsのデフォルト機能活用）

### 可用性
- playground環境での開発用途のため、99%以上のアップタイムは不要
- データベース接続エラー時の適切なエラーハンドリング

### アクセシビリティ
- セマンティックHTML（ul/li、button要素の適切な使用）
- キーボード操作対応（Tab、Enter、Spaceキーでの操作）
- スクリーンリーダー対応（aria-label、role属性の設定）

## 技術的制約
- Next.js App Router（playground環境）を使用
- Prismaによるデータベースアクセス
- PostgreSQLデータベース（docker-composeで起動）
- Vitestによるテスト実装
- TypeScriptでの型安全な実装

## 依存関係
- **外部依存**:
  - PostgreSQLコンテナ（docker-compose）
  - Prisma Client
  - Next.js API Routes
- **パッケージ依存**:
  - @einja/database（Prismaスキーマとクライアント）
  - React（UIコンポーネント）
  - Vitest（テスト）

## リスクと対策
| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| データベース接続エラー | 中 | 低 | エラーハンドリングとリトライ機能実装 |
| バリデーション漏れ | 中 | 中 | Zodなどのスキーマバリデーションライブラリ活用 |
| API呼び出しの競合状態 | 低 | 低 | 楽観的UIとエラーハンドリングで対処 |

## 成功指標
- 全てのCRUD操作が正常に動作する（受け入れ基準100%クリア）
- Vitestのテストカバレッジ80%以上
- `pnpm task:loop`コマンドの検証が完了
- 6タスク・3Phaseの依存関係が正しく機能

## タイムライン
- **Phase 1: データ層実装**（Story 1）
  - Prismaスキーマ定義
  - マイグレーション実行
  - Prismaクライアント生成
- **Phase 2: API層実装**（Story 2, 3, 4, 5）
  - Todo一覧取得API
  - Todo新規作成API
  - Todo更新API
  - Todo削除API
- **Phase 3: UI層実装**（Story 6）
  - TodoListコンポーネント
  - TodoFormコンポーネント
  - TodoItemコンポーネント
  - API統合とエラーハンドリング
