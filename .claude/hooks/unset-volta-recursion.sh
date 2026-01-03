#!/bin/bash
# Bash実行前に_VOLTA_TOOL_RECURSIONを無効化する
# Claude Code環境でVoltaが正しく動作しない問題への対処
#
# PreToolUseのenvフィールドはサポートされていないため、
# updatedInputでコマンド自体を修正する

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Bashツール以外は無視
if [[ ! "$tool_name" =~ ^Bash ]]; then
	exit 0
fi

# 元のコマンドを取得
original_command=$(echo "$input" | jq -r '.tool_input.command // empty')

# コマンドの先頭にunsetを追加
# jqでJSON安全にエスケープ
updated_command="unset _VOLTA_TOOL_RECURSION && $original_command"

# updatedInputでコマンドを変更
jq -n --arg cmd "$updated_command" '{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": $cmd
    }
  }
}'
