#!/bin/bash
# biome-check.sh - ファイル保存後にbiome check（format + lint）を実行するhook

# stdinからJSON入力を読み取る
input=$(cat)

# ファイルパスを抽出
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# ファイルパスが存在しない場合は終了
if [ -z "$file_path" ]; then
  exit 0
fi

# biome対象の拡張子かチェック (.ts, .tsx, .js, .jsx, .json)
if [[ "$file_path" =~ \.(ts|tsx|js|jsx|json)$ ]]; then
  # プロジェクトルートに移動してbiomeを実行
  cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

  # biome check（format + lint）を実行、自動修正可能なものは修正
  npx biome check --write "$file_path" 2>/dev/null || true

  # 修正後に残っているlintエラーをチェック（any型など自動修正できないもの）
  lint_errors=$(npx biome lint "$file_path" 2>&1 | grep -E "lint/|noExplicitAny|error" | head -20)

  if [ -n "$lint_errors" ]; then
    echo "" >&2
    echo "⚠️  Biome lintエラーが検出されました" >&2
    echo "   ファイル: $file_path" >&2
    echo "" >&2
    echo "$lint_errors" | while read -r line; do
      echo "   $line" >&2
    done
    echo "" >&2

    # エラー詳細をエスケープしてsystemMessageに含める
    escaped_errors=$(echo "$lint_errors" | sed 's/"/\\"/g' | tr '\n' ' ' | head -c 500)

    # any型が含まれているかチェック
    if echo "$lint_errors" | grep -q "noExplicitAny"; then
      echo "{\"decision\":\"approve\",\"systemMessage\":\"⚠️ any型が検出されました。any型は禁止です。適切な型を指定してください。\\n詳細: ${escaped_errors}\"}"
    else
      echo "{\"decision\":\"approve\",\"systemMessage\":\"⚠️ Biome lintエラーが検出されました。修正を検討してください。\\n詳細: ${escaped_errors}\"}"
    fi
    exit 0
  fi
fi

exit 0
