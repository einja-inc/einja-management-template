# タスク生成 Skill

## 概要

このSkillは、要件定義書（requirements.md）と設計書（design.md）に基づいて、GitHub Issueにタスク一覧を生成します。

## 責務

- タスク一覧の生成（検証・修正は行わない）
- エラーフィードバック付きで呼び出された場合は修正版を生成

## 使用タイミング

- spec-tasks-generator サブエージェントから呼び出される
- spec-create コマンドのタスク生成フェーズで使用

## 入力

### 必須入力
- `spec_directory`: 仕様書ディレクトリパス（requirements.md, design.md, qa-tests/を含む）
- `issue_number`: GitHub Issue番号（既存Issueを更新する場合）

### オプション入力
- `error_feedback`: バリデーション失敗時のエラーレポート（Markdown形式）
  - 差し戻し時に渡される
  - このフィードバックを元に修正版を生成

## 出力

GitHub Issueの本文（Markdown形式）:
- AS-IS / TO-BE / 対応方針
- タスク一覧（Phase → タスクグループ → タスク → サブタスク）

## フォーマットルール

**[タスク管理ガイドライン](../../../docs/einja/steering/task-management.md)** を必ず参照。

### クイックリファレンス

| 階層 | 書式 |
|------|------|
| Phase | `### Phase 1: [名前]` |
| タスクグループ | `- [ ] 1.1 [名前]` |
| タスク | `  - 1.1.1 [名前]` + メタデータ |

### タスクの必須メタデータ

各タスク（X.Y.Z）に以下を必ず付与：
- **要件**: Story X
- **依存関係**: なし / X.Y / Phase X完了
- **完了条件**: [条件]（ACX.Xを満たす）
- **対応設計**: design.md「[セクション名]」
- **実装AC**: ACX.X, ACX.Y（このタスクで実装するAC番号）
- **シナリオテスト**: なし / シナリオX Step Y-Z

## TDDデフォルト適用

**原則**: ロジック・コード実装があるタスクは**TDDをデフォルトで適用**する。

| 対象 | TDD適用 |
|------|---------|
| Domain/UseCase/Validator/Repository | **適用** |
| API実装、UI実装 | **適用** |
| 設定ファイル、マイグレーション、シードデータ | 不適用 |

**注意**: requirements.mdへの「TDD採用」明記は不要。

### TDDタスク構造テンプレート

TDDは**1タスク内のサブタスク**として記載（3タスク分割ではない）：

```markdown
- X.Y.Z 機能名の実装（TDD）
  - **テスト作成（Red）**:
    - [テスト内容]
  - **実装（Green）**:
    - [実装内容]
  - **リファクタリング**:
    - [改善内容]
  - **要件**: Story X
  - **依存関係**: ...
  - **完了条件**: ...
  - **対応設計**: ...
  - **実装AC**: ACX.X, ACX.Y
  - **シナリオテスト**: ...
```

詳細は[タスク管理ガイドライン](../../../docs/einja/steering/task-management.md)の「TDDタスク構造」セクションを参照。

## エラーフィードバック対応

`error_feedback` が渡された場合：
1. エラーレポートを解析
2. 指摘された問題を特定
3. 修正版のタスク一覧を生成
4. 同じエラーを繰り返さないよう注意

## 関連ドキュメント

- [タスク管理ガイドライン](../../../docs/einja/steering/task-management.md) - フォーマット定義（Single Source of Truth）
- [spec-tasks-generator サブエージェント](../../agents/einja/specs/spec-tasks-generator.md) - 呼び出し元
