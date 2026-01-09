#!/bin/bash
# design-doc-check.sh - 設計書への実装コード混入検出

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

if [ -z "$file_path" ] || [ -z "$content" ]; then
  exit 0
fi

# docs/specs/配下のmarkdownファイルのみ対象
if [[ ! "$file_path" =~ docs/specs/.*\.md$ ]]; then
  exit 0
fi

# 実装コードパターンの検出
code_found=""

# 関数実装（アロー関数、function宣言）
if echo "$content" | grep -qE '(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*\{'; then
  code_found="${code_found}\n  - アロー関数の実装"
fi

if echo "$content" | grep -qE 'function\s+\w+\s*\([^)]*\)\s*\{[^}]+\}'; then
  code_found="${code_found}\n  - function実装"
fi

# if/for/while等の制御構文（コードブロック外）
# マークダウンのコードブロック内は許容するが、実際のロジックは警告
if echo "$content" | grep -qE '^\s*(if|for|while|switch)\s*\([^)]+\)\s*\{'; then
  code_found="${code_found}\n  - 制御構文の実装"
fi

# try-catch実装
if echo "$content" | grep -qE 'try\s*\{[^}]+\}\s*catch'; then
  code_found="${code_found}\n  - try-catch実装"
fi

# 具体的なビジネスロジック（計算、データ変換等）
if echo "$content" | grep -qE '\.(map|filter|reduce|forEach)\s*\(\s*(async\s*)?\([^)]*\)\s*=>\s*\{[^}]{50,}\}'; then
  code_found="${code_found}\n  - 配列操作の詳細実装"
fi

if [ -n "$code_found" ]; then
  echo "" >&2
  echo "⚠️  警告: 設計書に実装コードが含まれています" >&2
  echo "   ファイル: $file_path" >&2
  echo -e "   検出内容:$code_found" >&2
  echo "" >&2
  echo "   設計書には以下のみ記載してください:" >&2
  echo "   ✅ Class名、関数名、引数型、返却型" >&2
  echo "   ✅ 使用ライブラリの仕様" >&2
  echo "   ✅ アーキテクチャ図、構造図" >&2
  echo "   ❌ 具体的なロジックを含む実装コード" >&2
  echo "" >&2

  echo "{\"decision\":\"approve\",\"systemMessage\":\"⚠️ 設計書に実装コードが含まれています。設計と実装は分離してください。\"}"
fi

exit 0
