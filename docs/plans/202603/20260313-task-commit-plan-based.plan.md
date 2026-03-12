# Plan: einja-task-commit SkillのPlanファイルベースコミット分割改善

## Context

einja-task-commitのコミット分割判定で、呼び出し元がどのPlanファイルの変更をコミットするか明示して呼ぶのが基本動作となるよう改善する。現状はステップ3で毎回AskUserQuestionで分割案を確認しているが、Plan指定があれば確認不要にする。

## 現状

- ステップ3「コミット分割方針の決定」で、Plan単位の分割ロジックはあるが、呼び出し元からのPlan指定を受け取る仕組みがない
- 毎回AskUserQuestionでコミット分割案の承認を求めている

## 変更内容

対象ファイル: `.claude/skills/einja-task-commit/SKILL.md`

### ステップ3の修正

1. **Plan指定パラメータの追加**: 呼び出し元がPlanファイルパスを明示できることをSkill冒頭に記載
2. **分割判定フローの変更**:
   - Plan指定あり → そのPlanに関連する変更のみをコミット対象とし、Plan選択のAskUserQuestion不要
   - Plan指定なし＋完了Plan1つ → 自動でそのPlanを使用
   - Plan指定なし＋完了Plan複数 → AskUserQuestionでどのPlanをコミットするか確認
   - Plan指定なし＋Planなし → 従来の通常分割基準で判定
3. **AskUserQuestion（Plan選択）**: Plan指定なし＋複数Plan時のみ使用。選択肢:
   - 「すべてのPlanを含める」
   - 各Planファイル名を個別選択肢（multiSelect）
   - 「Other」（自動付与）で自由入力
4. **コミット分割案の提示**: 含めるPlanが決定後、Plan単位でコミットを分ける前提で、各Plan内でさらに分割が必要か検討し、最終的なコミット分割案をAskUserQuestionで提示する

## タスク概要

| # | 内容 |
|---|------|
| 0 | Planファイルを `docs/plans/202603/20260313-task-commit-plan-based.plan.md` にリネーム |
| 1 | `einja-task-commit/SKILL.md` のステップ3を修正 [einja-skill-creator] |

## 並列実行計画

タスク1のみ。直列実行。

## リスク・不明点

なし。既存の呼び出し元（einja-task-exec等）はPlan指定なしで呼んでいるため、後方互換性あり。

## 検証・動作確認方法

- SKILL.mdの変更内容を目視確認
- 既存の呼び出し元（einja-task-exec SKILL.md等）に影響がないことを確認
