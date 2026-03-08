---
name: einja-pencil-design-manager
description: "Pencil.dev（.penファイル）のデザインマスター管理Skill。design-master.penの初期化、ui-design.penからのマージ、共通コンポーネント同期、フレーム命名チェックを実行します。Pencil、.pen、デザインマスター、デザイン管理、design-master等のキーワードで自動選択されます。ARGUMENTS: コマンド名と引数（例: 'init-master web', 'merge-to-master web', 'sync-components web', 'frame-check web'）"
user-invocable: true
allowed-tools:
  - Task
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - mcp__pencil__batch_get
  - mcp__pencil__batch_design
  - mcp__pencil__get_screenshot
  - mcp__pencil__open_document
  - mcp__pencil__snapshot_layout
  - mcp__pencil__get_variables
  - mcp__pencil__find_empty_space_on_canvas
  - mcp__pencil__get_editor_state
---

# Pencilデザインマスター管理

## 前提条件

- **Pencil.devが起動している状態**でのみ動作します
- Pencil MCPサーバーが接続済みであること

## 規約の参照

実行前に必ず `docs/einja/steering/development/pencil-design-management.md` を読み込み、以下を確認すること:
- フレーム命名規則
- キャンバスレイアウト規約
- マージフロー手順

## パス解決

1. steering docの `@einja:project-private` セクションからアプリ名とパスの対応を読み取る
2. project-privateが空またはパース失敗時はデフォルトパス `docs/design/{app}/design-master.pen` にフォールバックする

## コマンド

### `init-master {app}`

指定アプリのdesign-master.penを初期化します。

**引数**:
- `{app}`: アプリ名（例: `web`, `admin`）

**処理**:
1. steering docからパスを解決
2. 親ディレクトリが存在しない場合は自動作成（`mkdir -p`）
3. Pencil MCPの `open_document` で新規.penファイルを作成
4. キャンバスレイアウト規約に従い、ComponentsゾーンとPagesゾーンのラベルフレームを配置
5. ファイルを指定パスに保存

**出力例**:
```
✅ design-master.pen を初期化しました
  パス: docs/design/web/design-master.pen
  レイアウト: Componentsゾーン（左） + Pagesゾーン（右）
```

### `merge-to-master {app} [{ui-design.pen path}]`

指定ui-design.penのフレームを該当アプリのdesign-master.penに統合します。

**引数**:
- `{app}`: 対象アプリ名（例: `web`）
- `[{ui-design.pen path}]`: （省略可）ui-design.penのパス。省略時はカレントディレクトリから自動検出（Issue仕様書ディレクトリのコンテキスト前提）

**処理**:
1. ui-design.penを `batch_get` で読み込み、フレーム一覧を取得
2. 各フレームの命名規則チェック（不適合なら警告）
3. design-master.penを `open_document` で開く
4. 既存フレームとの重複チェック
   - 同名フレームが存在する場合はユーザーに上書き確認
5. キャンバスレイアウト規約に従ってPagesゾーンに配置
6. 共通コンポーネントがあればComponentsゾーンに配置
7. `get_screenshot` でマージ結果を確認

**出力例**:
```
✅ ui-design.pen → design-master.pen マージ完了
  対象: docs/design/web/design-master.pen
  追加フレーム: dashboard, settings-profile, login
  上書きフレーム: なし
```

### `sync-components {app}`

該当アプリのdesign-master.penの共通コンポーネントを指定ui-design.penに一括更新します。

**⚠️ 破壊的操作**: 上書き対象のフレーム一覧を表示し、ユーザー確認を必須とします。

**引数**:
- `{app}`: 対象アプリ名

**処理**:
1. design-master.penのComponentsゾーンからコンポーネント一覧を取得
2. ui-design.penの既存コンポーネントとの差分を検出
3. **上書き対象の一覧をユーザーに表示し確認を求める**
4. 承認後、コンポーネントをui-design.penにコピー/更新
5. `get_screenshot` で結果を確認

### `frame-check [{app}]`

指定アプリ（省略時は全アプリ）の.penフレーム一覧と命名チェックを実行します。

**引数**:
- `[{app}]`: （省略可）対象アプリ名。省略時は全アプリをチェック

**処理**:
1. steering docからアプリ一覧を取得
2. 各design-master.penを `batch_get` で読み込み
3. フレーム一覧を出力
4. 命名規則チェック（violations を報告）

**出力例**:
```
📋 フレームチェック結果: web

Pagesゾーン:
  ✅ dashboard
  ✅ settings-profile
  ⚠️ UserProfile → 命名規則違反（kebab-caseを使用してください: user-profile）

Componentsゾーン:
  ✅ _components/button
  ✅ _components/card

命名規則違反: 1件
```

## エラーハンドリング

| エラー | 対応 |
|-------|------|
| Pencil MCPに接続できない | 「Pencil.devを起動してから再実行してください」と表示 |
| design-master.penが存在しない | `init-master` の実行を案内 |
| ui-design.penが見つからない | パスを明示的に指定するよう案内 |
| project-privateのパース失敗 | デフォルトパスにフォールバック、警告を表示 |
