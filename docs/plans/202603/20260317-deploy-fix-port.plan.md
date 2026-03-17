# Plan: 下流PR #174のデプロイ修正をテンプレートにポート

## Context

下流リポジトリ (drlove_demo_app) のPR #174で修正されたdevelopデプロイ失敗の3つの問題が、テンプレートリポジトリにも同様に存在する。Neon Postgresのpooler URL経由でPrisma migrate deployがadvisory lock timeoutで失敗する問題、Vercel deployのURL取得が不安定な問題、alias設定時の空URLガード欠如の問題。

## 現状

### prisma.config.ts（8行）
- `datasource.url` 未設定。Prisma CLIは `DATABASE_URL` をそのまま使用
- pooler URL（`-pooler.`含む）が設定されるとmigrate deployが失敗する

### .github/actions/migrate/action.yml（40行）
- `dotenvx run → pnpm db:migrate:deploy` のシンプル構成（turbo経由）
- seedは別ステップ（`run-seed` inputで制御）— 下流と構造が異なる
- pooler検出・DIRECT_URL導出・retryなし

### turbo.json — db:migrate:deploy
- `passThroughEnv: ["DATABASE_URL"]` のみ。`DIRECT_URL` は未登録
- Turbo strict modeでは未登録の環境変数は子タスクに渡らない

### .github/workflows/deploy-stable-branches.yml
- `vercel deploy` 3箇所（develop L242, staging L336, production L594）
- すべて `DEPLOY_URL=$(vercel deploy ...)` パターン — stdoutにログ混在時に失敗
- alias設定にガードなし（develop L249, staging L343の2箇所）

### .github/workflows/deploy-pr-preview.yml
- L300にも同一の `DEPLOY_URL=$(vercel deploy ...)` パターンあり
- ただしL317-326に `Save deploy URL` ステップでフォールバック処理済み（alias URL優先）

## 変更内容

### 修正1: `packages/server-core/prisma.config.ts`
`DIRECT_URL` 環境変数があればそちらを優先するよう `datasource.url` を追加。
```ts
const prismaCliUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
```
JS側で `||` フォールバックするため、`DIRECT_URL` 未設定時は `DATABASE_URL` が使われる。Prisma CLIの `env()` ではなくNode.jsの `process.env` を使うため未設定時に例外は発生しない。

### 修正2: `turbo.json` — passThroughEnvに`DIRECT_URL`追加
`db:migrate:deploy` と `db:migrate` の `passThroughEnv` に `DIRECT_URL` を追加。Turbo経由でも `DIRECT_URL` が子タスクに渡るようにする。
```json
"db:migrate:deploy": {
  "dependsOn": ["generate", "^generate"],
  "cache": false,
  "passThroughEnv": ["DATABASE_URL", "DIRECT_URL"]
},
"db:migrate": {
  "cache": false,
  "passThroughEnv": ["DATABASE_URL", "DIRECT_URL"]
}
```

### 修正3: `.github/actions/migrate/action.yml`
migrate deployステップに以下を追加:
- DATABASE_URLに`-pooler.`が含まれる場合、direct URLを導出して`DIRECT_URL`としてexport
- pgbouncer=true除去はbash parameter expansionで3パターン対応（下流PR #174と同じ手法）:
  ```bash
  direct_url="${direct_url//pgbouncer=true&/}"  # 中間パラメータ
  direct_url="${direct_url//&pgbouncer=true/}"  # 末尾パラメータ
  direct_url="${direct_url//?pgbouncer=true/}"  # 唯一のパラメータ
  ```
- migrate deployを最大3回retry（advisory lock timeout対策、5秒間隔）
- seedステップは変更なし（テンプレート独自のrun-seed分離を維持）

### 修正4: `.github/workflows/deploy-stable-branches.yml`（3箇所+2箇所）
**URL取得安定化（3箇所）:**
- develop L242, staging L336, production L594
- `DEPLOY_URL=$(vercel deploy ...)` → `vercel deploy ... > deployment-url.txt` + `DEPLOY_URL=$(tail -n 1 deployment-url.txt)`
- 空URL時の `exit 1` ガード追加

**aliasガード追加（2箇所）:**
- develop L249, staging L343
- `if: steps.deploy.outputs.url != ''` ガード追加
- productionにはaliasがないため不要

### PR previewは今回スコープ外
`deploy-pr-preview.yml` のL300にも同パターンがあるが、L317-326に `Save deploy URL` ステップでフォールバック処理（alias URL優先→なければdeploy URL）が既にあるため、影響は軽微。別PRで対応可能。

## タスク概要

| ID | 内容 | 依存 | 対象ファイル |
|----|------|------|-------------|
| 0-0 | タスク登録 | - | - |
| 0-1 | Planリネーム → `docs/plans/202603/20260317-deploy-fix-port.plan.md` | 0-0 | - |
| 1 | `prisma.config.ts` DIRECT_URL対応 [サブエージェント] | 0-1 | `packages/server-core/prisma.config.ts` |
| 2 | `turbo.json` passThroughEnv追加 [サブエージェント] | 0-1 | `turbo.json` |
| 3 | `migrate/action.yml` pooler検出+retry [サブエージェント] | 0-1 | `.github/actions/migrate/action.yml` |
| 4 | `deploy-stable-branches.yml` URL取得安定化 [サブエージェント] | 0-1 | `.github/workflows/deploy-stable-branches.yml` |
| 99-1 | コードレビュー [einja-review-code] | 1,2,3,4 | - |
| 99-G | コミット承認ゲート [AskUserQuestion] | 99-1 | - |
| 99-3 | コミット・プッシュ [einja-task-commit] | 99-G | - |

## 並列実行計画

タスク1, 2, 3, 4は全て異なるファイルのため完全並列。

```
0-0 → 0-1 → [1, 2, 3, 4] (並列) → 99-1 → 99-G → 99-3
```

## リスク・不明点

- **pooler URL bash pattern**: 下流PR #174と同じ3パターンのbash parameter expansionで対応。`sed` は使わない
- **DIRECT_URL Turbo透過**: `turbo.json` の `passThroughEnv` に追加することで解決
- **DIRECT_URL未設定時**: `process.env.DIRECT_URL || process.env.DATABASE_URL` でJS側フォールバック。Prismaの `env()` ではないため例外は発生しない
- **matrix jobのファイル競合**: matrix jobは別runnerで実行されるため `deployment-url.txt` の競合は発生しない
- **PR preview workflowは今回スコープ外**: 既存のフォールバック処理で軽減済み。別PRで対応可能
- **prisma.config.tsの既存変更**: git statusでModified状態。現在の変更内容を確認し整合させる

## 検証・動作確認方法

1. `pnpm generate` でPrisma Client生成（prisma.config.tsの構文・設定検証）
2. pooler URL変換のbash patternテスト（echo + parameter expansion）
3. YAML構文検証
4. `pnpm prepush` で全体の整合性確認
5. 下流で既にPR #174として実環境検証済み
