# infra-maintenance Skill ゼロ状態対応度調査

## 調査目的

`infra-maintenance` Skillが、一度もインフラ設定がされていない「完全ゼロ状態」のプロジェクトからセットアップする場合に対応できるかを検査する。

## ゼロ状態の定義

- git clone 直後
- .env.keys が存在しない（1Passwordからまだ取得していない）
- .env.personal が存在しない
- .env（復号済み）が存在しない
- pnpm install がまだ実行されていない
- Docker/PostgreSQL が起動していない
- Vercel CLI 未インストール / 未ログイン / 未リンク
- Neon CLI 未インストール / Neon API Key 未取得
- GitHub CLI 未ログイン
- GitHub Secrets 未設定（リポジトリ新規作成直後）
- Vercel 環境変数未設定
- Neon プロジェクト未作成

---

## カテゴリごとのゼロ状態対応度評価

### カテゴリ1: ローカル環境セットアップ

**評価: ⚠️ 一部不足**

#### 対応済みの点
- `pnpm install` で依存関係インストール（SKILL.md 129行目）
- `pnpm dev:setup` で環境セットアップ（SKILL.md 130行目）
- PostgreSQL接続エラー時の `docker compose up -d postgres` 案内（SKILL.md 138行目）
- Node.js/pnpmバージョン不一致時の `volta install` 提案（SKILL.md 139-140行目）

#### 不足している点
1. **`.env.keys` 不在時の対処フローが不完全**
   - AskUserQuestion で「メインworktreeからコピー or 手動配置」を提示（SKILL.md 137行目）
   - しかし、**メインworktreeも存在しない**ゼロ状態（単一worktree環境、または初回clone）では案内不十分
   - 1Passwordからの取得手順がない

2. **Docker未インストール時の案内がない**
   - PostgreSQL接続エラーは検出できるが、Docker自体がインストールされていないケースの対処がない

3. **direnv未設定時の案内がない**
   - environment-setup.mdには「direnv allow」の手順があるが、SKILL.md側で案内されていない

#### 推奨修正
- カテゴリ1の「初回セットアップ」で `.env.keys` 不在時に以下のフローを追加：
  1. 1Passwordの取得先案内（チーム共有のVault名・Item名を記載）
  2. 手動配置手順の詳細説明（パスワードマネージャー未使用の場合の代替案）
- Docker未インストール時の案内を追加（`command -v docker` チェック）
- direnv未設定時の案内を追加（`command -v direnv` チェック）

---

### カテゴリ2: 環境変数管理

**評価: ⚠️ 一部不足**

#### 対応済みの点
- 個人トークン設定フローが詳細（SKILL.md 160-171行目）
- トークン取得URLの案内（GitHub, Vercel, Neon）
- `.env.personal` への保存と `chmod 600` 実行
- API検証コマンド（`gh auth status`, `vercel whoami`, `neonctl projects list`）

#### 不足している点
1. **チーム共有設定変更の前提条件が未確認**
   - 「チーム共有設定変更」（SKILL.md 173-180行目）は `.env.keys` の秘密鍵が必須
   - しかし、`.env.keys` 不在時にこのサブメニューを選択した場合のエラーハンドリングがない

2. **新規環境変数追加フローの依存関係が不明確**
   - 「新規環境変数追加」（SKILL.md 182-189行目）でも暗号化ファイル編集が必要
   - `.env.keys` 不在時にこのフローを選択すると失敗する

#### 推奨修正
- カテゴリ2の各サブメニューで `.env.keys` 存在チェックを実行
- 不在時は「まずカテゴリ1で初回セットアップを完了してください」と案内

---

### カテゴリ3: Vercel管理

**評価: ⚠️ 一部不足**

#### 対応済みの点
- VERCEL_TOKEN未設定時の取得URL案内（SKILL.md 207行目）
- `vercel link` でプロジェクト接続（SKILL.md 209行目）
- Root Directory設定（API使用、SKILL.md 210-217行目）
- 環境変数同期フロー（SKILL.md 222-227行目）

#### 不足している点
1. **Vercel CLI未インストール時の案内がない**
   - カテゴリ6では `command -v vercel` チェックが存在（SKILL.md 360行目）
   - しかし、カテゴリ3の実行時点ではチェックされていない

2. **プロジェクト作成フローが存在しない**
   - 「初期設定」（SKILL.md 206-218行目）は既存プロジェクトへの接続のみ
   - **Vercelプロジェクトがまだ存在しない**ゼロ状態では不完全
   - vercel-cli-reference.md（258-289行目）には詳細手順があるが、SKILL.mdから誘導されていない

3. **VERCEL_ORG_ID, VERCEL_PROJECT_IDの取得方法が記載されていない**
   - SKILL.mdには記載なし
   - deployment-setup.md（261-266行目）やvercel-cli-reference.md（295-302行目）にはあるが、参照ドキュメントとしてリンクされていない

#### 推奨修正
- カテゴリ3「初期設定」を2つに分割：
  - **新規プロジェクト作成**: vercel-cli-reference.md のStep 1-3を実行
  - **既存プロジェクト接続**: 現在の「初期設定」フロー
- Vercel CLI未インストール時の案内を追加

---

### カテゴリ4: Neon管理

**評価: ⚠️ 一部不足**

#### 対応済みの点
- NEON_API_KEY未設定時の取得URL案内（SKILL.md 251-253行目）
- `neonctl auth` を使用しない理由の明記（neon-cli-reference.md 49-69行目）
- プロジェクト作成コマンド（SKILL.md 255-257行目）
- NEON_PROJECT_IDの `.env.preview` への設定（SKILL.md 258行目）

#### 不足している点
1. **Neon CLI未インストール時の案内がない**
   - カテゴリ6では `command -v neonctl` チェックが存在（SKILL.md 360行目）
   - しかし、カテゴリ4の実行時点ではチェックされていない

2. **`.env.preview` への設定フローが簡略化されすぎ**
   - 「NEON_PROJECT_IDを`.env.preview`に設定 → dotenvx暗号化」（SKILL.md 258行目）
   - しかし、**`.env.preview` がまだ存在しない**ゼロ状態では実行不可
   - deployment-setup.md（171-184行目）には `pnpm env:update` を使った詳細フローがあるが、SKILL.mdから誘導されていない

3. **プロジェクト作成後のIDの取得方法が不明確**
   - `neonctl projects create` の出力から `NEON_PROJECT_ID` を抽出する手順が記載されていない

#### 推奨修正
- カテゴリ4「初期設定」で以下を追加：
  - Neon CLI未インストール時の案内
  - プロジェクト作成後のID取得手順（`jq -r '.project.id'` 等）
  - `.env.preview` への設定を `pnpm env:update` 経由で実行する詳細フロー

---

### カテゴリ5: GitHub Secrets管理

**評価: ✅ 対応済み**

#### 対応済みの点
- GitHub CLI (`gh`) の存在を前提とした操作（SKILL.md 308-329行目）
- 一括設定スクリプトが完備（SKILL.md 319-329行目、deployment-setup.md 73-79行目）
- dotenvx秘密鍵の自動抽出ロジック（`.env.keys` からgrep）

#### 注意点
- GitHub CLI未ログイン時のエラーは `gh secret list` 実行時に検出可能
- **前提条件**: `.env.keys` が存在すること（カテゴリ1で解決）

---

### カテゴリ6: 環境状態確認

**評価: ✅ 対応済み**

#### 対応済みの点
- 包括的なヘルスチェック（SKILL.md 338-409行目）
- CLI未インストール時の検出（SKILL.md 359-361行目）
- 推奨アクションの自動提案（SKILL.md 413-424行目）
- ❌が3個以上の場合の初期セットアップ案内（SKILL.md 424行目）

#### 特に優れている点
- このカテゴリは**ゼロ状態検出の起点**として機能する
- Phase 1（環境状態の自動検出、SKILL.md 48-70行目）と連動

---

### カテゴリ7: GitHub Actions CI/CD管理

**評価: ✅ 対応済み**

#### 対応済みの点
- GitHub CLI (`gh`) を使用したワークフロー操作（SKILL.md 453-505行目）
- エラーパターンに基づくカテゴリ遷移提案（SKILL.md 476-484行目）
- 失敗調査フローが詳細（SKILL.md 466-475行目）

#### 注意点
- このカテゴリは**他カテゴリが完了している前提**（GitHub Secrets, Vercel, Neon設定済み）
- ゼロ状態では実行可能だが、設定不備エラーの診断用途が主

---

## Phase 1 自動検出の検査

### 検出ロジック（SKILL.md 52-68行目）

```bash
# === ファイル存在確認 ===
for f in .env .env.local .env.keys .env.personal .env.develop .env.staging .env.production .env.preview; do
  [ -f "$f" ] && echo "✅ $f" || echo "❌ $f"
done

# === CLI存在確認 ===
for cmd in vercel neonctl gh dotenvx docker; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✅ $cmd" || echo "❌ $cmd"
done

# === Docker/PostgreSQL状態 ===
docker compose ps 2>/dev/null | grep postgres

# === 開発サーバー状態 ===
pnpm dev:status 2>/dev/null || echo "停止中"
```

### ゼロ状態での検出結果（想定）

```
❌ .env
❌ .env.local
❌ .env.keys
❌ .env.personal
❌ .env.develop
❌ .env.staging
❌ .env.production
❌ .env.preview
❌ vercel
❌ neonctl
✅ gh (インストール済みと仮定)
✅ dotenvx (pnpm dev:setupでインストール)
❌ docker (未インストールの可能性)
❌ postgres (未起動)
❌ 開発サーバー (停止中)
```

### 推奨ロジックの動作（SKILL.md 96-104行目）

| 検出結果 | 推奨カテゴリ |
|---------|------------|
| `.env.keys`不在 | ローカル環境セットアップ |
| 開発サーバー停止中 + `.env.keys`存在 | ローカル環境セットアップ |
| vercel CLI未インストール or 未リンク | Vercel管理 |
| neonctl未インストール | Neon管理 |
| `.env.personal`不在 | 環境変数管理 |
| 上記に該当しない | 環境状態確認（デフォルト） |

### ゼロ状態での推奨動作

**問題点**: 複数の❌が同時に存在する場合、**どのカテゴリを最優先すべきか不明確**

- `.env.keys`不在 → カテゴリ1推奨
- vercel CLI未インストール → カテゴリ3推奨
- neonctl未インストール → カテゴリ4推奨
- `.env.personal`不在 → カテゴリ2推奨

**推奨される動作**:
1. **Phase 1の検出結果で❌が3個以上** → 「初回セットアップが必要です。カテゴリ1を実行してください」と明示
2. カテゴリ1完了後、再度Phase 1を実行し、次の推奨カテゴリを提示

---

## セットアップ手順書との整合性検証

### deployment-setup.md「セクション0: ゼロからの統合初期構築フロー」（26-106行目）

#### 記載されている手順
1. リポジトリクローン + 依存関係インストール
2. Neon初期設定
3. Vercel初期設定
4. GitHub Secrets一括設定
5. ローカル環境変数設定（`pnpm env:update`）
6. 初回起動（`pnpm dev:setup`, `pnpm dev:bg`）
7. 動作確認

#### SKILL.mdとの整合性

**不整合点**:
- deployment-setup.mdの推奨順序: **Neon → Vercel → GitHub Secrets → ローカル環境**
- SKILL.mdのカテゴリ順序: **ローカル環境(1) → 環境変数(2) → Vercel(3) → Neon(4) → GitHub Secrets(5)**

**問題**:
- SKILL.mdは「ローカル開発優先」の設計
- deployment-setup.mdは「CI/CD基盤優先」の設計
- ゼロ状態では**どちらから始めるべきか**が明示されていない

**推奨される整合化**:
- SKILL.md側で「ゼロからの統合初期構築」フローを新設
- deployment-setup.mdのセクション0と同じ順序を提示
- または、AskUserQuestionで「ローカル開発のみ or 本番デプロイまで」を選択させる

---

## environment-setup.mdとの整合性検証

### 「セクション1: ローカル開発環境セットアップ」（43-109行目）

#### 記載されている手順
1. 自動セットアップ（`pnpm dev:setup`）
2. 環境変数の設定・変更（`pnpm env:update`）
3. 手動セットアップ（dotenvx, `.env.keys`, `.env.personal`）

#### SKILL.mdとの整合性

**整合している点**:
- カテゴリ1「初回セットアップ」が `pnpm dev:setup` を実行（SKILL.md 129行目）
- カテゴリ2「個人トークン設定」が environment-setup.md のトークン設定フローと一致

**不整合点**:
- environment-setup.mdには「クイック操作: `pnpm env:update`」の推奨記載（156行目）
- しかし、SKILL.mdカテゴリ2では `pnpm env:update` が明示的に案内されていない

**推奨修正**:
- カテゴリ2の冒頭に「対話式ウィザードを使う場合は `pnpm env:update` を実行してください」と追記

---

## 発見された問題の一覧

### 1. `.env.keys` 不在時の対処フローが不完全

**問題の説明**:
- カテゴリ1で「メインworktreeからコピー or 手動配置」を案内（SKILL.md 137行目）
- しかし、**単一worktree環境、または初回clone**では「メインworktree」が存在しない
- 1Passwordからの取得手順がSKILL.mdに記載されていない

**影響度**: ⚠️ 高（ゼロ状態では必須）

**修正提案**:
```markdown
#### エラー時の対処

| エラー | 対処 |
|--------|------|
| `.env.keys`不在 | AskUserQuestion: 「1. 1Passwordから取得 (Vault: Development, Item: einja-dotenvx-keys) or 2. チームメンバーから共有を受ける or 3. 新規生成（初回プロジェクトセットアップ時のみ）」 |
```

---

### 2. Docker未インストール時の案内がない

**問題の説明**:
- PostgreSQL接続エラーは検出できるが、Docker自体がインストールされていないケースの対処がない
- environment-setup.mdには Docker Desktop のインストール先が記載されているが、SKILL.mdから誘導されていない

**影響度**: ⚠️ 中（環境によっては必須）

**修正提案**:
```markdown
#### エラー時の対処

| エラー | 対処 |
|--------|------|
| Docker未インストール | AskUserQuestion: 「Docker Desktop をインストールしてください: https://www.docker.com/products/docker-desktop/」 → インストール後に `docker compose up -d postgres` を実行 |
```

---

### 3. Vercelプロジェクト作成フローが存在しない

**問題の説明**:
- カテゴリ3「初期設定」は既存プロジェクトへの接続のみ
- **Vercelプロジェクトがまだ存在しない**ゼロ状態では不完全
- vercel-cli-reference.md（258-289行目）には詳細手順があるが、SKILL.mdから誘導されていない

**影響度**: ⚠️ 高（ゼロ状態では必須）

**修正提案**:
```markdown
### サブメニュー
- **新規プロジェクト作成**: Vercelプロジェクトを新規作成
- **既存プロジェクト接続**: 既存プロジェクトにリンク
- **環境変数同期**: dotenvx鍵のVercel同期
- **デプロイ状態確認**: 最新デプロイ情報表示

#### 新規プロジェクト作成
1. VERCEL_TOKEN確認 → 未設定時はURL案内 + `.env.personal`保存
2. AskUserQuestionでアプリ選択（web / admin）
3. vercel-cli-reference.mdのStep 1-3を実行:
   - vercel.json作成
   - `vercel link --project=$NAME --yes`
   - APIでRoot Directory設定
```

---

### 4. Neon設定の `.env.preview` フローが簡略化されすぎ

**問題の説明**:
- 「NEON_PROJECT_IDを`.env.preview`に設定 → dotenvx暗号化」（SKILL.md 258行目）
- しかし、**`.env.preview` がまだ存在しない**ゼロ状態では実行不可
- deployment-setup.md（171-184行目）には `pnpm env:update` を使った詳細フローがあるが、SKILL.mdから誘導されていない

**影響度**: ⚠️ 中（ゼロ状態では必須）

**修正提案**:
```markdown
3. NEON_PROJECT_IDを`.env.preview`に設定:
   - ゼロ状態の場合: `pnpm env:update` を実行し、対話式で設定
   - `.env.preview`既存の場合: 復号→編集→再暗号化
```

---

### 5. 複数の❌検出時の優先順位が不明確

**問題の説明**:
- Phase 1の推奨ロジック（SKILL.md 96-104行目）は単一条件ごとの推奨
- ゼロ状態では**複数の❌が同時に存在**し、どのカテゴリから始めるべきか不明確

**影響度**: ⚠️ 高（ユーザーの混乱を招く）

**修正提案**:
```markdown
#### 検出結果に基づく推奨ロジック

Phase 1の検出結果から、推奨カテゴリにマーク（推奨）を付与してAskUserQuestionの選択肢に表示する。

**ゼロ状態判定**:
- `.env.keys`不在 AND (vercel CLI未インストール OR neonctl未インストール OR `.env.personal`不在)
  → 「初回セットアップが必要です。以下の順序で実行してください: 1. ローカル環境セットアップ → 2. 環境変数管理 → 3. Vercel管理 → 4. Neon管理 → 5. GitHub Secrets管理」

**部分セットアップ済み判定**:
（現在のロジックを維持）
```

---

### 6. deployment-setup.md と SKILL.md の順序が不整合

**問題の説明**:
- deployment-setup.mdの推奨順序: **Neon → Vercel → GitHub Secrets → ローカル環境**
- SKILL.mdのカテゴリ順序: **ローカル環境(1) → 環境変数(2) → Vercel(3) → Neon(4) → GitHub Secrets(5)**

**影響度**: ⚠️ 中（ユーザーの混乱を招く）

**修正提案**:
- SKILL.mdに「ゼロからの統合初期構築フロー」を新設
- AskUserQuestionで以下を選択させる:
  - **ローカル開発のみ**: カテゴリ1 → 2
  - **本番デプロイまで**: deployment-setup.mdのセクション0の順序に従う

---

## 推奨されるセットアップ順序

### パターンA: ローカル開発のみ（最速）

1. **カテゴリ1: ローカル環境セットアップ**
   - 依存関係インストール
   - `.env.keys` の取得・配置
   - `pnpm dev:setup` 実行
2. **カテゴリ2: 環境変数管理**
   - `.env.personal` に個人トークン設定

### パターンB: 本番デプロイまで（完全セットアップ）

1. **カテゴリ1: ローカル環境セットアップ**
   - 依存関係インストール
   - `.env.keys` の取得・配置
2. **カテゴリ4: Neon管理**
   - Neon CLI インストール
   - NEON_API_KEY 取得
   - プロジェクト作成
   - `.env.preview` に NEON_PROJECT_ID 設定
3. **カテゴリ3: Vercel管理**
   - Vercel CLI インストール
   - VERCEL_TOKEN 取得
   - プロジェクト作成 + Root Directory設定
   - 環境変数同期
4. **カテゴリ5: GitHub Secrets管理**
   - `.env.keys` から dotenvx 秘密鍵を一括登録
5. **カテゴリ2: 環境変数管理**
   - `.env.personal` に個人トークン設定
6. **カテゴリ1: ローカル環境セットアップ**（再実行）
   - `pnpm dev:setup` 実行
   - 開発サーバー起動

### SKILL.mdへの反映提案

SKILL.mdの「Phase 2: 意図判定とメインメニュー」セクション（74-115行目）の前に、以下のセクションを追加:

```markdown
### ゼロ状態での統合初期構築フロー

初回セットアップ（一度もインフラ設定がされていない状態）の場合、以下のフローを推奨します。

**ローカル開発のみ**:
1. カテゴリ1: ローカル環境セットアップ
2. カテゴリ2: 環境変数管理（個人トークン設定）

**本番デプロイまで**:
1. カテゴリ1: ローカル環境セットアップ（依存関係 + `.env.keys` 取得）
2. カテゴリ4: Neon管理（プロジェクト作成）
3. カテゴリ3: Vercel管理（プロジェクト作成）
4. カテゴリ5: GitHub Secrets管理（dotenvx秘密鍵登録）
5. カテゴリ2: 環境変数管理（個人トークン設定）
6. カテゴリ1: ローカル環境セットアップ（再実行: `pnpm dev:setup`）

AskUserQuestion: 「初回セットアップですか？ ローカル開発のみ / 本番デプロイまで / いいえ（既存環境）」
```

---

## まとめ

### 総合評価: ⚠️ 一部不足（ゼロ状態対応度: 60%）

**対応できている点**:
- Phase 1の環境検出が包括的
- カテゴリ6のヘルスチェックが優秀
- カテゴリ5（GitHub Secrets）は完全対応

**対応できていない点**:
- `.env.keys` 不在時の取得手順が不完全
- Vercel/Neonのプロジェクト作成フローが不足
- 複数の❌検出時の優先順位が不明確
- deployment-setup.md との順序不整合

### 修正優先度

| 優先度 | 問題 | 対処 |
|--------|------|------|
| 🔴 高 | `.env.keys` 不在時の1Password取得案内 | カテゴリ1に追記 |
| 🔴 高 | Vercelプロジェクト作成フローの追加 | カテゴリ3にサブメニュー追加 |
| 🔴 高 | 複数❌検出時の統合フローの追加 | Phase 1とPhase 2の間に新セクション |
| 🟡 中 | Neon `.env.preview` 設定の詳細化 | カテゴリ4に `pnpm env:update` 案内 |
| 🟡 中 | Docker未インストール時の案内 | カテゴリ1に追記 |
| 🟢 低 | deployment-setup.md との順序整合 | ドキュメント調整（機能影響小） |

---

## 次のステップ（この調査の後に実施すべきこと）

1. SKILL.mdの修正案をユーザーに提示
2. 承認後、カテゴリ1, 3, 4の修正を実施
3. Phase 1とPhase 2の間に「ゼロ状態での統合初期構築フロー」を追加
4. 修正後、ゼロ状態でのSkill実行テストを実施
