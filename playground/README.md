# Playground: 開発基盤学習環境

## 概要

このplayground環境は、einja-management-templateの開発基盤を学習・検証するための環境です。

**主要機能**:
- 5層エージェント構造（task-starter/executer/reviewer/qa/finisher）
- ATDD形式の仕様書パイプライン
- QA Skill（task-qa/）による品質保証
- 7つのMCP統合（GitHub、Vibe-Kanban、Playwright等）

## 特徴

### 1. 実践的な学習環境
- 簡略化されたモノレポ構造（apps/sample-app、packages/sample-db）
- 実際のPrismaマイグレーション、APIエンドポイント作成を体験
- Turboタスク（test、lint、build）の実行

### 2. 段階的な学習パス
- **Level 0 (Quick Start)**: 5分で成功体験
- **Level 1 (Basics)**: コンポーネント単位の理解
- **Level 2 (Intermediate)**: ワークフロー全体の理解
- **Level 3 (Advanced)**: 実践応用

### 3. 独立した環境
- モックデータ使用
- 本番環境に影響を与えない

## セットアップ

```bash
# ルートディレクトリから実行
bash playground/setup.sh
```

## 使い方

### Quick Start（5分）

```bash
cd playground/00-quick-start
cat README.md
./verify.sh
```

### Level 1: 基礎理解

```bash
cd playground/01-basics/01-task-structure
cat README.md
```

### Level 2: 統合理解

```bash
cd playground/02-intermediate/01-full-pipeline
cat README.md
```

### Level 3: 実践応用

```bash
cd playground/03-advanced/02-real-task-example
cat README.md
```

## ディレクトリ構造

```
playground/
├── apps/sample-app/          # サンプルNext.jsアプリ
├── packages/sample-db/       # サンプルPrismaパッケージ
├── 00-quick-start/           # クイックスタート
├── 01-basics/                # 基礎理解
├── 02-intermediate/          # 統合理解
├── 03-advanced/              # 実践応用
├── mock-data/                # モックデータ
├── tools/                    # 診断ツール
└── docs/                     # ドキュメント
```

## 注意事項

- GitHub Issueは手動で作成してください（mock-data/issues/からコピペ）
- PostgreSQLが起動していることを確認してください（`docker-compose up -d postgres`）
- DATABASE_URLを.env.playgroundに設定してください

## トラブルシューティング

問題が発生した場合は、診断ツールを実行してください：

```bash
bash playground/tools/diagnose.sh
```

詳細は `docs/troubleshooting.md` を参照してください。

## 学習ロードマップ

1. **環境セットアップ** (10分)
   - setup.sh実行
   - 診断ツールで環境確認
   - PostgreSQL準備

2. **Quick Start** (5分)
   - 最小限のタスク実行
   - 開発基盤の基本フローを体験

3. **Level 1: 基礎理解** (1-2時間)
   - タスク構造の理解
   - タスク選定ロジックの学習
   - ATDD仕様書の構造

4. **Level 2: 統合理解** (2-3時間)
   - フルパイプライン実行
   - QAワークフロー
   - エラーリカバリー

5. **Level 3: 実践応用** (実践次第)
   - カスタムエージェント作成
   - 実タスク演習
   - 統合テスト

## リソース

- [開発基盤アーキテクチャ解説](./docs/architecture.md)
- [エージェントフロー図解](./docs/agent-flow.md)
- [トラブルシューティング](./docs/troubleshooting.md)
