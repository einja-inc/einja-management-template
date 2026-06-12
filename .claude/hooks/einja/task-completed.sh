#!/usr/bin/env bash
# task-completed.sh — TaskCompleted hook
# Agent Teams有効時、実効モードを判定せず常にシグナルファイルを作成する。
#
# 設計方針:
#   teammate の実効モード（tmux pane / in-process）を hook から確実判定する公式手段は無いため、
#   モード判定は行わず常にシグナルを生成する。in-process 時は Lead がシグナルを無視するので無害。
#
# 入力（公式: https://code.claude.com/docs/en/hooks ）:
#   - stdin: JSON。team_name / task_id 等のフィールドを含む（主入力）
# 環境変数:
#   - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: Agent Teams機能の有効化フラグ
#   - EINJA_SESSION_ID: einja-team-exec Skill が起動時に設定するセッション識別子（signal dir 決定の主経路）
#   - CLAUDE_CODE_TASK_ID / CLAUDE_CODE_SESSION_ID / CLAUDE_SESSION_ID: stdin 未提供時の env フォールバック

set -euo pipefail

# stdin JSON を読み込む（公式 hooks は stdin で JSON を渡す）。空でも継続。
HOOK_INPUT="$(cat 2>/dev/null || true)"

# stdin JSON から指定キーの値を取り出す（node優先、jqフォールバック、取得不能なら空文字）
json_get() {
  local key="$1"
  [ -z "$HOOK_INPUT" ] && return 0
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const o=JSON.parse(d);const v=o[process.argv[1]];if(v!=null)process.stdout.write(String(v));}catch(e){}});' "$key" 2>/dev/null || true
  elif command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | jq -r --arg k "$key" '.[$k] // empty' 2>/dev/null || true
  fi
}

# デバッグログ: CLAUDE_CODE_* / EINJA_* 環境変数の存在を記録（値は機密の可能性があるため変数名のみ）
DEBUG_LOG="/tmp/einja-hooks-debug.log"
{
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] task-completed.sh invoked"
  env | grep -E '^CLAUDE_CODE_|^EINJA_' | sed 's/=.*$/=<set>/' || true
} >>"$DEBUG_LOG" 2>/dev/null || true

# Agent Teams 有効ガード
if [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" != "1" ]; then
  exit 0
fi

# セッションID解決（signal dir 決定）:
#   1. EINJA_SESSION_ID（主経路。Lead/Teammate で共有する issue-{N} 等）
#   2. stdin JSON の team_name から命名サフィックス（-directors/-workers）を除去して復元
#   3. CLAUDE_CODE_SESSION_ID → CLAUDE_SESSION_ID（プラットフォーム提供時）
# team_name をそのまま使わないのは、Lead が監視する signal dir（issue-{N}）とズレるため。
SESSION_ID="${EINJA_SESSION_ID:-}"
if [ -z "$SESSION_ID" ]; then
  TEAM_NAME="$(json_get team_name)"
  if [ -n "$TEAM_NAME" ]; then
    SESSION_ID="$(printf '%s' "$TEAM_NAME" | sed -E 's/-(directors|workers)$//')"
  fi
fi
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="${CLAUDE_CODE_SESSION_ID:-${CLAUDE_SESSION_ID:-}}"
fi
if [ -z "$SESSION_ID" ]; then
  echo "[task-completed.sh] WARN: セッションIDが解決できませんでした (EINJA_SESSION_ID / stdin team_name / CLAUDE_CODE_SESSION_ID / CLAUDE_SESSION_ID すべて未取得)。シグナルファイルは生成しません。" >&2
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] task-completed.sh: session id unresolved" >>"$DEBUG_LOG" 2>/dev/null || true
  exit 0
fi

# SESSION_ID サニタイズ（path-traversal 防止）: signal dir のパス成分になるため、
# 安全な文字以外を `_` に置換し、`..`/空/ドット単体は拒否する（task_id/teammate_name と同等の防御を SESSION_ID にも一貫適用）。
SESSION_ID="$(printf '%s' "$SESSION_ID" | tr -c 'A-Za-z0-9._-' '_')"
case "$SESSION_ID" in
  '' | . | .. | *..*)
    echo "[task-completed.sh] WARN: 不正な SESSION_ID（path-traversal の恐れ）を検出しました。シグナルファイルは生成しません。" >&2
    exit 0
    ;;
esac

SIGNAL_DIR="$HOME/.einja/sessions/${SESSION_ID}/signals"
mkdir -p "$SIGNAL_DIR"

# Task ID: stdin JSON 優先、env フォールバック
TASK_ID="$(json_get task_id)"
if [ -z "$TASK_ID" ]; then
  TASK_ID="${CLAUDE_CODE_TASK_ID:-unknown}"
fi
# ファイル名サニタイズ: 安全な文字（英数字、ドット、アンダースコア、ハイフン）以外を `_` に置換
safe_task_id=$(printf '%s' "$TASK_ID" | tr -c 'A-Za-z0-9._-' '_')
touch "$SIGNAL_DIR/task-${safe_task_id}-completed.signal"
