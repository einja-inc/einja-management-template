---
name: cli-release
description: "@einja/cli パッケージをビルド・テストし、NPMに公開するSkill"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - TodoWrite
  - TodoRead
---

# cli-release Skill: @einja/cli パッケージ公開エンジン

## 役割

`@einja/cli` パッケージをビルド・テストし、NPMに公開します。GitHub Actions経由で自動公開されるため、タグのプッシュまでを実行します。

## 前提条件

- mainブランチであること
- 未コミットの変更がないこと
- `NPM_TOKEN` が GitHub Secrets に設定済み（GitHub Actions用）

## 実行手順（6ステップ）

### ステップ1: 前提条件の確認

1. 現在のブランチを確認
2. 未コミットの変更がないか確認

```bash
# ブランチ確認
git branch --show-current

# 未コミット変更の確認
git status --porcelain
```

**エラー時の出力**:

```markdown
## 📦 @einja/cli リリース

### ステータス: ❌ FAILURE

**エラー**: [エラー内容]

- mainブランチでない場合: `git checkout main` でブランチを切り替えてください
- 未コミット変更がある場合: 変更をコミットまたはスタッシュしてください
```

---

### ステップ2: バージョン種別の決定

**AskUserQuestionツール**を使用してバージョン種別を確認:

```
AskUserQuestion:
  question: "リリースするバージョンの種別を選択してください"
  header: "バージョン"
  options:
    - label: "patch (推奨)"
      description: "バグ修正・軽微な改善 (0.1.0 → 0.1.1)"
    - label: "minor"
      description: "後方互換性のある機能追加 (0.1.0 → 0.2.0)"
    - label: "major"
      description: "破壊的変更 (0.1.0 → 1.0.0)"
```

質問の前に、現在のバージョンと最近の変更を表示:

```bash
# 現在のバージョン確認
node -p "require('./packages/cli/package.json').version"

# 最近のコミット履歴（CLI関連）
git log --oneline -10 -- packages/cli/
```

---

### ステップ3: ビルド・テストの実行

```bash
cd packages/cli

# 依存関係のインストール（必要な場合）
pnpm install

# ビルド実行
pnpm build

# テスト実行
pnpm test

# 型チェック
pnpm typecheck

# パッケージ内容の確認（dry-run）
npm pack --dry-run
```

**失敗時**: エラー内容を報告して終了

---

### ステップ4: バージョン更新

```bash
cd packages/cli

# バージョン更新（自動でコミット・タグが作成される）
npm version {patch|minor|major}
```

**注意**: `npm version` は以下を自動実行:
- `package.json` の version を更新
- `git commit -m "cli-v{version}"`
- `git tag cli-v{version}`

---

### ステップ5: プッシュ実行

```bash
# コミットをプッシュ
git push origin main

# タグをプッシュ（GitHub Actions トリガー）
git push origin cli-v{version}
```

---

### ステップ6: 公開確認

以下の情報を出力:

```markdown
## 📦 @einja/cli リリース

### ステータス: ✅ SUCCESS

**バージョン**: {version}

### 次のステップ

1. **GitHub Actions を確認**:
   https://github.com/einja-inc/einja-management-template/actions/workflows/release-cli.yml

2. **公開後の確認コマンド**:
   ```bash
   npm view @einja/cli
   npx @einja/cli --version
   ```

### タイムライン
- バージョン更新: ✅ 完了
- コミットプッシュ: ✅ 完了
- タグプッシュ: ✅ 完了
- NPM公開: ⏳ GitHub Actions 実行中...
```

---

## 出力形式

### 成功時

```markdown
## 📦 @einja/cli リリース完了

### リリース情報
- **パッケージ**: @einja/cli
- **バージョン**: {old_version} → {new_version}
- **種別**: {patch|minor|major}

### 実行結果
| ステップ | 状態 |
|---------|------|
| ビルド | ✅ |
| テスト | ✅ |
| バージョン更新 | ✅ |
| プッシュ | ✅ |

### GitHub Actions
🔗 https://github.com/einja-inc/einja-management-template/actions

### ステータス: ✅ SUCCESS
```

### 失敗時

```markdown
## 📦 @einja/cli リリース

### ステータス: ❌ FAILURE

**エラー**: [エラーの種類]

```
[エラー詳細]
```

[推奨される対処方法]
```

---

## エラーハンドリング

| エラー種別 | 対処 |
|-----------|------|
| mainブランチでない | ブランチ切り替えを案内 |
| 未コミット変更あり | コミットまたはスタッシュを案内 |
| ビルド失敗 | エラー内容を報告、修正を依頼 |
| テスト失敗 | 失敗したテストを報告、修正を依頼 |
| git push 失敗 | エラー内容を報告、原因を説明 |

---

## 手動リリース（緊急時）

GitHub Actions が失敗した場合の手動リリース:

```bash
cd packages/cli
pnpm publish --access public
```

**注意**: `NPM_TOKEN` または `npm login` が必要

---

## Dry-run テスト

実際に公開せずにテストする場合:

1. GitHub Actions の UI から手動実行
2. **Dry run** にチェックを入れて実行

または、ローカルで:

```bash
cd packages/cli
pnpm build
npm pack --dry-run
pnpm publish --dry-run --access public
```

---

## 参考資料

- `packages/cli/RELEASING.md` - 詳細なリリース手順
- `.github/workflows/release-cli.yml` - GitHub Actions ワークフロー

---

**最終更新**: 2025-01-10
