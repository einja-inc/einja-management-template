# Plan: CLAUDE.md Planレビュー記述の明示化

## Context

CLAUDE.mdのPlanモードフロー（ステップ6.5）で、Planレビューの記述が簡素すぎる。
実装レビュー（99-1）ではレビュアーとcodex-agentの並行実行が明記されているが、Planレビューでは`einja-review-plan` Skillを呼ぶとしか書かれていない。
`einja-review-plan` Skill自体は既にレビュアー + codex-agent並行実行に対応しているため、CLAUDE.mdの記述を実態に合わせて明示化する。

## 現状

ステップ6.5:
```
6.5. planファイルのレビューを実施する
   - `einja-review-plan` Skillを呼び出す
   - MAJOR判定時は親エージェントがplan修正→再レビュー（最大2回）。解消しない場合はレビュー結果付記でExitPlanMode
   - スキップ条件: 軽微な変更（1ファイル・10行以下）またはユーザー明示スキップ
```

99-1（参考: 実装レビューの書き方）:
```
| 99-1 | コードレビュー [`einja-review-code` + `codex-agent`] | `einja-review-code` Skill（MAJOR → 修正→再レビュー）。Codex MCP有効時は `codex-agent` も並列実行。差分確認（`git diff --stat`）もここで実施 |
```

## 変更内容

**対象ファイル**: `CLAUDE.md`

ステップ6.5の記述を、99-1と同様にレビュアー + codex-agentの並行実行を明示する形に修正:

```
6.5. planファイルのレビューを実施する [`einja-review-plan` + `codex-agent`]
   - `einja-review-plan` Skillを呼び出す（レビューサブエージェント + codex-agent並行実行）
   - MAJOR判定時は親エージェントがplan修正→再レビュー（最大2回）。解消しない場合はレビュー結果付記でExitPlanMode
   - スキップ条件: 軽微な変更（1ファイル・10行以下）またはユーザー明示スキップ
```

## タスク概要

| # | 内容 |
|---|------|
| 0 | Planファイルを `docs/plans/202603/20260313-plan-review-description.plan.md` にリネーム |
| 1 | CLAUDE.md ステップ6.5の記述修正 [Edit] |
| 99-3 | コミット・プッシュ [`einja-task-commit`] |

## 並列実行計画

全タスクが順次依存のため並列なし。

## リスク・不明点

なし。1行の記述修正のみ。

## 検証・動作確認方法

- CLAUDE.mdの差分確認（`git diff`）
