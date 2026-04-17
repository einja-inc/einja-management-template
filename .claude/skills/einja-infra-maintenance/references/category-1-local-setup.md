# カテゴリ1: ローカル環境セットアップ

## サブメニュー
- **初回セットアップ**: `pnpm dev:setup` 実行
- **開発サーバー起動**: `pnpm dev:bg` 実行
- **サーバー停止**: `pnpm dev:stop` 実行
- **ログ確認**: `pnpm dev:logs` 実行

## 実行手順

### ゼロ状態判定
Phase 1の検出結果で `.env*` ファイルが**全て不在**の場合、「初回プロジェクトセットアップ」モードとして以下の順序で案内する:
1. 必須CLIツールの確認・インストール案内（Docker含む）
2. `pnpm install` → `pnpm dev:setup` の実行
3. 完了後、カテゴリ2（環境変数管理）への誘導

### 初回セットアップ
1. `pnpm install` で依存関係インストール
2. `pnpm dev:setup` で環境セットアップ
3. エラー時: エラー内容を分析し、対話的にトラブルシュート

### エラー時の対処

| エラー | 対処 |
|--------|------|
| `.env.keys`不在 | `git worktree list` でメインworktreeを検出し、`.env.keys` が存在すれば自動コピー。不在の場合は「チームメンバーから `.env.keys` ファイルを受け取り、プロジェクトルートに配置してください」と案内 |
| Docker未インストール | [OrbStack](https://orbstack.dev/) のインストールを案内。`brew install orbstack` または公式サイトからダウンロード |
| PostgreSQL接続エラー | `docker compose up -d postgres` → ヘルスチェック |
| Node.jsバージョン不一致 | `mise install` 提案（mise.tomlから自動読み取り） |
| pnpmバージョン不一致 | `mise install` 提案（mise.tomlから自動読み取り） |

## 参照ドキュメント
- `docs/einja/instructions/local-server-environment-and-worktree.md`
- `docs/einja/instructions/environment-setup.md`
