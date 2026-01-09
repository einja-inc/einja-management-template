#!/bin/bash
# validate-git-commit.sh - git commitコマンドのメッセージ形式を検証
#
# 目的:
# - git commit実行前にコミットメッセージの形式を検証
# - 不適切なメッセージ（---、Markdown形式等）をブロック
# - コミットルール（docs/einja/steering/commit-rules.md）に準拠を強制
#
# 使用方法:
# - PreToolUse hookとして設定
# - exit code 0: 許可
# - exit code 2: ブロック（stderrがClaudeに送信される）

set -uo pipefail

# 標準入力からJSON入力を読み取る
input=$(cat)

# ツール名を取得
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Bashツール以外は無視
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

# コマンドを取得
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# git commitコマンドでない場合はスキップ（volta unset対応で部分マッチ）
if [[ ! "$command" =~ git[[:space:]]+commit ]]; then
  exit 0
fi

# --amend のみの場合はスキップ（メッセージ変更なし）
# -m / --message がない場合のみスキップ
if [[ "$command" =~ --amend ]]; then
  if [[ ! "$command" =~ -m ]] && [[ ! "$command" =~ --message ]]; then
    exit 0
  fi
fi

# -m / --message オプションがない場合はスキップ（インタラクティブエディタ使用）
if [[ ! "$command" =~ -m ]] && [[ ! "$command" =~ --message ]]; then
  exit 0
fi

# コミットメッセージを抽出
commit_message=""

# パターン1: -m "message" / -m 'message' （スペースあり）
if [[ "$command" =~ -m[[:space:]]+\"([^\"]+)\" ]]; then
  commit_message="${BASH_REMATCH[1]}"
elif [[ "$command" =~ -m[[:space:]]+\'([^\']+)\' ]]; then
  commit_message="${BASH_REMATCH[1]}"
# パターン2: -m"message" / -m'message' （スペースなし）
elif [[ "$command" =~ -m\"([^\"]+)\" ]]; then
  commit_message="${BASH_REMATCH[1]}"
elif [[ "$command" =~ -m\'([^\']+)\' ]]; then
  commit_message="${BASH_REMATCH[1]}"
# パターン3: --message="message" / --message='message'
elif [[ "$command" =~ --message=\"([^\"]+)\" ]]; then
  commit_message="${BASH_REMATCH[1]}"
elif [[ "$command" =~ --message=\'([^\']+)\' ]]; then
  commit_message="${BASH_REMATCH[1]}"
# パターン4: --message "message" / --message 'message' （スペースあり）
elif [[ "$command" =~ --message[[:space:]]+\"([^\"]+)\" ]]; then
  commit_message="${BASH_REMATCH[1]}"
elif [[ "$command" =~ --message[[:space:]]+\'([^\']+)\' ]]; then
  commit_message="${BASH_REMATCH[1]}"
# パターン5: -m="message" / -m='message'
elif [[ "$command" =~ -m=\"([^\"]+)\" ]]; then
  commit_message="${BASH_REMATCH[1]}"
elif [[ "$command" =~ -m=\'([^\']+)\' ]]; then
  commit_message="${BASH_REMATCH[1]}"
# パターン6: HEREDOC形式 -m "$(cat <<'EOF'...EOF)"
elif [[ "$command" =~ -m[[:space:]]*\"\$\(cat ]]; then
  # HEREDOCからメッセージの最初の行を抽出
  commit_message=$(echo "$command" | sed -n "/<<.*EOF/,/^EOF/p" | sed '1d;$d' | head -1)
fi

# メッセージが取得できない場合は許可（予期しないパターン）
if [[ -z "$commit_message" ]]; then
  exit 0
fi

# 変数参照の場合はスキップ（実行時まで値が確定しない）
if [[ "$commit_message" =~ ^\$ ]]; then
  exit 0
fi

# 最初の行（概要行）を取得
first_line=$(echo "$commit_message" | head -1)

# === 検証ルール ===

# 有効なプレフィックス一覧
VALID_PREFIXES="^(feat|fix|docs|style|refactor|test|chore):"

# ルール1: プレフィックスの存在確認
if ! echo "$first_line" | grep -qE "$VALID_PREFIXES"; then
  cat >&2 <<ERRMSG

❌ コミットメッセージ形式エラー

検出されたメッセージ:
  "$first_line"

問題:
  有効なプレフィックスがありません。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ 対処方法: /task-commit Skillを使用してください

このSkillはコミットルールに従って:
- 適切なプレフィックス（feat/fix/docs等）を付与
- 変更内容に応じたコミット分割を提案
- 日本語で明確なメッセージを生成

実行: Skill("task-commit") を呼び出す
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照: docs/einja/steering/commit-rules.md

ERRMSG
  exit 2
fi

# プレフィックス後の説明部分を抽出（禁止パターン検出に使用）
description=$(echo "$first_line" | sed -E 's/^(feat|fix|docs|style|refactor|test|chore):[[:space:]]*//')

# ルール2: プレフィックス後のメッセージが空でないか（3文字以上）
if [[ -z "$description" ]] || [[ ${#description} -lt 3 ]]; then
  cat >&2 <<ERRMSG

❌ コミットメッセージ形式エラー

検出されたメッセージ:
  "$first_line"

問題:
  プレフィックス後の説明が不足しています。
  具体的な変更内容を記述してください（3文字以上）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ 対処方法: /task-commit Skillを使用してください

このSkillはコミットルールに従って:
- 適切なプレフィックス（feat/fix/docs等）を付与
- 変更内容に応じたコミット分割を提案
- 日本語で明確なメッセージを生成

実行: Skill("task-commit") を呼び出す
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照: docs/einja/steering/commit-rules.md

ERRMSG
  exit 2
fi

# ルール3: 明らかに不適切なメッセージのパターン検出（説明部分に対して適用）
INVALID_PATTERNS=(
  "^---$"
  "^\*\*.*\*\*$"
  "^完了しました"
  "^実装完了"
  "^修正完了"
  "^update$"
  "^fix$"
  "^changes$"
  "^wip$"
)

for pattern in "${INVALID_PATTERNS[@]}"; do
  if echo "$description" | grep -qiE "$pattern"; then
    cat >&2 <<ERRMSG

❌ コミットメッセージ形式エラー

検出されたメッセージ:
  "$first_line"

問題:
  コミットメッセージの説明部分が不適切な形式です。
  具体的な変更内容を記述してください。

禁止されたパターン: $pattern

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ 対処方法: /task-commit Skillを使用してください

このSkillはコミットルールに従って:
- 適切なプレフィックス（feat/fix/docs等）を付与
- 変更内容に応じたコミット分割を提案
- 日本語で明確なメッセージを生成

実行: Skill("task-commit") を呼び出す
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照: docs/einja/steering/commit-rules.md

ERRMSG
    exit 2
  fi
done

# ルール4: メッセージがMarkdown見出し形式でないか
if echo "$first_line" | grep -qE "^#{1,6}[[:space:]]"; then
  cat >&2 <<ERRMSG

❌ コミットメッセージ形式エラー

検出されたメッセージ:
  "$first_line"

問題:
  Markdownの見出し形式（#）は使用できません。
  プレフィックス形式で記述してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ 対処方法: /task-commit Skillを使用してください

このSkillはコミットルールに従って:
- 適切なプレフィックス（feat/fix/docs等）を付与
- 変更内容に応じたコミット分割を提案
- 日本語で明確なメッセージを生成

実行: Skill("task-commit") を呼び出す
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照: docs/einja/steering/commit-rules.md

ERRMSG
  exit 2
fi

# 全ての検証をパス
exit 0
