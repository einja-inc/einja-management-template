#!/bin/bash
# Serena MCP サーバーの冪等起動
# source / 実行のどちらでも利用可能

# メインワークツリーをベースにする（worktree 間で共有）
_SERENA_BASE="${1:-$(pwd)}"
_SERENA_PORT_FILE="$_SERENA_BASE/.serena-port"
_SERENA_DEFAULT_PORT="${SERENA_PORT:-9850}"
_SERENA_PROJECT_LOCK_DIR="$_SERENA_BASE/.serena-start.lock"
_SERENA_GLOBAL_LOCK_DIR="${TMPDIR:-/tmp}/serena-mcp-start.lock"
_SERENA_START_TIMEOUT_SEC="${SERENA_START_TIMEOUT_SEC:-30}"
_SERENA_VERBOSE="${SERENA_VERBOSE:-0}"
_SERENA_SOURCED=0
if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  _SERENA_SOURCED=1
fi

# --- ヘルパー関数 ---
_return_or_exit() {
  local _code="${1:-0}"
  return "$_code" 2>/dev/null || exit "$_code"
}
_is_uint() {
  case "$1" in
    ""|0|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}
_escape_ere() {
  printf '%s' "$1" | sed -e 's/[][(){}.^$*+?|\\]/\\&/g'
}
_log_info() {
  if [ "$_SERENA_VERBOSE" = "1" ]; then
    echo "[ensure-serena] $*" >&2
  fi
}
_log_warn() {
  echo "[ensure-serena] $*" >&2
}
_release_lock_dir() {
  rmdir "$1" 2>/dev/null || true
}
_acquire_lock_dir() {
  local _lock_dir="$1"
  local _timeout="${2:-10}"
  local _ticks=0
  local _max_ticks=$((_timeout * 10))

  while ! mkdir "$_lock_dir" 2>/dev/null; do
    _ticks=$((_ticks + 1))
    if [ "$_ticks" -ge "$_max_ticks" ]; then
      return 1
    fi
    sleep 0.1
  done
}
_cleanup_project_lock() {
  _release_lock_dir "$_SERENA_PROJECT_LOCK_DIR"
}
_cleanup_global_lock() {
  _release_lock_dir "$_SERENA_GLOBAL_LOCK_DIR"
}
_cleanup_all_locks() {
  _cleanup_global_lock
  _cleanup_project_lock
}
_reuse_if_running() {
  if [ ! -f "$_SERENA_PORT_FILE" ]; then
    return 1
  fi

  IFS=' ' read -r _saved_port _saved_pid _rest < "$_SERENA_PORT_FILE" || true

  if _is_uint "$_saved_pid" && _is_uint "$_saved_port"; then
    _cmd="$(ps -p "$_saved_pid" -ww -o command= 2>/dev/null || true)"
    _base_ere="$(_escape_ere "$_SERENA_BASE")"

    if [ -n "$_cmd" ] \
       && printf '%s\n' "$_cmd" | grep -Eq -- "(^|[[:space:]])--project(=|[[:space:]])${_base_ere}([[:space:]]|$)"; then
      export SERENA_PORT="$_saved_port"
      return 0
    fi
  fi

  rm -f "$_SERENA_PORT_FILE"
  return 1
}
_wait_for_listen() {
  local _pid="$1"
  local _port="$2"
  local _loops=$((_SERENA_START_TIMEOUT_SEC * 2))

  for _i in $(seq 1 "$_loops"); do
    if ! kill -0 "$_pid" 2>/dev/null; then
      return 1
    fi
    if nc -z 127.0.0.1 "$_port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  return 1
}

if [ "$_SERENA_SOURCED" = "0" ]; then
  trap _cleanup_all_locks EXIT INT TERM HUP
fi

# --- 同一プロジェクトの多重起動防止ロック ---
if ! _acquire_lock_dir "$_SERENA_PROJECT_LOCK_DIR" 10; then
  _log_warn "Error: failed to acquire project lock"
  _return_or_exit 1
fi

# --- 既存インスタンスチェック（PID×プロセス検証） ---
if _reuse_if_running; then
  _cleanup_project_lock
  _return_or_exit 0
fi

# --- uvx 確認 ---
if ! command -v uvx &> /dev/null; then
  _cleanup_project_lock
  _log_warn "Warning: uvx not found. Serena will not auto-start."
  _log_warn "Install uv first: curl -LsSf https://astral.sh/uv/install.sh | sh"
  _return_or_exit 1
fi

# --- 別プロジェクトとのポート競合防止ロック ---
if ! _acquire_lock_dir "$_SERENA_GLOBAL_LOCK_DIR" 10; then
  _cleanup_project_lock
  _log_warn "Error: failed to acquire global Serena startup lock"
  _return_or_exit 1
fi

# ロック待ち中に起動済みになったケースを再確認
if _reuse_if_running; then
  _cleanup_all_locks
  _return_or_exit 0
fi

# --- 空きポート検出 + 起動 ---
_port="$_SERENA_DEFAULT_PORT"
_started=false
for _i in $(seq 1 10); do
  if nc -z 127.0.0.1 "$_port" >/dev/null 2>&1; then
    _port=$((_port + 1))
    continue
  fi

  _log_info "Starting Serena on port $_port..."
  uvx --from git+https://github.com/oraios/serena \
    serena start-mcp-server \
    --transport streamable-http \
    --host 127.0.0.1 \
    --port "$_port" \
    --context claude-code \
    --project "$_SERENA_BASE" \
    < /dev/null > /dev/null 2>&1 &
  _serena_pid=$!
  disown

  if _wait_for_listen "$_serena_pid" "$_port"; then
    _tmp="${_SERENA_PORT_FILE}.$$"
    printf '%s %s\n' "$_port" "$_serena_pid" > "$_tmp" && mv -f "$_tmp" "$_SERENA_PORT_FILE"
    export SERENA_PORT="$_port"
    _log_info "Serena ready on port $_port (PID: $_serena_pid)"
    _started=true
    break
  fi

  kill "$_serena_pid" 2>/dev/null || true
  wait "$_serena_pid" 2>/dev/null || true
  _port=$((_port + 1))
done

_cleanup_all_locks

if [ "$_started" = true ]; then
  _return_or_exit 0
fi

_log_warn "Error: Serena failed to start (tried $_SERENA_DEFAULT_PORT-$((_port - 1)))"
_return_or_exit 1
