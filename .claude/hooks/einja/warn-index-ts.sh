#!/bin/bash
# warn-index-ts.sh - index.tsファイル作成時に警告を出すhook

# stdinからJSON入力を読み取る
input=$(cat)

# ツール名とファイルパスを抽出
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Writeツールでindex.tsが作成された場合のみ警告
if [ "$tool_name" = "Write" ]; then
  filename=$(basename "$file_path" 2>/dev/null)

  if [ "$filename" = "index.ts" ]; then
    # 警告メッセージを出力（stderrに出力してClaude Codeに表示）
    echo "" >&2
    echo "⚠️  警告: index.ts ファイルが作成されました" >&2
    echo "   ファイル: $file_path" >&2
    echo "" >&2
    echo "   index.ts は原則作成禁止です。" >&2
    echo "   以下の理由から、明示的なファイル名の使用を推奨します：" >&2
    echo "   - import文の可読性向上" >&2
    echo "   - ファイル検索の容易さ" >&2
    echo "   - 循環参照の回避" >&2
    echo "" >&2

    # JSON出力で警告をClaudeに伝える（ブロックはしない）
    echo '{"decision":"approve","systemMessage":"⚠️ index.ts ファイルが作成されました。index.ts は原則作成禁止です。明示的なファイル名に変更することを検討してください。"}'
    exit 0
  fi
fi

exit 0
