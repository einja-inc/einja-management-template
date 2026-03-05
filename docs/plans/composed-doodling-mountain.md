# GitHub Actions リリースワークフロー + 承認フロー設計

## Context

現在、main/staging/developへのpushで自動Vercelデプロイが走るが、GitHub Release作成・承認フローがない。リリースの可視性と本番デプロイの安全性を向上させるため、以下を導入する：

- staging マージ → GitHub **PreRelease** 自動作成
- main マージ → GitHub **Release** 自動作成
- production デプロイに **承認ゲート**（Environment Protection）

## 設計方針

| 項目 | 決定 |
|------|------|
| リリース順序 | PRマージ → 自動リリース作成 |
| 昇格フロー | staging → main 直接マージPR |
| バージョニング | changesets（Turborepo公式推奨） |
| 承認フロー | GitHub Environments + Required Reviewer 1名（productionのみ） |

## 全体フロー

```
feature/* → staging PR（changeset含む）
  ↓ マージ
[staging] → CI + Migrate + Deploy（承認不要）
          → PreRelease自動作成（v0.2.0-rc.42）
            ※ changeset未消費（タグ作成のみ）

staging → main PR（昇格）
  ↓ マージ
[main] → CI + ⚠️承認待ち → Migrate + Deploy
       → changeset version（バージョン確定）→ Release自動作成（v0.2.0）
```

## Codexレビュー反映事項

| # | 問題 | 修正内容 |
|---|------|---------|
| C-1 | stagingでchangeset消費すると main で残らない | `changeset version` はmainのみ。stagingはRCタグ作成のみ（未消費） |
| C-2 | `workflow_run` はdefault branch制約がある | release処理を `deploy-stable-branches.yml` 内ジョブに統合（独立ワークフロー廃止） |
| C-3 | `--previous-tag` は存在しないCLIオプション | `--notes-start-tag` に修正 |
| C-4 | 承認前にDBマイグレーションが走る | migrate + deploy 両方にproduction environment適用 |
| H-1 | `ci`ジョブのみの無限ループ防止は不十分 | `GITHUB_TOKEN` はデフォルトでワークフロー再起動しない特性を活用。ワークフロー全体ガード追加 |
| H-2 | `permissions: contents: write` 未定義 | 明示追加 |
| H-3 | `environment: ''` の動作が不確実 | ジョブ分割で解消（develop/staging/production別ジョブ） |
| H-4 | ブランチ保護との衝突リスク | version bumpはmainのみ。GITHUB_TOKEN使用（bot名義でprotection bypass可能な設定前提） |

## 実装ステップ

### Phase 1: changesets基盤導入

**変更ファイル:**
- `package.json` — `@changesets/cli`, `@changesets/changelog-github` をdevDependenciesに追加。scriptsに `"changeset": "changeset"` 追加
- `.changeset/config.json` — 新規作成

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "einja-inc/einja-management-template" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@einja/dev-cli", "create-einja-app"]
}
```

**リスク:** なし。既存フローに影響しない

### Phase 2: GitHub Environments設定（手動・GitHub UI）

| Environment | Required Reviewers | Wait Timer | Deployment Branches |
|------------|-------------------|------------|-------------------|
| `staging` | なし | なし | `staging`のみ |
| `production` | 1名 | なし | `main`のみ |

**リスク:** なし。ワークフローに`environment`参照がないため、設定だけでは動作変更なし

### Phase 3: `deploy-stable-branches.yml` 大規模改修

**変更概要:** デプロイジョブをブランチ別に分割 + リリース作成ジョブを統合

**改修前の構造:**
```
ci → changes → migrate → deploy（全ブランチ共通）
```

**改修後の構造:**
```
ci → changes → (ブランチ別分岐)
  ├─ [develop]  → deploy-develop（環境なし）
  ├─ [staging]  → deploy-staging（staging環境）→ release-staging（PreRelease作成）
  └─ [main]     → migrate-production（production環境・承認待ち）→ deploy-production → release-production（Release作成）
```

**主要な変更点:**

#### 3-1. ワークフロー全体ガード（無限ループ防止）
```yaml
on:
  push:
    branches: [main, develop, staging]

# GITHUB_TOKENで作成されたイベントはデフォルトでワークフロー再起動しない
# 念のため明示的にbotコミットを除外
jobs:
  ci:
    # github-actions[bot] のバージョンバンプコミットはスキップ
    if: "!contains(github.event.head_commit.message, 'chore: release v')"
```

#### 3-2. デプロイジョブをブランチ別に分割
```yaml
  # develop: 環境なし、承認なし
  deploy-develop:
    needs: [ci, changes]
    if: github.ref_name == 'develop' && needs.changes.outputs.deploy_matrix != '[]'
    runs-on: ubuntu-latest
    strategy: ...
    steps: ... # 既存のdeployステップをそのまま

  # staging: staging環境、承認なし
  deploy-staging:
    needs: [ci, migrate, changes]
    if: github.ref_name == 'staging' && ...
    environment: staging
    runs-on: ubuntu-latest
    strategy: ...
    steps: ... # 既存のdeployステップをそのまま

  # main: production環境、1名承認 → migrate → deploy
  migrate-production:
    needs: ci
    if: github.ref_name == 'main'
    environment: production  # ← ここで承認待ち（migrate前にブロック）
    runs-on: ubuntu-latest
    steps: ... # 既存のmigrateステップ

  deploy-production:
    needs: [migrate-production, changes]
    if: github.ref_name == 'main' && needs.changes.outputs.deploy_matrix != '[]'
    runs-on: ubuntu-latest
    strategy: ...
    steps: ... # 既存のdeployステップ
```

#### 3-3. リリース作成ジョブを統合（release-app.yml廃止）
```yaml
  permissions:
    contents: write  # タグ作成・Release作成に必要

  # staging: PreRelease作成（changeset未消費）
  release-staging:
    needs: deploy-staging
    if: github.ref_name == 'staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check for changesets
        id: check
        run: |
          COUNT=$(ls .changeset/*.md 2>/dev/null | grep -cv README.md || echo 0)
          echo "has_changesets=$([[ $COUNT -gt 0 ]] && echo true || echo false)" >> $GITHUB_OUTPUT
      - name: Create PreRelease tag
        if: steps.check.outputs.has_changesets == 'true'
        id: tag
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="v${VERSION}-rc.${{ github.run_number }}"
          git tag "$TAG"
          git push origin "$TAG"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
      - name: Create GitHub PreRelease
        if: steps.tag.outputs.tag
        run: |
          PREV=$(git tag --list 'v*-rc.*' --sort=-v:refname | grep -v "${{ steps.tag.outputs.tag }}" | head -1)
          OPTS="--prerelease --target staging --generate-notes"
          [[ -n "$PREV" ]] && OPTS="$OPTS --notes-start-tag $PREV"
          gh release create "${{ steps.tag.outputs.tag }}" --title "Pre-release ${{ steps.tag.outputs.tag }}" $OPTS
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # main: changeset消費 + Release作成
  release-production:
    needs: deploy-production
    if: github.ref_name == 'main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup
        uses: ./.github/actions/setup
      - name: Check for changesets
        id: check
        run: |
          COUNT=$(ls .changeset/*.md 2>/dev/null | grep -cv README.md || echo 0)
          echo "has_changesets=$([[ $COUNT -gt 0 ]] && echo true || echo false)" >> $GITHUB_OUTPUT
      - name: Version packages
        if: steps.check.outputs.has_changesets == 'true'
        run: npx changeset version
      - name: Commit version bump and create Release
        if: steps.check.outputs.has_changesets == 'true'
        id: release
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="v${VERSION}"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -m "chore: release ${TAG}" || echo "No changes"
          git tag "$TAG"
          git push origin main --follow-tags
          PREV=$(git tag --list 'v*' --sort=-v:refname | grep -v 'rc' | grep -v "$TAG" | head -1)
          OPTS="--target main --generate-notes"
          [[ -n "$PREV" ]] && OPTS="$OPTS --notes-start-tag $PREV"
          gh release create "$TAG" --title "Release ${TAG}" $OPTS
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**無限ループ防止の多重防御:**
1. `GITHUB_TOKEN` で作成されたpushイベントはデフォルトでワークフローを再トリガーしない
2. コミットメッセージ `chore: release v` でのフィルタリング
3. バージョンバンプコミットは `github-actions[bot]` 名義

**リスク:** 高。ジョブ分割により既存ワークフローの構造が大きく変わる。段階的にテストが必要

### Phase 4: `.github/release.yml` リリースノート設定

```yaml
changelog:
  exclude:
    labels: ["dependencies", "skip-changelog"]
  categories:
    - title: "New Features"
      labels: ["enhancement", "feature"]
    - title: "Bug Fixes"
      labels: ["bug", "fix"]
    - title: "Other Changes"
      labels: ["*"]
```

### Phase 5: `changeset-status.yml` 新規作成（任意）

PR上にchangesetの有無を表示するワークフロー。開発体験向上目的。

### Phase 6: einja-create-pr Skill新規作成

**新規ファイル:** `.claude/skills/einja-create-pr/SKILL.md`

**責務:** PR作成時にchangeset自動生成 + ラベル付与 + PR作成を一括実行

**処理フロー（5ステップ）:**

1. **差分分析**: `git log --format="%s%n%b" origin/{base}..HEAD` + `git diff --name-only origin/{base}..HEAD`
2. **changeset生成判定**:
   - スキップ条件: staging→main昇格PR、apps/配下に変更なし（docs/CI/設定のみ）、既にchangesetファイルがある
   - 変更種別推定: コミットメッセージプレフィックスの最大値（feat+fix→minor, feat!→major）
   - パッケージ判定: ファイルパスから（apps/web/** → @repo/web等）
3. **changeset生成**: `.changeset/{ランダム名}.md` を作成 → コミット
4. **ラベル判定**: PRタイトルプレフィックスから単一ラベル選択（enhancement/bug/maintenance）
5. **PR作成**: `gh pr create --title ... --body ... --label ...`

**動作モード:**
| モード | トリガー | changeset確認 | ラベル確認 |
|--------|---------|--------------|-----------|
| 自動 | task-exec/issue-exec経由 | 推定値で自動決定 | 自動 |
| 対話 | 手動 `/einja-create-pr` | AskUserQuestionで確認 | AskUserQuestionで確認 |

**既存ワークフローへの統合:**
- `issue-exec.md` のManagerのPR作成部分を `/einja-create-pr` 呼び出しに変更
- `task-exec.md` は変更不要（現状PR作成は含まない）

**ラベル判定ルール（単一ラベル、優先度順）:**
```
feat!/BREAKING → breaking-change
feat:          → enhancement
fix:           → bug
その他         → maintenance
```

### Phase 7: 既存ドキュメントへの追記

**`docs/einja/steering/infrastructure/deployment.md`** — 以下のセクションを追記:
- 「8. リリース管理」: GitHub Release/PreRelease自動作成フロー
- 「9. バージョニング戦略」: changesets採番ルール、タグ形式
- 「10. 承認フロー」: GitHub Environments設定、production承認ゲート
- ワークフロー一覧テーブルに release-staging/release-production ジョブを追加

**`docs/einja/steering/development-workflow.md`** — 以下を追記:
- changesetの運用フロー（PRにchangeset含める手順）
- 「Phase A: 仕様書作成」→「Phase B: タスク実行」→「Phase C: リリース」の流れ

## バージョニング採番ルール

### セマンティックバージョニング（changeset指定）

| 変更種別 | changeset指定 | バージョン変更例 | 使用シーン |
|---------|--------------|----------------|----------|
| 破壊的変更 | `major` | `0.1.0` → `1.0.0` | API仕様変更、DB破壊的マイグレーション |
| 新機能追加 | `minor` | `0.1.0` → `0.2.0` | 新画面、新API追加 |
| バグ修正 | `patch` | `0.1.0` → `0.1.1` | 不具合修正、パフォーマンス改善 |

### タグ形式

| 環境 | タグ形式 | 例 | GitHub Release種別 |
|------|---------|-----|------------------|
| staging | `v{version}-rc.{run_number}` | `v0.2.0-rc.42` | PreRelease |
| production | `v{version}` | `v0.2.0` | Release |

### changeset消費タイミング

| ブランチ | changeset消費 | バージョンバンプ | タグ形式 |
|---------|-------------|----------------|---------|
| staging | **消費しない** | なし（package.json据え置き） | `v{current}-rc.{run_number}` |
| main | `changeset version` で消費 | package.json更新 | `v{new_version}` |

## 変更ファイル一覧

| ファイル | 操作 | Phase |
|---------|------|-------|
| `package.json` | 改修（devDeps + scripts追加） | 1 |
| `.changeset/config.json` | 新規 | 1 |
| `.github/workflows/deploy-stable-branches.yml` | 大規模改修（ジョブ分割 + リリース統合） | 3 |
| `.github/release.yml` | 新規 | 4 |
| `.github/workflows/changeset-status.yml` | 新規（任意） | 5 |
| `.claude/skills/einja-create-pr/SKILL.md` | 新規（changeset生成 + ラベル付与 + PR作成） | 6 |
| `.claude/commands/einja/issue-exec.md` | 改修（PR作成部分をeinja-create-pr呼び出しに変更） | 6 |
| `docs/einja/steering/infrastructure/deployment.md` | 追記（リリース管理・バージョニング・承認フロー） | 7 |
| `docs/einja/steering/development-workflow.md` | 追記（changeset運用フロー） | 7 |

**変更しないファイル:**
- `release-cli.yml` / `release-create-einja-app.yml`（NPMリリースは独立運用を維持）
- `deploy-pr-preview.yml` / `cleanup-*.yml` / `claude.yml`
- Composite Actions（`setup`, `ci`, `migrate`, `neon-export-env`）

**廃止:**
- `release-app.yml` は作成しない（deploy-stable-branches.yml内に統合）

## NPMリリースとの棲み分け

| タグパターン | 用途 | 生成元 |
|-------------|------|--------|
| `v1.2.0` | アプリ Stable Release | deploy-stable-branches.yml内 release-production ジョブ |
| `v1.2.0-rc.42` | アプリ PreRelease | deploy-stable-branches.yml内 release-staging ジョブ |
| `cli-v0.1.41` | @einja/dev-cli | 手動タグ（既存運用） |
| `create-einja-app-v0.3.2` | create-einja-app | 手動タグ（既存運用） |

## 検証方法

1. **Phase 1検証**: `pnpm changeset` で対話UIが起動し、`.changeset/` にmdファイルが生成されること
2. **Phase 3検証**:
   - developブランチにpush → deploy-developが承認なしで実行（従来通り）
   - stagingブランチにpush → deploy-stagingが承認なしで実行 → release-stagingでPreRelease作成
   - mainブランチにpush → migrate-productionがGitHub UIで承認待ち → 承認後migrate+deploy → release-productionでRelease作成
   - バージョンバンプコミットでワークフローが再トリガーされない（無限ループなし）ことを確認
3. **Phase 6検証**: `/einja-create-pr` でchangeset生成 + ラベル付与 + PR作成が一括実行されること
