# Troubleshooting Guide

## 一般的な問題と解決方法

### 環境セットアップ関連

#### 問題: pnpm installが失敗する

**症状**:
```
ERR_PNPM_LOCKFILE_VERSION_NOT_COMPATIBLE
```

**解決方法**:
```bash
# pnpmをアップデート
npm install -g pnpm@latest

# ロックファイル削除して再インストール
rm pnpm-lock.yaml
pnpm install
```

#### 問題: Prismaクライアントが生成されない

**症状**:
```
Cannot find module '@prisma/client'
```

**解決方法**:
```bash
cd playground
pnpm db:generate
```

#### 問題: DATABASE_URL接続エラー

**症状**:
```
Can't reach database server
```

**解決方法**:
```bash
# PostgreSQL起動確認
docker-compose ps

# 起動していない場合
docker-compose up -d postgres

# .env.playgroundのDATABASE_URL確認
cat playground/.env.playground
```

### タスク実行関連

#### 問題: task-starterがタスクを選定しない

**症状**: タスクが選定されず、「実行可能なタスクがありません」と表示される

**解決方法**:
1. Issue形式を確認
   ```bash
   # サンプルと比較
   diff <GitHub Issue内容> playground/00-quick-start/sample-issue.md
   ```

2. 依存関係を確認
   - 依存タスクが完了しているか
   - Phaseが正しく設定されているか

3. チェックボックス形式を確認
   ```markdown
   - [ ] **1.1 タスク名**  # ✅ 正しい
   - [x] **1.1 タスク名**  # ❌ 完了済み扱い
   ```

#### 問題: task-executerの実装が失敗する

**症状**: 実装が不完全、またはビルドエラー

**解決方法**:
1. requirements.mdとdesign.mdが存在するか確認
2. エラーログを確認
   ```bash
   # ビルドエラー確認
   cd playground
   pnpm build
   ```

3. 型エラーを確認
   ```bash
   pnpm typecheck
   ```

#### 問題: task-qaが失敗し続ける

**症状**: QAが常にFAILUREを返す

**解決方法**:
1. 必須自動テストを手動実行
   ```bash
   cd playground
   pnpm test        # ユニットテスト
   pnpm lint        # Lintチェック
   pnpm build       # ビルドチェック
   pnpm typecheck   # 型チェック
   ```

2. qa-tests/phase{N}/{X-Y}.mdを確認
   - 失敗原因分類（A/B/C/D）を確認
   - エラーメッセージを読む

3. 受け入れ条件（AC）を確認
   - requirements.md内のAC定義を確認
   - Integration/E2E ACのみが対象

### MCP関連

#### 問題: MCPサーバーに接続できない

**症状**: エージェントがMCP機能を使用できない

**解決方法**:
```bash
# MCP設定確認
cat .claude/settings.json

# enableAllProjectMcpServersがtrueか確認
cat .cursor/mcp.json
```

#### 問題: Playwright MCPが動作しない

**症状**: E2Eテストが実行されない

**解決方法**:
```bash
# Playwrightインストール
npx playwright install chromium

# ブラウザ起動確認
npx playwright test --debug
```

### ビルド関連

#### 問題: Next.jsビルドが失敗する

**症状**: `pnpm build`でエラー

**解決方法**:
```bash
# .nextディレクトリを削除
cd playground/apps/sample-app
rm -rf .next

# 再ビルド
pnpm build
```

#### 問題: Turboキャッシュエラー

**症状**: Turboタスクがキャッシュエラーで失敗

**解決方法**:
```bash
# Turboキャッシュクリア
cd playground
rm -rf .turbo
pnpm build
```

## デバッグツール

### 診断スクリプト実行

```bash
# 総合診断
bash playground/tools/diagnose.sh

# Quick Start環境確認
cd playground/00-quick-start
./verify.sh
```

### Issue形式検証

```bash
# Issue形式検証（今後実装予定）
bash playground/tools/validate-issue.sh <issue-file.md>
```

### 仕様書形式検証

```bash
# 仕様書形式検証（今後実装予定）
bash playground/tools/validate-spec.sh <spec-dir>
```

## ログ確認

### Playgroundログ

```bash
# ログファイル確認
cat playground/logs/playground.log

# リアルタイムログ監視
tail -f playground/logs/playground.log
```

### Turboログ

```bash
# Turboタスクログ
cd playground
pnpm build --verbose
```

## サポート

### ドキュメント

- [アーキテクチャ解説](./architecture.md)
- [エージェントフロー図解](./agent-flow.md)
- メインリポジトリ: `/docs/`

### Issue報告

問題が解決しない場合は、GitHubでIssueを作成してください：
- 環境情報（Node.js、pnpm、OS）
- エラーメッセージ
- 再現手順
