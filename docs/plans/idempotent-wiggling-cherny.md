# サブエージェント質問プロトコル（PENDING_QUESTIONS）導入

## Context

Claude Code v2.0.56以降、**サブエージェントではAskUserQuestionがシステムレベルでフィルタリングされ動作しない**（GitHub Issue [#12890](https://github.com/anthropics/claude-code/issues/12890), [#20275](https://github.com/anthropics/claude-code/issues/20275)で確認済み）。また**CLAUDE.mdはサブエージェントに自動ロードされない**。

現在8つのエージェントがAskUserQuestionを参照しているが、全て動作しない。Agent toolの`resume`パラメータ（コンテキスト維持で再開）を活用し、親経由で質問するプロトコルを導入する。

## 変更方針

- **共通Skill**にプロトコルを1箇所だけ定義し、全エージェントに`skills:`でpreload
- **CLAUDE.md**に親側のハンドリングルールを追加
- 各エージェントの既存AskUserQuestion YAML例は**参照情報として残し**、PENDING_QUESTIONS形式の使用例を併記

## 変更内容

### 1. 共通Skill作成（新規）
**パス**: `.claude/skills/einja-subagent-question-protocol/SKILL.md`

内容:
- サブエージェントではAskUserQuestionが動作しない旨の説明
- PENDING_QUESTIONSフォーマット定義（具体的な出力例付き）
- AskUserQuestion YAML → PENDING_QUESTIONS形式の変換ガイド
- ルール: 1回にまとめる、選択肢と背景・影響を含める、resumeで再開後に作業継続

フォーマット例:
```markdown
## PENDING_QUESTIONS

以下の不明点の解消が必要です。

### Q1: [質問タイトル]
**背景**: [なぜこの質問が必要か]

| 選択肢 | 説明 | メリット | デメリット |
|--------|------|----------|------------|
| A: [ラベル] | [詳細] | [メリット] | [デメリット] |
| B: [ラベル] | [詳細] | [メリット] | [デメリット] |

**推奨**: A（[理由]）
```

### 2. CLAUDE.md（親側ハンドリング追加）
**パス**: `CLAUDE.md`

「サブエージェント委託ルール」セクション内に追加:

```markdown
### サブエージェント質問プロトコル（PENDING_QUESTIONS）

サブエージェント出力に `## PENDING_QUESTIONS` が含まれている場合:
1. 質問内容を解析し、AskUserQuestionでユーザーに確認
2. Agent toolの`resume`パラメータで同じサブエージェントを再開（コンテキスト維持）
3. プロンプトにユーザーの回答を含めて渡す
4. 再度PENDING_QUESTIONSがある場合は同様に処理（最大2回まで）
```

### 3. 全エージェント定義の更新

#### 3a. issue-specs系（`skills:` フィールド追加 + 「優先順位3」書き換え）

| ファイル | 変更 |
|---|---|
| `requirements-generator.md` | `skills:` 追加 + 49-52行目をプロトコル参照1行に |
| `design-generator.md` | `skills:` 追加 + 103-107行目をプロトコル参照1行に |
| `qa-generator.md` | `skills:` 追加 + 62行目をプロトコル参照1行に |
| `tasks-generator.md` | `skills:` 追加 + 95行目をプロトコル参照1行に |

書き換え後:
```markdown
- **優先順位3: ユーザーへの確認（最終手段）**
  - 上記の方法で解決できない場合、preload済みの「サブエージェント質問プロトコル」に従いPENDING_QUESTIONS形式で質問を返却して停止する
```

#### 3b. task系・architect系（`skills:` にpreload追加 + AskUserQuestion部分に注釈追加）

| ファイル | 変更 |
|---|---|
| `task-executer.md` | `skills: []` に追加 + AskUserQuestion YAML例の前に「⚠️ サブエージェントではAskUserQuestionは動作しない。代わりにPENDING_QUESTIONS形式で返却すること」注釈を追加 |
| `task-reviewer.md` | `skills:` 追加 + 同様の注釈 |
| `frontend-architect.md` | `skills:` に追加 + 同様の注釈 |
| `backend-architect.md` | `skills:` に追加 + 同様の注釈 |

**注釈の形式**（各AskUserQuestion YAML例の直前に挿入）:
```markdown
> ⚠️ サブエージェントではAskUserQuestionは動作しません。
> 以下のYAML例は「どんな質問をすべきか」の参照情報です。
> 実際にはpreload済みの「サブエージェント質問プロトコル」に従い、
> PENDING_QUESTIONS形式で質問を返却して停止してください。
```

これにより既存YAML例の情報（選択肢・description・推奨理由）を完全に保持しつつ、プロトコルへの誘導を行う。

### 4. 変更不要なエージェント

Explore, tasks-validator, task-qa（Skill側で処理済み）, task-modification-analyzer, docs-updater, codex-agent, design-engineer, frontend-coder, ui-design-generator

## 変更ファイルまとめ

| # | ファイル | 操作 |
|---|---|---|
| 1 | `.claude/skills/einja-subagent-question-protocol/SKILL.md` | **新規作成** |
| 2 | `CLAUDE.md` | 親側ハンドリング追加 |
| 3 | `.claude/agents/einja/issue-specs/requirements-generator.md` | skills追加 + 記述置換 |
| 4 | `.claude/agents/einja/issue-specs/design-generator.md` | skills追加 + 記述置換 |
| 5 | `.claude/agents/einja/issue-specs/qa-generator.md` | skills追加 + 記述置換 |
| 6 | `.claude/agents/einja/issue-specs/tasks-generator.md` | skills追加 + 記述置換 |
| 7 | `.claude/agents/einja/task/task-executer.md` | skills追加 + 注釈追加 |
| 8 | `.claude/agents/einja/task/task-reviewer.md` | skills追加 + 注釈追加 |
| 9 | `.claude/agents/einja/frontend-architect.md` | skills追加 + 注釈追加 |
| 10 | `.claude/agents/einja/backend-architect.md` | skills追加 + 注釈追加 |

## 検証方法

### 静的検証（Grep）
1. 共通Skillファイルが存在し、PENDING_QUESTIONSフォーマット例が含まれること
2. CLAUDE.mdに親側ハンドリングセクションが存在すること
3. 対象8エージェントの`skills:`に`einja-subagent-question-protocol`が含まれること

### 動作検証（手動）
4. requirements-generatorを意図的に曖昧な要件でフォアグラウンド起動し、PENDING_QUESTIONS形式で質問が返却されることを確認
5. 返却された質問をAskUserQuestionで確認後、resumeで再開してコンテキストが維持されていることを確認
