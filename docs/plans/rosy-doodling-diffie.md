# Plan: sync コマンドの .gitignore フィルタが .claude/ 配下のコピーを妨害するバグ修正

## Context

利用者プロジェクトで `npx @einja-inc/dev-cli sync` を実行しても `.claude/skills/` と `.claude/agents/` にeinja標準のSkill・サブエージェントがコピーされない。原因は `FileFilter` が利用者プロジェクトの `.gitignore` を読み込み、`.claude/` パターンで sync 対象を全除外してしまうため。

## 現状

### 根本原因

`packages/cli/src/lib/sync/file-filter.ts:316` で `this.projectRoot` の `.gitignore` を読み込み、`shouldExclude()` で `.claude/` 配下の全ファイルを除外している。

### 影響範囲

| カテゴリ | パス | 影響 |
|---------|------|------|
| agents | `.claude/agents/einja/` | 全除外 |
| skills | `.claude/skills/einja-*/` | 全除外 |
| hooks | `.claude/hooks/einja/` | 全除外 |
| claude-config | `.claude/settings.json` | 別コードパス（特別処理）のため無事 |
| docs, env, tools 等 | `docs/einja/` 等 | 影響なし |

## 変更内容

### 変更1: `shouldExclude()` から `.gitignore` チェックを完全削除

sync は「テンプレートからプロジェクトへファイルを配置する」操作であり、コピー先の `.gitignore` でフィルタリングするのは意味的に誤り。

**対象ファイル**: `packages/cli/src/lib/sync/file-filter.ts`
- `import ignore from "ignore"` を削除
- `private ignoreFilter` フィールドを削除
- `loadGitignore()` メソッド全体を削除
- `scanSyncTargets()` 内の `await this.loadGitignore()` 呼び出しを削除
- `shouldExclude()` 内の `.gitignore` チェック（L221-223）を削除

**対象ファイル**: `packages/cli/src/lib/sync/file-filter.test.ts`
- `.gitignoreパターンで除外できること` テストケース（L177-193）を削除

### 変更2: sync 実行時に `.gitignore` から `.claude/` 行を自動除去

`.claude/` が `.gitignore` に入っているとeinja管理ファイルが git 追跡されないため、sync 時に自動除去する。

**対象ファイル**: `packages/cli/src/commands/sync.ts`
- `syncCommand` のステップ2（マネージャー初期化後）〜ステップ3（メタデータ読み込み前、約180行目付近）に処理を追加
- `.gitignore` に `.claude/` 行があれば除去し、ログ出力する
- `--dry-run` 時は「除去予定」のログのみ出力
- インライン実装（数行で済むためユーティリティ関数の切り出し不要）

## タスク概要

| # | タスク | Skill/サブエージェント | 依存 |
|---|--------|----------------------|------|
| 0-0 | タスク登録 [TaskCreate] | 親エージェント | - |
| 0-1 | Planファイルリネーム | 親エージェント | 0-0 |
| 1-1 | `file-filter.ts` から .gitignore フィルタリング削除 + テスト更新 | サブエージェント | 0-1 |
| 1-2 | `sync.ts` に `.gitignore` から `.claude/` 除去処理を追加 | サブエージェント | 0-1（1-1と並行可） |
| 99-1 | コードレビュー [einja-review-code] | Skill | 1-1, 1-2 |
| 99-2 | テスト実行 `pnpm --filter @einja-inc/dev-cli test` [Bash] | 親エージェント | 1-1, 1-2 |
| 99-G | コミット承認ゲート [AskUserQuestion] | 親エージェント | 99-1, 99-2 |
| 99-3 | コミット・プッシュ [einja-task-commit] | Skill | 99-G |

## 並列実行計画

- タスク 1-1 と 1-2 は並行実行可能（異なるファイル）

## リスク・不明点

- `ignore` パッケージが他の箇所で使われていないか → `file-filter.ts` でのみ使用。削除後に依存を `package.json` から外すかは任意（他で使われていなければ外す）
- `.gitignore` の `.claude/` 除去でユーザーの意図に反する可能性 → ユーザー確認済み「消して良い」

## 検証・動作確認方法

1. `pnpm --filter @einja-inc/dev-cli test` で全テスト通過
2. ローカルビルド後に利用者プロジェクトで `sync --only agents,skills,hooks --dry-run` を実行し、ファイルが検出されることを確認
