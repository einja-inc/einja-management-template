# einja-start-dev Skill 改善計画

## Context

einja-start-dev Skillは開発環境の起動を担当するが、現状では初回チェックアウト時の完全自動起動、起動後のURL報告、エラー時のリカバリフローが不足している。開発者（人間・Claude問わず）が `pnpm dev` 一発で環境を立ち上げられるよう、スクリプトとSkill定義の両方を改善する。

## 現状

### scripts/worktree/dev.ts の動作フロー
1. `getConfig()` → worktree.config.json読み込み
2. backgroundモードならログ初期化 + 既存サーバー停止
3. `getCurrentBranch()` → `generateDatabaseName()` → `calculatePorts()`
4. `ensurePorts()` でポート解放
5. `writeEnvFile()` で .env.local を dotenvx で復号
6. `startPostgres()` → `ensureDatabaseExists()` → `runMigration()`
7. サマリ表示（URL含む）→ `startDevServer()` で turbo run dev 実行

### 不足点
- **pnpm install未実行**: node_modulesがなければtsxが動かないが自動実行なし
- **Claude向けフロー未定義**: SKILL.mdにはpnpmコマンドの羅列のみ
- **起動URL未報告**: サマリはlog/dev.logに流れるがClaudeが読んで報告する手順なし
- **dev:statusにURL非表示**: PID・ポート確認のみ
- **エラーリカバリなし**: process.exit(1)で終了するだけ

### 対象ファイル
- `scripts/worktree/dev.ts` — メインスクリプト（main: L777-878, showDevStatus: L914-946, startDevServer: L705-748）
- `.claude/skills/einja-start-dev/SKILL.md` — Skill定義

## 変更内容

### A. scripts/worktree/dev.ts の改修

#### A-1. pnpm install自動実行（bootstrapスクリプト方式）
- **問題**: `pnpm dev` は `tsx scripts/worktree/dev.ts` を実行するが、node_modulesがなければtsxが存在せず到達不能
- **解決**: package.jsonの`dev`スクリプトをshellラッパーに変更し、tsx呼び出し前にnode_modules存在確認を行う
  ```json
  "dev": "[ -d node_modules ] && tsx scripts/worktree/dev.ts || (pnpm install && tsx scripts/worktree/dev.ts)"
  ```
- `dev:bg` も同様に修正（`--background` フラグ付き）
- これにより初回チェックアウト時も `pnpm dev` 一発で起動可能になる
- dev.ts内の `ensureNodeModules()` は不要（shellレベルで対応済み）

#### A-2. showDevStatus() にURL情報を追加
- L914-946の `showDevStatus()` を改修
- 計算済みポートからURL一覧を生成して表示
- .envファイルからDATABASE_URLも表示

#### A-3. backgroundモードのログにURL情報を追加
- `startDevServer()` のbackgroundモード完了メッセージ（L742付近）にURL情報を追加
- 環境変数 `PORT_*` からアプリURLを生成して表示
- `--skip-setup` 経路では `envVars` が空のため、`calculatePorts()` でフォールバック計算する設計とする

### B. SKILL.md の全面改修
- **allowed-tools**: `Read` を追加（ログ読み取り用）
- **Claude向け実行フロー**: 5ステップの明確な手順
  1. 前提チェック（node_modules、Docker）
  2. 起動（pnpm dev:bg）
  3. 起動確認（log/dev.log監視）
  4. 報告（URL、ログ場所、停止方法）
  5. エラー時リカバリ（自動修正 → infra-maintenance連携）
- エラー検知方法の具体化: exit codeチェック、ログの特定パターン（`Error`、`EADDRINUSE`等）検索手順を明記
- 存在しないコマンド（`pnpm env:prepare`）や未実装オプション（`--no-kill`）の記載を削除・修正
- 既存のコマンド一覧・オプション・トラブルシューティングは維持（ただし実装と一致するよう修正）

## タスク概要

| ID | タスク | 依存 | Skill/ツール |
|----|--------|------|-------------|
| 0-0 | TaskCreateでタスク一括登録 | - | [TaskCreate] |
| 0-1 | Planファイルを `docs/plans/202603/20260314-start-dev-improve.plan.md` にリネーム | 0-0 | [Bash] |
| 1-0 | package.jsonのdev/dev:bgスクリプトをshellラッパーに変更（bootstrap対応） | 0-1 | [general-purpose] |
| 1-1 | dev.tsの2箇所改修（showDevStatus URL表示 + backgroundログURL追加 + skip-setupフォールバック） | 0-1 | [general-purpose] |
| 2-1 | SKILL.mdをClaude向け実行フロー付きに全面改修 | 0-1 | [general-purpose] |
| 99-1 | コードレビュー | 1-1, 2-1 | [einja-review-code] |
| 99-2 | 動作確認: `pnpm dev:status` でURL表示確認 | 99-1 | [Bash] |
| 99-G | コミット承認ゲート | 99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

- **タスク 1-0, 1-1, 2-1 は並列実行可能**（異なるファイルまたは異なる箇所を変更）
- 1-0: package.json変更、1-1: dev.ts変更、2-1: SKILL.md変更 — 全て異なるファイル

## リスク・不明点

1. **配布対象**: SKILL.mdはeinja-プレフィックスで配布対象。下流プロジェクトでも動作する汎用的な記述が必要
2. **showDevStatusのポート計算**: L937でcalculatePorts()を呼んでいることを確認済み。URL表示追加は素直に実装可能
3. **shellラッパーのクロスプラットフォーム**: `[ -d node_modules ]` はmacOS/Linuxで動作。Windows対応は現時点では不要（開発環境はmacOS前提）

## 検証・動作確認方法

1. `pnpm dev:status` を実行し、URL情報が表示されることを確認
2. SKILL.mdの内容を目視レビューし、Claude実行フローが明確であることを確認
3. （手動テスト推奨）node_modules削除後に `pnpm dev` でpnpm installが自動実行されることを確認
