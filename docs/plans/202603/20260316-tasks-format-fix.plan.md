# Plan: einja-issue-spec-create タスクフォーマット逸脱問題の修正

## Context

`einja-issue-spec-create` のPhase 5（タスク生成）で、tasks-generatorサブエージェントが定義済みフォーマットを無視し、独自形式のタスク一覧を生成する問題が多発している。

例: [drlove_demo_app Issue #130](https://github.com/drlovekoushiki/drlove_demo_app/issues/130) では `Task 1-1` 形式、メタデータ欠落、横切り分割など、定義と全く異なる出力が生成された。

**前提**: 直前のPlan（`20260315-tasks-generator-improvement.plan.md`）でサブエージェント複数指定禁止 + `対応UIデザイン` フィールド追加が5ファイルに適用済み（未コミット）。本Planはその差分の上に追加変更を行う。

## 現状

### 根本原因

1. **Skillがフロントマターに登録されていない（最大の原因）**
   - `tasks-generator.md` のフロントマター `skills:` に `_einja-issue-spec-tasks-generator` が未登録（`_einja-subagent-question-protocol` のみ）
   - `tasks-validator.md` のフロントマターに `skills:` 自体がない
   - → Skillが自動プリロードされず、エージェントが本文の「参照してください」を読んで自分でファイルを開く必要がある
   - → コンテキストが膨大な時にそのステップを飛ばし、フォーマットルールを知らないまま生成してしまう

2. **フォーマットテンプレートがプロンプト末尾にない**
   - tasks-generator.md 内にテンプレート例はあるが、requirements.md + design.md + qa-tests を読み込んだ後のコンテキスト中盤に位置
   - Sonnetモデル（`model: sonnet`）はコンテキスト後半の指示を重視（リーセンシーバイアス）

3. **フォーマット定義のSST乖離**
   - `docs/einja/steering/task-management.md`（SST）: `**実装AC**` なし
   - `tasks-generator.md` / `_einja-issue-spec-tasks-generator/SKILL.md`: `**実装AC**` あり

4. **tasks-validatorがフォーマット根本逸脱を検出できない**
   - `Task 1-1` 形式や太字なしメタデータなど、根本的にフォーマットが異なる場合の検出ロジックがない

## 変更内容

### A. フロントマターにSkill登録（最重要）

| ファイル | 変更 |
|---------|------|
| `tasks-generator.md` | `skills:` に `_einja-issue-spec-tasks-generator` を追加 |
| `tasks-validator.md` | `skills:` を追加し `_einja-issue-spec-tasks-validator` と `_einja-subagent-question-protocol` を登録 |

### B. tasks-generator.md 末尾にフォーマット再掲

`## 特別な考慮事項` の後に「フォーマット最終確認」セクションを追加:
- Phase見出し形式、タスクグループ形式、タスク形式の簡易テンプレート
- 必須メタデータ6項目のリスト
- NG例/OK例テーブル（`Task 1-1` → `1.1` 等）

### C. references/format-rules.md に「よくある間違い」追記

既存の `_einja-issue-spec-tasks-generator/references/format-rules.md` に「よくある間違い（絶対禁止）」テーブルを追記。

### D. task-management.md に `**実装AC**` を追加（SST同期）

以下2箇所:
1. 必須メタデータ表に `**実装AC**` 行を追加
2. Issue本文構造テンプレート例に `**実装AC**` を含めた例に更新

### E. tasks-validator に根本フォーマットチェック + `**実装AC**` 必須化

**E-1. 構造前提チェック（新規）** — `_einja-issue-spec-tasks-validator/SKILL.md` と `tasks-validator.md`:
- `Task X-Y` 形式の検出 → 即FAILURE
- メタデータキーの太字チェック → FAILURE
- タスクグループ階層の存在チェック（3階層でない場合 → FAILURE）

**E-2. 必須メタデータに `**実装AC**` を追加**:
- `_einja-issue-spec-tasks-validator/SKILL.md` のメタデータ検証セクション
- `_einja-issue-spec-tasks-validator/references/validation-rules.md` の必須メタデータ一覧
- `tasks-validator.md` のメタデータ検証セクション

### F. einja-issue-spec-create のPhase 5追加指示にフォーマットリマインダー

`einja-issue-spec-create/SKILL.md` のPhase 5でtasks-generatorを呼ぶ際の追加指示にフォーマット準拠指示を追加（変更Aとの組み合わせで効果発揮）。

## タスク概要

### タスク0-1: Planファイルを `docs/plans/202603/20260316-tasks-format-fix.plan.md` にリネーム [`Bash`]

### タスク1（並列実行可能な3グループ）

| # | 内容 | 対象ファイル |
|---|------|-------------|
| 1-A | task-management.md に `**実装AC**` 追加 | `docs/einja/steering/task-management.md` |
| 1-B | tasks-generator.md フロントマター修正 + 末尾フォーマット再掲 + references/format-rules.md 強化 | `tasks-generator.md`, `_einja-issue-spec-tasks-generator/references/format-rules.md` |
| 1-C | tasks-validator.md フロントマター修正 + 根本チェック追加 + `**実装AC**` 必須化 + references/validation-rules.md 更新 + einja-issue-spec-create Phase 5 追加指示 | `tasks-validator.md`, `_einja-issue-spec-tasks-validator/SKILL.md`, `_einja-issue-spec-tasks-validator/references/validation-rules.md`, `einja-issue-spec-create/SKILL.md` |

**依存関係**: 1-A, 1-B, 1-C は並列実行可能（ファイル重複なし）

### 99系: 完了検証

| ID | 内容 |
|----|------|
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] |
| 99-G | コミット承認ゲート [`AskUserQuestion`] — 前回Planの変更も含めた全体コミット |
| 99-3 | コミット・プッシュ [`einja-task-commit`] |

## 並列実行計画

```
タスク0-1 (リネーム)
    │
    ├── タスク1-A (task-management.md)
    ├── タスク1-B (tasks-generator + format-rules.md)
    └── タスク1-C (tasks-validator + validation-rules.md + issue-spec-create)
    │
    └── 全完了後 → 99系（前回Plan変更も含めて一括コミット）
```

## リスク・不明点

- **リスク**: フォーマット再掲によるtasks-generator.mdのトークン数増加 → 末尾配置のため影響小
- **前回Plan変更との統合**: 未コミットの5ファイル変更に本Planの変更を追加する形。コミットは一括で行う

## 検証・動作確認方法

- 変更後のファイルを読み込み、フォーマット定義の一貫性を確認（SST ↔ generator ↔ validator）
- フロントマターのskills登録が正しいことを確認
- `pnpm prepush` が通ることを確認
- 実際のIssue生成テストは次回の `einja-issue-spec-create` 実行時に確認
