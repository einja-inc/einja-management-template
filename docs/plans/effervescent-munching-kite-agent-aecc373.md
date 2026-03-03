# Serena MCP バックグラウンドプロセス自動停止機能の調査・設計

**作成日**: 2026-02-27
**ステータス**: 調査完了
**優先度**: Medium

---

## 背景

### 問題

- `ensure-serena.sh` が `.envrc` から source されてSerenaをバックグラウンド起動（`nohup ... &`）
- ユーザーがターミナルを全部閉じても Serena プロセスは残り続ける
- メモリ消費（LSPサーバー + インデックス）が数百MB規模で長期間残る

### 現状の環境

- 現在の `.envrc` には Serena 起動スクリプトは**未実装**（マネージドセクションと seed セクションのみ）
- `.claude/hooks/einja/ensure-serena.sh` ファイルは**存在しない**
- これはテンプレート配布前の設計段階であることを示唆

---

## 調査結果

### 1. Serena の idle timeout 機能

#### CLI オプション調査

- `serena start-mcp-server --help` で確認可能なオプション：
  - `--port`: ポート番号指定
  - `--context`: コンテキスト指定（ide, claude-code, desktop-app）
  - `--project`: プロジェクトパス指定
  - `--transport`: トランスポート指定（stdio, sse）
  - `--mode`: モード指定（複数指定可能）

**結論**: **Serena 自体には idle timeout や自動シャットダウンのCLIオプションは存在しない**

#### ダッシュボード機能

- HTTP/SSEモードでは `http://localhost:24282/dashboard/index.html` でダッシュボードが起動
- ダッシュボードから手動でシャットダウン可能
- ただし**自動停止機能はない**

**参考**:
- [Serena Configuration](https://oraios.github.io/serena/02-usage/050_configuration.html)
- [Serena Client Connection](https://oraios.github.io/serena/02-usage/030_clients.html)

---

### 2. MCP プロトコル仕様の session timeout 機能

#### タイムアウトの種類

MCP仕様では以下のタイムアウトが定義されている:

| タイムアウト種別 | 対象 | 必須レベル | 用途 |
|-----------------|------|-----------|------|
| Request Timeout | 個別リクエスト | SHOULD | 個別リクエストの応答待ちタイムアウト |
| Session Timeout | セッション全体 | 任意（hint） | アイドルセッションの自動クローズ |

#### Request Timeout

> Implementations **SHOULD** establish timeouts for all sent requests, to prevent hung connections and resource exhaustion.

- **クライアント側**が設定する（サーバー側ではない）
- 個別リクエスト単位での応答待ちタイムアウト
- **セッション全体の idle timeout とは別物**

#### Session Timeout（HTTP transport）

> Session management in MCP is evolving. The protocol includes provisions for a `sessionTimeout` parameter (an idle timeout hint in seconds) that can be included in the `InitializeResult`.

- `InitializeResult` に `sessionTimeout` を含めることができる
- ただし**hint（ヒント）**であり、強制ではない
- HTTP実装では `IdleTrackingBackgroundService` でセッション監視可能

**重要**: これは MCP プロトコルレベルの仕様であり、Serena が実装しているかは不明

**参考**:
- [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [State, and long-lived vs. short-lived connections Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/102)

---

### 3. 対策案の評価

#### A. ラッパースクリプトでの idle 監視 ⭐ **推奨**

**実現方法**:
```bash
# ensure-serena.sh
nohup bash -c '
  serena start-mcp-server --transport sse --port 24282 &
  SERVER_PID=$!

  while true; do
    sleep 300  # 5分ごとにチェック

    # 最後のアクセスから N 分経過していたら kill
    LAST_ACCESS=$(lsof -ti:24282 -sTCP:ESTABLISHED 2>/dev/null | wc -l)
    if [ "$LAST_ACCESS" -eq 0 ]; then
      IDLE_COUNT=$((IDLE_COUNT + 1))
      if [ "$IDLE_COUNT" -ge 6 ]; then  # 30分 idle
        kill $SERVER_PID
        break
      fi
    else
      IDLE_COUNT=0
    fi
  done
' > ~/.serena/serena-watchdog.log 2>&1 &
```

**評価**:

| 項目 | 評価 | 詳細 |
|------|------|------|
| 実装の複雑さ | 🟡 中 | 60行程度のシェルスクリプト |
| 信頼性 | 🟢 高 | `lsof` でTCP接続を監視するため確実 |
| macOS/Linux対応 | 🟢 可 | `lsof` は両OS標準コマンド |
| ユーザー体験 | 🟢 良 | 透過的に動作。ログで確認可能 |

**メリット**:
- 完全に自動化できる
- アイドル時間を柔軟に調整可能
- 既存のSerenaに変更不要

**デメリット**:
- スクリプトがやや複雑
- バックグラウンドプロセスが2つになる（Server + Watchdog）

---

#### B. direnv の deactivate 機能

**調査結果**:
- direnv には**公式の on_exit フックは存在しない**
- ディレクトリを離れたときに**自動的に環境変数を unload するのみ**
- Issue #129 で議論されているが、未実装

**参考**:
- [Unload hook · Issue #129 · direnv/direnv](https://github.com/direnv/direnv/issues/129)

**評価**:

| 項目 | 評価 |
|------|------|
| 実現可能性 | ❌ 不可 |
| 理由 | direnv に cleanup hook が存在しない |

---

#### C. macOS launchd / Linux systemd でのプロセス管理

**実現方法**:
- ユーザーレベルの service として Serena を登録
- systemd の `TimeoutStopSec` や `KillMode` で制御

**評価**:

| 項目 | 評価 | 詳細 |
|------|------|------|
| 実装の複雑さ | 🔴 高 | macOS/Linux で別実装が必要 |
| 信頼性 | 🟢 高 | OS標準機能を使用 |
| macOS/Linux対応 | 🟡 要工夫 | launchd/systemd で構文が異なる |
| ユーザー体験 | 🔴 悪 | セットアップ手順が複雑化 |

**デメリット**:
- テンプレート配布に不向き（ユーザーが手動で service 登録が必要）
- プロジェクトごとに service を作るのは現実的でない

---

#### D. `ensure-serena.sh` 実行時に古いプロセスをクリーンアップ ⭐ **シンプル案**

**実現方法**:
```bash
# ensure-serena.sh
# 既存プロセスの確認
SERENA_PID=$(pgrep -f "serena start-mcp-server.*24282")
if [ -n "$SERENA_PID" ]; then
  # プロセスの起動時刻を確認
  if ps -p "$SERENA_PID" -o etime= | grep -E '(days|[0-9]{2}:[0-9]{2}:[0-9]{2})'; then
    # 1時間以上起動中なら kill して再起動
    kill "$SERENA_PID"
    sleep 2
  else
    # まだ新しいので何もしない
    return
  fi
fi

# 新規起動
nohup serena start-mcp-server --transport sse --port 24282 > ~/.serena/serena.log 2>&1 &
```

**評価**:

| 項目 | 評価 | 詳細 |
|------|------|------|
| 実装の複雑さ | 🟢 低 | 20行程度のシェルスクリプト |
| 信頼性 | 🟡 中 | 起動タイミングに依存（cd しない限りクリーンアップされない） |
| macOS/Linux対応 | 🟢 可 | `pgrep`, `ps` は両OS標準 |
| ユーザー体験 | 🟢 良 | 透過的に動作 |

**メリット**:
- 実装が非常にシンプル
- 既存プロセスとの衝突を防げる
- 長時間放置されたプロセスを自動クリーンアップ

**デメリット**:
- **cd しない限りクリーンアップされない**（完全なidle監視ではない）
- 複数プロジェクトで同じポートを使う場合に競合する可能性

---

#### E. 何もしない（ドキュメントで `stop-serena.sh` の使用を案内）

**実現方法**:
- `docs/einja/instructions/` にSerenaプロセス管理のドキュメントを追加
- `stop-serena.sh` スクリプトを提供

**評価**:

| 項目 | 評価 | 詳細 |
|------|------|------|
| 実装の複雑さ | 🟢 最低 | ドキュメントのみ |
| 信頼性 | 🟡 中 | ユーザーの意識に依存 |
| ユーザー体験 | 🔴 悪 | 「驚きの原則」に反する（停止を忘れるとメモリが圧迫される） |

**デメリット**:
- プロセスの放置が常態化する可能性
- 「なぜメモリが圧迫されているのか」の原因追跡が困難

---

## 推奨案

### 第1案（推奨）: **D + 軽量版A のハイブリッド** ⭐⭐⭐

```bash
#!/usr/bin/env bash
# .claude/hooks/einja/ensure-serena.sh

set -euo pipefail

SERENA_PORT=24282
SERENA_PID_FILE="$HOME/.serena/serena.pid"
SERENA_LOG_FILE="$HOME/.serena/serena.log"
IDLE_THRESHOLD_HOURS=2  # 2時間 idle で自動停止

mkdir -p "$(dirname "$SERENA_PID_FILE")"

# 既存プロセスの確認とクリーンアップ
cleanup_old_process() {
  if [ -f "$SERENA_PID_FILE" ]; then
    OLD_PID=$(cat "$SERENA_PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
      # プロセスの起動時刻を確認
      RUNTIME=$(ps -p "$OLD_PID" -o etime= | tr -d ' ')

      # N時間以上起動中なら kill
      if echo "$RUNTIME" | grep -qE "^([0-9]+-|[0-9]{2}:)"; then
        echo "$(date): Killing old Serena process (PID: $OLD_PID, runtime: $RUNTIME)" >> "$SERENA_LOG_FILE"
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2
        rm -f "$SERENA_PID_FILE"
      else
        # まだ新しいので何もしない
        return 0
      fi
    else
      # プロセスが存在しないので PID ファイルを削除
      rm -f "$SERENA_PID_FILE"
    fi
  fi
}

# Serena 起動
start_serena() {
  nohup bash -c "
    serena start-mcp-server --transport sse --port $SERENA_PORT --context ide 2>&1 | tee -a $SERENA_LOG_FILE &
    echo \$! > $SERENA_PID_FILE

    # 簡易 idle 監視（バックグラウンド）
    while sleep 1800; do  # 30分ごとにチェック
      if ! lsof -ti:$SERENA_PORT -sTCP:ESTABLISHED > /dev/null 2>&1; then
        if ps -p \$(cat $SERENA_PID_FILE) -o etime= | grep -qE '^0?$IDLE_THRESHOLD_HOURS:'; then
          echo \"\$(date): Serena idle for $IDLE_THRESHOLD_HOURS hours, shutting down\" >> $SERENA_LOG_FILE
          kill \$(cat $SERENA_PID_FILE) 2>/dev/null || true
          rm -f $SERENA_PID_FILE
          break
        fi
      fi
    done
  " >> "$SERENA_LOG_FILE" 2>&1 &

  disown  # シェルから切り離し
}

# メイン処理
main() {
  cleanup_old_process

  # プロセスが存在しない、または古いプロセスを kill した場合のみ起動
  if [ ! -f "$SERENA_PID_FILE" ]; then
    echo "$(date): Starting Serena MCP server on port $SERENA_PORT" >> "$SERENA_LOG_FILE"
    start_serena
  fi
}

main
```

**特徴**:
- **起動時クリーンアップ（D案）**: 既存プロセスが長時間起動中なら再起動
- **軽量idle監視（A案簡易版）**: 2時間完全アイドルで自動停止
- **PIDファイル管理**: プロセス追跡を確実に

**メリット**:
- シンプルで理解しやすい（80行程度）
- 自動停止とクリーンアップの両立
- macOS/Linux両対応
- ログで動作確認可能

---

### 第2案: **D案のみ（最もシンプル）** ⭐⭐

```bash
#!/usr/bin/env bash
# .claude/hooks/einja/ensure-serena.sh（簡易版）

set -euo pipefail

SERENA_PORT=24282
SERENA_LOG_FILE="$HOME/.serena/serena.log"

mkdir -p "$(dirname "$SERENA_LOG_FILE")"

# 既存プロセスの確認
SERENA_PID=$(lsof -ti:$SERENA_PORT 2>/dev/null || true)

if [ -n "$SERENA_PID" ]; then
  # プロセスの起動時刻を確認（1時間以上起動中なら再起動）
  RUNTIME=$(ps -p "$SERENA_PID" -o etime= | tr -d ' ')
  if echo "$RUNTIME" | grep -qE '^([0-9]+-|0?[1-9]:)'; then
    echo "$(date): Restarting old Serena (PID: $SERENA_PID, runtime: $RUNTIME)" >> "$SERENA_LOG_FILE"
    kill "$SERENA_PID" 2>/dev/null || true
    sleep 2
  else
    # 起動して間もないので何もしない
    exit 0
  fi
fi

# Serena 起動
echo "$(date): Starting Serena MCP server" >> "$SERENA_LOG_FILE"
nohup serena start-mcp-server --transport sse --port $SERENA_PORT --context ide >> "$SERENA_LOG_FILE" 2>&1 &
disown
```

**特徴**:
- 最小限の実装（30行程度）
- cd するたびに古いプロセスをチェック
- 完全なidle監視はなし

**メリット**:
- 非常にシンプル
- 依存が少ない（`lsof`, `ps` のみ）

**デメリット**:
- cd しない限りクリーンアップされない

---

### 第3案: **E案 + stop-serena.sh 提供**

**最もシンプルだが、ユーザー体験は悪い**

```bash
#!/usr/bin/env bash
# .claude/hooks/einja/stop-serena.sh

SERENA_PID=$(lsof -ti:24282 2>/dev/null || true)
if [ -n "$SERENA_PID" ]; then
  echo "Stopping Serena (PID: $SERENA_PID)"
  kill "$SERENA_PID"
else
  echo "Serena is not running"
fi
```

**ドキュメント**: `docs/einja/instructions/serena-process-management.md` を追加

---

## 最終推奨

### **第1案（D + 軽量版A）を推奨** ⭐⭐⭐

**理由**:
1. **シンプルさと信頼性のバランス**: 80行程度で実装可能、かつ自動停止機能を持つ
2. **テンプレート配布に最適**: `.envrc` に source するだけで動作
3. **ユーザー体験**: 透過的に動作し、「驚きの原則」に反しない
4. **macOS/Linux両対応**: 標準コマンドのみ使用

**補足対応**:
- `docs/einja/instructions/serena-troubleshooting.md` にログ確認方法を記載
- `.gitignore` に `~/.serena/` を追加（リポジトリには含めない）

---

## 参考資料

### Serena 関連
- [Serena GitHub Repository](https://github.com/oraios/serena)
- [Serena Configuration](https://oraios.github.io/serena/02-usage/050_configuration.html)
- [Serena Client Connection](https://oraios.github.io/serena/02-usage/030_clients.html)
- [Serena MCP Error Issues](https://github.com/oraios/serena/issues/898)
- [Dashboard Timeout Issues](https://github.com/oraios/serena/issues/648)

### MCP Protocol
- [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [SEP-1359: Protocol-Level Sessions](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1359)
- [State and Connection Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/102)

### direnv
- [Unload hook · Issue #129 · direnv/direnv](https://github.com/direnv/direnv/issues/129)
- [direnv Manual](https://direnv.net/man/direnv.1.html)

---

## 次のステップ

1. ユーザーに推奨案（第1案）を提示
2. 承認後、`ensure-serena.sh` 実装
3. `.envrc` への統合
4. `docs/einja/instructions/serena-troubleshooting.md` 作成
5. テンプレート配布用の `presets/default/` に反映
