# Plan: einja-epic-spec-create Skill 新規作成

## Context

現在、Issue単位の仕様書作成（einja-issue-spec-create）と実行（einja-issue-exec / einja-issue-team-exec）は整備済みだが、「1プロダクトを一気に作る」ような複数Issueにまたがる大規模タスクを扱うSkillがない。Epic仕様書作成Skillを新規作成し、**各Issueへの良質なインプット生成**をオーケストレーションする。

### Skillエコシステム内の位置づけ

```
発見フェーズ（任意）           確定フェーズ（epic-spec-create）       実行フェーズ
───────────────────────    ──────────────────────────────────    ─────────────────
new-product-discovery   →  Epic requirements.md                →  issue-spec-create x N
  PRD.md                    (Epic目標・スコープ・Issue分解)          (各Issue詳細仕様)

new-product-prototyping →  Epic ui-design.pen                  →  各Issue ui-design.pen
  プロトタイプUI              (画面一覧・遷移 Overview粒度)           (Issue詳細モック)

app-design-system       →  Epic design.md                      →  各Issue design.md
  デザイントークン            (アーキテクチャ方針・共通設計)           (Issue固有技術詳細)
```

※ discovery / prototyping / design-system は**オプション**（未実装Skillだが将来の連携設計に備える）

## 現状

| 既存Skill | 機能 | 粒度 |
|-----------|------|------|
| einja-issue-spec-create | requirements→ui-design→design→qa→GitHub Issue | 単一Issue |
| einja-issue-exec | 単一Issueの並列実行 | 単一Issue |
| Epic対応 | **なし** | - |

### issue-spec-createの現状制約（要修正）
- autoモード（承認スキップ）: **未実装**（5箇所の承認ポイントすべてが必須）
- 外部コンテキスト渡しIF: **未実装**（構造化パラメータなし、会話テキストのみ）
- Milestone設定: **未サポート**
- IssueBranchBase外部指定: **未サポート**（毎回AskUserQuestionで質問）

### issue-spec-createの承認ポイント一覧（autoモード分岐対象）

| # | Phase | 承認内容 | autoモードでの動作 |
|---|-------|---------|------------------|
| 1 | Phase 1 (L118-125) | requirements.md確認 | スキップ→自動コミット |
| 2 | Phase 2+3 (L152-157) | ui-design.penプレビュー確認 | スキップ→自動コミット |
| 3 | Phase 2+3 (L159-164) | design.md確認 | スキップ→自動コミット |
| 4 | Phase 4 (L186-192) | qa-tests確認 | スキップ→自動コミット |
| 5 | Phase 5 (L242-246) | GitHub Issue・PR確認 | スキップ→自動実行 |
| 6 | Step 0.3 (L47-62) | IssueBranchBase選択 | 外部指定値を使用（質問スキップ） |

## 設計方針

### 核心思想
- **Epicの価値 = 各Issueへの良質なインプット生成**
- 各Issueの詳細Specはissue-spec-createに委任
- Epic全体の要件・設計・UIデザインはユーザーがレビュー
- discovery/prototypingはオプション入力（必須前提にしない）

### 概念定義

| 概念 | 粒度 | GitHub表現 | ブランチ |
|------|------|-----------|---------|
| Epic | プロダクト/大機能 | Milestone + 親Issue | epic/{epic番号} |
| Issue | 独立デプロイ可能な機能単位 | GitHub Issue | issue/{N} (epicブランチから派生) |

## 変更内容

### 処理フロー（3ステップ + 後処理）

```
Step 0: 前提確認
├── 0.1 IssueBranchBase選択
├── 0.2 外部リソース確認（Asana/Figma/PRDパス → あれば取り込み）
└── 0.3 デザインシステム確認（未定義ならapp-design-system先行を推奨）

Step 1: Epic概要 + ストーリーマップ + Issue分割  ← ★承認ポイント1
  └─ epic-planner サブエージェントで epic-overview.md 生成
     ├── ビジョン・ゴール・スコープ（In/Out）
     ├── ユーザーペルソナ・主要ユーザーフロー
     ├── ユーザーストーリーマップ（Jeff Patton方式）
     │   ├── バックボーン: ユーザー活動（Activity）の横軸
     │   ├── タスク: 各活動の具体的タスク
     │   └── ストーリー: 各タスクの詳細ストーリー（優先度別にスライス）
     │       ├── Release 1 スライス（MVP / Walking Skeleton）
     │       ├── Release 2 スライス
     │       └── Future スライス
     ├── 非機能要件・技術的制約
     ├── Feature Map（機能一覧 + 対応Issue + ストーリーマップとの対応）
     ├── Issue分割表（タイトル・スコープ・規模S/M/L・カテゴリ・依存関係）
     │   ※ ストーリーマップのスライスに基づきIssueを縦切り
     └── Issue間依存DAG（Mermaid図）+ 推奨実行順序
  └─ 分割制約:
     ├── 1 Epic = 2〜10 Issue
     ├── 縦切り原則（横切り「FE全部」「BE全部」禁止）
     ├── 依存深さ最大3レベル、循環禁止
     └── 1 Issue = 独立してデプロイ・テスト可能な単位
  └─ ユーザー承認 → コミット＆プッシュ

Step 2: Epic全体の要件・設計・UIデザイン  ← ★承認ポイント2
  ├─ 2a: Epic requirements.md（requirements-generator + Epic拡張プロンプト）
  ├─ 2b: 画面遷移図（drawio形式）← drawio-guideスキル使用
  │   └── 画面遷移ロジック（条件分岐・エラー遷移含む）を.drawioで詳細に表現
  ├─ 2c: Epic ui-design.pen（ui-design-generator、UI要件ある場合）
  │   └── 画面一覧・主要画面ワイヤーフレーム・デザインシステム参照・Issue別画面割り当て
  │       ※ 画面遷移のロジックはdrawioに委譲、UIビジュアルに集中
  ├─ 2d: Epic design.md（design-generator + Epic拡張プロンプト）
  ├── ※既存サブエージェントを再利用（Epic粒度パラメータ付きで呼び出し）
  ├── ※2b + 2cは並列実行可能
  └─ ユーザーレビュー → コミット＆プッシュ

Step 3: 各Issue仕様書の自動展開（承認なし）
  ├─ GitHub Milestone作成
  ├─ Epicブランチ作成: epic/{epic番号}
  ├─ 各Issueについて（依存関係の位相順に）:
  │   ├── scope.md 生成（Epic文書からIssue固有情報を抜粋）
  │   ├── GitHub Issue作成（scope.mdベースの本文 + Milestone + Epic参照）
  │   └── einja-issue-spec-create 呼び出し（epic-contextモード + auto）
  ├─ Epic Tracker Issue作成（全Issue番号確定後、[Epic]ラベル + Milestone）
  └─ Epic PR作成（epic/{epic番号} → IssueBranchBase）
```

### Epic requirements.md テンプレート

既存のIssue requirements.md（ATDD形式）をEpic粒度に拡張。

```markdown
# Epic: {エピック名}

## メタデータ
- **Epic ID**: EPIC-{N}
- **ステータス**: Draft / Review / Approved
- **作成日 / 更新日**:
- **関連Issue**: #001, #002, ...

## 1. プロダクトビジョン・ゴール
### なぜこのEpicを作るか
[解決する課題・ビジネス価値]

### 成功指標（KPI）
| 指標 | 現状値 | 目標値 | 計測方法 |
|-----|-------|-------|---------|

## 2. ユーザーペルソナ
| ペルソナ名 | 役割 | 主なニーズ | 課題 |
|----------|------|----------|-----|

## 3. エピックスコープ
### In Scope（含む）
### Out of Scope（含まない）
### 将来検討（Future Scope）

## 4. ユーザーストーリーマップ（Jeff Patton方式）

### バックボーン（ユーザー活動）
| Activity | 概要 |
|----------|------|
| A-01: {活動名} | {活動の説明} |

### タスク × ストーリー マトリクス
| Activity | Task | Release 1 (MVP) | Release 2 | Future |
|----------|------|-----------------|-----------|--------|
| A-01 | T-01: {タスク名} | S-01: {ストーリー} | S-04: ... | S-07: ... |
| A-01 | T-02: ... | S-02: ... | S-05: ... | |
| A-02 | T-03: ... | S-03: ... | S-06: ... | |

### リリーススライス → Issue対応
| スライス | 含むストーリー | 対応Issue |
|---------|-------------|---------|
| Release 1 (MVP) | S-01, S-02, S-03 | #001, #002 |
| Release 2 | S-04, S-05, S-06 | #003, #004 |

## 5. ユーザーフロー（高レベル）
[mermaid フローチャート]
※ 詳細な画面遷移ロジックは screen-transitions.drawio を参照
※ UIビジュアルは ui-design.pen を参照

## 6. Feature Map
| Feature | 概要 | 対応Issue | 対応ストーリー | 優先度(Must/Should/Could) |
|--------|------|---------|-------------|-------|

## 7. ユーザーストーリー（Epic粒度）
### Story N: {タイトル}
As a {ペルソナ} / I want to {目的} / So that {価値}
#### 受け入れ基準（Epic AC）
- [ ] AC{N}.{M}: {基準}
  - Given: / When: / Then:

## 8. 非機能要件
### パフォーマンス
### セキュリティ
### アクセシビリティ（WCAG 2.1 AA）
### 対応ブラウザ・デバイス

## 9. 技術的制約・前提条件
- 技術的制約:
- ビジネス制約:
- 依存する外部サービス:

## 10. Issue分割対応表
| Issue | タイトル | 対応Feature | 依存Issue | 優先順位 |
|------|--------|-----------|---------|---------|

## 11. リスクと対策
| リスク | 影響度 | 発生確率 | 対策 |
|-------|-------|---------|------|
```

**Issue requirements.mdとの差分:**

| セクション | Epic版で追加 | 理由 |
|-----------|------------|------|
| プロダクトビジョン・ゴール・KPI | ◯ | Issue仕様書の「なぜ」の根拠 |
| ユーザーペルソナ | ◯ | Issue横断でUX判断基準を統一 |
| ユーザーストーリーマップ（Jeff Patton方式） | ◯ | Issue分割の品質向上、リリーススライスの可視化 |
| Feature Map | ◯ | Issue分割の構造を明示 |
| Issue分割対応表 | ◯ | Epic→Issueの追跡性確保 |
| ユースケース図・権限マトリクス | Issue版と同様 | Epic粒度で生成、各Issueが継承 |
| 画面要件 | Epic版では高レベルのみ | 詳細はui-design.pen + drawioに委譲 |

### Epic design.md テンプレート

既存のIssue design.md（コードブロック禁止・表/mermaid形式）をEpic粒度に拡張。

```markdown
# Epic Design: {エピック名}

## メタデータ
- **対応 Epic requirements**: requirements.md
- **作成日 / 更新日**:

## 1. システムアーキテクチャ概要
### コンテキスト図（C4 Level 1）
[mermaid graph TD: ユーザー・外部システム・本システムの関係]

### コンテナ図（C4 Level 2）
[mermaid graph TD: フロントエンド/バックエンド/DB/外部サービスの構成]

### データフロー図
[mermaid flowchart]

## 2. 技術スタック選定（差分のみ）
| 領域 | 選定技術 | 選定理由 | 代替案と不採用理由 |
|-----|--------|--------|----------------|
※ プロジェクト既存スタック踏襲の場合は省略

## 3. データモデル全体像
### ER図（概念レベル）
[mermaid erDiagram]

### 主要テーブル一覧
| テーブル名 | 概要 | 対応Issue | 新規/変更 |
|----------|------|---------|---------|

### 既存スキーマへの影響
- 新規テーブル:
- 変更テーブル:
- マイグレーション戦略:

## 4. API設計方針
### 設計原則
- REST / GraphQL
- 認証方式:
- エラーレスポンス形式:

### エンドポイント一覧（Epic全体）
| エンドポイント | メソッド | 概要 | 対応Issue |
|--------------|--------|------|---------|

## 5. 外部サービス統合
| サービス名 | 用途 | 連携方式 | 対応Issue |
|----------|------|--------|---------|

## 6. インフラ構成（変更がある場合のみ）

## 7. Issue間の技術的依存関係
[mermaid graph LR: Issue依存グラフ]

| 依存元Issue | 依存先Issue | 依存の理由 |
|-----------|-----------|---------|

## 8. 横断的技術決定事項
- キャッシュ戦略:
- ロギング方針:
- エラーハンドリング方針:
- 共通コンポーネント・共有型定義:

## 9. マイグレーション戦略（既存システム移行時のみ）

## 10. テスト戦略
- 単体テスト方針:
- 統合テスト方針:
- E2Eテスト方針:
```

**Issue design.mdとの差分:**

| セクション | Epic版で追加 | 理由 |
|-----------|------------|------|
| C4 Level 1-2（コンテキスト/コンテナ図） | ◯ | Issue単体では見えないシステム全体像 |
| Issue間技術的依存関係 | ◯ | 実装順序の根拠 |
| 横断的技術決定事項 | ◯ | Issue単位では書きにくい横断判断 |
| データモデル全体像（概念ER） | ◯ | Issue間のデータ整合性確保 |
| 詳細実装設計（Domain/Infra/App層） | Issue版のみ | Epic粒度では不要 |
| コンポーネント詳細Props/State | Issue版のみ | Epic粒度では不要 |

### Epic ui-design.pen + screen-transitions.drawio の構成

**役割分担: drawio = 遷移ロジック、ui-design.pen = UIビジュアル**

#### screen-transitions.drawio（画面遷移図）
drawio-guideスキルで生成。画面遷移の**ロジック**に集中:

| コンテンツ | 内容 |
|-----------|------|
| 画面遷移フロー | 全画面間の遷移（条件分岐・エラー遷移・認証ガード含む） |
| 遷移トリガー | 各遷移を発火するユーザーアクション・システムイベント |
| 状態遷移 | 画面状態（ローディング・空状態・エラー）の遷移 |
| Issue別色分け | 各遷移を担当するIssueごとに色分け |

#### ui-design.pen（UIビジュアル）
Pencil MCPで生成。Epic粒度では**Overview粒度**に留め、詳細モックは各Issue ui-design.penに委任:

| コンテンツ | 内容 | 詳細度 |
|-----------|------|-------|
| 画面一覧 | 全画面のサムネイル一覧 + 画面ID | 全画面 |
| 主要画面ワイヤーフレーム | 優先度High画面の詳細ワイヤー | High画面のみ |
| デザインシステム参照 | 使用コンポーネント・カラー・タイポ方針 | 概要 |
| Issue別画面割り当て表 | Issue → 担当画面IDの対応 | 全Issue |

**フレーム命名規則（既存踏襲）:**

| 種別 | 規則 | 例 |
|------|------|-----|
| ページフレーム | URLパスをkebab-case化 | `dashboard`, `settings-profile` |
| サブコンポーネント | `{path}__[element]` | `dashboard__submit-modal` |
| 状態バリアント | `{path}--[state]` | `dashboard--empty-state` |

### 各Issueへのインプット形式（scope.md）

Epic文書から各Issue固有情報を抜粋した橋渡し文書:

```markdown
# Scope: {Issue名}

## 参照Epic
- **Epic**: EPIC-{N} {エピック名}
- **Epic requirements**: docs/specs/epics/{epic名}/requirements.md
- **Epic design**: docs/specs/epics/{epic名}/design.md
- **Epic ui-design**: docs/specs/epics/{epic名}/ui-design.pen
- **Epic 画面遷移図**: docs/specs/epics/{epic名}/screen-transitions.drawio

## このIssueが担当するFeature
- F-{N}: {機能名}（Epic requirements.md §5 Feature Map より）

## ユーザーストーリー
{Epic requirements.md §6 から該当ストーリーを抜粋}
As a {ペルソナ} / I want to / So that

## 受け入れ基準（AC）
- [ ] AC-1: {Epic ACから該当分を抜粋 + Issue固有AC}

## Epicから継承する非機能要件
※ Epic requirements.md §7 より該当箇所を抜粋
- パフォーマンス: {該当要件}
- セキュリティ: {該当要件}

## 技術的前提・制約
※ Epic design.md より該当箇所を抜粋
- 使用するテーブル: {Epic ER図より}
- 準拠するAPI方針: {Epic API設計方針より}
- 依存Issue: #{N}（完了後に着手可能）

## 担当する画面
※ Epic ui-design.pen より
| 画面名 | 画面ID | 備考 |
|------|--------|-----|

## スコープ境界
### In Scope（このIssueで実装するもの）
### Out of Scope（他Issueに委ねるもの + Epic Out of Scope）

## Issue固有の補足情報
[Epicに記載されていないIssue固有の判断・制約]
```

### issue-spec-createの動作変更（epic-contextモード）

| Phase | 通常モード | epic-contextモード |
|-------|-----------|-------------------|
| Phase 1: requirements | 新規生成 | scope.md + Epic requirements.mdを継承して生成 |
| Phase 2: ui-design.pen | 新規生成 | Epic ui-design.penを参照して差分生成（またはスキップ） |
| Phase 3: design.md | 新規生成 | Epic design.mdを前提に差分設計のみ生成 |
| Phase 4: qa-tests | 通常通り | 通常通り |
| Phase 5: GitHub Issue | 通常通り | Milestone設定 + Epic Issue参照リンク追加 |
| 承認 | 各Phase承認必須 | **全Phase自動（承認スキップ）** |

### issue-spec-createへの修正詳細

| 修正箇所 | 内容 |
|---------|------|
| SKILL.md ARGUMENTS | `epic-context` パラメータ追加（Epicディレクトリパス） |
| SKILL.md ARGUMENTS | `auto` モード追加（全Phase承認スキップ） |
| SKILL.md ARGUMENTS | `milestone` パラメータ追加 |
| SKILL.md ARGUMENTS | `branch-base` パラメータ追加（外部指定時は質問スキップ） |
| Step 0.3 (L47-62) | branch-base外部指定時: AskUserQuestionスキップ |
| Phase 1 (L118-125) | auto時: 承認スキップ→自動コミット。epic-context時: scope.md+Epic requirements.mdを入力 |
| Phase 2+3 (L152-164) | auto時: プレビュー省略→自動コミット。epic-context時: Epic ui-design.pen/design.md参照 |
| Phase 4 (L186-192) | auto時: 承認スキップ→自動コミット |
| Phase 5 (L242-276) | auto時: 承認スキップ→自動実行。milestone設定追加 |

### 出力ディレクトリ構造

```
/docs/specs/
├── epics/
│   └── {epic名}/
│       ├── epic-overview.md        # ビジョン・スコープ・ストーリーマップ・Issue分割（Step 1）
│       ├── requirements.md         # Epic全体の要件定義（Step 2a）
│       ├── screen-transitions.drawio # 画面遷移図（Step 2b、UI要件ある場合）
│       ├── ui-design.pen           # Epic全体のUIデザイン（Step 2c、UI要件ある場合）
│       ├── design.md               # Epic全体の設計（Step 2d）
│       └── issues/
│           ├── {issue-1-slug}/
│           │   └── scope.md        # Issue固有スコープ（Step 3）
│           └── {issue-2-slug}/
│               └── scope.md
└── issues/                          # issue-spec-createが生成（既存構造）
    └── {カテゴリ}/
        ├── issue{N1}-{名前}/        # requirements.md, design.md, ui-design.pen, qa-tests/
        └── issue{N2}-{名前}/
```

### サブエージェント構成

| エージェント | パス | 責務 |
|------------|------|------|
| epic-planner | .claude/agents/einja/epic-specs/epic-planner.md | Epic概要 + Issue分割 + scope.md群の生成 |

※ requirements-generator / design-generator / ui-design-generator は既存エージェントを再利用（Epic粒度パラメータ付き）
※ epic-summarizer は不要（親エージェントが直接実行）

### CLAUDE.md 更新

- キーワードトリガー追加: `Epic` `epic` `Epic仕様` `プロダクト仕様` `複数Issue` `大規模タスク`
- 委託ルールテーブルに `einja-epic-spec-create` 追加

## Skill仕様（einja-skill-plan-guide ワークフローA準拠）

### einja-epic-spec-create

| 項目 | 値 |
|------|-----|
| name | einja-epic-spec-create |
| description | Epic（複数Issue束ね）仕様書を作成するSkill。Epic概要・Issue分割→全体requirements/design/UIデザイン→各Issue仕様書の自動展開をオーケストレーション。「Epic」「epic」「Epic仕様」「プロダクト仕様」「複数Issue」「大規模タスク」で呼び出す |
| 分類 | ユーザー向け（`einja-` プレフィックス） |
| 配置先 | `.claude/skills/einja-epic-spec-create/SKILL.md` |
| allowed-tools | Bash, Read, Write, Edit, MultiEdit, Grep, Glob, Agent(Plan,Explore,general-purpose,requirements-generator,design-generator,ui-design-generator,epic-planner), Skill(einja-issue-spec-create,einja-task-commit,einja-common:drawio-guide,einja-common:pencil-guide), AskUserQuestion, mcp__github__*, mcp__pencil__*, mcp__claude_ai_Asana__*, mcp__drawio__* |
| 依存Skill | einja-issue-spec-create（epic-context + autoモード）, einja-task-commit |
| Progressive disclosure | Step 0-1は軽量（epic-planner 1エージェント）、Step 2はrequirements/design/uiを並列、Step 3はissue-spec-createループ |

## タスク概要

| # | タスク | 使用Skill/エージェント | 依存 |
|---|--------|----------------------|------|
| 0 | Planファイルを `docs/plans/202603/20260312-epic-spec-create.plan.md` にリネーム | [直接実行] | - |
| 1 | epic-planner エージェント作成 | [einja-skill-creator] | 0 |
| 2 | einja-epic-spec-create SKILL.md 作成 | [einja-skill-creator] | 1 |
| 3 | einja-issue-spec-create 修正（auto/epic-context/milestone/branch-base対応） | [general-purpose] | 0 |
| 4 | CLAUDE.md キーワードトリガー・委託ルール更新 | [直接編集] | 2 |
| 5 | 完了レビュー | [einja-review-code] | 2,3,4 |

## 並列実行計画

```
Phase 0（順次）: タスク0
  └─ Planファイルリネーム

Phase 1（並列）: タスク1 + タスク3
  ├─ タスク1: epic-planner エージェント作成
  └─ タスク3: issue-spec-create 修正

Phase 2（順次）: タスク2（タスク1完了後）
  └─ einja-epic-spec-create SKILL.md 作成

Phase 3（順次）: タスク4 → タスク5
  └─ CLAUDE.md更新 → 完了レビュー
```

## リスク・不明点

| リスク | 対策 |
|--------|------|
| issue-spec-createのauto/epic-context修正が大規模化 | 最小限の条件分岐で実装。auto=AskUserQuestionスキップ、epic-context=サブエージェントプロンプトにEpicパス追加のみ |
| Epic全体requirements/designとIssue個別の整合性 | scope.mdがEpic文書への参照を持ち、issue-spec-createのサブエージェントがそれを読む |
| 10 Issueの場合のissue-spec-createループ長時間化 | まずは順次実行で安定性優先。並列化は将来課題 |
| ui-design.penのEpic全体とIssue個別の整合性 | epic-contextモードではEpic UIを参照し差分のみ生成（またはスキップ） |
| 既存generatorがEpic粒度プロンプトに未対応 | Epic呼び出し時のプロンプトでEpic固有セクション（ペルソナ、Feature Map等）の生成を指示 |

## 検証・動作確認方法

1. `pnpm prepush` が通ること（lint + typecheck）
2. SKILL.mdのフロントマター形式が正しいこと（name, description, allowed-tools）
3. エージェントファイルの配置パスが正しいこと
4. issue-spec-createの既存動作が壊れないこと（auto/epic-context未指定時は従来通り）
5. CLAUDE.mdのキーワードトリガーが正しく記載されていること
6. 小規模Epicで実際にSkillを呼び出して動作確認（2-3 Issue規模）
