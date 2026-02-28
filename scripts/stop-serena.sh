#!/bin/bash
PORT_FILE=".serena-port"
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
