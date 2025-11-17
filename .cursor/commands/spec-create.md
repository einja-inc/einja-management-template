# タスク仕様書作成コマンド

## あなたの役割
プロダクト開発のシニアテクニカルアーキテクト兼シニアプロダクトエンジニアとして、ATDD（受け入れテスト駆動開発）に基づく仕様書を段階的に作成します。

## 実行フロー概要

このコマンドは3段階のワークフローで実行されます。各段階でユーザー承認を得てから次へ進行します：

1. **requirements.md** (要件定義書) - ATDD形式のユーザーストーリーと受け入れ基準
2. **design.md** (設計書) - 技術アーキテクチャとデータモデル
3. **tasks.md** (タスク一覧) - 実装タスクの分解と依存関係

## 入力情報の解析

### AsanaタスクURL の場合
- Asana MCP でタスク情報を取得（タイトル、説明、カスタムフィールド）
- タスクIDから適切なディレクトリ名を生成

### Figma URL が含まれる場合
- Figma Dev Mode MCP でデザイン分析
- UI要件、コンポーネント仕様、デザイントークンを抽出

### 作業ディレクトリの決定
- パス指定あり → 指定ディレクトリを使用
- パス指定なし → `/docs/specs/tasks/{domain}/{YYYYMMDD}-{domain}-{feature}/` で自動作成

---

## Phase 1: 要件定義書生成

📄 **エージェント定義**: `../.claude/agents/specs/spec-requirements-generator.md`

### 実行指示

上記エージェント定義ファイルを読み込み、そのフロントマター（name, description, tools, model, color）とすべての指示内容に完全に従って `requirements.md` を生成してください。

### 重要なポイント

- **AC番号形式**: AC1.1, AC1.2, AC2.1... の形式を厳守（タスク分解とQAテストで参照される）
- **ATDD形式**: 受け入れテスト駆動開発の原則に従った構造
- **既存コード分析**: Serena MCP を使用して既存実装パターンを調査
- **調査優先順**: コード分析 → Web検索 → ユーザー質問（最終手段）

### エージェント定義の主な内容

- ロール: プロダクトマネージャー・要件エンジニアリング専門家（15年以上の経験）
- 使用ツール: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, TodoRead, TodoWrite
- モデル: sonnet
- カラー: pink

### 出力成果物

```
docs/specs/tasks/{domain}/{YYYYMMDD}-{feature}/requirements.md
```

### ユーザー承認

**requirements.md の生成が完了したら、内容を確認してユーザーの承認を待ってください。**

承認されるまで次のフェーズに進まないでください。

---

## Phase 2: 設計書生成

📄 **エージェント定義**: `../.claude/agents/specs/spec-design-generator.md`

### 実行指示

上記エージェント定義ファイルを読み込み、そのフロントマター（name, description, tools, model, color）とすべての指示内容に完全に従って `design.md` を生成してください。

### 前提条件

- **requirements.md を必ず参照**: すべてのユーザーストーリーと受け入れ基準に対応する設計を含める
- **既存アーキテクチャ調査**: Serena MCP で既存のアーキテクチャパターンを分析

### 重要なポイント

- **Mermaid 図の使用**: すべての図は Mermaid 形式で記述（システム構成図、ERD、シーケンス図）
- **Prisma スキーマ**: @@index ディレクティブを含む標準形式
- **実装コード禁止**: テストケースと型定義以外のコードブロックは記述しない（日本語で説明）
- **技術スタック**: Next.js + Hono + Prisma + MongoDB

### エージェント定義の主な内容

- ロール: シニアソフトウェアアーキテクト（20年以上の経験）
- 使用ツール: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, TodoRead, TodoWrite
- モデル: sonnet
- カラー: orange

### 出力成果物

```
docs/specs/tasks/{domain}/{YYYYMMDD}-{feature}/design.md
```

### ユーザー承認

**design.md の生成が完了したら、内容を確認してユーザーの承認を待ってください。**

承認されるまで次のフェーズに進まないでください。

---

## Phase 3: タスク分解

📄 **エージェント定義**: `../.claude/agents/specs/spec-tasks-generator.md`

### 実行指示

上記エージェント定義ファイルを読み込み、そのフロントマター（name, description, tools, model, color）とすべての指示内容に完全に従って `tasks.md` を生成してください。

### 前提条件（必須）

- **requirements.md と design.md を必ず読み込む**: この2つのファイルの内容に基づいてタスク分解を行う
- **既存実装の影響範囲分析**: Serena MCP で既存コードの依存関係を調査

### 重要なポイント

- **AC番号参照**: 各タスクの完了条件に requirements.md の AC番号（AC1.1, AC1.2...）を明記
- **フェーズ構造**: Phase 1-X（並列実行可能な基盤タスク）→ Phase 2+（機能実装タスク）
- **タスクID形式**: {Phase}.{Group}.{Sequence} （例: 1.1.1, 1.1.2, 1.2.1）
- **依存関係管理**: 各タスクの依存関係を明示（なし、または先行タスクID）

### エージェント定義の主な内容

- ロール: ATDD タスク分解専門家
- 使用ツール: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, TodoRead, TodoWrite
- モデル: sonnet
- カラー: yellow

### 出力成果物

```
docs/specs/tasks/{domain}/{YYYYMMDD}-{feature}/tasks.md
```

### 完了報告

**tasks.md の生成が完了したら、以下の形式で完了報告を出力してください:**

```markdown
# 仕様書作成完了

## 作成された仕様書

📁 **ディレクトリ**: `docs/specs/tasks/{domain}/{YYYYMMDD}-{feature}/`

- ✅ **requirements.md**: {行数}行（{ユーザーストーリー数}個のストーリー、{AC数}個の受け入れ基準）
- ✅ **design.md**: {行数}行（{図数}個の Mermaid 図、{API数}個の API エンドポイント）
- ✅ **tasks.md**: {行数}行（{フェーズ数}個のフェーズ、{タスク数}個のタスク）

## 次のステップ

1. 仕様書の内容を確認してください
2. 必要に応じて修正が必要な場合は、該当フェーズのエージェント定義を参照して再生成できます
3. タスクを実行する準備ができたら `/task-exec` コマンドを使用してください

## ATDD 準拠チェック

- ✅ AC番号形式が正しい（AC1.1, AC2.1...）
- ✅ tasks.md の完了条件に AC番号が含まれている
- ✅ すべてのユーザーストーリーに対応するタスクが存在する
```

---

## 既存ファイル処理

既存のファイルが存在する場合：

1. **内容確認**: 既存ファイルを読み込んで内容を確認
2. **次段階へ進行**: 既存の requirements.md が存在する場合、内容を確認してから design.md の生成へ
3. **修正指示がある場合**: ユーザーから修正指示があれば、該当エージェントで再生成

## 成果物の構造

```
/docs/specs/tasks/
└── {domain}/
    └── {YYYYMMDD}-{domain}-{feature}/
        ├── requirements.md  # 要件定義書（ATDD形式）
        ├── design.md        # 設計書（技術詳細）
        └── tasks.md         # タスク一覧（実装手順）
```

## 重要な原則

1. **段階的開発**: 各フェーズの承認を必須とする
2. **ATDD形式**: 受け入れ基準の明確化とAC番号の一貫性
3. **技術スタック対応**: Next.js + Hono + Prisma + MongoDB
4. **トレーサビリティ**: Asana/Figma連携による要件追跡
5. **既存コード尊重**: Serena MCP で既存パターンを分析し、一貫性を保つ

## 使用例

### 例1: Asana タスクから仕様書作成
```
/spec-create https://app.asana.com/0/project/task
```

### 例2: タスク説明から仕様書作成
```
/spec-create ユーザー認証機能の実装（マジックリンク方式）
```

### 例3: 既存仕様書の修正
```
/spec-create docs/specs/tasks/auth/20251105-auth-magic-link 修正: セキュリティ要件を追加
```

---

**実行を開始します...**
