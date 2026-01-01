# クイックリファレンス

コピペで使えるコマンド早見表とよくある質問集です。

---

## コマンド早見表

### 基本コマンド

| やりたいこと | コマンド |
|-------------|---------|
| 仕様書を作成 | `/spec-create "機能の説明"` |
| タスクを実行（1つ） | `/task-exec #123` |
| 特定タスクを指定して実行 | `/task-exec #123 1.1` |
| 複数タスクを自動消化 | `/task-vibe-kanban-loop #123` |
| 開発環境を起動 | `/start-dev` |
| フロントエンド実装 | `/frontend-implement "機能名"` |

### 確認コマンド（ターミナル）

```bash
# Issue内容を確認
gh issue view 123

# Issueのタスク一覧を確認
gh issue view 123 --comments

# Vibe-Kanban UIを起動
npx vibe-kanban

# 現在のブランチを確認
git branch --show-current
```

---

## よくある質問（FAQ）

### Q1: タスクが選定されない

**症状**: `/task-exec`を実行しても「実行可能なタスクがありません」と表示される

**原因**: 依存タスクが未完了

**対処法**:

1. GitHub Issueで依存関係を確認
   ```bash
   gh issue view 123
   ```

2. タスク一覧で「**依存関係**:」の記載を確認
   ```markdown
   - [ ] **1.2 メール送信機能**
     - **依存関係**: 1.1  ← これが完了していないと実行できない
   ```

3. 先行タスクを先に完了させる
   ```bash
   /task-exec #123 1.1
   ```

---

### Q2: Vibe-Kanbanの起動・設定方法

**起動方法**:

```bash
npx vibe-kanban
```

ブラウザが自動で開き、UIが表示されます。

**プロジェクトIDの確認**:

```
mcp__vibe_kanban__list_projects
```

**MCP設定（既に設定済み）**:

`.claude/settings.json` に以下が設定されています：

```json
{
  "mcpServers": {
    "vibe_kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban-mcp"]
    }
  }
}
```

**注意**: `npx vibe-kanban`（UI）と `vibe-kanban-mcp`（MCP）は別パッケージです。

---

### Q3: 品質ループが無限に回る

**症状**: `/task-exec`でレビュー→実装→レビュー...のループが終わらない

**原因**:
- テストが常に失敗している
- レビューで検出される問題が解消されない
- 仮実装（TODO/FIXME）が残っている

**対処法**:

1. **エラーログを確認**
   - task-reviewerの出力で「MAJOR」の指摘を確認
   - task-qaの出力でテスト失敗理由を確認

2. **手動で修正**
   ```bash
   # ループを中断（Ctrl+C）
   # 問題箇所を手動で修正
   # 再実行
   /task-exec #123
   ```

3. **仮実装を検索**
   ```bash
   grep -r "TODO\|FIXME\|throw new Error" src/
   ```

4. **テストを個別実行**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

---

### Q4: 複数Issueを同時進行したい

**方法**: 別ブランチで別ターミナルから実行

**手順**:

1. **ターミナル1**: Issue #123を実行
   ```bash
   git checkout -b feature/issue-123
   /task-exec #123
   ```

2. **ターミナル2**: Issue #124を実行（別ディレクトリで）
   ```bash
   # 別のworktreeを作成
   git worktree add ../project-issue-124 -b feature/issue-124
   cd ../project-issue-124
   /task-exec #124
   ```

**重要な注意**:

- 同一Issueの同時実行は**禁止**
- 同じファイルを変更する可能性がある場合は避ける
- Vibe-Kanbanで状態を確認してから実行

---

## トラブルシューティング

### 開発サーバーが起動しない

```bash
# 依存関係を再インストール
pnpm install

# Prismaクライアントを再生成
pnpm db:generate

# キャッシュをクリア
rm -rf node_modules/.cache
```

### MCPサーバーに接続できない

```bash
# MCP設定を確認
cat .claude/settings.json

# Vibe-Kanbanが起動しているか確認
npx vibe-kanban
```

### GitHub認証エラー

```bash
# gh CLIの認証状態を確認
gh auth status

# 再認証
gh auth login
```

---

## 状態アイコン一覧

| アイコン | 意味 |
|---------|------|
| `[ ]` | 未着手 |
| `[x]` | 完了 |
| `<!-- 🔄 着手中 -->` | 現在実行中 |
| `PASS` | レビュー/QA合格 |
| `MAJOR` | 重大な問題あり（要修正） |
| `MINOR` | 軽微な問題（後続で対応可） |

---

## 関連ドキュメント

- [コマンド利用ガイド](./README.md) - コマンドの詳細説明
- [タスク実行ワークフロー](../instructions/task-execute.md) - task-execの仕様
- [Vibe-Kanbanガイド](../instructions/task-vibe-kanban-loop.md) - 自動連続実行の仕様
