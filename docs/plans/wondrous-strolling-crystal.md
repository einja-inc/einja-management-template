# Plan: NPMリリースSkill統合

## Context

現在 `dev-cli-release` と `create-einja-app-release` の2つの独立したリリースSkillがあり、パッケージ公開時にどちらのSkillを使うか意識する必要がある。変更があったパッケージを自動検出し、1つのSkillで両方のリリースを処理できるようにする。

## 変更対象ファイル

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `.claude/skills/einja-npm-release/SKILL.md` | **新規作成**: 統合リリースSkill |
| 2 | `.claude/skills/dev-cli-release/SKILL.md` | **削除** |
| 3 | `.claude/skills/create-einja-app-release/SKILL.md` | **削除** |
| 4 | `CLAUDE.md` | キーワードトリガーを統合Skillに変更 |

## 統合Skillの設計

### パッケージ定義テーブル

Skill内でパッケージごとの差分を定数テーブルとして定義:

| キー | `@einja/cli` | `create-einja-app` |
|------|-------------|-------------------|
| path | `packages/cli` | `packages/create-einja-app` |
| pnpm filter | `@einja/cli` | `create-einja-app` |
| workflow | `release-cli.yml` | `release-create-einja-app.yml` |
| tag prefix | `cli-v` | `create-einja-app-v` |
| commit scope | `cli` | `create-einja-app` |
| build/test | build, test, typecheck | build, test, typecheck, lint |

### 処理フロー

#### Step 1: 前提条件の確認
- `git branch --show-current` → mainブランチ確認
- `git status --porcelain` → 未コミット変更の確認
- 未コミット変更がある場合 → AskUserQuestion（コミットしてから/スタッシュ/そのまま）

#### Step 2: 変更パッケージの自動検出

各パッケージについて、最新タグからの差分を検出:

```bash
# dev-cli: 最新タグ取得
git tag --list 'cli-v*' --sort=-version:refname | head -1

# create-einja-app: 最新タグ取得
git tag --list 'create-einja-app-v*' --sort=-version:refname | head -1

# 各パッケージの差分をチェック
git diff --name-only {latest_tag}..HEAD -- packages/cli/
git diff --name-only {latest_tag}..HEAD -- packages/create-einja-app/
```

結果をテーブル表示:

```markdown
| パッケージ | 現バージョン | 最新タグ | 変更ファイル数 |
|-----------|------------|---------|-------------|
| @einja/cli | 0.1.41 | cli-v0.1.41 | 3 |
| create-einja-app | 0.3.2 | create-einja-app-v0.3.2 | 5 |
```

#### Step 3: リリース対象の確認

AskUserQuestion で確認:

```yaml
# 両方に変更がある場合
question: "どのパッケージをリリースしますか？"
header: "リリース対象"
options:
  - label: "両方リリース（推奨）"
    description: "@einja/cli (変更N件) と create-einja-app (変更M件) の両方をリリース"
  - label: "@einja/cli のみ"
    description: "@einja/cli のみリリース"
  - label: "create-einja-app のみ"
    description: "create-einja-app のみリリース"

# 片方のみ変更がある場合
question: "{パッケージ名} に変更があります。リリースしますか？"
header: "リリース確認"
options:
  - label: "はい"
  - label: "いいえ"

# 変更がない場合でもリリースできるように「Other」選択肢で対応
```

#### Step 4: バージョン種別の決定

対象パッケージごとにAskUserQuestion:

```yaml
question: "{パッケージ名} のバージョン種別を選択してください（現在: v{current}）"
header: "バージョン"
options:
  - label: "patch（推奨）"
  - label: "minor"
  - label: "major"
```

複数パッケージの場合、1つの AskUserQuestion で同時に聞けないので順番に確認。

#### Step 5: ビルド・テスト

対象パッケージごとに実行（並列実行可能）:

```bash
# dev-cli
pnpm --filter @einja/cli build && pnpm --filter @einja/cli test && pnpm --filter @einja/cli typecheck

# create-einja-app
pnpm -F create-einja-app build && pnpm -F create-einja-app test && pnpm -F create-einja-app typecheck && pnpm -F create-einja-app lint
```

#### Step 6: バージョン更新・コミット・プッシュ

**順次実行**（gitコミットは直列化が必要）。全パッケージ統一で `--no-git-tag-version` + 手動タグ方式:

```bash
# 1. バージョン更新（タグなし）
npm version {type} --no-git-tag-version --prefix {path}

# 2. package.jsonのみコミット
git add {path}/package.json
git commit -m "chore({scope}): v{version}にバージョンアップ"

# 3. タグ作成
git tag {tag_prefix}{version}
```

全パッケージ分のコミット・タグ作成が完了してから一括プッシュ:

```bash
git push origin main
git push origin {tag1}
git push origin {tag2}  # 2パッケージの場合
```

#### Step 7: GitHub Actions 監視

対象パッケージごとにワークフローを監視（並列監視可能）:

```bash
gh run list --workflow={workflow} --limit=1 --json databaseId,status,conclusion
```

- 30秒間隔でポーリング
- 失敗時: `gh run view {run_id} --log-failed` で原因特定 → 自律修正 → 再リリース
- 最大3回リトライ

#### Step 8: 完了報告

```markdown
## 📦 NPM パッケージリリース完了

| パッケージ | バージョン | タグ | Actions |
|-----------|----------|-----|---------|
| @einja/cli | 0.1.41 → 0.1.42 | cli-v0.1.42 | ✅ |
| create-einja-app | 0.3.2 → 0.3.3 | create-einja-app-v0.3.3 | ✅ |
```

## CLAUDE.md キーワードトリガー変更

変更前:
```
| `einja cli` `@einja/dev-cli` `公開` `リリース` `publish` `release` | `.claude/skills/dev-cli-release/SKILL.md` |
| `create-einja-app` | `.claude/skills/create-einja-app-release/SKILL.md` |
```

変更後:
```
| `einja cli` `@einja/dev-cli` `create-einja-app` `公開` `リリース` `publish` `release` | `.claude/skills/einja-npm-release/SKILL.md` |
```

**注**: `create-einja-app` キーワードはリリース以外の文脈（例: sync）でも使われるが、統合Skillは変更検出で自動判別するため問題ない。

## 検証方法

1. `git diff --stat` で変更ファイルが4つ（新規1、削除2、編集1）であることを確認
2. Skill内のパッケージ定義テーブルが正しいことを確認
3. `Grep` で旧Skill名（`dev-cli-release`, `create-einja-app-release`）が残っていないことを確認
