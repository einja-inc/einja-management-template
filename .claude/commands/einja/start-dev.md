---
description: "ローカル開発環境を起動します"
allowed-tools: Bash
---

# ローカル開発環境起動コマンド

## コマンドの目的

開発サーバーを起動します。`pnpm dev` は自動的にWorktree環境を検出し、適切なポート・DB設定を行います。

**新機能**: 複数のClaude CodeやCodexセッションが並列で実行されている場合でも、ポート競合を自動解決します。

## 実行手順

### 通常起動（フォアグラウンド）
```bash
# 開発サーバー起動（Worktree対応・自動セットアップ）
# 同じポートを使用しているプロセスがあれば自動終了してから起動
pnpm dev
```

### バックグラウンド起動（推奨：並列セッション時）
```bash
# バックグラウンドで起動（ログは log/dev.log に出力）
pnpm dev:bg
```

## 管理コマンド

```bash
# 開発サーバーの状態確認
pnpm dev:status

# ログをリアルタイムで確認
pnpm dev:logs

# 開発サーバーを停止
pnpm dev:stop
```

## オプション

| オプション | 説明 |
|-----------|------|
| `--background`, `-b` | バックグラウンドで起動（ログはlog/dev.logに出力） |
| `--no-kill` | 既存プロセスを終了せずにポート競合時はエラー |
| `--setup-only` | 環境セットアップのみ（サーバー起動なし） |
| `--stop` | 実行中の開発サーバーを停止 |
| `--status` | 開発サーバーのステータス表示 |

## 注意事項

- 初回実行時は `pnpm dev:setup` で環境セットアップが必要です
- `pnpm dev` はWorktree環境を自動検出してポート・DB名を調整します
- **並列実行時**: 同じポートを使用しているプロセスは自動的に終了されます
- ログファイルは `log/dev.log` に出力されます

## ターミナルから直接実行する場合

### 初回セットアップ
```bash
pnpm dev:setup  # .env作成、DB起動・初期化
```

### 開発サーバー起動
```bash
pnpm dev     # フォアグラウンド（全自動・Worktree対応）
pnpm dev:bg  # バックグラウンド（Claude Code/Codex並列実行時推奨）
```

### セットアップのみ（開発サーバーは手動起動）
```bash
pnpm env:prepare
```

## トラブルシューティング

### ポートが解放されない場合
```bash
# ステータス確認
pnpm dev:status

# 強制終了
pnpm dev:stop

# 特定ポートのプロセスを確認
lsof -i :3000
```

### ログが見たい場合
```bash
# リアルタイムログ
pnpm dev:logs

# または直接
tail -f log/dev.log
```
