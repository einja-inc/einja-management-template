# 推奨 MCP サーバー一覧（claude.ai 連携）

claude.ai の Settings > MCP Servers から追加できる公式 MCP サーバーの一覧です。
プロジェクトで活用することで、Claude Code から外部サービスへの直接アクセスが可能になります。

---

## 導入手順

### 1. claude.ai でコネクタを追加する

1. [claude.ai](https://claude.ai) をブラウザで開く
2. サイドナビゲーションの **カスタマイズボタン** > **コネクタ** を開く
   - 直接 URL: https://claude.ai/customize/connectors でもOK
3. **＋ボタン** からコネクタを追加する

#### 標準コネクタ（Figma / Notion / Asana）

- ＋ボタンをクリックすると標準コネクタ一覧が表示される
- 利用したいサービスを選択し、OAuth 認証でアカウント連携を許可する

#### カスタムコネクタ（Draw.io）

- ＋ボタンから **カスタムコネクタ** を選択
- 以下の URL を入力して追加する:
  ```
  https://mcp.draw.io/mcp
  ```

### 2. Claude Code（CLI）で利用する

claude.ai で連携した MCP サーバーは、同じ Anthropic アカウントの Claude Code CLI でも自動的に利用可能になります。

```bash
# Claude Code を再起動（既に起動中の場合）
# MCP ツールが認識されているか確認
claude /mcp
```

> **Note**: 初回利用時にツールの実行許可を求められます。信頼できるツールは `Allow` で許可してください。

### 3. トラブルシューティング

| 症状 | 対処法 |
|------|--------|
| MCP ツールが表示されない | Claude Code を再起動する |
| 認証エラーが出る | claude.ai の Integrations で再連携する |
| ツール実行がタイムアウトする | ネットワーク接続を確認し、再試行する |

---

## 推奨 MCP サーバー

### Figma

| 項目 | 内容 |
|------|------|
| 用途 | デザインファイルの読み取り、FigJam ダイアグラム作成、Code Connect マッピング |
| 主な機能 | デザインコンテキスト取得、スクリーンショット取得、メタデータ取得、FigJam 操作 |
| 活用シーン | デザインからコード実装、Figma URL からのコンポーネント生成 |

**主要ツール:**
- `get_design_context` — Figma ノードからコード・スクリーンショット・コンテキストヒントを取得
- `get_screenshot` — デザインのスクリーンショットを取得
- `get_metadata` — ファイルのメタデータを取得
- `generate_diagram` — FigJam にダイアグラムを作成

---

### Notion

| 項目 | 内容 |
|------|------|
| 用途 | Notion ページ・データベースの読み書き |
| 主な機能 | ページ検索・作成・更新、データベース作成、コメント管理 |
| 活用シーン | 仕様書の参照・更新、議事録の作成、ナレッジベースの検索 |

**主要ツール:**
- `notion-search` — Notion 内のページ・データベースを検索
- `notion-fetch` — ページの内容を取得
- `notion-create-pages` — 新しいページを作成
- `notion-update-page` — ページのプロパティを更新
- `notion-create-database` — データベースを作成
- `notion-create-comment` — コメントを追加

---

### Asana

| 項目 | 内容 |
|------|------|
| 用途 | プロジェクト管理・タスク管理 |
| 主な機能 | タスクの検索・作成・更新、プロジェクト管理、ポートフォリオ参照 |
| 活用シーン | Issue からタスク作成、進捗確認、タスクのステータス更新 |

**主要ツール:**
- `search_tasks_preview` / `search_objects` — タスク・オブジェクトの検索
- `create_task_preview` / `create_task_confirm` — タスクの作成
- `update_task` — タスクの更新
- `get_project` / `get_projects` — プロジェクト情報の取得
- `get_portfolios` — ポートフォリオの取得

---

### Draw.io

| 項目 | 内容 |
|------|------|
| 用途 | ダイアグラム・図表の作成 |
| 主な機能 | `.drawio` ファイルの生成（フローチャート、ER 図、アーキテクチャ図など） |
| 活用シーン | システム構成図、画面遷移図、業務フロー図の作成 |

**主要ツール:**
- `create_diagram` — Draw.io 形式のダイアグラムを生成

---

## セットアップの優先度

| 優先度 | MCP サーバー | 理由 |
|--------|-------------|------|
| **必須** | Figma | デザイン→コード変換ワークフローの基盤 |
| **必須** | Draw.io | 図表作成が必要な場合 |
| **必須** | Asana | タスク管理に使用する場合 |
| **推奨** | Notion | 仕様書・ドキュメント管理に使用する場合 |
