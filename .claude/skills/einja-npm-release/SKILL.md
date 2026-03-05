---
name: einja-npm-release
description: "NPMパッケージ（@einja/dev-cli、create-einja-app）の変更検出・ビルド・テスト・リリースを統合的に実行するSkill。公開、リリース、publish、releaseが必要な場合に使用。"
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - TodoWrite
  - TodoRead
  - Task
  - MCPSearch
---

# einja-npm-release Skill: NPM パッケージ統合リリースエンジン

## 役割

モノレポ内のNPMパッケージ（`@einja/dev-cli`、`create-einja-app`）の変更を自動検出し、ビルド・テスト・NPM公開を統合的に実行します。

## パッケージ定義テーブル

| キー | `@einja/dev-cli` | `create-einja-app` |
|------|-------------|-------------------|
| path | `packages/cli` | `packages/create-einja-app` |
| pnpm filter | `@einja/dev-cli` | `create-einja-app` |
| workflow | `release-cli.yml` | `release-create-einja-app.yml` |
| tag prefix | `cli-v` | `create-einja-app-v` |
| commit scope | `cli` | `create-einja-app` |
| build/test | build, test, typecheck | build, test, typecheck, lint |

## 参照ドキュメント

- `packages/cli/RELEASING.md` - @einja/dev-cli リリース手順、トラブルシューティング、NPM_TOKEN設定方法
- `packages/create-einja-app/RELEASING.md` - create-einja-app リリース手順

## 実行手順

### Step 1: 前提条件の確認

```bash
git branch --show-current    # mainブランチであること
git status --porcelain       # 未コミット変更の確認
```

#### 未コミット変更がある場合

**AskUserQuestion**で対処方法を確認:

- **コミットしてからリリース**: 全ての変更をコミット・プッシュ後にリリース
- **スタッシュしてリリース**: 変更を一時退避してリリース後に復元
- **そのままリリース**: 未コミット変更は放置し、**package.jsonのバージョン更新のみ**コミットしてリリース

### Step 2: 変更パッケージの自動検出

各パッケージについて、最新タグからの差分を検出:

```bash
# @einja/dev-cli: 最新タグ取得
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
| @einja/dev-cli | x.y.z | cli-vx.y.z | N |
| create-einja-app | x.y.z | create-einja-app-vx.y.z | M |
```

### Step 3: リリース対象の確認

**AskUserQuestion** で確認:

#### 両方に変更がある場合

```yaml
question: "どのパッケージをリリースしますか？"
header: "リリース対象"
options:
  - label: "両方リリース（推奨）"
    description: "@einja/dev-cli (変更N件) と create-einja-app (変更M件) の両方をリリース"
  - label: "@einja/dev-cli のみ"
    description: "@einja/dev-cli のみリリース"
  - label: "create-einja-app のみ"
    description: "create-einja-app のみリリース"
```

#### 片方のみ変更がある場合

```yaml
question: "{パッケージ名} に変更があります。リリースしますか？"
header: "リリース確認"
options:
  - label: "はい"
    description: "{パッケージ名} をリリースする"
  - label: "いいえ"
    description: "リリースをキャンセル"
```

**注**: 変更がない場合でも「Other」選択肢でリリースできる。

### Step 4: バージョン種別の決定

対象パッケージごとに**AskUserQuestion**:

```yaml
question: "{パッケージ名} のバージョン種別を選択してください（現在: v{current}）"
header: "バージョン"
options:
  - label: "patch（推奨）"
    description: "バグ修正・軽微な改善"
  - label: "minor"
    description: "後方互換性のある機能追加"
  - label: "major"
    description: "破壊的変更"
```

複数パッケージの場合、順番に確認。

### Step 5: ビルド・テスト

対象パッケージごとに実行（並列実行可能）:

```bash
# @einja/dev-cli
pnpm --filter @einja/dev-cli build && pnpm --filter @einja/dev-cli test && pnpm --filter @einja/dev-cli typecheck

# create-einja-app
pnpm -F create-einja-app build && pnpm -F create-einja-app test && pnpm -F create-einja-app typecheck && pnpm -F create-einja-app lint
```

### Step 6: バージョン更新・コミット・プッシュ

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

task-committer には委託しない（全変更をコミットしてしまうため）。

### Step 7: GitHub Actions 監視・自律修正

対象パッケージごとにワークフローを監視（並列監視可能）:

#### 7.1 監視ループ

```bash
# 最新のワークフロー実行を取得
gh run list --workflow={workflow} --limit=1 --json databaseId,status,conclusion
```

- `status: in_progress` → 30秒待機して再確認
- `status: completed, conclusion: success` → 成功、Step 8へ
- `status: completed, conclusion: failure` → 失敗、7.2へ

#### 7.2 失敗時の原因特定

```bash
gh run view {run_id} --log-failed
```

#### 7.3 原因別の自律修正

| 原因 | 対処 |
|------|------|
| ビルドエラー | コードを修正 |
| テストエラー | テストを修正 |
| NPM_TOKEN エラー | ユーザーに設定確認を依頼して終了 |
| バージョン重複 | 次のpatchバージョンで再実行 |

#### 7.4 修正後の再リリース

**重要**: 同じタグ名は使えないため、バージョンを上げて再リリース

```bash
# 1. 修正をコミット
git add {修正ファイル}
git commit -m "fix({scope}): CIエラーを修正"

# 2. 新しいバージョンに更新
npm version patch --no-git-tag-version --prefix {path}

# 3. バージョン更新をコミット
git add {path}/package.json
git commit -m "chore({scope}): v{new_version}にバージョンアップ"

# 4. 新しいタグを作成・プッシュ
git tag {tag_prefix}{new_version}
git push origin main
git push origin {tag_prefix}{new_version}
```

#### 7.5 リトライ制限

最大3回まで自動リトライ。3回失敗したらユーザーに報告して終了。

### Step 8: 完了報告

```markdown
## 📦 NPM パッケージリリース完了

| パッケージ | バージョン | タグ | Actions |
|-----------|----------|-----|---------|
| @einja/dev-cli | {old} → {new} | cli-v{version} | ✅ |
| create-einja-app | {old} → {new} | create-einja-app-v{version} | ✅ |

### 確認コマンド
npm view @einja/dev-cli
npm view create-einja-app
```

---

**最終更新**: 2026-03-04
