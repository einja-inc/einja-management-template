# sync配布漏れ一括修正（dev-cli + create-einja-app）

## Context

CLAUDE.md が `einja sync` で配布されていない問題を起点に調査した結果、dev-cli と create-einja-app の両方で sync カテゴリの漏れ・ドキュメント不整合が多数発見された。両CLI間の役割分担を整理し、一括修正する。

### 役割分担（管轄境界）

| 管轄 | 対象 |
|------|------|
| **dev-cli** | `.claude/`, `docs/einja/`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, `.claude/settings.json`, `.envrc`, `.vscode/settings.json`, `scripts/` |
| **create-einja-app** | プロジェクト基盤（biome, git, docker, turbo, package.json, tsconfig, vitest, postcss, next.config 等） |

## 修正計画

---

### Part A: dev-cli 側

#### A1. `file-filter.ts` に `claude-md` カテゴリを追加

**ファイル**: `packages/cli/src/lib/sync/file-filter.ts`

- `CATEGORY_MAPPING` に `"claude-md": "."` を追加
- `scanSyncTargets()` に `claude-md` カテゴリの特別処理を追加（`env`, `tools` 等と同様のパターン）:
  - テンプレート側: `CLAUDE.md.template` を探す
  - プロジェクト側: `CLAUDE.md` の存在を確認
  - `SyncTarget.path` は `CLAUDE.md`（プロジェクト側パス）
  - `SyncTarget.templatePath` は `<templateRoot>/CLAUDE.md.template` の絶対パス
- `getCategoryFromPath()` に `claude-md` の判定を追加（`CLAUDE.md` → `claude-md`）

#### A2. `category-validator.ts` に不足カテゴリを追加

**ファイル**: `packages/cli/src/lib/sync/category-validator.ts`

| 追加カテゴリ | 説明 |
|------------|------|
| `claude-md` | `Claude Code 設定 (CLAUDE.md)` |
| `root-config` | `ルート設定 (package.json, .mcp.json)` |
| `claude-config` | `Claude Code 設定 (.claude/settings.json)` |

※ `scripts` は既に `VALID_CATEGORIES` に含まれている

#### A3. `sync.ts` でプレースホルダー展開を処理

**ファイル**: `packages/cli/src/commands/sync.ts`

テンプレート内容読み込み後、`CLAUDE.md.template` の場合はプレースホルダーを展開してからマージ処理に渡す。

- 既存の `detectPackageManager()` (`packages/cli/src/lib/package-manager.ts`) を再利用
- `processTemplateFile()` (`packages/cli/src/lib/file-system.ts`) の変数展開ロジックを活用
- `generate-template.mjs` の `placeholderMap` の逆変換：`{{INSTALL_COMMAND}}` → `pnpm install` 等

#### A4. dev-cli テスト更新

- `packages/cli/src/lib/sync/file-filter.test.ts` — `claude-md` カテゴリのスキャン・フィルタテスト
- `packages/cli/src/lib/sync/category-validator.test.ts` — 新カテゴリのバリデーションテスト
- `packages/cli/src/commands/sync.test.ts` — CLAUDE.md のプレースホルダー展開 + マーカーベースマージテスト

---

### Part B: create-einja-app 側

#### B1. `CATEGORY_PATTERNS` にファイルを追加

**ファイル**: `packages/create-einja-app/src/generators/sync.ts`

| カテゴリ | 追加するパターン |
|---------|----------------|
| `tools` | `.biomeignore`, `.vibe-kanban.json` |
| `git-hooks` | `.lintstagedrc.js` |
| `root-config` | `vitest.config.ts`, `postcss.config.cjs`, `next.config.ts`, `components.json`, `worktree.config.json` |

#### B2. `CATEGORY_CONFIGS`（prompts/sync.ts）も同期

**ファイル**: `packages/create-einja-app/src/prompts/sync.ts`

`CATEGORY_CONFIGS` の `description` フィールドを更新して追加ファイルを記載。

#### B3. `.vscode/**` の矛盾を解消

**ファイル**: `packages/create-einja-app/src/generators/sync.ts`

`CATEGORY_PATTERNS.tools` から `.vscode/**` を除外する（`.vscode/settings.json` は dev-cli が管轄）。

#### B4. `AGENTS.md` を dev-cli 管轄に移管

- `packages/create-einja-app/templates/default/AGENTS.md` を dev-cli の `presets/default/AGENTS.md` にコピー
- dev-cli の `file-filter.ts` `scanSyncTargets()` の `claude-md` カテゴリ特別処理に `AGENTS.md` も追加（CLAUDE.md.template と同様のパターンで、ただしプレースホルダー展開は不要）
- create-einja-app のテンプレートからは削除せず残す（init時にも配布が必要なため）
- create-einja-app の README.md の除外リストに `AGENTS.md` を追加（dev-cli管轄であることを明示）

---

### Part C: einja-sync.md コマンド定義を更新

**ファイル**: `.claude/commands/einja/einja-sync.md`

#### dev-cli カテゴリ一覧テーブル（追加行）

| カテゴリ名 | 対象ファイル | デフォルト |
|-----------|-------------|-----------|
| `claude-md` | `CLAUDE.md` | ON |
| `scripts` | `scripts/` | ON |
| `root-config` | `package.json`, `.mcp.json` | ON |
| `claude-config` | `.claude/settings.json` | ON |

#### create-einja-app カテゴリ一覧テーブル（修正）

- `tools` の対象ファイルに `.biomeignore`, `.vibe-kanban.json` を追加、`.vscode/` を除外
- `git-hooks` の対象ファイルに `.lintstagedrc.js` を追加
- `root-config` の対象ファイルに `vitest.config.ts`, `postcss.config.cjs`, `next.config.ts`, `components.json`, `worktree.config.json` を追加

---

### Part D: ドキュメント整備（配布仕様・役割分担の明文化）

次の作業プロセスが迷わず正確に作業できるよう、配布対象ファイルの一覧と管轄境界を明文化する。

#### D1. dev-cli README.md の sync カテゴリ一覧を更新

**ファイル**: `packages/cli/README.md`（L178-186 付近）

現在の「同期可能なカテゴリ」に不足カテゴリを追加:

```
- `claude-md` - Claude Code 設定ファイル（CLAUDE.md, AGENTS.md）
- `root-config` - ルート設定（package.json, .mcp.json）
- `claude-config` - Claude Code設定（.claude/settings.json）
```

#### D2. dev-cli README.md に「管轄境界」セクションを追加

**ファイル**: `packages/cli/README.md`

「利用シーン」セクション付近に、dev-cli と create-einja-app の管轄境界を明示するテーブルを追加:

```markdown
### dev-cli と create-einja-app の管轄境界

| ファイル/ディレクトリ | 管轄 | sync カテゴリ |
|---------------------|------|-------------|
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
| `package.json` | dev-cli | `root-config` |
| `.mcp.json` | dev-cli | `root-config` |
| `biome.json`, `.biomeignore` | create-einja-app | `tools` |
| `.gitignore`, `.gitattributes` | create-einja-app | `git` |
| `.husky/`, `.lintstagedrc.js` | create-einja-app | `git-hooks` |
| `turbo.json`, `pnpm-workspace.yaml` | create-einja-app | `monorepo` |
| `tsconfig.json`, `vitest.config.ts` 等 | create-einja-app | `root-config` |
| `Dockerfile*`, `docker-compose*.yml` | create-einja-app | `docker` |
| `.github/workflows/` | create-einja-app | `github` |
| `apps/**`, `packages/**` | create-einja-app | `apps` / `packages` |
```

#### D3. create-einja-app README.md の除外リストを更新

**ファイル**: `packages/create-einja-app/README.md`（L151 付近）

現在: `- .claude/, docs/einja/, CLAUDE.md, .mcp.json → @einja/cli管轄`
更新: `- .claude/, docs/einja/, CLAUDE.md, AGENTS.md, .mcp.json, .envrc, .vscode/settings.json, scripts/ → @einja/cli管轄`

#### D4. einja-sync.md コマンド定義のカテゴリ一覧を正確に更新（Part C と統合）

Part C の内容に加え、各カテゴリの対象ファイルを網羅的に記載する。特に `.vscode/**` の矛盾を解消し、管轄境界を明確にする注記を追加。

#### D5. `cli-package-specs` Skill に sync カテゴリ仕様・管轄境界を追記

**ファイル**: `.claude/skills/cli-package-specs/SKILL.md`

現状はビルドパイプライン・ファイルマッピング・マーカー仕様のみ記載。以下を新セクションとして追加:

**追加セクション: 「sync カテゴリ仕様」**
- dev-cli の全 sync カテゴリ一覧（カテゴリ名、対象ファイル、特別処理の有無）
- create-einja-app の全 sync カテゴリ一覧（同上）
- 各カテゴリの実装箇所（`file-filter.ts` L行番号、`generators/sync.ts` L行番号）

**追加セクション: 「管轄境界（dev-cli vs create-einja-app）」**
- ファイル/ディレクトリごとの管轄CLI + sync カテゴリの完全テーブル
- 新規ファイルを追加する際の判断基準（Claude Code関連 → dev-cli、プロジェクト基盤 → create-einja-app）

#### D6. CLAUDE.md のキーワードトリガーに sync 関連キーワードを追加

**ファイル**: `CLAUDE.md`（キーワードトリガーテーブル）

`cli-package-specs` のトリガーキーワードに追加:
- `sync` `CATEGORY_MAPPING` `CATEGORY_PATTERNS` `配布` `管轄` `カテゴリ` `file-filter` `category-validator`

これにより、sync 関連の修正時にも `cli-package-specs` Skill が自動読み込みされる。

---

## 検証方法

1. `pnpm --filter @einja/dev-cli test` でユニットテスト通過
2. `pnpm --filter create-einja-app test` でユニットテスト通過
3. `pnpm prepush` で lint + typecheck + test 通過
4. 下流リポジトリで `npx @einja/dev-cli sync --only claude-md --dry-run` を実行し、CLAUDE.md の差分が正しく表示されることを確認
