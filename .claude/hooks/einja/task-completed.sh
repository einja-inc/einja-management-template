#!/usr/bin/env bash
# task-completed.sh — TaskCompleted hook
# Agent Teams有効時のみ動作し、シグナルファイルを作成する
#
# 環境変数の出典:
#   - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: Agent Teams機能の有効化フラグ
#   - CLAUDE_CODE_TEAMMATE_MODE: チームメイト実行モード（"tmux" | "in-process"）
#   - CLAUDE_CODE_TASK_ID: Claude Code v2.1.33+ のhook実行コンテキストで提供される
#     (公式: https://code.claude.com/docs/en/hooks )
#   - EINJA_SESSION_ID: einja-team-exec Skillが起動時に設定するセッション識別子
#
# 実環境で変数名が異なる場合の調査用にデバッグログを残す（環境変数のみ。値は記録しない）

set -euo pipefail

# デバッグログ: CLAUDE_CODE_* 環境変数の存在を記録（値は機密の可能性があるため変数名のみ）
DEBUG_LOG="/tmp/einja-hooks-debug.log"
{
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] task-completed.sh invoked"
  env | grep -E '^CLAUDE_CODE_|^EINJA_' | sed 's/=.*$/=<set>/' || true
} >>"$DEBUG_LOG" 2>/dev/null || true

# Agent Teams 有効ガード
if [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" != "1" ]; then
  exit 0
fi

# tmuxモード判定: in-process モードではシグナル生成を行わない
# CLAUDE_CODE_TEAMMATE_MODE が未設定の場合は tmux モードを仮定（後方互換）
TEAMMATE_MODE="${CLAUDE_CODE_TEAMMATE_MODE:-tmux}"
if [ "$TEAMMATE_MODE" != "tmux" ]; then
  exit 0
fi

# セッションID解決: EINJA_SESSION_ID → CLAUDE_CODE_SESSION_ID → CLAUDE_SESSION_ID の順で探索
SESSION_ID="${EINJA_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-${CLAUDE_SESSION_ID:-}}}"
if [ -z "$SESSION_ID" ]; then
  echo "[task-completed.sh] WARN: セッションIDが解決できませんでした (EINJA_SESSION_ID/CLAUDE_CODE_SESSION_ID/CLAUDE_SESSION_ID すべて未設定)。シグナルファイルは生成しません。" >&2
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] task-completed.sh: session id unresolved" >>"$DEBUG_LOG" 2>/dev/null || true
  exit 0
fi

SIGNAL_DIR="$HOME/.einja/sessions/${SESSION_ID}/signals"
mkdir -p "$SIGNAL_DIR"

TASK_ID="${CLAUDE_CODE_TASK_ID:-unknown}"
# ファイル名サニタイズ: `/` や空白等が含まれるとパス分割やファイル名不具合を引き起こすため、
# 安全な文字（英数字、ドット、アンダースコア、ハイフン）以外を `_` に置換する
safe_task_id=$(printf '%s' "$TASK_ID" | tr -c 'A-Za-z0-9._-' '_')
touch "$SIGNAL_DIR/task-${safe_task_id}-completed.signal"
