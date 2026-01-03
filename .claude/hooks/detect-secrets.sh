#!/bin/bash
# detect-secrets.sh - 機密情報の検出

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

if [ -z "$file_path" ] || [ -z "$content" ]; then
  exit 0
fi

# .envファイル自体は許可（ただし.env.exampleは除く）
if [[ "$file_path" =~ \.env$ ]] && [[ ! "$file_path" =~ \.example$ ]]; then
  exit 0
fi

# 機密情報パターンの検出
secrets_found=""

# APIキー・トークンパターン
if echo "$content" | grep -qiE '(api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*["\047][a-zA-Z0-9_\-]{20,}["\047]'; then
  secrets_found="${secrets_found}\n  - APIキー/トークンのハードコード"
fi

# AWSキーパターン
if echo "$content" | grep -qE 'AKIA[0-9A-Z]{16}'; then
  secrets_found="${secrets_found}\n  - AWS Access Key ID"
fi

# パスワードパターン
if echo "$content" | grep -qiE '(password|passwd|pwd)\s*[:=]\s*["\047][^"\047]{8,}["\047]'; then
  secrets_found="${secrets_found}\n  - パスワードのハードコード"
fi

# 秘密鍵パターン
if echo "$content" | grep -qE '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'; then
  secrets_found="${secrets_found}\n  - 秘密鍵"
fi

# JWTシークレット
if echo "$content" | grep -qiE 'jwt[_-]?secret\s*[:=]\s*["\047][^"\047]{16,}["\047]'; then
  secrets_found="${secrets_found}\n  - JWTシークレット"
fi

# データベース接続文字列
if echo "$content" | grep -qiE '(mongodb|postgres|mysql|redis)://[^"\047\s]+:[^"\047\s]+@'; then
  secrets_found="${secrets_found}\n  - データベース接続文字列（認証情報含む）"
fi

if [ -n "$secrets_found" ]; then
  echo "" >&2
  echo "🚨 警告: 機密情報が検出されました" >&2
  echo "   ファイル: $file_path" >&2
  echo -e "   検出内容:$secrets_found" >&2
  echo "" >&2
  echo "   環境変数または.envファイルの使用を検討してください" >&2
  echo "" >&2

  echo "{\"decision\":\"approve\",\"systemMessage\":\"🚨 機密情報が検出されました。環境変数の使用を検討してください。\"}"
fi

exit 0
