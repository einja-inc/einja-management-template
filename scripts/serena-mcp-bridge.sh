#!/bin/bash
set -euo pipefail

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
  done < <(git -C "$1" worktree list --porcelain 2>/dev/null)
  if [[ -n "$current_worktree" ]]; then
    echo "$current_worktree"
  fi
}

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
MAIN_WORKTREE="$(get_main_worktree "$PROJECT_ROOT")"
SERENA_BASE="${MAIN_WORKTREE:-$PROJECT_ROOT}"

if ! bash "$SERENA_BASE/scripts/ensure-serena.sh" "$SERENA_BASE"; then
  echo "[serena-mcp-bridge] Error: failed to start Serena" >&2
  exit 1
fi

if ! IFS=' ' read -r SERENA_PORT _rest < "$SERENA_BASE/.serena-port"; then
  echo "[serena-mcp-bridge] Error: failed to read $SERENA_BASE/.serena-port" >&2
  exit 1
fi

exec npx -y mcp-remote "http://127.0.0.1:${SERENA_PORT}/mcp" --allow-http --transport http-first
