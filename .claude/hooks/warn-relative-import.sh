#!/bin/bash
# warn-relative-import.sh - 相対パスimportを検出して警告するhook

# stdinからJSON入力を読み取る
input=$(cat)

# ファイルパスを抽出
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# ファイルが存在しない場合は終了
if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# TypeScript/JavaScript/TSX/JSXファイルのみチェック
if [[ ! "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# テストファイルは除外（テストでは相対パスが許容される場合がある）
if [[ "$file_path" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# 相対パスimportを検出（from './...' または from '../...'）
relative_imports=$(grep -nE "from ['\"]\.\.?/" "$file_path" 2>/dev/null || true)

if [ -n "$relative_imports" ]; then
  # 警告メッセージを出力
  echo "" >&2
  echo "Warning: Relative path import detected" >&2
  echo "   File: $file_path" >&2
  echo "" >&2
  echo "   Detected imports:" >&2
  echo "$relative_imports" | while read -r line; do
    echo "   $line" >&2
  done
  echo "" >&2
  echo "   Use alias paths (@/, @repo/) instead of relative paths (./,../)." >&2
  echo "   Example: import { Button } from \"@repo/ui/components/button\"" >&2
  echo "" >&2

  # JSON出力で警告をClaudeに伝える（ブロックはしない）
  echo '{"decision":"approve","systemMessage":"Warning: Relative path import detected. Use alias paths (@/, @repo/) instead of relative paths (./,../)."}'
  exit 0
fi

exit 0
