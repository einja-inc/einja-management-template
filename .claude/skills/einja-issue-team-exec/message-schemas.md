# メッセージプレフィックス規約

Director間・Lead間の全メッセージは以下のプレフィックスで分類する:

| プレフィックス | 方向 | 用途 | 送信方式 |
|--------------|------|------|---------|
| `[progress]` | Director → Lead | タスク進捗報告 | message |
| `[task-claim]` | Director → All | タスク開始宣言 + 編集予定ファイル | broadcast |
| `[change-summary]` | Director → All | タスク完了時の変更サマリ | broadcast |
| `[conflict-alert]` | Director ↔ Director | ファイル競合警告 | message（当事者間） |
| `[conflict-resolved]` | Director → Lead | コンフリクト調整完了報告 | message |
| `[peer-review]` | Director → Director | ピアレビュー提案 | message（対象者のみ） |
| `[peer-review-ack]` | Director → Director | ピアレビュー応答 | message（提案元のみ） |
| `[ci-failure]` | Lead → Director | CI失敗通知・修正指示 | message |
| `[error]` | Director → Lead | エラー報告 | message |
| `[idle]` | Director → Lead | アイドル通知 | message |
| `[pr-ready]` | Director → Lead | PR作成完了・ゲートチェック要求 | message |
| `[verdict]` | Lead → Director | ゲートチェック結果（approved/fix_required/rejected） | message |
| `[review-failed]` | Director 内部 | reviewer 差し戻し対象タスク特定 | — |
| `[qa-failed]` | Director 内部 | QA失敗対象タスク特定 | — |

## broadcastコスト管理

- **broadcast許可**: `[task-claim]`, `[change-summary]` の2種のみ
- **それ以外は全て message**（当事者間のみ）でコンテキスト消費を最小化
- broadcastコストはTeamサイズに比例するため、プールサイズ（最大5）を超えない設計で抑制

## メッセージスキーマ

### [task-claim]
    [task-claim] Task {X.Y}: {タスク名}
    Files: {編集予定ファイルリスト（カンマ区切り）}
    Director: {Director名}

### [change-summary]
    [change-summary] Task {X.Y}: {タスク名}
    PR: #{PR番号}
    Changed files: {全変更ファイルパス（カンマ区切り）}
    Changed shared: {shared/配下の変更ファイル or "なし"}
    New API: {エンドポイント or "なし"}
    New types: {型名 or "なし"}
    DB changes: {テーブル/カラム or "なし"}
    Note: {申し送り事項 or "なし"}

### [peer-review]
    [peer-review] Task {X.Y} へのレビュー
    {観点}: {提案内容}

### [peer-review-ack]
    [peer-review-ack] Task {X.Y} レビュー応答
    Status: {adopted|rejected|escalated}
    Comment: {対応内容 or 却下理由 or "Leadにエスカレーション"}

### [conflict-alert]
    [conflict-alert] ファイル競合検知
    Conflicting files: {重複ファイルリスト}
    My task: {自分のタスク番号}
    Your task: {相手のタスク番号}
    Proposal: {調整提案}

### [pr-ready]
    [pr-ready] Task {X.Y}: PR #{PR番号}

### [verdict]
    [verdict] Task {X.Y}: {approved|fix_required|rejected}
    fixInstructions: {修正内容（fix_required時のみ）}

### [review-failed]
    [review-failed] TaskID: {X.Y.Z}, Reason: {差し戻し理由}

### [qa-failed]
    [qa-failed] TaskID: {X.Y.Z}, Reason: {失敗理由}, Category: {A|B|C|D}
