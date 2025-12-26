# Quick Start: 5分で動かす

## 目標

5分で開発基盤の基本動作を確認し、成功体験を得る。

## 前提条件

- PostgreSQLが起動している（`docker-compose up -d postgres`）
- pnpmがインストールされている
- setup.shを実行済み

## ステップ1: 環境確認（1分）

```bash
cd playground/00-quick-start
./verify.sh
```

全てのチェックが✅になることを確認してください。

## ステップ2: サンプルIssue作成（2分）

1. GitHubで新しいIssueを作成
2. `sample-issue.md`の内容をコピー＆ペースト

```bash
cat sample-issue.md
```

3. Issueタイトル: `[Playground] Hello World実装`
4. 作成したIssue番号をメモ（例: #9999）

## ステップ3: task-exec実行（2分）

```bash
# ルートディレクトリに戻る
cd ../..

# task-execコマンド実行（Claudeに依頼）
# 例: "Issue #9999 のタスクを実行してください"
```

## 期待される動作

1. **task-starter**: タスク1.1を選定
2. **task-executer**: `playground/apps/sample-app/src/playground/hello.ts`を作成
3. **task-reviewer**: 実装を確認
4. **task-qa**: テスト実行
5. **task-finisher**: タスク完了、Issue更新

## 確認ポイント

- [ ] `playground/apps/sample-app/src/playground/hello.ts`が作成された
- [ ] ファイル内に`console.log('Hello, Playground!')`が実装されている
- [ ] ビルドが成功する（`cd playground && pnpm build`）
- [ ] Issue #9999のタスク1.1がチェック済みになっている

## 次のステップ

成功したら、Level 1に進んでください：

```bash
cd ../01-basics/01-task-structure
cat README.md
```

## トラブルシューティング

### 環境確認で失敗する場合

```bash
# 診断ツール実行
bash ../../tools/diagnose.sh

# 依存関係再インストール
cd ../..
pnpm install
pnpm db:generate
```

### task-execが失敗する場合

1. Issue形式が正しいか確認（sample-issue.mdと比較）
2. PostgreSQLが起動しているか確認
3. .env.playgroundのDATABASE_URLが正しいか確認

詳細は `../docs/troubleshooting.md` を参照してください。
