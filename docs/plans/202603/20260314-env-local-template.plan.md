# .env.local テンプレート配布と鍵管理フロー整備

## Context

新プロジェクト作成時に `.env.local`（暗号化済みローカルdev設定）が配布されず、`pnpm dev` が毎回 `.env.example` フォールバックで動いている。テンプレートリポジトリには既に `.env.local` が存在するので、create-app テンプレートに含める。`.env.keys`（秘密鍵）はテンプレートには含めず、システム管理者が手動で渡す運用とする。下流プロジェクトでは鍵ローテーション必須。

### `.env.local` を復号不可の状態で配布する意義
- `.env.keys` なしでも `pnpm dev` は `.env.example` フォールバックで動作（現状と同じ）
- 管理者から `.env.keys` を受け取った瞬間、追加設定なしで `.env.local` → `.env` の正規フローが有効になる
- `pnpm env:rotate-secrets` 実行時に `.env.local` が既に存在するため、鍵ローテーション → 再暗号化がスムーズに完了する
- 暗号化体制の「雛形」が最初から存在することで、チームの環境変数管理が標準化される

## 現状

- テンプレートリポジトリ: `.env.local`（暗号化済み、Git追跡）+ `.env.keys`（全環境の秘密鍵）がある
- `packages/create-app/templates/default/`: `.envrc` のみ。`.env.local` は含まれていない
- `packages/cli/scripts/copy-presets.mjs`: `.env.*` は `knownIgnoreList` に入っており意図的にコピーしない（sync時は上書きしない設計）
- 新プロジェクト: `.env.local` なし → `pnpm dev` が `.env.example` フォールバック → 動くが暗号化体制が未構築
- `scripts/setup-dev.ts`: `.env.keys` の有無チェック・ガイダンスなし

## 変更内容

### 1. `.env.local` をcreate-appテンプレートに追加
- `packages/create-app/templates/default/.env.local` — テンプレートリポジトリの `.env.local` をコピー
- `template.ts` のフィルター確認 — `.env`（完全一致）のフェイルセーフが `.env.local` をブロックしないことを確認

### 2. `dev:setup` に `.env.keys` ガイダンスを追加
- `scripts/setup-dev.ts` の **Step 6（dotenvxインストール）の後、Step 7（個人用トークン設定）の前** に新しいStepとして追加
- `.env.keys` の存在チェック:
  - 存在しない場合:「システム管理者から .env.keys を受け取ってください。受け取り後 pnpm env:rotate-secrets で鍵をローテーションしてください」とガイダンス表示
  - 存在する場合: スキップ

### 3. `.env.keys` はテンプレートに含めない
- セキュリティ上、npm パッケージに秘密鍵を含めない
- 管理者が手動で渡す運用フロー

### 対象ファイル
1. `packages/create-app/templates/default/.env.local` — 新規作成（テンプレートからコピー）
2. `packages/create-app/src/generators/template.ts` — フィルター確認・必要に応じ修正
3. `scripts/setup-dev.ts` — `.env.keys` チェック＆ガイダンス追加

### 注意事項
- CLI sync (`copy-presets.mjs`) は変更不要 — `.env.*` は既にknownIgnoreListに入っており、既存プロジェクトへの上書きは発生しない
- `.env.local` が配布されても `.env.keys` がないと復号できない → `pnpm dev` は `.env.example` フォールバックで動作（既存動作と同じ）
- `.env.keys` を管理者から受け取った後、`pnpm env:rotate-secrets` で鍵ローテーション → 新プロジェクト固有の鍵ペアになる

## タスク概要

| ID | 内容 | 依存 | Skill/ツール |
|----|------|------|-------------|
| 0-0 | TaskCreate一括登録 | - | [TaskCreate] |
| 0-1 | Planファイルリネーム | - | [Bash] |
| 1 | `.env.local` をcreate-appテンプレートにコピー（暗号化済み内容の安全性確認含む） | - | [Bash/Read] |
| 2 | `template.ts` のフィルター確認・必要に応じ修正 | - | [Read/Edit] |
| 3 | `setup-dev.ts` に `.env.keys` チェック＆ガイダンス追加 | - | [Edit] |
| 99-1 | コードレビュー | 1,2,3 | [einja-review-code] |
| 99-2 | 動作確認: create-appビルド → テスト実行 | 99-1 | [Bash] |
| 99-G | コミット承認ゲート | 99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

タスク1, 2, 3 は独立しており並列実行可能。

## リスク・不明点

- `.env.local` だけ配布して `.env.keys` がない状態 → `pnpm dev` の `.env.example` フォールバックで問題なく動作
- 管理者が `.env.keys` を渡す運用フローのドキュメント → `dev:setup` のガイダンスメッセージで対応

## 検証・動作確認方法

- create-app のテストスイートが通ること
- テンプレートから新プロジェクト作成時に `.env.local` が配置されることを確認
- `dev:setup` 実行時に `.env.keys` がない場合のガイダンスメッセージが表示されることを確認
- `pnpm env:rotate-secrets` が `.env.local` + `.env.keys` の組み合わせで正しく動作することを確認（既存機能の動作確認）

## レビュー結果

- レビュアー1（Planレビュー）: MAJOR → 4件指摘 → 全件反映済み
- レビュアー2（codex-agent）: PASS — `template.ts` フィルター、`copy-presets.mjs` 影響なし確認済み
