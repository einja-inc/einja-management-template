# カテゴリ2: 環境変数管理

## サブメニュー
- **個人トークン設定**: `.env.personal`にトークンを保存
- **チーム共有設定変更**: `.env.local`等の復号→編集→再暗号化
- **環境別ファイル新規作成**: `.env.example`をベースに`.env.{環境名}`を新規作成 → dotenvx暗号化
- **新規環境変数追加**: プロジェクト全体への変数追加フロー
- **環境変数の状態表示**: 現在の設定状態を表示

> **クイック操作**: `pnpm env:update` を実行すると、個人トークン設定・チーム共有設定変更を対話式ウィザードで実行できます。

## 実行手順

### 個人トークン設定
1. 必要なトークンをAskUserQuestionで確認:
   - `GITHUB_TOKEN`: https://github.com/settings/tokens/new
   - `VERCEL_TOKEN`: https://vercel.com/account/tokens
   - `NEON_API_KEY`: https://console.neon.tech/app/settings/api-keys
2. AskUserQuestionでトークン値を入力してもらう
3. `.env.personal`に保存
4. `chmod 600 .env.personal` 実行
5. API検証（可能な場合）:
   - GitHub: `gh auth status`
   - Vercel: `vercel whoami`
   - Neon: `neonctl projects list --api-key $NEON_API_KEY --org-id $NEON_ORG_ID`

### チーム共有設定変更
1. AskUserQuestionで対象ファイルを選択（.env.local / .env.develop / .env.staging / .env.production / .env.preview）
2. `dotenvx decrypt -f <file> --stdout > <file>.tmp`
3. 変更内容をAskUserQuestionで確認
4. 編集実行
5. `cp <file> <file>.bak && mv <file>.tmp <file> && rm <file>.bak`
6. `dotenvx encrypt -f <file>`
7. コミット案内

### 環境別ファイル新規作成

> Phase 0の環境別ファイル不在検出からも直接呼び出される。

1. AskUserQuestionで作成する環境を確認:
   - develop（開発環境）
   - staging（ステージング環境）
   - production（本番環境）
   - preview（プレビュー環境）
   - 全環境を一括作成
   - その他（自由入力）
2. `.env.example` の存在確認
   - 存在する場合: `.env.example` をベースとして使用
   - 不在の場合: `.env.local` を復号してキー一覧を抽出し、フォールバック
     ```bash
     # .env.localからキー一覧を抽出（値はプレースホルダーに置換）
     dotenvx decrypt -f .env.local --stdout | grep -v '^#' | grep '=' | cut -d= -f1
     ```
3. 対象環境ごとに以下を実行:
   a. `.env.example` → `.env.{環境名}` にコピー
      ```bash
      cp .env.example .env.develop
      ```
   b. AskUserQuestionで環境固有値の入力を案内:
      - `DATABASE_URL`: Neon接続文字列（`postgresql://user:pass@host/dbname?sslmode=require`）
      - `AUTH_SECRET`: `openssl rand -base64 32` で生成
      - `NEXTAUTH_URL`: デプロイ先のURL（例: `https://dev.example.com`）
      - ユーザーが直接エディタで編集することも可能
   c. `dotenvx encrypt -f .env.{環境名}` で暗号化
      ```bash
      dotenvx encrypt -f .env.develop
      ```
   d. `.env.keys` に秘密鍵が追加されたことを確認
4. 全環境の作成完了後:
   - GitHub Secrets への `DOTENV_PRIVATE_KEY_*` 登録を案内 → カテゴリ5への誘導
     ```
     「GitHub Secretsに秘密鍵を登録しますか？」
     → はい: references/category-5-github-secrets.md の一括設定フローを呼び出し
     → いいえ: スキップ
     ```
   - コミット案内
     ```bash
     git add .env.develop .env.staging .env.production .env.preview
     git commit -m "chore: 環境別設定ファイルを追加"
     ```

### 新規環境変数追加
1. AskUserQuestionで変数名・用途・対象環境（local/develop/staging/production/preview）を確認
2. 対象環境に応じた`.env.*`ファイルを特定
3. 暗号化ファイルの場合: チーム共有設定変更と同じフロー（decrypt→編集→encrypt）
4. 非暗号化ファイルの場合（.env/.env.personal）: 直接編集
5. AskUserQuestion: 他環境への展開が必要か確認
6. コミット案内（チーム共有設定の場合）

> **詳細手順**: `docs/einja/instructions/environment-setup.md`の「新規環境変数を追加するとき」を参照

## 参照ドキュメント
- `docs/einja/instructions/environment-setup.md`
