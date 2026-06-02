# メッセージプレフィックス規約

## 目次

- [プレフィックス一覧](#プレフィックス一覧)
- [broadcastコスト管理](#broadcastコスト管理)
- [メッセージスキーマ](#メッセージスキーマ)
  - [[task-claim]](#task-claim)
  - [[progress]](#progress)
  - [[idle]](#idle)
  - [[error]](#error)
  - [[change-summary]](#change-summary)
  - [[conflict-alert]](#conflict-alert)
  - [[conflict-resolved]](#conflict-resolved)
  - [[peer-review]](#peer-review)
  - [[peer-review-ack]](#peer-review-ack)
  - [[ci-failure]](#ci-failure)
  - [[pr-ready]](#pr-ready)
  - [[verdict]](#verdict)
- [シグナルファイル命名規則](#シグナルファイル命名規則)

## プレフィックス一覧

Director間・Lead間の全メッセージは以下のプレフィックスで分類する:

| プレフィックス | 方向 | 用途 | 送信方式 |
|--------------|------|------|---------|
| `[task-claim]` | Director → All | タスク開始宣言 + 編集予定ファイル | broadcast |
| `[progress]` | Director → Lead | タスク進捗報告 | message |
| `[idle]` | Director → Lead | アイドル通知（claimable タスクなし） | message |
| `[error]` | Director → Lead | エラー報告・エスカレーション | message |
| `[change-summary]` | Director → All | タスク完了時の変更サマリ | broadcast |
| `[conflict-alert]` | Director ↔ Director | ファイル競合警告 | message（当事者間） |
| `[conflict-resolved]` | Director → Lead | コンフリクト調整完了報告 | message |
| `[peer-review]` | Director → Director | ピアレビュー提案 | message（対象者のみ） |
| `[peer-review-ack]` | Director → Director | ピアレビュー応答 | message（提案元のみ） |
| `[ci-failure]` | Lead → Director | CI失敗通知・修正指示 | message |
| `[pr-ready]` | Director → Lead | PR準備完了・ゲートチェック要求 | message |
| `[verdict]` | Lead → Director | 品質ゲート判定結果 | message |

## broadcastコスト管理

- **broadcast許可**: `[task-claim]`, `[change-summary]` の2種のみ
- **それ以外は全て message**（当事者間のみ）でコンテキスト消費を最小化
- broadcastコストはTeamサイズに比例するため、プールサイズ（最大5）を超えない設計で抑制

---

## メッセージスキーマ

### [task-claim]

タスクの claim 開始を全 Director に通知し、ファイル競合を早期検出する。

- **送信者**: Director
- **受信者**: All（broadcast）
- **タイミング**: TaskUpdate で status を `in_progress` に変更した直後

**フォーマット**:

```
[task-claim] Task {ID}: {タスク名}
Files: {編集予定ファイルリスト（カンマ区切り）}
Director: {Director名}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | タスク識別子（TaskList の ID） |
| `{タスク名}` | 必須 | タスクの概要名 |
| `Files` | 必須 | 編集予定ファイルパスのカンマ区切りリスト |
| `Director` | 必須 | 送信元 Director の Teammate 名 |

---

### [progress]

タスクの進捗状況を Lead に報告する。

- **送信者**: Director
- **受信者**: Lead
- **タイミング**: 各サブタスクの開始時・完了時、および重要なマイルストーン到達時

**フォーマット**:

```
[progress] Task {ID}: {started|completed|in_progress} - {タスク名}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | タスク識別子 |
| ステータス | 必須 | `started` / `completed` / `in_progress` のいずれか |
| `{タスク名}` | 必須 | タスクの概要名 |

---

### [idle]

claimable なタスクがないことを Lead に通知し、新タスク割り当てまたはシャットダウン指示を待機する。

- **送信者**: Director
- **受信者**: Lead
- **タイミング**: self-claim ループで claimable タスクが見つからなかったとき

**フォーマット**:

```
[idle] Director {Director名}: 待機中
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Director {Director名}` | 必須 | 送信元 Director の Teammate 名 |
| メッセージ | 任意 | 補足情報（アイドル理由等） |

---

### [error]

回復不能なエラーまたはリトライ超過を Lead にエスカレーションする。

- **送信者**: Director
- **受信者**: Lead
- **タイミング**: Worker 失敗（リトライ2回超過）、コンフリクト調整タイムアウト、PR作成失敗等

**フォーマット**:

```
[error] Task {ID}: {エラー内容}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | エラーが発生したタスクの識別子 |
| `{エラー内容}` | 必須 | エラーの概要（原因・試行回数・影響範囲を含む） |

---

### [change-summary]

タスク完了時の変更内容を全 Director に共有し、ファイルマップの更新と依存関係の把握を促す。

- **送信者**: Director
- **受信者**: All（broadcast）
- **タイミング**: タスクのコミット・プッシュ完了後

**フォーマット**:

```
[change-summary] Task {ID}: {タスク名}
Changed files: {全変更ファイルパス（カンマ区切り）}
Changed shared: {共有ディレクトリ配下の変更ファイル or "なし"}
New API: {エンドポイント or "なし"}
New types: {型名 or "なし"}
DB changes: {テーブル/カラム or "なし"}
Note: {申し送り事項 or "なし"}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | タスク識別子 |
| `{タスク名}` | 必須 | タスクの概要名 |
| `Changed files` | 必須 | 変更された全ファイルパス |
| `Changed shared` | 必須 | 共有ディレクトリ（shared/ 等）配下の変更。なければ "なし" |
| `New API` | 任意 | 新規追加されたAPIエンドポイント。なければ "なし" |
| `New types` | 任意 | 新規追加された型定義。なければ "なし" |
| `DB changes` | 任意 | DBスキーマ変更（テーブル/カラム追加・変更）。なければ "なし" |
| `Note` | 任意 | 他 Director への申し送り事項。なければ "なし" |

---

### [conflict-alert]

編集予定ファイルの重複を検知した際に、当事者間で調整を開始する。

- **送信者**: Director
- **受信者**: Director（競合相手のみ）
- **タイミング**: `[task-claim]` 受信時に自分の編集予定ファイルとの重複を検出したとき

**フォーマット**:

```
[conflict-alert] ファイル競合検知
Conflicting files: {重複ファイルリスト}
My task: {自分のタスク番号}
Your task: {相手のタスク番号}
Proposal: {調整提案}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Conflicting files` | 必須 | 競合するファイルパスのリスト |
| `My task` | 必須 | 送信側のタスク番号 |
| `Your task` | 必須 | 受信側のタスク番号 |
| `Proposal` | 必須 | 調整提案（ファイル分割、作業順序、編集範囲の限定等） |

**タイブレークルール**: 合意できない場合、タスク番号が小さい側が優先編集権を持つ。5分以内に合意できない場合は Lead にエスカレーション。

---

### [conflict-resolved]

コンフリクト調整が完了したことを Lead に報告する。

- **送信者**: Director
- **受信者**: Lead
- **タイミング**: `[conflict-alert]` による当事者間調整が完了したとき

**フォーマット**:

```
[conflict-resolved] ファイル競合解消
Tasks: {関係タスク番号リスト}
Resolution: {解消方法の要約}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Tasks` | 必須 | 競合に関係したタスク番号のリスト |
| `Resolution` | 必須 | どのように解消したかの要約（ファイル分割、直列化、範囲限定等） |

---

### [peer-review]

アイドル時に他 Director のコードをレビューし、改善提案を送る。

- **送信者**: Director
- **受信者**: Director（対象タスク担当者のみ）
- **タイミング**: 自タスク完了後のアイドル時間、CI待ち・マージ待ち中

**フォーマット**:

```
[peer-review] Task {ID} へのレビュー
{観点}: {提案内容}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | レビュー対象タスクの識別子 |
| `{観点}` | 必須 | レビュー観点（重複実装、型/util共有化、API形式整合性、コンフリクト予防等） |
| `{提案内容}` | 必須 | 具体的な改善提案 |

**注意**: claimable タスクが出現したらレビューを即中断し、claim を優先する。

---

### [peer-review-ack]

ピアレビュー提案に対する応答を返す。

- **送信者**: Director
- **受信者**: Director（提案元のみ）
- **タイミング**: `[peer-review]` 受信後、提案の採否を判断したとき

**フォーマット**:

```
[peer-review-ack] Task {ID} レビュー応答
Status: {adopted|rejected|escalated}
Comment: {対応内容 or 却下理由 or "Leadにエスカレーション"}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | レビュー対象タスクの識別子 |
| `Status` | 必須 | `adopted`（採用）/ `rejected`（却下）/ `escalated`（Lead判断委任） |
| `Comment` | 必須 | 採用時は対応内容、却下時は理由、エスカレーション時は "Leadにエスカレーション" |

---

### [ci-failure]

CI失敗を検知した Lead が、該当 Director に修正を指示する。

- **送信者**: Lead
- **受信者**: Director（該当タスク担当者）
- **タイミング**: GitHub Actions 等の CI が失敗を報告したとき

**フォーマット**:

```
[ci-failure] Task {ID}: CI失敗
Job: {失敗したジョブ名}
Error: {エラー概要}
Fix instructions: {修正指示}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | CI失敗に関連するタスクの識別子 |
| `Job` | 必須 | 失敗した CI ジョブ名 |
| `Error` | 必須 | エラーメッセージの概要 |
| `Fix instructions` | 任意 | 具体的な修正指示（Lead が特定できた場合） |

---

### [pr-ready]

タスクの PR が作成完了し、Lead による品質ゲートチェックを要求する。

- **送信者**: Director
- **受信者**: Lead
- **タイミング**: PR 作成完了後（コミット・プッシュ済み）

**フォーマット**:

```
[pr-ready] Task {ID}: PR準備完了
Branch: {ブランチ名}
Changed files: {変更ファイル数}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | タスク識別子 |
| `Branch` | 必須 | PR のソースブランチ名 |
| `Changed files` | 任意 | 変更ファイル数（概要把握用） |

---

### [verdict]

品質ゲートの判定結果を Director に通知する。

- **送信者**: Lead
- **受信者**: Director（該当タスク担当者）
- **タイミング**: `[pr-ready]` またはタスク完了報告を受けて品質ゲートを実施した後

**フォーマット**:

```
[verdict] Task {ID}: {approved|fix_required|rejected}
fixInstructions: {修正内容（fix_required時のみ）}
```

| フィールド | 必須/任意 | 説明 |
|-----------|----------|------|
| `Task {ID}` | 必須 | タスク識別子 |
| 判定 | 必須 | `approved`（承認）/ `fix_required`（修正要求）/ `rejected`（却下） |
| `fixInstructions` | 条件付き必須 | `fix_required` 時のみ必須。具体的な修正内容を記載 |

**Director の動作**:

| verdict | 動作 |
|---------|------|
| `approved` | worktree 削除 → 次タスク claim |
| `fix_required` | fixInstructions に従い修正 → 再報告（最大2回。3回目 NG → rejected 扱い） |
| `rejected` | エラー報告 → worktree 削除 → 次タスク claim |

---

## シグナルファイル命名規則

並列実行環境では「待機ループの起床トリガー」として軽量なシグナルファイルを使う。プロジェクトには **3 系統**のシグナルファイル命名規則が併存しており、用途と処理ルートが異なる。新規シグナルを追加する際は、必ず該当系統の prefix 規則に従うこと。

### 3 系統の対応表

| 系統 | 命名パターン | 配置場所 | 監視者 | 処理ルート | 用途 |
|------|------------|---------|--------|----------|------|
| **tmux 系** | `worker-{X.Y}.signal` | `${SESSION_PATH}/signals/` | 親ペイン（tmux orchestrator） | tmux ペイン分割実行（einja-issue-exec） | Worker ペイン完了通知 |
| **tmux 系** | `question-{UUID}.signal` | `${SESSION_PATH}/signals/` | 親ペイン | tmux ペイン分割実行 | AskUserQuestion 代替（Worker → 親の確認要求） |
| **tmux 系** | `permission-warning-{X.Y}.signal` | `${SESSION_PATH}/signals/` | 親ペイン | tmux ペイン分割実行 | 権限承認待ち状態の通知 |
| **Agent Teams 系** | `director-{ID}-complete.signal` | `${SESSION_PATH}/signals/` | Lead Teammate | Agent Teams（einja-team-exec / einja-issue-team-exec） | Director のタスク完了通知 |
| **Agent Teams 系** | `director-{ID}-error.signal` | `${SESSION_PATH}/signals/` | Lead Teammate | Agent Teams | Director のエラー報告 |
| **Agent Teams 系** | `director-{ID}-idle.signal` | `${SESSION_PATH}/signals/` | Lead Teammate | Agent Teams | Director のアイドル通知（claimable なし） |
| **Platform hooks 系** | `teammate-idle-{TEAMMATE}.signal` | `${SESSION_PATH}/signals/` | Lead / orchestrator | Claude Code Platform hooks | Teammate プロセスの idle 状態通知 |
| **Platform hooks 系** | `task-{TASK_ID}-completed.signal` | `${SESSION_PATH}/signals/` | Lead / orchestrator | Claude Code Platform hooks | TaskList の status 遷移検知 |

### prefix 規則と意味

| Prefix | 意味 | 処理ルート | 監視側の動作 |
|--------|------|----------|------------|
| `worker-` | tmux ペインで実行中の Worker からの通知 | tmux orchestrator（einja-issue-exec） | 該当ペインの出力を取り込み、次タスク割り当て判断 |
| `question-` | Worker が親に確認要求（AskUserQuestion 代替） | tmux orchestrator | 親が AskUserQuestion を実施し、回答を Worker に転送 |
| `permission-warning-` | 権限承認プロンプトで Worker が停止中 | tmux orchestrator | 親が承認操作を実施 |
| `director-{ID}-` | Agent Teams 構成での Director からの状態通知 | Lead Teammate（Agent Teams） | bash 待機ループを抜けて SendMessage 受信処理へ |
| `teammate-idle-` | Claude Code Platform が検知した Teammate の idle | Platform hooks → Lead | Lead が新タスク割り当てまたはシャットダウン判断 |
| `task-` | TaskList の状態遷移を Platform が検知 | Platform hooks → Lead | Lead が依存タスクの blocked 解除等を実施 |

### 共通ルール

- **配置場所**: 全系統共通で `${SESSION_PATH}/signals/` 配下に配置する
- **ファイル内容**: 0バイトの空ファイルで運用する（存在自体がトリガー）。詳細情報は SendMessage で別途送信する
- **削除タイミング**: 監視側がトリガーを処理した直後に削除する（再起床を防ぐため）
- **作成タイミング**: 送信側は SendMessage 送信**後に**シグナルファイルを作成する（受信側が SendMessage 取得済みであることを保証するため）
- **冪等性**: 同じシグナルファイルが重複作成されても問題ないよう、監視側は idempotent な処理を実装する

### 新規シグナル追加のガイドライン

1. **既存系統で表現できるか確認する** — 新しい prefix を増やす前に、既存 prefix のバリエーション（`{ID}-` の suffix 拡張等）で表現できないか検討する
2. **処理ルートを明示する** — 新規 prefix を追加する場合は、上記の3系統のいずれに属するか、または新系統として独立させるかを明確にする
3. **本表に追記する** — 新規シグナルを実装する際は、必ずこの表に行を追加してドキュメント化する
