# ensure-serena.sh の direnv ブロッキング修正

## Context

Claude Code終了時にシェルに戻ると、direnvが `.envrc` を再評価し `ensure-serena.sh` が実行される。Serenaの起動待機ループ（最大30秒）がdirenvをブロックし、「is taking a while to execute」警告が出る。

## 原因

`scripts/ensure-serena.sh` 78-90行目の起動待機ループが同期的に実行されており、ポートがLISTENするまで最大30秒間direnvをブロックする。

## 修正方針

**起動待機をバックグラウンド化する。**

現在の流れ:
1. uvx でSerenaをバックグラウンド起動
2. **同期的に**ポートLISTENを最大30秒待機（ここがブロック）
3. ポートファイル書き込み + SERENA_PORT export

修正後:
1. uvx でSerenaをバックグラウンド起動
2. ポートファイル書き込み + SERENA_PORT export を**即座に実行**
3. 待機＋readyログ出力を**バックグラウンドで実行**

ポートは起動前に空きを確認済みなので、即座にexportしても問題ない。Claude CodeのMCP接続時にはSerenaは起動完了している。

## 対象ファイル

- `scripts/ensure-serena.sh` （64-94行目を修正）

## 修正内容

```bash
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
echo "$_port $_serena_pid" > "$_SERENA_PORT_FILE"
export SERENA_PORT="$_port"

# 起動確認はバックグラウンドで実行
(
  for _i in $(seq 1 60); do
    if ! kill -0 "$_serena_pid" 2>/dev/null; then
      echo "[ensure-serena] Warning: Serena process exited unexpectedly" >&2
      rm -f "$_SERENA_PORT_FILE"
      break
    fi
    if nc -z 127.0.0.1 "$_port" > /dev/null 2>&1; then
      echo "[ensure-serena] Serena ready on port $_port (PID: $_serena_pid)"
      break
    fi
    sleep 0.5
  done
) &
disown
```

## 検証方法

1. `time (source scripts/ensure-serena.sh .)` で新規起動時もdirenvをブロックしないことを確認（即座にreturnすること）
2. 数秒後に `nc -z 127.0.0.1 <port>` でSerenaが起動していることを確認
3. `.serena-port` にport/PIDが記録されていることを確認
