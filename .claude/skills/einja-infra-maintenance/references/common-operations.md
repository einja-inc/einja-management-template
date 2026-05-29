# 共通オペレーション

## 目次
- [セキュリティ考慮事項](#セキュリティ考慮事項)
- [エラーハンドリング](#エラーハンドリング)
- [既存ワークフローとの整合性](#既存ワークフローとの整合性)
- [CLI非対話モード トラブルシューティング](#cli非対話モード-トラブルシューティング)

## セキュリティ考慮事項

### トークン・API Keyの管理

| トークン | 保存先 | セキュリティ |
|---------|--------|------------|
| VERCEL_TOKEN | `.env.personal` | gitignore対象、`chmod 600`設定 |
| NEON_API_KEY | `.env.personal` | gitignore対象、`chmod 600`設定 |
| GITHUB_TOKEN | `.env.personal` | gitignore対象、`chmod 600`設定 |
| DOTENV_PRIVATE_KEY_* | `.env.keys` | gitignore対象、1Password等で共有 |
| NEON_PROJECT_ID | `.env.preview`（暗号化） | dotenvx暗号化、Git管理 |

**必須**: トークン保存後は `chmod 600 .env.personal` を実行すること。

### CLI vs REST API 使い分け

| 操作 | 方式 | 理由 |
|------|------|------|
| Vercel プロジェクト操作 | CLI (`vercel link --yes`) | 認証簡単、非対話モード対応 |
| Vercel Root Directory設定 | API (`PATCH /v9/projects/{id}`) | CLIでは不可 |
| Vercel 標準環境変数 | CLI (`vercel env add/rm`) | バッチ対応 |
| Neon ブランチ操作 | CLI (`neonctl --api-key`) | 環境変数認証で非対話実行可 |
| Neon 接続URL取得 | CLI + API | CLI: 単一ブランチ、API: 一括取得 |
| GitHub Secrets | CLI (`gh secret set`) | API暗号化が複雑 |
| GitHub Actions監視 | CLI (`gh run list/view`) | フォーマット良好 |

## エラーハンドリング

| エラー種別 | 対処 |
|-----------|------|
| CLI未インストール | 自動インストール実行: `brew install <cli>` または `npm i -g <cli>`。Docker のみ OrbStack インストール案内（GUI必須のため） |
| トークン未設定 | 取得URL案内 → AskUserQuestionで値入力 → `.env.personal`に保存 → API検証（`vercel whoami` / `gh auth status` / `neonctl projects list`）で有効性確認 |
| トークン無効/期限切れ | 再取得URL案内 → AskUserQuestionで新しい値入力 → `.env.personal`を更新 → API検証で有効性確認 |
| API呼び出し失敗 | エラー内容表示 → リトライ or 代替手段提示 |
| dotenvx復号失敗 | `.env.keys`確認 → 秘密鍵再設定ガイド |
| ネットワークエラー | 3回リトライ → 失敗時は手動手順提示 |
| macOSコマンド互換性 | GNU `timeout` は macOS に存在しない。タイムアウトが必要な場合はコマンドを直接実行し、ハング時はCtrl+Cで対処する |

## 既存ワークフローとの整合性

### 競合回避ルール

- **環境変数同期**: `vercel env add`によるVercel環境変数ストアへの書き込みはmainブランチのみ。develop/staging/PRは`vercel deploy --env`で実行時注入（並行デプロイ間の競合防止）
- **初回セットアップ**: Skillでは初回セットアップ時のみ手動同期。以降はGitHub Actionsが自動管理
- **Neonブランチクリーンアップ**: `cleanup-pr-preview-db.yml`が定期実行。Skillでは手動クリーンアップは提供しない
- **GitHub Secrets更新**: Skillで設定した値はワークフローでそのまま使用される（同じdotenvxコマンド体系）

## CLI非対話モード トラブルシューティング

CLIツールをClaude Code（非対話モード）から実行する際の既知の問題と対処法。**大半がCLIの非対話モード対応不足（scope・org-id・branchの明示指定が必要）に起因する。**

| # | 症状 | 原因 | 対処 |
|---|------|------|------|
| 1 | `timeout 5 gh auth status` → `command not found: timeout` | macOSのzshにはGNU `timeout` がない | `timeout` を使わず直接実行する |
| 2 | `neonctl projects list` が対話プロンプトでスタック | 複数のOrganizationに所属しており、`--org-id` 未指定で対話モードになる | 全neonctlコマンドに `--org-id $NEON_ORG_ID` を明示指定する |
| 3 | `neonctl projects create --region-id aws-ap-northeast-1` → `requested region not found` | orgのプランで東京リージョンが対象外 | 最寄りの `aws-ap-southeast-1`（シンガポール）でフォールバック。`neonctl regions list` で確認可能 |
| 4 | `vercel link --project=... --yes` → `missing_scope` エラー | チームアカウントで非対話モード（`--yes`）の場合、scopeが自動選択されない | 全vercelコマンドに `--scope $VERCEL_TEAM_SLUG` を追加 |
| 5 | `curl -H "Authorization: Bearer $VERCEL_TOKEN"` → `forbidden` / `missingToken` | Bash変数を1行で代入＋使用すると展開タイミングで失敗する | 変数は事前にexportしておくか、`${VERCEL_TOKEN}` 形式で使用する |
| 6 | `npx turbo link` がVercel scope選択で無限ループ（1.3GBログ生成） | `--yes` フラグが効かず、対話選択をスキップできない | `.turbo/config.json` を `{"teamId":"...","teamSlug":"..."}` で手動作成する |
| 7 | `vercel env add ... preview` → `git_branch_required` | preview環境では対象ブランチの指定が必須 | production環境のみ `vercel env add` で設定。preview/staging/developはCI/CDの `--env` 実行時注入で対応 |
| 8 | PRプレビューCIでDBマイグレーションが適用されず失敗 | `pnpm db:push`（drizzle-kit push によるスキーマ直接プッシュ）を使用しており、`drizzle.__drizzle_migrations` 履歴テーブルに記録されない | `pnpm db:migrate:deploy`（= `tsx db/migrate.ts`、drizzle-kit migrate ベース）に変更。本番・ステージングと同じマイグレーション方式に統一する。**運用方針**: `drizzle-kit push` は schema 設計時のローカル試行のみ許可、CI/CD・本番・ステージング・PRプレビューでは禁止。確認: `psql $DATABASE_URL -c 'SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY id;'` で適用履歴を確認できる |
| 9 | Neon `connection_uri` APIが空/エラーを返す | `role_name` パラメータが未指定。APIドキュメント上はoptionalだが、未指定だとDB URLが返らないケースがある | 全ての `connection_uri` API呼び出しに `&role_name=neondb_owner` を追加することを推奨する |
