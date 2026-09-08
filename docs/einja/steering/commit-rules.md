<!-- @einja:managed:start -->
# コミットルール

このファイルが会社共通の正本である。`einja sync` の `@einja:managed` で配布する。
弁固有の追記は末尾の `@einja:project-private` だけに書く。当該区間以外を利用者リポで直すと次の sync で戻る。

形式の基準は [Conventional Commits 1.0.0](https://www.conventionalcommits.org/ja/v1.0.0/)。
ブランチ運用は [branch-strategy.md](branch-strategy.md) が正。

## 原則

- 1コミットは 1 意図。まとめコミットと複数目的の混在は禁止
- 件名は具体。`修正` `update` `色々` `WIP` `AI fixes` は不合格
- 本文は why と影響範囲。how は diff で足りる
- 共有する履歴の各コミットは、単体でコンパイル・テストが通る状態
- このルールは人と AI アシスタントの両方に適用する

## コミットの流れ

1. **コミット前の確認**
   - コンパイルできる状態か
   - 関連テストが通る状態か
   - 不要なデバッグコードやコメントが残っていないか
   - 秘密情報・`.env` 実体・鍵・巨大生成物が差分に入っていないか

2. **最新化**
   ```bash
   git pull --rebase
   ```

   > **共有ブランチは merge で最新化**: `git pull --rebase` は個人 / task ブランチ向け。**共有ブランチ（`issue/{N}` / `issue/{N}-phase{M}`）の最新化・IssueBranchBase 追従は rebase ではなく `merge` を使う**（複数エージェント・複数 worktree の参照を壊さないため）。詳細は [branch-strategy.md](branch-strategy.md) 「ブランチ操作安全ルール」を参照。

3. **現在の状態確認**
   ```bash
   git status
   git diff
   ```
   意図したパスだけを見る。`git add -A` は使わない。

4. **コミット分割方針の策定**
   - 差分を「コミットの分割方針」に応じて分割する
   - 分割案とコミットメッセージを先に合意する（AI は実行前に案を出す）

5. **コミットの実行**
   - 合意した方針でコミットする

6. **プッシュ前の品質チェック（必須）**
   ```bash
   pnpm prepush
   ```
   - リント、型チェック、テストを一括実行する
   - エラーがある場合は修正してから再実行する
   - `--no-verify` で回避しない

7. **プッシュ**
   ```bash
   git push
   ```

## コミットの分割方針

件名に「と」が出る場合は、分割候補である。

次の場合は**別コミット**にする。

### 1. 異なる目的や種類
- 機能追加と設定ファイルの変更
- リファクタリングとバグ修正
- 独立したドキュメントだけの更新（README や仕様の追記など）

### 2. 異なるコンポーネント
- 複数のマイクロサービスやパッケージ
- フロントエンドとバックエンド
- インフラ構成とアプリケーションコード

### 3. テストの分け方
- **その変更の回帰テスト**は実装と**同じコミット**（そのコミット単体で検証できるようにする）
- **独立したテスト整備**（カバー拡張、テスト基盤の仕上げ）だけ `test:` の別コミット

## コミットメッセージの形式

### 基本形式

```
<type>[optional scope][!]: <日本語の概要>

[optional body]

[optional footer(s)]
```

- type は英語小文字。説明は日本語
- 1行目は概要（目安 30〜50字）。末尾に句点を付けない
- 本文を書くときは 1行目の後に空行を入れる
- scope は任意。monorepo で影響パッケージが明確なときだけ使う（例: `feat(auth):`）

### type（閉じ集合）

| type | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみ |
| `style` | 書式のみ（動作は変わらない） |
| `refactor` | 挙動を変えない再構成 |
| `perf` | 性能改善 |
| `test` | 独立したテスト整備 |
| `build` | ビルド・依存関係 |
| `ci` | CI 設定 |
| `chore` | その他の工具・雜務 |
| `revert` | 前のコミットの取り消し |

この表以外の type は使わない。Gitmoji は使わない。

### 破壊的変更

次のどちらかを使う。

```
feat!: 認証 API のレスポンス形式を変更する

BREAKING CHANGE: `/auth/me` がラッパーなしの User を返すようになった。既存クライアントは data 配下を参照しない
```

### footer

チケットや帰属は footer に書く。直前に空行を入れる。

```
Refs: #123
Fixes: #456
Assisted-by: Claude:Opus-4.6
```

`revert` の本文には `This reverts commit <SHA>` と理由を書く。

### 良い例

```
feat(auth): JWT 認証を追加する

セッション Cookie だけでは跨サブドメインに対応できないため、
アクセストークンとリフレッシュトークンを追加する。
回帰テストも同じコミットに含める。

影響範囲:
- /auth/*
- 認証ミドルウェア

Refs: #123
```

```
fix(cart): 再試行時の重複請求を防ぐ

同一アイテムの連打で数量が 2 倍になる問題を止める。
```

### 悪い例

```
update files
fix some bugs
various changes
修正
WIP
AI fixes
```

## 粒度

- 1つの論理的な変更だけを含める
- 関連ファイルは同じコミットにまとめる
- 変更量の目安は 100 行。目安であり機械強制しない。1000 行超は PR 自体の分割を先に考える
- default ブランチへの取り込みは PR 経由。squash merge する箱では PR タイトルが履歴の正になるので、PR タイトルもこの規約に合わせる

## タイミング

- 論理単位が完了し、テストが通る状態でコミットする
- 個人 / task ブランチの退避コミットは可。共有前に fixup / squash する
- **共有ブランチと default ブランチへ WIP を残さない**
- `main` / IssueBranchBase へ直コミットしない

## 禁止

- secret、`.env` 実体、鍵、認証情報。入ったら漏洩扱いとし、即座にローテーションする。`.gitignore` 追記だけでは消えない
- `node_modules` やビルド産物などの巨大生成物、スクリーンショット本体を git へ入れること
- `git add -A`
- `--no-verify` の常用
- 共有ブランチへの force push
- 関係のないファイルを 1 コミットに混ぜること

## エージェント

- コミット前に `git status` / `git diff` を見せ、関連ファイルだけ stage する
- 分割案を先に出し、人が承認してからコミットする
- `Signed-off-by` を代筆しない。DCO を証明できるのは人だけ
- 帰属は `Assisted-by: <tool>:<model>` を使う。`Co-Authored-By: Claude` は使わない（GitHub が共著者扱いするため）
- 責任者は常に人間である

## コミット内容の確認事項

- 変更内容がコミットメッセージと一致しているか
- 1 意図に分割されているか
- 回帰テストが必要なら同じコミットに入っているか
- 禁止物が混ざっていないか

## プッシュ前の必須確認

**動作確認を必ず実行する**: API なら curl、スクリプトなら実行、画面なら MCP でブラウザ確認

プッシュ前には必ず `pnpm prepush` を実行する。

1. **コードフォーマット**: Biome による自動フォーマット
2. **リントチェック**: コード品質
3. **型チェック**: TypeScript の型エラーがないこと
4. **テスト実行**: テストが通ること

```bash
pnpm prepush
git push
```

`pnpm prepush` を省いてプッシュし CI で失敗すると履歴が汚れる。`--no-verify` で回避しない。

## 関連

- ブランチ運用: [branch-strategy.md](branch-strategy.md)
- Conventional Commits: https://www.conventionalcommits.org/ja/v1.0.0/
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="commit-rules-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
