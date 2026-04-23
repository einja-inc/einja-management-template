#!/bin/bash
# plan-mode-skill-loader.sh - Plan mode中にeinja-skill-firstのリマインダーを注入
#
# UserPromptSubmit hookとして設定
# permission_mode == "plan" の場合に、軽量リマインダーをadditionalContextとして注入
# 毎回注入しても2-3行なのでコスト無視可能。状態管理不要。

set -uo pipefail

input=$(cat)

# permission_modeを取得
permission_mode=$(echo "$input" | jq -r '.permission_mode // empty')

# Plan mode以外はスキップ
if [[ "$permission_mode" != "plan" ]]; then
  exit 0
fi

# 軽量リマインダーを注入
# UserPromptSubmit の additionalContext は hookSpecificOutput 内に配置する必要がある
jq -n '{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "【Plan mode自動リマインダー】計画作成前にeinja-skill-firstの評価を実施してください。.claude/skills/einja-skill-first/SKILL.mdを参照し、スキップ基準に該当しない場合はSkill作成の必要性を評価してください。ExitPlanMode前にはeinja-review-planを実行し、plan本文末尾に <!-- einja-plan-review: PASS --> / <!-- einja-plan-review: MINOR fixed --> / <!-- einja-plan-review: SKIPPED user-explicit --> のいずれかを追加してください。"
  }
}'
