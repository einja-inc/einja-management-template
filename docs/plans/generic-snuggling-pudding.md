# Plan: conflict-resolver サブエージェント廃止 → Skill一本化

## Context

`conflict-resolver` はサブエージェント定義（`.claude/agents/`）とSkill定義（`.claude/skills/`）の2重構造になっている。
サブエージェント経由では `AskUserQuestion` が使えないため、コンフリクト解消の核心機能（1ファイルずつユーザー確認）が動作しない。
Skill単体で親エージェントが直接実行すれば `AskUserQuestion` が正常に動作するため、サブエージェント定義を廃止してSkill一本化する。

## 変更内容

### TODO-1: エージェント定義の削除

**削除ファイル:**
- `.claude/agents/einja/git/conflict-resolver.md`

### TODO-2: CLAUDE.md の参照更新

**ファイル:** `CLAUDE.md`

- **行29**: サブエージェント委託テーブルから `コンフリクト解消 → conflict-resolver` の行を削除
- **行41**: Skill テーブルの `einja-conflict-resolver` はそのまま維持
- **行92**: `gitコンフリクト発生時の対応` セクションもそのまま維持（既にSkillを参照している）

### TODO-3: einja-task-commit Skill の参照更新

**ファイル:** `.claude/skills/einja-task-commit/SKILL.md`

- **行52**: `conflict-resolver エージェント を Task ツールで呼び出して解消` → `einja-conflict-resolver Skill の手順に従って解消`
- **行256**: `conflict-resolver エージェントを Task ツールで呼び出して解消を試行` → `einja-conflict-resolver Skill の手順に従って解消を試行`

### TODO-4: issue-exec コマンドの参照更新

**ファイル:** `.claude/commands/einja/issue-exec.md`

- **行349**: `conflict-resolverで自力解消` → `einja-conflict-resolver Skillで自力解消`

### TODO-5: .einja-sync.json のエントリ削除

**ファイル:** `.einja-sync.json`

- agent定義のsyncエントリ（`.claude/agents/einja/git/conflict-resolver.md`）を削除

### 変更不要（参照のみ・読み取り専用）

| ファイル | 理由 |
|---------|------|
| `docs/einja/steering/branch-strategy.md` | マネージドディレクトリ（読み取り専用）※ただしこのリポジトリでは編集可。"conflict-resolver で解消"は曖昧でSkillを指すとも読めるため変更不要 |
| `docs/einja/instructions/issue-exec-workflow.md` | 同上 |
| `docs/plans/*.md` | 過去のPlan。履歴として変更不要 |
| `.claude/commands/einja/einja-sync.md` | "einja-conflict-resolver Skill は使用しない"の記述。変更不要 |
| `.claude/skills/einja-conflict-resolver/SKILL.md` | Skill本体。変更不要 |

## 検証

1. `grep -r "conflict-resolver" .claude/agents/` でエージェント定義が残っていないことを確認
2. `grep -r "conflict-resolver.*エージェント.*Task" .claude/ CLAUDE.md` でサブエージェント呼び出し記述が残っていないことを確認
3. `pnpm prepush` でlint/typecheck/testが通ることを確認
