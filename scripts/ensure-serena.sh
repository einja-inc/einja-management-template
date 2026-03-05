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
      # 自プロジェクトのSerenaプロセス → 再利用
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

# --- 起動待機（PID生存 + ポートLISTEN、最大30秒） ---
for _i in $(seq 1 60); do
  if ! kill -0 "$_serena_pid" 2>/dev/null; then
    echo "[ensure-serena] Warning: Serena process exited unexpectedly" >&2
    return 0 2>/dev/null || true
  fi
  if nc -z 127.0.0.1 "$_port" > /dev/null 2>&1; then
    echo "$_port $_serena_pid" > "$_SERENA_PORT_FILE"
    export SERENA_PORT="$_port"
    echo "[ensure-serena] Serena ready on port $_port (PID: $_serena_pid)"
    return 0 2>/dev/null || true
  fi
  sleep 0.5
done

# タイムアウト（起動失敗してもdirenvはブロックしない）
echo "[ensure-serena] Warning: Serena failed to start within 30s" >&2
return 0 2>/dev/null || true
