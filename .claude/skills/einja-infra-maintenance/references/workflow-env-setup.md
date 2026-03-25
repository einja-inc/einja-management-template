# 環境セットアップ ワークフロー定義

環境セットアップモードの全ステップを定義するワークフローファイル。
各ステップは共通インターフェースに従い、詳細手順は既存カテゴリファイルまたは `workflow-env-setup-steps.md` に委譲する。

## 目次

- [初期化: unexpected_events](#初期化-unexpected_events)
- [ステップ一覧](#ステップ一覧)
- [ステップ間の依存関係](#ステップ間の依存関係)
- [Step 1: ローカル環境セットアップ](#step-1-ローカル環境セットアップ)
- [Step 2: 環境変数設定](#step-2-環境変数設定)
- [Step 3: Docker & DB起動確認](#step-3-docker--db起動確認)
- [Step 4: ローカル環境起動確認](#step-4-ローカル環境起動確認)
- [Step 5: Vercelプロジェクト設定](#step-5-vercelプロジェクト設定)
- [Step 6: Neonプロジェクト設定](#step-6-neonプロジェクト設定)
- [Step 7: GitHub Secrets一括設定](#step-7-github-secrets一括設定)
- [Step 8: GitHub Actions初期設定](#step-8-github-actions初期設定)
- [Step 9: 各環境のデプロイ設定ファイル確認](#step-9-各環境のデプロイ設定ファイル確認)
- [Step 10: .env.keys秘密鍵ローテーション](#step-10-envkeys秘密鍵ローテーション)
- [Step 10.1: ローテーション後の再同期](#step-101-ローテーション後の再同期)
- [Step 11: デプロイ実行](#step-11-デプロイ実行)
- [Step 12: CI/CD監視・自動修復](#step-12-cicd監視自動修復)
- [Step 13: Playwright MCPでのアクセス確認](#step-13-playwright-mcpでのアクセス確認)
- [Step 14: 残作業洗い出し](#step-14-残作業洗い出し)
- [Step 15: 最終サマリー](#step-15-最終サマリー)

---

## 初期化: unexpected_events

ワークフロー開始時に以下を初期化する。各ステップ完了時に想定外の事態があれば追記し、Step 15 の最終サマリーで出力する。

```
unexpected_events = []
# 各ステップ完了後:
# 想定外の事態があれば unexpected_events に追記
# 例: unexpected_events.append("Step 6: Neonリージョン aws-ap-northeast-1 利用不可 → aws-ap-southeast-1 にフォールバック")
```

---

## ステップ一覧

| Step | 内容 | 参照先 | 必須/任意 | 完了条件 |
|------|------|--------|----------|---------|
| 1 | ローカル環境セットアップ（.env.keys取得、CLIツール、pnpm dev:setup） | category-1 | 必須 | `.env.keys`存在 & `pnpm dev:setup`成功 |
| 2 | 環境変数設定（個人トークン、デフォルトトークン適用） | category-2 + category-8 | 必須 | `.env.personal`存在 & トークン有効性検証パス |
| 3 | Docker & DB起動確認（docker compose up、マイグレーション） | workflow-env-setup-steps | 必須 | PostgreSQL起動 & マイグレーション成功 |
| 4 | ローカル環境起動確認（pnpm dev、各アプリへcurl、失敗時修正） | workflow-env-setup-steps | 必須 | 全アプリが200レスポンス |
| 5 | Vercelプロジェクト設定 | category-3 | スキップ可 | `vercel ls`で全アプリのプロジェクト表示 |
| 6 | Neonプロジェクト設定 | category-4 | スキップ可 | `neonctl branches list`で定常ブランチ表示 |
| 7 | GitHub Secrets一括設定 | category-5 | 条件付き必須 | `gh secret list`で必須Secrets全件表示 |
| 8 | GitHub Actions初期設定（ブランチ作成、保護ルール） | category-7 | スキップ可 | ブランチ保護設定完了 |
| 9 | 各環境のデプロイ設定ファイル確認（.env.*の存在・復号確認） | category-2 | 必須 | 全環境envファイル存在 & dotenvx復号可能 |
| 10 | .env.keys秘密鍵ローテーション | env-rotate-secrets.ts案内 | オプション | 新鍵でdotenvx復号成功 |
| 10.1 | （Step 10実行時のみ）ローテーション後の再同期 | category-5 + category-3 | Step 10時必須 | GitHub Secrets・Vercel環境変数が新鍵で更新済み |
| 11 | デプロイ実行（環境別手順で実行） | workflow-env-setup-steps | スキップ可 | push/トリガー成功 |
| 12 | CI/CD監視・自動修復 | workflow-env-setup-steps | Step 11時のみ | 全ワークフローsuccess or ユーザースキップ |
| 13 | Playwright MCPでのアクセス確認 | workflow-env-setup-steps | Step 11時のみ | 全URLで正常表示 |
| 14 | 残作業洗い出し（ヘルスチェック再実行） | category-6 | 必須 | 情報提供のみ |
| 15 | 最終サマリー（実行結果テーブル + 想定外事態 + 残作業） | workflow-env-setup-steps | 必須 | 出力完了 |

---

## ステップ間の依存関係

```
Step 1 ──→ Step 2 ──→ Step 3 ──→ Step 4
                                     │
              ┌──────────────────────┤
              ▼                      ▼
         Step 5〜8              Step 9
         (並列実行可、             │
          各々独立)               ▼
              │              Step 10 (オプション)
              │                  │
              │               Step 10.1 (Step 10時必須)
              │                  │
              └──────┬───────────┘
                     ▼
                  Step 11 (スキップ可)
                     │
                     ▼
                  Step 12 (Step 11時のみ)
                     │
                     ▼
                  Step 13 (Step 11時のみ)
                     │
                     ▼
                  Step 14
                     │
                     ▼
                  Step 15
```

**依存関係の要点:**
- Step 1〜4 は順序依存（直列実行）
- Step 5〜8 は互いに独立（並列実行可）。Step 4 完了後に開始
- Step 9 は Step 4 完了後に開始（Step 5〜8 とも並列可）
- Step 10 → 10.1 は厳密に直列。Step 10 を実行した場合のみ 10.1 が必須
- Step 11 は Step 5〜10.1 がすべて完了後に開始
- Step 12, 13 は Step 11 を実行した場合のみ
- Step 14, 15 は常に最後に実行

---

## Step 1: ローカル環境セットアップ

- **必須** ⬜
- **参照先:** → `references/category-1-local-setup.md` を参照して実行
- **完了条件:** `.env.keys` が存在する & `pnpm dev:setup` が成功する
- **スキップ条件:** なし（必須ステップ）

`category-1-local-setup.md` の手順に従い、`.env.keys` の取得、CLIツールのインストール、`pnpm dev:setup` を実行する。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 1: ...")
```

---

## Step 2: 環境変数設定

- **必須** ⬜
- **参照先:** → `references/category-2-env-variables.md` + `references/category-8-default-tokens.md` を参照して実行
- **完了条件:** `.env.personal` が存在する & トークン有効性検証がパスする
- **スキップ条件:** なし（必須ステップ）

`category-2-env-variables.md` で環境変数の設定を行い、`category-8-default-tokens.md` でデフォルトトークンを適用する。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 2: ...")
```

---

## Step 3: Docker & DB起動確認

- **必須** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-3` を参照して実行
- **完了条件:** PostgreSQL が起動している & マイグレーションが成功する

`workflow-env-setup-steps.md` の Step 3 セクションに従い、Docker Compose でコンテナを起動し、DBマイグレーションを実行する。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 3: ...")
```

---

## Step 4: ローカル環境起動確認

- **必須** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-4` を参照して実行
- **完了条件:** 全アプリが 200 レスポンスを返す

`workflow-env-setup-steps.md` の Step 4 セクションに従い、`pnpm dev` で各アプリを起動し、curl で疎通確認する。失敗時は修正を行う。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 4: ...")
```

---

## Step 5: Vercelプロジェクト設定

- **スキップ可** ⬜
- **参照先:** → `references/category-3-vercel.md` を参照して実行
- **完了条件:** `vercel ls` で全アプリのプロジェクトが表示される
- **スキップ条件:** AskUserQuestion で「Vercel設定をスキップしますか？」と確認。スキップ時は次のステップへ進む

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 5: ...")
```

---

## Step 6: Neonプロジェクト設定

- **スキップ可** ⬜
- **参照先:** → `references/category-4-neon.md` を参照して実行
- **完了条件:** `neonctl branches list` で定常ブランチが表示される
- **スキップ条件:** AskUserQuestion で「Neon設定をスキップしますか？」と確認。スキップ時は次のステップへ進む

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 6: ...")
```

---

## Step 7: GitHub Secrets一括設定

- **条件付き必須** ⬜
- **参照先:** → `references/category-5-github-secrets.md` を参照して実行
- **完了条件:** `gh secret list` で必須 Secrets が全件表示される
- **必須条件:** `.env.keys` が存在する場合は必須（AskUserQuestionでのスキップ確認を行わず、そのまま実行する）
- **スキップ条件:** `.env.keys` が存在しない場合のみスキップ可。スキップ時は `unexpected_events` に「Step 7: .env.keys が存在しないため GitHub Secrets 設定をスキップ。デプロイ時に DOTENV_PRIVATE_KEY_* 未設定エラーが発生する可能性あり」と記録する

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 7: ...")
```

---

## Step 8: GitHub Actions初期設定

- **スキップ可** ⬜
- **参照先:** → `references/category-7-github-actions.md` を参照して実行
- **完了条件:** ブランチ保護設定が完了している
- **スキップ条件:** AskUserQuestion で「GitHub Actions初期設定をスキップしますか？」と確認。スキップ時は次のステップへ進む

`category-7-github-actions.md` の手順に従い、ブランチ作成と保護ルールを設定する。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 8: ...")
```

---

## Step 9: 各環境のデプロイ設定ファイル確認

- **必須** ⬜
- **参照先:** → `references/category-2-env-variables.md` を参照して実行
- **完了条件:** 全環境の env ファイルが存在する & dotenvx で復号可能
- **スキップ条件:** なし（必須ステップ）

### 実行手順

1. 各環境ファイルの存在をチェック:
   ```bash
   for env in develop staging production preview; do
     [ -f ".env.$env" ] && echo "✅ .env.$env" || echo "❌ .env.$env（未作成）"
   done
   ```

2. **不在ファイルがある場合**: AskUserQuestionで確認
   - 選択肢:
     - **今すぐ作成する**: → `references/category-2-env-variables.md` の「環境別ファイル新規作成」フローを呼び出し
     - **スキップ（後で作成する）**: → 不在のまま次のステップへ進む（`unexpected_events` に記録）
     - **その他（自由入力）**

3. **既存ファイルの復号確認**: 存在するファイルについてdotenvxで復号可能か検証
   ```bash
   for env in develop staging production preview; do
     if [ -f ".env.$env" ]; then
       dotenvx decrypt -f ".env.$env" --stdout > /dev/null 2>&1 \
         && echo "✅ .env.$env 復号OK" \
         || echo "❌ .env.$env 復号失敗（.env.keysの鍵を確認）"
     fi
   done
   ```

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 9: ...")
```

---

## Step 10: .env.keys秘密鍵ローテーション

- **オプション** ⬜
- **参照先:** → `env-rotate-secrets.ts` の案内に従って実行
- **完了条件:** 新しい鍵で dotenvx 復号が成功する
- **スキップ条件:** AskUserQuestion で「秘密鍵ローテーションを実行しますか？」と確認。スキップ時は Step 11 へ進む

**注意:** Step 10 を実行した場合、Step 10.1（再同期）が必須となる。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 10: ...")
```

---

## Step 10.1: ローテーション後の再同期

- **Step 10 実行時は必須** ⬜
- **参照先:** → `references/category-5-github-secrets.md` + `references/category-3-vercel.md` を参照して実行
- **完了条件:** GitHub Secrets・Vercel 環境変数が新しい鍵で更新済み
- **実行条件:** Step 10 を実行した場合のみ。Step 10 をスキップした場合はこのステップもスキップ

`category-5-github-secrets.md` で GitHub Secrets を新鍵で更新し、`category-3-vercel.md` で Vercel 環境変数を新鍵で更新する。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 10.1: ...")
```

---

## Step 11: デプロイ実行

- **スキップ可** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-11` を参照して実行
- **完了条件:** push またはトリガーが成功する
- **スキップ条件:** AskUserQuestion で「デプロイを実行しますか？」と確認。スキップ時は Step 14 へ進む
- **前提条件:** Step 5〜10.1 がすべて完了していること

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 11: ...")
```

---

## Step 12: CI/CD監視・自動修復

- **Step 11 実行時のみ** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-12` を参照して実行
- **完了条件:** 全ワークフローが success、またはユーザーがスキップを選択
- **実行条件:** Step 11 を実行した場合のみ

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 12: ...")
```

---

## Step 13: Playwright MCPでのアクセス確認

- **Step 11 実行時のみ** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-13` を参照して実行
- **完了条件:** 全 URL で正常表示が確認できる
- **実行条件:** Step 11 を実行した場合のみ

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 13: ...")
```

---

## Step 14: 残作業洗い出し

- **必須** ⬜
- **参照先:** → `references/category-6-health-check.md` を参照して実行
- **完了条件:** 情報提供のみ（ヘルスチェック結果を出力）
- **スキップ条件:** なし（必須ステップ）

`category-6-health-check.md` のヘルスチェックを再実行し、残作業を洗い出す。結果は Step 15 のサマリーに含める。

```
# 完了後: 想定外の事態があれば記録
# unexpected_events.append("Step 14: ...")
```

---

## Step 15: 最終サマリー

- **必須** ⬜
- **参照先:** → `references/workflow-env-setup-steps.md#step-15` を参照して実行
- **完了条件:** サマリー出力が完了する
- **スキップ条件:** なし（必須ステップ）

`workflow-env-setup-steps.md` の Step 15 セクションに従い、以下を出力する:

1. **実行結果テーブル:** 各ステップの完了状態（✅完了 / ⏭️スキップ / ❌失敗）
2. **想定外事態リスト:** `unexpected_events` の全内容を出力
3. **残作業リスト:** Step 14 のヘルスチェック結果に基づく残作業

```
# unexpected_events の全内容を出力
for event in unexpected_events:
    print(event)
```
