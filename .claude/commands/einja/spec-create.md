---
description: "タスクの仕様書（requirements.md、design.md、qa-tests/）を段階的に作成・修正するワークフローを実行します。ARGUMENTS: タスク内容の説明またはAsanaタスクURL（必須）、既存仕様書のパス（オプション）"
allowed-tools: Task, Read, Write, Edit, MultiEdit, Bash, Grep, Glob, TodoRead, TodoWrite, mcp__asana__*, mcp__figma_dev_mode__*
---

# タスク仕様書作成コマンド

## あなたの役割
プロダクト開発のシニアテクニカルアーキテクト兼シニアプロダクトエンジニアとして、ATDD（受け入れテスト駆動開発）に基づく仕様書を段階的に作成します。

## タスク管理
TodoWriteツールを使用して全体の進捗を可視化し、ユーザーに現在の状況を明確に伝えます：
- 各仕様書作成フェーズ（requirements.md、design.md、QAテスト仕様、GitHub Issueへのタスク記述）をトップレベルタスクとして管理
- エージェント起動前にタスクを「in_progress」に更新
- エージェント完了後に「completed」に更新
- ユーザー承認待ちの状態も明示的に表示

## 命名規則

⚠️ **重要**: ディレクトリ名とブランチ名の規則は異なります。混同しないこと。

| 対象 | 規則 | 例 |
|------|------|-----|
| ディレクトリ | `issue{issue番号}-{機能名}` | `issue42-user-management` |
| Issueブランチ | `issue/{issue番号}` | `issue/42` |
| Phaseブランチ | `issue/{issue番号}-phase{N}` | `issue/42-phase1` |

- **ディレクトリ**: 機能名を含める（人間が識別しやすくするため）
- **ブランチ**: Issue番号のみ（[branch-strategy.md](../docs/einja/steering/branch-strategy.md)参照）

## 実行手順

### 0. 前提確認フェーズ（ワークフロー開始時）

**⚠️ 重要**: 仕様書作成開始前に、以下の3つの質問で前提を確認すること。

#### 0.1 TDD適用判定

以下のいずれかに該当する場合、TDD採用を推奨：
- ビジネスロジックが含まれる（計算・判定・状態遷移）
- データ変換・加工がある
- 外部API連携がある
- 複数の分岐・条件がある
- 金銭・認証・権限に関わる

**質問1: TDD（テスト駆動開発）を適用しますか？**

```yaml
AskUserQuestion:
  question: "このタスクにTDD（テスト駆動開発）を適用しますか？"
  header: "TDD選択"
  options:
    - label: "はい、TDDで進める（推奨）"
      description: "推奨理由: ビジネスロジック、データ変換、外部API連携では品質向上に効果的。メリット: バグの早期発見、設計品質向上。デメリット: 初期の開発時間増加"
    - label: "実装後にテストを追加"
      description: "メリット: 初期の開発速度が速い。デメリット: テスト漏れのリスク、後付けテストは設計改善に繋がりにくい"
    - label: "テスト最小限"
      description: "メリット: 最速で動作確認可能。デメリット: 品質保証が不十分、リグレッションリスクが高い"
```

#### 0.2 要件明確さ確認

**質問2: 要件の明確さを確認**

以下の観点で要件を確認してください：
- 正常系: 一番よくある使われ方は明確か？
- 境界条件: 「ギリギリOK」と「ギリギリNG」の境目は定義されているか？
- エラー時: エラーの場合、ユーザーにどう見せるか決まっているか？
- 暗黙の期待: 「当たり前」だと思っていることが言語化されているか？

```yaml
AskUserQuestion:
  question: "タスクの要件は明確ですか？"
  header: "要件確認"
  options:
    - label: "明確（仕様書作成を進める）"
      description: "メリット: 仕様書作成をスムーズに進められる。デメリット: 見落としがあると後で手戻りが発生する可能性"
    - label: "不明確（追加質問で明確化）"
      description: "メリット: 要件を正確に把握してから進められる。デメリット: 追加の確認時間が必要"
```

**不明確が選択された場合の対応**:
以下の深掘り質問を実施：
1. **正常系**: 一番よくある使われ方は？
2. **境界条件**: 「ギリギリOK」と「ギリギリNG」の境目は？
3. **エラー時**: エラーの場合、ユーザーにどう見せたい？
4. **暗黙の期待**: 「当たり前」だと思っていることは？

#### 0.3 IssueBranchBaseの選択

**質問3: Issueブランチの作成元を確認**

```yaml
AskUserQuestion:
  question: "Issueブランチ（issue/{issue番号}）の作成元（IssueBranchBase）を選択してください"
  header: "IssueBranchBase選択"
  options:
    - label: "デフォルトブランチ（推奨）"
      description: "gitのデフォルトブランチ（main/developなど）を使用します"
    - label: "main"
      description: "mainブランチをIssueBranchBaseとして使用します"
    - label: "develop"
      description: "developブランチをIssueBranchBaseとして使用します"
    - label: "その他（ブランチ名を入力）"
      description: "例: release/2025-01"
```

**「その他」選択時の対応**:
- ブランチ名をユーザーに確認し、IssueBranchBaseとして記録する

### 1. 外部リソースの確認

**AsanaタスクURL**の場合：
- AsanaMCPでタスク情報を取得（タイトル、説明、カスタムフィールド）
- タスクIDから適切なディレクトリ名を生成

**FigmaURL**が含まれる場合：
- FigmaDevModeMCPでデザイン分析
- UI要件、コンポーネント仕様、デザイントークンを抽出

### 2. GitHub Issue作成（最初に実行）

1. **GitHub IssueをMCPで作成**
   - タイトル: ユーザー指定またはAsanaタスクから取得
   - 本文: 空または簡易的な説明
   - `mcp__github__create_issue` を使用
   - **Issue番号を取得して記録**

2. **Issue番号に基づいてディレクトリパスを決定**
   - パス指定あり → 指定ディレクトリを使用
   - パス指定なし → `/docs/specs/issues/{機能カテゴリ名}/issue{issue番号}-{機能名}/` で自動作成

3. **Issueブランチ作成（MCP + ローカル）**
   - `mcp__github__create_branch` を使用
   - branch: `issue/{issue番号}`（例: `issue/42`）
   - from_branch: IssueBranchBase（0.3で選択）
   - ローカルでも `issue/{issue番号}` にチェックアウトして作業を開始

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
   - コミットメッセージ: `docs: {機能名}の要件を追加`
   - ブランチは `issue/{issue番号}` にプッシュ
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
   - コミットメッセージ: `docs: {機能名}の設計を追加`
   - ブランチは `issue/{issue番号}` にプッシュ
4. **承認を得てから次のステップ（QAテスト仕様生成）に進む**

#### Phase 3: QAテスト仕様生成（シナリオテスト含む）
1. spec-qa-generatorエージェントで作成
   - requirements.mdとdesign.mdの内容を参照
   - **シナリオテスト（scenarios.md）**: 複数タスクをまたぐ継続操作フローのテスト仕様
   - **フェーズ別テスト仕様**: 各タスクグループのテスト仕様
   - 受け入れ基準（AC）との対応付け
2. **ユーザーに内容確認を依頼**
   - 作成したqa-tests/ディレクトリの構成と概要を提示
   - 確認ポイントを明示（シナリオテストの網羅性、実施タイミングの妥当性など）
3. **ユーザー承認後、コミット＆プッシュ**
   - コミットメッセージ: `docs: {機能名}のQAテスト仕様を追加`
   - ブランチは `issue/{issue番号}` にプッシュ
4. **承認を得てから次のステップ（GitHub Issueへのタスク記述）に進む**

#### Phase 4: GitHub Issueへのタスク記述

##### 4.1 タスク生成・検証ループ

**重要**: タスク生成後は自動的にフォーマット検証を行い、違反があれば差し戻します。

```
【タスク生成・検証ループ】（最大3回）
  │
  ├─ spec-tasks-generator 呼び出し
  │   └─ タスク一覧を生成（またはエラーフィードバックを元に修正版を生成）
  │
  ├─ spec-tasks-validator 呼び出し
  │   └─ フォーマット検証
  │
  └─ 検証結果判定
      ├─ SUCCESS → ループ終了、ユーザー確認へ
      └─ FAILURE → spec-tasks-generator に差し戻し
                   └─ エラーレポート付きで再呼び出し
                   └─ ループ再開（最大3回）

  ※ 3回失敗 → ユーザーに手動修正を依頼
```

1. **spec-tasks-generatorエージェントでタスク生成**
   - エージェント内で実装の影響範囲を分析
   - 実装タスクの分解と依存関係
   - requirements.md、design.md、**qa-tests/scenarios.md**の内容を参照
   - 各タスクに**シナリオテスト実施タイミング**を明記
   - **GitHub Issueの説明文にタスク一覧を記述**

2. **spec-tasks-validatorエージェントでフォーマット検証**
   - タスク階層（Phase/タスクグループ/タスク/サブタスク）の形式チェック
   - メタデータ（要件・依存関係・完了条件・対応設計・シナリオテスト）の必須チェック
   - 依存関係の書式・参照先の検証
   - ATDD粒度チェック（Phase数、縦切り/横切り）

3. **検証結果の処理**
   - **SUCCESS**: ユーザー確認フェーズへ進む
   - **FAILURE（リトライ可能）**:
     - エラーレポートを spec-tasks-generator に渡して再生成
     - ループ再開（現在の試行回数をインクリメント）
   - **MAX_RETRIES_EXCEEDED（3回失敗）**:
     - ユーザーに手動修正を依頼
     - エラー内容を提示し、修正後に続行できるよう案内

##### 4.2 ユーザー確認

4. **ユーザーに内容確認を依頼**
   - 更新したGitHub IssueのURL（#{issue_number}）と概要を提示
   - 確認ポイントを明示（タスク分解の粒度、依存関係の妥当性など）
   - **バリデーション合格済みであることを明記**

5. **ユーザー承認後、以下の処理を実行**

   a. **Issueブランチの存在確認（未作成時のみ作成）**
   - `mcp__github__create_branch` を使用
   - branch: `issue/{issue番号}`（例: `issue/42`）
   - ⚠️ **機能名は含めない**（ディレクトリ名とは異なる。上記「命名規則」参照）
   - from_branch: IssueBranchBase（0.3で選択）

   b. **仕様書ファイルをプッシュ（MCP）**
   - `mcp__github__push_files` を使用
   - branch: `issue/{issue番号}`
   - files: requirements.md, design.md, qa-tests/（または分割された各ファイル）
   - message: `docs: {機能名}の仕様書を追加 (Issue #{issue_number})`

   c. **PR作成（MCP）**
   - `mcp__github__create_pull_request` を使用
   - base: デフォルトブランチ
   - head: `issue/{issue番号}`
   - title: `docs: {機能名} 仕様書`
   - body: `Issue #{issue番号} の仕様書を作成しました。`
   - **PR URLを記録**

   d. **GitHub Issue説明文を更新（MCP）**
   - `mcp__github__issue_write` を使用（method: update）
   - 本文に以下を含める:
     - Spec PR へのリンク
     - 要件ドキュメントへのリンク（requirements.mdまたはrequirements/README.md）
     - 設計ドキュメントへのリンク（design.mdまたはdesign/README.md）
     - QAテスト仕様へのリンク（qa-tests/scenarios.md）
     - タスク一覧（Phase別チェックボックス形式、シナリオテスト実施タイミング明記）

6. **全ての仕様書作成が完了したことを報告**
   - GitHub Issue URLを明記
   - Spec PR URLを明記


### 4. 既存ファイル処理
- 既存ファイルは内容確認後に次段階へ進行
- 修正指示がある場合のみ該当エージェントで再生成

### 4. 成果物の構成

#### 基本構成（各ファイルが1000行以下の場合）
```
/docs/specs/issues/
└── {機能カテゴリ名}/
    └── issue{issue番号}-{機能名}/
        ├── requirements.md  # 要件定義書（ATDD形式）
        ├── design.md        # 設計書（技術詳細）
        └── qa-tests/        # QAテスト仕様
            ├── scenarios.md # シナリオテスト（複数タスクをまたぐフロー）
            └── phase{N}.md  # 各フェーズのテスト仕様

（注: タスク一覧はGitHub Issueに記述）
```

#### 分割構成（ファイルが1000行超過の場合）
```
/docs/specs/issues/
└── {機能カテゴリ名}/
    └── issue{issue番号}-{機能名}/
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
        └── qa-tests/                # QAテスト仕様
            ├── scenarios.md         # シナリオテスト（複数タスクをまたぐフロー）
            └── phase{N}.md          # 各フェーズのテスト仕様

（注: タスク一覧はGitHub Issueに記述）
```

**自動分割機能**:
- 各エージェント（requirements/design）は生成後に自動的にファイルサイズをチェック
- 1000行を超える場合、意味のあるまとまりで2-3個のパートに自動分割
- README.mdで全体構成とナビゲーションを提供
- 分割されたファイルも他エージェントから正しく参照可能

## 重要な原則
- 段階的開発：各フェーズの承認を必須
- ATDD形式による受け入れ基準の明確化
- Next.js + Hono + Prisma技術スタック対応
- Asana/Figma連携によるトレーサビリティ確保

実行を開始します...
