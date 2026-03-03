# Serena MCP サーバー共有化（1インスタンス化）

## Context

現在の `.mcp.json` では Serena が `type: "stdio"` で設定されており、Claude Code を起動するたびに個別のSerenaプロセスが生成される。同一プロジェクトで複数のClaude Codeを並行利用する場合、メモリ・CPUを無駄に消費する。

目標:
1. 1プロジェクト1インスタンスで共有
2. ポート衝突時は自動解決
3. 起動忘れの自動カバー
4. テンプレートとして社内複数リポジトリに配布
5. 別プロジェクトのSerenaインスタンスとの誤接続を防止

方式C（Claude Code hook）はMCP接続がセッション開始時にeagerに行われるため技術的に不可。
方式A（direnv）+ D（手動フォールバック）のハイブリッドを採用。

## 仕組み

```
cd プロジェクト
  ↓ direnv が .envrc を実行
source scripts/ensure-serena.sh
  ↓
  ├─ .serena-port あり → PID生存チェック
  │   ├─ PID生存 → SERENA_PORT export（即完了）
  │   └─ PID死亡 → .serena-port 削除 → 新規起動へ
  └─ .serena-port なし → 空きポート検出 → バックグラウンド起動 → PID+ポート保存
  ↓
claude コマンド起動（Serena は既に稼働中）
  ↓
.mcp.json: "url": "http://127.0.0.1:${SERENA_PORT:-9850}/mcp"
```

### 設計判断: PIDベースの所有権管理

`.serena-port` に `PORT PID` を保存し、PIDの生存確認（`kill -0`）で判別する。

| シナリオ | PIDファイル | 判定 | 動作 |
|---------|-----------|------|------|
| 自プロジェクトのSerena起動中 | あり、PID生存 | 自分のもの | 再利用 |
| 自プロジェクトのSerena異常終了 | あり、PID死亡 | 終了済み | ファイル削除→新規起動 |
| 別プロジェクトのSerenaが同ポート | なし or PID不一致 | 他人のもの | ポートスキップ |
| ポート9850が非Serenaに使用中 | なし | 無関係 | ポートスキップ |

**curlを使わない理由**: MCP streamable-httpの `/mcp` はPOST専用のため、GETでの `curl -sf` は405を返し「未起動」と誤判定する。PIDチェックならプロトコル非依存で確実。

## 変更内容

### 1. `scripts/ensure-serena.sh` 新規作成

Serenaの冪等起動スクリプト。`.envrc` から source される。

**ファイル形式**: `.serena-port` は `PORT PID` のスペース区切り（例: `9850 12345`）

```bash
#!/bin/bash
# Serena MCP サーバーの冪等起動
# .envrc から source して使用

# メインワークツリーをベースにする（worktree 間で共有）
_SERENA_BASE="${1:-$(pwd)}"
_SERENA_PORT_FILE="$_SERENA_BASE/.serena-port"
_SERENA_DEFAULT_PORT="${SERENA_PORT:-9850}"

# --- 既存インスタンスチェック（PIDベース） ---
if [ -f "$_SERENA_PORT_FILE" ]; then
  read -r _saved_port _saved_pid < "$_SERENA_PORT_FILE"
  if [ -n "$_saved_pid" ] && kill -0 "$_saved_pid" 2>/dev/null; then
    # PIDが生存 → 自プロジェクトのSerena
    export SERENA_PORT="$_saved_port"
    return 0 2>/dev/null || true
  fi
  # PID死亡 → クリーンアップ
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
  if ! lsof -i ":$_port" -sTCP:LISTEN > /dev/null 2>&1; then
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
disown
_serena_pid=$!

# --- 起動待機（PID生存 + ポートLISTEN、最大30秒） ---
for _i in $(seq 1 60); do
  if ! kill -0 "$_serena_pid" 2>/dev/null; then
    echo "[ensure-serena] Warning: Serena process exited unexpectedly" >&2
    return 0 2>/dev/null || true
  fi
  if lsof -p "$_serena_pid" -i ":$_port" -sTCP:LISTEN > /dev/null 2>&1; then
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
```

### 2. `scripts/stop-serena.sh` 新規作成

手動停止用フォールバック。PIDベースで確実に停止。

```bash
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
```

### 3. `.envrc` managed セクションに追記

**ファイル**: `.envrc`（L25-26 の間に追加）

```diff
  if [ -n "$MAIN_WORKTREE" ] && [ -f "$MAIN_WORKTREE/.env.personal" ]; then
    dotenv_if_exists "$MAIN_WORKTREE/.env.personal"
  fi
+
+ # Serena MCP サーバー自動起動
+ if [ -n "$MAIN_WORKTREE" ] && [ -f "$MAIN_WORKTREE/scripts/ensure-serena.sh" ]; then
+   source "$MAIN_WORKTREE/scripts/ensure-serena.sh" "$MAIN_WORKTREE"
+ fi
  # @einja:managed:end
```

### 4. `.mcp.json` のSerena設定を変更

**ファイル**: `.mcp.json`（L34-47）

```diff
  "serena": {
-     "type": "stdio",
-     "command": "uvx",
-     "args": [
-         "--from",
-         "git+https://github.com/oraios/serena",
-         "serena",
-         "start-mcp-server",
-         "--context",
-         "claude-code",
-         "--open-web-dashboard",
-         "false"
-     ]
+     "type": "http",
+     "url": "http://127.0.0.1:${SERENA_PORT:-9850}/mcp"
  }
```

### 5. `.env.personal.example` に追記

```diff
+ # Serena MCPサーバーのポート番号（ポート衝突時のみ変更。通常は自動解決）
+ # SERENA_PORT=9851
```

### 6. `.gitignore` に追加

```diff
  # Serena設定（個人用）
  **/.serena/
+ .serena-port
```

### 7. `docs/einja/instructions/local-server-environment-and-worktree.md` に追記

※ このリポジトリは `docs/einja/` の原本（Single Source of Truth）。`presets/default/` へはビルド時にコピーされる。

`@einja:managed:end` の直前（L629手前）に「MCP Server (Serena)」セクションを追加。PostgreSQLセクションと同パターン。

記載内容:
- **概要**: Serena MCP サーバーの共有アーキテクチャ（1プロジェクト1インスタンス、worktree間共有）
- **自動起動の仕組み**: direnv → `ensure-serena.sh` → PIDベース所有権管理
- **`.serena-port` ファイル仕様**: `PORT PID` のスペース区切りフォーマット
- **PIDベース所有権管理**: なぜcurlではなくPIDを使うか（MCP streamable-httpはPOST専用、GETでは405）
- **ポート自動解決**: デフォルト9850、衝突時+1で10回まで試行
- **手動操作**: `./scripts/stop-serena.sh`、`direnv reload`（再起動）、`cat .serena-port`（状態確認）
- **トラブルシューティング**: Serena接続エラー、ポート衝突、ゾンビプロセス対処
- **`.env.personal` でのオーバーライド**: `SERENA_PORT` でデフォルトポート変更

## 対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `scripts/ensure-serena.sh` | **新規作成** |
| `scripts/stop-serena.sh` | **新規作成** |
| `.envrc` | 編集（managed セクションに source 追加） |
| `.mcp.json` | 編集（serena を stdio → http） |
| `.env.personal.example` | 編集（SERENA_PORT 追記） |
| `.gitignore` | 編集（.serena-port 追加） |
| `docs/einja/instructions/local-server-environment-and-worktree.md` | 編集（MCP Serverセクション追加） |

## テンプレート配布の考慮

- `.envrc` は `@einja:managed` セクション → `einja sync` で配布
- `.mcp.json` は sync 対象
- `scripts/ensure-serena.sh`, `scripts/stop-serena.sh` → 配布方法を要検討（sync 対象に含めるか `einja init` でコピーか）

## 検証方法

1. `direnv reload` → `echo $SERENA_PORT` でポート設定を確認
2. `cat .serena-port` → `PORT PID` 形式で保存されていることを確認
3. `kill -0 <PID>` → プロセス生存を確認
4. `claude` 起動 → Serena ツール（`find_symbol` 等）が使えることを確認
5. 別ターミナルで `claude` → 同じく使えることを確認（同ポート再利用）
6. `ps aux | grep serena` でプロセスが1つだけであることを確認
7. ポート衝突テスト: `python3 -m http.server 9850 &` → `direnv reload` → `SERENA_PORT` が 9851 になることを確認
8. Serena 停止テスト: `./scripts/stop-serena.sh` → `direnv reload` → 再起動されることを確認
9. 重複起動テスト: `direnv reload` を複数回実行 → `.serena-port` のPIDが変わらないことを確認
