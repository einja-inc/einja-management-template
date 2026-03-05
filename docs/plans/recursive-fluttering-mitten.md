# einja-issue-spec-createにui-designステップを追加 + Pencil MCP設定

## Context

einja-issue-spec-create Skillは仕様書を段階的に作成するワークフローだが、現在はUI設計がdesign.md内のmermaid/表形式のみ。
Pencil MCPを活用してビジュアルなUIモックアップ（.penファイル）を生成するステップを追加し、UXの合意形成を効率化する。

## Skill-first評価

**スキップ**: 既存のeinja-issue-spec-create Skillへの機能追加であり、新規Skill作成の対象外。

## 変更対象ファイル

| # | ファイル | 操作 | 概要 |
|---|---------|------|------|
| 1 | `~/.claude/settings.json` | 変更 | Pencil MCP mcpServers設定追加 |
| 2 | `.claude/settings.json` | 変更 | Pencil MCP permissions追加 |
| 3 | `.claude/agents/einja/issue-specs/ui-design-generator.md` | **新規** | UIデザイン生成エージェント |
| 4 | `.claude/skills/einja-issue-spec-create/SKILL.md` | 変更 | ui-designステップ挿入 + Phase再番号付け |
| 5 | `.claude/agents/einja/issue-specs/design-generator.md` | 変更 | ui-design.pen参照追加 |

**注意**: `.claude/agents/einja/` および `.claude/skills/einja-*/` 配下のファイルは `presets/default/` に自動コピーされる。直接編集は不要。

## 実装手順

### Step 1: Pencil MCP設定追加（並行可）

#### 1a. `~/.claude/settings.json`（グローバル）にmcpServers追加

MCPサーバー定義はグローバル設定に配置（下流プロジェクトへの影響を防ぐため）:

```json
"mcpServers": {
  "pencil": {
    "transport": "stdio",
    "command": "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64",
    "args": ["--app", "desktop"],
    "env": {}
  }
}
```

#### 1b. `.claude/settings.json`（プロジェクト）にpermissions追加

`permissions.allow`に以下を追加:

```
mcp__pencil__batch_design
mcp__pencil__batch_get
mcp__pencil__find_empty_space_on_canvas
mcp__pencil__get_editor_state
mcp__pencil__get_guidelines
mcp__pencil__get_screenshot
mcp__pencil__get_style_guide
mcp__pencil__get_style_guide_tags
mcp__pencil__get_variables
mcp__pencil__open_document
mcp__pencil__replace_all_matching_properties
mcp__pencil__search_all_unique_properties
mcp__pencil__set_variables
mcp__pencil__snapshot_layout
```

### Step 2: `ui-design-generator.md` 新規作成（並行可）

**パス**: `.claude/agents/einja/issue-specs/ui-design-generator.md`

**構造**（既存エージェントパターンに準拠 - `design-generator.md`等と同じ形式）:
- **frontmatter**: name, description, tools（Pencil MCP + Playwright MCP読み取り用）, model: sonnet, color: purple
- **ペルソナ**: UIデザイナー/UXエンジニアリング専門家
- **ワークフロー**:
  1. ステップ0: requirements.md読み込み + 既存画面判定
  2. ステップ1: Pencil MCP環境準備（open_document → get_guidelines → get_style_guide）
  3. ステップ2: 画面設計（find_empty_space_on_canvas → batch_design）
     - `get_guidelines` でPencil MCPの操作ルール・構文仕様を取得してから実行
  4. ステップ3: ビジュアル確認（get_screenshot）と修正
  5. ステップ4: 既存画面改修時のPlaywright連携（スクリーンショット取得 → 参考にデザイン作成）
- **複数画面管理**: 1つの.penファイル内に複数フレーム。横方向（right）に自動配置、padding: 100px
- **既存画面改修**: Playwright MCPでスクショ取得 → 参考にしてデザイン作成
- **出力**: `{仕様書ディレクトリ}/ui-design.pen`（gitコミット対象）

### Step 3: `einja-issue-spec-create/SKILL.md` 更新（Step 1,2に依存）

#### 変更1: allowed-tools に `mcp__pencil__*`, `mcp__playwright__*` 追加

#### 変更2: Phase構成の再番号付け

```
Phase 1: requirements.md（要件定義書）         ← 変更なし
Phase 2: ui-design.pen（UIデザイン）           ← 新規
Phase 3: design.md（設計書）                   ← 旧Phase 2
Phase 4: QAテスト仕様生成                      ← 旧Phase 3
Phase 5: GitHub Issueへのタスク記述            ← 旧Phase 4
```

#### 変更3: Phase 2 ui-design ステップの挿入

Phase 1の後に以下を挿入:
- **スキップ判定**: requirements.mdに画面・UI・フォーム関連の要件がない場合はスキップ
  - 明示的な判定基準: requirements.md内に「画面」「UI」「フォーム」「ダッシュボード」「表示」等のキーワードが含まれるか確認
  - 判断が曖昧な場合はAskUserQuestionでユーザーに確認
- **既存画面確認**: 改修の場合はPlaywright MCPでスクリーンショット取得
- **エージェント呼び出し**: `ui-design-generator`で.pen生成
- **ユーザー確認**: get_screenshotで各画面プレビューを提示
- **承認後**: ui-design.penをコミット＆プッシュ
  - コミットメッセージ: `docs: {機能名}のUIデザインを追加`

#### 変更4: 旧Phase 2→3, 3→4, 4→5 の番号修正

全てのPhase参照・セクション番号・サブセクション（4.1→5.1, 4.2→5.2等）を更新。

#### 変更5: Phase 3（旧Phase 2）design.mdセクションに ui-design.pen参照追加

```
- **ui-design.penが存在する場合、Pencil MCPでビジュアルモックアップを参照してUI関連セクション（9-11）を作成**
```

#### 変更6: 成果物ディレクトリ構成に `ui-design.pen` 追加

```
/docs/specs/issues/{機能カテゴリ名}/issue{N}-{機能名}/
├── requirements.md      # Phase 1
├── ui-design.pen        # Phase 2（UI関連のみ）
├── design.md            # Phase 3
└── qa-tests/            # Phase 4
```

#### 変更7: Phase 5 Issue説明文にUIデザインへのリンク追加

### Step 4: `design-generator.md` 更新（Step 2に依存）

**パス**: `.claude/agents/einja/issue-specs/design-generator.md`

- ステップ0: ui-design.penの存在確認を追加
- ステップ1: 優先読み込みリストにui-design.penを追加
- セクション10（画面設計）: ui-design.pen存在時はPencil MCPで参照（batch_get + get_screenshot）
- tools: `mcp__pencil__batch_get`, `mcp__pencil__get_screenshot` を追加（読み取り専用）

## ui-design.pen と design.md の関係

| 観点 | ui-design.pen (Phase 2) | design.md (Phase 3) |
|------|------------------------|---------------------|
| 形式 | ビジュアル（.penファイル） | テキスト（mermaid/表） |
| 目的 | UX検証・デザイン合意 | 実装仕様の定義 |
| git管理 | .penファイルをコミット | 通常のmdファイル |
| セクション10 画面設計 | 各画面のビジュアルモックアップ | mermaid図（Pencil MCPで.penを参照して作成） |

**補完関係**: ui-design.pen=「何をどう見せるか」、design.md=「どう実装するか」

## 実行順序

```
Step 1 ─┐
         ├─→ Step 3 ─→ 完了
Step 2 ─┤
         └─→ Step 4
```

Step 1とStep 2は並行実行可能。Step 3はStep 1,2完了後、Step 4はStep 2完了後。

## Codexレビュー指摘事項への対応

| 指摘 | 対応 |
|------|------|
| mcpServersが下流プロジェクトにコピーされる | グローバル設定に配置、プロジェクトはpermissionsのみ |
| .penファイルのgit管理 | .penファイルをそのままgitコミット |
| batch_designのAPI仕様未記載 | エージェント内でget_guidelinesで仕様を取得してから実行 |
| Phase 2スキップ基準が曖昧 | キーワードベースの判定基準を明示 |
| allowed-tools更新の必要性 | Skillからサブエージェント経由で使うため追加 |

## 検証方法

1. **Pencil MCP接続テスト**: `mcp__pencil__get_editor_state` が応答するか確認
2. **SKILL.md全体フロー確認**: Phase番号の整合性、次ステップへの参照が正しいか目視確認
3. **新規エージェント構文確認**: frontmatterの形式が既存エージェント（design-generator.md等）と一致するか確認
4. **CLIビルドへの影響確認**: agents/、skills/配下の新ファイルが`presets/default/`に自動コピーされることを確認
