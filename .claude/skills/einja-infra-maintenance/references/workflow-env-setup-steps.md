# 環境セットアップワークフロー: 新規ステップ詳細手順

> このファイルは `workflow-env-setup.md` から参照される。既存カテゴリの詳細手順は各 `references/category-*.md` を参照すること。

## 目次

- [チェックポイント表示仕様](#チェックポイント表示仕様)
- [Step 3: Docker & DB起動確認](#step-3-docker--db起動確認)
- [Step 4: ローカル環境起動確認](#step-4-ローカル環境起動確認)
- [Step 10.1: ローテーション後の再同期](#step-101-ローテーション後の再同期)
- [Step 11: デプロイ実行](#step-11-デプロイ実行)
- [Step 12: CI/CD監視・自動修復](#step-12-cicd監視自動修復)
- [Step 13: Playwright MCPでのアクセス確認](#step-13-playwright-mcpでのアクセス確認)
- [Step 15: 最終サマリー](#step-15-最終サマリー)

---

## チェックポイント表示仕様

各ステップ完了時に以下の進捗テーブルを出力する。現在のステップを `🔄 ← 現在` で示し、完了済みは `✅`、未着手は `⬜` とする。

```markdown
## チェックポイント（Step N 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| 1 | ✅ | ローカル環境セットアップ |
| 2 | ✅ | 環境変数設定 |
| 3 | 🔄 | Docker & DB起動確認 ← 現在 |
| 4 | ⬜ | ローカル環境起動確認 |
| ... | ⬜ | ... |
```

---

## Step 3: Docker & DB起動確認

- **種別**: 必須ステップ
- **完了条件**: PostgreSQL起動 & マイグレーション成功

### 手順

#### 3-1. PostgreSQL起動

```bash
docker compose up -d
```

#### 3-2. 起動確認

```bash
docker compose ps
```

`postgres` コンテナが `running (healthy)` であることを確認する。

#### 3-3. マイグレーション実行

```bash
pnpm db:migrate
```

マイグレーションが正常に完了したことを確認する。

#### 3-4. エラーハンドリング

| エラー | 原因 | 対処 |
|--------|------|------|
| `port 5432 already in use` | ポート競合（ローカルのPostgreSQLが起動中等） | `lsof -i :5432` で競合プロセスを特定し、停止または `docker-compose.yml` でポート変更 |
| `Cannot connect to the Docker daemon` | Docker未起動 | OrbStack/Docker Desktopを起動。未インストールの場合は `brew install orbstack` を案内 |
| `container exited with code 1` | コンテナ起動失敗 | `docker compose logs postgres` でログ確認。データ破損の場合は `docker compose down -v && docker compose up -d` で再作成 |
| マイグレーション失敗 | スキーマ不整合・接続エラー | `.env` の `DATABASE_URL` を確認。接続先がDockerコンテナのPostgreSQLを指しているか検証 |

### チェックポイント出力

```markdown
## チェックポイント（Step 3 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| 1 | ✅ | ローカル環境セットアップ |
| 2 | ✅ | 環境変数設定 |
| 3 | ✅ | Docker & DB起動確認 |
| 4 | 🔄 | ローカル環境起動確認 ← 次へ |
| ... | ⬜ | ... |
```

---

## Step 4: ローカル環境起動確認

- **種別**: 必須ステップ
- **完了条件**: 全アプリが200レスポンスを返す

### 手順

#### 4-1. 開発サーバー起動

```bash
pnpm dev:bg
```

バックグラウンドで起動する（フォアグラウンドだとエージェントがブロックされる）。全アプリのビルド・起動が完了するまで待機する（初回はビルドに時間がかかる場合がある）。

#### 4-2. アプリ別ヘルスチェック

`pnpm dev:status` で起動状態とポートを確認し、各アプリにHTTPリクエストを送信する。

```bash
# 起動状態とポート確認
pnpm dev:status
```

出力からポートを読み取り、各アプリにcurlで疎通確認:

```bash
# 例: apps/web が port 3000、apps/admin が port 4000 の場合
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000
```

> **注意**: worktree環境ではポートが動的に割り当てられるため、必ず `pnpm dev:status` の出力でポートを確認すること。

期待値: いずれも `200` が返ること。

#### 4-3. エラーハンドリング

失敗時は**アプリ名を明示**して報告する。

| エラー | アプリ | 対処 |
|--------|--------|------|
| `EADDRINUSE` | 該当アプリ | `lsof -i :<port>` で競合プロセスを特定・停止 |
| `Module not found` | 該当アプリ | `pnpm install` を再実行。特定パッケージならそのワークスペースで `pnpm add <pkg>` |
| Next.js設定エラー | 該当アプリ | `apps/<app>/next.config.*` の設定を確認。エラーメッセージを提示 |
| 環境変数不足 | 該当アプリ | Step 2（環境変数設定）の結果を再確認。不足変数を `.env` に追加 |
| タイムアウト（応答なし） | 該当アプリ | ターミナルのビルドログを確認。ビルドエラーが出ていないか検証 |

### チェックポイント出力

```markdown
## チェックポイント（Step 4 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| 1 | ✅ | ローカル環境セットアップ |
| 2 | ✅ | 環境変数設定 |
| 3 | ✅ | Docker & DB起動確認 |
| 4 | ✅ | ローカル環境起動確認 |
| 5 | 🔄 | Vercel設定 ← 次へ |
| ... | ⬜ | ... |
```

---

## Step 10.1: ローテーション後の再同期

- **種別**: Step 10（鍵ローテーション）実行時は必須
- **完了条件**: GitHub Secrets・Vercel環境変数が新鍵で更新済み

> **重要**: この再同期を行わないとデプロイが破綻する。Step 10で鍵をローテーションした場合は必ず実行すること。

### 手順

#### 10.1-1. GitHub Secrets再設定

Step 7のフローを再実行し、新しい `DOTENVX_KEY_*` をGitHub Secretsに設定する。

詳細手順: → `references/category-5-github-secrets.md`

#### 10.1-2. Vercel環境変数再設定

Step 5のフローを再実行し、新しい鍵をVercel環境変数に反映する。

詳細手順: → `references/category-3-vercel.md`

#### 10.1-3. 検証

設定完了後、以下を確認する:

```bash
# GitHub Secretsの設定確認（値は表示されないが、存在確認は可能）
gh secret list
```

#### 10.1-4. エラーハンドリング

| エラー | 対処 |
|--------|------|
| `gh secret set` 失敗 | リポジトリへのアクセス権限を確認。`gh auth status` で認証状態を検証 |
| Vercel CLI認証エラー | `vercel login` で再認証 |
| 新鍵が `.env.keys` に反映されていない | Step 10のローテーション結果を再確認。`.env.keys` ファイルの内容を検証 |

---

## Step 11: デプロイ実行

- **種別**: スキップ可
- **完了条件**: push/トリガー成功

### 手順

#### 11-1. デプロイ対象環境の確認

AskUserQuestionでどの環境にデプロイするか確認する（複数選択可）。

#### 11-2. 環境別デプロイ実行

| 環境 | トリガー方法 | 備考 |
|------|------------|------|
| develop | `git push origin main:develop` | developブランチにpush |
| staging | `git push origin main:staging` | stagingブランチにpush |
| production | `git push origin main` + GitHub承認ゲート | main pushは要承認 |
| PR-preview | `gh pr create --draft --title "env-setup test" --body "環境セットアップ確認用"` | PR作成がトリガー |

#### 11-3. デプロイ実行例

**develop環境の場合**:

```bash
git push origin main:develop
```

**staging環境の場合**:

```bash
git push origin main:staging
```

**PR-preview環境の場合**:

```bash
gh pr create --draft --title "env-setup test" --body "環境セットアップ確認用"
```

#### 11-4. エラーハンドリング

| エラー | 対処 |
|--------|------|
| `rejected` (push拒否) | ブランチ保護ルールを確認。force pushが必要な場合はユーザーに確認 |
| `permission denied` | `gh auth status` で権限確認。リポジトリへのwrite権限が必要 |
| リモートブランチ不在 | 初回pushの場合は自動作成される。それ以外は `git fetch origin` で最新化 |

### チェックポイント出力

```markdown
## チェックポイント（Step 11 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| ... | ✅ | ... |
| 11 | ✅ | デプロイ実行 |
| 12 | 🔄 | CI/CD監視・自動修復 ← 次へ |
| 13 | ⬜ | Playwright MCPアクセス確認 |
| ... | ⬜ | ... |
```

---

## Step 12: CI/CD監視・自動修復

- **種別**: Step 11実行時のみ
- **完了条件**: 全ワークフローsuccess or ユーザースキップ

### 自動修復方針

> 自動修復対象は**環境設定系エラー**に限定する。コードエラー・型エラー・テスト失敗は報告のみとし、別途対応を案内する。

### 手順

#### 12-1. ワークフロー実行状況の確認

```bash
gh run list --limit 5
```

#### 12-2. 実行中ワークフローの監視

```bash
gh run watch <run-id>
```

完了まで待機する。

#### 12-3. 失敗時のエラーログ取得

```bash
gh run view <run-id> --log-failed
```

#### 12-4. アプリ別CI結果確認

```bash
gh run view <run-id>
```

ジョブ単位の結果を取得し、`apps/web` と `apps/admin` のビルド・テスト結果を個別に報告する。

#### 12-5. エラーパターンマッチング & 自動修復

取得したエラーログを以下のパターンテーブルと照合し、該当すれば自動修復を実行する。

| パターン | 修復方法 | 承認 | リトライ上限 |
|---------|---------|------|------------|
| Secret not found | → Step 7再実行（`references/category-5-github-secrets.md`） | 自動 | 1回 |
| Neon認証失敗 | → Step 6のAPI Key再設定（`references/category-4-neon.md`） | 自動 | 1回 |
| Vercelデプロイ失敗（env不足） | → 環境別に分岐: production→`vercel env add`、develop/staging/preview→`--env`注入確認（`references/category-3-vercel.md`） | 自動 | 1回 |
| Protected branch update failed | → 現状の保護ルール取得→差分提示→**AskUserQuestionで承認**→適用 | **要承認** | 1回 |
| コードエラー/型エラー/テスト失敗 | → エラーログ全文表示、修正は行わない | - | - |

#### 12-6. 修復後の再確認

修復実行後、再度 `gh run list` でワークフロー結果を確認する。

**修復後も失敗する場合**: ユーザーに報告し、AskUserQuestionで以下を確認する:
- 「手動で対応する」
- 「スキップして次のステップへ進む」

**リトライ上限**: 環境あたり2回（初回 + 修復後1回）。上限到達時はユーザーに報告して判断を仰ぐ。

#### 12-7. エラーハンドリング

| エラー | 対処 |
|--------|------|
| `gh` CLI未認証 | `gh auth login` で認証 |
| ワークフロー実行が見つからない | `gh run list --workflow <name>` でワークフロー名を指定して検索 |
| ログ取得タイムアウト | 数秒待ってリトライ。GitHub API制限の場合は待機 |

### チェックポイント出力

```markdown
## チェックポイント（Step 12 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| ... | ✅ | ... |
| 11 | ✅ | デプロイ実行 |
| 12 | ✅ | CI/CD監視・自動修復 |
| 13 | 🔄 | Playwright MCPアクセス確認 ← 次へ |
| ... | ⬜ | ... |
```

---

## Step 13: Playwright MCPでのアクセス確認

- **種別**: Step 11実行時のみ
- **完了条件**: 全URLで正常表示

### 手順

#### 13-1. Playwright MCP利用可否の確認

Playwright MCPツール（`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`）が利用可能かを確認する。

#### 13-2a. MCP接続可能な場合

1. **ページアクセス**: `browser_navigate` で各デプロイURLにアクセス
2. **構造確認**: `browser_snapshot` でページ構造を確認（DOMが正常にレンダリングされているか）
3. **スクリーンショット取得**: `browser_take_screenshot` でビジュアル確認用のスクリーンショットを取得

各URLについて以下を報告する:
- HTTPステータス
- ページタイトル
- 主要コンテンツの表示有無
- エラー表示の有無

#### 13-2b. MCP未接続の場合

デプロイURLを一覧表示し、ユーザーに手動確認を依頼する:

```
以下のURLにブラウザでアクセスし、正常に表示されるか確認してください:
- develop: https://...
- staging: https://...
- production: https://...
- PR-preview: https://...
```

#### 13-3. エラーハンドリング

| エラー | 対処 |
|--------|------|
| 404 Not Found | デプロイが完了していない可能性。Step 12に戻ってCI/CD状態を再確認 |
| 500 Internal Server Error | アプリケーションエラー。デプロイログを確認し、環境変数の不足がないか検証 |
| DNS解決失敗 | ドメイン設定を確認。デプロイ直後の場合はDNS伝播を待機（数分） |
| Playwright MCPタイムアウト | ネットワーク状況を確認。リトライまたはcurlでのフォールバック確認 |

### チェックポイント出力

```markdown
## チェックポイント（Step 13 完了後）
| Step | 状態 | 内容 |
|------|------|------|
| ... | ✅ | ... |
| 12 | ✅ | CI/CD監視・自動修復 |
| 13 | ✅ | Playwright MCPアクセス確認 |
| 14 | 🔄 | ヘルスチェック ← 次へ |
| 15 | ⬜ | 最終サマリー |
```

---

## Step 15: 最終サマリー

- **種別**: 必須ステップ
- **完了条件**: 出力完了

### 手順

#### 15-1. サマリー出力

以下のフォーマットで最終サマリーを出力する:

```markdown
## 環境セットアップ完了サマリー

### 実行結果

| Step | 内容 | 結果 | 備考 |
|------|------|------|------|
| 1 | ローカル環境セットアップ | ✅/⏭️/❌ | ... |
| 2 | 環境変数設定 | ✅/⏭️/❌ | ... |
| 3 | Docker & DB起動確認 | ✅/⏭️/❌ | ... |
| 4 | ローカル環境起動確認 | ✅/⏭️/❌ | ... |
| 5 | Vercel設定 | ✅/⏭️/❌ | ... |
| 6 | Neon設定 | ✅/⏭️/❌ | ... |
| 7 | GitHub Secrets設定 | ✅/⏭️/❌ | ... |
| 8 | GitHub Actions初期設定 | ✅/⏭️/❌ | ... |
| 9 | デプロイ設定ファイル確認 | ✅/⏭️/❌ | ... |
| 10 | 鍵ローテーション | ✅/⏭️/❌ | ... |
| 10.1 | ローテーション後の再同期 | ✅/⏭️/❌ | ... |
| 11 | デプロイ実行 | ✅/⏭️/❌ | ... |
| 12 | CI/CD監視・自動修復 | ✅/⏭️/❌ | ... |
| 13 | Playwright MCPアクセス確認 | ✅/⏭️/❌ | ... |
| 14 | ヘルスチェック | ✅/⏭️/❌ | ... |
| 15 | 最終サマリー | ✅ | 本ステップ |
```

結果の凡例:
- `✅`: 正常完了
- `⏭️`: スキップ（条件未該当またはユーザー選択）
- `❌`: 失敗（備考に理由を記載）

#### 15-2. 想定外事態の出力

ワークフロー中に記録された `unexpected_events` リストの内容を出力する。

```markdown
### 想定外事態
- Step 3: PostgreSQLのポート競合が発生し、ポート5433に変更して対応
- Step 12: CI/CDでNeon認証失敗、API Key再設定で解決
```

想定外事態がなかった場合は「なし」と記載する。

#### 15-3. 残作業の出力

Step 14のヘルスチェック結果から残っている作業を列挙する。

```markdown
### 残作業
- Vercel staging環境の環境変数 `NEXT_PUBLIC_API_URL` が未設定
- GitHub Actions の `deploy-production` ワークフローが未テスト
```

残作業がない場合は「なし」と記載する。

#### 15-4. 次のステップの提示

```markdown
### 次のステップ
- 本番デプロイ前にstagingでの動作確認を推奨
- CI/CDパイプラインの定期監視設定を検討
```

状況に応じた推奨アクションを提示する。
