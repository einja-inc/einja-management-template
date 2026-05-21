# 実装例ディレクトリ

このディレクトリには、完全に実装されたタスクの例が含まれています。

## 収録例

### sample-attendance-saas: プロジェクト全体ドキュメント例

受託開発のSaaSプロジェクトを想定した、プロジェクト全体合意ドキュメントの完全サンプル群。

- [requirements.md](specs/projects/sample-attendance-saas/requirements.md) — プロジェクト要件定義書（einja-project-requirements 出力例）
- [screen-flow-url.md](specs/projects/sample-attendance-saas/screen-flow-url.md) — 画面遷移図manifest（einja-project-screen-flow-figma 出力例）
- [function-specs/index.md](specs/projects/sample-attendance-saas/function-specs/index.md) — 業務フロー機能仕様 一覧（einja-project-function-spec 出力例）

**学習ポイント**:
- 業務フロー単位の機能仕様書の章立て（sequenceDiagram、ステップ別表、機能一覧、関連画面）
- N対N関係の表現（共通基盤機能 FN-005 通知配信機能を2業務フローで共有）
- stable_id 経由の業務フロー↔画面の双方向トレーサビリティ

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
- qa-tests/story{N}.md の形式を確認
- 失敗時の報告方法を参考にする

## 次のステップ

実装例を確認したら:
1. [テンプレート](../templates/) を使用して新規タスクを作成
2. task-exec コマンドで自動化されたワークフローを実行
3. [受け入れ基準とQAガイド](../steering/acceptance-criteria-and-qa-guide.md) で詳細を確認
