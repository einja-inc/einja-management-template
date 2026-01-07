# CLIパッケージ NPM公開ガイド

## パッケージ情報

| 項目 | 値 |
|------|-----|
| パッケージ名 | `@einja/cli` |
| レジストリ | npm (public) |
| 実行コマンド | `einja-claude` |

## 配布されるディレクトリ

`package.json` の `files` フィールドで指定されたディレクトリのみがnpmに公開されます：

| ディレクトリ | 内容 |
|-------------|------|
| `dist/` | コンパイル済みTypeScript |
| `presets/` | プリセット定義（minimal） |
| `templates/` | CLAUDE.mdテンプレート |
| `scaffolds/` | ステアリングドキュメント |

**含まれないもの:**
- `src/` - ソースコード
- `scripts/` - ビルドスクリプト
- `__tests__/` - テストコード

## 公開手順

### 方法1: タグプッシュ（推奨）

```bash
cd packages/cli

# 1. バージョンを更新
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0

# 2. コミットをプッシュ
git push origin main

# 3. タグをプッシュ（GitHub Actionsが自動実行）
git push origin cli-v0.2.0
```

### 方法2: GitHub Actions UIから手動実行

1. GitHub リポジトリの **Actions** タブを開く
2. 左メニューから **Release CLI** を選択
3. **Run workflow** をクリック
4. ブランチを選択し、**Run workflow** を実行

### 方法3: ローカルから直接公開（非推奨）

```bash
cd packages/cli
pnpm build
npm publish --access public
```

**注意**: ローカル公開は履歴管理が困難なため、緊急時のみ使用してください。

## バージョニング規則

セマンティックバージョニング (SemVer) に従います：

| 変更内容 | バージョン変更 | 例 |
|---------|--------------|-----|
| 後方互換性のあるバグ修正 | patch | 0.1.0 → 0.1.1 |
| 後方互換性のある機能追加 | minor | 0.1.0 → 0.2.0 |
| 破壊的変更 | major | 0.1.0 → 1.0.0 |

## 公開前チェックリスト

- [ ] `pnpm build` が成功する
- [ ] `pnpm typecheck` がエラーなし
- [ ] `pnpm test` が全てパス
- [ ] `CHANGELOG.md` が更新済み（任意）
- [ ] `package.json` のバージョンが正しい

## パッケージ内容の確認

公開前にパッケージ内容を確認：

```bash
cd packages/cli

# ドライラン（実際には公開しない）
pnpm pack --dry-run

# tarball を作成して中身を確認
pnpm pack
tar -tzf einja-cli-*.tgz
```

## トラブルシューティング

### 認証エラー

```
npm error code ENEEDAUTH
```

→ `NPM_TOKEN` が GitHub Secrets に設定されているか確認

### バージョン不一致

```
Version mismatch: package.json=0.1.0, tag=0.2.0
```

→ タグ名と `package.json` の version が一致しているか確認

### パッケージ名の競合

```
npm error code E403
```

→ パッケージ名が既に使用されている可能性。スコープ付き名前 (`@einja/cli`) を使用

## 関連ドキュメント

- [RELEASING.md](../RELEASING.md) - リリース手順の詳細
- [BUILD.md](./BUILD.md) - ビルドプロセスの詳細
