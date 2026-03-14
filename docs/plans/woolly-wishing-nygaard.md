# Plan: einja-skill-plan-guide Skill作成 + CLAUDE.md更新

## Context

Skill作成時の計画品質を標準化するため、`einja-skill-plan-guide` Skillを作成する。einja-skillsリポジトリの `skill-plan-guide` を参考に、このプロジェクトの命名規則・配置ルールに適応させる。また、CLAUDE.mdのPlanモードステップに「Skill作成時の仕様策定」手順を追加する。

## 現状

- einja-skillsリポジトリに `skill-plan-guide` Skill が存在（参考元）
- このプロジェクトにはSkill計画ガイドが存在しない
- `einja-skill-first` がSkill作成の必要性を評価し概要仕様を出力 → `einja-skill-creator` が実装を担当するが、計画時の**詳細仕様策定ガイド**が欠けている
- CLAUDE.mdのPlanモードステップにSkill仕様策定の手順がない

## 変更内容

### 1. `einja-skill-plan-guide` Skill作成

**配置先**: `.claude/skills/einja-skill-plan-guide/`（`einja-` プレフィックス → 配布対象）

**frontmatter設定**:
- `user-invocable: false`（親エージェントが読み込む参照型Skill）
- `allowed-tools` なし（情報提供のみ）

**ファイル構成**:
```
einja-skill-plan-guide/
├── SKILL.md
└── references/
    ├── planning-checklist.md
    └── review-checklist.md
```

**参考元からの主な適応点**:

| 箇所 | 参考元 | 適応後 |
|------|--------|--------|
| Step 3 配置先テーブル | `plugins/{name}/skills/` vs `.claude/skills/` | `einja-*`（配布）/ `_einja-*`（インナー配布）/ プレフィックスなし（リポジトリ固有）の3分類 |
| planning-checklist Section 4 | `plugins/` / `.claude/skills/` の2分類 | 同上の3分類に差し替え |
| ワークフローB Phase 2 | `codex-agent` 単独でCodex品質ゲート | `einja-review-code` Skillに委譲（codex-agentを内包済み）。ワークフローBの役割を「Skill固有チェックリスト」に限定し、汎用コードレビューは `einja-review-code` に任せる |
| SKILL.md末尾 | なし | `@einja:project-private` コメントブロックを追加 |

**`einja-skill-first` との連携フロー**:
```
einja-skill-first（概要仕様出力）
  → einja-skill-plan-guide ワークフローA（詳細仕様策定）
    → einja-skill-creator（実装）
      → einja-skill-plan-guide ワークフローB（Skill固有品質チェック）
        → einja-review-code（汎用コードレビュー）
```

**配布先リスク対策**:
- ワークフローB Phase 2 で `einja-review-code` を参照する箇所は「利用可能な場合」の条件付きとし、存在しない環境でもワークフローが破綻しないようにする

### 2. CLAUDE.md更新

**対象セクション**: Planモード時の必須フロー

**追加内容**: ステップ4の注記として追加（ステップ番号の繰り下げなし）:

```markdown
4. 実装・レビューで使うSkill/サブエージェントを選定し、planに記載
   - **Skill作成の計画時**: 親エージェントが `einja-skill-plan-guide` を Skill ツールで読み込み、ワークフローAに従ってSkill仕様を策定する。策定した仕様はplanファイルの「Skill仕様」セクションに記載する
```

### 3. CLAUDE.md キーワードトリガー追加

| キーワード | 使用するSkill |
|-----------|--------------|
| `Skill計画` `Skill仕様策定` `skill-plan-guide` `Skill品質チェック` | `.claude/skills/einja-skill-plan-guide/SKILL.md` |

※ `Skillレビュー` は将来 `einja-review-code` と衝突するリスクがあるため除外

## タスク概要

| # | ステップ | 使用Skill/サブエージェント |
|---|---------|------------------------|
| 0 | Planファイルを `docs/plans/202603/20260312-skill-plan-guide.plan.md` にリネーム | 親エージェント |
| 1 | SKILL.md + references/ 作成 | `general-purpose` サブエージェント |
| 2 | CLAUDE.md更新（Planステップ注記 + キーワードトリガー） | `general-purpose` サブエージェント（1と並行） |
| 3 | 完了レビュー | `einja-review-code` |

## 並列実行計画

- タスク0: 最初に実行（親エージェント）
- タスク1, 2: 並列実行可能（変更対象ファイルが重複しない）
- タスク3: 1, 2 完了後に実行

## リスク・不明点

| リスク | 対策 |
|--------|------|
| 配布先で `einja-review-code` が存在しない可能性 | ワークフローB Phase 2 を条件付き参照にする |
| `einja-skill-first` の概要仕様との重複 | 責務を明確に分離: skill-first=概要、plan-guide=詳細仕様 |

## 検証・動作確認方法

- SKILL.mdのfrontmatter形式が正しいこと
- references/ 配下のファイルが存在し、配置先テーブルが適応済みであること
- CLAUDE.mdのPlanモードステップ4に注記が追加されていること
- キーワードトリガーが追加されていること
- `@einja:project-private` ブロックが含まれていること
- `pnpm prepush` が通ること
