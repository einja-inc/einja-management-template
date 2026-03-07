#!/bin/bash
# Serena MCP サーバーの冪等起動
# .envrc から source して使用

# メインワークツリーをベースにする（worktree 間で共有）
_SERENA_BASE="${1:-$(pwd)}"
_SERENA_PORT_FILE="$_SERENA_BASE/.serena-port"
_SERENA_DEFAULT_PORT="${SERENA_PORT:-9850}"

# --- ヘルパー関数 ---
_is_uint() {
  case "$1" in
    ""|0|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}
_escape_ere() {
  printf '%s' "$1" | sed -e 's/[][(){}.^$*+?|\\]/\\&/g'
}

# --- 既存インスタンスチェック（PID×プロセス検証） ---
if [ -f "$_SERENA_PORT_FILE" ]; then
  IFS=' ' read -r _saved_port _saved_pid _rest < "$_SERENA_PORT_FILE" || true

  if _is_uint "$_saved_pid" && _is_uint "$_saved_port"; then
    _cmd="$(ps -p "$_saved_pid" -ww -o command= 2>/dev/null || true)"
    _base_ere="$(_escape_ere "$_SERENA_BASE")"

    if [ -n "$_cmd" ] \
       && printf '%s\n' "$_cmd" | grep -Eq -- "(^|[[:space:]])--project(=|[[:space:]])${_base_ere}([[:space:]]|$)"; then
      # 自プロジェクトのSerenaプロセス → 再利用（起動中でもLISTEN済みでもOK）
      export SERENA_PORT="$_saved_port"
      return 0 2>/dev/null || true
    fi
  fi

  # PID死亡 or 数値不正 or 別プロセス/別プロジェクトのSerena → クリーンアップ
  rm -f "$_SERENA_PORT_FILE"
fi

# --- uvx 確認 ---
if ! command -v uvx &> /dev/null; then
  echo "[ensure-serena] Warning: uvx not found. Serena will not auto-start." >&2
  echo "[ensure-serena] Install uv first: curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  return 0 2>/dev/null || true
fi

# --- 空きポート検出 ---
_port="$_SERENA_DEFAULT_PORT"
_port_found=false
for _i in $(seq 1 10); do
  if ! nc -z 127.0.0.1 "$_port" > /dev/null 2>&1; then
    _port_found=true
    break
  fi
  _port=$((_port + 1))
done

if [ "$_port_found" = false ]; then
  echo "[ensure-serena] Error: No available port found (tried $_SERENA_DEFAULT_PORT-$_port)" >&2
  return 0 2>/dev/null || true
fi

# --- バックグラウンド起動 ---
echo "[ensure-serena] Starting Serena on port $_port..."
uvx --from git+https://github.com/oraios/serena \
  serena start-mcp-server \
  --transport streamable-http \
  --host 127.0.0.1 \
  --port "$_port" \
  --context claude-code \
  --project "$_SERENA_BASE" \
  > /dev/null 2>&1 &
_serena_pid=$!
disown

# ポートファイルとSERENA_PORTを即座に設定（direnvをブロックしない）
# アトミックな書き込み（truncate→writeの空読みを防止）
_tmp="${_SERENA_PORT_FILE}.$$"
printf '%s %s\n' "$_port" "$_serena_pid" > "$_tmp" && mv -f "$_tmp" "$_SERENA_PORT_FILE"
export SERENA_PORT="$_port"

# 起動確認はバックグラウンドで実行（FDを閉じてdirenvのpipe待ちを防止）
(
  _cleanup_if_own_pid() {
    local _p _pid _r
    if IFS=' ' read -r _p _pid _r < "$_SERENA_PORT_FILE" 2>/dev/null && [ "$_pid" = "$_serena_pid" ]; then
      rm -f "$_SERENA_PORT_FILE"
    fi
  }
  for _i in $(seq 1 60); do
    if ! kill -0 "$_serena_pid" 2>/dev/null; then
      echo "[ensure-serena] Warning: Serena process exited unexpectedly" >&2
      _cleanup_if_own_pid
      break
    fi
    if nc -z 127.0.0.1 "$_port" > /dev/null 2>&1; then
      echo "[ensure-serena] Serena ready on port $_port (PID: $_serena_pid)"
      break
    fi
    sleep 0.5
  done
) >/dev/null 2>&1 < /dev/null &
disown
