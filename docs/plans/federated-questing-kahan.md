# Plan: README.md 古い情報の修正

## Context

README.md の徹底調査により、プロジェクトの実態と乖離した記述が **14件** 発見された。開発者向けセクションだけでなく、パッケージ利用者向けセクション（create-einja-app / @einja/dev-cli の使い方）にも複数の古い情報がある。

## 修正対象ファイル

- `README.md`

## 修正一覧

### A. パッケージ利用者向けセクション（行7-98）

| # | 行 | 深刻度 | 問題 | 修正内容 |
|---|-----|--------|------|---------|
| A1 | 59-63 | 高 | `.claude/skills/` の説明が「コーディング規約、コンポーネント設計ガイド」 | 「ATDDワークフロー用スキル（タスク実行、QAテスト、コミット管理、コンフリクト解消等）」に修正 |
| A2 | 63 | 高 | `.claude/hooks/` を「Git Hooks」と記載 | 「Claude Code Hooks（コード品質チェック、型検証、機密情報検出等）」に修正 |
| A3 | 63 | 中 | `.claude/settings.json` を「MCPサーバー設定」と記載 | initで実際に作成されるのは `.mcp.json`。settings.jsonの記述を修正 |
| A4 | 64-68 | 中 | `docs/einja/` の説明が不完全 | `instructions/`（操作手順書）と `example/`（サンプル仕様書）も追加 |
| A5 | 68 | 低 | 「`package.json` にスクリプトが追加される」の記述が不完全 | `lint`, `format`, `typecheck`, `prepush` も追加されることを記載 |
| A6 | 20 | 低 | 「Turborepo + Next.js 15 + Prisma のモノレポ構成」のみ | テンプレートには `apps/admin/` も含まれることを補足 |
| A7 | 37 | 低 | create-einja-app のオプション `--yes` 記載 | CLIの `.option()` に `--yes` が未登録（バグ）。README側は現状維持し、CLI修正を別Issueで対応 |

### B. パッケージ開発者向けセクション（行102-）

| # | 行 | 深刻度 | 問題 | 修正内容 |
|---|-----|--------|------|---------|
| B1 | 110-142 | 高 | プロジェクト構成図に `apps/admin/` が未記載 | `apps/admin/` を追加 |
| B2 | 110-142 | 高 | プロジェクト構成図に `packages/admin-ui/` が未記載 | `packages/admin-ui/` を追加 |
| B3 | 277 | 高 | `PostgreSQL 15` と記載 | `PostgreSQL 16` に修正 |
| B4 | 289 | 中 | Docker接続コマンドの DB名 `-d einja_management` | `-d main` に修正（POSTGRES_DB の実際の値） |
| B5 | 133-137 | 軽微 | `server-core/src/` に `utils/` があると記載 | `core/`・`testing/` に修正 |
| B6 | 314-319 | 軽微 | packagesセクションに `@repo/admin-ui` の説明なし | admin専用UIコンポーネントとして追加 |
| B7 | 269 | 軽微 | ワークスペース固有コマンドの filter 例 `@repo/web` のみ | `@repo/admin` の例も追加 |

## 実装手順

1. サブエージェントに README.md の全修正を委託（1エージェント、全修正を一括）
2. `git diff` で意図しない変更がないか確認
3. `--yes` バグは別途対応（本タスクのスコープ外）

## 検証

- 修正後の README.md を `Read` で確認
- 変更されたリンク先がすべて実在することを確認（調査済み）
- `git diff --stat` で変更ファイルが README.md のみであることを確認
