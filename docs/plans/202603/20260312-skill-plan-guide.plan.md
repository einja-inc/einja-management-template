# Plan: einja-skill-plan-guide Skill作成 + CLAUDE.md更新

## Context

Skill作成時の計画品質を標準化するため、`skill-plan-guide` Skillを作成する。einja-skillsリポジトリの同名Skillを参考に、このプロジェクトの命名規則・配置ルールに適応させる。また、CLAUDE.mdのPlanモードステップに「Skill作成時の仕様策定」手順を追加する。

## 現状

- einja-skillsリポジトリに `skill-plan-guide` Skill が存在（参考元）
- このプロジェクトにはSkill計画ガイドが存在しない
- `einja-skill-first` がSkill作成の必要性を評価し、`einja-skill-creator` が実装を担当するが、計画時の仕様策定ガイドが欠けている
- CLAUDE.mdのPlanモードステップにSkill仕様策定の手順がない

## 変更内容

### 1. `einja-skill-plan-guide` Skill作成

**配置先**: `.claude/skills/einja-skill-plan-guide/`

**ファイル構成**:
```
einja-skill-plan-guide/
├── SKILL.md
└── references/
    ├── planning-checklist.md
    └── review-checklist.md
```

**参考元からの主な適応点**:
- 配置先セクション: `plugins/` → このプロジェクトの命名規則（`einja-*` / `_einja-*` / プレフィックスなし）に変更
- ワークフローA（Skill設計計画）: 基本的にそのまま踏襲
- ワークフローB（Skill実装レビュー）: `einja-review-code` との棲み分けを明記
- references/: planning-checklist.md、review-checklist.md をそのまま適応

### 2. CLAUDE.md更新

**対象セクション**: Planモード時の必須フロー

**追加内容**: ステップ4（実装・レビューで使うSkill/サブエージェントを選定）の後に以下を追加:
```
4.5. **Skill作成の計画時**: 親エージェントが `skill-plan-guide` を Skill ツールで読み込み、ワークフローAに従ってSkill仕様を策定する。策定した仕様はplanファイルの「Skill仕様」セクションに記載する
```

### 3. CLAUDE.md キーワードトリガー追加

| キーワード | 使用するSkill |
|-----------|--------------|
| `Skill計画` `Skill仕様策定` `skill-plan-guide` `Skillレビュー` `Skill品質チェック` | `.claude/skills/einja-skill-plan-guide/SKILL.md` |

## タスク概要

| # | ステップ | 使用Skill/サブエージェント |
|---|---------|------------------------|
| 1 | SKILL.md + references/ 作成 | `general-purpose` サブエージェント |
| 2 | CLAUDE.md更新（Planステップ + キーワードトリガー） | `general-purpose` サブエージェント（1と並行） |
| 3 | 完了レビュー | `einja-review-code` |

## 並列実行計画

- タスク1, 2 は並列実行可能（変更対象ファイルが重複しない）
- タスク3 は 1, 2 完了後に実行

## リスク・不明点

- なし（参考元が明確で、適応箇所も限定的）

## 検証・動作確認方法

- SKILL.mdのfrontmatter形式が正しいこと
- references/ 配下のファイルが存在すること
- CLAUDE.mdのPlanモードステップに新ステップが正しく挿入されていること
- キーワードトリガーが追加されていること
- `pnpm prepush` が通ること
