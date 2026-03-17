#!/bin/bash
get_main_worktree() {
  local current_worktree=""
  while IFS= read -r line; do
    if [[ "$line" == "worktree "* ]]; then
      current_worktree="${line#worktree }"
    elif [[ "$line" == "bare" ]]; then
      current_worktree=""
    elif [[ -z "$line" && -n "$current_worktree" ]]; then
      echo "$current_worktree"
      return
    fi
  done < <(git worktree list --porcelain 2>/dev/null)
  if [[ -n "$current_worktree" ]]; then
    echo "$current_worktree"
  fi
}

BASE_DIR="${1:-$(get_main_worktree)}"
if [ -z "$BASE_DIR" ]; then
  BASE_DIR="$(pwd)"
fi
PORT_FILE="$BASE_DIR/.serena-port"
if [ -f "$PORT_FILE" ]; then
  read -r PORT PID < "$PORT_FILE"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    # SIGTERM後、最大5秒待機
    for _i in $(seq 1 10); do
      if ! kill -0 "$PID" 2>/dev/null; then
        echo "Serena stopped (PID: $PID, port: $PORT)"
        rm -f "$PORT_FILE"
        exit 0
      fi
      sleep 0.5
    done
    # 応答なし → 強制終了
    kill -9 "$PID" 2>/dev/null
    echo "Serena force-killed (PID: $PID, port: $PORT)"
  else
    echo "Serena process not running (PID: $PID)"
  fi
  rm -f "$PORT_FILE"
else
  echo "Serena not running (.serena-port not found)"
fi
