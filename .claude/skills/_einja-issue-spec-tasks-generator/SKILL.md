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
- **使用Skill**: `[Skill名]` or `[steering:ファイル名]`（例: `[einja-common:figma-guide]`, `[steering:api-development]`）。複数指定はカンマ区切り
- **対応UIデザイン**: `ui-design-url.md「フレーム名」（https://www.figma.com/design/{file_key}?node-id={nodeId}）`（例: `ui-design-url.md「voice-call」（https://...）`）。UI実装を含むタスクにのみ付与。URLは `ui-design-url.md` のYAMLフロントマターから生成（nodeIdの `:` → `-` 変換）

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

## DS先行タスク生成ロジック

`spec_directory` に `design-component-manifest.json` が存在する場合は、以下の手順でDS先行タスクを生成する。

### 手順

1. `design-component-manifest.json` を読み込み、`missingFromPackage` リストを確認する
2. リストにコンポーネントがある場合、各コンポーネントに対して「DS実装タスク」を先行タスクとして生成する:
   - タスク名: 「[DS] {ComponentName} コンポーネント実装」
   - 実行サブエージェント: `[design-engineer]`
   - **対応UIデザイン**: manifestに記載の該当フレーム（存在する場合）
   - **要件**: なし（DSタスクのため）
   - **実装AC**: なし（DSタスクのため）
   - **依存関係**: なし（先行タスクのため）
   - **完了条件**: {ComponentName} コンポーネントがデザインシステムパッケージに追加されていること
   - **対応設計**: design.md「デザインシステム」セクション（存在する場合）
   - **シナリオテスト**: なし（DSタスクのため）
3. `missingFromPackage` のコンポーネントを使用するfeatureタスクに `**依存関係**`: DS実装タスクIDを設定する（`blockedBy` として機能）

### 制約

- `missingFromPackage` が空の場合または `design-component-manifest.json` が存在しない場合はこのステップをスキップする
- live Pencil MCPは呼ばない（`design-component-manifest.json` の内容を読み込むだけ）

## Phase末尾タスクグループ生成ルール

各Phase（Phase 99を除く）の最後に **Phase完了確認タスクグループ** を配置すること。

### 含めるべきステップ

1. **phase-reviewer呼び出し**（Weighted Scorecard）:
   - タスクグループに `**実行サブエージェント**: [phase-reviewer]` を設定する
   - タスク完了条件に「Weighted Scorecard PASS」を明記する
   - `einja-task-exec` がPhase末尾タスクグループ完了時に `phase-reviewer` を自動起動する

2. **機能的受け入れ確認**（AskUserQuestionで受け入れパケット提示）:
   - Phase内で実装した全ACをチェックリスト形式で列挙した受け入れパケットをユーザーに提示する
   - ユーザーが受け入れOK（承認）を判定してから次Phaseへ進む

### テンプレート

```markdown
- [ ] X.N Phase X完了確認
  **実行サブエージェント**: [phase-reviewer]

  - X.N.1 Phase X全タスク完了確認
    - タスクグループX.1〜X.(N-1) の全タスク完了確認
    - 全シナリオテストの成功確認
    - コードレビュー完了確認
    - デプロイ可能な状態であることを確認
    - **要件**: Story 1, Story 2（Phase X内の全Story）
    - **実装AC**: なし（完了確認タスク）
    - **依存関係**: X.(N-1).Z（Phase内の最後のタスク番号）
    - **完了条件**: Weighted Scorecard PASSかつPhase Xの全ACが確認できること
    - **対応設計**: design.md 全セクション
    - **シナリオテスト**: 全シナリオ（リグレッション確認）

  - X.N.2 機能的受け入れ確認
    - AskUserQuestionでユーザーに受け入れパケットを提示
    - Phase X内で実装した全ACの動作確認結果を提示
    - ユーザーの受け入れOKを受けてから次Phaseへ進む
    - **要件**: Story 1, Story 2（Phase X内の全Story）
    - **実装AC**: なし（受け入れ確認タスク）
    - **依存関係**: X.N.1
    - **完了条件**: ユーザーが受け入れOKを判定したこと
    - **対応設計**: なし（受け入れ確認タスク）
    - **シナリオテスト**: なし（受け入れ確認タスク）
```

**Phase 99（ドキュメント反映専用）には追加しない。**

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
  - **使用Skill**: [einja-common:figma-guide]（任意）
  - **対応UIデザイン**: ui-design-url.md「フレーム名」（https://www.figma.com/design/XXXX?node-id=123-456）（任意：UI実装タスクのみ）
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
