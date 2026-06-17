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
- **実装AC**: ACX.UI.N.001, ACX.VAL.E.001（このタスクで実装するAC番号）
- **依存関係**: なし / X.Y / Phase X完了
- **完了条件**: [条件]（ACX.UI.N.001等を満たす）
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

## external-deps 分離ルール（「作れる」≠「healthy になる」）

サービス・API・DB・認証・外部連携・インフラを伴うタスクでは、**「リソースを作れる（materialized / configured）」タスクと「healthy になる（外部依存込みで稼働する）」タスクを別ノードに分ける**。両者を 1 タスクに混ぜると、外部依存（DB / secret / DNS / OAuth 等）が未充足のまま完了判定され、順序事故・完了誤認を招く。

### ルール

1. **別ノード化**: 「箱を作る」ステップと「healthy にする」ステップを別タスク（X.Y.Z）に分割する。完了条件には対象が到達する readiness level（`created / configured / external-deps-ready / healthy / E2E-ready`。定義は `docs/einja/steering/acceptance-criteria-and-qa-guide.md`「完了レベル」節）を 1 段階で明記する。
2. **external-deps を依存エッジに変換**: 「healthy になる」タスクの `**依存関係**` に、healthy 到達の前提となる external-deps を生成する別タスクを `blockedBy` として張る。
3. **external-deps section**: 該当タスクグループに external-deps を明記する。汎用例:
   - `API healthy ← DB migrated + connection string injected`
   - `auth ready ← OAuth client secret + redirect URI 登録 + セッションストア接続`
   - `webhook ready ← DNS / route 公開 + 署名 secret + 送信元（source）設定`
   - `cron / job healthy ← スケジューラ起動 + 対象リソースへの権限`
4. **readiness matrix 参照**: design に readiness matrix（`docs/einja/templates/readiness-matrix.md.template`）がある場合、各タスクが担保する component × level と整合させる。

### 例（別ノード分割）

```markdown
- [ ] 1.2 API サービス稼働

  - 1.2.1 API サービスの materialize（created / configured）
    - サービス定義・設定・env 投入（外部疎通はしない）
    - **完了条件**: 設定が読み込まれエラーなく起動できる（readiness: configured）
    - **依存関係**: 1.1
    - **external-deps**: なし（この段階では外部依存に接続しない）

  - 1.2.2 DB migration と接続文字列注入（external-deps-ready）
    - **完了条件**: migration 成功 + 接続文字列が有効（readiness: external-deps-ready）
    - **依存関係**: 1.2.1

  - 1.2.3 API を healthy にする
    - **完了条件**: /health が 200、代表的な read/write が成功（readiness: healthy）
    - **依存関係**: 1.2.2
    - **external-deps**: API healthy ← DB migrated + connection string injected
```

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

3. **最終受け入れのE2E-ready担保（最終Phaseのみ）**: 最終 Phase の受け入れパケットに、ユーザー導線がある変更は `E2E-ready` 到達状況を含める。`created` / `configured` 止まりで「完了」としない。導線が無い変更（インフラ / ライブラリ）は `healthy` 疎通確認を含め、`E2E-ready` 免除時は readiness matrix に N/A 理由を明記する。マージ / デプロイ後にしか確認できない場合は readiness matrix の `deferred-to`（申し送り）と `qa-test.md` の種別 `人手E2E` シナリオ（人間 QA 手順）の両方を提示する。
   - **「最終Phase」の機械判定**: Phase 番号のうち **Phase 99（ドキュメント反映用の予約 Phase）を除いた最大 Phase 番号**を最終受け入れ対象 Phase とする。Phase 99 が無い場合は最大 Phase 番号がそのまま最終 Phase。
   - 規約の詳細は `docs/einja/steering/acceptance-criteria-and-qa-guide.md`「最終受け入れの readiness 下限」節を参照。

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
      - （最終 Phase の場合のみ）最終受け入れの `E2E-ready` 到達状況を受け入れパケットに含める。到達不能な場合は readiness matrix の `deferred-to`（申し送り）と `qa-test.md` の種別 `人手E2E` シナリオ（人間 QA 手順）を提示する。検証の実体は実装 Phase 側タスクが担保し、ここでは提示に留める。
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
  - **実装AC**: ACX.UI.N.001, ACX.VAL.E.001
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
