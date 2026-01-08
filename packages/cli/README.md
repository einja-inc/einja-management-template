# @einja/cli

Claude Code用の`.claude`設定ディレクトリをnpxでインストールできるCLI。

## クイックスタート

```bash
npx @einja/cli init
```

## インストール

```bash
# npx（推奨）
npx @einja/cli init

# グローバルインストール
npm install -g @einja/cli
einja-claude init
```

## コマンド

### `init`

`.claude`ディレクトリをセットアップします。

```bash
npx @einja/cli init
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `-f, --force` | 上書き確認をスキップ |
| `--dry-run` | 実行内容をプレビュー |
| `--no-backup` | バックアップを作成しない |

### `sync`

テンプレートから更新を同期します。

```bash
# 全カテゴリを同期
npx @einja/cli sync

# 特定カテゴリのみ同期
npx @einja/cli sync --only commands,agents
npx @einja/cli sync --only hooks
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `-o, --only <categories>` | 同期するカテゴリをカンマ区切りで指定 |
| `-d, --dry-run` | 実際の変更を行わず、差分のみ表示 |
| `-f, --force` | ローカル変更を無視してテンプレートで上書き |
| `-y, --yes` | 確認プロンプトをスキップ |
| `--no-backup` | 変更前にバックアップを作成しない |

**同期可能なカテゴリ:**
- `commands` - Claude Code コマンド
- `agents` - エージェント定義
- `skills` - スキル定義
- `hooks` - Git Hooks
- `docs` - ステアリングドキュメント

## 配布内容

Einja ATDDワークフロー構成（Next.js、Vibe-Kanban統合）を配布します。

```
.claude/
├── settings.json
├── agents/
│   ├── specs/           # 仕様書生成 (3)
│   ├── task/            # タスク実行 (6)
│   └── einja/frontend/  # フロントエンド (3)
├── commands/
│   ├── spec-create.md
│   ├── task-exec.md
│   └── einja/           # Einja固有コマンド
├── skills/
│   └── einja/           # コーディング規約、設計ガイド
└── hooks/               # Git Hooks (9個)
    ├── biome-format.sh
    ├── typecheck.sh
    └── ...

docs/
├── templates/           # ドキュメントテンプレート
└── steering/            # プロジェクト基本方針
```

**含まれるMCPサーバー設定:**
- codex, context7, playwright, serena, github, vibe_kanban

## カスタマイズ

### settings.local.json

プロジェクト固有の設定は`settings.local.json`に記述します。

```json
{
  "permissions": {
    "allow": ["Bash(custom-script:*)"]
  }
}
```

### CLAUDE.md

プロジェクトルートに`CLAUDE.md`を作成してプロジェクト固有の指示を追加できます。

## 開発

```bash
# ビルド
pnpm build

# テスト
pnpm test

# 型チェック
pnpm typecheck
```

## 要件

- Node.js >= 20.0.0

## ライセンス

MIT
