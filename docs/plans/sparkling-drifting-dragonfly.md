# Commands → Skills 移行 & 配布不要Skill改名

## Context

`.claude/commands/` は非推奨ではないがSkills（`.claude/skills/`）が推奨。既存の `.claude/commands/einja/` の6コマンドをSkill形式に移行する。また、配布不要な `einja-npm-release` をプレフィックスなしに改名し配布対象外にする。

Skillsへの移行により:
- 自動起動（description ベース）が可能に
- supporting files（補助ファイル）を同梱可能
- `allowed-tools` によるツール制限がより明確に
- `context: fork` によるコンテキスト分離が使える

## 命名計画

### コマンド → Skill 名

| 旧（command） | 旧呼び出し名 | 新Skill名 | 新呼び出し名 | 理由 |
|-------------|------------|-----------|------------|------|
| `einja-sync.md` | `einja:einja-sync` | `einja-sync` | `/einja-sync` | 冗長な `einja:einja-` が解消 |
| `frontend-implement.md` | `einja:frontend-implement` | `einja-frontend-implement` | `/einja-frontend-implement` | そのまま |
| `issue-exec.md` | `einja:issue-exec` | `einja-issue-exec` | `/einja-issue-exec` | そのまま |
| `start-dev.md` | `einja:start-dev` | `einja-start-dev` | `/einja-start-dev` | そのまま |
| `sync-cursor-commands.md` | `einja:sync-cursor-commands` | `einja-sync-cursor-commands` | `/einja-sync-cursor-commands` | そのまま |
| `update-docs-by-issue-specs.md` | `einja:update-docs-by-issue-specs` | `einja-update-docs-by-issue-specs` | `/einja-update-docs-by-issue-specs` | そのまま |

### 配布不要Skill改名

| 旧 | 新 | 理由 |
|----|-----|------|
| `einja-npm-release` | `npm-release` | テンプレートリポジトリ固有のリリース手順。下流で不要 |

---

## 実装計画

### Part 1: Skill ファイル作成（6ファイル）

各 `.claude/commands/einja/{name}.md` を `.claude/skills/einja-{name}/SKILL.md` に変換。

**変換ルール**:
- frontmatter: `description` と `allowed-tools` はそのまま移行
- `name` フィールドを追加
- 本文はそのまま流用（`$ARGUMENTS` はSkillでも動作）

```yaml
# 旧 (command)
---
description: "..."
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob, Edit
---

# 新 (skill)
---
name: einja-sync
description: "..."
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob, Edit
---
```

### Part 2: einja-npm-release → npm-release 改名

- `.claude/skills/einja-npm-release/` → `.claude/skills/npm-release/`
- SKILL.md 内の全 `einja-npm-release` 文字列を `npm-release` に置換（`name` フィールド L2、タイトル L17 含む）
- CLAUDE.md のキーワードトリガー: `einja-npm-release` → `npm-release`

### Part 3: ビルドパイプライン更新

**ファイル**: `packages/cli/scripts/copy-presets.mjs`

1. `mappings` 配列から commands エントリを削除（L57-60付近）
2. commands ディレクトリのクリーンアップ追加: `removeDir(presets/default/.claude/commands)`
3. 新Skillは既存の `einja-*` 動的スキャンで自動的にコピーされる

### Part 4: Sync 設定更新

**ファイル**: `packages/cli/src/lib/sync/file-filter.ts`
- `CATEGORY_MAPPING` から `commands` エントリを削除

**ファイル**: `packages/cli/src/lib/sync/category-validator.ts`
- `VALID_CATEGORIES` から `"commands"` を削除
- `CATEGORY_DESCRIPTIONS` から `commands` を削除

**テスト更新（詳細）**:

| テストファイル | 変更箇所 |
|--------------|---------|
| `packages/cli/src/lib/sync/__tests__/file-filter.test.ts` | `commands` カテゴリのテスト削除（~6箇所） |
| `packages/cli/src/lib/sync/__tests__/category-validator.test.ts` | `"commands"` の期待値削除（~8箇所） |
| `packages/cli/src/commands/__tests__/sync.test.ts` | `.claude/commands/einja/` パス参照更新（~23箇所） |
| `packages/cli/src/lib/sync/__tests__/file-copier.test.ts` | `.claude/commands/einja/` パス参照更新（~11箇所） |
| `packages/cli/src/lib/sync/__tests__/hash-cache.test.ts` | commands パス参照があれば更新 |
| `packages/cli/src/lib/sync/__tests__/orphan-cleaner.test.ts` | commands パス参照があれば更新 |

**CLIソースファイル（テスト以外）**:

| ファイル | 変更内容 |
|---------|---------|
| `packages/cli/src/lib/sync/file-filter.ts` | `CATEGORY_MAPPING` から `commands` 削除 |
| `packages/cli/src/lib/sync/category-validator.ts` | `VALID_CATEGORIES` / `CATEGORY_DESCRIPTIONS` から `commands` 削除 |
| `packages/cli/scripts/copy-presets.mjs` | commands コピーエントリ削除 + `presets/default/.claude/commands` クリーンアップ追加 |

**メタデータファイル**:
- `.einja-sync.json`（下流リポジトリ用） — `.claude/commands/einja/` エントリは次回sync時に自動クリーンアップされるため手動対応不要

### Part 5: ドキュメント参照更新

**必須更新（配布対象）**:

| ファイル | 変更内容 | 出現数 |
|---------|---------|--------|
| `CLAUDE.md` | `einja:issue-exec` → `einja-issue-exec` (L45)、Skill/コマンドテーブル全体更新、`einja-npm-release` → `npm-release` (L253)、CLIパッケージ二重管理テーブルから commands 行削除 | ~5箇所 |
| `README.md` | commands → skills への説明更新 (L60付近) | ~2箇所 |
| `.claude/agents/einja/docs/docs-updater.md` | `einja:update-docs-by-issue-specs` → `einja-update-docs-by-issue-specs` (L66) + Readパス `.claude/commands/einja/update-docs-by-issue-specs.md` → `.claude/skills/einja-update-docs-by-issue-specs/SKILL.md` (L31) | 2箇所 |
| `.claude/agents/einja/issue-specs/tasks-generator.md` | `einja:issue-exec` → `einja-issue-exec` | 2箇所 |
| `.claude/skills/cli-package-specs/SKILL.md` | commands カテゴリ削除、管轄テーブルから `.claude/commands/einja/` 行削除 | ~3箇所 |
| `einja-sync/SKILL.md`（移行後） | dev-cli カテゴリ一覧から `commands` を削除 | 1箇所 |
| `.claude/rules/cli-package-specs.md` | path-specificトリガーから `.claude/commands/einja/**` 行を削除 | 1箇所 |
| `packages/cli/docs/BUILD.md` | commands パス記述を削除/更新 (L22) | 1箇所 |
| `packages/cli/README.md` | commands カテゴリテーブル行を削除/更新 (L124付近) | 1箇所 |

**docs/einja/ 配下（原本として編集可）**:

| ファイル | 変更内容 | 出現数 |
|---------|---------|--------|
| `docs/einja/steering/development-workflow.md` | `einja:issue-exec` → `einja-issue-exec` | ~17箇所 |
| `docs/einja/steering/task-management.md` | `einja:issue-exec` → `einja-issue-exec` + `einja:update-docs-by-issue-specs` → `einja-update-docs-by-issue-specs` | ~6箇所 |
| `docs/einja/steering/branch-strategy.md` | `einja:issue-exec` → `einja-issue-exec` | ~5箇所 |
| `docs/einja/instructions/issue-exec-workflow.md` | `einja:issue-exec` → `einja-issue-exec` | 多数 |
| `docs/einja/instructions/task-execute.md` | `einja:issue-exec` → `einja-issue-exec` | ~3箇所 |
| `docs/einja/instructions/setup-flow.md` | `einja:einja-sync` → `einja-sync` | 2箇所 |

**参照置換パターンまとめ**:

| 旧パターン | 新パターン |
|-----------|-----------|
| `einja:issue-exec` | `einja-issue-exec` |
| `einja:einja-sync` | `einja-sync` |
| `einja:frontend-implement` | `einja-frontend-implement` |
| `einja:start-dev` | `einja-start-dev` |
| `einja:sync-cursor-commands` | `einja-sync-cursor-commands` |
| `einja:update-docs-by-issue-specs` | `einja-update-docs-by-issue-specs` |
| `einja-npm-release` (Skill名) | `npm-release` |
| `.claude/commands/einja/` (パス) | `.claude/skills/einja-*/` (パス) |

**更新不要**: `docs/plans/`, `docs/specs/` は歴史的記録

### Part 6: sync-cursor-commands 内部ロジック更新

移行後の `einja-sync-cursor-commands/SKILL.md` 内で、スキャン対象を更新:
- スキャンパス: `.claude/commands/**/*.md` → `.claude/skills/**/SKILL.md`
- ルール名抽出: ファイル名ベース（`issue-exec.md` → `issue-exec`） → ディレクトリ名ベース（`einja-issue-exec/SKILL.md` → `einja-issue-exec`）
- 元コードの該当箇所: L26-28付近の `find` / `glob` パターンと、L50付近のファイル名→ルール名変換ロジック
- ドキュメント部分の更新: L136（出力例 `.claude/commands/einja/start-dev.md`）、L159（`変換元ディレクトリ: .claude/commands/`）も skills に更新

### Part 7: 旧ファイル削除

- `.claude/commands/einja/` ディレクトリごと削除
- `packages/cli/presets/default/.claude/commands/` ディレクトリごと削除（Part 3のビルドで自動化）

---

## 並列実行戦略

```
[Part 1 + Part 2] → [Part 3 + Part 4 + Part 5 + Part 6] → [Part 7] → 検証
```

- Part 1（Skill作成6ファイル）と Part 2（npm-release改名）は並列可能
- Part 3-6は Part 1,2 完了後に並列実行可能
- Part 7は全完了後

---

## 検証方法

1. `pnpm --filter @einja/dev-cli test` — ユニットテスト通過
2. `pnpm prepush` — lint + typecheck + test 全通過
3. `grep -r "einja:issue-exec\|einja:einja-sync\|einja:frontend-implement\|einja:start-dev\|einja:sync-cursor-commands\|einja:update-docs" .claude/ docs/einja/ CLAUDE.md README.md AGENTS.md` — 旧参照が残っていないこと
4. `grep -r "einja-npm-release" CLAUDE.md .claude/ packages/cli/` — 旧名が残っていないこと
4b. `grep -r ".claude/commands/einja" .claude/ packages/cli/ CLAUDE.md README.md AGENTS.md` — 旧パス参照が残っていないこと（docs/plans/ は除く）
5. `ls .claude/commands/einja/` — ディレクトリが存在しないこと
6. `ls packages/cli/presets/default/.claude/commands/` — ディレクトリが存在しないこと
