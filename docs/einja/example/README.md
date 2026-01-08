# 実装例ディレクトリ

このディレクトリには、完全に実装されたタスクの例が含まれています。

## 収録例

### issue999-example-task: マジックリンク認証機能

**学習ポイント**:
- 包括的な要件定義（requirements.md）
- AC 番号体系と検証レベルの使い方
- 詳細な設計書（design.md）
- 段階的なタスク分解（tasks.md）
- Integration/E2E テストを含む QA 仕様書（qa-tests/）

## 活用方法

### 1. 全体の流れを理解する
- requirements.md → design.md → tasks.md → qa-tests/ の順で読む
- 各フェーズでどのような内容を記述すべきか確認

### 2. テンプレート記述の参考にする
- `../templates/` のテンプレートと照らし合わせる
- 各セクションの具体的な記述例を確認

### 3. QA 仕様書の構造を理解する
- qa-tests/phaseN/X-Y.md の形式を確認
- 失敗時の報告方法を参考にする

## 次のステップ

実装例を確認したら:
1. [テンプレート](../templates/) を使用して新規タスクを作成
2. task-exec コマンドで自動化されたワークフローを実行
3. [受け入れ基準とQAガイド](../steering/acceptance-criteria-and-qa-guide.md) で詳細を確認
