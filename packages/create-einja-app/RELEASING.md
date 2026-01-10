# create-einja-app リリース手順

## 前提条件

- npm アクセストークンが GitHub Secrets の `NPM_TOKEN` として設定済み
- mainブランチが最新状態

## リリース手順

**重要**: `npm version` はデフォルトで `v{version}` タグを生成しますが、このワークフローでは `create-einja-app-v{version}` タグが必要です。そのため、以下の手順でタグを手動作成します。

### 1. バージョンを更新（タグなし）

```bash
cd packages/create-einja-app

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
git commit -m "chore(create-einja-app): v<version>にバージョンアップ"
```

### 3. タグを手動作成

```bash
# 正しい形式のタグを作成
git tag create-einja-app-v<version>

# 例: create-einja-app-v0.1.1
git tag create-einja-app-v0.1.1
```

### 4. プッシュ

```bash
git push origin main
git push origin create-einja-app-v<version>

# 例
git push origin create-einja-app-v0.1.1
```

### 5. GitHub Actions が自動実行

- Actions タブで "Release create-einja-app" ワークフローの実行を確認
- 成功すると npm に自動公開される

### 6. 公開を確認

```bash
# npm で公開を確認
npm view create-einja-app

# 実際に使用してみる
npx create-einja-app --version
```

## 手動リリース（緊急時）

GitHub Actions UI から手動でワークフローを実行できます：

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Release create-einja-app** を選択
3. **Run workflow** をクリック
4. ブランチを選択し、**Run workflow** を実行

**注意**: 手動実行時はタグが作成されないため、Git履歴との整合性は手動で管理する必要があります。

## Dry-run テスト

実際に公開せずにワークフローをテストできます：

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Release create-einja-app** を選択
3. **Run workflow** をクリック
4. **Dry run** にチェックを入れる
5. **Run workflow** を実行

## トラブルシューティング

### NPM_TOKEN エラー

```
npm error code ENEEDAUTH
```

→ GitHub Secrets に `NPM_TOKEN` が正しく設定されているか確認

### バージョン不一致エラー

```
Version mismatch: package.json=0.1.0, tag=0.2.0
```

→ タグ名と package.json の version が一致しているか確認

### パッケージ内容の検証

ローカルでパッケージ内容を確認：

```bash
cd packages/create-einja-app
npm pack --dry-run
```

## NPM_TOKEN の取得方法

1. [npmjs.com](https://www.npmjs.com) にログイン
2. 右上のアバター → **Access Tokens** をクリック
3. **Generate New Token** → **Automation** を選択
4. トークンをコピー
5. GitHub リポジトリの **Settings** → **Secrets and variables** → **Actions**
6. **New repository secret** で `NPM_TOKEN` として追加
