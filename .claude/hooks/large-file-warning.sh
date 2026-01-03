#!/bin/bash
# large-file-warning.sh - 大きすぎるファイルの警告

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

# コード系ファイルのみ対象
if [[ ! "$file_path" =~ \.(ts|tsx|js|jsx|py|go|rs|java|rb|php)$ ]]; then
  exit 0
fi

# 行数をカウント
line_count=0
if [ -n "$content" ]; then
  # Writeの場合はcontentから行数を取得
  line_count=$(echo "$content" | wc -l | tr -d ' ')
elif [ -f "$file_path" ]; then
  # Editの場合はファイルから行数を取得
  line_count=$(wc -l < "$file_path" | tr -d ' ')
fi

# 500行以上で警告
if [ "$line_count" -ge 500 ]; then
  echo "" >&2
  echo "⚠️  警告: ファイルが大きすぎます（${line_count}行）" >&2
  echo "   ファイル: $file_path" >&2
  echo "" >&2
  echo "   推奨事項:" >&2
  echo "   - 500行を超えるファイルは分割を検討してください" >&2
  echo "   - 関連する機能ごとにモジュール化を検討してください" >&2
  echo "   - ヘルパー関数は別ファイルに切り出すことを検討してください" >&2
  echo "" >&2

  echo "{\"decision\":\"approve\",\"systemMessage\":\"⚠️ ファイルが${line_count}行あります。分割を検討してください。\"}"
fi

exit 0
