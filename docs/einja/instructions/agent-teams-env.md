# Agent Teams 環境変数とフック動作要件

Agent Teams（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）下で `einja-team-exec` / `einja-issue-team-exec` Skill を動作させる際に必要な環境変数と、`.claude/hooks/einja/` 配下のフックが期待する入力を整理する。

下流リポジトリ（`@einja-inc/create-app` 由来のプロジェクト含む）で Agent Teams を有効化する場合、Lead 役（=チーム実行 Skill を起動する Claude Code インスタンス）の起動時にこのドキュメントに記載の環境変数を export しておく必要がある。

---

## 1. 環境変数一覧

### 1-1. einja 側で設定が必要な変数

| 変数名 | 必須 | 役割 | 設定タイミング |
|--------|------|------|---------------|
| `EINJA_SESSION_ID` | **必須**（tmuxモード時） | フックが書き込むシグナルファイルの保存ディレクトリ（`$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/`）を決定するセッション識別子。Lead と全 Teammate で同じ値を共有する | Lead 起動時に export。`einja-team-exec` / `einja-issue-team-exec` Skill が `TeamCreate` の `instructions` で各 Teammate にも export させる |
| `EINJA_AGENT_ROLE` | 推奨 | 現在のインスタンスのロール識別子（例: `lead` / `director` / `worker`）。複数 Skill が同じシェルから起動された場合の動作切り分け・デバッグログのタグ付けに使用 | Lead 起動時 / Teammate spawn 時の `instructions` で export |
| `EINJA_TEAMMATE_MONITOR_MODE` | 任意 | **einja Lead の監視ループ挙動**（`tmux` / `in-process`）を明示指定する。未指定時は settings.json の top-level `teammateMode`（project→user）→ `auto` の順で解決し、`auto`/`tmux` は `$TMUX` + `tmux list-panes` 成功で `tmux`、失敗で `in-process` へ降格判定する（詳細: [`einja-team-exec/SKILL.md` Step 1-A](../../../.claude/skills/einja-team-exec/SKILL.md) 「Lead 監視モード resolve」） | Lead 起動時に export（任意） |

> **`teammateMode` / `--teammate-mode` / `EINJA_TEAMMATE_MONITOR_MODE` の役割分離**: `--teammate-mode`（CLI）と settings.json の `teammateMode` は **Claude Code 本体の teammate 起動モード**（tmux pane を split するか in-process で動かすか）を制御する。一方 `EINJA_TEAMMATE_MONITOR_MODE` は **einja Lead の監視ループ挙動**（シグナルファイル待機を駆動するか SendMessage/TaskList を主にするか）を制御する別レイヤーの設定であり、未指定時のフォールバックとして本体の `teammateMode` を参照する。

### 1-2. Claude Code プラットフォームが自動で提供する変数

フック実装はこれらの変数を `${VAR:-}` 形式で参照しており、未提供環境でも fail せず exit 0 で抜ける設計になっている（後方互換のため）。

| 変数名 | 提供元 | 役割 |
|--------|--------|------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | プラットフォーム / ユーザー | Agent Teams 機能の有効化フラグ。`1` 以外の場合フックは即 exit 0 |
| `CLAUDE_CODE_TASK_ID` | プラットフォーム（v2.1.33+） | `TaskCompleted` フックの Task ID **フォールバック**。フックは stdin JSON の `task_id` を優先し、未提供時のみこの env var を参照する。`task-completed.sh` が解決した値をシグナルファイル名 `task-${task_id}-completed.signal` に埋め込む |
| `CLAUDE_CODE_TEAMMATE_NAME` | プラットフォーム（v2.1.33+） | `TeammateIdle` フックの Teammate 名 **フォールバック**。フックは stdin JSON の `teammate_name` を優先し、未提供時のみこの env var を参照する。`teammate-idle.sh` が解決した値をシグナルファイル名 `teammate-idle-${teammate_name}.signal` に埋め込む |
| `CLAUDE_CODE_SESSION_ID` / `CLAUDE_SESSION_ID` | プラットフォーム（提供される場合） | `EINJA_SESSION_ID` 未設定時のフォールバック解決順序の一部 |

> **`CLAUDE_CODE_TEAMMATE_MODE` について**: 従来 einja は `.claude/settings.json` の `env` でこの変数を `tmux` として補完していたが、これは Claude Code が**公式に提供する env var ではなく**フックにも渡らないため廃止した。チーム実行モードは Lead 起動時の `claude --teammate-mode tmux` で指定する（後述の「5. 下流リポジトリでのセットアップ手順」を参照）。

---

## 2. TeamCreate 起動時の instructions で必須 export

`einja-team-exec` / `einja-issue-team-exec` Skill が `TeamCreate` を呼ぶ際、`instructions` 内に Teammate 起動時の export を含めること。

```bash
# Director Teammate / Worker 起動時の冒頭に必ず実行
export EINJA_SESSION_ID="<Lead で決定したセッションID>"
export EINJA_AGENT_ROLE="director"   # または "worker"
```

これにより、Teammate 側の Claude Code プロセス内から発火する `TaskCompleted` / `TeammateIdle` フックも、Lead と同じ `$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/` ディレクトリにシグナルを書き込む。

`EINJA_SESSION_ID` を export し忘れると、フックは以下のフォールバックを順に試みる:

1. `CLAUDE_CODE_SESSION_ID`
2. `CLAUDE_SESSION_ID`

いずれも未設定の場合、フックはセッションIDを解決できず、警告ログを残してシグナルを生成しない（Lead の監視ループがタイムアウトするまで気づけない）。**必ず明示的に export すること。**

---

## 3. シグナルファイル仕様

### 3-0. フックの入力（stdin JSON が主）

公式 Claude Code hooks（`TaskCompleted` / `TeammateIdle`）は **stdin に JSON を渡す**のが主入力である（公式: https://code.claude.com/docs/en/hooks ）。`task-completed.sh` / `teammate-idle.sh` はこの JSON を `jq` 等で解析し、以下のフィールドを参照する:

| フィールド | 用途 |
|-----------|------|
| `team_name` | 命名サフィックス（`-directors` / `-workers`）を除去して session id を復元する |
| `teammate_name` | `TeammateIdle` のシグナルファイル名に埋め込む Teammate 名 |
| `task_id` | `TaskCompleted` のシグナルファイル名に埋め込む Task ID |

stdin JSON にフィールドが含まれない場合のみ、対応する env var（`CLAUDE_CODE_TASK_ID` / `CLAUDE_CODE_TEAMMATE_NAME`）にフォールバックする。env var 依存を前提とせず、まず stdin JSON を主入力として扱うこと。

### 3-1. シグナルファイルの保存先

フックが書き込むシグナルファイルは Lead の監視ループが poll する。

| ディレクトリ | `$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/` |
|------------|-----------------------------------------------------|
| TaskCompleted | `task-${task_id}-completed.signal`（`task_id` は stdin JSON 優先、未提供時 `CLAUDE_CODE_TASK_ID`） |
| TeammateIdle | `teammate-idle-${teammate_name}.signal`（`teammate_name` は stdin JSON 優先、未提供時 `CLAUDE_CODE_TEAMMATE_NAME`） |

- 生成は `touch` のみ（中身は空）。`mtime` を Lead が確認することで完了/アイドルを検知する
- ディレクトリは `mkdir -p` で都度生成される

---

## 4. フックのデバッグログ

`task-completed.sh` / `teammate-idle.sh` は以下のパスに環境変数の存在状況をデバッグログとして追記する（値は記録しない）。

| パス | `/tmp/einja-hooks-debug.log` |
|------|-----------------------------|
| 内容 | フック起動時刻 / `CLAUDE_CODE_*` および `EINJA_*` 環境変数の **キーのみ**（値は `<set>` でマスク） |

### デバッグログの確認方法

```bash
tail -n 50 /tmp/einja-hooks-debug.log
```

### 想定する確認シナリオ

| 症状 | 確認ポイント |
|------|------------|
| Lead がいつまでも完了を検知しない | デバッグログに `EINJA_SESSION_ID=<set>` があるか。なければ `instructions` の export 漏れ |
| `task-${...}` のシグナル名が `task-unknown-...` になる | stdin JSON に `task_id` が無く、フォールバックの `CLAUDE_CODE_TASK_ID` も未提供（Claude Code バージョンが古い可能性） |
| `teammate-idle-unknown.signal` が生成される | stdin JSON に `teammate_name` が無く、フォールバックの `CLAUDE_CODE_TEAMMATE_NAME` も未提供（同上） |
| ログ自体が空 / 存在しない | フック自体が呼ばれていない。`settings.json` の `hooks` 設定を確認 |

### ログ運用上の注意

- `/tmp/einja-hooks-debug.log` は OS 再起動時にクリアされる
- 長期保存・分析が必要な場合は別途 `cp` で退避すること
- 値はマスク済みのため、ログを共有しても機密の漏洩リスクは低いが、念のためレビュー後に共有すること

---

## 5. 下流リポジトリでのセットアップ手順

1. Agent Teams を有効化する Claude Code インスタンスのシェルで以下を export
   ```bash
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
   export EINJA_SESSION_ID="$(date +%Y%m%d-%H%M%S)-$$"   # 任意の一意な値
   export EINJA_AGENT_ROLE="lead"
   ```
2. Lead（チーム実行 Skill を起動する Claude Code インスタンス）を起動する際、チーム実行モードを `--teammate-mode tmux` で明示する
   ```bash
   claude --teammate-mode tmux
   ```
   - CLI オプションは `settings.json` の設定より**優先**される。これを指定しないと teammate モードが `auto` で起動し、silent な in-process fallback（フックが発火せず Lead がシグナルを受け取れない状態）になり得るため、tmux ベースの監視を確実に動かすには明示すること
3. `einja-team-exec` / `einja-issue-team-exec` Skill を起動
4. Skill が内部で `TeamCreate` の `instructions` に Teammate 用 export を含めるため、ユーザー側で追加設定は不要
5. 動作確認: `/tmp/einja-hooks-debug.log` にフック起動ログが現れること、`$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/` にシグナルファイルが生成されることを確認

---

## 6. 参照

- フック実装: [`.claude/hooks/einja/task-completed.sh`](../../../.claude/hooks/einja/task-completed.sh)
- フック実装: [`.claude/hooks/einja/teammate-idle.sh`](../../../.claude/hooks/einja/teammate-idle.sh)
- Skill: [`.claude/skills/einja-team-exec/SKILL.md`](../../../.claude/skills/einja-team-exec/SKILL.md)
- Skill: [`.claude/skills/einja-issue-team-exec/SKILL.md`](../../../.claude/skills/einja-issue-team-exec/SKILL.md)
- 公式 Claude Code hooks ドキュメント: https://code.claude.com/docs/en/hooks
