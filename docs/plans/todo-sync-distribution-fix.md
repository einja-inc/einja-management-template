# TODO: sync配布漏れ一括修正

## Part A: dev-cli 側
- [x] A1. `file-filter.ts` に `claude-md` カテゴリを追加
- [x] A2. `category-validator.ts` に不足カテゴリを追加
- [x] A3. `sync.ts` でプレースホルダー展開を処理
- [x] A4. dev-cli テスト更新

## Part B: create-einja-app 側
- [x] B1. `CATEGORY_PATTERNS` にファイルを追加
- [x] B2. `CATEGORY_CONFIGS` も同期
- [x] B3. `.vscode/**` の矛盾を解消
- [x] B4. `AGENTS.md` を dev-cli 管轄に移管

## Part C: einja-sync.md コマンド定義を更新
- [x] C1. dev-cli カテゴリ一覧テーブル更新
- [x] C2. create-einja-app カテゴリ一覧テーブル更新

## Part D: ドキュメント整備
- [x] D1. dev-cli README.md の sync カテゴリ一覧を更新
- [x] D2. dev-cli README.md に「管轄境界」セクションを追加
- [x] D3. create-einja-app README.md の除外リストを更新
- [x] D4. einja-sync.md コマンド定義（Part C と統合）
- [x] D5. `cli-package-specs` Skill に sync カテゴリ仕様・管轄境界を追記
- [x] D6. CLAUDE.md のキーワードトリガーに sync 関連キーワードを追加

## 検証
- [x] V1. `pnpm --filter @einja/dev-cli test` 通過 (622 passed)
- [x] V2. `pnpm --filter create-einja-app test` 通過 (108 passed)
- [x] V3. `pnpm prepush` 通過 (7 tasks successful)
