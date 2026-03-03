# Claude Code Agent Teams 技術調査レポート

## 調査概要

**日付**: 2026-02-27
**調査目的**: Worker プロセスでの Agent Teams 実装に向けて、`claude -p` (pipe/headless) モードでの Agent Teams 動作を調査

---

## 🔍 調査結果サマリー

| 調査項目 | 結果 | 影響度 |
|---------|------|--------|
| `-p` モードで Agent Teams は動作するか | ❌ **動作しない** | **高（致命的）** |
| Teammate の起動方法 | tmux/iTerm2 split panes または in-process | 中 |
| `-p` モードでの AskUserQuestion | ⚠️ **制限あり** | 中 |
| Worker 推奨実行モード | 対話モード必須 | 高 |

---

## 1. Agent Teams は `claude -p` モードで動作するか？

### 結論: ❌ **動作しない**

Agent Teams は**対話モードでのみ動作**します。`-p`（headless/pipe）モードでは使用できません。

### 根拠

公式ドキュメントから以下が明確です：

1. **Teammate の起動には tmux または iTerm2 が必要**
   - 公式ドキュメント: *"Agent teams support two display modes: In-process (all teammates run inside your main terminal) and Split panes (each teammate gets its own pane, requires tmux or iTerm2)"*
   - Split panes: tmux session または iTerm2 の split panes で Teammates を表示
   - In-process: 同一ターミナル内で動作、Shift+Down で切り替え

2. **Teammate との対話が前提**
   - *"Use Shift+Down to cycle through teammates and type to message them directly"*
   - *"After the last teammate, Shift+Down wraps back to the lead"*
   - *"You can message any teammate directly to give additional instructions"*
   - これらはすべて**対話型インターフェース**を前提としている

3. **`-p` モードは非対話的**
   - `-p` の説明: *"Print response and exit (useful for pipes)"*
   - *"The workspace trust dialog is skipped when Claude is run with the -p mode"*
   - stdin/stdout を通じた単発実行のみで、継続的な対話は不可能

### 技術的詳細

Agent Teams のアーキテクチャは以下の要素で構成されています：

| コンポーネント | 役割 |
|-------------|------|
| Team lead | メインセッション（チーム作成・Teammate spawn・調整） |
| Teammates | 独立した Claude Code インスタンス（タスク実行） |
| Task list | 共有タスクリスト（`~/.claude/tasks/{team-name}/`） |
| Mailbox | エージェント間メッセージングシステム |

**Teammate の spawn 方法**:
- **Split panes モード**: tmux session または iTerm2 split panes で新しいペインとして起動
- **In-process モード**: 同一プロセス内で動作、UI レイヤーで切り替え
- いずれも**対話型ターミナルセッション**が必須

**`-p` モードの動作**:
```bash
claude -p "タスク" --output-format json
# → 結果を出力して終了（継続的なセッションなし）
```

この単発実行モデルでは：
- Teammate の spawn・管理ができない
- 継続的な対話・メッセージングが不可能
- タスクリストの共有・更新ができない

---

## 2. Teammate の起動方法

### Split panes モード（推奨）

**tmux の場合**:
```bash
# Lead が Teammate を spawn すると...
# 新しい tmux pane が自動作成される
tmux new-session -s team-name
# Teammate それぞれが独立した pane で動作
```

**iTerm2 の場合**:
- `it2` CLI と Python API が必要
- iTerm2 の Native panes として表示
- より統合されたユーザー体験

**設定**:
```json
// settings.json
{
  "teammateMode": "tmux"  // or "in-process" or "auto"
}
```

### In-process モード（フォールバック）

- すべての Teammate が同一ターミナルプロセス内で動作
- Shift+Down で Teammate 間を切り替え
- tmux/iTerm2 不要（任意のターミナルで動作）
- 可視性が低い（一度に一つの Teammate しか見えない）

---

## 3. `claude -p` で AskUserQuestion が発生した場合の挙動

### 結論: ⚠️ **制限あり（完全なサポートなし）**

### 現状の動作

公式ドキュメントと GitHub Issue から：

1. **標準的な stdin/stdout は機能する**
   - `cat file.txt | claude -p "要約して"` のような基本的なパイプ処理は可能

2. **AskUserQuestion は非対話環境で制約がある**
   - GitHub Issue #16712: *"When resuming a session that ends with a tool_use (e.g., AskUserQuestion) using --input-format stream-json, the CLI should wait for stdin input before injecting any synthetic messages"*
   - 現状: AskUserQuestion が発生すると、CLI が**合成レスポンス**を自動注入する
   - 外部からの tool_result 提供方法がない

3. **Feature Request として未解決**
   - `--no-synthetic-response` フラグの追加が要望されているが未実装

### Worker での影響

Worker プロセスが `-p` モードで動作する場合：
- AskUserQuestion をファイル経由でエスカレーションする設計は困難
- 質問が発生すると合成レスポンスで処理が進んでしまう
- 人間の判断を必要とする場面で停止できない

---

## 4. Worker プロセスの推奨実行モード

### 結論: **対話モード必須**

Worker プロセスの要件：
- Agent Teams の Lead として動作する
- Lead 内で複数の Teammate を spawn
- Teammate が並列にタスクを実装

この構成で `-p` モードは使用できません。

### 推奨アーキテクチャ

#### パターン A: 対話モード Worker（フル機能）

```
Human
  ↓
Main Agent (対話モード)
  ↓
Worker Agent (対話モード) ← Agent Teams Lead
  ↓
  ├─ Teammate 1 (in-process or tmux pane)
  ├─ Teammate 2 (in-process or tmux pane)
  └─ Teammate N (in-process or tmux pane)
```

**メリット**:
- Agent Teams のフル機能が使える
- Teammate 間の直接メッセージング
- 共有タスクリストによる自律的な調整

**デメリット**:
- tmux または iTerm2 が必須（split panes モードの場合）
- CI/CD での自動実行が困難

#### パターン B: Subagents（軽量）

```
Human
  ↓
Main Agent (対話モード)
  ↓
Worker Agent (対話モード)
  ↓
  ├─ Subagent 1 (Worker のコンテキスト内)
  ├─ Subagent 2 (Worker のコンテキスト内)
  └─ Subagent N (Worker のコンテキスト内)
```

**メリット**:
- 追加の依存関係不要
- Worker プロセスだけで完結
- `-p` モードでも動作する

**デメリット**:
- Subagent 間の直接通信不可
- すべて Worker 経由で調整する必要がある
- トークンコストが Worker に集中

### 比較表

| 特性 | Agent Teams | Subagents |
|------|------------|----------|
| コンテキスト | 各 Teammate が独立したコンテキスト | Worker のコンテキスト内 |
| 通信 | Teammate 同士が直接メッセージング | Worker 経由でのみ通信 |
| 調整 | 共有タスクリストで自律的に調整 | Worker が全体を管理 |
| 適用場面 | 議論・協力が必要な複雑な作業 | 結果のみが重要な集中タスク |
| トークンコスト | 高（各 Teammate が独立） | 低（結果のみ Worker に返る） |
| `-p` モード | ❌ 不可 | ✅ 可能 |

---

## 5. CI/CD・自動化での Agent Teams 利用

### 結論: **直接利用は不可能**

Agent Teams は対話モードが必須のため、CI/CD パイプラインでの直接利用はできません。

### 代替アプローチ

#### オプション 1: Subagents を使う

```bash
# CI/CD で実行可能
claude -p "コードレビューを実行。Security/Performance/Test Coverage の3つの観点から並列で分析" \
  --allowedTools "Read,Grep,Bash(git *)" \
  --output-format json
```

- Worker が内部で Subagents を spawn
- 結果を統合して JSON で返す

#### オプション 2: Agent SDK（Python/TypeScript）

```python
# Python Agent SDK
from anthropic import Anthropic

client = Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "コードレビュー"}],
    tools=[...],  # Bash, Read, Edit etc.
)
```

- フル制御が可能
- カスタムの並列実行ロジックを実装
- Agent Teams の機能は含まれない

#### オプション 3: 複数の `-p` セッションを並列実行

```bash
# 並列実行（shell レベル）
claude -p "Security 観点でレビュー" --output-format json > security.json &
claude -p "Performance 観点でレビュー" --output-format json > performance.json &
claude -p "Test Coverage 観点でレビュー" --output-format json > test.json &
wait

# 結果を統合
jq -s '.' security.json performance.json test.json
```

- 最もシンプル
- セッション間の通信・調整はなし
- 結果の統合は外部で実施

---

## 📋 調査結論

### Worker プロセスでの Agent Teams 利用について

**結論**: `claude -p` モードでは Agent Teams は使用できません。

### 推奨する実装戦略

#### ケース 1: Worker に Agent Teams が必須の場合

**対話モードで Worker を実行する**:
- Worker を通常の `claude` セッションとして起動
- Worker 内で TeamCreate/SendMessage ツールを使用
- Teammates を spawn して並列実装

**制約**:
- CI/CD での完全自動化は不可
- tmux または iTerm2 が必要（split panes モードの場合）
- 人間が Worker セッションを起動・監視する必要がある

#### ケース 2: CI/CD での自動化が必須の場合

**Subagents を使用する**:
- Worker を `-p` モードで実行可能
- Worker が内部で Subagents を spawn
- Subagents 間の調整は Worker が担当

**制約**:
- Subagent 間の直接通信はない
- トークンコストが Worker に集中
- Agent Teams の協調機能は使えない

#### ケース 3: 最大限の並列性が必要な場合

**複数の `-p` セッションを並列実行**:
- Shell レベルで複数の `claude -p` を並列実行
- セッション間の調整なし
- 結果を外部で統合

**制約**:
- セッション間の情報共有なし
- 重複作業の可能性
- 統合ロジックを自前で実装

---

## 🎯 次のアクション

以下の判断が必要です：

1. **Worker の実行モードを決定**
   - 対話モード + Agent Teams（協調機能フル）
   - `-p` モード + Subagents（自動化優先）
   - 複数の `-p` セッション並列実行（シンプル）

2. **AskUserQuestion のエスカレーション戦略**
   - 対話モードの場合: 通常の質問フローで対応可能
   - `-p` モードの場合: 質問が必要な設計を避ける

3. **CI/CD での利用シナリオ**
   - 完全自動化が必須か
   - 人間の承認フローが許容されるか

---

## 📚 参考資料

- [Orchestrate teams of Claude Code sessions - Claude Code Docs](https://code.claude.com/docs/en/agent-teams)
- [Run Claude Code programmatically - Claude Code Docs](https://code.claude.com/docs/en/headless)
- [Claude Code Agent Teams: The Complete Guide 2026](https://claudefa.st/blog/guide/agents/agent-teams)
- [Agent Teams with Claude Code and Claude Agent SDK | Medium](https://kargarisaac.medium.com/agent-teams-with-claude-code-and-claude-agent-sdk-e7de4e0cb03e)
- [How to Set Up and Use Claude Code Agent Teams | Medium](https://darasoba.medium.com/how-to-set-up-and-use-claude-code-agent-teams-and-actually-get-great-results-9a34f8648f6d)
- [Feature Request: tool_result via stdin (GitHub Issue #16712)](https://github.com/anthropics/claude-code/issues/16712)

---

**調査完了日**: 2026-02-27
**調査者**: Claude (Sonnet 4.5)
