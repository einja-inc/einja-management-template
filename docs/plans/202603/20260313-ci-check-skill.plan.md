# einja-task-commit / einja-create-pr にCI確認・自動修正機能を追加

## Context

`einja-task-commit` はプッシュ後、`einja-create-pr` はPR作成後にそれぞれ終了しており、GitHub Actions CIの結果を確認しない。CI失敗に気付くのはユーザーが手動で確認したときのみであり、修正サイクルが遅延する。

## 現状

- `einja-task-commit`: 6ステップ構成。ステップ6（`git push`）で終了
- `einja-create-pr`: 5ステップ構成。Step 5（`gh pr create`）で終了
- 既存CI監視パターン: `npm-release` / `einja-infra-maintenance` に `gh run list` + `gh run view --log-failed` の実績あり
- PRトリガーCI: `.github/workflows/deploy-pr-preview.yml`

## 変更内容

### 方針: 共通インナーSkill `_einja-ci-check` を新規作成

CI確認・自動修正フローを `_einja-ci-check` インナーSkillに切り出し、両Skillから参照する。

- 重複記述を避ける（60-80行のフローを2箇所に複製しない）
- `_einja-` プレフィックスなのでビルド時に自動配布される

### `_einja-ci-check` インナーSkillの処理フロー

**パラメータ:** `prNumber`（任意、未指定時は自動検出）、`maxRetries`（デフォルト2）、`timeout`（デフォルト300秒）

**Phase 1: PR検出**
- `gh pr view --json number,url,headRefName` で現在ブランチのPRを検出
- PRなし or mainブランチ直プッシュ → スキップ

**Phase 2: CI待機**
- `timeout {timeout} gh pr checks {pr-number} --watch --fail-fast` でCI完了を待機
- フォールバック: `gh run list` 30秒ポーリング（`--watch` がTTY環境問題で動かない場合）

**Phase 3: 結果判定**
- `success` → 成功報告して終了
- `timeout` → タイムアウト報告して終了
- `failure` → Phase 4へ

**Phase 4: 失敗時の自動修正フロー**

| エラーカテゴリ | パターン | 自動修正 | 対処 |
|--------------|---------|---------|------|
| lint/format | ESLint, Biome エラー | 可 | `pnpm lint --fix` / `pnpm format` |
| TypeScript型エラー | `TS\d{4}:` | 可 | サブエージェントに委託 |
| テスト失敗 | `FAIL`, `AssertionError` | 可 | サブエージェントに委託 |
| ビルドエラー | `Build failed`, `Module not found` | 可 | サブエージェントに委託 |
| 環境・権限エラー | `NEON_API_KEY`, `NPM_TOKEN` | 不可 | ユーザーに報告 |

- 修正後は直接 `git add/commit/push`（`einja-task-commit` の再帰呼び出しを避ける）
- コミットメッセージ: `fix: CI修正 - {エラー概要}`
- Phase 2に戻ってCI再確認（最大 `maxRetries` 回）

### 各Skillへの追加

**einja-task-commit:** ステップ7（CI確認）を追加
- プッシュ完了後、PRが存在する場合のみ `_einja-ci-check` を実行
- スキップ条件: PRなし、mainブランチ直プッシュ、einja-task-exec経由

**einja-create-pr:** Step 6（CI確認）を追加
- PR作成後、`_einja-ci-check` を `prNumber` 指定で実行
- スキップ条件: `--auto` モード（task-exec経由）

## タスク概要

| # | タスク | Skill/サブエージェント |
|---|--------|----------------------|
| 0 | Planファイルリネーム | 親エージェント |
| 1 | `_einja-ci-check` インナーSkill作成 | [einja-skill-creator] |
| 2 | `einja-task-commit/SKILL.md` にステップ7追加 | [サブエージェント] |
| 3 | `einja-create-pr/SKILL.md` にStep 6追加 | [サブエージェント] |
| 99-1 | コードレビュー | [einja-review-code] |
| 99-G | コミット承認ゲート | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | [einja-task-commit] |

## 並列実行計画

- タスク1 → タスク2, 3（並列）→ 99系
- タスク2とタスク3はタスク1完了後に並列実行可能

## リスク・不明点

- **`gh pr checks --watch` のTTY問題**: サブエージェント環境で動かない可能性。フォールバック方式を記載
- **再帰呼び出し防止**: CI修正コミットは直接 `git add/commit/push` を使う
- **task-exec経由時のスキップ**: 二重実行防止が必要

## 検証・動作確認方法

1. PRありブランチで `einja-task-commit` 実行 → ステップ7でCI確認が走ることを確認
2. PRなしブランチで `einja-task-commit` 実行 → スキップされることを確認
3. `einja-create-pr` 手動実行 → Step 6でCI確認が走ることを確認
