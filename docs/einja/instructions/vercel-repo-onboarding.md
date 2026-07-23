<!-- @einja:managed:start -->
# Vercel 新リポ追加 オンボーディング手順

> **現状ステータス（2026-07 時点）**
> 複数リポジトリを紐付けない運用方針に変更したため、本手順のうち「GitHub App の Selected repositories 確認」「既存プロジェクト横断の接続維持確認」などマルチリポ横断のチェック項目は、現状の構成では対象外です。新リポ追加時の基本手順・検証項目は引き続き参照可能です。背景は [Vercel GitHub連携 設計方針](../steering/infrastructure/vercel-git-integration.md) を参照してください。

## 概要

このドキュメントでは、既存のVercelチームに新しいGitHubリポジトリを追加する際の安全な手順とチェックリストを提供します。

設計方針と背景については [Vercel GitHub連携 設計方針](../steering/infrastructure/vercel-git-integration.md) を参照してください。

---

## 1. 事前確認チェックリスト

新リポを追加する**前に**必ず実施する確認事項です。

- [ ] **GitHub App のリポジトリアクセス範囲を確認**
  - 確認URL: `https://github.com/organizations/<org>/settings/installations`
  - Vercel App → Configure → Repository access
  - 「All repositories」であれば追加作業不要
  - 「Only select repositories」の場合、以下の全リポが含まれているか確認
  - ⚠️ この設定は全Vercelチームに影響する

- [ ] **既存プロジェクトの接続状態を記録**
  - 各プロジェクトの Settings > Git > Connected Git Repository を確認
  - 「Project link not found」が表示されているプロジェクトがないか確認
  - 確認コマンド例（Vercel API）:
    ```bash
    # 全プロジェクトのGit接続状態を一覧取得
    curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
      "https://api.vercel.com/v9/projects?teamId=$VERCEL_TEAM_ID" \
      | jq '.projects[] | {name: .name, repo: .link.repo, type: .link.type}'
    ```

- [ ] **Deploy Hook の一覧をバックアップ**
  - 各プロジェクトの Settings > Git > Deploy Hooks を記録
  - Git切断時に全削除されるため、事前記録が復旧の鍵
  - Vercel API では Deploy Hook の一覧取得は直接サポートされていないため、Dashboard からの目視確認を推奨

---

## 2. 新リポ追加手順

### Step 1: GitHub側の準備

1. リポジトリが `einja-dev` org（またはVercelと連携しているorg）に存在することを確認
2. GitHub App の「Only select repositories」設定の場合、新リポを追加:
   - `https://github.com/organizations/<org>/settings/installations` → Vercel App → Configure
   - Repository access → 新リポにチェック → Save

### Step 2: Vercelプロジェクト作成

1. Vercel Dashboard → New Project
2. Import Git Repository → 対象orgから新リポを選択
3. Framework Preset、Root Directory、Build Settings を設定
4. 環境変数を設定

### Step 3: Git接続の確認

1. Project → Settings → Git → Connected Git Repository
2. 正しいリポジトリが表示されていることを確認
3. 「Project link not found」が**表示されていない**ことを確認

### Step 4: 初期設定

1. `vercel.json` に `"git": { "deploymentEnabled": false }` を追加（GitHub Actions経由でデプロイする場合）
2. Deploy Hooks を作成（必要な場合）
3. GitHub Secrets にVercel関連の値を追加:
   - `VERCEL_PROJECT_ID_<SUFFIX>` （命名規則: `upper(app-name).replace('-','_')`）
4. `.github/workflows/deploy.yml` にデプロイジョブを追加

---

## 3. 追加後の検証チェックリスト

新リポ追加**直後**に全項目を確認します。

- [ ] **新リポのプロジェクトが正しくリンクされている**
  - Settings > Git > Connected Git Repository に正しいリポが表示される

- [ ] **既存プロジェクトの接続が維持されている**
  - ⚠️ 特に「Only select repositories」設定の場合は必ず確認
  - 事前に記録した全プロジェクトの接続状態と照合
  - API確認例:
    ```bash
    curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
      "https://api.vercel.com/v9/projects?teamId=$VERCEL_TEAM_ID" \
      | jq '.projects[] | select(.link.type == null) | .name'
    # → Git接続がないプロジェクト名が出力される（空であればOK）
    ```

- [ ] **各環境のデプロイが動作する**
  - develop ブランチ push → Deploy Hook or 自動デプロイが発火
  - main ブランチ push → Production デプロイが発火

- [ ] **Deploy Hook が生存している**（Deploy Hook利用プロジェクトの場合）
  - Settings > Git > Deploy Hooks に設定が残っていることを確認
  - `curl -X POST "<deploy-hook-url>"` で 200 が返ることを確認（404 は Hook 無効化を示す）

- [ ] **PR Preview デプロイが動作する**
  - テスト PR を作成し、Preview デプロイが生成されることを確認

---

## 4. 定期確認チェックリスト（月次推奨）

Git連携の問題は**静かに進行**し、次回デプロイ試行時まで検知できません。
以下を月次で確認することを推奨します。

- [ ] **全プロジェクトのGit接続状態を確認**
  ```bash
  # Git接続が切れているプロジェクトを検出
  curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects?teamId=$VERCEL_TEAM_ID" \
    | jq '[.projects[] | select(.link == null or .link.type == null)] | length'
  # → 0 であれば全プロジェクト正常
  ```

- [ ] **Deploy Hook の生存確認**
  - 各プロジェクトの Deploy Hook URL に対して `curl -X POST` で 200 を確認
  - 404 が返る場合は Deploy Hook が無効化されている

- [ ] **GitHub App のリポジトリアクセス範囲を確認**
  - `https://github.com/organizations/<org>/settings/installations`
  - Vercelチームで使用する全リポがアクセス可能であることを確認

<!-- TODO: einja-infra-maintenance Skill に定期確認を組み込む。上記のAPI確認コマンドをSkill化し、定期実行（月次cron）で自動検知する。 -->

---

## 5. トラブルシューティング

### 「Project link not found」が表示される

1. GitHub App Install の状態を確認
   - `https://github.com/organizations/<org>/settings/installations` → Vercel App
   - 対象リポがアクセス可能か確認
2. リポがアクセス可能なのに表示される場合は、Layer 3 の再接続が必要:
   - Settings > Git > Reconnect ボタン
   - **⚠️ Deploy Hooks は再接続後に消失するため、事前にバックアップ**

### 既存プロジェクトの接続が切れた

1. GitHub App の Repository access 設定を確認
2. 対象リポがリストから外れていないか確認
3. 外れている場合は追加し、各プロジェクトで Reconnect
4. Deploy Hooks を再作成し、ワークフローの URL を更新

### Deploy Hook が消失した

1. Settings > Git > Deploy Hooks セクションを確認
2. 新規にDeploy Hookを作成（ブランチ名を正確に指定）
3. `.github/workflows/deploy.yml` のcurl URLを新URLに更新
4. push して動作確認

詳細な復旧手順は [Vercel GitHub連携 設計方針 - 復旧手順](../steering/infrastructure/vercel-git-integration.md#4-復旧手順) を参照してください。

---

## 関連ドキュメント

- [Vercel GitHub連携 設計方針](../steering/infrastructure/vercel-git-integration.md)
- [デプロイセットアップ手順](./deployment-setup.md)
- [Vercel CLI/APIリファレンス](./vercel-cli-reference.md)
- [デプロイメント・CI/CD設計方針](../steering/infrastructure/deployment.md)
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="vercel-repo-onboarding-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
