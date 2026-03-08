# Plan: 進捗管理をTodoWrite → Task APIに移行 & フロー整理

## Context

1. CLAUDE.mdで `docs/plans/todo-{name}.md` によるファイルベースの進捗管理を規定しているが、遵守率が低い（90+プランに対しtodoは14件≒15%）
2. Claude Code v2.1.16でTask API（TaskCreate/TaskUpdate等）が標準化され、TodoWriteは事実上非推奨
3. Plan/非Planモードのフローが混在して記述されており、分離が必要

## 変更方針

### A. CLAUDE.md「必須フロー」をPlanモード/非Planモードで分離

**現状**: 単一の「必須フロー」でPlan/非Planを区別していない

**変更後**:

```
### 非Planモード時の判断フロー
- 新しいコード変更の指示 → Planモードを提案（「まずPlanモードで計画を立てましょうか？」）
- 質問への回答・情報調査 → そのまま対応（承認不要）
- 承認済み計画の継続実行・追加指示 → Task APIで進捗管理しながら実装を継続

### Planモード時の必須フロー
1. 問題・要件を調査・分析する
2. planファイル（自動生成）に計画を記述する
3. einja-skill-first で評価する
4. ExitPlanMode で承認を得る

### 実装フェーズ（承認後）
- Task API（TaskCreate/TaskUpdate）で進捗管理しながら実装を開始する
- TODO-0（Skill作成）がある場合はそこから
```

### B. TodoWrite → Task API 全面置換

- `docs/plans/todo-{name}.md` のファイルベース規約を削除
- 全agent/skill定義の `TodoWrite`/`TodoRead` 参照を `TaskCreate`/`TaskUpdate` に置換
- `settings.json` の `TodoWrite(*)` 許可を更新

### C. 計画・進捗ファイルの規約テーブル簡素化

**現状**:
| Plan | `docs/plans/{name}.md` | 親エージェント |
| Todo | `docs/plans/todo-{name}.md` | 親エージェントのみ |

**変更後**:
| Plan | `docs/plans/{name}.md`（Planモード時に自動生成） | 親エージェント |
| 進捗 | Task API（TaskCreate/TaskUpdate） | 親エージェント |

## 変更対象ファイル

### 1. CLAUDE.md
- L65-76: 「必須フロー」→ Planモード/非Planモード分離
- L86-91: 「計画・進捗ファイルの規約」テーブル更新

### 2. Agent定義（5ファイル）
- `.claude/agents/einja/task/task-executer.md` L31
- `.claude/agents/einja/task/task-reviewer.md` L14
- `.claude/agents/einja/task/task-modification-analyzer.md` L22
- `.claude/agents/einja/issue-specs/qa-generator.md` L4,L24
- `.claude/agents/einja/issue-specs/requirements-generator.md` L4,L17
- `.claude/agents/einja/issue-specs/design-generator.md` L4,L65
- `.claude/agents/einja/issue-specs/ui-design-generator.md` L4,L18
- `.claude/agents/einja/issue-specs/tasks-generator.md` L47

### 3. Skill定義（4ファイル）
- `.claude/skills/npm-release/SKILL.md` L11
- `.claude/skills/einja-task-commit/SKILL.md` L10
- `.claude/skills/_einja-task-qa/SKILL.md` L44
- `.claude/skills/einja-issue-spec-create/SKILL.md` L7

### 4. settings.json
- `.claude/settings.json` L48: `TodoWrite(*)` → 削除 or Task API許可に変更

## 変更しないもの

- 既存の `docs/plans/todo-*.md` ファイル（過去の記録として残す）
- Planモードの5フェーズワークフロー自体（system prompt管理）

## 実装ステップ

1. **CLAUDE.md更新**: フロー分離 + 進捗管理規約をTask APIに変更
2. **Agent定義一括更新**: TodoWrite参照をTask API参照に置換（並列実行可）
3. **Skill定義一括更新**: 同上（並列実行可）
4. **settings.json更新**: 許可設定の更新

## 検証

- `grep -r "TodoWrite\|TodoRead" .claude/` で残留参照がないことを確認
- `pnpm prepush` パス確認
