# @einja-inc/create-app ビルドプロセス

## 概要

@einja-inc/create-appのビルドは2段階で実行されます：

```
prebuild → build
```

## ビルドパイプライン

### 1. prebuild: テンプレートの更新

**スクリプト**: `scripts/template-update.ts`

プロジェクトルート（einja-management-template）のファイルを `templates/default/` にコピーします。

**コピーフロー**:
1. プロジェクトルートの全ファイルを走査（`node_modules/`除外）
2. `.templateignore` に記載されたパターンで除外
3. プレースホルダー変換を適用
4. `templates/default/` にコピー

**テンプレートに含まれる主要ファイル**:

| ファイル/ディレクトリ | 説明 |
|-------------------|------|
| `apps/web/` | Next.js 15 アプリケーション |
| `packages/` | 共通パッケージ（config, front-core, server-core, ui） |
| `.vscode/settings.json` | VS Code設定（Biome統合） |
| `turbo.json` | Turborepo設定 |
| `pnpm-workspace.yaml` | pnpmワークスペース設定 |
| `docker-compose.yml` | PostgreSQL設定 |

**除外ファイル** (`.templateignore`で指定):
- `packages/cli/`, `packages/create-app/` - CLIパッケージ本体
- `.claude/agents/einja/`, `.claude/skills/einja-*/` 等 - @einja-inc/dev-cli管轄
- `docs/specs/`, `docs/einja/` - 仕様書・ドキュメント
- `node_modules/`, `dist/` 等 - ビルド出力

**プレースホルダー変換**:

| 対象ファイル | 変換内容 |
|-----------|---------|
| `package.json` | `name` → `{{projectName}}`, `description` → `{{description}}` |
| `tsconfig.json` | `@repo/*` → `{{packageName}}/*` |
| `*.ts, *.tsx, *.js, *.jsx` | `from "@repo/"` → `from "{{packageName}}/"` |
| `README.md`（ルートのみ） | `@einja:excluded` マーカー除去 |
| `.gitignore` | ファイル名を `gitignore` にリネーム |

### 2. build: バンドル

```bash
tsup
```

tsupでTypeScriptをバンドルし、`dist/`に出力。

## ビルドコマンド

```bash
cd packages/create-app

# フルビルド（prebuild + build）
pnpm build

# テンプレートの更新のみ
pnpm template:update

# テンプレートの更新プレビュー（dry-run）
pnpm template:update --dry-run
```

## 配布されるファイル

`package.json` の `files` フィールドで指定:

| ディレクトリ | 内容 |
|-------------|------|
| `dist/` | バンドル済みCLIコード |
| `templates/` | プロジェクトテンプレート |

## 原本管理

- **原本**: プロジェクトルートのファイル群（Single Source of Truth）
- **配布用**: ビルド時に `templates/default/` にコピー
- 原本を編集すると、次回ビルド時に自動的にテンプレートも更新される
- `.templateignore` で配布対象を制御
