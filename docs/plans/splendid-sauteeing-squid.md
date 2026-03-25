# Plan: stable-branch間PRのPR Preview除外 & Vercel自動デプロイ無効化

## Context

下流リポジトリ（eenchow）でstable-branch間PR（develop→staging）を作成した際、`deploy-pr-preview.yml` が発火し、不要なNeonブランチ作成・Vercelプレビューデプロイが実行されている。また、Vercel Git Integrationの自動デプロイも無効化されておらず、GitHub ActionsのデプロイとVercel自動デプロイの二重デプロイが発生している可能性がある。

## 現状

- `deploy-pr-preview.yml`: `on: pull_request` にブランチフィルタなし。ciジョブの`if`はフォーク除外のみ
- `cleanup-pr-preview-on-close.yml`: 同上。stable-branch間PRクローズ時もNeon削除・Vercel alias削除が発火
- `create-release-draft.yml`: 既に `head.ref != 'develop/staging/main'` で除外済み（参考パターン）
- `vercel.json`: テンプレート・下流リポジトリともに未設置。Vercel Git Integration自動デプロイが有効のまま
- `einja-infra-maintenance` category-3-vercel.md: Vercel自動デプロイ無効化の手順記載なし

## 変更内容

### 1. `deploy-pr-preview.yml` — stable-branch間PR除外

**対象**: `packages/create-app/templates/default/.github/workflows/deploy-pr-preview.yml`

`ci`ジョブと`discover`ジョブの両方にif条件を追加。`neon-and-schema`は`needs: [ci]`、`deploy`は`needs: [neon-and-schema, discover]`のため、両ゲートをスキップすれば後続全体がスキップされる。

> 注: `discover`ジョブは`ci`に依存していない独立ジョブのため、`ci`だけの修正では`discover`がスキップされない。

```yaml
ci:
  # stable-branch間PR（develop→staging, staging→main等）はdeploy-stable-branchesが担当するためスキップ
  if: >
    github.repository != 'einja-inc/einja-management-template' &&
    github.event.pull_request.head.repo.full_name == github.repository &&
    !(contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.head.ref) &&
      contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.base.ref))
```

`discover`ジョブ（`ci`に依存しない独立ジョブ）:
```yaml
discover:
  if: >
    github.repository != 'einja-inc/einja-management-template' &&
    !(contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.head.ref) &&
      contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.base.ref))
```

### 2. `cleanup-pr-preview-on-close.yml` — stable-branch間PR除外

**対象**: `packages/create-app/templates/default/.github/workflows/cleanup-pr-preview-on-close.yml`

`discover`ジョブ（ゲートジョブ）と`cleanup-neon`ジョブ（独立ジョブ）の両方にif条件を追加。

`discover`ジョブ:
```yaml
discover:
  if: >
    github.repository != 'einja-inc/einja-management-template' &&
    github.event.pull_request.head.repo.full_name == github.repository &&
    !(contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.head.ref) &&
      contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.base.ref))
```

`cleanup-neon`ジョブ（`discover`に依存しない独立ジョブのため個別に条件追加）:
```yaml
cleanup-neon:
  if: >
    github.repository != 'einja-inc/einja-management-template' &&
    github.event.pull_request.head.repo.full_name == github.repository &&
    !(contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.head.ref) &&
      contains(fromJSON('["main","develop","staging"]'), github.event.pull_request.base.ref))
```

### 3. テンプレートに `vercel.json` 追加 — Git Integration自動デプロイ無効化

**対象**:
- `packages/create-app/templates/default/apps/web/vercel.json`（新規）
- `packages/create-app/templates/default/apps/admin/vercel.json`（新規）

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

GitHub Actionsが `vercel build --prebuilt` + `vercel deploy` でデプロイを一元管理しているため、VercelのGit pushトリガーによる自動デプロイは不要。

### 4. `einja-infra-maintenance` Vercelセットアップ手順に自動デプロイ無効化の説明追加

**対象**: `.claude/skills/einja-infra-maintenance/references/category-3-vercel.md`

「新規プロジェクト作成」セクションのステップ4（APIでRoot Directory設定）の後に、Git自動デプロイ無効化の確認ステップを追加。`vercel.json` がテンプレートに含まれるため、基本は自動適用されるが、既存プロジェクトでの確認手順として記載。

## タスク概要

| ID | タスク | 依存 | Skill/サブエージェント |
|----|--------|------|----------------------|
| 0-0 | タスク分解・登録 | - | [TaskCreate] |
| 0-1 | Planファイル配置 | 0-0 | [Write] |
| 1 | `deploy-pr-preview.yml` ci + discover条件修正 | - | [general-purpose] |
| 2 | `cleanup-pr-preview-on-close.yml` 2ジョブ条件修正（discover + cleanup-neon） | - | [general-purpose] |
| 3 | `apps/web/vercel.json` + `apps/admin/vercel.json` 新規作成 | - | [general-purpose] |
| 4 | `category-3-vercel.md` 手順追加 | - | [general-purpose] |
| 99-1 | コードレビュー | 1-4 | [einja-review-code] |
| 99-2 | 動作確認（YAMLバリデーション） | 1-4 | [Bash] |
| 99-G | コミット承認ゲート | 99-1,99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

- タスク1〜4は全て独立ファイルの変更のため**全並列**実行可能
- worktree不要（ワークフローYAML + JSON + ドキュメントの軽微修正のみ）

## リスク・不明点

- **低リスク**: `vercel.json` の `git.deploymentEnabled: false` はVercel CLI経由のデプロイには影響しない（Git pushトリガーのみ無効化）
- **確認済み**: `create-release-draft.yml` は既にstable-branch間PR除外済みのため修正不要
- **テンプレートリポジトリ本体**: `apps/` にvercel.jsonは不要（ワークフローが `github.repository != 'einja-inc/einja-management-template'` でスキップされるため）
- **前提確認済み**: `deploy-stable-branches.yml` は `on: push: branches: [main, develop, staging]` でstable-branchへのマージ時デプロイをカバーしている

## 検証・動作確認方法

1. YAMLの構文バリデーション（`python -c "import yaml; yaml.safe_load(open(...))"` または `yq`）
2. JSONバリデーション（`jq . vercel.json`）
3. `create-release-draft.yml` との除外条件パターンの一貫性確認
