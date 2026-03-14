# Plan: 下流リポジトリ向け `.env.{環境名}` 初回セットアップ自動化

## Context

`create-app init` で生成された下流リポジトリでは `.env.local` のみがテンプレートから配布される。`.env.develop` / `.env.production` 等の環境別ファイルは開発者が自分で作成する必要があるが、その手順がどこにも明確に記載されていない。

ユーザーの構想: `.env.{環境名}` が不在の場合に初回セットアップモードに入り、`.env.example` をベースに環境別ファイルを生成 → dotenvx暗号化 → インフラセットアップ → GitHub Secrets登録 → GitHub Actions修正まで一気通貫で自動化する。

## 現状

### テンプレート
- `.env.example` が**存在しない**（テンプレートに含まれていない）
- `.env.local` のみ配布（dotenvx暗号化済み、ローカル開発用）

### einja-infra-maintenance Skill
- **Phase 0**: `.env.keys` 不在のみ検出。`.env.{環境名}` 不在は検出対象外
- **Phase 1**: `.env.develop` / `.env.staging` / `.env.production` の存在をチェックしているが、不在時のアクションなし
- **category-2**: 環境別ファイルの新規作成フローがない
- **category-5**: GitHub Secrets一括設定は `.env.keys` 前提で動作（既に鍵がある前提）
- **workflow-env-setup.md Step 9**: 「確認」のみで、不在時の作成フローへの誘導なし

### ドキュメント
- `environment-setup.md` L178-207: `cat >` のサンプルがあるが dotenvx暗号化フローと分離

### スクリプト
- `scripts/lib/env-common.ts`: `ENVIRONMENTS` 配列に `staging` が未定義（`env-show.ts` では定義済み）
- `packages/create-app/templates/default/scripts/lib/env-common.ts`: テンプレート側も同様に `staging` なし

## 変更内容

### 変更1: `.env.example` をテンプレートに追加（優先: 高）

`packages/create-app/templates/default/.env.example` を新規作成。

内容: 平文のキー一覧（値はプレースホルダー）。`.env.local` から抽出したキー + デプロイ環境で必要なキーを網羅:
```
# === 共通（全環境） ===
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
AUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="https://your-domain.com"

# === ローカル専用（デプロイ環境では不要） ===
# PORT_WEB=3000
```

`create-app sync` の `ENV_FILE_PROTECTION.allowed` に `.env.example` が既に含まれているため、sync時もコピーされる。

**対象ファイル:**
- `packages/create-app/templates/default/.env.example`（新規作成）

### 変更2: Phase 0 を拡張 — `.env.{環境名}` 不在検出（優先: 高）

`SKILL.md` の Phase 0 フローチャートと実行フローを拡張。

現状: `.env.keys` 不在 → 環境セットアップモード提案
変更後:
1. `.env.keys` 不在 → 既存フロー（変更なし）
2. `.env.keys` 存在 + `.env.develop` / `.env.production` 等が不在 → **環境別ファイル初回セットアップモード提案**

初回セットアップモードのフロー:
1. `.env.example` をベースに対象環境を選択（AskUserQuestion: develop / staging / production / preview / 全部）
2. 選択環境ごとに `.env.example` → `.env.{環境名}` を生成
3. 環境固有値の入力案内（DATABASE_URL → Neon接続文字列、NEXTAUTH_URL → デプロイURL等）
4. `dotenvx encrypt -f .env.{環境名}` で暗号化（`.env.keys` に鍵が自動追加）
5. GitHub Secrets への `DOTENV_PRIVATE_KEY_*` 登録（→ カテゴリ5の一括設定フロー呼び出し）
6. GitHub Actions のワークフロー確認（→ カテゴリ7のリポジトリ設定フロー呼び出し）
7. コミット案内

**対象ファイル:**
- `.claude/skills/einja-infra-maintenance/SKILL.md` — Phase 0 のフローチャート・実行フロー拡張

### 変更3: category-2 に「環境別ファイル新規作成」サブメニュー追加（優先: 高）

`references/category-2-env-variables.md` に新しいサブメニューと実行手順を追加。Phase 0 からも直接呼び出せるように設計。

フロー:
1. AskUserQuestion で対象環境を確認（develop / staging / production / preview）
2. `.env.example` の存在確認（不在の場合は `.env.local` からキー抽出してフォールバック）
3. `.env.example` → tmp ファイルにコピー → 環境固有値を編集案内
4. tmp → `.env.{環境名}` に移動 → `dotenvx encrypt -f .env.{環境名}`
5. `.env.keys` 更新確認 → GitHub Secrets への鍵登録案内（カテゴリ5への誘導）
6. 既存サブメニュー「チーム共有設定変更」「新規環境変数追加」の環境一覧にも `staging` を追加

**対象ファイル:**
- `.claude/skills/einja-infra-maintenance/references/category-2-env-variables.md`

### 変更4: workflow-env-setup.md Step 9 — 不在時の作成誘導（優先: 中）

Step 9 の手順を拡充:
- 各環境ファイルの存在チェック
- 不在 → AskUserQuestion で「今すぐ作成するか」確認
- 作成する場合 → category-2 の「環境別ファイル新規作成」フローを呼び出し

**対象ファイル:**
- `.claude/skills/einja-infra-maintenance/references/workflow-env-setup.md`

### 変更5: `env-common.ts` に staging 追加 + テンプレート同期（優先: 中）

`ENVIRONMENTS` 配列に `staging` を追加。`env-show.ts` では既に定義済みのため整合性を確保する。

**三重管理の同期経路:**
- 原本: `scripts/lib/env-common.ts` — 直接編集
- テンプレート: `packages/create-app/templates/default/scripts/lib/env-common.ts` — 直接編集
- プリセット: `packages/cli/presets/default/scripts/lib/env-common.ts` — `copy-presets.mjs` で自動コピー（ビルド時）

**対象ファイル:**
- `scripts/lib/env-common.ts`
- `packages/create-app/templates/default/scripts/lib/env-common.ts`

### 変更6: `environment-setup.md` セクション3の書き換え（優先: 高）

L178「デプロイ環境ファイル作成」の `cat >` サンプルを dotenvx ワークフローベースの手順に置換。

手順:
1. 前提条件: `.env.keys` が存在すること（未取得の場合は `pnpm dev:setup` を先に実行）
2. `.env.example` をコピーして `.env.{環境名}` を作成: `cp .env.example .env.develop`
3. 環境固有の値を編集
4. `dotenvx encrypt -f .env.develop` で暗号化
5. 各環境について繰り返し
6. `.env.keys` を 1Password 等で共有・更新
7. GitHub Secrets に `DOTENV_PRIVATE_KEY_*` を登録

**対象ファイル:**
- `docs/einja/instructions/environment-setup.md`

### 変更7: post-setup.ts 完了メッセージ改善（優先: 低）

Next steps に環境別ファイル作成への案内を追加:
```
  pnpm env:update          # 環境変数を設定
  pnpm dev                 # PostgreSQL起動 + 開発サーバー起動

  # デプロイ環境を設定する場合:
  # .env.example を元に環境別ファイルを作成してください
  # 詳細: docs/einja/instructions/environment-setup.md
```

**対象ファイル:**
- `packages/create-app/src/generators/post-setup.ts`

## タスク概要

| ID | 内容 | 依存 | Skill/サブエージェント |
|----|------|------|----------------------|
| 0-0 | タスク登録 [TaskCreate] | - | 親エージェント |
| 0-1 | Planファイルリネーム [Bash] | 0-0 | 親エージェント |
| 0-2 | worktree作成 [_einja-worktree-guide] | 0-1 | 親エージェント |
| 1 | `.env.example` 新規作成（テンプレート） [general-purpose] | 0-2 | サブエージェント |
| 2 | SKILL.md Phase 0 拡張 [general-purpose] | 0-2 | サブエージェント |
| 3 | category-2 サブメニュー追加 [general-purpose] | 0-2 | サブエージェント |
| 4 | workflow-env-setup.md Step 9 拡充 [general-purpose] | 3（仕様参照） | サブエージェント |
| 5 | env-common.ts staging追加（原本+テンプレート） [general-purpose] | 0-2 | サブエージェント |
| 6 | environment-setup.md セクション3 書き換え [general-purpose] | 0-2 | サブエージェント |
| 7 | post-setup.ts 完了メッセージ改善 [general-purpose] | 0-2 | サブエージェント |
| 99-1 | コードレビュー [einja-review-code] | 1-7 | Skill |
| 99-G | コミット承認ゲート [AskUserQuestion] | 99-1 | 親エージェント |
| 99-3 | コミット・プッシュ [einja-task-commit] | 99-G | Skill |

## 並列実行計画

```
[0-0, 0-1, 0-2]
  → [1, 2, 3, 5, 6, 7] (並列可)
  → [4] (タスク3のcategory-2仕様を参照するため、3完了後)
  → [99-1] → [99-G] → [99-3]
```

## リスク・不明点

| リスク | 対策 |
|--------|------|
| `.env.example` のキー一覧が `.env.local` と乖離する可能性 | `.env.local` を復号してキー一覧を抽出し、`.env.example` のベースとする。ローカル専用キー（PORT_WEB等）はコメントアウトで区別 |
| staging環境の実使用有無 | `env-show.ts` L27で既に定義済み。`workflow-env-setup.md` でも言及あり。追加は整合性確保 |
| テンプレート側 `env-common.ts` が `copy-presets.mjs` 管轄外 | テンプレート側は直接編集が必要。原本とテンプレートの2ファイルを明示的に変更 |
| `post-setup.ts` のテスト影響 | 実装時にテストファイル有無を確認。テストがあれば更新 |

## 検証・動作確認方法

1. **`.env.example` 内容確認**: `.env.local` を復号してキー一覧と照合
2. **env-common.ts**: TypeScriptコンパイル通過、`pnpm env:update` で staging 選択可能
3. **ドキュメント整合性**: environment-setup.md の新手順がセクション4（暗号化手順）と矛盾しないこと
4. **prepush**: `pnpm prepush` でlint/型チェック通過
5. **Phase 0 フロー確認**: SKILL.md の mermaid フローチャートが論理的に正しいこと（目視確認）
