# Issue仕様タスク生成 Skill

## 概要

このSkillは、要件定義書（requirements.md）と設計書（design.md）に基づいて、GitHub Issueにタスク一覧を生成します。

## 責務

- タスク一覧の生成（検証・修正は行わない）
- エラーフィードバック付きで呼び出された場合は修正版を生成

## 使用タイミング

- tasks-generator サブエージェントから呼び出される
- einja-issue-spec-create Skillのタスク生成フェーズで使用

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
- **実装AC**: ACX.X, ACX.Y（このタスクで実装するAC番号）
- **依存関係**: なし / X.Y / Phase X完了
- **完了条件**: [条件]（ACX.Xを満たす）
- **対応設計**: design.md「[セクション名]」
- **シナリオテスト**: なし / シナリオX Step Y-Z

### タスクの任意メタデータ

以下は任意項目。該当する場合に付与する：
- **実行サブエージェント**: `[エージェント名]`（例: `[frontend-coder]`, `[design-engineer]`, `[backend-architect]`）。**1つのみ指定可能（複数指定禁止）**
- **使用Skill**: `[Skill名]` or `[steering:ファイル名]`（例: `[einja-pencil-design-manager]`, `[steering:api-development]`）。複数指定はカンマ区切り
- **対応UIデザイン**: `ui-design.pen「フレーム名」`（例: `ui-design.pen「voice-call」「voice-call--ai-speaking」`）。UI実装を含むタスクにのみ付与

**継承ルール**: タスクグループレベルで指定した場合、配下の全タスクに継承される。タスクレベルで指定した場合はタスクグループの指定をオーバーライドする。サブエージェントはグループ・タスクとも1つのみ指定可能。

## サブエージェント・Skill の割り当て

タスク生成時、以下の情報源を参照して各タスクグループ/タスクに `実行サブエージェント` と `使用Skill` を付与すること：

1. **requirements.md** の「実装参考情報」セクション
2. **design.md** の「関連ドキュメント」「関連Skill・サブエージェント」セクション
3. **CLAUDE.md** の「委託ルール」対応表

上記に該当がない場合は省略してよい（任意項目のため）。

**サブエージェント指定の制約**:
- タスクグループレベル・タスクレベルとも **1タスクにつき1サブエージェントのみ** 指定可能
- 複数サブエージェントの指定は禁止（例: `[frontend-coder], [backend-architect]` は❌）
- 異なるサブエージェントが必要なタスクはタスクレベルで個別に指定する

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
  - **実装AC**: ACX.X, ACX.Y
  - **依存関係**: ...
  - **完了条件**: ...
  - **対応設計**: ...
  - **シナリオテスト**: ...
  - **実行サブエージェント**: [frontend-coder]（任意）
  - **使用Skill**: [einja-pencil-design-manager]（任意）
  - **対応UIデザイン**: ui-design.pen「フレーム名」（任意：UI実装タスクのみ）
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
- [tasks-generator サブエージェント](../../agents/einja/issue-specs/tasks-generator.md) - 呼び出し元

<!-- @einja:project-private:start id="_einja-issue-spec-tasks-generator" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
