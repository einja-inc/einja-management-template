# Plan: issue-spec-create の UIデザイン生成を Pencil → Figma へ移行

## Context

`einja-issue-spec-create` のUIデザイン生成フロー（Phase 2 並列-2）が Pencil MCP（`.pen`ファイル出力）のままになっている。Figmaに移行し、設計資料（design.md）にFigma URLを残せるようにする。

**変更の動機**:
- Figmaはクラウドベースで共有・コメントが容易（.penはローカルバイナリ）
- FigmaURL入力時の情報（デザインシステム・トークン）をUI生成に活用できる
- 設計資料へのFigmaリンクトレーサビリティを確立する

## 現状

| 箇所 | 現状 |
|------|------|
| `ui-design-generator.md` | Pencil MCP専用。出力 `ui-design.pen` |
| `SKILL.md`（issue-spec-create） | 11箇所で `ui-design.pen` / `Pencil MCP` 参照 |
| `design-generator.md` | セクション10 で Pencil MCP参照、tools に `mcp__pencil__*` |
| `einja-review-spec/SKILL.md` | tools に `mcp__pencil__*`、`ui-design.pen` を直接参照 |
| `tasks-generator.md` | metadata形式 `ui-design.pen「フレーム名」` を使用（3箇所） |
| `tasks-validator.md` | **regex `ui-design\.pen(「[\w-]+」)+` でバリデーション実施**（ブロッカー） |
| `task-management.md` | metadata形式の定義を保持 |
| `development-workflow.md` | 図・表・フロー図に `ui-design.pen` 参照（5箇所） |
| `design.md.template` | line 241 に `ui-design.pen:` 参照 |
| `task-execute.md` | `ui-design.pen` 参照（3箇所） |
| `figma-design-management.md` | **存在しない** |

**Figma入力（既存）**: `SKILL.md` line 187-189 で FigmaURL → Figma MCP で分析する記述はあるが、**その情報をui-design生成に引き渡す手順が欠落**している。

**確認済み**: この環境で有効な Figma MCP namespace は `mcp__claude_ai_Figma__*`（deferred tools一覧に列挙済み）。

## 変更内容

### 出力形式の設計判断

Pencilの `.pen` バイナリに相当する成果物として、**`ui-design-url.md`**（YAMLフロントマター + Markdown本文）を新設する。

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

- **YAMLフロントマター**: `fileKey` + `nodeId` を機械可読形式で保持（design-generator セクション10・einja-review-specがAPIアクセスに使用）
- **Markdown本文**: 人間可読な画面一覧
- **タスクmetadata形式**: `ui-design-url.md「フレーム名」`（tasks-generator/validator が参照）
- gitコミット対象（URL追跡可能）
- design.md セクション16 からリンク参照（「設計資料にFigmaリンクを残す」要件を満たす）

---

### 変更対象ファイル

#### 1. `docs/einja/steering/development/figma-design-management.md` ✨新規作成

`pencil-design-management.md` のFigma版。内容：
- Figmaファイル作成ルール（命名規則: `{機能名}-ui-design`）
- フレーム命名規則（Pencilのケバブケースルールに準拠）
  - ページフレーム: URLパスをkebab-case（例: `dashboard`, `settings-profile`）
  - サブコンポーネント: `{path}__[element]`
  - 状態バリアント: `{path}--[state]`
- 必須ページ: `Screens`（画面フレーム配置）
- `@einja:project-private` セクション（プロジェクト固有の設定を記録する場所）:
  - Figmaファイルの保存先プロジェクト（`project_id` または team URL）
  - 既存Figmaファイルのキー（改修時の参照先）
  - **⚠️ Figma認証が必要**: `mcp__claude_ai_Figma__whoami` で確認し、未認証時は `mcp__claude_ai_Figma__authenticate` を案内
- スクリーンショット取得方法（`mcp__claude_ai_Figma__get_screenshot`）
- Git管理方法（`ui-design-url.md` でURL保存）

---

#### 2. `.claude/agents/einja/issue-specs/ui-design-generator.md` 完全書き直し

**フロントmatter変更**:
```yaml
# Before
description: ...（.penファイル）を生成...Pencil MCP...
tools: ...mcp__pencil__batch_design, mcp__pencil__batch_get, ...

# After
description: ...UIデザイン（FigmaファイルURL）を生成...Figma MCP...
tools: Read, Write, Edit, Bash, Grep, Glob, Task,
       mcp__claude_ai_Figma__whoami,
       mcp__claude_ai_Figma__create_new_file,
       mcp__claude_ai_Figma__get_design_context,
       mcp__claude_ai_Figma__get_screenshot,
       mcp__claude_ai_Figma__use_figma,
       mcp__claude_ai_Figma__get_metadata,
       mcp__claude_ai_Figma__get_variable_defs,
       mcp__playwright__browser_navigate,
       mcp__playwright__browser_take_screenshot,
       mcp__playwright__browser_snapshot
```

**ワークフロー変更**（全セクション書き直し）:

```
前提条件: mcp__claude_ai_Figma__whoami で認証確認（失敗時は即停止してPENDING_QUESTIONS）

ステップ0: requirements.md読み込みと既存画面判定
  - FigmaURL（引き渡し済みの場合）から get_design_context で既存デザイン情報取得
  - docs/einja/steering/development/figma-design-management.md の
    @einja:project-private セクションから保存先プロジェクト設定を取得

ステップ1: Figmaファイル作成
  - whoami で planKey を取得
  - create_new_file でファイル作成（fileName: {機能名}-ui-design, editorType: design, planKey）
  - 返却された fileKey と URL を記録

ステップ2: 画面設計
  - figma-design-management.md のフレーム命名規則を確認
  - use_figma でPlugin API経由でフレーム・UIを作成
    （1回50000字制限に注意し、画面ごとに分割実行）

ステップ3: スクリーンショットで確認・修正
  - get_screenshot で確認（fileKey + nodeId 指定）
  - 修正が必要な場合は use_figma で修正

ステップ4: 既存画面改修時のPlaywright連携（既存と同じ）

出力
  - {仕様書ディレクトリ}/ui-design-url.md にYAMLフロントマター（fileKey, frames[name+nodeId]）を含むMarkdownを生成
  - 各フレームのnodeIdはcreate/use_figmaの戻り値から取得
```

---

#### 3. `.claude/agents/einja/issue-specs/design-generator.md`

変更箇所4点：

| 行番号 | 変更 |
|--------|------|
| 4 (tools) | `mcp__pencil__batch_get, mcp__pencil__get_screenshot` を削除 → `mcp__claude_ai_Figma__get_screenshot, mcp__claude_ai_Figma__get_design_context` を追加 |
| 82 | `ui-design.pen` → `ui-design-url.md（Figma URL）`、`Pencil MCPで参照` → `記載のFigma URLから mcp__claude_ai_Figma__get_screenshot で参照` |
| 401-403 | セクション10「ui-design.penが存在する場合」→「ui-design-url.mdが存在する場合: Figma URLを取得し `mcp__claude_ai_Figma__get_screenshot` で画面確認、mermaid図に変換」 |
| 495 | `[design-engineer] \| ui-design.penからのデザイン実装` → `[design-engineer] \| ui-design-url.md（Figma URL）からのデザイン実装` |
| 502 | `[einja-pencil-design-manager]` 行を削除 → `[einja-common:figma-guide]` 参照に変更 |

また、**セクション16「関連ドキュメント」の出力例に以下を追記**（形式を明示）:
```markdown
### UIデザイン参照
- [UIデザイン（Figma）](./ui-design-url.md) — `{figma_url from ui-design-url.md frontmatter}`
```
- リンク形式: `[表示テキスト](./ui-design-url.md)` でファイルへのリンクを張り、ダッシュ区切りで Figma URL 直書きも記載する（ファイルを開かずにURLが分かるように）

---

#### 4. `.claude/skills/einja-issue-spec-create/SKILL.md`

変更箇所11点：

| 行番号 | 変更内容 |
|--------|---------|
| 13 | `ui-design.pen` → `UIデザイン（Figma: ui-design-url.md）` |
| 179 | `ui-design.pen のスクリーンショット要約` → `ui-design-url.md に記載のFigma URLからFigma MCPで取得したスクリーンショット要約` |
| 278 | `[並列-2] ui-design-generatorエージェント → ui-design.pen` → `[並列-2] ui-design-generatorエージェント → ui-design-url.md（Figma）` |
| 283 | `Pencil MCPでビジュアルモックアップを作成` → `Figma MCPでビジュアルモックアップを作成` |
| 284 | `出力: {仕様書ディレクトリ}/ui-design.pen` → `出力: {仕様書ディレクトリ}/ui-design-url.md（YAMLフロントマター付きMarkdown）` |
| 287 | `pencil-design-management.md` → `figma-design-management.md` |
| 322 | `ui-design.pen がある場合はスクリーンショット要約を渡す` → `ui-design-url.md がある場合はFigma MCPでスクリーンショット要約を渡す` |
| 329 | `Pencil MCPのget_screenshotで各画面プレビュー` → `Figma MCPのget_screenshotで各画面プレビュー（ui-design-url.mdのfileKey/nodeIdから）` |
| 333 | `ui-design含む場合` 条件を `ui-design-url.md 含む場合` に変更 |
| 429 | `UIデザインへのリンク（ui-design.pen）` → `UIデザインへのリンク（Figma URL: ui-design-url.md記載のURL）` |
| 451, 468 | 成果物ツリー `ui-design.pen` → `ui-design-url.md  # UIデザイン（FigmaURL + フレームmanifest）` |

**FigmaURL入力時の引き渡し強化**（line 187-189 に追記）:
- FigmaURL入力時に `get_design_context` で取得したコンポーネント仕様・デザイントークンを **ui-design-generatorエージェントへのプロンプトに含める**ことを明示

---

#### 5. `.claude/skills/einja-review-spec/SKILL.md`

変更箇所5点：

| 行 | 変更内容 |
|----|---------|
| frontmatter description | `ui-design.pen` → `ui-design-url.md` |
| 10-11 (tools) | `mcp__pencil__batch_get, mcp__pencil__get_screenshot` → `mcp__claude_ai_Figma__get_screenshot, mcp__claude_ai_Figma__get_design_context` |
| 38-39 | `ui-design.pen のパス` → `ui-design-url.md のパス（YAMLフロントマターにfileKey/nodeId含む）`、ツール名変更 |
| 53 | `mcp__pencil__*` → `ui-design-url.mdのYAMLからfileKey/nodeIdを読み取りFigma MCPで確認` |
| 82 | `ui-design.pen と requirements/design の整合` → `ui-design-url.md（Figma）と requirements/design の整合` |

---

#### 6. `.claude/agents/einja/issue-specs/tasks-generator.md` ← 追加

変更箇所3点（line 310, 322, 659）:
- `ui-design.pen「フレーム名」` → `ui-design-url.md「フレーム名」`

---

#### 7. `.claude/agents/einja/issue-specs/tasks-validator.md` ← 追加（**ブロッカー修正**）

変更箇所（line 162, 178, 179）:
- regex `ui-design\.pen(「[\w-]+」)+` → `ui-design-url\.md(「[\w-]+」)+`
- エラーメッセージ内の `ui-design.pen「フレーム名」` → `ui-design-url.md「フレーム名」`

---

#### 8. `docs/einja/steering/task-management.md` ← 追加

変更箇所（line 373）:
- `.pen ファイルのフレームを参照。ui-design.pen「フレーム名」形式` → `ui-design-url.md「フレーム名」形式`

---

#### 9. `docs/einja/steering/development-workflow.md` ← 追加

変更箇所5点（図・表・フロー）:
- `ui-design.pen` 参照を `ui-design-url.md（Figma）` に変更

---

#### 10. `docs/einja/templates/design.md.template` ← 追加

変更箇所（line 241）:
- `ui-design.pen:` → `ui-design-url.md:（FigmaファイルURL参照）`

---

#### 11. `docs/einja/instructions/task-execute.md` ← 追加

変更箇所3点（line 62, 198, 242, 555）:
- `ui-design.pen` → `ui-design-url.md` に変更

---

#### 12. `docs/einja/steering/development/pencil-design-management.md` ← 追加（非破壊）

先頭に非推奨ノートを追加:
```markdown
> **[Deprecated]** このドキュメントはPencil MCP（.penファイル）利用プロジェクト向けです。
> 新規Issueでは Figma MCP を使用します。→ `figma-design-management.md` を参照してください。
```
（既存内容は削除しない。Pencil利用の下流プロジェクトのため残存）

---

## タスク概要

| ID | タスク | 依存 | Skill/Agent |
|----|--------|------|-------------|
| 0-0 | TaskCreate で全タスク登録 | - | - |
| 0-1 | Planファイル配置 | - | - |
| 0-2 | worktree作成 | - | `_einja-worktree-guide` |
| 1 | `figma-design-management.md` 新規作成 | - | `frontend-architect` |
| 2 | `ui-design-generator.md` 完全書き直し | 1完了 | `codex-agent` |
| 3 | `design-generator.md` 修正（4箇所） | 1完了 | `codex-agent` |
| 4 | `einja-review-spec/SKILL.md` 修正（5箇所） | 2完了 | `codex-agent` |
| 5 | `SKILL.md`（issue-spec-create）修正（11箇所） | 1,2完了 | `codex-agent` |
| 6 | `tasks-generator.md` 修正（3箇所）+ `tasks-validator.md` regex修正 | - | `codex-agent` |
| 7 | steering/template/instructions 更新（task-management/development-workflow/design.md.template/task-execute/pencil deprecated） | - | `codex-agent` |
| 99-1 | 観点別並列コードレビュー | 3〜7完了 | `einja-review-code` |
| 99-2 | 動作確認（静的確認：ファイル整合チェック） | 99-1 | `Bash` |
| 99-G | コミット承認ゲート | 99-2 | `AskUserQuestion` |
| 99-3 | コミット・プッシュ | 99-G | `einja-task-commit` |

**並列実行計画**:
- タスク1と6,7は独立して並列実行可能
- タスク2,3はタスク1完了後（figma-design-management.md の仕様確定後）
- タスク4はタスク2完了後（ui-design-url.md形式確定後）
- タスク5はタスク1,2完了後

## リスク・不明点

| リスク | 対策 |
|--------|------|
| Figma MCP namespace | **確定済み**: `mcp__claude_ai_Figma__*`（このセッションのdeferred tools一覧で確認） |
| `use_figma` Plugin API学習コスト | `einja-common:figma-guide` と `einja-design:figma-product-designer` の手順を ui-design-generator.md に参照先として明示 |
| 既存の `.pen` ファイルを持つIssueとの後方互換 | 新規Issue作成分のみ対象。既存 `.pen` ファイルはそのまま（移行パスは別途） |
| Figma ファイル作成先プロジェクト | `figma-design-management.md` の `@einja:project-private` セクションで各プロジェクトが設定する形式を定義 |
| Figma認証前提 | ui-design-generator のステップ0に `whoami` 確認を追加（失敗時はPENDING_QUESTIONS） |

## 検証・動作確認方法

1. **ファイル整合チェック（Bash）**:
   - 変更対象12ファイルが更新済みであること
   - `grep -r "ui-design\.pen" .claude/skills/einja-issue-spec-create/ .claude/agents/einja/issue-specs/ .claude/skills/einja-review-spec/` → 0件（pencil-design-management.md を除く）
   - `grep -r "mcp__pencil" .claude/agents/einja/issue-specs/ui-design-generator.md .claude/skills/einja-review-spec/` → 0件
   - `grep "ui-design-url\.md" .claude/agents/einja/issue-specs/tasks-validator.md` → 1件以上

2. **figma-design-management.md の内容確認**:
   - `@einja:project-private` セクションが存在すること
   - フレーム命名規則（kebab-case、__サブコンポーネント、--状態バリアント）が記載されていること

3. **SKILL.md の成果物ツリー確認**:
   - `ui-design-url.md` が基本構成・分割構成の両方に記載されていること

4. **ui-design-url.md のフォーマット確認**:
   - YAMLフロントマター（figma_url, file_key, frames）セクションが含まれること
