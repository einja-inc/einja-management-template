# Playgroundアーキテクチャ解説

## 概要

このドキュメントでは、playground環境のアーキテクチャと、本リポジトリの開発基盤の構造について解説します。

## モノレポ構造

### Turborepo + pnpm Workspaces

playgroundは、本番環境と同じTurborepo + pnpm Workspaces構成を簡略化して再現しています。

```
playground/
├── package.json              # ルートpackage.json
├── pnpm-workspace.yaml       # pnpm workspace設定
├── turbo.json                # Turboタスク定義
├── apps/                     # アプリケーション
│   └── sample-app/           # Next.js 15アプリ
└── packages/                 # 共通パッケージ
    └── sample-db/            # Prismaパッケージ
```

### Turboタスク

turbo.jsonで定義されているタスク：

- `dev`: 開発サーバー起動
- `build`: プロダクションビルド
- `test`: テスト実行
- `db:generate`: Prismaクライアント生成
- `db:push`: Prismaマイグレーション実行

## 5層エージェント構造

本リポジトリの開発基盤は、5層のエージェント構造で構成されています：

### Layer 1: 仕様書生成層
- spec-requirements-generator
- spec-design-generator
- spec-tasks-generator
- spec-qa-generator

### Layer 2: タスク選定層
- task-starter: GitHub Issueからタスクを選定

### Layer 3: 実装層
- task-executer: requirements.md & design.mdベースで実装

### Layer 4: QA層
- task-reviewer: 要件整合性確認
- task-qa: QA Skill呼び出し
- [ループ] 失敗 → executer再実行

### Layer 5: 完了処理層
- task-finisher: タスク完了、Issue更新
- task-modification-analyzer: 追加修正判定

## ATDD形式の仕様書

### requirements.md

受け入れテスト駆動開発（ATDD）形式の要件定義書：

- ユーザーストーリー
- 受け入れ条件（AC）
- 検証レベル（Unit/Integration/E2E）

### design.md

設計仕様書：

- アーキテクチャ図
- データフロー図（DFD）
- API設計
- テーブル設計

### tasks.md

GitHub Issue内に記述されるタスク一覧：

- Phase構造
- タスクグループ
- 依存関係
- 完了条件

## QA Skillの仕組み

task-qa Skillは7段階のQAプロセスを実行します：

1. 引数解析
2. 仕様書読み込み
3. 必須自動テスト（test/lint/build/typecheck/e2e）
4. AC抽出（Integration/E2E ACのみ）
5. 動作確認（Playwright/curl/スクリプト）
6. 失敗分類（A/B/C/D）
7. qa-tests/記録

## MCP統合

7つのMCPサーバーが統合されています：

- **GitHub**: Issue/PR管理、コード検索
- **Asana**: タスク情報取得
- **Vibe-Kanban**: カンバン管理
- **Playwright**: E2Eテスト自動化
- **Serena**: コード探索・リファクタリング
- **Context7**: ライブラリドキュメント取得
- **Codex**: コード分析

## Playgroundでの学習フロー

### Phase 1: 基盤理解
1. モノレポ構造の理解
2. Turboタスクの実行
3. Prismaマイグレーション

### Phase 2: エージェント理解
1. task-starterの動作
2. task-executerの実装プロセス
3. task-qaの品質保証

### Phase 3: 実践応用
1. カスタムエージェント作成
2. 実タスク実装
3. 統合テスト

## 参考リソース

- [エージェントフロー図解](./agent-flow.md)
- [トラブルシューティング](./troubleshooting.md)
- メインリポジトリ: `/docs/steering/architecture.md`
