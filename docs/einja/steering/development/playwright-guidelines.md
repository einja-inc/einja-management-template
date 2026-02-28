<!-- @einja:managed -->

# Playwright MCP 動作確認ガイドライン

## 概要

Playwright MCPを使用した動作確認（スクリーンショット、ログ、スナップショット等）で生成される一時ファイルの管理ルールを定義します。

## 一時ファイル保存先

### 必須ルール

- **保存先**: すべての一時ファイルは `tmp/playwright-mcp/` 配下に保存すること
- **リポジトリルート直下や他ディレクトリへの一時ファイル保存は禁止**
- ディレクトリが存在しない場合は事前に作成すること:
  ```bash
  mkdir -p tmp/playwright-mcp/
  ```

### `browser_take_screenshot` の使用例

```
mcp__playwright__browser_take_screenshot({ fullPage: true, path: "tmp/playwright-mcp/dashboard-check.png" })
```

**注意**: `path` パラメータには必ず `tmp/playwright-mcp/` プレフィックスを付けること。

### ファイル命名規約

- スクリーンショット: `tmp/playwright-mcp/{画面名}-{状態}.png`
  - 例: `tmp/playwright-mcp/dashboard-initial.png`
  - 例: `tmp/playwright-mcp/settings-after-update.png`
- コンソールログ: `tmp/playwright-mcp/console-{timestamp}.log`
- スナップショット: `tmp/playwright-mcp/{画面名}-snapshot.md`

### 例外

- **QAエビデンス用スクリーンショット**: `qa-tests/` 配下に保存（task-qaのルールに従う）
- QAエビデンスはGit管理対象のため、`tmp/` ではなく `qa-tests/` に配置する

## ブラウザリサイズ（必須）

Playwright MCPの操作を行う前に、必ずブラウザリサイズを実行すること:

```
mcp__playwright__browser_resize({ width: 1280, height: 720 })
```

**注意**: リサイズ未実施の場合、hookによって操作がブロックされます。

## Git管理

- `tmp/` ディレクトリは `.gitignore` で除外済み
- 一時ファイルはGitにコミットされない
- QAエビデンスが必要な場合は `qa-tests/` を使用すること

<!-- @einja:project-private:start id="playwright-guidelines-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
