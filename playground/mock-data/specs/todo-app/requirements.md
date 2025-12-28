# TODOアプリ 要件定義

## ユーザーストーリー

**As a** playground学習者
**I want to** TODOアイテムを追加・表示できる
**So that** API + Component + State管理の基本を理解できる

## 受け入れ条件

### AC1.1: TODO追加API実装
- 前提: `/api/todos` エンドポイントが未実装
- 操作: POST `/api/todos` with `{ text: string }`
- 期待結果:
  - ステータス200、id付きのTODOオブジェクトを返す
  - `playground/data/todos.json` にデータ保存される
- 検証レベル: Unit

### AC1.2: TODO一覧取得API実装
- 前提: todos.jsonにデータが存在
- 操作: GET `/api/todos`
- 期待結果:
  - ステータス200、TODO配列を返す
  - JSONファイルから正しくデータ読み込み
- 検証レベル: Integration

### AC1.3: TODO一覧表示コンポーネント
- 前提: API実装済み
- 操作: `/todos` ページにアクセス
- 期待結果:
  - TODO一覧が表示される
  - 追加フォームが表示される
  - フォーム送信でTODO追加、画面更新
- 検証レベル: E2E

## 非機能要件
- APIレスポンス時間: 500ms以内
- ファイルサイズ上限: 1MB
- エラーハンドリング: JSON parse失敗時の適切なエラー応答
