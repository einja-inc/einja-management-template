# カテゴリ2: 環境変数管理

## サブメニュー
- **個人トークン設定**: `.env.personal`にトークンを保存
- **チーム共有設定変更**: `.env.local`等の復号→編集→再暗号化
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
1. AskUserQuestionで対象ファイルを選択（.env.local / .env.develop / .env.production / .env.preview）
2. `dotenvx decrypt -f <file> --stdout > <file>.tmp`
3. 変更内容をAskUserQuestionで確認
4. 編集実行
5. `cp <file> <file>.bak && mv <file>.tmp <file> && rm <file>.bak`
6. `dotenvx encrypt -f <file>`
7. コミット案内

### 新規環境変数追加
1. AskUserQuestionで変数名・用途・対象環境（local/develop/production/preview）を確認
2. 対象環境に応じた`.env.*`ファイルを特定
3. 暗号化ファイルの場合: チーム共有設定変更と同じフロー（decrypt→編集→encrypt）
4. 非暗号化ファイルの場合（.env/.env.personal）: 直接編集
5. AskUserQuestion: 他環境への展開が必要か確認
6. コミット案内（チーム共有設定の場合）

> **詳細手順**: `docs/einja/instructions/environment-setup.md`の「新規環境変数を追加するとき」を参照

## 参照ドキュメント
- `docs/einja/instructions/environment-setup.md`
