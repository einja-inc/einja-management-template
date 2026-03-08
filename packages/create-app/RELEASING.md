# @einja-inc/create-app リリース手順

## 前提条件

- GitHub Packages への公開権限を持つ `GITHUB_TOKEN` が利用可能（GitHub Actions では自動提供）
- mainブランチが最新状態
- レジストリ: `https://npm.pkg.github.com`（GitHub Packages）

## リリース手順

**重要**: `npm version` はデフォルトで `v{version}` タグを生成しますが、このワークフローでは `create-app-v{version}` タグが必要です。そのため、以下の手順でタグを手動作成します。

### 1. バージョンを更新（タグなし）

```bash
cd packages/create-app

# パッチバージョン (0.1.0 → 0.1.1)
npm version patch --no-git-tag-version

# マイナーバージョン (0.1.0 → 0.2.0)
npm version minor --no-git-tag-version

# メジャーバージョン (0.1.0 → 1.0.0)
npm version major --no-git-tag-version
```

### 2. 変更をコミット

```bash
git add package.json
git commit -m "chore(create-app): v<version>にバージョンアップ"
```

### 3. タグを手動作成

```bash
# 正しい形式のタグを作成
git tag create-app-v<version>

# 例: create-app-v0.1.1
git tag create-app-v0.1.1
```

### 4. プッシュ

```bash
git push origin main
git push origin create-app-v<version>

# 例
git push origin create-app-v0.1.1
```

### 5. GitHub Actions が自動実行

- Actions タブで "Release @einja-inc/create-app" ワークフローの実行を確認
- 成功すると npm に自動公開される

### 6. 公開を確認

```bash
# npm で公開を確認
npm view @einja-inc/create-app

# 実際に使用してみる
npx @einja-inc/create-app --version
```

## 手動リリース（緊急時）

GitHub Actions UI から手動でワークフローを実行できます：

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Release @einja-inc/create-app** を選択
3. **Run workflow** をクリック
4. ブランチを選択し、**Run workflow** を実行

**注意**: 手動実行時はタグが作成されないため、Git履歴との整合性は手動で管理する必要があります。

## Dry-run テスト

実際に公開せずにワークフローをテストできます：

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Release @einja-inc/create-app** を選択
3. **Run workflow** をクリック
4. **Dry run** にチェックを入れる
5. **Run workflow** を実行

## トラブルシューティング

### 認証エラー

```
npm error code ENEEDAUTH
```

→ GitHub Actions の `GITHUB_TOKEN` パーミッションに `packages: write` が設定されているか確認

### バージョン不一致エラー

```
Version mismatch: package.json=0.1.0, tag=0.2.0
```

→ タグ名と package.json の version が一致しているか確認

### パッケージ内容の検証

ローカルでパッケージ内容を確認：

```bash
cd packages/create-app
npm pack --dry-run
```

## 認証について

GitHub Packages への公開には `GITHUB_TOKEN` を使用します。GitHub Actions では自動的に提供されるため、追加のトークン設定は不要です。

ワークフローの `permissions` に `packages: write` が含まれていることを確認してください。
