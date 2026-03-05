# Plan: docs-updater Agent を薄いラッパーに簡素化

## Context

`docs-updater` Agent（`.claude/agents/einja/docs/docs-updater.md`）と `update-docs-by-task-specs` Command（`.claude/commands/einja/update-docs-by-task-specs.md`）が機能的にほぼ完全に重複している。Agent側は自ら「`update-docs-by-task-specs` コマンドのロジックに従って処理を実行します」と記載しているが、ステップ1〜6（33〜151行）でコマンドのロジックを丸コピーしている。

docs-updater は task-exec の Phase 99 から Agent ツールで呼ばれるサブエージェントであり、メインコンテキストの肥大化を防ぐ役割がある。Agent定義は残しつつ、ロジックの重複を解消する。

## 変更内容

### 1. docs-updater.md の簡素化

- **対象**: `.claude/agents/einja/docs/docs-updater.md`
- ステップ1〜6のロジック詳細（33〜151行）を削除
- 「`.claude/commands/einja/update-docs-by-task-specs.md` を Read して指示に従う」という委託形式に書き換え
- frontmatter（name, description, model, color）、入力形式、実行制約は維持

### 2. spec-tasks-generator.md の記述確認

- **対象**: `.claude/agents/einja/specs/spec-tasks-generator.md` (264行目、274行目付近)
- 「docs-updater エージェント」の記述はそのまま維持（docs-updater を残すため変更不要）

## 対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `.claude/agents/einja/docs/docs-updater.md` | 簡素化（ロジック重複部分を委託形式に書き換え） |

## 検証

- 簡素化後の docs-updater.md が正しくコマンドを参照していることを Read で確認
- `git diff --stat` で意図しない変更がないことを確認
