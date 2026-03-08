# Pencilファイル管理仕様の配置計画

## Context

Pencil.dev（.penファイル）を使ったデザイン管理ワークフローの要件・仕様がまとまった。
これを適切なドキュメント・Skill・サブエージェント定義に分散配置する必要がある。

**現状**: Issue仕様書ディレクトリに `ui-design.pen` をコロケーションで配置する仕組みが存在する（`ui-design-generator` agent, `einja-issue-spec-create` Skill等）。しかし以下が未定義：
- design-master.pen（プロジェクト全体のSingle Source of Truth）
- フレーム命名規則・共通コンポーネント管理
- ui-design.pen → design-master.penへのマージフロー

**方針決定**:
- **ui-design.penのコロケーションは維持**（既存フローを壊さない）
- **design-master.penを追加**（`docs/design/{app}/design-master.pen`）
- 実装確定後にui-design.penのフレームをdesign-master.penにマージする運用フローを新設
- 下流リポジトリへの影響は**BREAKING CHANGE**として扱う（フォールバックなし）

## 変更ファイル一覧

### A. 新規ファイル

#### A-1. steering doc（デザイン管理規約）
**パス**: `docs/einja/steering/development/pencil-design-management.md`

内容:
- **ファイル構造**（`@einja:managed` セクションにデフォルトパスを記載）
  - `design-master.pen`（アプリ/パッケージごと）: 最新デザインのSingle Source of Truth。実装確定済み画面 + 共通コンポーネント
    - デフォルト: `docs/design/{app}/design-master.pen`
    - 例: `docs/design/web/design-master.pen`（apps/web用）、`docs/design/admin/design-master.pen`（apps/admin用）
    - 必要なアプリ/パッケージのみ作成（全部必須ではない）
  - `ui-design.pen`（`docs/specs/issues/{issue名}/` 配下）: Issue仕様書フェーズのUIモックアップ。既存コロケーション維持
- **`@einja:project-private` セクション**: デフォルトパスを初期値として記入済み。利用者が差し替え可能
  - テンプレート生成時にデフォルト値（`docs/design/{app}/design-master.pen`）が入った状態で作成される
  - CLI同期では上書きされないため、利用者が自プロジェクトのアプリ一覧やパスに変更してもそのまま保持される
  - Skillはsteering docのproject-privateセクションからパス情報を読み取って動作する

  デフォルトのproject-private内容例:
  ```markdown
  ## デザインマスター配置（プロジェクト固有）
  | アプリ/パッケージ | design-master.penパス |
  |-----------------|---------------------|
  | web | docs/design/web/design-master.pen |
  | admin | docs/design/admin/design-master.pen |
  ```
- **フレーム命名規則**（URLパスベース + BEM風拡張）
  - 基本: `dashboard`, `settings-profile`（URLパスをkebab-case）
  - サブコンポーネント: `[path]__[element]`（例: `dashboard__submit-modal`）
  - 状態: `[path]--[state]`（例: `dashboard--empty-state`）
  - デバイス: `[path]__tablet`, `[path]--mobile`
- **キャンバスレイアウト規約**: 左: Componentsゾーン、右: Pagesゾーン
- **Git運用ルール**: デザイン変更前にcommit、PRでのdiff確認
- **規模ガイドライン**: 20-30画面でファイル分割検討（pages.pen + components.pen）
- **マージフロー**: 実装確定後、ui-design.penのフレームを該当アプリのdesign-master.penにマージ → Skill経由で実行
- **アプリの指定**: マージ時に対象アプリを指定（例: `merge-to-master web` → `docs/design/web/design-master.pen` に統合）

#### A-2. Skill
**パス**: `.claude/skills/einja-pencil-design-manager/SKILL.md`
**命名**: `einja-pencil-design-manager`（einja-プレフィックス = CLI同期で下流に配布）

機能（引数で分岐）:
- `init-master {app}`: 指定アプリのdesign-master.pen初期化（例: `init-master web` → `docs/design/web/design-master.pen`）
- `merge-to-master {app}`: 指定ui-design.penのフレームを該当アプリのdesign-master.penに統合
- `sync-components {app}`: 該当アプリのmasterの共通コンポーネントを指定ui-design.penに一括更新
- `frame-check [{app}]`: 指定アプリ（省略時は全アプリ）の.penフレーム一覧 + 命名チェック + 実装状態推定

参照:
- steering doc（A-1）の命名規則・構造を読み込んで準拠
- Pencil MCPツール（batch_get, batch_design, open_document等）を使用

### B. 既存ファイル更新（軽微な追加のみ）

#### B-1. ui-design-generator agent
**パス**: `.claude/agents/einja/issue-specs/ui-design-generator.md`

変更点:
- ステップ0に「`docs/design/{app}/design-master.pen` が存在する場合、共通コンポーネントを参照してデザインの一貫性を保つ」を追加
- フレーム命名規則をsteering doc（A-1）から参照する指示を追加
- **出力先 `{仕様書ディレクトリ}/ui-design.pen` は変更なし**

#### B-2. design-engineer agent
**パス**: `.claude/agents/einja/design-engineer.md`

変更点:
- Figma **または** Pencil（.pen）からのデザイン抽出に対応する旨を追加
- .penファイルからのデザイントークン抽出フロー（batch_get → CSS変数変換）追加
- Figma MCPとPencil MCPの使い分け判定ロジック追加
- Pencil MCPツールをtools一覧に追加

#### B-3. CLAUDE.md キーワードトリガー
**パス**: `CLAUDE.md`

追加行:
```
| `Pencil` `pencil` `.pen` `design-master` `デザインマスター` `デザイン管理` | `.claude/skills/einja-pencil-design-manager/SKILL.md` |
```

#### B-4. einja-frontend-implement Skill
**パス**: `.claude/skills/einja-frontend-implement/SKILL.md`

変更点:
- Phase 0.2のデザイン参照選択肢に「Pencil（.pen）ファイルを参照」を4つ目として追加
- 選択時はdesign-engineerにPencilモードで指示

#### B-5. steering README
**パス**: `docs/einja/steering/README.md`

変更点:
- 開発ガイドテーブルに `pencil-design-management.md` へのリンク追加
- フロントエンド開発者の必読リストに追加

## 変更しないもの

| ファイル | 理由 |
|---------|------|
| `einja-issue-spec-create/SKILL.md` | ui-design.penのコロケーション維持。Phase 2フロー変更なし |
| `design-generator.md` | ui-design.pen参照はそのまま維持 |
| `development-workflow.md` | 成果物一覧のui-design.pen記載はそのまま維持 |
| `task-execute.md` | 参照ドキュメントのui-design.pen記載はそのまま維持 |
| `component-design.md` | コンポーネント設計規約（Pencilとは別レイヤー） |
| Pencil MCPサーバー設定 | 既に接続済み |

## 実装順序

```
Layer 1: A-1（steering doc）← 他が参照するため最初
Layer 2（並行可）: A-2（Skill）, B-1（ui-design-generator）
Layer 3（並行可）: B-2（design-engineer）, B-3（CLAUDE.md）, B-4（frontend-implement）, B-5（steering README）
```

## 検証方法

1. steering docが `docs/einja/steering/development/` に正しく配置されることを確認
2. Skillが `/einja-pencil-design-manager` で呼び出せることを確認
3. ui-design-generatorがdesign-master.pen参照ロジックを持つことを確認
4. design-engineerにPencil MCP判定ロジックが追加されていることを確認
5. CLAUDE.mdのキーワードトリガーが正しく記載されていることを確認
6. `pnpm prepush` が通ることを確認

## Codexレビュー反映事項

### 第1回レビュー

#### 確認済み（問題なし）
- ui-design.penのコロケーション維持により、既存フロー（einja-issue-spec-create, design-generator, development-workflow, task-execute）への変更が不要
- design-master.penが存在しない段階でもui-design-generatorは正常動作（「存在する場合のみ参照」のオプショナル設計）
- `docs/design/` は既存ディレクトリ（`docs/einja/`, `docs/specs/`, `docs/plans/`）と名前空間衝突なし
- `.claude/settings.json` のPencil MCP permissions は設定済み。変更不要
- `.gitignore` の変更不要（.penファイルはgitコミット対象）

#### 計画に反映した指摘事項
1. **Skill（A-2）のフォールバック**: project-privateが空またはパース失敗時はデフォルトパス `docs/design/{app}/design-master.pen` にフォールバックする旨をSkill定義に明記
2. **design-engineer.md（B-2）のtools front-matter**: Pencil MCPツールを `tools:` フィールドに追記（ui-design-generatorとの一貫性）
3. **einja-frontend-implement（B-4）**: Phase 0.2の `header` を「Figma連携」→「デザインツール連携」に更新
4. **CLAUDE.mdキーワードトリガー（B-3）の下流配布**: excludedセクション内のため下流リポジトリには届かない。Skillのdescriptionにキーワード（Pencil, .pen, デザイン管理等）を含めて自動選択されるようにする

### 第2回レビュー

#### 確認済み（問題なし）
- `einja-issue-spec-create` Phase 2: B-1でui-design-generatorエージェント定義に自律判断ロジックを追加するため、Skill側の変更は不要（エージェント定義が自己完結型）
- `design-generator`: design.md作成時のui-design.pen参照はそのまま維持。design-master.penは「実装確定後フェーズ」の成果物であり、仕様書フェーズのdesign-generatorが参照する必要はない
- `development-workflow.md`: design-master.penは仕様書フェーズの成果物ではなく実装確定後フェーズの成果物のため、Spec PRの観点に含めない。変更不要
- CLI配布: `docs/einja/steering/development/` は自動コピー対象。project-private付きでの配布は意図通り
- `copy-presets.mjs`: `einja-pencil-design-manager/` は `einja-` プレフィックスで自動配布対象。変更不要
- project-privateパターン: デフォルト値入りは新パターンだが、Pencil設定のプロジェクト固有性が高いため有効な設計

#### 計画に反映した指摘事項

5. **Skill（A-2）`merge-to-master` 引数補完**: `{app}` のみでは「どのui-design.penからマージするか」が不明。引数仕様を以下に拡張:
   - `merge-to-master {app} [{ui-design.pen path}]`: パス省略時はカレントディレクトリのui-design.penを自動検出（Issue仕様書ディレクトリのコンテキスト前提）
6. **Skill（A-2）`sync-components` 確認ステップ**: 破壊的操作のため、上書き対象のフレーム一覧を表示しユーザー確認を求めるステップをSkill定義に明記
7. **Skill（A-2）`frame-check` スコープ縮小**: 「実装状態推定」は初期バージョンではオプショナル。フレーム一覧 + 命名チェックのみを必須とする
8. **Skill（A-2）前提条件**: Pencil.devが起動している状態でのみ動作する旨を明記
9. **Skill（A-2）`docs/design/` ディレクトリ初期化**: `init-master` 実行時に親ディレクトリが存在しない場合は自動作成する旨を明記
10. **design-engineer.md（B-2）追加ツール名の具体化**: ui-design-generatorと同一セット（`mcp__pencil__batch_get, mcp__pencil__batch_design, mcp__pencil__get_screenshot, mcp__pencil__open_document, mcp__pencil__snapshot_layout, mcp__pencil__get_variables`）を追加
11. **einja-frontend-implement（B-4）Pencil選択時のフェーズ2プロンプト**: Pencil選択時はdesign-engineerに「Pencilモード: 指定.penファイルからデザイントークンを抽出」と指示するプロンプト例を追加
12. **project-privateデフォルト値のコメント**: `web`/`admin`は例示であり、利用者が自プロジェクトのアプリ名に書き換える旨の説明コメントを追加
13. **BREAKING CHANGEの定義明確化**: 「新機能追加（オプトイン）」として扱う。既存フローは壊れない。changesetはminorバージョン。下流への「BREAKING」の意味は「Skill定義・steering docの追加により、既存のPencil運用がある場合は新フローへの移行が必要」という運用面の変更
