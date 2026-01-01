# GitHub Secrets 設定手順

このドキュメントでは、GitHub ActionsでTurborepo Remote Cacheを使用するために必要なSecretsの設定手順を説明します。

> **Note**: 一部のSecretsは将来の拡張用です。現在のプロジェクト構成（apps/webのみ）では、Turborepo Remote CacheとVercelデプロイ（Web）の設定のみが必要です。

## 必要なSecrets

### 1. TURBO_TOKEN

Vercel Remote Cacheに接続するためのトークン。

### 2. TURBO_TEAM

Vercelのチーム/組織ID。

## 設定手順

### Step 1: Vercelプロジェクトの作成とリンク

1. **Vercelアカウントにログイン**
   ```bash
   npx turbo login
   ```
   - ブラウザが開き、Vercelにログインを求められます
   - ログインすると、CLI認証が完了します

2. **プロジェクトをVercel Remote Cacheにリンク**
   ```bash
   npx turbo link
   ```
   - プロンプトでVercelの組織/チームを選択
   - プロジェクト名を確認・選択
   - リンクが完了すると、`.turbo/config.json`が生成されます

### Step 2: トークンとチームIDの取得

1. **TURBO_TOKENの取得**

   Vercel Dashboardから取得：
   - [Vercel Dashboard](https://vercel.com/account/tokens) にアクセス
   - "Create Token" をクリック
   - トークン名を入力（例: `einja-ci-turbo-token`）
   - Scopeを "Full Access" に設定（またはプロジェクト限定）
   - 生成されたトークンをコピー（**一度しか表示されません**）

2. **TURBO_TEAMの取得**

   `.turbo/config.json`から取得：
   ```bash
   cat .turbo/config.json
   ```

   出力例：
   ```json
   {
     "teamId": "team_xxxxxxxxxxxxxxxxx",
     "apiUrl": "https://vercel.com/api"
   }
   ```

   `teamId`の値が`TURBO_TEAM`として使用する値です。

### Step 3: GitHub Secretsに登録

1. **GitHubリポジトリにアクセス**
   - リポジトリページを開く
   - "Settings" タブをクリック

2. **Secretsページに移動**
   - 左サイドバーの "Secrets and variables" > "Actions" をクリック

3. **TURBO_TOKENを追加**
   - "New repository secret" をクリック
   - Name: `TURBO_TOKEN`
   - Secret: Step 2で取得したトークンを貼り付け
   - "Add secret" をクリック

4. **TURBO_TEAMを追加**
   - "New repository secret" をクリック
   - Name: `TURBO_TEAM`
   - Secret: Step 2で取得した`teamId`の値を貼り付け
   - "Add secret" をクリック

## 動作確認

GitHub Actionsでビルドが実行されると、以下のログでRemote Cacheが有効になっていることを確認できます：

```
>>> TURBO
>>> TURBO Turborepo Remote Cache enabled
>>> TURBO
```

初回ビルド後、2回目以降のビルドで以下のようなキャッシュヒットのログが表示されます：

```
web:build: cache hit, replaying logs
```

## トラブルシューティング

### エラー: "Remote Caching is not enabled"

**原因**: TURBO_TOKENまたはTURBO_TEAMが正しく設定されていない。

**解決策**:
1. GitHub Secretsの値が正しいか確認
2. `.turbo/config.json`の`teamId`とGitHub SecretsのTURBO_TEAMが一致するか確認
3. Vercelトークンの有効期限が切れていないか確認

### エラー: "Authorization failed"

**原因**: TURBO_TOKENが無効または権限不足。

**解決策**:
1. Vercel Dashboardで新しいトークンを生成
2. トークンのScopeが適切か確認（Full AccessまたはRead/Write権限）
3. GitHub Secretsを更新

---

## Vercelデプロイ設定

CI/CDパイプラインでwebアプリをVercelに自動デプロイするために必要なSecretsを設定します。

**デプロイ方法**: Vercel CLI（公式ツール）を使用します。これにより、モノレポとTurborepoとの統合が最適化されます。

### 必要なSecrets

#### 1. VERCEL_TOKEN

Vercelへのデプロイに使用するアクセストークン。

#### 2. VERCEL_ORG_ID

VercelのOrganization/チームID。

#### 3. VERCEL_WEB_PROJECT_ID

webアプリのVercelプロジェクトID。

### 設定手順

#### Step 1: Vercelプロジェクトの作成

1. **Vercelにログイン**
   - [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
   - GitHubアカウントでログイン

2. **webアプリのプロジェクトを作成**
   - "Add New" > "Project" をクリック
   - GitHubリポジトリを選択
   - "Root Directory"を`apps/web`に設定
   - Framework Presetは "Next.js" を選択
   - **Build Command**: `cd ../.. && npx turbo run build --filter=web`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`（モノレポのルートで実行）
   - "Deploy"をクリック

#### Step 2: トークンとIDの取得

1. **VERCEL_TOKENの取得**

   Vercel Dashboardから取得：
   - [Account Settings > Tokens](https://vercel.com/account/tokens) にアクセス
   - "Create Token" をクリック
   - トークン名を入力（例: `einja-ci-deploy-token`）
   - Scopeは "Full Account" を推奨（プロジェクト限定も可）
   - Expiration（有効期限）を設定
   - 生成されたトークンをコピー（**一度しか表示されません**）

2. **VERCEL_ORG_IDの取得**

   Vercelプロジェクトをローカルにリンクして取得：
   ```bash
   cd apps/web
   npx vercel link
   ```

   プロンプトに従ってログインとプロジェクト選択を行うと、`.vercel/project.json`が生成されます：
   ```bash
   cat .vercel/project.json
   ```

   出力例：
   ```json
   {
     "projectId": "prj_xxxxxxxxxxxxxxxxx",
     "orgId": "team_xxxxxxxxxxxxxxxxx"
   }
   ```

   `orgId`の値が`VERCEL_ORG_ID`として使用する値です。

3. **VERCEL_WEB_PROJECT_IDの取得**

   `apps/web/.vercel/project.json`から取得：
   ```bash
   cat apps/web/.vercel/project.json
   ```

   `projectId`の値が`VERCEL_WEB_PROJECT_ID`として使用する値です。

#### Step 3: GitHub Secretsに登録

1. **GitHubリポジトリにアクセス**
   - リポジトリページを開く
   - "Settings" タブをクリック

2. **Secretsページに移動**
   - 左サイドバーの "Secrets and variables" > "Actions" をクリック

3. **各Secretを追加**
   - "New repository secret" をクリックして以下を順次追加：

   | Name | Value |
   |------|-------|
   | `VERCEL_TOKEN` | Step 2-1で取得したトークン |
   | `VERCEL_ORG_ID` | Step 2-2で取得した`orgId` |
   | `VERCEL_WEB_PROJECT_ID` | Step 2-3で取得した`projectId` |

### 動作確認

mainブランチにマージすると、GitHub Actionsで以下のステップが実行されます：

```
Install Vercel CLI
Pull Vercel Environment Information (web)
Build Project Artifacts (web)
Deploy to Vercel (web)
```

**Vercel CLIの利点**:
- ✅ Vercel公式ツール（最も信頼性が高い）
- ✅ モノレポとTurborepoに完全対応
- ✅ `vercel build`でTurboキャッシュを活用（ビルド高速化）
- ✅ `vercel deploy --prebuilt`で既にビルドされたアーティファクトをデプロイ（デプロイ時間短縮）

デプロイが成功すると、Vercel Dashboard上で新しいデプロイが確認できます。

### トラブルシューティング

#### エラー: "Error: No Project Settings found"

**原因**: プロジェクトIDまたは組織IDが正しくない。

**解決策**:
1. `.vercel/project.json`の値を再確認
2. GitHub Secretsの値を再設定
3. Vercel Dashboardでプロジェクトが存在するか確認

#### エラー: "Error: Authentication failed"

**原因**: VERCEL_TOKENが無効または権限不足。

**解決策**:
1. Vercel Dashboardで新しいトークンを生成
2. トークンのScopeが適切か確認
3. GitHub Secretsを更新

---

## Dockerレジストリ設定（将来の拡張用）

> **Note**: このセクションは将来のバックグラウンドジョブ実行アプリ（cron-worker）追加時に使用します。現在のプロジェクト構成では不要です。

CI/CDパイプラインでDockerイメージをビルド・プッシュするために必要なSecretsを設定します。

### 必要なSecrets

#### 1. DOCKER_REGISTRY

Dockerレジストリのホスト名。

#### 2. DOCKER_USERNAME

Dockerレジストリのユーザー名。

#### 3. DOCKER_PASSWORD

Dockerレジストリのパスワードまたはアクセストークン。

### 設定手順（GitHub Container Registry使用時）

GitHub Container Registry (ghcr.io) を使用する場合の手順です。

#### Step 1: Personal Access Tokenの作成

1. **GitHubにアクセス**
   - [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens) にアクセス

2. **新しいトークンを生成**
   - "Generate new token" > "Generate new token (classic)" をクリック
   - Note（トークン名）を入力（例: `einja-ghcr-token`）
   - Expirationを設定（90日推奨）
   - 以下のScopeを選択：
     - ✅ `write:packages` - パッケージのアップロード権限
     - ✅ `read:packages` - パッケージの読み取り権限
     - ✅ `delete:packages` - パッケージの削除権限（オプション）
   - "Generate token" をクリック
   - 生成されたトークンをコピー（**一度しか表示されません**）

#### Step 2: GitHub Secretsに登録

1. **GitHubリポジトリにアクセス**
   - リポジトリページを開く
   - "Settings" タブをクリック

2. **Secretsページに移動**
   - 左サイドバーの "Secrets and variables" > "Actions" をクリック

3. **各Secretを追加**

   | Name | Value | 例 |
   |------|-------|----|
   | `DOCKER_REGISTRY` | `ghcr.io` | `ghcr.io` |
   | `DOCKER_USERNAME` | GitHubユーザー名 | `your-github-username` |
   | `DOCKER_PASSWORD` | Step 1で取得したトークン | `ghp_xxxxxxxxxxxx` |

### 設定手順（Docker Hub使用時）

Docker Hubを使用する場合の手順です。

#### Step 1: Access Tokenの作成

1. **Docker Hubにログイン**
   - [Docker Hub](https://hub.docker.com/) にアクセス

2. **Access Tokenを生成**
   - Account Settings > Security > "New Access Token" をクリック
   - Access Token Descriptionを入力（例: `einja-ci-token`）
   - Access permissionsは "Read, Write, Delete" を選択
   - "Generate" をクリック
   - 生成されたトークンをコピー（**一度しか表示されません**）

#### Step 2: GitHub Secretsに登録

| Name | Value | 例 |
|------|-------|----|
| `DOCKER_REGISTRY` | `docker.io` | `docker.io` |
| `DOCKER_USERNAME` | Docker Hubユーザー名 | `your-dockerhub-username` |
| `DOCKER_PASSWORD` | Step 1で取得したトークン | `dckr_pat_xxxxxxxxxxxx` |

### 動作確認

mainブランチにマージすると、GitHub Actionsで以下のステップが実行されます：

```
Set up Docker Buildx
Login to Docker Registry
Build and Push Docker (cron-worker)
```

ビルドが成功すると、以下のイメージがプッシュされます：
- `{DOCKER_REGISTRY}/{DOCKER_USERNAME}/cron-worker:latest`
- `{DOCKER_REGISTRY}/{DOCKER_USERNAME}/cron-worker:{git-sha}`

GitHub Container Registryの場合、[Packages](https://github.com/your-org?tab=packages)で確認できます。

### トラブルシューティング

#### エラー: "denied: permission_denied"

**原因**: トークンの権限不足。

**解決策**:
1. Personal Access TokenのScopeを確認（`write:packages`が必要）
2. 新しいトークンを生成して再設定

#### エラー: "unauthorized: authentication required"

**原因**: DOCKER_USERNAMEまたはDOCKER_PASSWORDが正しくない。

**解決策**:
1. GitHub Secretsの値を再確認
2. トークンの有効期限を確認
3. Docker Hubの場合、ログイン情報を確認

---

## Railway デプロイ設定（将来の拡張用）

> **Note**: このセクションは将来のバックグラウンドジョブ実行アプリ（cron-worker）追加時に使用します。現在のプロジェクト構成では不要です。

バックグラウンドジョブ実行アプリをRailwayにデプロイし、Cronジョブを設定する手順です。

### 前提条件

- DockerイメージがGitHub Container Registry (ghcr.io) にプッシュ済みであること
- Railwayアカウントを作成済みであること

### 設定手順

#### Step 1: Railwayプロジェクトの作成

1. **Railwayにログイン**
   - [Railway Dashboard](https://railway.app/dashboard) にアクセス
   - GitHubアカウントでログイン

2. **新しいプロジェクトを作成**
   - "New Project" をクリック
   - "Deploy from GitHub repo" を選択
   - このリポジトリを選択

#### Step 2: cron-workerサービスの設定

1. **新しいサービスを追加**
   - "New" > "Service" > "Docker Image" を選択

2. **Dockerイメージを設定**
   - Image: `ghcr.io/{GITHUB_USERNAME}/cron-worker:latest`
   - 認証が必要な場合、GitHub Personal Access Tokenを設定

3. **環境変数を設定**
   - "Variables" タブで以下を設定：
     ```
     DATABASE_URL=postgresql://user:password@host:port/dbname
     REDIS_URL=redis://host:port
     NODE_ENV=production
     ```

4. **Cronジョブを設定**
   - "Cron" タブを開く
   - "Add Cron Job" をクリック

   **例: データクリーンアップジョブ（毎日深夜2時）**
   ```
   Schedule: 0 2 * * *
   Command: pnpm job:cleanup
   ```

   **例: メール配信ジョブ（毎時）**
   ```
   Schedule: 0 * * * *
   Command: pnpm job:email-digest
   ```

   **例: ヘルスチェック（5分毎）**
   ```
   Schedule: */5 * * * *
   Command: pnpm job:health-check
   ```

5. **デプロイを実行**
   - "Deploy" をクリックしてデプロイ開始

#### Step 3: デプロイの自動化（オプション）

GitHub ActionsからRailwayへの自動デプロイを設定する場合：

1. **Railway APIトークンを取得**
   - Railway Dashboard > Account Settings > Tokens
   - "Create Token" をクリック
   - トークンをコピー

2. **GitHub Secretsに登録**
   - `RAILWAY_TOKEN`: Step 1で取得したトークン
   - `RAILWAY_SERVICE_ID`: RailwayのサービスID（サービスページのURLから取得）

3. **CI/CDパイプラインに追加**

   `.github/workflows/ci.yml`の`deploy`ジョブに以下を追加：
   ```yaml
   - name: Deploy to Railway (cron-worker)
     run: |
       curl -X POST https://backboard.railway.app/graphql/v2 \
         -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
         -H "Content-Type: application/json" \
         -d '{
           "query": "mutation { serviceInstanceRedeploy(serviceId: \"${{ secrets.RAILWAY_SERVICE_ID }}\") { id } }"
         }'
   ```

### Cron設定一覧

以下は推奨されるCronジョブ設定です：

| ジョブ名 | スケジュール | コマンド | 説明 |
|---------|-------------|---------|------|
| データクリーンアップ | `0 2 * * *` | `pnpm job:cleanup` | 毎日深夜2時に実行 |
| メール配信 | `0 * * * *` | `pnpm job:email-digest` | 毎時0分に実行 |
| ヘルスチェック | `*/5 * * * *` | `pnpm job:health-check` | 5分毎に実行 |

### 動作確認

1. **Railwayダッシュボードで確認**
   - Deployments タブでデプロイ状況を確認
   - Logs タブでCronジョブの実行ログを確認

2. **手動実行でテスト**
   - Railway CLI をインストール：`npm i -g @railway/cli`
   - ログイン：`railway login`
   - プロジェクト選択：`railway link`
   - コマンド実行：`railway run pnpm job:health-check`

### トラブルシューティング

#### エラー: "Failed to pull Docker image"

**原因**: イメージへのアクセス権限不足。

**解決策**:
1. GitHub Container Registryのイメージを公開する、または
2. RailwayにGitHub Personal Access Tokenを設定

#### Cronジョブが実行されない

**原因**: コマンドが間違っているか、環境変数が設定されていない。

**解決策**:
1. Logsでエラーメッセージを確認
2. 環境変数が正しく設定されているか確認
3. 手動実行でコマンドをテスト

---

## 参考リンク

- [Turborepo Remote Caching Documentation](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Vercel Dashboard - Tokens](https://vercel.com/account/tokens)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub Access Tokens](https://docs.docker.com/docker-hub/access-tokens/)
- [Railway Documentation](https://docs.railway.app/)
- [Railway Cron Jobs](https://docs.railway.app/reference/cron-jobs)
- [GitHub Actions - Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
