# CLIパッケージ ビルドプロセス

## 概要

CLIパッケージのビルドは3段階で実行されます：

```
prebuild → build → postbuild
```

## ビルドパイプライン

### 1. prebuild: プリセットファイルのコピー

**スクリプト**: `scripts/copy-presets.mjs`

プロジェクト本体のファイルをCLI配布用ディレクトリにコピーします。

| ソース（プロジェクト本体） | コピー先（CLI配布用） |
|------------------------|-------------------|
| `.claude/agents/einja/` | `presets/default/.claude/agents/einja/` |
| `.claude/skills/einja-*/` | `presets/default/.claude/skills/einja-*/` |
| `.claude/hooks/einja/` | `presets/default/.claude/hooks/einja/` |
| `.vscode/settings.json` | `presets/default/.vscode/settings.json` |
| `docs/einja/steering/` | `scaffolds/steering/` |

**フィルター**: `_` で始まるファイルはスキップされます（プレースホルダー用）

### 2. build: TypeScriptコンパイル

```bash
pnpm clean && tsc
```

- `dist/` ディレクトリを削除してクリーンビルド
- TypeScriptをJavaScriptにコンパイル
- 型定義ファイル (`.d.ts`) を生成

### 3. postbuild: 実行権限の付与

**スクリプト**: `scripts/add-shebang.mjs`

- `dist/cli.js` にシェバング (`#!/usr/bin/env node`) を追加
- 実行権限 (`chmod +x`) を付与

## ビルドコマンド

```bash
cd packages/cli

# フルビルド（prebuild + build + postbuild）
pnpm build

# クリーンアップのみ
pnpm clean

# 型チェックのみ
pnpm typecheck
```

## 生成されるファイル

ビルド後のディレクトリ構造：

```
packages/cli/
├── dist/                          # コンパイル済みコード
│   ├── cli.js                     # エントリーポイント（実行可能）
│   ├── index.js
│   └── ...
├── presets/default/.claude/       # ビルド時に自動生成（git管理外）
│   ├── agents/einja/
│   ├── commands/einja-*/
│   ├── skills/einja-*/
│   └── hooks/
└── scaffolds/steering/            # ビルド時に自動生成（git管理外）
```

## 原本管理

このプロジェクトでは「二重管理」を避けるため、以下のルールを採用しています：

- **原本**: プロジェクトルートの `.claude/` と `docs/einja/` ディレクトリ
- **配布用**: ビルド時に `presets/` と `scaffolds/` にコピー

原本を編集すると、次回ビルド時に自動的に配布用ファイルも更新されます。

## .gitignore

ビルド時に自動生成されるディレクトリはgit管理から除外されています：

```gitignore
# packages/cli/.gitignore
dist/
tsconfig.tsbuildinfo
presets/default/.claude/
scaffolds/steering/
```
