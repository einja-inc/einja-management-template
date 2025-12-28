---
description: "ローカル開発環境を起動します"
allowed-tools: Bash
---

# ローカル開発環境起動コマンド

## コマンドの目的

環境を自動判定してセットアップ + 開発サーバー起動を実行します。

## 実行手順

### 環境判定とセットアップ + 起動

```bash
# Worktree環境かどうかを判定
if [ -d ".git/worktrees" ]; then
  echo "🌳 Worktree環境を検出しました"
  pnpm setup:worktree && pnpm dev
else
  echo "💻 ローカル環境を起動します"
  pnpm setup:local && pnpm dev
fi
```

## 注意事項

- 初回実行時は、セットアップに3-5分かかります
- 2回目以降は`pnpm dev`のみで起動できます（セットアップ不要）

## ターミナルから直接実行する場合

### ローカル環境
```bash
pnpm setup:local  # 初回のみ
pnpm dev
```

### Worktree環境
```bash
pnpm dev:worktree  # 全自動（セットアップ + 起動）
```
