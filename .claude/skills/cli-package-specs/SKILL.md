---
name: cli-package-specs
description: "@einja/dev-cli と create-einja-app のビルド・テンプレート仕様リファレンス。ファイルマッピング、マーカー仕様、コピーフィルタ条件を集約"
---

# CLI パッケージ ビルド・テンプレート仕様リファレンス

## 概要

このSkillは、2つのCLIパッケージのビルドパイプライン・テンプレート仕様を集約したリファレンスです。
`einja-` プレフィックスを持たないため、`presets/default/` にはコピーされません。

| パッケージ | 役割 |
|-----------|------|
| `@einja/dev-cli` (`packages/cli`) | 既存プロジェクトへの `.claude/` 設定・`docs/einja/` 同期。`einja init` / `einja sync` コマンドを提供 |
| `create-einja-app` (`packages/create-einja-app`) | 新規プロジェクトのスキャフォールディング。テンプレートからプロジェクト全体を生成 |

---

## 1. ビルドパイプライン

### 1.1 `@einja/dev-cli` ビルド

`packages/cli/package.json` L21:
```
"prebuild": "node ./scripts/generate-template.mjs && node ./scripts/copy-presets.mjs"
```

#### Step 1: CLAUDE.md.template 生成
- **スクリプト**: `packages/cli/scripts/generate-template.mjs`
- **入力**: プロジェクトルートの `CLAUDE.md`
- **出力**: `packages/cli/presets/default/CLAUDE.md.template`
- **処理**:
  1. `@einja:excluded` マーカー内を除去（L53-56）
  2. `pnpm install` 等のコマンドをプレースホルダー（`{{INSTALL_COMMAND}}`等）に変換（L25-35, L62-69）

#### Step 2: プリセットファイルコピー + マーカーバリデーション
- **スクリプト**: `packages/cli/scripts/copy-presets.mjs`
- **処理順序**:
  1. `docs/einja/` 配下のマーカーバリデーション（L303-317）
  2. ディレクトリマッピングに基づくコピー（L47-122）
  3. 単一ファイルのコピー（L125-156）
  4. シンボリックリンク情報の `symlinks.json` 出力（L284-295）

### 1.2 `create-einja-app` テンプレート更新

- **スクリプト**: `scripts/_template-update.ts`（ルート）
- **出力先**: `packages/create-einja-app/templates/default/`
- **処理**:
  1. `.templateignore` でフィルタリング（L93-103）
  2. `README.md` の `@einja:excluded` マーカー除去（L173-185）
  3. `package.json` の `name` → `{{projectName}}`、`description` → `{{description}}`（L108-131）
  4. `tsconfig.json` の `@repo/` → `{{packageName}}/`（L136-161）
  5. `.ts/.tsx/.js/.jsx` の import文 `@repo/` → `{{packageName}}/`（L166-168）

### 1.3 `@einja/dev-cli` プリセット更新（開発用）

- **スクリプト**: `scripts/_cli-template-update.ts`
- **実行**: `pnpm preset:update`（`packages/cli/package.json` L30）
- **処理**: `FileCopier` クラスを使用してプロジェクト原本をCLIプリセットにコピー

---

## 2. ファイルマッピング

### 2.1 `@einja/dev-cli` コピー対象（`copy-presets.mjs`）

#### ディレクトリマッピング（L47-122）

| 原本 | コピー先（`presets/default/` 配下） | 備考 |
|------|--------------------------------------|------|
| `.claude/agents/einja/` | `.claude/agents/einja/` | |
| `.claude/commands/einja/` | `.claude/commands/einja/` | |
| `.claude/skills/einja-*` | `.claude/skills/einja-*/` | 個別列挙（L62-101） |
| `.claude/hooks/einja/` | `.claude/hooks/einja/` | `cleanParent: true`（L107） |
| `docs/einja/` | `docs/einja/` | `memory/`, `cli/` を除外（L114） |
| `scripts/` | `scripts/` | `_` プレフィックスのファイルはスキップ（L247-249） |

#### 単一ファイルマッピング（L125-156）

| 原本 | コピー先 | 必須 |
|------|---------|------|
| `.claude/settings.json` | `.claude/settings.json` | Yes |
| `.mcp.json` | `.mcp.json` | No |
| `docs/einja/cli/preset.yaml` | `preset.yaml` | Yes |
| `.envrc` | `.envrc` | Yes |
| `.vscode/settings.json` | `.vscode/settings.json` | No |

#### 特殊変換

| 原本 | コピー先 | 変換内容 |
|------|---------|---------|
| `CLAUDE.md` | `CLAUDE.md.template` | `@einja:excluded` 除去 + プレースホルダー変換（`generate-template.mjs`） |

### 2.2 `FileCopier` クラスのマッピング（`file-copier.ts`）

**ファイル**: `packages/cli/src/lib/preset-update/file-copier.ts`

`FileCopier` は `einja sync` / `preset:update` で使用される。`copy-presets.mjs`（prebuild）とは別のコピーロジック。

ディレクトリマッピング（L44-85）:

| source | destination | category |
|--------|------------|----------|
| `.claude/commands` | `.claude/commands/einja` | commands |
| `.claude/agents` | `.claude/agents/einja` | agents |
| `.claude/skills` | `.claude/skills` | skills |
| `.claude/hooks` | `.claude/hooks` | hooks |
| `docs/einja/steering` | `docs/einja/steering` | docs |
| `docs/einja/templates` | `docs/einja/templates` | docs |
| `docs/einja/instructions` | `docs/einja/instructions` | docs |
| `docs/einja/example` | `docs/einja/example` | docs |

単一ファイルマッピング（L92-104）:

| source | destination | category |
|--------|------------|----------|
| `.envrc` | `.envrc` | env |
| `.vscode/settings.json` | `.vscode/settings.json` | tools |
| `package.json`（ルート） | `package.json` | root-config |

---

## 3. コピー対象フィルタ

### 3.1 Skills のプレフィックスフィルタ

**ファイル**: `packages/cli/src/lib/preset-update/file-copier.ts` L194-195

```typescript
// skillsカテゴリの場合、einja-/_einja-プレフィックスでフィルタリング
const prefixFilter = mapping.category === "skills" ? ["einja-", "_einja-"] : undefined;
```

`.claude/skills/` 配下のトップレベルディレクトリのうち、**`einja-` または `_einja-` で始まるもの**が配布対象。

- **配布される**: `einja-task-commit/`, `einja-skill-creator/`, `_einja-project-overview/` 等
- **配布されない**: `cli-package-specs/`（このSkill自体）、その他プレフィックスなしのSkill

`copy-presets.mjs` ではディレクトリを動的スキャンし、`einja-*` / `_einja-*` パターンにマッチするものを個別エントリとしてコピーする。

### 3.2 `_` プレフィックスフィルタ

- `copy-presets.mjs` L247-249: `_` で始まるファイル名はスキップ
- `file-copier.ts` L291: `_` で始まるファイル名はスキップ

### 3.3 隠しファイルフィルタ（`file-copier.ts` のみ）

- L303: `.` で始まるファイル名はスキップ（単一ファイルマッピングで明示されたものを除く）

---

## 4. マーカー仕様

**詳細仕様書**: `packages/cli/docs/MARKER_SPECIFICATION.md`
**実装**: `packages/cli/src/lib/sync/marker-processor.ts`

### 4.1 `@einja:excluded`

テンプレート生成時に**セクション全体を除去**するマーカー。

```markdown
<!-- @einja:excluded:start -->
このセクション内容はテンプレートには含まれない
<!-- @einja:excluded:end -->
```

- `generate-template.mjs` L53-56: CLAUDE.md → CLAUDE.md.template 変換時に除去
- `template-update.ts` L56-67: create-einja-app テンプレート（README.md等）で除去
- `_template-update.ts` L173-185: 同上

### 4.2 `@einja:managed`

`einja sync` 実行時に**常にテンプレート版で上書き**されるセクション。

```markdown
<!-- @einja:managed:start -->
共通ルール（sync時に最新版で上書き）
<!-- @einja:managed:end -->
```

- ID属性はオプション: `<!-- @einja:managed:start id="section-a" -->`
- `marker-processor.ts` L16-17: パース用正規表現

### 4.3 `@einja:project-private`

`einja sync` 実行時に**初回のみ追加、以降はユーザー編集を保持**するセクション。

```markdown
<!-- @einja:project-private:start id="commit-rules-project" -->
プロジェクト固有の設定（ユーザーが自由に編集）
<!-- @einja:project-private:end -->
```

- **ID属性は必須**（`marker-processor.ts` L174-181 でバリデーション）
- レガシー `@einja:seed` マーカーとの後方互換あり（L44-53, L303-307）

### 4.4 マーカーバリデーション

`packages/cli/scripts/validate-markers.mjs` がビルド時（`copy-presets.mjs` L303-317 から呼び出し）に実行。

| チェック項目 | エラータイプ |
|------------|------------|
| start/end ペア一致 | `unpaired_start` / `unpaired_end` |
| ネスト禁止 | `nested` |
| project-private に ID 必須 | `project_private_without_id` |
| ID 重複禁止 | `duplicate_id` |

### 4.5 JSON マージ仕様

**実装**: `packages/cli/src/lib/sync/json-processor.ts`
**設定**: `.einja-sync.json` の `jsonPaths` フィールド

#### マージモード（ブラックリスト方式）

| モード | 動作 | 用途 |
|--------|------|------|
| `managed` | テンプレート値で強制上書き | テンプレートが完全管理するセクション |
| `project-private` | 完全除外（テンプレートから追加・更新しない） | プロジェクト固有のセクション |
| デフォルト | base/local/templateの3方向マージ | 上記以外の全パス |

#### ネスト指定

パスはドット区切りでネスト指定可能。`deepMergeWithPaths` の再帰により
各レベルで jsonPaths チェックが行われる。

例: `"project-private": { "package.json": ["devDependencies.@types/node"] }`
→ devDependencies 全体は3方向マージ、@types/node のみ除外

#### 設定例

```
jsonPaths:
  managed: { ".claude/settings.json": ["plansDirectory"] }
  project-private: { "package.json": ["name", "version", "private", "workspaces"] }
```

→ plansDirectory はテンプレート強制上書き
→ name, version 等は完全除外
→ scripts, devDependencies 等は3方向マージ

#### base スナップショット

3方向マージには前回sync時のテンプレート内容（base）が必要。
`.einja-sync.json` の各ファイルメタデータに `baseContent` として保存。
初回sync（base なし）はローカル優先 + テンプレート新規キーのみ追加。

#### コンフリクト

両方が同じキーを異なる値に変更した場合:
- ローカル値を保持（安全側）
- コンソールに警告出力
- `mergeJson` の戻り値 `conflicts` 配列で呼び出し元にも通知

---

## 5. `post-setup.ts` 処理フロー

**ファイル**: `packages/create-einja-app/src/generators/post-setup.ts`

`create-einja-app` でプロジェクト生成後に実行されるセットアップフロー。

| Step | 処理 | 行番号 |
|------|------|--------|
| 0 | 初回セットアップ（`scripts/init.sh` 実行: Volta/Node.js/pnpm/direnv） | L57-64 |
| 1 | 依存関係インストール（`pnpm install`） + Prismaクライアント生成（`pnpm db:generate`） | L68-87 |
| 2 | 秘密鍵の自動ローテーション（`pnpm env:rotate-secrets --all --non-interactive`） | L90-99 |
| 3 | Git初期化（`git init` → `git add .` → `git commit`） | L102-113 |
| 4 | `@einja/dev-cli` 初期化（`npx @einja/dev-cli@latest init --force --no-backup`、`config.setupEinjaCli` が true の場合のみ） | L116-125 |
| 5 | 完了メッセージ表示 | L128 |

---

## 6. `setup-dev.ts` 処理フロー

**ファイル**: `scripts/setup-dev.ts`

既存プロジェクトの開発環境セットアップスクリプト。

| Step | 処理 | 行番号 |
|------|------|--------|
| 1 | Volta インストール確認 | L158-191 |
| 2 | Volta シェル設定（`VOLTA_FEATURE_PNPM`） | L194-213 |
| 3 | Node.js / pnpm インストール（`volta install`） | L216-249 |
| 4 | direnv インストール確認（macOS: `brew install direnv`） | L324-355 |
| 5 | シェル設定（`direnv hook` を rc ファイルに追加） | L358-376 |
| 6 | dotenvx インストール | L379-419 |
| 7 | `.env` ファイル作成（`.env.local` から復号、worktree 対応） | L422-517 |
| 8 | `.env.personal` 作成 + `GITHUB_TOKEN` 対話設定 | L519-585 |
| 9 | direnv 有効化（`direnv allow`） | L588-594 |
| 10 | データベース起動（`docker-compose up -d postgres`） | L597-625 |
| 11 | データベース初期化（`pnpm db:generate` + `pnpm db:push`） | L610-613 |

worktree 環境では `.env.keys` をメインリポジトリから自動コピーする機能あり（L45-67, L73-90）。

---

## 7. sync カテゴリ仕様

### 7.1 dev-cli sync カテゴリ

**実装**: `packages/cli/src/lib/sync/file-filter.ts`

| カテゴリ | 対象ファイル | 特別処理 |
|---------|------------|---------|
| `commands` | `.claude/commands/einja/**` | - |
| `agents` | `.claude/agents/einja/**` | - |
| `skills` | `.claude/skills/{einja-,_einja-}*/**` | プレフィックスフィルタ |
| `hooks` | `.claude/hooks/**` | - |
| `docs` | `docs/einja/**` | - |
| `scripts` | `scripts/**` | - |
| `env` | `.envrc` | 単一ファイル |
| `tools` | `.vscode/settings.json` | 単一ファイル |
| `claude-md` | `CLAUDE.md`, `AGENTS.md` | CLAUDE.md.templateからプレースホルダー展開 |
| `root-config` | `package.json`, `.mcp.json` | JSONマージ |
| `claude-config` | `.claude/settings.json` | JSONマージ |

**バリデーション**: `packages/cli/src/lib/sync/category-validator.ts`

### 7.2 create-einja-app sync カテゴリ

**実装**: `packages/create-einja-app/src/generators/sync.ts`

| カテゴリ | 対象パターン |
|---------|------------|
| `env` | `.env*`, `.envrc`, `.volta`, `.node-version` |
| `tools` | `biome.json`, `.biomeignore`, `.vibe-kanban.json`, `.prettierrc*`, `.editorconfig` |
| `git` | `.gitignore`, `.gitattributes` |
| `git-hooks` | `.husky/**`, `.lintstagedrc.js` |
| `github` | `.github/workflows/**`, `.github/actions/**`, `.github/dependabot.yml` |
| `docker` | `Dockerfile*`, `docker-compose*.yml`, `.dockerignore` |
| `monorepo` | `turbo.json`, `pnpm-workspace.yaml` |
| `root-config` | `package.json`, `tsconfig.json`, `vitest.config.ts`, `postcss.config.cjs`, `next.config.ts`, `components.json`, `worktree.config.json` |
| `scripts` | `scripts/**` |
| `apps` | `apps/**` |
| `packages` | `packages/**` |
| `docs` | `README.md`, `docs/**` |

**プロンプト**: `packages/create-einja-app/src/prompts/sync.ts`

---

## 8. 管轄境界（dev-cli vs create-einja-app）

### 8.1 ファイル管轄テーブル

| ファイル/ディレクトリ | 管轄CLI | sync カテゴリ |
|---------------------|---------|-------------|
| `.claude/commands/einja/` | dev-cli | `commands` |
| `.claude/agents/einja/` | dev-cli | `agents` |
| `.claude/skills/einja-*/` | dev-cli | `skills` |
| `.claude/hooks/einja/` | dev-cli | `hooks` |
| `.claude/settings.json` | dev-cli | `claude-config` |
| `docs/einja/` | dev-cli | `docs` |
| `scripts/` | dev-cli | `scripts` |
| `CLAUDE.md` | dev-cli | `claude-md` |
| `AGENTS.md` | dev-cli | `claude-md` |
| `.envrc` | dev-cli | `env` |
| `.vscode/settings.json` | dev-cli | `tools` |
| `package.json` | 両方（管理パスが異なる） | dev-cli: `root-config` / create-einja-app: `root-config` |
| `.mcp.json` | dev-cli | `root-config` |
| `biome.json`, `.biomeignore` | create-einja-app | `tools` |
| `.gitignore`, `.gitattributes` | create-einja-app | `git` |
| `.husky/`, `.lintstagedrc.js` | create-einja-app | `git-hooks` |
| `turbo.json`, `pnpm-workspace.yaml` | create-einja-app | `monorepo` |
| `tsconfig.json`, `vitest.config.ts` 等 | create-einja-app | `root-config` |
| `Dockerfile*`, `docker-compose*.yml` | create-einja-app | `docker` |
| `.github/workflows/` | create-einja-app | `github` |
| `apps/**`, `packages/**` | create-einja-app | `apps` / `packages` |

### 8.2 新規ファイル追加時の判断基準

- **Claude Code関連**（.claude/, CLAUDE.md, AGENTS.md, docs/einja/）→ dev-cli
- **プロジェクト基盤**（ビルドツール、CI/CD、Docker、lint、テスト設定）→ create-einja-app
- **両方が関わる**（package.json）→ 管理パス（jsonPaths）で分離
