#!/bin/bash
# typecheck.sh - TypeScriptファイル編集後に型チェック（編集ファイルのみ）

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# TypeScriptファイルのみ対象
if [[ ! "$file_path" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# 該当ファイルのエラーのみ抽出（ファイルパスで始まる行のみ）
# tscの出力形式: "path/to/file.ts(line,col): error TS..."
errors=$(npx tsc --noEmit 2>&1 | grep "^${file_path}(" | head -10)

if [ -n "$errors" ]; then
  echo "" >&2
  echo "⚠️  型エラーが検出されました" >&2
  echo "   ファイル: $file_path" >&2
  echo "" >&2
  echo "$errors" | while read -r line; do
    echo "   $line" >&2
  done
  echo "" >&2

  # エラー数をカウント
  error_count=$(echo "$errors" | wc -l | tr -d ' ')
  echo "{\"decision\":\"approve\",\"systemMessage\":\"⚠️ 型エラーが${error_count}件検出されました。修正を検討してください。\"}"
fi

exit 0
