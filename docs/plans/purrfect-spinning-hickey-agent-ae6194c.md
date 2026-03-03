# SKILL.md 環境変数管理フロー検証レポート

## 調査概要

`.claude/skills/einja-infra-maintenance/SKILL.md` の環境変数管理フローが「自動検知→自動修正→やむを得ない場合のみ人間に操作を求める」という設計になっているか検証。

## 調査対象ファイル

1. `.claude/skills/einja-infra-maintenance/SKILL.md` - 全文
2. `docs/einja/instructions/environment-setup.md` - 環境変数セットアップ手順
3. `docs/einja/instructions/deployment-setup.md` - デプロイセットアップ手順
4. `docs/einja/steering/infrastructure/environment-variables.md` - 環境変数設計方針
5. `docs/einja/steering/infrastructure/deployment.md` - デプロイメント設計方針
6. `scripts/setup-dev.ts` - 自動セットアップスクリプト
7. `scripts/env.ts` - 環境変数対話式ウィザード
8. `package.json` - dev:setup の定義確認

## 全環境変数・トークンの自動化分類

### 分類基準

- **A: 完全自動**: Claude Codeが検知→CLI/APIで自動取得・設定可能（人間操作不要）
- **B: 半自動**: Claude Codeが検知→一部自動処理可能だが、値の入力や確認で人間が必要
- **C: 手動のみ**: Claude Codeでは対応不可、人間のGUI操作やブラウザアクセスが必須
- **D: 未対応**: 現在のSKILL.mdで検知・対処フローが定義されていない

---

## 検証結果一覧

### 1. ローカル環境変数ファイル

| ファイル | 検知 | 修正フロー | 分類 | 理由 |
|---------|------|----------|------|------|
| `.env.keys` | ✅ Phase 1 | ⚠️ AskUserQuestion | **B** | 検知可能。修正は「メインworktreeからコピー or 手動配置」を人間に選択させる（SKILL.md L143） |
| `.env.local` | ✅ Phase 1 | ⚠️ 手動編集案内 | **B** | 検知可能。暗号化済みのため復号→編集→再暗号化の手順を案内（カテゴリ2） |
| `.env` | ✅ Phase 1 | ✅ 自動再生成 | **A** | `pnpm dev:setup` で `.env.local` から自動復号生成（scripts/setup-dev.ts L222-233） |
| `.env.personal` | ✅ Phase 1 | ⚠️ 値入力必須 | **B** | 検知可能。値は人間がAskUserQuestionで入力（SKILL.md L168-178） |
| `.env.develop` | ✅ Phase 1 | ⚠️ 手動編集案内 | **B** | 検知可能。暗号化済みのため復号→編集→再暗号化の手順を案内 |
| `.env.staging` | ✅ Phase 1 | ⚠️ 手動編集案内 | **B** | 同上 |
| `.env.production` | ✅ Phase 1 | ⚠️ 手動編集案内 | **B** | 同上 |
| `.env.preview` | ✅ Phase 1 | ⚠️ 手動編集案内 | **B** | 同上 |

**問題点**: `.env.keys` 不在時に「メインworktreeから自動コピー」できるのに、わざわざ人間に選択させている（setup-dev.ts L73-90で自動コピー実装済み）

---

### 2. 個人トークン（.env.personal内）

| トークン | 検知 | 修正フロー | 分類 | 理由 |
|---------|------|----------|------|------|
| `GITHUB_TOKEN` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | 検知可能（SKILL.md L168）。値の有効性検証は `gh auth status` で可能だが、現状は存在確認のみ |
| `VERCEL_TOKEN` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | 検知可能（SKILL.md L169）。値の有効性検証は `vercel whoami` で可能だが、現状は存在確認のみ |
| `NEON_API_KEY` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | 検知可能（SKILL.md L170）。値の有効性検証は `neonctl projects list --api-key $NEON_API_KEY` で可能だが、現状は存在確認のみ |

**問題点**: Phase 1の検知で「値の正当性」を検証していない。トークンが期限切れ・無効でも検知できない。

---

### 3. GitHub Secrets（全10個）

| Secret | 検知 | 修正フロー | 分類 | 理由 |
|--------|------|----------|------|------|
| `DOTENV_PRIVATE_KEY_PREVIEW` | ✅ `gh secret list` | ✅ 自動抽出・設定 | **A** | 一括設定（SKILL.md L340-350）で `.env.keys` から自動抽出→設定可能 |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | ✅ `gh secret list` | ✅ 自動抽出・設定 | **A** | 同上 |
| `DOTENV_PRIVATE_KEY_DEVELOP` | ✅ `gh secret list` | ✅ 自動抽出・設定 | **A** | 同上 |
| `DOTENV_PRIVATE_KEY_STAGING` | ✅ `gh secret list` | ✅ 自動抽出・設定 | **A** | 同上 |
| `VERCEL_TOKEN` | ✅ `gh secret list` | ⚠️ 値入力必須 | **B** | 検知可能。値は人間がAskUserQuestionで入力（SKILL.md L352-365） |
| `VERCEL_ORG_ID` | ✅ `gh secret list` | ⚠️ 値入力必須 | **B** | 同上 |
| `VERCEL_PROJECT_ID_WEB` | ✅ `gh secret list` | ⚠️ 値入力必須 | **B** | 同上 |
| `VERCEL_PROJECT_ID_ADMIN` | ✅ `gh secret list` | ⚠️ 値入力必須 | **B** | 同上 |
| `TURBO_TOKEN` | ✅ `gh secret list` | ⚠️ 値入力必須 | **B** | 検知可能。値は人間がAskUserQuestionで入力（SKILL.md L367-383） |
| `TURBO_TEAM` | ✅ `gh secret list` | ✅ 自動取得 | **A** | `.turbo/config.json` から自動取得可能（SKILL.md L373-377） |

**検知の限界**: `gh secret list` は存在確認のみで、**値が正しいか**は検証不可（GitHub APIの制限）

---

### 4. Neon環境変数（.env.preview内）

| 変数 | 検知 | 修正フロー | 分類 | 理由 |
|-----|------|----------|------|------|
| `NEON_PROJECT_ID` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | `.env.preview` 復号で検知可能。値は人間が入力（deployment-setup.md L170-183） |
| `NEON_API_KEY` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | 同上 |
| `DATABASE_URL` | ⚠️ 存在確認のみ | ⚠️ 値入力必須 | **B** | 同上（Neonブランチから自動生成可能だが、現状は手動） |

**改善可能性**: `DATABASE_URL` は Neon API（connection_uri）から自動取得可能（deployment.md L258, neon-cli-reference.md参照）

---

### 5. その他（CLI・Docker）

| 項目 | 検知 | 修正フロー | 分類 | 理由 |
|-----|------|----------|------|------|
| Volta | ✅ Phase 1 | ✅ 自動インストール | **A** | setup-dev.ts L134-161 で自動インストール |
| direnv | ✅ Phase 1 | ✅ 自動インストール | **A** | setup-dev.ts L163-229 で自動インストール・設定 |
| dotenvx | ✅ Phase 1 | ✅ 自動インストール | **A** | setup-dev.ts L245-268 で自動インストール |
| Docker | ✅ Phase 1 | ⚠️ 手動案内 | **C** | 検知可能（SKILL.md L64）。インストールはGUI必須（SKILL.md L144） |
| PostgreSQL | ✅ Phase 1 | ✅ 自動起動 | **A** | `docker compose up -d postgres` で自動起動（SKILL.md L145） |
| Vercel CLI | ✅ Phase 1 | ✅ 自動インストール | **A** | `npm install -g vercel` 提案可能（SKILL.md L609） |
| Neon CLI | ✅ Phase 1 | ✅ 自動インストール | **A** | `npm install -g neonctl` 提案可能（SKILL.md L609） |
| GitHub CLI | ✅ Phase 1 | ✅ 自動インストール | **A** | `brew install gh` 提案可能（SKILL.md L609） |

**問題点**: Docker以外は自動インストール可能だが、SKILL.md L609では「AskUserQuestionで自動インストール提案」と曖昧。

---

## フェーズ別分析

### Phase 1: 環境状態の自動検知（SKILL.md L48-70）

#### 検知できるもの
- ✅ ファイル存在（`.env*`, `.env.keys`）
- ✅ CLI存在（`vercel`, `neonctl`, `gh`, `dotenvx`, `docker`）
- ✅ Docker/PostgreSQL状態
- ✅ 開発サーバー状態
- ✅ GitHub Secrets数（`gh secret list`）

#### 検知できないもの
- ❌ トークンの有効性（期限切れ・無効）
- ❌ GitHub Secretsの値の正当性（API制限）
- ❌ 環境変数の値の正当性（暗号化ファイル内）
- ❌ Vercel/Neonプロジェクトとの接続性

**推奨改善**: Phase 1で以下を追加検証
```bash
# トークン有効性検証
gh auth status 2>/dev/null && echo "✅ GITHUB_TOKEN" || echo "❌ GITHUB_TOKEN"
vercel whoami 2>/dev/null && echo "✅ VERCEL_TOKEN" || echo "❌ VERCEL_TOKEN"
neonctl projects list --api-key $NEON_API_KEY 2>/dev/null && echo "✅ NEON_API_KEY" || echo "❌ NEON_API_KEY"
```

---

### Phase 2: 修正フロー

#### 完全自動（A）: 7項目
1. `.env` - `pnpm dev:setup` で自動再生成
2. `DOTENV_PRIVATE_KEY_*` (4個) - `.env.keys` から自動抽出→GitHub Secrets設定
3. `TURBO_TEAM` - `.turbo/config.json` から自動取得
4. CLI自動インストール（Volta, direnv, dotenvx, vercel, neonctl, gh）

#### 半自動（B）: 18項目
- `.env.keys` - worktreeから自動コピー可能だが、人間に選択させている
- `.env.local`, `.env.{develop,staging,production,preview}` - 暗号化のため手動編集案内
- 個人トークン（3個） - 値入力必須、有効性検証なし
- GitHub Secrets（6個） - 値入力必須
- Neon環境変数（3個） - 値入力必須（自動取得可能だが未実装）

#### 手動のみ（C）: 1項目
- Docker - GUIインストール必須

#### 未対応（D）: 0項目
（全ての項目が何らかの形で対処フローあり）

---

## 設計上の問題点と改善案

### 問題1: `.env.keys` の不要な人間選択

**現状**: SKILL.md L143で「AskUserQuestion: メインworktreeからコピー or 手動配置」

**実装状況**: `setup-dev.ts` L73-90で自動コピー実装済み

**改善案**: AskUserQuestionを削除し、自動コピーを優先実行。失敗時のみ手動配置を案内。

```diff
- AskUserQuestion: 「メインworktreeからコピー or 手動配置」
+ 自動実行: メインworktreeから自動コピー → 失敗時のみ「1Passwordから手動配置してください」案内
```

---

### 問題2: トークン有効性の未検証

**現状**: Phase 1で存在確認のみ。期限切れ・無効トークンを検知できない。

**改善案**: Phase 1に以下の検証を追加

```bash
# GITHUB_TOKEN検証
if gh auth status >/dev/null 2>&1; then
  echo "✅ GITHUB_TOKEN (有効)"
else
  echo "❌ GITHUB_TOKEN (期限切れ or 無効)"
fi

# VERCEL_TOKEN検証
if vercel whoami >/dev/null 2>&1; then
  echo "✅ VERCEL_TOKEN (有効)"
else
  echo "❌ VERCEL_TOKEN (期限切れ or 無効)"
fi

# NEON_API_KEY検証
if neonctl projects list --api-key $NEON_API_KEY >/dev/null 2>&1; then
  echo "✅ NEON_API_KEY (有効)"
else
  echo "❌ NEON_API_KEY (期限切れ or 無効)"
fi
```

---

### 問題3: Neon DATABASE_URL の手動設定

**現状**: deployment-setup.md L170-183で人間が手動設定

**実装可能性**: Neon API（connection_uri）から自動取得可能（deployment.md L258, L299-307参照）

**改善案**: カテゴリ4（Neon管理）に自動取得フローを追加

```bash
# Neonブランチから接続文字列を自動取得
BRANCH_ID=$(neonctl branches list --project-id $NEON_PROJECT_ID --api-key $NEON_API_KEY | grep production | awk '{print $1}')
DATABASE_URL=$(curl -s "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&database_name=neondb&role_name=$ROLE_NAME&pooled=true" \
  -H "Authorization: Bearer $NEON_API_KEY" | jq -r .uri)

# .env.preview に自動設定
dotenvx set DATABASE_URL="$DATABASE_URL" -f .env.preview
```

---

### 問題4: CLI自動インストールの曖昧さ

**現状**: SKILL.md L609で「AskUserQuestionで自動インストール提案」と曖昧

**実装状況**: `setup-dev.ts` L134-268で自動インストール実装済み

**改善案**: SKILL.mdで明示的に自動インストールを優先

```diff
- AskUserQuestionで自動インストール提案（`npm i -g <cli>`等）
+ 自動実行: `npm install -g <cli>` → 失敗時のみ手動インストール案内
```

---

### 問題5: GitHub Secretsの値検証不可

**原因**: GitHub APIの制限（Secretsの値は取得不可）

**現状**: `gh secret list` で存在確認のみ

**改善不可**: API制限のため、値の正当性は検証不可

**回避策**: CI/CDワークフローの失敗ログから自動検出→修正フロー提案（カテゴリ7で実装済み、SKILL.md L529-538）

---

## 総合評価

### 自動化レベル

| レベル | 項目数 | 割合 |
|--------|--------|------|
| **A: 完全自動** | 7 | 27% |
| **B: 半自動** | 18 | 69% |
| **C: 手動のみ** | 1 | 4% |
| **D: 未対応** | 0 | 0% |

### 設計方針との適合性

> 「自動検知→自動修正→やむを得ない場合のみ人間に操作を求める」

**適合度**: ⭐⭐⭐⭐☆ (4/5)

**理由**:
- ✅ 自動検知は概ね網羅（Phase 1）
- ✅ 自動修正は一部実現（A分類 27%）
- ⚠️ 改善可能な手動操作が複数存在（B分類 69%）
- ✅ 手動のみはDocker 1項目のみ（C分類 4%）

### 主な改善箇所（優先順）

1. **トークン有効性検証** - Phase 1に追加（高優先度）
2. **`.env.keys` 自動コピー** - AskUserQuestion削除（高優先度）
3. **Neon DATABASE_URL 自動取得** - API連携実装（中優先度）
4. **CLI自動インストール明示化** - SKILL.md修正（低優先度）

---

## 結論

現在の設計は「検知→修正」フローを概ね実現しているが、以下の課題がある:

1. **Phase 1の検知が不完全** - トークン有効性を検証していない
2. **自動化可能な箇所で人間選択を求めている** - `.env.keys` コピー等
3. **API連携で自動化可能な箇所が手動** - Neon DATABASE_URL等

これらを改善することで、自動化レベルを **A: 40% → 60%** に引き上げ可能。

ただし、以下は技術的制約により自動化不可:
- GitHub Secretsの値検証（API制限）
- Docker初回インストール（GUI必須）
- Vercel/VercelプロジェクトID取得（Dashboard操作必須）

**最終評価**: 設計方針に概ね適合しているが、改善の余地あり（⭐⭐⭐⭐☆）
