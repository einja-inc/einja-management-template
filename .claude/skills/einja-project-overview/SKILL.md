---
name: project-overview
description: "プロジェクトの全体構成・技術スタックの参照ハブ"
---

# プロジェクト概要 Skill

## 概要

このSkillは、プロジェクトの全体構成・技術スタックを把握したいときに参照するエントリポイントです。

## プロジェクト概要

- **構成**: Turborepoモノレポ（pnpm workspaces）
- **アプリ**: `apps/web`（メイン管理画面）
- **共通パッケージ**: `@repo/config`, `@repo/front-core`, `@repo/server-core`, `@repo/ui`

## 詳細ドキュメント

@docs/einja/steering/architecture.md

## 関連ドキュメント

- `docs/einja/steering/development/coding-standards.md` - コーディング規約（インポートパス規約含む）
- [infra-maintenance](../einja-infra-maintenance/SKILL.md) - 開発環境セットアップ・サーバー管理
- `docs/einja/steering/development/component-design.md` - コンポーネント設計ガイドライン

## 頻出コマンド

- `pnpm dev:bg` / `pnpm dev:stop` - 開発サーバー起動/停止
- `pnpm build` - プロダクションビルド
- `pnpm lint:fix && pnpm format:fix` - コード自動修正
- `pnpm typecheck` - 型チェック
- `pnpm test` - テスト実行
- `pnpm prepush` - プッシュ前チェック（lint + typecheck + test）

<!-- @einja:project-private:start id="einja-project-overview-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
