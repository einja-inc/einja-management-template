# infra-maintenance Skill: ゼロ状態セットアップ対応 改善計画

## Context

infra-maintenance Skill が「一度もインフラ設定がされていないゼロ状態」からのセットアップに対応できるかを Explore + Codex で並行検査した。

**結論: 部分的にしか対応できていない（対応度 60%）**

既存プロジェクトへの参加（`.env.keys` を 1Password から取得済み）には概ね対応しているが、以下の2つのシナリオで Critical なギャップが存在する:

1. **新規プロジェクトの初回構築**: 暗号化ファイルの初回作成フロー、`.env.keys` の生成フローが完全に欠落
2. **ゼロ状態からの統合フロー**: 複数の❌が検出された場合に何から始めるべきかの案内がない

> **注意**: `setup-dev.ts` 自体は `.env.keys` 不在時のフォールバック（`.env.example` → `.env`）を持っており、ローカル開発は最低限動作する。しかし SKILL.md はこの実態を反映していない。

---

## 検出された問題（優先度順）

### Critical（初回ユーザーがブロックされる）

| # | 問題 | 影響 | 対象 |
|---|------|------|------|
| C-1 | Phase 1/2: 複数❌検出時の統合フロー（ゼロ状態判定）がない | どのカテゴリから始めるべきか不明 | SKILL.md Phase 2 |
| C-2 | カテゴリ2: 暗号化ファイルの初回作成フローがない | 新規プロジェクトで環境変数を設定できない | SKILL.md カテゴリ2 |

### High（手順が不完全）

| # | 問題 | 影響 | 対象 |
|---|------|------|------|
| H-1 | カテゴリ1: `pnpm dev:setup` が何を実行するかの説明がない | ユーザーが何が起こるか理解できない | SKILL.md カテゴリ1 |
| H-2 | カテゴリ3: Vercelプロジェクト未作成時の手順がない（`vercel link` のみ） | プロジェクト新規作成が案内されない | SKILL.md カテゴリ3 |
| H-3 | カテゴリ1: Docker未インストール時の案内がない | PostgreSQL起動前にDockerが必要 | SKILL.md カテゴリ1 |

### Medium（改善余地）

| # | 問題 | 影響 | 対象 |
|---|------|------|------|
| M-1 | カテゴリ4: `.env.preview` が未存在時の NEON_PROJECT_ID 設定が簡略すぎ | `pnpm env:update` への誘導がない | SKILL.md カテゴリ4 |
| M-2 | deployment-setup.md Section 0 との順序不整合 | どちらを信頼すべきか混乱 | SKILL.md/deployment-setup.md |

---

## 修正計画

### 修正ファイル: `.claude/skills/einja-infra-maintenance/SKILL.md`

#### 修正1: Phase 2 にゼロ状態判定ロジックを追加（C-1）

**箇所**: Phase 2「意図判定とメインメニュー」セクション（74行目付近）の「意図が明確な場合」の前に追加

**追加内容**:
```markdown
### ゼロ状態の検出と統合初期構築フロー

Phase 1 で以下の条件が同時に成立した場合、「ゼロ状態」と判定し、統合初期構築フローを提案する:

**判定条件**: `.env.keys`不在 AND (`.env.personal`不在 OR vercel CLI未インストール OR neonctl未インストール)

**提案**: AskUserQuestion で以下を選択させる:

| 選択肢 | 説明 |
|--------|------|
| ローカル開発のみ（推奨） | 最速で開発環境を起動: カテゴリ1 → 2 |
| 本番デプロイまで | CI/CD含む完全セットアップ: カテゴリ1 → 4 → 3 → 5 → 2 |
| いいえ（個別選択） | 通常のメインメニューを表示 |

> **参照**: 完全セットアップの詳細手順は `docs/einja/instructions/deployment-setup.md` セクション0「ゼロからの統合初期構築フロー」を参照
```

#### 修正2: カテゴリ1 のセットアップ詳細を拡充（H-1, H-3）

**箇所**: カテゴリ1「エラー時の対処」テーブル（134-140行目）

**変更**: Docker未インストール時の案内を追加（`.env.keys` 不在の対処は現状維持）

追加行:
```
| Docker未インストール | `docker --version` で確認 → 未インストール時は [OrbStack](https://orbstack.dev/) のインストールを案内 |
```

**箇所**: カテゴリ1「初回セットアップ」（128-131行目）

現在:
```
#### 初回セットアップ
1. `pnpm install` で依存関係インストール
2. `pnpm dev:setup` で環境セットアップ
3. エラー時: エラー内容を分析し、対話的にトラブルシュート
```

修正後:
```
#### 初回セットアップ
1. `pnpm install` で依存関係インストール
2. `pnpm dev:setup` で環境セットアップ（以下を自動実行）:
   - Volta / direnv / dotenvx の自動インストール（macOS）
   - `.env.keys` が存在する場合: `.env.local` を復号して `.env` を生成
   - `.env.keys` が不在の場合: worktree親からのコピーを試行 → 失敗時は `.env.example` からフォールバック
   - GITHUB_TOKEN の対話式設定
   - PostgreSQL 起動（Docker）+ Prisma セットアップ
3. エラー時: エラー内容を分析し、対話的にトラブルシュート
```

#### 修正3: カテゴリ2 に「初回環境ファイル作成」サブメニューを追加（C-2）

**箇所**: カテゴリ2 サブメニュー（149行目付近）に追加

**追加内容**:
```markdown
- **初回環境ファイル作成**: 新規プロジェクト用。`.env.local`等を新規作成し暗号化（`.env.keys` が自動生成される）
```

カテゴリ2 の実行手順セクションに新セクション追加:
```markdown
#### 初回環境ファイル作成（新規プロジェクト用）
1. AskUserQuestionで作成する環境を選択（.env.local / .env.develop / .env.staging / .env.production / .env.preview）
2. `.env.example` をベースにファイルを作成
3. AskUserQuestionで必須環境変数の値を入力（DATABASE_URL, AUTH_SECRET 等）
4. `dotenvx encrypt -f <file>` で暗号化（`.env.keys` に秘密鍵が自動追記される）
5. AskUserQuestion: 「`.env.keys` を 1Password に保存しましたか？」（保管先URL案内）
6. 他環境のファイルも作成が必要か確認 → 必要なら手順1に戻る
7. GitHub Secrets への登録を促す（カテゴリ5へ遷移案内）

> **注意**: `.env.keys` は全環境の秘密鍵を含む重要ファイル。必ず 1Password 等で安全に共有すること。
```

#### 修正4: カテゴリ3 にプロジェクト新規作成フローを追加（H-2）

**箇所**: カテゴリ3 サブメニュー（197行目付近）

現在:
```
- **初期設定**: プロジェクト作成・リンク・Root Directory設定
```

修正後:
```
- **新規プロジェクト作成**: Vercelプロジェクトを新規作成しリンク
- **既存プロジェクト接続**: 既存プロジェクトにリンク・Root Directory設定
```

実行手順の「初期設定」を「新規プロジェクト作成」と「既存プロジェクト接続」に分割:
```markdown
#### 新規プロジェクト作成
1. VERCEL_TOKEN確認 → 未設定時はURL案内 + `.env.personal`保存
2. AskUserQuestionでアプリ選択（web / admin）
3. `vercel --confirm` で新規プロジェクト作成（対話式）
4. Root Directory設定（API経由）
5. プロジェクトID取得・表示
6. VERCEL_ORG_ID / VERCEL_PROJECT_ID を `.env.personal` に記録

> **詳細手順**: `docs/einja/instructions/vercel-cli-reference.md` を参照

#### 既存プロジェクト接続
（現在の「初期設定」の内容をそのまま維持）
```

#### 修正5: カテゴリ4 の `.env.preview` 設定を詳細化（M-1）

**箇所**: カテゴリ4 初期設定の手順3（258行目）

現在:
```
3. NEON_PROJECT_IDを`.env.preview`に設定 → dotenvx暗号化
```

修正後:
```
3. NEON_PROJECT_IDを`.env.preview`に設定:
   - `.env.preview`が既存の場合: `pnpm env:update` で対話式に設定
   - `.env.preview`が未存在の場合: カテゴリ2「初回環境ファイル作成」で先に作成
```

---

## 修正対象ファイル

| ファイル | 修正内容 |
|---------|---------|
| `.claude/skills/einja-infra-maintenance/SKILL.md` | 修正1〜5の全て |

> **注**: `deployment-setup.md` や `environment-setup.md` の修正は今回のスコープ外。SKILL.md から適切に参照・誘導することで対応する。

---

## 検証方法

1. `pnpm prepush` で lint/typecheck/test が通ることを確認
2. SKILL.md を Read して全修正がディスク上に反映されていることを確認
3. 以下のシナリオで SKILL.md のフローを追跡し、ブロックが発生しないことを確認:
   - シナリオA: `.env.keys` なし + 単一worktree → 1Password案内 → カテゴリ1完了
   - シナリオB: 完全ゼロ状態 → ゼロ状態判定 → 「ローカル開発のみ」選択 → カテゴリ1→2
   - シナリオC: 完全ゼロ状態 → 「本番デプロイまで」選択 → カテゴリ1→4→3→5→2

## 調査レポート

- Explore: `docs/plans/warm-hopping-lighthouse-agent-a30aa4f.md`
- Codex: `docs/plans/warm-hopping-lighthouse-agent-a57a278.md`
