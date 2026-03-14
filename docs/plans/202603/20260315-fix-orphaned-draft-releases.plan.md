# ドラフトリリースがマージ後にundraftされない問題の修正

## Context

下流リポジトリ（eenchow等）で、PRマージ後にドラフトリリースが正式リリースに変換されず、ドラフトのまま残り続ける問題。
https://github.com/einja-inc/eenchow/releases で確認済み（PR #230〜#239の全ドラフトが残存）。

## 根本原因の検証結果

eenchowの残存ドラフトPR（#230, #233, #235, #237, #239）を `gh pr view --json files` で確認した結果、**全PRにchangesetファイルが含まれていない**ことが判明。

これにより、`deploy-stable-branches.yml` の `has_changesets == 'true'` ゲートがundraftをスキップし、ドラフトが永久に残る、という仮説が確定。

## 現状

### リリースフロー設計（foamy-sauteeing-petal.md より）

```
PR作成 → create-release-draft.yml → draft release作成（draft-pr-{N}タグ）
PRマージ → deploy-stable-branches.yml → release-staging/production → undraft
PRクローズ(未マージ) → create-release-draft.yml cleanup → draft削除
```

### 問題箇所: `deploy-stable-branches.yml`

`release-staging` (L374) と `release-production` (L596-601) の両方で、undraftロジックが `has_changesets == 'true'` でゲートされている:

```yaml
- name: Create PreRelease tag
  if: steps.check.outputs.has_changesets == 'true'  # ← changesetなしだとスキップ

- name: Publish PreRelease
  if: steps.tag.outputs.tag  # ← 上がスキップなのでこれもスキップ
```

**結果**: changesetファイルなしでPRをマージすると、undraftもタグ作成も実行されず、ドラフトリリースが永久に残る。

### `create-release-draft.yml` との責務分離（競合なし確認済み）

- `create-release-draft.yml` のcleanupジョブは `!github.event.pull_request.merged` 条件（L242）
- **マージ時は発動しない** → `deploy-stable-branches.yml` 側でのcleanupと競合しない

## 変更内容

### アプローチ: undraftロジックをchangesetゲートから分離

changesetの有無に関わらず、マージ時にドラフトリリースを処理する。

| changesetあり | changesetなし |
|-------------|-------------|
| version bump → タグ作成 → draft undraft（正式リリース） | バージョン変更なし → タグなし → **draft削除 + 仮タグ削除** |

changesetなしの場合は「リリースに値する変更がない」ため、ドラフトを正式リリースに変換するのではなく**クリーンアップ（削除）**する。これはリリースフローの設計意図（changesetがリリースの起点）と整合する。

> **ユーザー要求との整合**: ユーザーは「Preリリースとリリースが作成されない」と報告しているが、実態は「changesetを含めていないPRのみ」が問題。changeset込みのPRをマージすれば正常にリリースが作成される。changesetなしPRではドラフトが残らないよう削除するのが正しい対応。

### 対象ファイル

- `.github/workflows/deploy-stable-branches.yml` — release-staging / release-production ジョブ
- `packages/create-app/templates/default/.github/workflows/deploy-stable-branches.yml` — テンプレート側（681行で完全一致確認済み）

### release-staging の変更（L368〜L453あたり）

変更後の構造:
```
Check for changesets
  → [has_changesets == true] → Create PreRelease tag → Publish PreRelease (undraft) ※既存ロジック変更なし
  → [has_changesets == false && pr_number] → Cleanup draft release (draft削除 + 仮タグ削除)
```

新規ステップ追加（既存の `Publish PreRelease` ステップの後に配置）:
```yaml
- name: Cleanup draft release (no changesets)
  if: steps.check.outputs.has_changesets == 'false' && steps.pr.outputs.pr_number
  uses: actions/github-script@v7
  with:
    script: |
      const prNumber = '${{ steps.pr.outputs.pr_number }}';
      const draftTag = `draft-pr-${prNumber}`;

      // Delete draft release（404は正常系: 既に手動削除済み等）
      try {
        const resp = await github.rest.repos.getReleaseByTag({
          owner: context.repo.owner,
          repo: context.repo.repo,
          tag: draftTag
        });
        await github.rest.repos.deleteRelease({
          owner: context.repo.owner,
          repo: context.repo.repo,
          release_id: resp.data.id,
        });
        core.info(`Deleted draft release for PR #${prNumber}`);
      } catch (e) {
        if (e.status !== 404) throw e;
        core.info('No draft release found, skipping');
      }

      // Delete temp tag（独立try-catch: リリース削除失敗時もタグ削除を試行）
      // 404/422は正常系: タグが存在しないか既に削除済み
      try {
        await github.rest.git.deleteRef({
          owner: context.repo.owner,
          repo: context.repo.repo,
          ref: `tags/${draftTag}`
        });
        core.info(`Deleted tag ${draftTag}`);
      } catch (e) {
        if (e.status !== 404 && e.status !== 422) throw e;
        core.info(`Tag ${draftTag} already deleted or not found`);
      }
```

### release-production の変更（L596〜L679あたり）

同様のパターン。既存の `Commit version bump and create Release` ステップの後に同じクリーンアップステップを追加。

## タスク概要

| ID | タスク | 依存 | Skill/担当 |
|----|--------|------|-----------|
| 0-0 | タスク分解・登録 | - | TaskCreate |
| 0-1 | Planファイルリネーム | 0-0 | Bash |
| 1 | 両 `deploy-stable-branches.yml`（本体+テンプレート）にchangesetなし時のdraftクリーンアップステップ追加（release-staging + release-production） | 0-1 | `general-purpose` サブエージェント |
| 2 | 既存ドラフトの一括削除スクリプト実行（eenchow） | 1 | Bash |
| 99-1 | コードレビュー | 1 | `einja-review-code` |
| 99-2 | 動作確認（YAMLバリデーション） | 1 | Bash |
| 99-G | コミット承認ゲート | 99-1, 99-2 | AskUserQuestion |
| 99-3 | コミット・プッシュ | 99-G | `einja-task-commit` |

### 並列実行計画

- タスク1のみが実装タスク（本体+テンプレートを1タスクで同時変更）
- タスク2（既存ドラフト掃除）はタスク1完了後に実行（スコープ内だがコミット対象外）
- 99-1, 99-2 は並列実行可能

## リスク・不明点

| リスク | 対策 |
|--------|------|
| 既存の残存ドラフトリリースの掃除 | タスク2で `gh release delete` による一括削除を実施 |
| PR番号が特定できないケース（直接push等） | 既存の `listPullRequestsAssociatedWithCommit` ロジックに依存。`pr_number` 空の場合はcleanupスキップ（ドラフトは残るが害はない） |
| 仮タグが存在しないケース | 404/422を正常系として扱うidempotentな実装（Codexレビュー指摘反映済み） |

## 検証・動作確認方法

1. YAMLシンタックス確認: `actionlint` or YAML構文チェック
2. ロジック確認: changeset有無の分岐が正しく動作するか手動トレース
3. 既存ドラフト掃除: タスク2で下流リポジトリ（eenchow）の残存ドラフトを一括削除
4. E2E: 下流リポジトリでchangesetなしPRをマージし、ドラフトが削除されることを確認

## Planレビュー結果

### 第1回レビュー: MAJOR

| レビュアー | 判定 | 主な指摘 |
|-----------|------|---------|
| Planレビュー | MAJOR | 根本原因未検証、ユーザー要求との不一致、タスク分割冗長、競合可能性、既存ドラフト掃除がタスク外 |
| codex-agent | MINOR | cleanup idempotent化、仮タグ不在の正常系扱い |

### 第1回レビュー指摘への対応

| 指摘 | 対応 |
|------|------|
| 根本原因の確認不足 | eenchowの5PRを調査し、全PRにchangesetなしを確認。「根本原因の検証結果」セクション追加 |
| ユーザー要求との不一致 | 「ユーザー要求との整合」補足を追加。changesetなし→削除が正しい対応であることを説明 |
| タスク1と2の分割が冗長 | タスク1に統合（本体+テンプレートを同時変更） |
| create-release-draft.ymlとの競合 | L242の条件確認済み、マージ時は発動しないことを「責務分離」セクションに明記 |
| 既存ドラフト掃除がタスク外 | タスク2として追加 |
| cleanup idempotent化 | 実装コード例にて別try-catch + 404/422を正常系として反映 |
