# Forked Skill内のツール制約の明文化

## Context

`context: fork` で実行されるSkillは、隔離されたサブエージェントコンテキストで動作するため、
内部からさらにSkill tool / Agent toolを呼び出すことができない。
この制約はClaude Codeの仕様だが、Skill設計・実装系のSkillに明文化されていない。
新しいSkill作成時に誤設計（forkしたSkill内でSkill/Agent呼び出しを前提とした設計）するリスクがある。

## 現状

- `einja-skill-plan-guide/SKILL.md`:
  - Step 2（44行目〜）: Skill分類テーブルで `context: fork` をタスク型に推奨
  - Step 4（74行目）: frontmatter設定として `context: fork` を言及
  - **ただし `context: fork` 時のツール制約（Skill/Agent呼び出し不可）の記述なし**
- `einja-skill-plan-guide/references/planning-checklist.md`:
  - 89行目: `context: fork` チェック項目あり（タスク型のみか確認）
  - **制約に関する注意事項なし**
- `einja-skill-plan-guide/references/review-checklist.md`:
  - 25行目: A4チェック項目で `context: fork` のタスク型制約をチェック
  - **ツール制約の検証項目なし**
- `einja-skill-creator/SKILL.md`:
  - 98行目: `allowed-tools` を1行で説明
  - **`context: fork` の制約記述なし**
- 現在 `context: fork` を実際に使っているSkillは **ゼロ**（既存Skillに影響なし）

## 変更内容

### 1. `einja-skill-plan-guide/SKILL.md`

**Step 2 Skill分類テーブル（44行目〜）の直後に注意事項を追加:**

```markdown
> **⚠️ `context: fork` の制約**: Forked Skillは隔離サブエージェントで実行されるため、
> 内部からSkill tool（他Skillの呼び出し）やAgent tool（サブエージェント起動）を使用できない。
> 他Skillとの連携やサブエージェント起動が必要な場合は、オーケストレーター型（`context: fork` なし）を選択すること。
```

**Step 4 frontmatter設定（74行目）の近くにも補足:**
- `context: fork` を設定する場合のツール制約を明記

### 2. `einja-skill-plan-guide/references/planning-checklist.md`

**89行目のチェック項目を拡充:**
```markdown
- [ ] `context: fork`: タスク型のみに設定しているか
- [ ] `context: fork` 設定時: Skill内でSkill tool / Agent toolの呼び出しを前提としていないか
```

### 3. `einja-skill-plan-guide/references/review-checklist.md`

**A4チェック項目（25行目）を拡充:**
- Forked Skill内でSkill/Agent呼び出しがないことの検証項目を追加

### 4. `einja-skill-creator/SKILL.md`

**98行目 `allowed-tools` 説明の直後に `context: fork` 制約ガイダンスを追加:**

```markdown
- **context: fork の制約**: `context: fork` を設定したSkillは隔離サブエージェントで実行される。
  Skill tool（他Skill呼び出し）やAgent tool（サブエージェント起動）は使用できない。
  他Skillとの連携が必要な場合は `context: fork` を使用しないこと。
```

## タスク概要

- タスク0: Planファイルを `docs/plans/202603/20260312-forked-skill-constraints.plan.md` にリネーム [Bash]
- タスク1: `einja-skill-plan-guide/SKILL.md` に制約注意事項を追加（Step 2 + Step 4） [Edit]
- タスク2: `einja-skill-plan-guide/references/planning-checklist.md` にチェック項目追加 [Edit]
- タスク3: `einja-skill-plan-guide/references/review-checklist.md` にチェック項目追加 [Edit]
- タスク4: `einja-skill-creator/SKILL.md` に制約ガイダンス追加 [Edit]

## 並列実行計画

タスク1〜4は全て独立。タスク0（リネーム）完了後、4つ並列実行可能。

## リスク・不明点

- リスク: 低。ドキュメント追記のみ
- 不明点: Skill toolが実際にforked Skill内で使えないかの確認（ユーザー情報に基づく）

## 検証・動作確認方法

- 各ファイルの追記箇所をReadで確認
- markdownの構造が崩れていないことを目視確認
