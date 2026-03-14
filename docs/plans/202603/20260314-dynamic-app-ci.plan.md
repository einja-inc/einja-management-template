# CI/CDワークフロー動的アプリ対応 + デプロイ検査セットアップモード

## Context

テンプレートリポジトリの `.github/workflows/` が `apps/web` と `apps/admin` をハードコードしており、`einja-dev-init` や `einja-dev-sync` で異なるアプリ構成（`apps/dashboard` 等）のプロジェクトに配布するとCIが失敗する。`apps/` ディレクトリ構成をSingle Source of Truthとして動的に検出する仕組みに変更する。

加えて、`einja-infra-maintenance` に「デプロイ検査・セットアップ」カテゴリを新設し、apps/構成検出 → 各インフラ（Vercel/Neon/GitHub Actions/Secrets/ブランチ保護）の整合性チェック → 不足分の自動セットアップを一気通貫で実行できるようにする。

## 現状

### ハードコード箇所一覧

| ファイル | ハードコード内容 |
|---------|---------------|
| `deploy-stable-branches.yml` | `dorny/paths-filter` の outputs/filters に `web`/`admin` 固定、マトリクス構築の if 文、`case` 文で `VERCEL_PROJECT_ID_WEB`/`ADMIN` を解決（develop/staging/production の3ジョブ分）、`VERCEL_ALIAS_DOMAIN_WEB`/`ADMIN` |
| `deploy-pr-preview.yml` | `matrix: app: [web, admin]` リテラル、`case` 文、アーティファクト名 `deploy-url-web.txt`/`deploy-url-admin.txt`、PRコメントのテーブル行 |
| `cleanup-pr-preview-on-close.yml` | `VERCEL_PROJECT_ID_WEB`/`ADMIN` の for ループ |
| Skills/Agents（配布物） | `einja-react-doctor`、`einja-create-pr`、`einja-infra-maintenance`、`frontend-coder`、`frontend-architect`、`backend-architect` に `apps/web` 固定参照 |

### 配布経路
- ワークフロー: `create-app` テンプレート経由（`einja-dev-sync` の `github` カテゴリ）。`dev-cli sync` では配布されない
- Skills/Agents: `dev-cli sync` の `skills`/`agents` カテゴリで配布

## 変更内容

### 方針決定事項
- **Secret解決**: matrix に `secret_suffix` を含め、`secrets[format()]` で直接参照（`toJSON(secrets)` は使用しない）
- **変更検知**: `dorny/paths-filter` を廃止し `git diff` ベース化。`.github/app-config.json` でpackages→app個別マッピング + `globalTriggers` を維持
- **アプリ検出**: `apps/*/package.json` の存在でアプリを動的検出。Vercelデプロイ対象は `app-config.json` の `deployTargets` で制御
- **Secret命名の正規化**: アプリ名 → Secret suffix の変換ルールを仕様化（`upper(name).replace(/[^A-Z0-9]/g, '_')`）

### 1. 設定ファイル `.github/app-config.json` の新設

```json
{
  "globalTriggers": [
    "package.json",
    "pnpm-lock.yaml",
    "turbo.json",
    "tsconfig.json",
    ".env.*",
    ".github/workflows/**"
  ],
  "shared-package-mapping": {
    "packages/ui": ["web"],
    "packages/admin-ui": ["admin"],
    "packages/shared": ["web", "admin"]
  },
  "deployTargets": {
    "web": { "vercel": true },
    "admin": { "vercel": true }
  }
}
```

- `globalTriggers`: これらのパスが変更されたら全アプリをデプロイ（`shared-package-mapping` と併用）
- `deployTargets`: Vercelデプロイ対象を明示。未記載アプリはデフォルト `vercel: true`（後方互換）
- ファイルが存在しない場合: packages/ 変更は全アプリをトリガー（安全フォールバック）
- `apps/` のスキャンは常に動的（設定ファイルにアプリ一覧は書かない）

### 2. 共通コンポジットアクション `.github/actions/discover-apps/action.yml` の新設

- `apps/*/package.json` をスキャンしてアプリ一覧を出力
- outputs:
  - `apps_json`: マトリクス用JSON配列。各要素に `app`（名前）と `secret_suffix`（正規化済みSecret名サフィックス）を含む
  - `apps_list`: スペース区切り
- Secret suffix の正規化ルール: `echo "$APP" | tr '[:lower:]' '[:upper:]' | tr '-' '_' | sed 's/[^A-Z0-9_]//g'`
  - 例: `web` → `WEB`、`admin` → `ADMIN`、`my-app` → `MY_APP`
- `app-config.json` の `deployTargets` を参照し、`vercel: false` のアプリはデプロイマトリクスから除外

出力例:
```json
[
  {"app": "web", "secret_suffix": "WEB"},
  {"app": "admin", "secret_suffix": "ADMIN"},
  {"app": "my-app", "secret_suffix": "MY_APP"}
]
```

### 3. `deploy-stable-branches.yml` の改修

- `changes` ジョブ:
  - `dorny/paths-filter` → `discover-apps` + `git diff` + `app-config.json` マッピング
  - `git diff` のベースコミット: `github.event.before` を使用。ただし force push / 初回push（`before` が `000...` or 空）の場合は**全アプリデプロイにフォールバック**
  - 差分計算失敗時は `::warning` を出力し全アプリデプロイ（静かに0件扱いにしない）
- `deploy-develop` / `deploy-staging` / `deploy-production` ジョブ:
  - `case` 文 → `secrets[format('VERCEL_PROJECT_ID_%s', matrix.secret_suffix)]` で直接Secret参照
  - `VERCEL_ALIAS_DOMAIN_*` も `format()` で動的化

Secret参照パターン:
```yaml
env:
  VERCEL_PROJECT_ID: ${{ secrets[format('VERCEL_PROJECT_ID_%s', matrix.secret_suffix)] }}
```

### 4. `deploy-pr-preview.yml` の改修

- `matrix: app: [web, admin]` → `discover-apps` の出力（`secret_suffix` 含む）を使用
- `case` 文 → `secrets[format()]` でSecret動的解決
- PRコメント: ハードコードテーブル行 → 動的生成（アーティファクトファイルをglob取得）

### 5. `cleanup-pr-preview-on-close.yml` の改修

- `discover-apps` アクションを使ってアプリ一覧を取得し、`secrets[format()]` で各アプリのProject IDを解決
- ハードコードの for ループを廃止

### 6. Skills/Agents のジェネリック化

| ファイル | 変更 |
|---------|------|
| `einja-react-doctor/SKILL.md` | `apps/web`/`apps/admin` → `ls apps/` 動的スキャン |
| `einja-create-pr/SKILL.md` | `apps/web/**` → `@repo/web` 固定マッピング → `apps/*/package.json` の name を動的取得 |
| `einja-infra-maintenance/SKILL.md` | `apps/web/.vercel/project.json` → `apps/*/.vercel/project.json` の動的スキャン + Secret命名規則ドキュメント |
| `frontend-coder.md` | `apps/web/src/` → `apps/<app>/src/` のジェネリック参照 |
| `frontend-architect.md` | 同上 |
| `backend-architect.md` | `apps/web/src/app/api/` → `apps/<app>/src/app/api/` |

### 7. `einja-infra-maintenance` に「デプロイ検査・セットアップ」カテゴリ新設

既存のカテゴリ3〜7を横断的に呼び出すオーケストレーションカテゴリ（カテゴリ9）を追加。

#### 検査フロー

```
Step 1: apps/ スキャン → アプリ一覧取得 + Secret suffix 正規化
Step 2: Vercel検査
  - 各アプリに対応するVercelプロジェクトが存在するか（apps/*/.vercel/project.json）
  - 未リンクのアプリ → カテゴリ3（Vercel管理）の初期設定を実行
Step 3: GitHub Secrets検査
  - 各アプリに対応する VERCEL_PROJECT_ID_<SECRET_SUFFIX> が設定済みか
  - DOTENV_PRIVATE_KEY_* が設定済みか
  - VERCEL_TOKEN, VERCEL_ORG_ID, TURBO_TOKEN, TURBO_TEAM が設定済みか
  - 不足分 → カテゴリ5（GitHub Secrets管理）の個別/一括設定を実行
Step 4: ブランチ検査
  - develop/staging ブランチが存在するか
  - ブランチ保護ルールが設定されているか
  - 未設定 → カテゴリ7（リポジトリ設定）を実行
Step 5: Neon検査
  - Neonプロジェクトが存在するか
  - 必要なブランチ（main/development）が存在するか
  - 未設定 → カテゴリ4（Neon管理）の初期設定を実行
Step 6: ワークフロー整合性検査
  - .github/app-config.json が存在し、apps/構成と整合しているか
  - deployTargets に検出アプリが全て含まれているか
  - ワークフローファイルが存在するか
  - 不整合 → app-config.json の自動生成/更新を提案
Step 7: 検査結果サマリー表示 + 未解決項目のアクション提案
```

#### 出力形式
```
=== デプロイ検査結果 ===

📦 検出アプリ: web, admin, dashboard

☁️ Vercel
  ✅ web: リンク済み (prj_xxx)
  ✅ admin: リンク済み (prj_yyy)
  ❌ dashboard: 未リンク → セットアップを実行しますか？

🔐 GitHub Secrets（命名規則: VERCEL_PROJECT_ID_<APP_SUFFIX>）
  ✅ VERCEL_PROJECT_ID_WEB
  ✅ VERCEL_PROJECT_ID_ADMIN
  ❌ VERCEL_PROJECT_ID_DASHBOARD → 設定しますか？
  ✅ DOTENV_PRIVATE_KEY_PRODUCTION
  ...

🌿 ブランチ
  ✅ develop: 存在 + 保護設定済み
  ❌ staging: 未作成 → 作成しますか？

🗄️ Neon
  ✅ プロジェクト: xxx
  ✅ ブランチ: main, development

⚙️ ワークフロー整合性
  ✅ deploy-stable-branches.yml: 存在
  ⚠️ app-config.json: dashboard のマッピングなし → 更新しますか？

--- 推奨アクション ---
1. dashboard の Vercel プロジェクトをセットアップ
2. VERCEL_PROJECT_ID_DASHBOARD を GitHub Secrets に設定
3. staging ブランチを作成 + 保護ルール設定
4. app-config.json を更新
→ すべて自動実行しますか？ [Y/n/個別選択]
```

## タスク概要

| ID | タスク | 依存 | Skill/ツール |
|----|-------|------|-------------|
| 0-0 | TaskCreate一括登録 | - | [TaskCreate] |
| 0-1 | Planファイルリネーム → `docs/plans/202603/20260314-dynamic-app-ci.plan.md` | - | [Bash] |
| 0-2 | worktree作成 | 0-1 | [EnterWorktree / _einja-worktree-guide] |
| 1-1 | `.github/app-config.json` 新設 | 0-2 | [general-purpose] |
| 1-2 | `.github/actions/discover-apps/action.yml` 新設 | 0-2 | [general-purpose] |
| 2-1 | `deploy-stable-branches.yml` 改修（changes ジョブ + 3デプロイジョブ） | 1-1, 1-2 | [general-purpose] |
| 2-2 | `deploy-pr-preview.yml` 改修（マトリクス + Secret解決 + PRコメント） | 1-1, 1-2 | [general-purpose] |
| 2-3 | `cleanup-pr-preview-on-close.yml` 改修 | 1-2 | [general-purpose] |
| 3-1a | Skills ジェネリック化（react-doctor, create-pr, infra-maintenance） | 0-2 | [general-purpose] |
| 3-1b | Agents ジェネリック化（frontend-coder, frontend-architect, backend-architect） | 0-2 | [general-purpose] |
| 4-1 | `einja-infra-maintenance` にカテゴリ9「デプロイ検査・セットアップ」追加 | 0-2 | [general-purpose] |
| 4-2 | `create-app` テンプレートへの反映確認（`_template-update.ts` のコピー対象に `.github/actions/` と `.github/app-config.json` が含まれるか検証） | 2-1 | [general-purpose] |
| 99-1 | コードレビュー | 全実装タスク | [einja-review-code + codex-agent] |
| 99-2 | 動作確認（YAMLバリデーション + Skill整合性チェック） | 99-1 | [Bash] |
| 99-G | コミット承認ゲート | 99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

```
Phase 0: 0-0 → 0-1 → 0-2（直列）
Phase 1: 1-1 ∥ 1-2（並列）
Phase 2: 2-1 ∥ 2-2 ∥ 2-3（1-1,1-2完了後、並列） ∥ 3-1a ∥ 3-1b ∥ 4-1（独立、並列）
Phase 2.5: 4-2（Phase 2完了後）
Phase 3: 99系（直列）
```

## リスク・不明点

| リスク | 対策 |
|-------|------|
| `secrets[format()]` の動的キーアクセスが期待通りに動作しない可能性 | GitHub Actions ドキュメントで bracket notation + `format()` がサポートされていることを確認済み。実装時に早期テスト |
| `git diff` の基準コミットが force push / 初回 push で `000...` になる | `before` が `000...` or 空の場合は全アプリデプロイにフォールバック。`::warning` でログ出力 |
| `git diff` が差分計算に失敗（bad object等） | 静かに0件扱いにしない。`set -e` + `::warning` 出力 + 全アプリデプロイにフォールバック |
| `app-config.json` 未設定時のフォールバック | 設定ファイル不在 = packages/ 変更で全アプリデプロイ（安全側に倒す） |
| Vercel非対象アプリ（worker等）がマトリクスに入りSecret未設定でCI失敗 | `app-config.json` の `deployTargets` で制御。未記載アプリはデフォルト `vercel: true`（後方互換）。明示的に `vercel: false` で除外可能 |
| アプリ名のSecret suffix正規化で衝突（例: `my-app` と `my_app` が同じ `MY_APP` に） | 正規化ルールをドキュメント化し、`discover-apps` で衝突検出時にエラー出力 |
| 既存プロジェクトの後方互換性 | Secret命名規則は同じ（`VERCEL_PROJECT_ID_WEB` 等）。ワークフロー更新のみで移行完了 |
| `create-app` テンプレートへの新規ファイル反映 | タスク4-2で `_template-update.ts` のコピー対象パターンを検証。必要なら追加 |
| デプロイ検査モードのAPI制限 | Vercel/Neon/GitHub APIへの問い合わせが多い。トークン有効性を事前検証し、無効なら早期終了 |

## 検証・動作確認方法

1. **YAMLバリデーション**: `actionlint` で全ワークフローの構文チェック（`secrets[format()]` の解決を含む）
2. **Secret suffix 正規化テスト**: `discover-apps` アクションの出力が正しい suffix を生成するか確認（`web`→`WEB`、`my-app`→`MY_APP`、衝突検出）
3. **実環境テスト**: PRを作成してCIが正常に動作するか確認
4. **後方互換確認**: 既存の `apps/web` + `apps/admin` 構成でSecretが正しく解決されるか確認
5. **Skills確認**: `apps/web` 固定参照が残っていないことを grep で確認
6. **デプロイ検査テスト**: `einja-infra-maintenance` のカテゴリ9を実行し、検出結果が正しいことを確認
7. **テンプレート反映確認**: `_template-update.ts` で新規ファイルが正しくコピーされるか確認

## レビュー結果（修正済み）

### 修正対応済みの指摘

| 指摘（MAJOR） | 対応 |
|--------------|------|
| `toJSON(secrets)` のセキュリティリスク | `secrets[format()]` による直接Secret参照に変更。全Secret展開を回避 |
| `git diff` の force push / 初回 push 時の不安定性 | `before` が空/`000...` の場合は全アプリデプロイにフォールバック。差分計算失敗時も `::warning` + フォールバック |
| `discover-apps` がVercel非対象アプリも検出 | `app-config.json` に `deployTargets` を追加。`vercel: false` で除外可能 |

| 指摘（MINOR） | 対応 |
|--------------|------|
| タスク2-3の依存関係不正確 | 1-2（discover-apps）への依存を追加 |
| タスク3-1の粒度が大きい | Skills系（3-1a）とAgents系（3-1b）に分割 |
| `create-app` テンプレート反映タスク欠落 | タスク4-2として追加 |
| `app-config.json` に `globalTriggers` がない | `globalTriggers` セクションを追加 |
| Secret suffix の正規化ルール未定義 | `discover-apps` の仕様に正規化ルールと衝突検出を明記 |
| セットアップ手順書の一般化 | Skills ジェネリック化タスク（3-1a）で対応 |
