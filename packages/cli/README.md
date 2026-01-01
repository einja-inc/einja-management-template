# @einja/claude-cli

Claude Code用の`.claude`設定ディレクトリをnpxでインストールできるCLI。

## クイックスタート

```bash
npx @einja/claude-cli init
```

## インストール

```bash
# npx（推奨）
npx @einja/claude-cli init

# グローバルインストール
npm install -g @einja/claude-cli
einja-claude init
```

## コマンド

### `init`

`.claude`ディレクトリをセットアップします。

```bash
# 対話型（プリセット選択）
npx @einja/claude-cli init

# プリセット指定
npx @einja/claude-cli init --preset minimal
npx @einja/claude-cli init --preset turborepo-pandacss
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `-p, --preset <name>` | プリセットを指定 |
| `-f, --force` | 上書き確認をスキップ |
| `--dry-run` | 実行内容をプレビュー |
| `--no-backup` | バックアップを作成しない |

### `list`

利用可能なプリセット一覧を表示します。

```bash
npx @einja/claude-cli list
```

## プリセット

| プリセット | 説明 | MCP | エージェント |
|-----------|------|-----|-------------|
| `minimal` | 最小構成のATDDワークフロー | なし | 8個 |
| `turborepo-pandacss` | Turborepo + Next.js 15フルスタック | 6種 | 12個 |

### minimal

汎用的なATDD（受け入れテスト駆動開発）ワークフロー。

```
.claude/
├── settings.json
├── agents/
│   ├── specs/           # 仕様書生成 (3)
│   └── task/            # タスク実行 (5)
└── commands/
    ├── spec-create.md
    └── task-exec.md
```

### turborepo-pandacss

Einja管理画面テンプレート互換のフルスタック構成。

```
.claude/
├── settings.json
├── agents/
│   ├── specs/           # 仕様書生成 (3)
│   ├── task/            # タスク実行 (6)
│   └── frontend/        # フロントエンド (3)
└── commands/
    ├── spec-create.md
    ├── task-exec.md
    ├── frontend-implement.md
    ├── start-dev.md
    └── ...
```

**含まれるMCPサーバー:**
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
