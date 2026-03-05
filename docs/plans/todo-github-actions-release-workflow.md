# TODO: GitHub Actions リリースワークフロー + 承認フロー

## Phase 1: changesets基盤導入
- [x] `package.json` に devDependencies + scripts 追加
- [x] `.changeset/config.json` 新規作成
- [x] `pnpm install` で依存関係インストール

## Phase 3: deploy-stable-branches.yml 大規模改修
- [x] ワークフロー全体ガード（無限ループ防止）追加
- [x] `permissions: contents: write` 追加
- [x] migrate ジョブをブランチ別に分割
- [x] deploy ジョブをブランチ別に分割（develop/staging/production）
- [x] release-staging ジョブ追加（PreRelease作成）
- [x] release-production ジョブ追加（changeset消費 + Release作成）

## Phase 4: .github/release.yml
- [x] リリースノート設定ファイル新規作成

## Phase 5: changeset-status.yml
- [x] PR上のchangesetステータス表示ワークフロー新規作成

## Phase 6: einja-create-pr Skill
- [x] `.claude/skills/einja-create-pr/SKILL.md` 新規作成
- [x] `.claude/commands/einja/issue-exec.md` のPR作成部分をeinja-create-pr呼び出しに変更

## Phase 7: ドキュメント追記
- [x] `docs/einja/steering/infrastructure/deployment.md` にリリース管理セクション追記
- [x] `docs/einja/steering/development-workflow.md` にchangeset運用フロー追記

## 検証
- [x] YAML構文検証（deploy-stable-branches.yml, changeset-status.yml）
- [x] JSON構文検証（.changeset/config.json）
- [x] ワークフロージョブ構造確認（9ジョブ、ブランチ別分岐、環境設定）
- [x] `pnpm prepush` 通過（lint + typecheck + test）
