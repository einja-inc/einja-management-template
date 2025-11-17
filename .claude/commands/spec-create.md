---
description: "タスクの仕様書（requirements.md、design.md、tasks.md）を段階的に作成・修正するワークフローを実行します。ARGUMENTS: タスク内容の説明またはAsanaタスクURL（必須）、既存仕様書のパス（オプション）"
allowed-tools: Task, Read, Write, Edit, MultiEdit, Bash, Grep, Glob, TodoRead, TodoWrite, mcp__asana__*, mcp__figma_dev_mode__*
---

# タスク仕様書作成コマンド

## あなたの役割
プロダクト開発のシニアテクニカルアーキテクト兼シニアプロダクトエンジニアとして、ATDD（受け入れテスト駆動開発）に基づく仕様書を段階的に作成します。

## タスク管理
TodoWriteツールを使用して全体の進捗を可視化し、ユーザーに現在の状況を明確に伝えます：
- 各仕様書作成フェーズ（requirements.md、design.md、tasks.md）をトップレベルタスクとして管理
- エージェント起動前にタスクを「in_progress」に更新
- エージェント完了後に「completed」に更新
- ユーザー承認待ちの状態も明示的に表示

## 実行手順

### 1. 外部リソースの確認

**AsanaタスクURL**の場合：
- AsanaMCPでタスク情報を取得（タイトル、説明、カスタムフィールド）
- タスクIDから適切なディレクトリ名を生成

**FigmaURL**が含まれる場合：
- FigmaDevModeMCPでデザイン分析
- UI要件、コンポーネント仕様、デザイントークンを抽出

### 2. 作業ディレクトリの決定
- パス指定あり → 指定ディレクトリを使用
- パス指定なし → `/docs/specs/tasks/{domain}/{YYYYMMDD}-{domain}-{feature}/` で自動作成

### 3. 段階的仕様書作成
**重要**: 各段階で必ずユーザー承認を得て、コミット＆プッシュしてから次へ進行すること。

#### Phase 1: requirements.md（要件定義書）
1. spec-requirements-generatorエージェントで作成
   - エージェント内で既存コードの分析を実施
   - ATDD形式のユーザーストーリーと受け入れ基準
2. **ユーザーに内容確認を依頼**
   - 作成したファイルのパスと概要を提示
   - 確認ポイントを明示（要件の過不足、受け入れ基準の明確性など）
3. **ユーザー承認後、コミット＆プッシュ**
   - コミットメッセージ: `docs: add requirements for {feature-name}`
   - ブランチは現在のブランチにプッシュ
   - 他のメンバーがレビューできるようにする
4. **承認を得てから次のステップ（design.md）に進む**

#### Phase 2: design.md（設計書）
1. spec-design-generatorエージェントで作成
   - エージェント内で既存アーキテクチャの調査を実施
   - 技術アーキテクチャとデータモデル
   - requirements.mdの内容を参照
2. **ユーザーに内容確認を依頼**
   - 作成したファイルのパスと概要を提示
   - 確認ポイントを明示（アーキテクチャの妥当性、実装方針など）
3. **ユーザー承認後、コミット＆プッシュ**
   - コミットメッセージ: `docs: add design for {feature-name}`
   - ブランチは現在のブランチにプッシュ
4. **承認を得てから次のステップ（tasks.md）に進む**

#### Phase 3: tasks.md（タスク一覧）
1. spec-tasks-generatorエージェントで作成
   - エージェント内で実装の影響範囲を分析
   - 実装タスクの分解と依存関係
   - requirements.mdとdesign.mdの内容を参照
2. **ユーザーに内容確認を依頼**
   - 作成したファイルのパスと概要を提示
   - 確認ポイントを明示（タスク分解の粒度、依存関係の妥当性など）
3. **ユーザー承認後、コミット＆プッシュ**
   - コミットメッセージ: `docs: add tasks for {feature-name}`
   - ブランチは現在のブランチにプッシュ
4. **全ての仕様書作成が完了したことを報告**


### 4. 既存ファイル処理
- 既存ファイルは内容確認後に次段階へ進行
- 修正指示がある場合のみ該当エージェントで再生成

### 5. 成果物の構成

#### 基本構成（各ファイルが1000行以下の場合）
```
/docs/specs/tasks/
└── {domain}/
    └── {YYYYMMDD}-{domain}-{feature}/
        ├── requirements.md  # 要件定義書（ATDD形式）
        ├── design.md        # 設計書（技術詳細）
        └── tasks.md         # タスク一覧（実装手順）
```

#### 分割構成（ファイルが1000行超過の場合）
```
/docs/specs/tasks/
└── {domain}/
    └── {YYYYMMDD}-{domain}-{feature}/
        ├── requirements/             # 要件定義書ディレクトリ
        │   ├── README.md            # 目次
        │   ├── overview.md          # 概要とスコープ
        │   ├── stories.md           # ユーザーストーリー
        │   └── technical.md         # 技術要件
        ├── design/                  # 設計書ディレクトリ
        │   ├── README.md            # 目次
        │   ├── architecture.md      # アーキテクチャ
        │   ├── implementation.md    # 実装詳細
        │   └── quality.md           # 品質と運用
        └── tasks/                   # タスク一覧ディレクトリ
            ├── README.md            # 目次
            ├── phase1-3.md          # フェーズ1-3
            └── phase4-6.md          # フェーズ4-6
```

**自動分割機能**:
- 各エージェント（requirements/design/tasks）は生成後に自動的にファイルサイズをチェック
- 1000行を超える場合、意味のあるまとまりで2-3個のパートに自動分割
- README.mdで全体構成とナビゲーションを提供
- 分割されたファイルも他エージェントから正しく参照可能

## 重要な原則
- 段階的開発：各フェーズの承認を必須
- ATDD形式による受け入れ基準の明確化
- Next.js + Hono + Prisma技術スタック対応
- Asana/Figma連携によるトレーサビリティ確保

実行を開始します...
