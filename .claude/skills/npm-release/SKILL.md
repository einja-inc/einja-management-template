---
name: npm-release
description: "NPMパッケージ（@einja-inc/dev-cli、@einja-inc/create-app）の変更検出・ビルド・テスト・リリースを統合的に実行するSkill。公開、リリース、publish、releaseが必要な場合に使用。"
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - Task
  - MCPSearch
---

# npm-release Skill: NPM パッケージ統合リリースエンジン

## 役割

モノレポ内のNPMパッケージ（`@einja-inc/dev-cli`、`@einja-inc/create-app`）の変更を自動検出し、ビルド・テスト・NPM公開を統合的に実行します。

## パッケージ定義テーブル

| キー | `@einja-inc/dev-cli` | `@einja-inc/create-app` |
|------|-------------|-------------------|
| path | `packages/cli` | `packages/create-app` |
| pnpm filter | `@einja-inc/dev-cli` | `@einja-inc/create-app` |
| workflow | `publish-packages.yml` | `publish-packages.yml` |
| tag prefix | `cli-v` | `create-app-v` |
| commit scope | `cli` | `create-app` |
| build/test | build, test, typecheck | build, test, typecheck, lint |

## 参照ドキュメント

- `packages/cli/RELEASING.md` - @einja-inc/dev-cli リリース手順、トラブルシューティング、NPM_TOKEN設定方法
- `packages/create-app/RELEASING.md` - @einja-inc/create-app リリース手順

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
# @einja-inc/dev-cli: 最新タグ取得
git tag --list 'cli-v*' --sort=-version:refname | head -1

# @einja-inc/create-app: 最新タグ取得
git tag --list 'create-app-v*' --sort=-version:refname | head -1

# 各パッケージの差分をチェック
git diff --name-only {latest_tag}..HEAD -- packages/cli/
git diff --name-only {latest_tag}..HEAD -- packages/create-app/
```

結果をテーブル表示:

```markdown
| パッケージ | 現バージョン | 最新タグ | 変更ファイル数 |
|-----------|------------|---------|-------------|
| @einja-inc/dev-cli | x.y.z | cli-vx.y.z | N |
| @einja-inc/create-app | x.y.z | create-app-vx.y.z | M |
```

### Step 3: リリース対象の確認

**AskUserQuestion** で確認:

#### 両方に変更がある場合

```yaml
question: "どのパッケージをリリースしますか？"
header: "リリース対象"
options:
  - label: "両方リリース（推奨）"
    description: "@einja-inc/dev-cli (変更N件) と @einja-inc/create-app (変更M件) の両方をリリース"
  - label: "@einja-inc/dev-cli のみ"
    description: "@einja-inc/dev-cli のみリリース"
  - label: "@einja-inc/create-app のみ"
    description: "@einja-inc/create-app のみリリース"
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
# @einja-inc/dev-cli
pnpm --filter @einja-inc/dev-cli build && pnpm --filter @einja-inc/dev-cli test && pnpm --filter @einja-inc/dev-cli typecheck

# @einja-inc/create-app
pnpm -F @einja-inc/create-app build && pnpm -F @einja-inc/create-app test && pnpm -F @einja-inc/create-app typecheck && pnpm -F @einja-inc/create-app lint
```

### Step 6: publish-packages.yml ワークフローを実行

`gh workflow run` でワークフローをトリガー:

```bash
# 単一パッケージの場合
gh workflow run publish-packages.yml -f package={package_key} -f version_type={type}

# 両方の場合
gh workflow run publish-packages.yml -f package=both -f version_type={type}
```

| package_key | パッケージ |
|-------------|----------|
| `dev-cli` | @einja-inc/dev-cli |
| `create-app` | @einja-inc/create-app |
| `both` | 両方 |

### Step 7: GitHub Actions 監視・自律修正

`publish-packages.yml` ワークフローを監視:

#### 7.1 監視ループ

```bash
# 最新のワークフロー実行を取得
gh run list --workflow=publish-packages.yml --limit=1 --json databaseId,status,conclusion
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
| ビルドエラー | コードを修正し、再度 `gh workflow run` を実行 |
| テストエラー | テストを修正し、再度実行 |
| NPM_TOKEN エラー | ユーザーに設定確認を依頼して終了 |
| バージョン重複 | ワークフローが自動スキップ（冪等性あり） |

#### 7.4 リトライ制限

最大3回まで自動リトライ。3回失敗したらユーザーに報告して終了。

### Step 8: 完了報告

```markdown
## 📦 NPM パッケージリリース完了

| パッケージ | バージョン | タグ | Actions |
|-----------|----------|-----|---------|
| @einja-inc/dev-cli | {old} → {new} | cli-v{version} | ✅ |
| @einja-inc/create-app | {old} → {new} | create-app-v{version} | ✅ |

### 確認コマンド
npm view @einja-inc/dev-cli
npm view @einja-inc/create-app
```

---

**最終更新**: 2026-03-04
