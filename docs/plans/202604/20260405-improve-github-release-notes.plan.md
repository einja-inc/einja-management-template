# GitHub Release改善: リリースノート分類 + Draft昇格修正

## Context

GitHub Releaseの内容がchangesetのraw内容とパッケージ変更ファイル数しか出ておらず貧弱。また、PRマージ後にDraft Releaseが正式リリースに昇格されていない。

## 現状

### リリースノート生成（`create-release-draft.yml` L46-86）
- changesetの`.md`ファイル内容をそのまま表示
- パッケージ変更ファイル数のみ表示
- コミット一覧やPR分類は**なし**

### Draft昇格（`deploy-stable-branches.yml`）
昇格ロジックは`release-staging`（L388-536）と`release-production`（L663-825）に存在するが、以下のケースで昇格しない:

1. **changesetがない場合**: Draft Releaseが昇格ではなく**削除**される
2. **PR番号が解決できない場合**: `listPullRequestsAssociatedWithCommit`が失敗→フォールバックで新規リリース作成→旧Draftが孤児化
3. **昇格時にbodyを更新しない**: Draft時の貧弱な内容がそのまま引き継がれる

### `.github/release.yml`（GitHub自動分類設定）
3カテゴリのみ（New Features, Bug Fixes, Other Changes）。`generateReleaseNotes` API使用時のみ有効だが、現在はフォールバック時にしか使われない。

## 変更内容

### 1. `.github/release.yml` — カテゴリ拡充
Conventional Commitsに対応したラベル・カテゴリを追加:
- Breaking Changes / New Features / Bug Fixes / Improvements / Documentation / Infrastructure / Tests / Other

### 2. `.github/workflows/create-release-draft.yml` — リリースノート生成改善

「Generate release notes body」ステップを差し替え:
- `git log BASE_SHA...HEAD_SHA --oneline --no-merges --max-count=200` でコミット一覧取得
- Conventional Commits prefix（スコープ付き対応: `/^(\w+)(?:\([^)]+\))?:\s*(.+)/`）でカテゴリ分類
  - feat → New Features / fix → Bug Fixes / refactor,perf,style → Improvements / docs → Documentation / ci,build,chore → Infrastructure / test → Tests / その他 → Other
- 分類結果をMarkdownセクションとして出力
- 既存のchangeset・パッケージ変更セクションは末尾に残す
- `execSync`には `{ encoding: 'utf8', cwd: process.env.GITHUB_WORKSPACE }` を明示

**補足**: Draft段階ではコミットベースの分類プレビュー。昇格時に`generateReleaseNotes` API（PR・ラベルベース）で正式版に差し替え。Draft段階のコミット分類はあくまでプレビューであり、最終リリースノートは昇格時のAPI出力が正。

出力イメージ:
```markdown
## What's Changed

### New Features
- ユーザー認証機能を追加 (`abc1234`)
- ダッシュボード画面を実装 (`def5678`)

### Bug Fixes
- ログイン時のリダイレクトエラーを修正 (`ghi9012`)

### Infrastructure
- CI/CDワークフローを改善 (`jkl3456`)

---
## Changesets
...
## Package Changes
...
```

### 3. `.github/workflows/deploy-stable-branches.yml` — Draft昇格修正

#### 3a. changesetなし時にpatch changesetを自動生成

現在の「Cleanup draft release (no changesets)」を以下に変更:

1. changesetファイルを自動生成（`echo "---\n'root-package': patch\n---\nRelease from PR #${prNumber}" > .changeset/auto-release.md`）
2. `npx changeset version` を実行（patchバージョンバンプ）
3. `git commit` + `git tag vX.Y.Z` + `git push --follow-tags`
4. 以降は既存のchangesetありフローと同じ昇格処理に合流

**メリット**: 既存のSemVerタグ体系（`vX.Y.Z`）を維持。`generateReleaseNotes`の`previous_tag_name`計算が破綻しない。

**実行順序（タグ→API→Release更新の順序保証）**:
1. `git push --follow-tags` でタグをリモートにpush
2. `generateReleaseNotes` API呼び出し（タグ存在が前提）
3. `updateRelease` でDraftを昇格 + body更新

staging/production共通で実装。PR番号が空の場合のみ従来通りDraft削除。

#### 3b. 昇格時にbodyを`generateReleaseNotes` APIで更新（staging + production両方）

既存の`updateRelease`呼び出しに`body`パラメータを追加:

```javascript
// タグpush後に実行（順序保証）
const releases = await github.rest.repos.listReleases({
  owner: context.repo.owner, repo: context.repo.repo, per_page: 10,
});
const previousRelease = releases.data.find(r => !r.draft && !r.prerelease && r.tag_name !== tag);
const previousTag = previousRelease ? previousRelease.tag_name : undefined;

const notesResp = await github.rest.repos.generateReleaseNotes({
  owner: context.repo.owner, repo: context.repo.repo,
  tag_name: tag, target_commitish: context.sha,
  ...(previousTag ? { previous_tag_name: previousTag } : {}),
});

await github.rest.repos.updateRelease({
  // ...既存フィールド...
  body: notesResp.data.body,  // 追加
});
```

**env設定**: `github-script`ステップの`env:`セクションに `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` を必ず含める（`gh` CLI フォールバック用）。

#### 3c. PR番号解決のフォールバック追加

`listPullRequestsAssociatedWithCommit`が失敗した場合:
1. `listReleases`（per_page: 20）でdraft-pr-*タグのDraftリリースを検索
2. 1件のみの場合→そのPR番号を使用（warningログ出力）
3. 複数件の場合→最新のものを使用（warningログ出力、作成日時でソート）
4. 0件の場合→PR番号なしとして処理（フォールバックで`gh release create --generate-notes`）

## タスク概要

| ID | 内容 | 依存 | 並列可 |
|----|------|------|--------|
| 0-0 | TaskCreate一括登録 | - | - |
| 0-1 | Planファイル配置 [`Write`] | 0-0 | - |
| 1 | `.github/release.yml` カテゴリ拡充 [`Edit`] | 0-1 | Yes (2と並列) |
| 2 | `create-release-draft.yml` リリースノート生成改善 [`Edit`] | 0-1 | Yes (1と並列) |
| 3a | `deploy-stable-branches.yml` changeset自動生成 + 昇格フロー統合 [`Edit`] | 0-1 | No (3bに先行) |
| 3b | `deploy-stable-branches.yml` 昇格時body更新 + PR番号フォールバック [`Edit`] | 3a | No |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | 1,2,3b | - |
| 99-2 | 動作確認（actionlint + 静的レビュー） [`Bash`] | 1,2,3b | - |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | 99-1,99-2 | - |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | 99-G | - |

## 並列実行計画

```
Phase 1 (並列): タスク1 + タスク2
Phase 2 (直列): タスク3a → タスク3b
Phase 3 (並列): 99-1 + 99-2
Phase 4 (直列): 99-G → 99-3
```

Phase 1とPhase 2は異なるファイルのため並列可能。ただし3a→3bは同一ファイル内の依存あり。
→ 実質: Phase 1 (1 + 2 + 3a) 並列開始、3b は 3a 完了後。

## リスク・不明点

| リスク | 対策 |
|--------|------|
| `generateReleaseNotes` APIはタグが存在する前提 | `git push --follow-tags`後に呼び出す（順序を明示的に保証） |
| changeset自動生成のpackage名がリポジトリにより異なる | `package.json`の`name`フィールドを動的に読み取って使用 |
| 下流リポジトリでConventional Commits未使用 | 「Other」カテゴリが全キャッチ。昇格時は`generateReleaseNotes`がPRラベルベースで正式分類 |
| `git log`が大量コミットで遅い | `--max-count=200` で制限 |
| Draft段階のコミット分類と昇格後のPRラベル分類が食い違う | Draft段階は「プレビュー」と位置付け。最終はAPI出力が正 |

## 検証・動作確認方法

1. **YAMLバリデーション**: `actionlint`による構文チェック
2. **静的レビュー**: GitHub Actions構文、API呼び出しパラメータ、env設定の正確性を確認
3. **実環境テスト**: 下流リポジトリでPR作成→Draft Release内容確認→マージ→昇格確認（changesetあり/なし両パターン）
