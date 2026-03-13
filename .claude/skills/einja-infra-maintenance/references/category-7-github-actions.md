# カテゴリ7: GitHub Actions CI/CD管理

## 目次
- [サブメニュー](#サブメニュー)
- [プロジェクトのワークフロー](#プロジェクトのワークフロー)
- [実行手順](#実行手順)
  - [リポジトリ設定（初回のみ）](#リポジトリ設定初回のみ)
  - [ワークフロー状態確認](#ワークフロー状態確認)
  - [失敗調査](#失敗調査)
  - [手動トリガー](#手動トリガー)
  - [ワークフロー一覧](#ワークフロー一覧)
- [エラー時の対処](#エラー時の対処)
- [参照ドキュメント](#参照ドキュメント)

## サブメニュー
- **リポジトリ設定**: ブランチ保護ルールの初期設定
- **ワークフロー状態確認**: 最新の実行結果一覧
- **失敗調査**: 失敗したワークフローのログ分析
- **手動トリガー**: ワークフローの手動実行
- **ワークフロー一覧**: 利用可能なワークフロー確認

## プロジェクトのワークフロー

| ワークフロー | ファイル | トリガー | 用途 | 備考 |
|------------|---------|---------|------|------|
| デプロイ（安定ブランチ） | `deploy-stable-branches.yml` | push to main/develop/staging | 動的マトリクス → 変更アプリのみデプロイ | mainのみenv sync、他は`--env`実行時注入 |
| PRプレビューデプロイ | `deploy-pr-preview.yml` | PR open/sync | PR毎のプレビュー環境作成 | `--env`実行時注入（env sync廃止） |
| PRプレビューDB削除 | `cleanup-pr-preview-db.yml` | schedule/manual | 孤立Neonブランチのクリーンアップ | PR未存在のブランチを自動削除 |
| PRクローズ時クリーンアップ | `cleanup-pr-preview-on-close.yml` | PR close | PR関連リソース削除 | Neonブランチ + Vercel Preview削除 |
| NPMパッケージ公開 | `publish-packages.yml` | workflow_run / manual | @einja-inc/dev-cli, @einja-inc/create-app NPM公開 | Deploy Stable成功後に自動実行、workflow_dispatch対応 |
| Release Draft | `create-release-draft.yml` | PR to main/staging | Draft Release作成・PRコメント | PR close時にクリーンアップ |
| Claude Code | `claude.yml` | issue comment | Claude Codeによる自動対応 | `@claude`コメントでトリガー |

## 実行手順

### リポジトリ設定（初回のみ）

#### ブランチ作成

develop / staging ブランチが存在しない場合、mainから作成する。

```bash
# develop / staging ブランチの存在確認・作成
for BRANCH in develop staging; do
  if gh api "repos/{owner}/{repo}/branches/$BRANCH" >/dev/null 2>&1; then
    echo "✅ $BRANCH ブランチは既に存在します"
  else
    echo "📝 $BRANCH ブランチを main から作成します..."
    MAIN_SHA=$(gh api "repos/{owner}/{repo}/git/refs/heads/main" --jq '.object.sha')
    gh api "repos/{owner}/{repo}/git/refs" -X POST \
      -f "ref=refs/heads/$BRANCH" \
      -f "sha=$MAIN_SHA"
    echo "✅ $BRANCH ブランチを作成しました"
  fi
done
```

#### ブランチ保護ルール

mainブランチとstagingブランチにはPRレビュー承認を必須とし、developブランチはPR必須だが承認不要とする。`publish-packages.yml` 等のワークフローがmainに直接push（バージョンバンプ・タグ作成）するため、GitHub Actionsにbypass権限が必要。

**main / staging ブランチ（承認必須）:**

```bash
for BRANCH in main staging; do
  echo "📝 $BRANCH ブランチの保護ルールを設定します..."
  gh api "repos/{owner}/{repo}/branches/$BRANCH/protection" -X PUT \
    --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 1,
    "bypass_pull_request_allowances": {
      "apps": ["github-actions"]
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
  echo "✅ $BRANCH ブランチの保護ルールを設定しました"
done
```

**develop ブランチ（承認不要・PR必須）:**

```bash
echo "📝 develop ブランチの保護ルールを設定します..."
gh api "repos/{owner}/{repo}/branches/develop/protection" -X PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0,
    "bypass_pull_request_allowances": {
      "apps": ["github-actions"]
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "✅ develop ブランチの保護ルールを設定しました"
```

> **重要**: `bypass_pull_request_allowances.apps` に `github-actions` を含めること。これがないと `publish-packages.yml` のCommit and tagステップが `GH006: Protected branch update failed` で失敗する。

> **develop ブランチ**: `required_approving_review_count: 0` により、PRの作成は必須だがレビュー承認なしでマージ可能。開発フローの迅速化のため承認を省略している。

### ワークフロー状態確認
```bash
# 最新の実行結果一覧
gh run list --limit 10

# 特定ワークフローの実行一覧
gh run list --workflow=deploy-stable-branches.yml --limit 5

# 実行中のワークフロー
gh run list --status=in_progress
```

### 失敗調査
1. 失敗したワークフローの一覧を取得:
   ```bash
   gh run list --status=failure --limit 5
   ```
2. AskUserQuestionで調査対象のrun-idを選択
3. 失敗したジョブのログを表示:
   ```bash
   gh run view <run-id> --log-failed
   ```
4. **ログ分析→アクション提案**: エラーパターンに基づいてカテゴリ遷移を提案

| エラーパターン | 推奨アクション |
|---------------|---------------|
| `Secret not found: DOTENV_PRIVATE_KEY_*` | → カテゴリ5（GitHub Secrets管理）で一括設定 |
| `vercel deploy failed` | → カテゴリ3（Vercel管理）で状態確認 |
| `neonctl: authentication failed` | → カテゴリ5でNEON_API_KEY更新 |
| `Permission denied` | → `.github/workflows/`のpermissions設定確認を案内 |
| `GH006: Protected branch update failed` | → カテゴリ7（リポジトリ設定）でGitHub Actionsのbypass権限を設定 |
| `prisma migrate deploy` 失敗 / DBスキーマ不整合 | Neonブランチのマイグレーション履歴を確認。`db:push`（スキーマ直接プッシュ）が使われていた場合は `db:migrate:deploy` に変更する |
| `database "neondb" does not exist` / DB接続エラー | Neonブランチが正しく作成されているか確認。NEON_API_KEY・NEON_PROJECT_IDの設定を確認 |
| Neon `connection_uri` APIが空URLを返す | `role_name=neondb_owner` パラメータが推奨（APIドキュメント上はoptionalだが、未指定だとDB URLが返らないケースがある）。全API呼び出しに追加することを推奨する |
| その他 | エラーログ全文を表示し、対処方法をAskUserQuestionで相談 |

### 手動トリガー
```bash
# workflow_dispatch対応ワークフローを手動実行
gh workflow run <workflow-file> --ref <branch>

# 入力パラメータ付き
gh workflow run <workflow-file> --ref <branch> -f param1=value1

# PRプレビューDBクリーンアップの手動実行
gh workflow run cleanup-pr-preview-db.yml --ref main
```

### ワークフロー一覧
```bash
# 利用可能なワークフロー一覧
gh workflow list

# 特定ワークフローの詳細
gh workflow view <workflow-file>
```

## エラー時の対処

| エラー | 対処 |
|--------|------|
| デプロイ失敗 | `gh run view <id> --log-failed` でログ確認 → 原因特定 |
| Secrets不足 | カテゴリ5（GitHub Secrets管理）で設定 |
| 環境変数同期失敗 | dotenvx秘密鍵のSecret設定を確認 |
| Neonブランチ作成失敗 | NEON_API_KEY のSecret設定・有効期限を確認 |
| Permission denied | ワークフローのpermissions設定を確認 |

## 参照ドキュメント
- `.github/workflows/` 内の各ワークフローファイル
- `docs/einja/instructions/deployment-setup.md`
- `docs/einja/steering/infrastructure/deployment.md`
