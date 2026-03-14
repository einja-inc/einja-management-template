# create-app CLI: --yesオプション登録漏れ修正 + sync scriptsカテゴリ漏れ修正

## Context

`einja-dev:init` SkillがClaude Code環境で `npx @einja-inc/create-app@latest` を実行すると、対話プロンプトが表示されるが入力できず失敗する。根本原因は `cli.ts` に `--yes` オプションが登録されていないこと（`create.ts` にはロジック実装済み）。加えて、Codex分析で `sync` コマンドの `--all/--yes` 時に `scripts` カテゴリが漏れている問題も発見。

## 現状

### create コマンド
- `cli.ts` (line 22-36): `--skip-git`, `--skip-install` のみ。`--yes` 未登録
- `create.ts` (line 30-34): `CreateOptions` に `yes?: boolean` 定義済み
- `create.ts` (line 72-95): `options.yes && projectName` でデフォルト値使用ロジック実装済み
- デフォルト値はプロンプトのデフォルトと完全一致（検証済み）

### sync コマンド
- `types/index.ts` (line 82): `"scripts"` がSyncCategory型に定義済み
- `sync.ts` (line 173-187): `--all/--yes` 時の全カテゴリ配列に `"scripts"` が欠落

## 変更内容

### 修正1: `packages/create-app/src/cli.ts`
createコマンドに `-y, --yes` オプションを追加:

```typescript
program
  .argument("[project-name]", "Project name")
  .option("--skip-git", "Skip git initialization")
  .option("--skip-install", "Skip package installation")
  .option("-y, --yes", "Use default values without prompts")
  .action(
    async (
      projectName: string | undefined,
      options: {
        skipGit?: boolean;
        skipInstall?: boolean;
        yes?: boolean;
      }
    ) => {
      await createCommand(projectName, options);
    }
  );
```

### 修正2: `packages/create-app/src/commands/sync.ts` (line 175-187)
`--all/--yes` 時の全カテゴリ配列に `"scripts"` を追加:

```typescript
categories = [
  "env",
  "tools",
  "git",
  "git-hooks",
  "github",
  "docker",
  "monorepo",
  "root-config",
  "scripts",    // ← 追加
  "apps",
  "packages",
  "docs",
];
```

## タスク概要

| # | タスク | 使用Skill/ツール |
|---|--------|-----------------|
| 0 | Planファイルを `docs/plans/202603/20260313-create-app-yes-option.plan.md` にリネーム | 親エージェント |
| 1 | `cli.ts` に `--yes` オプション追加 | サブエージェント |
| 2 | `sync.ts` の全カテゴリ配列に `scripts` 追加 | サブエージェント（タスク1と同一） |
| 99-1 | コードレビュー | `einja-review-code` |
| 99-2 | ビルド確認 + CLI動作確認 | Bash |
| 99-G | コミット承認ゲート | AskUserQuestion |
| 99-3 | コミット・プッシュ + リリース | `einja-task-commit` → `npm-release` |

## 並列実行計画

タスク1・2は同一サブエージェントで順次実行（2ファイルのみの軽微修正）。

## リスク・不明点

- リスクなし: 既存ロジックの有効化 + 配列への要素追加のみ
- einja-dev-initスキル（einja-skillsリポジトリ側）は今回スコープ外

## 検証・動作確認方法

1. `pnpm --filter @einja-inc/create-app build` でビルド成功
2. `node packages/create-app/dist/cli.js --help` で `--yes` 表示確認
3. 一時ディレクトリで `node packages/create-app/dist/cli.js test-project --yes --skip-git --skip-install` を実行し、プロンプトなしで完了することを確認

## 責務整理メモ（将来課題・P1〜P2）

Codex分析による追加改善提案（今回スコープ外）:

| 優先度 | 内容 |
|--------|------|
| P1 | `create-app` に `--json` オプション追加（Skill側の失敗解析を構造化） |
| P1 | `--scope`, `--auth`, `--use-current-dir` など非対話パラメータ拡張 |
| P2 | 統合syncコマンド（`einja sync --scope all` で dev-cli + create-app を一括実行） |
| P2 | 共通フラグ契約の統一（`--dry-run`, `--yes`, `--json`, `--no-backup`） |
| P2 | Syncカテゴリ定義の単一ソース化 |
