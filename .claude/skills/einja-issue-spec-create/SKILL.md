---
name: einja-issue-spec-create
description: "Issue仕様書作成Skill"
---

# Issue仕様書作成Skill

## あなたの役割
プロダクト開発のシニアテクニカルアーキテクト兼シニアプロダクトエンジニアとして、ATDD（受け入れテスト駆動開発）に基づく仕様書を段階的に作成します。

## タスク管理
TaskCreateツールを使用して全体の進捗を可視化し、ユーザーに現在の状況を明確に伝えます：
- 各仕様書作成フェーズ（requirements.md、ui-design.pen、design.md、QAテスト仕様、GitHub Issueへのタスク記述）をトップレベルタスクとして管理
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

**⚠️ 重要**: 仕様書作成開始前に、以下の確認を行うこと。

#### 0.1 TDD方針

原則TDD（テスト駆動開発）を適用する。タスクグループ・タスク作成時にTDDプロセスを徹底すること。

#### 0.2 要件方針

**基本方針**: ビジネス要件・スコープ・優先度はユーザーにしか決められない。推測で補完せず、必ず確認する。

- 技術的な事実（ライブラリ仕様、既存実装パターン等）は自力調査で解決してよい
- ビジネス要件・スコープ・優先度・ユーザー意図に関する不明点は、推測せずAskUserQuestionで確認する
- 各サブエージェントも同じ方針に従い、ビジネス要件の不明点はPENDING_QUESTIONSで即座に停止する

#### 0.3 要件ヒアリング（Phase 1開始前に必須実施）

**目的**: 段階的仕様書作成 Phase 1（requirements.md生成）の開始前に、ユーザーの要件を構造的に確認し、不明点を解消する。

##### 0.3.1 事前調査（サブエージェント並列起動）

**方針**: Explore/general-purposeエージェントを並列起動して広く浅く調査する。深掘りはrequirements-generatorのStep 0に委譲する。

**調査観点と委託先**:

※ Explore = Agent toolの `subagent_type: Explore`、general-purpose = Agent toolの `subagent_type: general-purpose`

| 調査観点 | 委託先 | 目的 |
|---------|--------|------|
| 関連Issue・既存仕様書 | Explore | 類似機能の過去実装・決定事項を把握 |
| 既存コードの概要 | Explore | 影響範囲の見当をつける |
| 過去類似Planの確認 | Explore | 同じ失敗を繰り返さない文脈取得 |
| 外部リソース（Asana/Figma URL） | general-purpose | デザイン・タスクの意図を事前把握 |
| 外部依存の有無 | general-purpose | 外部API連携があれば専門的な質問が必要 |

- コンテキストに応じて不要な観点はスキップ（例: Asana URL未提供なら外部リソース調査は不要）
- Explore 1-2個 + general-purpose 0-1個を並列起動（最大3個）

##### 0.3.2 要件ヒアリング

**新規Issue作成時**:
1. 事前調査結果と一次情報（指示文、Asana URL、Figma URL等）を統合し、明示済み/不明を分離
2. ヒアリング観点チェックリストで不明点を洗い出す:

   | カテゴリ | 確認観点 | 例 |
   |---------|---------|-----|
   | 対象ユーザー | 誰が使うか、ペルソナ | 管理者のみ？一般ユーザーも？ |
   | ビジネス目的 | なぜ必要か、KPI | コンバージョン率向上？運用コスト削減？ |
   | 機能スコープ | 含む/含まないの境界 | 一覧・詳細・作成・編集・削除のどこまで？ |
   | 優先度・時期 | リリース優先度、期限 | MVP？次スプリント？ |
   | 既存機能との関係 | 新規/改修/拡張 | 既存画面に追加？新規画面？ |
   | エッジケース | 例外処理の方針 | 大量データ、同時操作、権限なし時 |
   | 非機能要件 | パフォーマンス、セキュリティ | レスポンス要件、認証要件 |
   | 外部連携 | API、決済、認証等 | サードパーティAPI連携あるか？ |
   | デザイン制約 | Figma有無、既存UIパターン | 既存デザインシステムに従うか？ |

3. 1回目のAskUserQuestionで全不明点を一括提示。回答不十分な場合のみ追加確認（最大2回追加 = 合計3回）
4. **3回後も必須要件が不明な場合**: 残存不明点を明示した上で「続行/中止/その他（自由入力）」をAskUserQuestionで確認
5. 要件ヒアリングサマリを構造化し、Phase 1以降のサブエージェントに渡す:
   ```
   ## 要件ヒアリングサマリ
   ### 確定事項
   - [確定した要件を箇条書き]
   ### ユーザー回答
   - Q1: [質問] → A: [回答]
   ### 事前調査結果の要約
   - [関連Issue・既存コード・外部リソースから得た知見]
   ### 未解決事項（残存リスク）
   - [解消できなかった不明点があれば記載]
   ```

**既存Issue操作時**:
1. 事前調査で既存仕様書（requirements.md、design.md等）を把握済み
2. 追加・変更要件との差分を分析し、影響範囲を特定
3. 新規作成時と同じヒアリング観点チェックリストを差分に対して適用し、不明点をAskUserQuestionで確認
4. サブエージェントへの情報渡し時、差分サマリの「追加・変更要件」と「未解決事項」を明示する。サブエージェントは差分サマリで確定済みの事項について重複質問しない
5. 既存仕様との整合性について確認が必要な点も提示
6. 差分サマリを作成:
   ```
   ## 差分サマリ
   ### 既存仕様の要約
   - [現在のrequirements.md/design.mdの要点]
   ### 追加・変更要件
   - [ユーザーが指示した追加・変更内容]
   ### ユーザー回答
   - Q1: [質問] → A: [回答]
   ### 影響範囲
   - [既存仕様への波及箇所]
   ### 未解決事項（残存リスク）
   - [解消できなかった不明点があれば記載]
   ```

#### 0.4 ワークツリー作成とIssueBranchBaseの選択

**質問: Issueブランチの作成元を確認**

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

**ワークツリーの作成**:
1. `EnterWorktree` でワークツリーを作成（名前: `issue-{issue番号}-spec`）
   - `.claude/worktrees/` 配下に作成される（issue-execの `~/.einja/worktrees/` とは競合しない）
2. `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ
   - ブランチ名: `issue/{issue番号}`、ベース: `origin/{IssueBranchBase}`
3. 以降のPhase 1〜3はすべてワークツリー内で作業

#### 0.5 Skill作成必要性の評価

`einja-skill-first` Skillを使用して、このタスクに対してSkillを先に作るべきかを自動評価する。

- **スキップ基準に該当する場合**（単発修正、具体的な小規模指示等）: 評価を省略し次へ進む
- **評価実行時**: Skillが構造化された評価結果（🟢推奨/🟡拡張推奨/⚪不要）を返却
  - 🟢推奨 → AskUserQuestionでユーザーに提案。承認されたら仕様書作成前にSkill作成を実施
  - 🟡拡張推奨 → 既存Skill拡張の提案をユーザーに確認
  - ⚪不要 → そのまま次へ進む

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

3. **Issueブランチ作成（MCP）**
   - 0.4でワークツリー内にローカルブランチは作成済み
   - リモートへの反映: `mcp__github__create_branch` を使用
   - branch: `issue/{issue番号}`（例: `issue/42`）
   - from_branch: IssueBranchBase（0.4で選択）

### 3. 段階的仕様書作成
**重要**: 各段階で必ずユーザー承認を得て、コミット＆プッシュしてから次へ進行すること。

#### Phase 1: requirements.md（要件定義書）
1. requirements-generatorエージェントで作成
   - エージェント内で既存コードの分析を実施
   - ATDD形式のユーザーストーリーと受け入れ基準
   - **追加指示（呼び出し時にプロンプトに含める）**:
     - 以下のsteering文書を事前に読み込んでから作業すること:
       - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
       - `docs/einja/steering/development/testing-strategy.md`
     - また、過去Planを `docs/plans/` ディレクトリから検索し、類似Issueがあれば「実装参考情報」セクションに参考情報として記載すること。
     - **0.3で作成した「要件ヒアリングサマリ」と「事前調査結果」を必ずプロンプトに含める**こと。requirements-generatorはこのサマリを基に要件定義書を作成する。事前調査済みの内容はStep 0で重複調査せず、より深い分析に集中する。
2. **ユーザーに内容確認を依頼**
   - 作成したファイルのパスと概要を提示
   - 確認ポイントを明示（要件の過不足、受け入れ基準の明確性など）
3. **ユーザー承認後、コミット＆プッシュ**
   - コミットメッセージ: `docs: {機能名}の要件を追加`
   - ブランチは `issue/{issue番号}` にプッシュ
   - 他のメンバーがレビューできるようにする
4. **承認を得てから次のステップ（design.md）に進む**

#### Phase 2: 三又並列生成（design + ui-design + QA）

**Phase 2 スキップ判定**（Phase 2 開始前に実施）:
- requirements.mdに画面・UI関連の要件がない場合、ui-design-generatorをスキップ（二又並列に変更）
- 判定基準: requirements.md内に「画面」「UI」「フォーム」「ダッシュボード」「表示」「ボタン」「入力」等のキーワードが含まれるか確認
- 判断が曖昧な場合はAskUserQuestionでユーザーに確認

**⚠️ 外部API連携がある場合の必須記載事項（design-generator・qa-generator共通）**:
design-generatorエージェントへの追加指示に以下を含めること:
- design.mdの「テスト設計」または「環境設定」セクションに以下を含める：
  1. 使用する外部APIのサンドボックス/テスト環境の概要
  2. QA打鍵確認に必要な環境変数の一覧（変数名・取得方法・設定先）
  3. curlコマンド例（正常系1例・異常系1例）
- 未記載の場合、task-reviewerがMAJOR判定する

requirements.md承認後に、以下のエージェントを**並列（同時にAgent呼び出し）**で起動する:

##### パターンA: UI要件あり（三又並列）

**[並列-1] design-generatorエージェント → design.md**
1. エージェント内で既存アーキテクチャの調査を実施
2. 技術アーキテクチャとデータモデル
3. requirements.mdの内容を参照
4. **⚠️ ui-design.pen は並列生成中のため参照不可。UI関連セクション（9-11）では、UIの詳細仕様は `ui-design.pen` を参照先として記載すること（例: 「UIレイアウトの詳細は ui-design.pen を参照」）**
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/development/backend-architecture.md`
    - `docs/einja/steering/development/frontend-development.md`
    - `docs/einja/steering/development/api-development.md`
    - `docs/einja/steering/development/testing-strategy.md`
    - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
  - requirements.mdの「実装参考情報」セクションを参照し、design.mdに「関連ドキュメント」「関連Skill・サブエージェント」セクションを出力すること。
  - **外部API連携がある場合**: 上記「外部API連携がある場合の必須記載事項」に従うこと

**[並列-2] ui-design-generatorエージェント → ui-design.pen**
1. 既存画面確認（改修の場合）
   - Playwright MCPで既存画面のスクリーンショットを取得
   - 改修対象のUIパターンを把握
2. requirements.mdの内容を参照
3. Pencil MCPでビジュアルモックアップを作成
4. 出力: `{仕様書ディレクトリ}/ui-design.pen`
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/development/pencil-design-management.md`

**[並列-3] qa-generatorエージェント → qa-tests/**
1. requirements.mdの内容を参照（**design.mdは参照しない — 並列生成中のため**）
2. **シナリオテスト（scenarios.md）**: 複数タスクをまたぐ継続操作フローのテスト仕様
3. **Story別テスト仕様**: 各ユーザーストーリー（AC単位）のテスト仕様
4. 受け入れ基準（AC）との対応付け
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
    - `docs/einja/steering/development/testing-strategy.md`
  - **外部API連携がある場合の必須記載事項**:
    - 外部APIを呼び出すACのQAテストシナリオに「実API打鍵確認ステップ」を含めること
    - 「モックでのPASS」と「実APIでの打鍵確認」は別ステップとして分けて記載
    - 打鍵確認に必要な前提条件（環境変数、サンドボックスアカウント等）を「前提条件」欄に明記

##### パターンB: UI要件なし（二又並列）

**[並列-1] design-generatorエージェント → design.md**（パターンAと同じ）
**[並列-2] qa-generatorエージェント → qa-tests/**（パターンAの並列-3と同じ）

##### 三又（または二又）並列完了後の処理

1. **横断チェック**（オーケストレーター実施）
   - designのAPIパス・画面名がQAシナリオで正しく参照されているか確認
   - 不整合がある場合は該当ファイルを修正

2. **一括承認（ユーザー確認）**
   - 全成果物を構造化フォーマットで一括提示:
     - **design.md**: パスと概要、確認ポイント（アーキテクチャの妥当性、API設計）
     - **ui-design.pen**（該当時のみ）: Pencil MCPのget_screenshotで各画面プレビュー、確認ポイント（レイアウト、コンポーネント選択）
     - **qa-tests/**: ディレクトリ構成と概要、確認ポイント（テスト網羅性、AC対応、シナリオテストの妥当性）
   - 承認後、一括コミット＆プッシュ
     - コミットメッセージ: `docs: {機能名}の設計・QAテスト仕様を追加`（ui-design含む場合: `docs: {機能名}の設計・UIデザイン・QAテスト仕様を追加`）

3. **承認を得てから次のステップ（GitHub Issueへのタスク記述）に進む**

#### Phase 3: GitHub Issueへのタスク記述

##### 3.1 タスク生成・検証ループ

**重要**: タスク生成後は自動的にフォーマット検証を行い、違反があれば差し戻します。

```
【タスク生成・検証ループ】（最大3回）
  │
  ├─ tasks-generator 呼び出し
  │   └─ タスク一覧を生成（またはエラーフィードバックを元に修正版を生成）
  │
  ├─ tasks-validator 呼び出し
  │   └─ フォーマット検証
  │
  └─ 検証結果判定
      ├─ SUCCESS → ループ終了、ユーザー確認へ
      └─ FAILURE → tasks-generator に差し戻し
                   └─ エラーレポート付きで再呼び出し
                   └─ ループ再開（最大3回）

  ※ 3回失敗 → ユーザーに手動修正を依頼
```

1. **tasks-generatorエージェントでタスク生成**
   - エージェント内で実装の影響範囲を分析
   - 実装タスクの分解と依存関係
   - requirements.md、design.md、**qa-tests/scenarios.md**の内容を参照
   - 各タスクに**シナリオテスト実施タイミング**を明記
   - **GitHub Issueの説明文にタスク一覧を記述**
   - **追加指示（呼び出し時にプロンプトに含める）**:
     - 🔴 **フォーマット厳守**: タスク一覧は必ず `_einja-issue-spec-tasks-generator` Skill（フロントマターでプリロード済み）のフォーマットに従うこと。特に: Phase見出しは `### Phase N:`、タスクグループは `- [ ] X.Y`、タスクは `  - X.Y.Z`、メタデータは `    - **太字キー**: 値` 形式。`Task X-Y` 形式や太字なしメタデータは即バリデーションエラーとなる。
     - requirements.mdの「実装参考情報」とdesign.mdの「関連ドキュメント」「関連Skill・サブエージェント」セクションを参照し、各タスクグループ/タスクに `**実行サブエージェント**` と `**使用Skill**` を付与すること。
     - 委託ルール対応表（参考）:
       | 作業 | 推奨サブエージェント |
       |------|---------------------|
       | フロントエンド アーキテクチャ設計 | [frontend-architect] |
       | フロントエンド デザイン実装 | [design-engineer] |
       | フロントエンド コーディング | [frontend-coder] |
       | バックエンド アーキテクチャ設計 | [backend-architect] |

2. **tasks-validatorエージェントでフォーマット検証**
   - タスク階層（Phase/タスクグループ/タスク/サブタスク）の形式チェック
   - メタデータ（要件・実装AC・依存関係・完了条件・対応設計・シナリオテスト）の必須チェック
   - 依存関係の書式・参照先の検証
   - ATDD粒度チェック（Phase数、縦切り/横切り）

3. **検証結果の処理**
   - **SUCCESS**: ユーザー確認フェーズへ進む
   - **FAILURE（リトライ可能）**:
     - エラーレポートを tasks-generator に渡して再生成
     - ループ再開（現在の試行回数をインクリメント）
   - **MAX_RETRIES_EXCEEDED（3回失敗）**:
     - ユーザーに手動修正を依頼
     - エラー内容を提示し、修正後に続行できるよう案内

##### 3.2 ユーザー確認

4. **ユーザーに内容確認を依頼**
   - 更新したGitHub IssueのURL（#{issue_number}）と概要を提示
   - 確認ポイントを明示（タスク分解の粒度、依存関係の妥当性など）
   - **バリデーション合格済みであることを明記**

5. **ユーザー承認後、以下の処理を実行**

   a. **Issueブランチの確認**
   - 0.4でワークツリー内にIssueブランチ（`issue/{issue番号}`）は作成済み
   - リモートへの反映は `mcp__github__create_branch` で実施（未作成時のみ）

   b. **仕様書ファイルをプッシュ**
   - worktree内で `git push origin issue/{issue番号}` を実行
   - ※ 各Phase承認時にコミット＆プッシュ済みのため、最終プッシュは不要な場合が多い

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
     - UIデザインへのリンク（ui-design.pen、存在する場合のみ）
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
        ├── ui-design.pen    # UIデザイン（UI関連のみ）
        ├── design.md        # 設計書（技術詳細）
        └── qa-tests/        # QAテスト仕様
            ├── scenarios.md # シナリオテスト（複数タスクをまたぐフロー）
            ├── story{N}.md  # 各ストーリーのテスト仕様（AC単位）
            └── evidence/    # エビデンス（スクリーンショット等）
                └── story{N}/ # ストーリー別

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
        ├── ui-design.pen            # UIデザイン（UI関連のみ）
        ├── design/                  # 設計書ディレクトリ
        │   ├── README.md            # 目次
        │   ├── architecture.md      # アーキテクチャ
        │   ├── implementation.md    # 実装詳細
        │   └── quality.md           # 品質と運用
        └── qa-tests/                # QAテスト仕様
            ├── scenarios.md         # シナリオテスト（複数タスクをまたぐフロー）
            ├── story{N}.md          # 各ストーリーのテスト仕様（AC単位）
            └── evidence/            # エビデンス（スクリーンショット等）
                └── story{N}/        # ストーリー別

（注: タスク一覧はGitHub Issueに記述）
```

**自動分割機能**:
- 各エージェント（requirements/design）は生成後に自動的にファイルサイズをチェック
- 1000行を超える場合、意味のあるまとまりで2-3個のパートに自動分割
- README.mdで全体構成とナビゲーションを提供
- 分割されたファイルも他エージェントから正しく参照可能

## 重要な原則
- 段階的開発：requirements承認後は並列生成し一括承認
- ATDD形式による受け入れ基準の明確化
- Next.js + Hono + Prisma技術スタック対応
- Asana/Figma連携によるトレーサビリティ確保

<!-- @einja:project-private:start id="issue-spec-create-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
