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

## 関連Skill

- [coding-standards](../einja-coding-standards/SKILL.md) - コーディング規約（インポートパス規約含む）
- [infra-maintenance](../einja-infra-maintenance/SKILL.md) - 開発環境セットアップ・サーバー管理
- [component-design](../einja-component-design/SKILL.md) - コンポーネント設計ガイドライン
