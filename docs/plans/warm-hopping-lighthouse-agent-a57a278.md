# infra-maintenance Skill ゼロ状態セットアップ検証レポート

## 調査概要

`infra-maintenance` Skillが完全なゼロ状態（`git clone`直後）からのセットアップに対応しているかを検証。新しいチームメンバーの初回体験をシミュレーション。

**日時**: 2026-03-03
**対象Skill**: `.claude/skills/einja-infra-maintenance/SKILL.md`

---

## シナリオ1: 完全初回セットアップ

### 期待される動作

新規開発者が `git clone` 直後に `/infra-maintenance` を実行した場合、以下の順序で案内されるべき：

1. Phase 1で環境状態を自動検出
2. `.env.keys` 不在を検出 → 「ローカル環境セットアップ」を推奨
3. カテゴリ1の「初回セットアップ」を実行
4. `.env.keys`が必要なことを明示的に案内
5. エラー時のトラブルシュート手順を提示

### 実際のSKILL.mdの記述

#### Phase 1: 環境状態の自動検出（SKILL.md 行48-70）

```bash
# === ファイル存在確認 ===
for f in .env .env.local .env.keys .env.personal .env.develop .env.staging .env.production .env.preview; do
  [ -f "$f" ] && echo "✅ $f" || echo "❌ $f"
done

# === CLI存在確認 ===
for cmd in vercel neonctl gh dotenvx docker; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✅ $cmd" || echo "❌ $cmd"
done
```

**✅ 適切**: `.env.keys`の存在チェックが含まれている。

#### Phase 2: 意図判定とメインメニュー（SKILL.md 行92-104）

| 検出結果 | 推奨カテゴリ |
|---------|------------|
| `.env.keys`不在 | ローカル環境セットアップ |
| 開発サーバー停止中 + `.env.keys`存在 | ローカル環境セットアップ |

**✅ 適切**: `.env.keys`不在時に「ローカル環境セットアップ」を推奨するロジックが明記されている。

#### カテゴリ1: ローカル環境セットアップ → 初回セットアップ（SKILL.md 行128-133）

```markdown
#### 初回セットアップ
1. `pnpm install` で依存関係インストール
2. `pnpm dev:setup` で環境セットアップ
3. エラー時: エラー内容を分析し、対話的にトラブルシュート
```

**⚠️ ギャップあり**: `pnpm dev:setup`の実体について説明が不足。

#### エラー時の対処（SKILL.md 行135-141）

| エラー | 対処 |
|--------|------|
| `.env.keys`不在 | AskUserQuestion: 「メインworktreeからコピー or 手動配置」 |

**✅ 適切**: `.env.keys`不在時の対処が明記されている。

### ギャップ分析

#### 1. `pnpm dev:setup`の実体が不明確

- **SKILL.md**: 「`pnpm dev:setup` で環境セットアップ」とのみ記載
- **実体（`scripts/setup-dev.ts`）**:
  - Volta/direnv/dotenvxの自動インストール（macOSのみ）
  - `.env.keys`不在時、worktreeの親からコピーを試行
  - `.env.keys`が完全に不在の場合、フォールバック（`.env.example` → `.env`）
  - 対話的にGITHUB_TOKENを設定
  - PostgreSQL起動・Prismaセットアップ

**問題点**: SKILL.mdに「`pnpm dev:setup`が何をするか」の詳細がない。

#### 2. `.env.keys`入手方法の案内不足

- **SKILL.md 行497**: 「チームから .env.keys を共有してもらってください」
- **setup-dev.ts 行467**: worktreeからのコピーに失敗した場合の案内

**問題点**:
- `.env.keys`の入手先（1Password等）が明記されていない
- 初めてのチームメンバーは「誰から」「どこから」共有を受けるべきか不明

#### 3. 前提条件ツールのインストール順序不明

- **SKILL.md Phase 1**: CLIツールの存在確認のみ
- **カテゴリ1**: `pnpm dev:setup`実行を案内

**問題点**:
- `pnpm`自体がインストールされていない場合の対処が不明
- `setup-dev.ts`はVoltaで`pnpm`をインストールするが、SKILL.mdには記載なし

### 影響度

- **Critical**: `.env.keys`入手方法の案内不足 → 初回セットアップが完全にブロックされる
- **High**: `pnpm dev:setup`の詳細不明 → ユーザーが何が起こるか理解できず不安
- **Medium**: 前提条件ツールの順序不明 → 手動で事前インストールが必要な場合がある

### 修正提案

#### 1. カテゴリ1に「初回セットアップの前提条件」セクションを追加

```markdown
#### 初回セットアップの前提条件

| ツール | 確認方法 | インストール方法 |
|--------|---------|---------------|
| Git | `git --version` | プリインストール済み（macOS/Linux） |
| Node.js | `node --version` | Voltaで自動インストール（macOS） |
| pnpm | `pnpm --version` | Voltaで自動インストール（macOS） |
| Docker | `docker --version` | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| .env.keys | `[ -f .env.keys ]` | **チームから共有を受ける（1Passwordなど）** |

**注意**: `.env.keys`は秘密鍵ファイルのため、Gitで管理されていません。チームリーダーまたは1Password等から入手してください。
```

#### 2. 「初回セットアップ」の実行内容を詳細化

```markdown
#### 初回セットアップ
1. `.env.keys`の配置確認 → 不在時はチームから入手を案内
2. `pnpm dev:setup` 実行（以下を自動実行）:
   - Volta（Node.jsバージョン管理）インストール（macOS）
   - direnv（環境変数自動読み込み）インストール（macOS）
   - dotenvx（環境変数暗号化）インストール
   - `.env.local` → `.env` 復号
   - GITHUB_TOKEN設定（対話的）
   - PostgreSQL起動（Docker）
   - Prismaセットアップ（DB初期化）
3. エラー時: エラー内容を分析し、対話的にトラブルシュート
```

#### 3. カテゴリ1の「参照ドキュメント」に追加

```markdown
### 参照ドキュメント
- `docs/einja/instructions/local-server-environment-and-worktree.md`
- `docs/einja/instructions/environment-setup.md`
- **初回セットアップ詳細**: `scripts/setup-dev.ts`（実装参照）
```

---

## シナリオ2: CI/CD初回セットアップ

### 期待される動作

新規リポジトリでGitHub Actionsデプロイを初回構成する場合：

1. `.env.keys`が不在 → 生成方法を案内
2. Vercel/Neonアカウントが未作成 → アカウント作成から案内
3. GitHub Secrets一括設定の前提条件を明示

### 実際のSKILL.mdの記述

#### カテゴリ3: Vercel管理 → 初期設定（SKILL.md 行206-217）

```markdown
#### 初期設定
1. VERCEL_TOKEN確認 → 未設定時はURL案内 + `.env.personal`保存
2. AskUserQuestionでアプリ選択（web / admin）
3. `vercel link --project=$NAME --yes` で接続
4. Root Directory設定:
   curl -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$VERCEL_ORG_ID" ...
5. プロジェクトID取得・表示
```

**⚠️ ギャップあり**: 「Vercelプロジェクトがまだ存在しない場合」の手順がない。

#### カテゴリ4: Neon管理 → 初期設定（SKILL.md 行250-261）

```markdown
#### 初期設定
1. NEON_API_KEY確認 → 未設定時はURL案内 + `.env.personal`保存
2. プロジェクト作成:
   neonctl projects create --name einja-management --region-id aws-ap-northeast-1 --api-key $NEON_API_KEY
3. NEON_PROJECT_IDを`.env.preview`に設定 → dotenvx暗号化
4. ブランチ戦略初期設定:
   - production（main）ブランチ確認
   - developmentブランチ作成
```

**✅ 適切**: プロジェクト未作成時の手順が明記されている。

#### カテゴリ5: GitHub Secrets管理 → 一括設定（SKILL.md 行317-329）

```bash
# dotenvx秘密鍵を自動抽出してGitHub Secretsに設定
for key_name in PREVIEW PRODUCTION DEVELOP STAGING; do
  value=$(grep "DOTENV_PRIVATE_KEY_${key_name}" .env.keys | cut -d'=' -f2 | tr -d "\"'")
  if [ -n "$value" ]; then
    gh secret set "DOTENV_PRIVATE_KEY_${key_name}" --body "$value"
    echo "✅ DOTENV_PRIVATE_KEY_${key_name} を設定しました"
  else
    echo "⚠️ DOTENV_PRIVATE_KEY_${key_name} が .env.keys に見つかりません"
  fi
done
```

**⚠️ ギャップあり**: `.env.keys`が存在しない場合の対処（新規生成）がない。

### ギャップ分析

#### 1. Vercel初期設定の「プロジェクト未作成」ケース不足

- **SKILL.md**: `vercel link`でプロジェクト接続を前提
- **実際のゼロ状態**: Vercelダッシュボードでプロジェクトを手動作成する必要がある

**問題点**: `vercel link`が失敗した場合（プロジェクト未作成）のフローが不明。

#### 2. `.env.keys`初回生成フロー不在

- **カテゴリ2（環境変数管理）**: 既存の`.env.keys`からの読み取りのみ
- **カテゴリ5（GitHub Secrets管理）**: `.env.keys`から秘密鍵を読む前提

**問題点**: 「`.env.keys`をどう生成するか」の手順が完全に欠落。

### 影響度

- **Critical**: `.env.keys`初回生成フロー不在 → CI/CD初回構築が不可能
- **High**: Vercelプロジェクト未作成ケース不足 → 手動でダッシュボード操作が必要だが案内なし
- **Medium**: Neonは初期設定手順が適切に記載されている（参考にできる）

### 修正提案

#### 1. カテゴリ2に「初回環境変数ファイル作成」サブメニューを追加

```markdown
### サブメニュー
- **個人トークン設定**: `.env.personal`にトークンを保存
- **チーム共有設定変更**: `.env.local`等の復号→編集→再暗号化
- **新規環境変数追加**: プロジェクト全体への変数追加フロー
- **環境変数の状態表示**: 現在の設定状態を表示
- **【新規】初回環境ファイル作成**: `.env.local`/`.env.production`等を新規生成・暗号化

#### 初回環境ファイル作成（新規リポジトリ用）
1. AskUserQuestionで作成する環境を選択（.env.local / .env.production / .env.preview / .env.develop）
2. `.env.example`をベースにファイルを作成
3. AskUserQuestionで必須環境変数の値を入力（DATABASE_URL, AUTH_SECRET等）
4. dotenvxで暗号化
5. `.env.keys`に秘密鍵が自動生成される
6. `.env.keys`の内容を1Passwordに保存するよう案内
7. GitHub Secretsへの登録を促す（カテゴリ5へ遷移）
```

#### 2. カテゴリ3: Vercel管理に「プロジェクト未作成」フローを追加

```markdown
#### 初期設定
1. VERCEL_TOKEN確認 → 未設定時はURL案内 + `.env.personal`保存
2. AskUserQuestionでアプリ選択（web / admin）
3. **Vercelプロジェクト存在確認**:
   - `vercel ls`でプロジェクト一覧を取得
   - プロジェクトが存在しない場合:
     - **手動作成を案内**: Vercel Dashboard > New Project > GitHubリポジトリ選択
     - または`vercel --confirm`で新規プロジェクト作成（対話式）
4. `vercel link --project=$NAME --yes` で接続
5. Root Directory設定（API経由）
6. プロジェクトID取得・表示
```

#### 3. カテゴリ5: GitHub Secrets管理に「前提条件」を明記

```markdown
### 一括設定の前提条件

以下が存在しない場合、まず**カテゴリ2「初回環境ファイル作成」**で環境変数ファイルを生成してください：
- `.env.keys`（dotenvx秘密鍵ファイル）
- `.env.production`（暗号化済み）
- `.env.preview`（暗号化済み）

#### 一括設定（既存の.env.keysがある場合）
```

---

## シナリオ3: 環境変数の初回設定

### 期待される動作

`.env.keys`が完全に不在の状態で環境変数を初回設定する場合：

1. カテゴリ2「環境変数管理」で`.env.local`を新規作成
2. dotenvxで暗号化 → `.env.keys`に秘密鍵が自動生成される
3. `.env.keys`を1Password等で共有する手順を案内

### 実際のSKILL.mdの記述

#### カテゴリ2: 環境変数管理 → チーム共有設定変更（SKILL.md 行173-181）

```markdown
#### チーム共有設定変更
1. AskUserQuestionで対象ファイルを選択（.env.local / .env.develop / .env.production / .env.preview）
2. `dotenvx decrypt -f <file> --stdout > <file>.tmp`
3. 変更内容をAskUserQuestionで確認
4. 編集実行
5. `rm <file> && mv <file>.tmp <file>`
6. `dotenvx encrypt -f <file>`
7. コミット案内
```

**⚠️ ギャップあり**: 暗号化済みファイルの復号が前提。未暗号化ファイルの初回作成フローがない。

#### カテゴリ2: 環境変数管理 → 新規環境変数追加（SKILL.md 行183-191）

```markdown
#### 新規環境変数追加
1. AskUserQuestionで変数名・用途・対象環境（local/develop/production/preview）を確認
2. 対象環境に応じた`.env.*`ファイルを特定
3. 暗号化ファイルの場合: チーム共有設定変更と同じフロー（decrypt→編集→encrypt）
4. 非暗号化ファイルの場合（.env/.env.personal）: 直接編集
5. AskUserQuestion: 他環境への展開が必要か確認
6. コミット案内（チーム共有設定の場合）
```

**⚠️ ギャップあり**: 「暗号化ファイルがまだ存在しない」場合の作成手順がない。

### ギャップ分析

#### 1. 初回暗号化ファイル作成フロー不在

- **SKILL.md**: 既存の暗号化ファイルの復号→編集→再暗号化のみ
- **ゼロ状態**: `.env.local`自体が存在しない

**問題点**: 「`.env.local`を初めて作成して暗号化する」手順が完全に欠落。

#### 2. `.env.keys`共有方法の案内不足

- **SKILL.md セクション5「秘密鍵の管理」（行293-336）**: 1Password保存の言及あり
- **カテゴリ2**: `.env.keys`への言及なし

**問題点**: 実際の操作フロー中に「秘密鍵を共有してください」という案内がない。

#### 3. `pnpm env:update`の実体が不明確

- **SKILL.md 行156**: 「`pnpm env:update` を実行すると、個人トークン設定・チーム共有設定変更を対話式ウィザードで実行できます」
- **実体（`scripts/env.ts`）**:
  - 個人トークン設定（`.env.personal`）
  - 環境設定変更（`.env.local`/`.env.develop`等の復号→編集→再暗号化）
  - 状態確認

**問題点**: `pnpm env:update`も既存ファイルの編集のみで、初回作成には対応していない。

### 影響度

- **Critical**: 初回暗号化ファイル作成フロー不在 → 新規プロジェクトで環境変数を設定できない
- **High**: `.env.keys`共有方法の案内不足 → チーム拡大時に共有が混乱
- **Medium**: `pnpm env:update`の実体不明 → ユーザーが期待と違う動作に戸惑う

### 修正提案

#### 1. カテゴリ2に「初回環境ファイル作成」を追加（シナリオ2と同じ）

#### 2. 「チーム共有設定変更」の冒頭に前提条件を追加

```markdown
#### チーム共有設定変更

**前提条件**: 対象ファイル（`.env.local`等）が既に暗号化されて存在すること。
初めて作成する場合は「初回環境ファイル作成」を実行してください。

1. AskUserQuestionで対象ファイルを選択...
```

#### 3. セクション5「秘密鍵の管理」をカテゴリ2の「参照ドキュメント」に追加

```markdown
### 参照ドキュメント
- `docs/einja/instructions/environment-setup.md`
- **秘密鍵の共有方法**: SKILL.md セクション5「秘密鍵の管理」参照
```

---

## 総合評価

### 現在の強み

1. **Phase 1の検出ロジックが適切**: ファイル存在・CLI存在を網羅的にチェック
2. **Phase 2の推奨ロジックが明確**: `.env.keys`不在時に適切なカテゴリを推奨
3. **Neon初期設定の完全性**: プロジェクト未作成からの手順が詳細
4. **エラーハンドリングの網羅性**: カテゴリ1の「エラー時の対処」が適切

### 重大なギャップ

| 問題 | 影響 | 優先度 |
|------|------|--------|
| `.env.keys`初回生成フロー不在 | CI/CD初回構築が不可能 | **Critical** |
| 初回暗号化ファイル作成フロー不在 | 新規プロジェクトで環境変数設定不可 | **Critical** |
| `.env.keys`入手方法の案内不足 | 初回セットアップが完全ブロック | **Critical** |
| Vercelプロジェクト未作成ケース不足 | 手動操作が必要だが案内なし | **High** |
| `pnpm dev:setup`の詳細不明 | ユーザーが何が起こるか理解できない | **High** |

### 修正の優先順位

#### Phase 1: Critical対応（初回セットアップ完全対応）

1. **カテゴリ1「ローカル環境セットアップ」の拡充**:
   - 「初回セットアップの前提条件」セクション追加
   - `.env.keys`入手方法の明示（1Password等）
   - `pnpm dev:setup`の実行内容詳細化

2. **カテゴリ2「環境変数管理」に「初回環境ファイル作成」追加**:
   - `.env.local`/`.env.production`等の新規生成フロー
   - dotenvx暗号化 → `.env.keys`自動生成
   - `.env.keys`の1Password保存案内

#### Phase 2: High対応（CI/CD初回構築対応）

3. **カテゴリ3「Vercel管理」の拡充**:
   - プロジェクト未作成時の手動作成案内
   - `vercel --confirm`での対話式作成フロー

4. **カテゴリ5「GitHub Secrets管理」の前提条件明記**:
   - `.env.keys`が存在しない場合の対処（カテゴリ2へ誘導）

#### Phase 3: Medium対応（ドキュメント整備）

5. **参照ドキュメントへのリンク強化**:
   - カテゴリ1 → `scripts/setup-dev.ts`へのリンク
   - カテゴリ2 → セクション5「秘密鍵の管理」へのリンク

---

## 参照ドキュメント検証

### `docs/einja/instructions/environment-setup.md`

- **セクション1（ローカル開発環境セットアップ）**: `pnpm dev:setup`の詳細が記載されている ✅
- **セクション4（暗号化手順）**: 既存ファイルの暗号化のみ。新規作成は**不足** ❌
- **セクション5（秘密鍵の管理）**: 1Password保存の案内あり ✅
- **セクション7（新規環境変数追加フロー）**: 既存ファイルへの追加のみ。初回作成は**不足** ❌

### `docs/einja/instructions/deployment-setup.md`

- **セクション0（ゼロからの統合初期構築フロー）**: 統合的な手順が記載されている ✅
- **Step 2: Neon初期設定**: 詳細あり ✅
- **Step 3: Vercel初期設定**: `vercel link`のみ。プロジェクト未作成ケースは**不足** ❌
- **Step 4: GitHub Secrets一括設定**: `.env.keys`が既存前提 ❌

### ドキュメント間の整合性

- **SKILL.md**: 対話的な実行フロー
- **environment-setup.md**: 詳細な手順書
- **deployment-setup.md**: 統合的な初回構築フロー

**問題点**: 3つのドキュメント間で「初回作成」フローが分散・不足している。SKILL.mdから適切に誘導できていない。

---

## 推奨される改善アクション

### 即時対応（Critical）

1. **SKILL.md カテゴリ1の「初回セットアップ」を以下に拡充**:
   ```markdown
   #### 初回セットアップの前提条件

   **必須**: `.env.keys`（dotenvx秘密鍵ファイル）
   - **新規プロジェクト**: カテゴリ2「初回環境ファイル作成」で生成
   - **既存プロジェクト**: チームから共有を受ける（1Password等）
   - **worktree環境**: 親worktreeから自動コピー（`pnpm dev:setup`が試行）

   `.env.keys`が不在の場合、`pnpm dev:setup`はフォールバック（`.env.example`→`.env`）しますが、
   本来の環境変数（DB接続文字列等）が不足するため、チームから入手してください。
   ```

2. **SKILL.md カテゴリ2に「初回環境ファイル作成」サブメニューを追加**（修正提案参照）

### 中期対応（High）

3. **`docs/einja/instructions/environment-setup.md`に「初回暗号化ファイル作成」セクションを追加**:
   - `.env.local`の初回作成フロー
   - dotenvx暗号化の実行
   - `.env.keys`の自動生成確認
   - 1Passwordへの保存手順

4. **SKILL.md カテゴリ3にVercelプロジェクト未作成ケースを追加**（修正提案参照）

### 長期対応（Medium）

5. **統合的な「初回セットアップガイド」を作成**:
   - 新規プロジェクトのゼロ状態から本番デプロイまでの完全な手順
   - `deployment-setup.md`のセクション0を拡充
   - SKILL.mdから明示的にリンク

---

## 結論

**infra-maintenance Skillは既存プロジェクトへの参加（`.env.keys`を共有済み）には適切に対応しているが、完全なゼロ状態（新規プロジェクト・初回構築）には Critical なギャップが存在する。**

特に以下の3つのシナリオで初回ユーザーがブロックされる：

1. **新規開発者の初回セットアップ**: `.env.keys`の入手方法が不明確
2. **新規プロジェクトのCI/CD構築**: `.env.keys`の初回生成フローが欠落
3. **環境変数の初回設定**: 暗号化ファイルの新規作成手順が不在

これらを解決するには、**カテゴリ2に「初回環境ファイル作成」を追加**し、**カテゴリ1の前提条件を明確化**することが最優先となる。
