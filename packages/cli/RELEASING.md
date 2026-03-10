# @einja-inc/dev-cli リリース手順

## 前提条件

- GitHub Packages への公開権限を持つ `GITHUB_TOKEN` が利用可能（GitHub Actions では自動提供）
- mainブランチが最新状態
- レジストリ: `https://npm.pkg.github.com`（GitHub Packages）

## 自動リリース（推奨）

main ブランチへの push 後、`deploy-stable-branches.yml` の成功を受けて `publish-packages.yml` が自動実行されます。

パッケージに変更がある場合、自動で以下が実行されます：
1. 変更検出（最新タグからの差分）
2. ビルド・テスト・型チェック・Lint
3. バージョンバンプ（patch）
4. NPM公開
5. コミット・タグ作成（`chore: release cli-v{version}`）

## 手動リリース

GitHub Actions UI または CLI から手動でワークフローを実行できます：

### CLI から実行（推奨）

```bash
# パッチリリース
gh workflow run publish-packages.yml -f package=dev-cli -f version_type=patch

# マイナーリリース
gh workflow run publish-packages.yml -f package=dev-cli -f version_type=minor

# メジャーリリース
gh workflow run publish-packages.yml -f package=dev-cli -f version_type=major
```

### Dry-run テスト

実際に公開せずにワークフローをテストできます：

```bash
gh workflow run publish-packages.yml -f package=dev-cli -f dry_run=true
```

### GitHub Actions UI から実行

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Publish NPM Packages** を選択
3. **Run workflow** をクリック
4. Package: `dev-cli`、Version type、Dry run を選択
5. **Run workflow** を実行

## 公開の確認

```bash
# GitHub Packages で公開を確認
npm view @einja-inc/dev-cli --registry=https://npm.pkg.github.com

# 実際に使用してみる
npx @einja-inc/dev-cli --version
```

## トラブルシューティング

### 認証エラー

```
npm error code ENEEDAUTH
```

→ GitHub Actions の `GITHUB_TOKEN` パーミッションに `packages: write` が設定されているか確認

### バージョン重複エラー

パッケージが既に公開済みの場合、ワークフローは自動でスキップします（冪等性）。

### パッケージ内容の検証

ローカルでパッケージ内容を確認：

```bash
cd packages/cli
pnpm pack --dry-run
```

## 認証について

GitHub Packages への公開には `GITHUB_TOKEN` を使用します。GitHub Actions では自動的に提供されるため、追加のトークン設定は不要です。

ワークフローの `permissions` に `packages: write` が含まれていることを確認してください。
