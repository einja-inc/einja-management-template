# コミット・プッシュ計画

## Context

前回のセッションで実施された大規模なSkillリファクタリング（`reference/` → `references/` リネーム、新Skill追加、CLAUDE.mdスリム化、CLIパッケージ更新等）の変更が未コミットの状態で残っている。これらを適切な粒度でコミットし、プッシュする。

## 現状の問題点

### ステージングの不整合（要修正）

以下のファイルは staged では `reference/` → `references/` にリネーム済みだが、ディスク上で削除されている（シンボリックリンクだったファイル）:

| ファイル | 状態 |
|---------|------|
| `einja-coding-standards/references/commit-rules.md` | ステージ済み(rename) → ディスク上削除 |
| `einja-coding-standards/references/review-guidelines.md` | 同上 |
| `einja-coding-standards/references/testing-strategy.md` | 同上 |
| `einja-component-design/references/frontend-development.md` | 同上 |
| `einja-component-design/references/testing-strategy.md` | 同上 |
| `einja-task-commit/references/commit-rules.md` | 同上（ディレクトリごと不在） |
| `einja-task-qa/references/acceptance-criteria-and-qa-guide.md` | 同上 |

→ これらの**削除もステージして**コミットに含める必要がある

### 未ステージの変更

| ファイル | 内容 |
|---------|------|
| `.claude/settings.json` | `plansDirectory: "docs/plans"` 追加 |
| `CLAUDE.md` | さらなるリファクタリング（役割定義の簡潔化、セクション再構成） |

## コミット分割計画

### コミット1: `refactor(skills): referenceディレクトリをreferencesにリネーム・不要シンボリックリンクを削除`

**対象ファイル:**
- `.claude/skills/einja-coding-standards/` - `reference/` → `references/` リネーム + SKILL.mdパス更新
- `.claude/skills/einja-component-design/` - 同上
- `.claude/skills/einja-task-commit/` - 同上
- `.claude/skills/einja-task-qa/` - 同上
- `.claude/skills/einja-task-spec-generator/` - 同上
- `.claude/skills/einja-task-spec-validator/` - 同上
- 削除済みシンボリックリンクファイル7件のステージング
- 削除済みSkill: `einja-api-development/reference/`, `einja-backend-architecture/reference/`, `einja-frontend-development/reference/`
- `.claude/agents/einja/task/task-executer.md` - パス参照更新

### コミット2: `feat(skills): einja-project-overview・einja-skill-creator Skill新規作成`

**対象ファイル:**
- `.claude/skills/einja-project-overview/SKILL.md` (新規)
- `.claude/skills/einja-skill-creator/SKILL.md` (新規)
- `.claude/skills/einja-skill-creator/scripts/init_skill.py` (新規)
- `.claude/skills/einja-skill-creator/scripts/package_skill.py` (新規)
- `.claude/skills/einja-skill-creator/scripts/quick_validate.py` (新規)

### コミット3: `feat(skills): import-conventions追加・infra-maintenance/task-qa Skill更新`

**対象ファイル:**
- `.claude/skills/einja-coding-standards/references/import-conventions.md` (新規)
- `.claude/skills/einja-infra-maintenance/SKILL.md` (更新)
- `.claude/skills/einja-task-qa/SKILL.md` (更新)

### コミット4: `refactor: CLAUDE.mdをスリム化しSkillへ内容を移行`

**対象ファイル:**
- `CLAUDE.md` (ステージ済み + 未ステージ変更をまとめて)

### コミット5: `feat(cli): references/ディレクトリ対応・syncフィルター更新`

**対象ファイル:**
- `packages/cli/scripts/copy-presets.mjs`
- `packages/cli/src/lib/preset-update/file-copier.ts`
- `packages/cli/src/lib/preset-update/file-copier.test.ts`
- `packages/cli/src/lib/sync/category-validator.ts`
- `packages/cli/src/lib/sync/category-validator.test.ts`
- `packages/cli/src/lib/sync/file-filter.ts`
- `packages/cli/src/lib/sync/file-filter.test.ts`
- `packages/cli/docs/SYMLINK_ARCHITECTURE.md`
- `packages/cli/README.md`
- `packages/cli/docs/BUILD.md`

### コミット6: `docs: 環境セットアップ・Neon CLIリファレンスの更新`

**対象ファイル:**
- `docs/einja/instructions/environment-setup.md`
- `docs/einja/instructions/local-server-environment-and-worktree.md`
- `docs/einja/instructions/neon-cli-reference.md`

### コミット7: `chore: create-einja-appテンプレート更新・BUILD.md追加`

**対象ファイル:**
- `packages/create-einja-app/.templateignore`
- `packages/create-einja-app/README.md`
- `packages/create-einja-app/docs/BUILD.md` (新規)

### コミット8: `chore: settings.jsonにplansDirectory追加`

**対象ファイル:**
- `.claude/settings.json`

## 実行手順

1. 現在のステージングを一旦全解除（`git restore --staged .`）
2. 各コミットごとにファイルを選択的にステージ → コミット
3. 全コミット完了後 `pnpm prepush` 実行
4. 成功後 `git push`

## 検証

- `pnpm prepush`（lint + typecheck + test）がパスすること
- `git log --oneline -8` でコミット分割が正しいこと
