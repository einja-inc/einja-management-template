# 内部スキルリネーム（`einja-*` → `_einja-*`）

## Context

ユーザーが直接呼び出さない内部専用Skillが `einja-*` プレフィックスで命名されている。命名規則に従い `_einja-*` にリネームして、ユーザー向けSkillとの区別を明確にする。

## 対象（4件）

| 現在 | リネーム後 | 理由 |
|------|----------|------|
| `einja-subagent-question-protocol` | `_einja-subagent-question-protocol` | autoloadプロトコル定義 |
| `einja-issue-spec-tasks-generator` | `_einja-issue-spec-tasks-generator` | issue-spec-create内部ワークフロー |
| `einja-issue-spec-tasks-validator` | `_einja-issue-spec-tasks-validator` | issue-spec-create内部ワークフロー |
| `einja-task-qa` | `_einja-task-qa` | task-exec内部パイプライン |

## 作業手順

### Step 1: ディレクトリリネーム（`git mv`）

```bash
git mv .claude/skills/einja-subagent-question-protocol .claude/skills/_einja-subagent-question-protocol
git mv .claude/skills/einja-issue-spec-tasks-generator .claude/skills/_einja-issue-spec-tasks-generator
git mv .claude/skills/einja-issue-spec-tasks-validator .claude/skills/_einja-issue-spec-tasks-validator
git mv .claude/skills/einja-task-qa .claude/skills/_einja-task-qa
```

### Step 2: SKILL.md内の `name` フィールド・project-private id更新

各SKILL.mdの以下を更新:
- frontmatter `name:` を `_einja-*` に変更
- `@einja:project-private:start id="..."` のidを `_einja-*` に変更（tasks-generator, tasks-validator, task-qa）

### Step 3: 参照元ファイルの更新

#### `_einja-subagent-question-protocol`（10ファイル）
- `.claude/agents/einja/task/task-reviewer.md` — skills preload
- `.claude/agents/einja/task/task-executer.md` — skills preload
- `.claude/agents/einja/backend-architect.md` — skills preload
- `.claude/agents/einja/frontend-architect.md` — skills preload
- `.claude/agents/einja/issue-specs/tasks-generator.md` — skills preload
- `.claude/agents/einja/issue-specs/qa-generator.md` — skills preload
- `.claude/agents/einja/issue-specs/requirements-generator.md` — skills preload
- `.claude/agents/einja/issue-specs/ui-design-generator.md` — skills preload
- `.claude/agents/einja/issue-specs/design-generator.md` — skills preload

#### `_einja-issue-spec-tasks-generator`（1ファイル）
- `.claude/agents/einja/issue-specs/tasks-generator.md` — Skillリンク・参照

#### `_einja-issue-spec-tasks-validator`（1ファイル・3箇所）
- `.claude/agents/einja/issue-specs/tasks-validator.md` — Skillリンク・参照（18行目、83行目、149行目のパス参照）

#### `_einja-task-qa`（1ファイル）
- `.claude/agents/einja/task/task-qa.md` — skills preload

### Step 4: `docs/plans/` 内の参照（スキップ）

過去のplanファイルは履歴記録であり更新不要。

## 検証

1. `grep -r "einja-subagent-question-protocol\|einja-issue-spec-tasks-generator\|einja-issue-spec-tasks-validator\|einja-task-qa" .claude/` で旧名の残存がないことを確認（`_einja-*` はOK）
2. `pnpm prepush` で lint/typecheck/test が通ることを確認
3. ビルド（`copy-presets.mjs`）が `_einja-*` プレフィックスを正しくコピー対象として認識することを確認
