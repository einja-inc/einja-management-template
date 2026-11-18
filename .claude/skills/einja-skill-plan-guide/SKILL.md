---
name: einja-skill-plan-guide
description: "Guides Skill design planning and implementation review. Use when creating a new Skill in Plan mode (Workflow A: parent agent reads this to define Skill specifications) or when reviewing a completed Skill implementation (Workflow B: sub-agent reads this to run quality checklists). Triggers: 'Skill計画', 'Skill仕様策定', 'skill-plan-guide', 'Skill品質チェック'. Do NOT use for: Skill implementation itself (use einja-skill-creator instead), Skill作成必要性の評価 (use einja-skill-first instead)"
user-invocable: false
---

# einja-skill-plan-guide: Skill設計の計画・レビューガイド

## 概要

このSkillは2つの用途で使用する:

| 用途 | 使用者 | タイミング |
|------|--------|-----------|
| **ワークフローA: Skill設計計画** | 親エージェント（Planモード） | 新規Skill作成の計画時 |
| **ワークフローB: Skill実装レビュー** | サブエージェント | Skill実装完了後 |

### 連携フロー

```
einja-skill-first（概要仕様出力）
  → einja-skill-plan-guide ワークフローA（詳細仕様策定）
    → einja-skill-creator（実装）
      → einja-skill-plan-guide ワークフローB（Skill固有品質チェック）
        → einja-review-code（汎用コードレビュー）※利用可能な場合
```

---

## ワークフローA: Skill設計計画

Planモードで親エージェントが新規Skillの設計を行う際の手順。

### Step 1: 要件の明確化

以下を特定する:

- **何を解決するか**: ユーザーのどの課題・作業を自動化するか
- **対象ユーザー/チーム**: 全社共通か、特定チーム向けか
- **既存Skillとの重複**: 類似Skillが存在しないか確認

### Step 2: Skill分類の決定

| 分類 | 特徴 | `context: fork` | `user-invocable` |
|------|------|:---:|:---:|
| オーケストレーター | 対話・ワークフロー管理。ユーザーとの対話が必要 | なし | `true` |
| タスク型 | 独立完結する作業を委託される | `fork` 推奨 | 単独利用なら `true` |
| 参照型 | ガイドライン・情報提供のみ | なし | 単独利用しないなら `false` |

**判断基準**:
- ユーザーと直接対話してワークフローを進めるか → オーケストレーター
- 他Skillやサブエージェントから呼ばれて独立した作業を完結するか → タスク型
- 情報提供のみで独立したタスク指示を持たないか → 参照型

> **⚠️ `context: fork` の制約**: Forked Skillは隔離サブエージェントで実行されるため、
> 内部からSkill tool（他Skillの呼び出し）やAgent tool（サブエージェント起動）を使用できない。
> 他Skillとの連携やサブエージェント起動が必要な場合は、オーケストレーター型（`context: fork` なし）を選択すること。

### Step 3: 配置先の決定

| 配置先 | ディレクトリ名 | 条件 | 例 |
|--------|--------------|------|-----|
| 配布対象 | `.claude/skills/einja-{name}/` | 全プロジェクトに配布するSkill | einja-skill-creator, einja-task-exec |
| インナー配布 | `.claude/skills/_einja-{name}/` | 他Skillから内部参照されるSkill | _einja-output-format, _einja-project-overview |
| リポジトリ固有 | `.claude/skills/{name}/` | このリポジトリでのみ使うSkill | npm-release, cli-package-specs |

**判断基準**:
- 全プロジェクト共通で配布するか → `einja-{name}`
- 他Skillから内部的に参照されるか → `_einja-{name}`
- このリポジトリ固有の作業か → プレフィックスなし

### Step 4: Skill仕様の策定

以下を決定する:

1. **name**: lowercase + hyphens、gerund形推奨、64文字以内
2. **description**: 3rd person、what + when + triggers + "Do NOT use for"、1024文字以内
3. **frontmatter設定**: context: fork、user-invocable、allowed-tools
   - `context: fork` を設定する場合、Skill内でSkill tool / Agent toolは使用不可（隔離サブエージェントの制約）
4. **依存Skill**: Agent Teams使用時 → agent-teams-guide、Pencil使用時 → pencil-guide 等
5. **Progressive disclosure設計**: SKILL.md本体 vs references/ の分離方針
6. **本文の責務・入出力定義**: SKILL.md本文には責務・入出力・責任範囲の必須6項目（責務／スコープ外／使用タイミング／入力／出力／依存スキル）を含める。書式は [`references/skill-body-template.md`](./references/skill-body-template.md) を参照（`references/planning-checklist.md` の「9. SKILL.md本文の必須6項目」と対応）

#### description の記述ルール

```
[What: 何をするか] + [When: いつ使うか/トリガーフレーズ] + [Do NOT use for: 使わない場面]
```

- 3rd person で記述（"Manages..." "Generates..." 等）
- 具体的なトリガーフレーズを含める
- 類似Skillとの混同を防ぐネガティブトリガーを含める

#### Progressive disclosure 設計

| レベル | 内容 | ロードタイミング |
|--------|------|----------------|
| Level 1: frontmatter | name, description | 常時（トリガー判定用） |
| Level 2: SKILL.md body | コアワークフロー、重要な制約 | Skill関連時 |
| Level 3: references/ | 詳細テンプレート、チェックリスト、長いガイドライン | 必要時のみ |

- SKILL.md body は **500行以内** に収める
- references/ は **1階層のみ**（references/sub/ は禁止）
- 長い references ファイルには TOC を含める

### Step 5: planファイルへの「Skill仕様」セクション出力

Step 1-4 の結果を planファイルに記載する。テンプレートは `references/planning-checklist.md` を参照。

---

## ワークフローB: Skill実装レビュー

Skill実装完了後にSkill固有の品質を検証するレビュー。汎用コードレビューは `einja-review-code` に委譲する。

### Phase 1: Skill固有チェックリストレビュー

**実行者**: general-purpose サブエージェント

#### Step 1: Frontmatter品質チェック

- name: lowercase + hyphens、64文字以内
- description: 3rd person、what + when + triggers、1024文字以内
- user-invocable: Skill種別に適切か
- context: fork: タスク型のみに使われているか
- allowed-tools: 必要最小限か
- Agent Teams使用時: 前提セクションに agent-teams-guide 読み込みが含まれているか

#### Step 2: 構造・ボリュームチェック

- SKILL.md body が **500行以内** か
- Progressive disclosure が適切か（詳細は references/ に分離）
- 参照ファイルは **1階層のみ** か
- 長い参照ファイルに TOC があるか
- 用語が一貫しているか
- 時間依存情報（「現在」「最新」等）を含んでいないか
- 具体例が含まれているか
- 明確なワークフローステップがあるか

#### Step 3: einja設計思想適合チェック

- ユーザーに専門知識を求めていないか
- 質問は平易な言葉・選択肢形式か
- 技術的操作（git、API、ファイル操作等）は自動実行されるか
- 実行コンテキストの収集は自律的か
- エラー時の自動リカバリが設計されているか
- 中間成果物の確認に視覚的手段が優先されているか
- AskUserQuestion で description / Note の2層記述がされているか

#### Step 4: Anthropicベストプラクティス適合チェック

- 簡潔か（Claudeが既知の情報を繰り返していないか）
- 自由度がタスクの脆弱性に適合しているか
- Windowsパス（`C:\`等）を使用していないか
- description が曖昧でないか（具体的なトリガーがあるか）
- スコープクリープがないか（単一目的に集中しているか）
- フィードバックループ（validate → fix → repeat）が含まれているか
- MCP参照が完全修飾名か
- 選択肢の提示にデフォルトが付いているか

#### Step 5: 本文責務定義チェック（F）

SKILL.md本文に責務・入出力・責任範囲の必須6項目（責務／スコープ外／使用タイミング／入力／出力／依存スキル）が含まれ妥当かを、`references/review-checklist.md` の「F. 本文責務定義」カテゴリで判定する。適用可否（新規Skillは必須／既存の軽微変更は N/A）は同カテゴリ冒頭の判定基準に従う。

#### Step 6: レビュー結果の出力

各チェック項目を pass/fail で判定し、以下の形式で出力:

```markdown
## Skill レビュー結果: {skill-name}

### 判定: PASS / FAIL

### チェック結果

| カテゴリ | 項目 | 判定 | 備考 |
|---------|------|:---:|------|
| A. Frontmatter | name | pass | - |
| A. Frontmatter | description | fail | トリガーフレーズが不足 |
| ... | ... | ... | ... |

### 修正が必要な項目（FAILの場合）
1. {修正指示1}
2. {修正指示2}
```

→ 詳細チェックリストは `references/review-checklist.md` を参照。

#### 不合格時の修正フロー

1. 修正サブエージェント（general-purpose）を起動し、修正指示を渡す
2. 修正完了後、再レビューを実施（**最大1回**）
3. 再レビューでも不合格の場合は Phase 2 に進まず、指摘箇所を「要改善」として明記して完了

### Phase 2: 汎用コードレビュー委譲

**実行者**: `einja-review-code` Skill（利用可能な場合）

Phase 1 通過後、`einja-review-code` Skillが利用可能であれば呼び出す。`einja-review-code` は内部で codex-agent を含む多角的なコードレビューを実施する。

**`einja-review-code` が利用できない場合**: Phase 1 の結果のみでレビュー完了とする。

---

## 参考リソース

- `references/planning-checklist.md` — Planファイル用Skill仕様テンプレート
- `references/review-checklist.md` — 実装レビュー用チェックリスト
- `references/skill-body-template.md` — SKILL.md本文の必須6項目テンプレート

<!-- @references
- url: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
  type: docs
  description: Anthropic公式 Skill ベストプラクティス
- url: https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
  type: docs
  description: Anthropic公式 Skill完全ガイドPDF
-->

<!-- @einja:project-private:start id="einja-skill-plan-guide-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
