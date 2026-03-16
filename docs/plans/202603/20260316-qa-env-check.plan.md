# 外部API連携機能のQA品質ギャップ修正

## Context

Issue #130（音声通話機能）の実装で、OPENAI_API_KEYが未設定のまま全テストがモックのみで通過し、QAがSUCCESS判定した。
実際にAPIと通信して動作することが一度も確認されないまま、PRがレビュー待ちになった。

**原因**: ルール（`acceptance-criteria-and-qa-guide.md`）には「実際のインフラ接続」「動作確認なしでSUCCESS禁止」と書いてあるが、エージェントが実行時に参照する手順書（`_einja-task-qa/SKILL.md`）には、それを強制する具体的なチェックステップがない。

## 設計方針（レビュー反映）

1. **BLOCKEDステータスは新設しない**: 既存の `FAILURE + failureCategory=D（環境問題）` に統一
2. **外部API判定は機械的に**: 実装コード内の `process.env.` 参照を検索して必要な環境変数を特定
3. **task-execの環境チェックは警告のみ**: 必須チェックはQA（task-qa）で実施
4. **worktree不要**: ドキュメント・Skill定義のみの変更

## 変更内容

### 修正1: `_einja-task-qa/SKILL.md`
- ステップ4冒頭に環境前提条件チェック追加
- ステップ4完了後にモックのみテスト検出追加

### 修正2: `einja-task-exec/SKILL.md`
- Step 1.5: 環境前提条件チェック（警告のみ）追加

### 修正3: `acceptance-criteria-and-qa-guide.md`
- セクション4のエージェント指示に外部API動作確認禁止事項追加

### 修正4: `issue-exec-protocol.md`
- Fast Gateに外部API動作確認チェック項目追加
