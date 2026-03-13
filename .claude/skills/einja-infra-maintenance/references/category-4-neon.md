# カテゴリ4: Neon管理

## サブメニュー
- **初期設定**: プロジェクト作成・ブランチ戦略初期化
- **ブランチ管理**: 一覧表示・作成・削除
- **接続文字列取得**: 特定ブランチの接続URLを取得
- **プロジェクトID取得**: 既存プロジェクトのIDを `neonctl projects list` で自動取得

## 実行手順

> **非対話モードの必須オプション**: 複数のOrganizationに所属している場合、`--org-id $NEON_ORG_ID` を指定しないと対話プロンプトでスタックする。`$NEON_ORG_ID` は `.env.personal` から取得する。

### 初期設定
1. NEON_API_KEY確認 → 未設定時はURL案内 + `.env.personal`保存
   - 取得URL: https://console.neon.tech/app/settings/api-keys
   - **`neonctl auth`は使用しない**（理由: `docs/einja/instructions/neon-cli-reference.md`「認証方式」参照）→ `--api-key`フラグまたは`NEON_API_KEY`環境変数で認証

2. **既存プロジェクトの確認**:
   ```bash
   neonctl projects list --api-key $NEON_API_KEY --org-id $NEON_ORG_ID
   ```
   既存プロジェクトがあれば一覧表示し、使用するプロジェクトをAskUserQuestionで確認。
   既存プロジェクトを使用する場合 → `neonctl projects get $PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID` でIDを取得してステップ4へ。

3. **プロジェクト名の推定・確認・作成**:
   共通推定ロジック（カテゴリ3と同様）で `$BASE_NAME` を取得。AskUserQuestionで確認（デフォルト値として提示）。
   ```bash
   neonctl projects create --name "$NEON_PROJECT_NAME" --region-id aws-ap-northeast-1 --api-key $NEON_API_KEY --org-id $NEON_ORG_ID
   ```
   > **リージョン選択**: `aws-ap-northeast-1`（東京）が利用不可の場合（プランによる制限）、最寄りの `aws-ap-southeast-1`（シンガポール）をフォールバックとして使用する。利用可能なリージョンは `neonctl regions list --api-key $NEON_API_KEY` で確認できる。

   作成後、`neonctl projects list` でプロジェクトIDを取得:
   ```bash
   NEON_PROJECT_ID=$(neonctl projects list --api-key $NEON_API_KEY --org-id $NEON_ORG_ID --output json | jq -r ".[] | select(.name==\"$NEON_PROJECT_NAME\") | .id")
   ```

4. **`.env.preview` に自動設定** → dotenvx暗号化:
   ```bash
   dotenvx decrypt -f .env.preview --stdout > .env.preview.tmp
   # 既存の同名変数を削除してから追加（重複防止）
   grep -v "^NEON_PROJECT_ID=" .env.preview.tmp | grep -v "^NEON_API_KEY=" > .env.preview.clean
   echo "NEON_PROJECT_ID=$NEON_PROJECT_ID" >> .env.preview.clean
   echo "NEON_API_KEY=$NEON_API_KEY" >> .env.preview.clean
   cp .env.preview .env.preview.bak && mv .env.preview.clean .env.preview && rm .env.preview.bak
   dotenvx encrypt -f .env.preview
   ```

5. ブランチ戦略初期設定:
   - production（main）ブランチ確認
   - developmentブランチ作成

### ブランチ管理
```bash
# 一覧
neonctl branches list --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID

# 作成
neonctl branches create --project-id $NEON_PROJECT_ID --name $NAME --api-key $NEON_API_KEY --org-id $NEON_ORG_ID

# 削除
neonctl branches delete $BRANCH_ID --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID
```

### 接続文字列取得
```bash
# CLI（単一ブランチ）
neonctl connection-string <branch-name> --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID

# API（複数ブランチ一括取得時）
curl -s "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&database_name=neondb&role_name=$ROLE_NAME" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

> **pooled/unpooled接続の使い分け**:
> - **マイグレーション用（unpooled）**: `neonctl connection-string <branch> --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID`（デフォルトはpooled=false）
> - **アプリruntime用（pooled）**: `neonctl connection-string <branch> --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY --org-id $NEON_ORG_ID --pooled`
> - CI/CDワークフローではマイグレーション時にunpooled、アプリビルド時にpooled接続を使い分けている

> **注意**: 孤立ブランチのクリーンアップは`cleanup-pr-preview-db.yml`ワークフローが自動実行するため、このSkillでは手動クリーンアップを提供しない。

## 参照ドキュメント
- `docs/einja/instructions/neon-cli-reference.md`
- `docs/einja/instructions/deployment-setup.md`
