# create-app CLI: --yesオプション登録漏れ修正 + sync scriptsカテゴリ漏れ修正

## Context

`einja-dev:init` SkillがClaude Code環境で `npx @einja-inc/create-app@latest` を実行すると、対話プロンプトが表示されるが入力できず失敗する。根本原因は `cli.ts` に `--yes` オプションが登録されていないこと（`create.ts` にはロジック実装済み）。加えて、Codex分析で `sync` コマンドの `--all/--yes` 時に `scripts` カテゴリが漏れている問題も発見。

## 変更内容

### 修正1: `packages/create-app/src/cli.ts`
createコマンドに `-y, --yes` オプションを追加（create.tsの既存ロジックを有効化）

### 修正2: `packages/create-app/src/commands/sync.ts`
`--all/--yes` 時の全カテゴリ配列に `"scripts"` を追加

## 検証結果

- ビルド成功
- `--help` で `-y, --yes` 表示確認
- `einja-test-yes --yes --skip-git --skip-install` でプロンプトなし完了確認
- コードレビュー PASS
