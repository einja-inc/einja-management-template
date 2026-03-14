# Director→Lead 進捗報告の追加

## Context
issue-team-execのTask APIはタスクグループ粒度（X.Y）で登録しており、グループ内の個別タスク（X.Y.Z）の進捗がLead側から見えない。DirectorがSendMessageで個別タスクの進捗をLeadに報告する仕組みを追加し、可視性を向上させる。

## 変更内容

対象ファイル: `.claude/skills/einja-issue-team-exec/SKILL.md`

### 1. Step 4: Director Teammateプロンプトテンプレート（~219行目付近）

タスク実行ステップ（3番）に進捗報告ルールを追加:
- 各個別タスク（X.Y.Z）の開始時・完了時にLeadへSendMessageで報告
- 形式: `[progress] Task {X.Y.Z}: {started|completed} - {タスク名}`

### 2. Step 5-1: SendMessage受信テーブル（~248行目）

| メッセージ種別 | 対応 |
|--------------|------|
| 進捗報告 | ログとして記録（ユーザーへの表示は任意） |

## 使用予定Skill・サブエージェント
- 実装: 親プロセスが直接Edit（SKILL.md 1ファイルのみ）

## 検証方法
- 変更後のSKILL.mdを読み、Step 4のプロンプトとStep 5-1のテーブルが整合していることを確認
