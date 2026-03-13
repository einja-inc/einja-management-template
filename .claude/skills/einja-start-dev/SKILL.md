---
name: einja-start-dev
description: "ローカル開発環境を起動します"
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

# ローカル開発環境起動コマンド

## コマンドの目的

開発サーバーを起動します。`pnpm dev` は自動的にWorktree環境を検出し、適切なポート・DB設定を行います。node_modulesが未インストールの場合は自動で `pnpm install` を実行します。

**並列対応**: 複数のClaude CodeやCodexセッションが並列で実行されている場合でも、ポート競合を自動解決します。

## Claude向け実行フロー

### Step 1: 前提チェック
```bash
# Dockerが起動しているか確認（PostgreSQLコンテナに必要）
docker info > /dev/null 2>&1 && echo "OK" || echo "Docker未起動"
```
- Docker未起動の場合: ユーザーに「Docker Desktopを起動してください」と伝えて待機

### Step 2: バックグラウンド起動
```bash
pnpm dev:bg
```
- node_modulesがない場合は自動で `pnpm install` が実行される
- 既存のサーバーが起動中の場合は自動停止→再起動される

### Step 3: 起動確認
```bash
# ステータス確認（URL情報も表示される）
pnpm dev:status

# ログの末尾を確認（エラーがないか）
tail -20 log/dev.log
```
- `dev:status` で「🟢 実行中」が表示されればOK
- ログに `Error` や `EADDRINUSE` が含まれていないことを確認

### Step 4: ユーザーへの報告
以下をユーザーに報告する:
- 各アプリのURL（dev:statusの出力から取得）
- ログ確認コマンド: `pnpm dev:logs`
- 停止コマンド: `pnpm dev:stop`

### Step 5: エラー時のリカバリ
起動に失敗した場合、以下の順で対応:

1. **ポート競合** (`EADDRINUSE`): `pnpm dev:stop` → `pnpm dev:bg` で再起動
2. **DB接続エラー**: Docker起動確認 → `pnpm dev:bg` で再起動
3. **依存関係エラー**: `pnpm install` → `pnpm dev:bg` で再起動
4. **上記で解決しない場合**: ユーザーに `einja-infra-maintenance` Skillの実行を提案する

## コマンド一覧

### 起動コマンド
```bash
pnpm dev        # フォアグラウンド起動（自動セットアップ）
pnpm dev:bg     # バックグラウンド起動（Claude/Codex推奨）
```

### 管理コマンド
```bash
pnpm dev:status  # ステータス・URL・ポート確認
pnpm dev:logs    # リアルタイムログ表示
pnpm dev:stop    # サーバー停止
```

### セットアップコマンド
```bash
pnpm dev:setup   # 初回環境セットアップ（.env作成、DB初期化）
```

## オプション

| オプション | 説明 |
|-----------|------|
| `--background`, `-b` | バックグラウンドで起動（ログはlog/dev.logに出力） |
| `--setup-only` | 環境セットアップのみ（サーバー起動なし） |
| `--skip-setup` | セットアップをスキップして直接turbo run dev |
| `--stop` | 実行中の開発サーバーを停止 |
| `--status` | 開発サーバーのステータス表示 |

## トラブルシューティング

### ポートが解放されない場合
```bash
pnpm dev:status        # ステータス確認
pnpm dev:stop          # サーバー停止
lsof -i :3000          # 特定ポートのプロセスを確認
```

### ログが見たい場合
```bash
pnpm dev:logs          # リアルタイムログ
tail -f log/dev.log    # 直接確認
```

<!-- @einja:project-private:start id="start-dev-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
