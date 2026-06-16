<!-- @einja:managed:start -->
<!--
**2026-05-28 注釈**: 本ドキュメントは Figma 関連の管理規約。einja-project-screen-flow は 2026-05-28 以降 drawio 化（einja-project-screen-flow-drawio）されたため、本 doc は **screen-spec / ui-design-generator / einja-pencil-design-manager** 系のみが対象。screen-flow は対象外。
本文中に残る `screen-flow-url.md` / `einja-project-screen-flow-figma` 関連の記述は歴史的経緯であり、現行 screen-flow 実装は drawio 版を参照すること。
-->

# Figmaデザイン管理規約

## 概要

Figma MCP（`mcp__claude_ai_Figma__*`）を使用したUIデザインの管理規約を定義します。Issue仕様書フェーズでは `ui-design-url.md`（FigmaファイルURLとフレームmanifestを含むMarkdown）を成果物とし、gitで管理します。

Pencilの `ui-design.pen` / `design-master.pen` に相当する2層構造（Issue仕様書フェーズ / 実装確定後）は、現時点ではFigmaファイル1本で管理します。Figmaファイル自体はクラウド管理のためgitには含めず、フレームメタデータを記述した `ui-design-url.md` をコミットします。

## 認証要件

Figma MCPを使用する前に認証状態を確認することが必須です。

| 手順 | ツール | 説明 |
|------|--------|------|
| 認証確認 | `mcp__claude_ai_Figma__whoami` | 認証済みユーザー情報を取得して確認 |
| 未認証時 | `mcp__claude_ai_Figma__authenticate` | ブラウザ認証フローを開始 |

認証が完了していない状態でデザイン操作を開始してはなりません。

## ファイル命名規則

Figmaファイル名は以下の形式を使用します。

| 区分 | 形式 | 例 |
|------|------|-----|
| UIデザインファイル | `{機能名}-ui-design` | `user-authentication-ui-design` |

機能名はkebab-caseで記述します。

## フレーム命名規則

Pencilのケバブケースルールに準拠したURLパスベース + BEM風拡張の命名規則を採用します。

### 基本ルール

| カテゴリ | パターン | 例 |
|---------|---------|-----|
| ページフレーム | `{path}` | `dashboard`, `settings-profile` |
| サブコンポーネント | `{path}__[element]` | `dashboard__submit-modal`, `settings__sidebar` |
| 状態バリアント | `{path}--[state]` | `dashboard--empty-state`, `login--error` |

### 命名詳細

- URLパスをkebab-caseに変換: `/settings/profile` → `settings-profile`
- ネストされたパスはハイフンで結合: `/users/[id]/edit` → `users-edit`
- 共通コンポーネント: `_components/[name]`（アンダースコアプレフィックス）

### screen-flow-url.md 固有の命名規則（補強）

> **2026-05-28 注釈**: 本セクションの命名規則は **歴史的経緯**（drawio 化以前の Figma 時代の screen-flow-url.md 仕様）として記録する。現行 screen-flow は drawio 化により本命名規則を参照しない。screen-spec / ui-design-generator が新規 Figma file 作成時に参照する命名規則は L120 以降のセクションを参照。

プロジェクト全体の画面遷移マニフェスト（`screen-flow-url.md`）を生成する場合は、上記の基本ルールに加えて以下の命名規則を適用します。`einja-project-screen-flow-figma` Skill により生成されるFigmaノードに対する規約です。

| 種別 | パターン | 例 |
|------|---------|-----|
| 画面ノード（FrameNode） | `screen-{kebab-name}` | `screen-dashboard`, `screen-login` |
| エッジグループ（矢印+ラベルのgroup） | `edge__{from}__to__{to}` | `edge__dashboard__to__monthly-report` |

冪等性照合のため、各ノードには `setSharedPluginData("einja.screenFlow", "stable_id", ...)` で `stable_id` を付与します（namespace: `einja.screenFlow`）。

## Git管理方法

Figmaファイル自体はクラウド管理のためgitには含めません。代わりに以下の方法でメタデータをgit管理します。

| 管理対象 | 方法 |
|---------|------|
| Figmaファイル本体 | Figmaクラウド上で管理（gitに含めない） |
| フレームメタデータ | `{仕様書ディレクトリ}/ui-design-url.md` としてgitコミット |

`ui-design-url.md` の配置パスは `docs/specs/issues/{機能カテゴリ名}/issue{issue番号}-{機能名}/ui-design-url.md` とします（`einja-issue-spec-create` の成果物構成に準拠）。

## ui-design-url.md フォーマット

以下のYAMLフロントマター + Markdown本文の形式を厳守します。

```markdown
---
figma_url: https://www.figma.com/design/XXXX/{機能名}-ui-design
file_key: XXXX
frames:
  - name: dashboard
    node_id: "123:456"
    description: ダッシュボード画面
  - name: dashboard--empty-state
    node_id: "123:789"
    description: 空状態
---

# UIデザイン（Figma）

**Figma URL**: https://www.figma.com/design/XXXX/{機能名}-ui-design

## 画面一覧
| フレーム名 | Node ID | 説明 |
|-----------|---------|------|
| dashboard | 123:456 | ダッシュボード画面 |
| dashboard--empty-state | 123:789 | 空状態 |
```

### フロントマターの役割

| フィールド | 用途 |
|-----------|------|
| `figma_url` | Figmaファイルの完全URL |
| `file_key` | Figma API呼び出し用のファイルキー（URLの `/design/` 以降の識別子） |
| `frames[].name` | フレーム名（命名規則に準拠） |
| `frames[].node_id` | Figma API呼び出し用のノードID（`"123:456"` 形式） |
| `frames[].description` | 画面の説明 |

- **YAMLフロントマター**: `file_key` と各フレームの `node_id` を機械可読形式で保持します。`ui-design-generator` や `einja-review-spec` がFigma API呼び出し（スクリーンショット取得等）に使用します
- **タスクmetadata形式**: `ui-design-url.md「フレーム名」（https://www.figma.com/design/{file_key}?node-id={nodeId-with-hyphens}）`（`tasks-generator` がYAMLフロントマターから `file_key` と `node_id` を読み取り生成。`node_id` の `:` を `-` に変換してURL用node-id形式にすること）
- **URL形式の区別**:
  - `figma_url`（ファイル全体URL）: `https://www.figma.com/design/{file_key}/{機能名}-ui-design` — ファイル全体への参照。GitHub Issue本文のUIデザインリンクに使用
  - フレーム直リンク（`?node-id=` 付きURL）: `https://www.figma.com/design/{file_key}?node-id={nodeId-hyphenated}` — 個別フレームへの直接リンク。タスクの `**対応UIデザイン**` メタデータに使用

## screen-flow-url.md スキーマ（プロジェクト全体）

プロジェクト全体の画面遷移マニフェストとして、`screen-flow-url.md` を別途管理します。`ui-design-url.md` がIssue単位の画面モックアップを管理するのに対し、`screen-flow-url.md` は**プロジェクト全体**の画面と画面間遷移の関係性を管理します。

### 配置と用途

| 項目 | 値 |
|------|-----|
| 配置場所 | `docs/project/screen-flow-url.md`（1リポジトリ1プロジェクト前提） |
| 用途 | プロジェクト全体の画面遷移マニフェスト（画面一覧 + 遷移グラフ） |
| 生成元 | `einja-project-screen-flow-figma` Skill |

**`docs/project/` ディレクトリの扱い**: プロジェクト全体の運用ドキュメント（要件定義、画面遷移manifest等）を格納する。`docs/einja/` がCLI管理（読み取り専用）なのに対し、`docs/project/` は**プロジェクト固有で読み書き可能**。配布対象外（生成プロジェクト側で実行時に作成される）。

### 主要フィールド

YAMLフロントマター + `## screens` / `## edges` の2リストセクションで構成されます。

| フィールド | 種別 | 説明 |
|----------|------|------|
| `figma_url` / `file_key` / `plan_key` | frontmatter | `figma_url` / `file_key` は ui-design-url.md と共通、`plan_key` は本Skill固有 |
| `schema_version` | frontmatter | スキーマバージョン（互換性管理用、現行: `1`） |
| `screens[]` | リスト | プロジェクト全体の画面リスト（`name` / `stable_id` / `node_id` / `role` / `status` / `position`） |
| `edges[]` | リスト | 画面間遷移（`from` / `to` / `trigger` / `stable_id` / `node_id` / `status`） |

完全スキーマ・冪等性ポリシー（再生成時の `stable_id` 照合、orphan化、AskUserQuestion確認フロー）は `.claude/skills/einja-project-screen-flow-drawio/references/manifest-schema.md` を参照してください（drawio 化により旧 `einja-project-screen-flow-figma` から移行済）。

### YAML最小実例

```yaml
---
figma_url: https://www.figma.com/design/abc123
file_key: abc123
plan_key: team::1152187400294529955
schema_version: 1
generated_at: 2026-05-18
project_name: attendance-saas
---

## screens

- name: dashboard
  stable_id: attendance-saas__dashboard
  node_id: "1:2"
  role: 人事部
  status: active
  position: { x: 0, y: 0 }

## edges

- from: dashboard
  to: monthly-report
  trigger: 月次レポートボタンクリック
  stable_id: dashboard__to__monthly-report
  node_id: "1:8"
  status: active
```

## ui-design-url.md と screen-flow-url.md の関係

両ファイルは粒度と用途が異なり、**同じFigma plan内に別ファイルとして共存可能**です。

| 項目 | ui-design-url.md | screen-flow-url.md |
|------|------------------|---------------------|
| 粒度 | Issue単位（画面1枚の詳細モックアップ） | プロジェクト全体（画面の関係性=遷移図） |
| 配置 | `docs/specs/issues/{cat}/issue{N}-{name}/` | `docs/project/` |
| 共通フィールド | `figma_url` / `file_key` / `plan_key` | 同左（互換） |
| 固有フィールド | `frames[]` / `design_target` / `issue_id` | `screens[]` / `edges[]` / `schema_version` |
| 生成元 | `ui-design-generator`（Issue仕様書フェーズ） | `einja-project-screen-flow-figma`（プロジェクト初期/更新時） |

`figma_url` / `file_key` / `plan_key` が共通フィールドのため、両ファイルは同一のFigma plan配下に別Figmaファイルとして並存できます。

## スクリーンショット取得方法

フレームのスクリーンショットを取得する場合は `mcp__claude_ai_Figma__get_screenshot` を使用します。

```
fileKey: {ui-design-url.mdのfile_key}
nodeId:  {ui-design-url.mdのframes[].node_id}
```

`node_id` の区切り文字は `:` 形式（例: `123:456`）を使用します。FigmaのURL上では `-` 区切りで表示されることがあるため、API呼び出し時は `:` に変換してください。

## 適用スコープとスキップ条件

UIコンポーネントを持たない機能（バックエンドAPIのみ、バッチ処理のみ等）では `ui-design-url.md` の生成は不要です。

| 条件 | 対応 |
|------|------|
| requirements.mdに「画面」「UI」「フォーム」「表示」等のキーワードがない | `ui-design-generator` をスキップ（二又並列に変更） |
| `ui-design-url.md` が存在しない | 各エージェントはUI関連ステップをスキップする |

各エージェントは `ui-design-url.md` の存在確認を行い、存在しない場合はFigma MCPを呼び出さずに処理を継続します。

## 参照するエージェント

| エージェント | 役割 |
|-------------|------|
| `ui-design-generator` | Issue仕様書フェーズの `ui-design-url.md` 生成 |
| `design-generator` | `ui-design-url.md` を参照してmermaid図・設計ドキュメントを作成 |
| `einja-review-spec` | `ui-design-url.md` のFigma URLからスクリーンショットを取得してレビュー |

<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="figma-design-management-project" -->
## Figmaプロジェクト設定（プロジェクト固有）

<!-- 以下はデフォルト値です。プロジェクトのFigma構成に合わせて書き換えてください。 -->

### Figmaファイル保存先

| 項目 | 値 |
|------|-----|
| Figmaチーム/プロジェクトURL | （未設定） |
| project_id | （未設定） |

> **⚠️ 未設定時の動作**: `ui-design-generator` がこのセクションを読んで `（未設定）` の場合、PENDING_QUESTIONS形式でユーザーに「Figmaプロジェクト保存先が未設定です。どのFigmaチーム/プロジェクトに保存しますか？」と確認してから作業を続行すること。

### 既存FigmaファイルのfileKey（改修時の参照先）

| アプリ/機能 | Figmaファイル名 | file_key |
|------------|----------------|---------|
| （例: web） | （例: web-ui-design） | （未設定） |
<!-- @einja:project-private:end -->
