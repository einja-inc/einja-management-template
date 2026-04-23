#!/bin/bash
# plan-review-gate.sh - ExitPlanMode前にeinja-review-plan実施済みマーカーを強制する
#
# PreToolUse hookとして設定する。Planモードの通常会話やStopはブロックせず、
# ユーザー承認に提出するExitPlanModeだけをゲートする。

set -uo pipefail

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null)

# 入力が壊れている場合はhook自体の事故を避けるため許可する。
if [[ -z "$tool_name" ]]; then
  exit 0
fi

if [[ "$tool_name" != "ExitPlanMode" ]]; then
  exit 0
fi

plan_text=$(echo "$input" | jq -r '
  .tool_input as $toolInput
  | (
      $toolInput.plan
      // $toolInput.content
      // $toolInput
      // ""
    )
  | if type == "string" then . else tostring end
' 2>/dev/null)

if [[ -z "$plan_text" || "$plan_text" == "null" ]]; then
  echo '{"decision":"block","reason":"ExitPlanModeのplan本文を確認できません","systemMessage":"⚠️ ExitPlanMode前に einja-review-plan のレビュー結果マーカーをplan本文へ追加してください。\n\n許可されるマーカー:\n- <!-- einja-plan-review: PASS -->\n- <!-- einja-plan-review: MINOR fixed -->\n- <!-- einja-plan-review: SKIPPED user-explicit -->\n\nユーザーが明示的にレビュー不要と指示した場合のみ SKIPPED を使用できます。"}'
  exit 2
fi

if printf '%s' "$plan_text" | grep -Eq '<!--[[:space:]]*einja-plan-review:[[:space:]]*(PASS|MINOR fixed|SKIPPED user-explicit)[[:space:]]*-->'; then
  exit 0
fi

echo '{"decision":"block","reason":"einja-review-plan未実施またはレビュー結果マーカー未記載","systemMessage":"⚠️ ExitPlanMode前に einja-review-plan による計画レビューを実施し、plan本文の末尾へ結果マーカーを追加してください。\n\n許可されるマーカー:\n- <!-- einja-plan-review: PASS -->\n- <!-- einja-plan-review: MINOR fixed -->\n- <!-- einja-plan-review: SKIPPED user-explicit -->\n\nMINOR は指摘をplanへ反映した後に `MINOR fixed` を付けてください。MAJOR は修正して再レビューしてください。ユーザーが明示的にレビュー不要と指示した場合のみ `SKIPPED user-explicit` を使用できます。"}'
exit 2
