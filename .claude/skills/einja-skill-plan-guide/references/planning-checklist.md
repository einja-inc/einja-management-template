# Skill仕様テンプレート（Planファイル用）

Planファイルの「Skill仕様」セクションに以下のテンプレートを記載する。各項目を埋めてから実装に進むこと。

## 目次

- [1. 基本情報](#1-基本情報)
- [2. description](#2-description)
- [3. 分類](#3-分類)
- [4. 配置先](#4-配置先)
- [5. Frontmatter設定](#5-frontmatter設定)
- [6. 依存Skill](#6-依存skill)
- [7. Progressive disclosure設計](#7-progressive-disclosure設計)
- [8. einja設計思想チェック](#8-einja設計思想チェック)
- [9. SKILL.md本文の必須6項目](#9-skillmd本文の必須6項目)

---

## 1. 基本情報

| 項目 | 値 |
|------|-----|
| **Skill名** | `{skill-name}` |
| **命名規則チェック** | lowercase + hyphens、gerund形推奨、64文字以内 |

### 命名のガイドライン

- lowercase + hyphens のみ使用（例: `new-product-discovery`）
- 動作を表す場合は gerund 形を推奨（例: `generating-reports` > `report-generator`）
- 64文字以内
- 配布対象Skillには `einja-` プレフィックスを付与する

## 2. description

```
{3rd person で記述。What + When + Triggers + Do NOT use for}
```

### チェック項目

- [ ] 3rd person で記述しているか（"Manages..." "Generates..." 等）
- [ ] **What**: 何をするかが明確か
- [ ] **When**: いつ使うか / トリガーフレーズが具体的か
- [ ] **Do NOT use for**: 類似Skillとの混同を防ぐネガティブトリガーがあるか
- [ ] 1024文字以内か

## 3. 分類

| 項目 | 値 |
|------|-----|
| **分類** | オーケストレーター / タスク型 / 参照型 |
| **判断理由** | {なぜこの分類か} |

### 判断基準の確認

- [ ] ユーザーと直接対話してワークフローを進めるか → オーケストレーター
- [ ] 他Skill/サブエージェントから呼ばれて独立した作業を完結するか → タスク型
- [ ] 情報提供のみで独立したタスク指示を持たないか → 参照型

## 4. 配置先

| 項目 | 値 |
|------|-----|
| **配置先** | `einja-{name}` / `_einja-{name}` / プレフィックスなし |
| **判断理由** | {なぜこの配置先か} |

### 判断基準の確認

- [ ] 全プロジェクト共通で配布するか → `.claude/skills/einja-{name}/`（配布対象）
- [ ] 他Skillから内部的に参照されるか → `.claude/skills/_einja-{name}/`（インナー配布）
- [ ] このリポジトリ固有の作業か → `.claude/skills/{name}/`（リポジトリ固有）

## 5. Frontmatter設定

```yaml
---
name: {skill-name}
description: "{description}"
user-invocable: {true/false}
# context: fork  # タスク型のみ。オーケストレーター・参照型では設定しない
# allowed-tools:  # 必要最小限のツールを列挙
#   - Bash
#   - Read
---
```

### チェック項目

- [ ] `user-invocable`: Skill種別に適切か
- [ ] `context: fork`: タスク型のみに設定しているか
- [ ] `context: fork` 設定時: Skill内でSkill tool / Agent toolの呼び出しを前提としていないか（隔離サブエージェントではこれらのツールは使用不可）
- [ ] `allowed-tools`: 必要最小限か（不要なツールを含んでいないか）

## 6. 依存Skill

| 依存Skill | 条件 |
|-----------|------|
| `einja-common:agent-teams-guide` | Agent Teams（TeamCreate等）を使用する場合、SKILL.mdの前提セクションに読み込み指示を含める |
| `einja-common:pencil-guide` | Pencil MCPを使用する場合 |
| {その他} | {条件} |

## 7. Progressive disclosure設計

| レベル | 内容 | 行数目安 |
|--------|------|---------|
| SKILL.md body | {コアワークフロー、重要な制約} | 500行以内 |
| references/{file1}.md | {詳細テンプレート等} | - |
| references/{file2}.md | {チェックリスト等} | - |

### チェック項目

- [ ] SKILL.md body が500行以内に収まる見込みか
- [ ] 詳細情報を references/ に適切に分離しているか
- [ ] references/ は1階層のみか（ネストなし）
- [ ] 長い references ファイルにはTOCを含める予定か

## 8. einja設計思想チェック

- [ ] ユーザーに専門知識を求めない設計か
- [ ] 質問は平易な言葉・選択肢形式を優先しているか
- [ ] 技術的操作はすべてSkill内で自動実行されるか
- [ ] 実行コンテキストの収集はSkillが自律的に行うか
- [ ] エラー発生時の自動リカバリが設計されているか
- [ ] 中間成果物の確認に視覚的手段を優先しているか

## 9. SKILL.md本文の必須6項目

新規Skillの SKILL.md 本文には、責務・入出力・責任範囲を宣言する以下6項目を必ず含める。書式・記入例は [`references/skill-body-template.md`](./skill-body-template.md) を参照。

- [ ] **責務**: 達成する唯一の主目的が動詞1〜2文で明記されているか（複数責務が並ぶ場合は分割を検討）
- [ ] **スコープ外（やらないこと）**: 他Skillへ委譲する範囲が委譲先Skill名つきで明記されているか
- [ ] **使用タイミング**: 呼び出し元（ユーザー直接／Skill名／サブエージェント名）と局面が明記されているか
- [ ] **入力**: 必須入力／オプション入力が「名前・型/形式・説明」で書かれているか（参照型Skillは『なし』または `N/A` 可）
- [ ] **出力**: 形式（ファイル／パス／文字列／構造化データ等）と内容の骨子が明記されているか
- [ ] **依存スキル**: 内部で呼ぶ他Skillが列挙、なければ「なし」と明記されているか

> Skill分類（タスク型／参照型／オーケストレーター）による記入の読み替えは skill-body-template.md の「分類別の記入指針」を参照。
