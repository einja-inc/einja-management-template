#!/bin/bash
# playwright-resize.sh - Playwright使用前にリサイズを強制するhook
# PreToolUseで実行され、リサイズ未実施ならブロックする

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Playwrightツール以外は無視
if [[ ! "$tool_name" =~ ^mcp__playwright__ ]]; then
  exit 0
fi

# browser_resize自体、browser_close、browser_installは許可
if [[ "$tool_name" == "mcp__playwright__browser_resize" ]] || \
   [[ "$tool_name" == "mcp__playwright__browser_close" ]] || \
   [[ "$tool_name" == "mcp__playwright__browser_install" ]]; then
  # リサイズ実行時にフラグファイルを作成
  if [[ "$tool_name" == "mcp__playwright__browser_resize" ]]; then
    mkdir -p /tmp/claude-hooks
    touch /tmp/claude-hooks/playwright-resized-$$
  fi
  exit 0
fi

# フラグファイルが存在するか確認（現在のセッションでリサイズ済み）
# セッションIDがないので、最近のフラグファイル（5分以内）をチェック
recent_flag=$(find /tmp/claude-hooks -name "playwright-resized-*" -mmin -5 2>/dev/null | head -1)

if [ -n "$recent_flag" ]; then
  # リサイズ済みなら許可
  exit 0
fi

# リサイズ未実施ならブロック
echo '{"decision":"block","reason":"Playwright使用前にブラウザサイズの設定が必要です","systemMessage":"⚠️ Playwrightを使用する前に、まず以下を実行してブラウザサイズを設定してください:\n\nmcp__playwright__browser_resize({ width: 1280, height: 720 })\n\nその後、再度操作を実行してください。"}'
exit 2
