# task-spec → issue-spec リネーム + コマンド→Skill移行

## Context

現在の仕様書関連の命名（`spec-create`, `task-spec-*`, `agents/specs/`）はIssue単位で仕様書を作成するという実態と乖離している。`issue-spec` に統一することで意味的な明確さを向上させる。同時に、`spec-create` と `task-exec` をコマンドからSkillへ移行し、呼び出し方法を統一する。

## リネーム対応表

### ファイル移動・リネーム

| Before | After |
|--------|-------|
| `.claude/commands/einja/spec-create.md` | `.claude/skills/einja-issue-spec-create/SKILL.md` |
| `.claude/commands/einja/task-exec.md` | `.claude/skills/einja-task-exec/SKILL.md` |
| `.claude/commands/einja/update-docs-by-task-specs.md` | `.claude/commands/einja/update-docs-by-issue-specs.md` |
| `.claude/skills/einja-task-spec-generator/` | `.claude/skills/einja-issue-spec-generator/` |
| `.claude/skills/einja-task-spec-validator/` | `.claude/skills/einja-issue-spec-validator/` |
| `.claude/agents/einja/specs/` | `.claude/agents/einja/issue-specs/` |

### エージェントファイルリネーム（`issue-specs/` 内）

ディレクトリ名 `issue-specs/` でスコープを担保し、ファイル名は短縮。

| Before | After |
|--------|-------|
| `spec-requirements-generator.md` | `requirements-generator.md` |
| `spec-design-generator.md` | `design-generator.md` |
| `spec-qa-generator.md` | `qa-generator.md` |
| `spec-tasks-generator.md` | `tasks-generator.md` |
| `spec-tasks-validator.md` | `tasks-validator.md` |

### 呼び出し方法の変更

| Before | After |
|--------|-------|
| `/einja:spec-create <args>` | Skill tool `einja-issue-spec-create` |
| `/einja:task-exec <args>` | Skill tool `einja-task-exec` |
| `/einja:update-docs-by-task-specs <args>` | `/einja:update-docs-by-issue-specs <args>` |

## 実装計画

### Phase 1: ファイル移動・作成（並列実行可能）

**TG-1.1: エージェントディレクトリ移動+ファイルリネーム**
- `git mv .claude/agents/einja/specs/ .claude/agents/einja/issue-specs/`
- 各ファイルを `git mv` で短縮名にリネーム（`spec-X-generator` → `X-generator`）
- 対象: 5ファイル

**TG-1.2: スキルディレクトリリネーム**
- `git mv .claude/skills/einja-task-spec-generator/ .claude/skills/einja-issue-spec-generator/`
- `git mv .claude/skills/einja-task-spec-validator/ .claude/skills/einja-issue-spec-validator/`
- 対象: 4ファイル（SKILL.md × 2 + references/ × 2）

**TG-1.3: spec-create → einja-issue-spec-create Skill移行**
- `.claude/skills/einja-issue-spec-create/SKILL.md` を新規作成（spec-create.mdの内容を移行）
- 旧 `.claude/commands/einja/spec-create.md` を削除
- 内部のエージェントパス参照を `../../agents/einja/issue-specs/{短縮名}` に更新

**TG-1.4: task-exec → einja-task-exec Skill移行**
- `.claude/skills/einja-task-exec/SKILL.md` を新規作成（task-exec.mdの内容を移行）
- 旧 `.claude/commands/einja/task-exec.md` を削除

**TG-1.5: update-docs-by-task-specs リネーム**
- `git mv` でファイルリネーム → `update-docs-by-issue-specs.md`
- 内部テキストの `task-specs` → `issue-specs` 更新

### Phase 2: 参照更新（Phase 1完了後、並列実行可能）

**TG-2.1: エージェント内部参照更新**（10ファイル）

| ファイル | 更新内容 |
|---------|---------|
| `.claude/agents/einja/issue-specs/tasks-generator.md` | Skillリンク `../../skills/einja-task-spec-generator/` → `../../skills/einja-issue-spec-generator/`、`spec-create` → `einja-issue-spec-create` |
| `.claude/agents/einja/issue-specs/tasks-validator.md` | Skillリンク `../../skills/einja-task-spec-validator/` → `../../skills/einja-issue-spec-validator/`、`spec-create` → `einja-issue-spec-create` |
| `.claude/agents/einja/issue-specs/requirements-generator.md` | `name:` フィールド更新、内部テキストの旧名参照 |
| `.claude/agents/einja/issue-specs/design-generator.md` | 同上 |
| `.claude/agents/einja/issue-specs/qa-generator.md` | 同上 |
| `.claude/agents/einja/task/task-executer.md` | `/einja:spec-create` → `einja-issue-spec-create`、task-exec コマンド→Skill 文言更新 |
| `.claude/agents/einja/task/task-reviewer.md` | `task-exec` コマンド参照更新 |
| `.claude/agents/einja/task/task-modification-analyzer.md` | `task-exec` コマンド参照更新 |
| `.claude/agents/einja/task/task-qa.md` | `task-exec` 参照更新 |
| `.claude/agents/einja/docs/docs-updater.md` | `update-docs-by-task-specs` → `update-docs-by-issue-specs` |

**TG-2.2: スキル内部参照更新**（8ファイル）

| ファイル | 更新内容 |
|---------|---------|
| `.claude/skills/einja-issue-spec-generator/SKILL.md` | タイトル・内部テキスト: `task-spec-generator` → `issue-spec-generator`、エージェント名更新、相対パス `specs/` → `issue-specs/` 更新 |
| `.claude/skills/einja-issue-spec-validator/SKILL.md` | タイトル・内部テキスト: `task-spec-validator` → `issue-spec-validator`、エージェント名更新、相対パス `specs/` → `issue-specs/` 更新 |
| `.claude/skills/einja-task-qa/SKILL.md` | `spec-qa-generator` → `qa-generator`、`task-exec` コマンド→Skill文言 |
| `.claude/skills/einja-task-qa/references/troubleshooting.md` | `spec-requirements-generator` → `requirements-generator` |
| `.claude/skills/einja-task-qa/references/usage-patterns.md` | `task-exec` 使用例テキスト更新 |
| `.claude/skills/einja-task-commit/SKILL.md` | `task-exec` コマンド→Skill文言更新 |
| `.claude/skills/einja-general-context-loader/SKILL.md` | `/einja:spec-create` → `einja-issue-spec-create` |
| `.claude/skills/einja-spec-context-loader/SKILL.md` | `/einja:spec-create` → `einja-issue-spec-create`（4箇所） |
| `.claude/skills/einja-skill-first/SKILL.md` | `spec-create` → `einja-issue-spec-create`（3箇所） |

**TG-2.3: コマンド/設定ファイル参照更新**（4ファイル）

| ファイル | 更新内容 |
|---------|---------|
| `.claude/commands/einja/issue-exec.md` | `/einja:task-exec` → `einja-task-exec` Skill（3箇所: 行103, 206, 394） |
| `.claude/commands/einja/sync-cursor-commands.md` | 変換元パスを Skill パスに更新、エージェントパス `agents/specs/` → `agents/issue-specs/`、エージェント名短縮 |
| `.claude/commands/einja/update-docs-by-issue-specs.md` | 内部テキスト更新 |
| `.einja-sync.json` | `update-docs-by-task-specs.md` → `update-docs-by-issue-specs.md`（※他のリネーム対象は未登録のため変更不要） |

**TG-2.4: docs/einja/ 参照更新**（5-6ファイル）

| ファイル | 更新内容 |
|---------|---------|
| `docs/einja/steering/development-workflow.md` | `/einja:spec-create` → `einja-issue-spec-create`、`/einja:task-exec` → `einja-task-exec`（多数） |
| `docs/einja/steering/task-management.md` | spec-create、task-exec、update-docs-by-task-specs 参照更新 |
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | spec-create 参照更新 |
| `docs/einja/instructions/task-execute.md` | spec-create、task-exec、エージェント名参照（多数） |
| `docs/einja/instructions/issue-exec-workflow.md` | spec-create、task-exec 参照更新 |

**TG-2.5: CLAUDE.md + README.md 更新**

| ファイル | 更新箇所 | Before → After |
|---------|---------|---------------|
| `CLAUDE.md` | Skill/コマンドテーブル | `einja:spec-create` → `einja-issue-spec-create` |
| `CLAUDE.md` | Skill/コマンドテーブル | `einja:task-exec` → `einja-task-exec` |
| `CLAUDE.md` | Skill/コマンドテーブル | `einja:update-docs-by-task-specs` → `einja:update-docs-by-issue-specs` |
| `CLAUDE.md` | サブエージェント一覧 | `spec-requirements-generator` → `requirements-generator` 等（短縮名） |
| `README.md` | 行60 | `/einja:spec-create` → `einja-issue-spec-create`、`/einja:task-exec` → `einja-task-exec` |

### Phase 3: 検証

**TG-3.1: 参照整合性チェック**

除外対象: `.bak/`, `.cursor/`, `.einja-sync-backups/`, `docs/specs/issues/`（履歴エビデンス）, `docs/plans/`（作業記録）

```bash
# 旧パス残存チェック
grep -r "agents/einja/specs/" --include='*.md' --include='*.json' | grep -v '.bak/' | grep -v '.cursor/' | grep -v '.einja-sync-backups/' | grep -v 'docs/specs/' | grep -v 'docs/plans/'
grep -r "agents/specs/" --include='*.md' --include='*.json' | grep -v '.bak/' | grep -v '.cursor/' | grep -v '.einja-sync-backups/' | grep -v 'docs/specs/' | grep -v 'docs/plans/'

# 旧Skill名残存チェック
grep -r "task-spec-generator\|task-spec-validator" --include='*.md' --include='*.json' | grep -v '.bak/' | grep -v 'docs/plans/'

# 旧コマンド呼び出し残存チェック
grep -r "/einja:spec-create\|/einja:task-exec" --include='*.md' | grep -v '.bak/' | grep -v '.cursor/' | grep -v 'docs/plans/'

# 旧コマンド名残存チェック
grep -r "update-docs-by-task-specs" --include='*.md' --include='*.json' | grep -v '.bak/' | grep -v 'docs/plans/'

# 旧エージェント名残存チェック
grep -r "spec-requirements-generator\|spec-design-generator\|spec-qa-generator\|spec-tasks-generator\|spec-tasks-validator" --include='*.md' --include='*.json' | grep -v '.bak/' | grep -v '.cursor/' | grep -v 'issue-specs/' | grep -v 'docs/specs/' | grep -v 'docs/plans/'
```

**TG-3.2: ビルド・テスト・クリーンアップ**
- `pnpm prepush` 通過確認
- `git diff --stat` で変更ファイル一覧確認
- `.cursor/commands/` 配下の旧ファイル（`spec-create.md`, `task-exec.md`, `update-docs-by-task-specs.md`）を手動削除
- `sync-cursor-commands` を実行してCursorルール再生成確認

## リスク・注意事項

1. **task-exec vs task-executer の混同**: `task-exec` は移行対象だが `task-executer` はエージェント名でリネーム対象外。置換時に `/einja:task-exec` や `task-exec コマンド` のみ対象とし、`task-executer` は除外する正規表現が必須
2. **参照箇所の膨大さ**: 約50-55ファイル。Phase 3 の grep 検証でゼロ残存を確認してからコミット
3. **`.einja-sync.json`**: `update-docs-by-task-specs.md` のみ登録あり（他のリネーム対象は未登録なので変更は1エントリのみ）
4. **settings.json に customAgents セクションなし**: エージェント名はファイル名ベースで自動解決されるため、ファイルリネームのみで有効
5. **エージェント name: フィールド**: 各エージェント定義の frontmatter `name:` を短縮名に更新必要
6. **Cursor互換**: `sync-cursor-commands.md` の変換元パスを更新し、移行後に再生成を実行

## 対象ファイル総数（確定）

- 移動/リネーム: 約15ファイル
- 参照更新: 約35-40ファイル
- 合計: 約50-55ファイル
