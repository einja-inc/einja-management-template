# Vercel環境変数競合解消 + デプロイジョブ動的マトリクス化

## Context

参照コミット:
1. https://github.com/drlovekoushiki/drlove_demo_app/commit/565dd31 (env競合解消)
2. https://github.com/drlovekoushiki/drlove_demo_app/commit/1ad3045 (変更検知フィルタ追加)
3. https://github.com/drlovekoushiki/drlove_demo_app/commit/2cf8bbf (動的マトリクス化)
4. https://github.com/drlovekoushiki/drlove_demo_app/commit/d12f7c4 (エッジケース対応)

**問題1**: PR環境で`vercel env add`が重複追加・並行PR競合を起こす
**問題2**: 変更がないアプリもデプロイジョブが走り、各ステップで`should_deploy`条件分岐が冗長
**問題3**: grep正規表現が数字含む変数名に非対応、空文字値の未注入、changesジョブ失敗時ガード不足

**解決方針**:
- PR環境: `vercel env add`を廃止し、`--env`フラグで実行時注入
- stable branches: mainブランチのみ`vercel env add`、他は`--env`注入
- 変更検知フィルタに`.github/workflows/**`を追加
- 動的マトリクスで変更のあるアプリのみジョブを生成
- エッジケース修正を最初から反映

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.github/workflows/deploy-pr-preview.yml` | env sync削除、deploy時`--env`注入 |
| `.github/workflows/deploy-stable-branches.yml` | 動的マトリクス化、env syncをmain限定、deploy時`--env`注入、フィルタ追加 |
| `docs/einja/steering/infrastructure/deployment.md` | フロー図・説明を新方式に更新 |
| `docs/einja/instructions/vercel-cli-reference.md` | 環境変数同期セクションを新方式に更新 |
| `.claude/skills/einja-infra-maintenance/SKILL.md` | env sync説明をmain限定+`--env`注入に更新 |

## 詳細変更計画

### 1. deploy-pr-preview.yml

#### 1a. 「Sync environment variables to Vercel」ステップを削除（L264-282）

現在のL264-282にある`vercel env rm`/`vercel env add`ループを完全削除。

#### 1b. 「Deploy to Vercel」ステップを変更（L294-300）

**変更後:**
```yaml
      - name: Deploy to Vercel
        id: deploy
        run: |
          npx dotenvx run -f $GITHUB_WORKSPACE/.env.preview -- bash -c '
            declare -a ENV_FLAGS=()
            while IFS= read -r key; do
              case "$key" in
                NEON_*|DOTENV_PUBLIC_KEY_*) continue ;;
              esac
              value="${!key}"
              if [ -n "$value" ]; then
                echo "::add-mask::${value}"
              fi
              ENV_FLAGS+=("--env" "${key}=${value}")
            done < <(grep -E "^[A-Z_][A-Z0-9_]*=\"?encrypted:" "$GITHUB_WORKSPACE/.env.preview" | cut -d= -f1)

            # DATABASE_URLはNeon APIから取得した値を注入（.env.previewには含まれない）
            ENV_FLAGS+=("--env" "DATABASE_URL=${DATABASE_URL}")

            echo "Deploying with ${#ENV_FLAGS[@]} runtime env vars..."
            DEPLOY_URL=$(vercel deploy --prebuilt "${ENV_FLAGS[@]}" --token="$VERCEL_TOKEN")
            echo "url=$DEPLOY_URL" >> "$GITHUB_OUTPUT"
          '
        env:
          DOTENV_PRIVATE_KEY_PREVIEW: ${{ secrets.DOTENV_PRIVATE_KEY_PREVIEW }}
          DATABASE_URL: ${{ steps.db-urls.outputs.db_url_pooled }}
```

**反映済みエッジケース修正（コミット#4）:**
- grep正規表現: `[A-Z_][A-Z0-9_]*`（数字含む変数名対応）
- `ENV_FLAGS+=`を`if`の外に配置（空文字値も`--env`注入）

### 2. deploy-stable-branches.yml

#### 2a. changesジョブ: フィルタ追加 + 動的マトリクス構築

```yaml
    outputs:
      web: ${{ steps.filter.outputs.web }}
      admin: ${{ steps.filter.outputs.admin }}
      deploy_matrix: ${{ steps.matrix.outputs.matrix }}  # 追加
```

web/admin両方のフィルタに`.github/workflows/**`追加。新規ステップ追加:

```yaml
      - name: Build deploy matrix
        id: matrix
        run: |
          MATRIX='[]'
          if [ "${{ steps.filter.outputs.web }}" = "true" ]; then
            MATRIX=$(echo "$MATRIX" | jq -c '. + [{"app": "web"}]')
          fi
          if [ "${{ steps.filter.outputs.admin }}" = "true" ]; then
            MATRIX=$(echo "$MATRIX" | jq -c '. + [{"app": "admin"}]')
          fi
          echo "matrix=$MATRIX" >> $GITHUB_OUTPUT
```

#### 2b. deployジョブ: 動的マトリクスに変更 + should_deploy全削除

```yaml
  deploy:
    needs: [ci, migrate, changes]
    if: always() && needs.ci.result == 'success' && (needs.migrate.result == 'success' || needs.migrate.result == 'skipped') && needs.changes.result == 'success' && needs.changes.outputs.deploy_matrix != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include: ${{ fromJSON(needs.changes.outputs.deploy_matrix) }}
```

- 「Check if deploy is needed」ステップを完全削除
- 全ステップから`if: steps.check.outputs.should_deploy == 'true'`を削除
- `Extract alias domain`と`Set Vercel alias`は`if: env.DEPLOY_RUN_ALIAS == 'true'`のみに

#### 2c. env sync関連をmainブランチ限定に + grep修正

if条件を変更し、grep正規表現も数字含む変数名に対応:

```yaml
      - name: Sync environment variables to Vercel
        if: github.ref_name == 'main'
        run: |
          npx dotenvx run -f ${{ env.DEPLOY_DOTENV_FILE }} -- bash -c '
            grep -E "^[A-Z_][A-Z0-9_]*=\"?encrypted:" ${{ env.DEPLOY_DOTENV_FILE }} | cut -d= -f1 | while read -r key; do
              case "$key" in
                NEON_*) continue ;;
              esac
              value="${!key}"
              if [ -n "$value" ]; then
                echo "Syncing $key to Vercel (${{ env.DEPLOY_VERCEL_ENV }})..."
                echo "$value" | vercel env rm "$key" ${{ env.DEPLOY_VERCEL_ENV }} --yes --token=$VERCEL_TOKEN 2>/dev/null || true
                echo "$value" | vercel env add "$key" ${{ env.DEPLOY_VERCEL_ENV }} --token=$VERCEL_TOKEN
              fi
            done
          '
        env:
          DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
          DOTENV_PRIVATE_KEY_STAGING: ${{ secrets.DOTENV_PRIVATE_KEY_STAGING }}
          DOTENV_PRIVATE_KEY_DEVELOP: ${{ secrets.DOTENV_PRIVATE_KEY_DEVELOP }}
```

```yaml
      - name: Re-pull Vercel Environment after sync
        if: github.ref_name == 'main'
```

#### 2d. 「Deploy to Vercel」ステップを`--env`注入に変更

```yaml
      - name: Deploy to Vercel
        id: deploy
        run: |
          npx dotenvx run -f $DEPLOY_DOTENV_FILE -- bash -c '
            declare -a ENV_FLAGS=()
            while IFS= read -r key; do
              case "$key" in
                NEON_*|VERCEL_ALIAS_DOMAIN_*|DOTENV_PUBLIC_KEY_*) continue ;;
              esac
              value="${!key}"
              if [ -n "$value" ]; then
                echo "::add-mask::${value}"
              fi
              ENV_FLAGS+=("--env" "${key}=${value}")
            done < <(grep -E "^[A-Z_][A-Z0-9_]*=\"?encrypted:" "$DEPLOY_DOTENV_FILE" | cut -d= -f1)

            echo "Deploying with ${#ENV_FLAGS[@]} runtime env vars..."
            DEPLOY_URL=$(vercel deploy --prebuilt $DEPLOY_PROD_FLAG "${ENV_FLAGS[@]}" --token="$VERCEL_TOKEN")
            echo "url=$DEPLOY_URL" >> "$GITHUB_OUTPUT"
          '
        env:
          DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
          DOTENV_PRIVATE_KEY_STAGING: ${{ secrets.DOTENV_PRIVATE_KEY_STAGING }}
          DOTENV_PRIVATE_KEY_DEVELOP: ${{ secrets.DOTENV_PRIVATE_KEY_DEVELOP }}
```

**注意**: このプロジェクトでは`DEPLOY_VERCEL_TARGET_FLAG`ではなく`DEPLOY_PROD_FLAG`を使用。

### 3. docs/einja/steering/infrastructure/deployment.md

更新箇所:
- PRプレビューフローのmermaid図: `環境変数同期` → `vercel deploy --env（実行時注入）`
- Stableブランチフローのmermaid図: mainのみ環境変数同期、他は`--env`注入
- フローチャート: 動的マトリクスで変更アプリのみデプロイ
- 同時PR運用時の注意: 全encrypted環境変数`--env`注入の説明に更新
- Vercel環境変数の自動同期: mainブランチ限定を明記
- ワークフロー一覧テーブル: 動的マトリクス、`--env`注入の説明追加

### 4. docs/einja/instructions/vercel-cli-reference.md

更新箇所:
- 環境変数同期自動化セクション: mainのみ`vercel env add`、他は`--env`注入
- CI/CD非対話パターン表: `vercel deploy --env`の使い方追記

### 5. .claude/skills/einja-infra-maintenance/SKILL.md

更新箇所:
- 環境変数同期の説明: mainのみ`vercel env add`、他は`--env`注入
- ワークフロー一覧テーブル: 動的マトリクス、`--env`注入の説明追加
- 競合回避ルール: env syncがmain限定であることを明記

## 検証方法

1. YAML構文チェック（両ファイル）
2. `git diff --stat`で変更が5ファイルのみであることを確認
3. PR作成後にActionsでの動作確認（推奨）
