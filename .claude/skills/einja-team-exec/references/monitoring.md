# 監視ループ詳細（モード別設計）

このドキュメントは `SKILL.md` の Step 1-D で参照される監視ループの詳細仕様。

---

## シグナルファイル命名規則（3系統対応表）

Lead/Director/Worker 間で使用するシグナルファイルは、用途別に3系統に分かれる。
**配置先**: `~/.einja/sessions/{SESSION_NAME}/signals/`

| 系統 | ファイル名パターン | 用途 | 作成主体 | 処理ルート |
|------|------------------|------|---------|-----------|
| tmux系（Worker → Director） | `worker-{X.Y}.signal` | Worker pane 終了通知（tmux split時） | Worker pane のシェル後処理 | Director の bash 待機ループ |
| Agent Teams系（Director → Lead） | `director-{ID}-complete.signal` | Director がタスク完了を SendMessage 送信後に作成 | Director | Lead の bash 待機ループ（tmuxモード）/ 補助監視（in-process） |
| Agent Teams系（Director → Lead） | `director-{ID}-error.signal` | Director がエラー発生時に作成 | Director | 同上 |
| Agent Teams系（Director → Lead） | `director-{ID}-idle.signal` | Director がアイドル状態を通知 | Director | 同上 |
| Platform hooks系（補助） | `teammate-idle-{TEAMMATE}.signal` | `TeammateIdle` hook が自動作成 | Claude Code platform | Lead の補助監視 |
| Platform hooks系（補助） | `task-{TASK_ID}-completed.signal` | `TaskCompleted` hook が自動作成 | Claude Code platform | Lead の補助監視 |

### in-process モードでのシグナルファイル扱い

Agent Teams in-process モードでは Platform hooks 設定時にシグナルファイルが自動作成されるが、
これは **補助的な役割** に留まる。メイン通信路は SendMessage 受信であり、シグナルファイルは
SendMessage の取りこぼし検知や TaskList 監視のフォールバックとして使用する。

| モード | メイン通信 | シグナルファイル |
|-------|----------|----------------|
| tmuxモード | SendMessage + シグナルファイル | **必須**（bash 待機ループ駆動） |
| in-processモード（hooks有） | SendMessage 受信 | 補助（取りこぼし検知用） |
| in-processモード（hooks無） | SendMessage 受信のみ | 不使用 |

---

## Agent Teams モード（in-process）

Lead は SendMessage 受信 + TaskList 確認で状況を把握する（プラットフォーム標準動作）。

### Director からの SendMessage 受信

| メッセージ種別 | 対応 |
|--------------|------|
| `[progress]` | ログ記録（ユーザーへの表示は任意） |
| `[task-complete]` | 品質ゲート実施（Step 1-E） |
| `[error]` | リトライ判断 |
| `[idle]` | 残タスク状況確認 → 追加タスクがあれば通知 |
| `[task-claim]` (broadcast) | ログ記録 + Director-ファイルマップ更新 |
| `[change-summary]` (broadcast) | ログ記録 + ファイル競合俯瞰チェック |
| `[conflict-resolved]` | ログ記録 + 調整内容の妥当性簡易確認 |
| `[conflict-alert]`（タイムアウト時） | Lead が調整方針を決定し両 Director に指示 |

### フォールバック: Director 無応答検知

TaskList の最終更新から **10分以上** 変化がない Director を検出する:

1. 該当 Director に SendMessage ping 送信
2. 応答なし（さらに2分待機）→ ユーザーに報告

### Agent tool モード Worker の silent failure 検知

`run_in_background: true` で起動した Worker の TaskList ステータスを **60秒間隔** で確認:

1. `completed` だがシグナル（SendMessage）が来ていない → silent failure 判定
2. タスクを `failed` 扱いで再キュー
3. **30分タイムアウト** でユーザーエスカレーション

---

## tmux モード

シグナルファイル方式で Lead の bash 待機ループを駆動する。

```bash
SIGNAL_DIR=~/.einja/sessions/{session-name}/signals
mkdir -p "$SIGNAL_DIR"

# シグナルファイル待機（最大120秒、2秒間隔チェック）
for i in $(seq 1 60); do
  FOUND=$(ls "$SIGNAL_DIR"/*.signal 2>/dev/null)
  if [ -n "$FOUND" ]; then
    for f in $FOUND; do
      cat "$f"  # 内容読み取り（オプション）
      rm -f "$f"
    done
    echo "$FOUND"
    break
  fi
  sleep 2
done
```

### 通知チャネルの役割分担

| チャネル | 役割 |
|---------|------|
| シグナルファイル | 起床トリガー（Lead の bash 待機ループを即座に抜けさせる） |
| SendMessage | 内容通知（完了/エラー/進捗の詳細情報を運ぶ） |

- Director は SendMessage 送信**後に** `touch` でシグナルファイルを作成する
- Lead はシグナル受信後、SendMessage キューを両方チェックして処理する

### タイムアウトフォールバック

120秒無検知の場合:
1. ステータスファイル走査（`~/.einja/sessions/{session-name}/status/`）
2. Worker pane 生存確認: `tmux list-panes -t {session-name}`
3. 生存していれば待機継続、消滅していればユーザーに報告

---

## Platform hooks（補助・オプション）

`TeammateIdle` / `TaskCompleted` hook（v2.1.33+ で公式サポート確認済み — 出典: https://code.claude.com/docs/en/hooks ）を補助的に使用可能。

```jsonc
// settings.json
{
  "hooks": {
    "TeammateIdle": [{
      "type": "command",
      "command": "touch ~/.einja/sessions/$SESSION/signals/teammate-idle-$TEAMMATE.signal"
    }],
    "TaskCompleted": [{
      "type": "command",
      "command": "touch ~/.einja/sessions/$SESSION/signals/task-$TASK_ID-completed.signal"
    }]
  }
}
```

**必須ではない** — hooks 未設定でも SendMessage + シグナルファイル方式で動作する。
