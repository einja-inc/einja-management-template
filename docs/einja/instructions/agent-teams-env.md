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

### 1-2. Claude Code プラットフォームが自動で提供する変数

フック実装はこれらの変数を `${VAR:-}` 形式で参照しており、未提供環境でも fail せず exit 0 で抜ける設計になっている（後方互換のため）。

| 変数名 | 提供元 | 役割 |
|--------|--------|------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | プラットフォーム / ユーザー | Agent Teams 機能の有効化フラグ。`1` 以外の場合フックは即 exit 0 |
| `CLAUDE_CODE_TEAMMATE_MODE` | プラットフォーム | `tmux` / `in-process` のチーム実行モード。`tmux` 以外の場合フックはシグナルを生成しない |
| `CLAUDE_CODE_TASK_ID` | プラットフォーム（v2.1.33+） | `TaskCompleted` フックで参照する Task ID。`task-completed.sh` がシグナルファイル名 `task-${CLAUDE_CODE_TASK_ID}-completed.signal` に埋め込む |
| `CLAUDE_CODE_TEAMMATE_NAME` | プラットフォーム（v2.1.33+） | `TeammateIdle` フックで参照する Teammate 名。`teammate-idle.sh` がシグナルファイル名 `teammate-idle-${CLAUDE_CODE_TEAMMATE_NAME}.signal` に埋め込む |
| `CLAUDE_CODE_SESSION_ID` / `CLAUDE_SESSION_ID` | プラットフォーム（提供される場合） | `EINJA_SESSION_ID` 未設定時のフォールバック解決順序の一部 |

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

フックが書き込むシグナルファイルは Lead の監視ループが poll する。

| ディレクトリ | `$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/` |
|------------|-----------------------------------------------------|
| TaskCompleted | `task-${CLAUDE_CODE_TASK_ID}-completed.signal` |
| TeammateIdle | `teammate-idle-${CLAUDE_CODE_TEAMMATE_NAME}.signal` |

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
| `task-${...}` のシグナル名が `task-unknown-...` になる | `CLAUDE_CODE_TASK_ID` が提供されていない（Claude Code バージョンが古い可能性） |
| `teammate-idle-unknown.signal` が生成される | `CLAUDE_CODE_TEAMMATE_NAME` が提供されていない（同上） |
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
2. `einja-team-exec` / `einja-issue-team-exec` Skill を起動
3. Skill が内部で `TeamCreate` の `instructions` に Teammate 用 export を含めるため、ユーザー側で追加設定は不要
4. 動作確認: `/tmp/einja-hooks-debug.log` にフック起動ログが現れること、`$HOME/.einja/sessions/${EINJA_SESSION_ID}/signals/` にシグナルファイルが生成されることを確認

---

## 6. 参照

- フック実装: [`.claude/hooks/einja/task-completed.sh`](../../../.claude/hooks/einja/task-completed.sh)
- フック実装: [`.claude/hooks/einja/teammate-idle.sh`](../../../.claude/hooks/einja/teammate-idle.sh)
- Skill: [`.claude/skills/einja-team-exec/SKILL.md`](../../../.claude/skills/einja-team-exec/SKILL.md)
- Skill: [`.claude/skills/einja-issue-team-exec/SKILL.md`](../../../.claude/skills/einja-issue-team-exec/SKILL.md)
- 公式 Claude Code hooks ドキュメント: https://code.claude.com/docs/en/hooks
