# Plan: einja-epic-spec-create Skill 新規作成

## Context

現在、Issue単位の仕様書作成（`einja-issue-spec-create`）と実行（`einja-issue-exec` / `einja-issue-team-exec`）は整備済みだが、複数Issueにまたがる大規模機能や新規プロダクト開発を扱うEpic単位の仕様書作成Skillがない。

このPlanでは `einja-epic-spec-create` を新規作成し、Epic全体の要件・設計・UI/画面遷移・Issue分割を作成したうえで、各Issueの詳細仕様書を `einja-issue-spec-create` にHeadless modeで展開する。

### 核心思想

- Epicの価値は、各Issueへの良質で検証可能な入力を作ること。
- Skillは型付き関数APIではなくMarkdown指示であるため、自然文だけでIssueSpecを連鎖生成しない。
- EpicからIssueへ渡す契約を `epic-manifest.json` と各Issueの `scope.md` に固定する。
- 各Issueの詳細仕様書生成は `einja-issue-spec-create` に委任するが、Headless modeとresume-stateで再入可能にする。
- Headless modeでも `einja-review-spec`、tasks-validator、契約validatorは省略しない。

## 現状

| 既存Skill | 機能 | 粒度 |
|-----------|------|------|
| `einja-issue-spec-create` | requirements / ui-design / design / qa-test / GitHub Issueタスク記述 / Spec PR作成 | 単一Issue |
| `einja-issue-exec` | Issue内タスクの階層的並列実行 | 単一Issue |
| `einja-issue-team-exec` | Agent Teams版のIssue実行 | 単一Issue |
| Epic対応 | なし | - |

### 解決すべき制約

| 制約 | 問題 | 対応 |
|------|------|------|
| IssueSpec作成が対話前提 | AskUserQuestionと承認待ちがあり、Epicから複数Issueを安定展開できない | `einja-issue-spec-create` にHeadless modeとresume modeを追加 |
| 外部コンテキストが自然文依存 | Epic全体の設計・AC・UI割当を各Issueへ安定して渡せない | `epic-manifest.json` + YAML frontmatter付き `scope.md` を導入 |
| Issue間整合性の検証がない | AC未割当、重複割当、循環依存、UI/遷移割当漏れを検出できない | `_einja-epic-contract-validator` を追加 |
| ブランチ階層が未定義 | EpicブランチとIssueブランチのbaseが曖昧 | `IssueBranchBase -> epic/{slug} -> issue/{N}` に統一 |
| QA成果物名が揺れている | 既存agent側に `qa-tests/scenarios.md` 参照が残る一方、現行IssueSpecは `qa-test.md` を生成 | `qa-test.md` に統一 |

## 変更内容

### 処理フロー

```
Step 0: 前提確認
├── 0.1 IssueBranchBase選択
├── 0.2 依存MCP/プラグイン確認
│   ├── GitHub MCP
│   ├── Pencil MCP
│   ├── drawio MCP / drawio-guide
│   ├── Context7 MCP
│   └── Serena MCP
├── 0.3 外部リソース確認（Asana / Figma / PRD / 既存仕様）
└── 0.4 Epic作業ブランチ epic/{slug} 作成

Step 1: Epic概要 + Issue分割契約
├── epic-planner エージェントで epic-overview.md を生成
├── epic-manifest.json を生成
├── 各Issueの scope.md を生成
├── _einja-epic-contract-validator で契約検証
└── ユーザー承認 → コミット＆プッシュ

Step 2: Epic全体成果物
├── Epic requirements.md
├── screen-transitions.drawio
├── Epic ui-design.pen（UI要件がある場合）
├── Epic design.md
├── einja-review-spec でEpic成果物レビュー
└── ユーザー承認 → コミット＆プッシュ

Step 3: 各Issue仕様書のHeadless展開
├── GitHub Milestone作成
├── Epic Tracker Issue作成
├── 各Issueについて依存DAG順に実行
│   ├── GitHub Issue作成
│   ├── issue/{N} ブランチ作成（base: epic/{slug}）
│   ├── einja-issue-spec-create mode=headless 実行
│   ├── PENDING_QUESTIONS発生時はEpic側で質問 → resume
│   └── Issue Spec PR作成（base: epic/{slug}, head: issue/{N}）
└── Epic PR作成（base: IssueBranchBase, head: epic/{slug}）
```

### ブランチ/PRモデル

| 階層 | ブランチ | 作成元 | 目的 |
|------|----------|--------|------|
| Base | `main` / `develop` / 任意 | - | IssueBranchBase |
| Epic | `epic/{slug}` | IssueBranchBase | Epic全体成果物と各Issue Spec PRの統合先 |
| Issue | `issue/{N}` | `epic/{slug}` | 各Issue仕様書の作業ブランチ |

| PR | base | head | 目的 |
|----|------|------|------|
| Issue Spec PR | `epic/{slug}` | `issue/{N}` | 個別Issue仕様書レビュー |
| Epic PR | IssueBranchBase | `epic/{slug}` | Epic全体の仕様レビュー |

## Epic契約ファイル

### epic-manifest.json

`epic-manifest.json` はEpicから各Issueへ渡すSingle Source of Truthとする。`epic-planner` が生成し、`_einja-epic-contract-validator` が検証する。

```json
{
  "epicId": "EPIC-{N}",
  "slug": "{epic-slug}",
  "title": "{Epic名}",
  "baseBranch": "develop",
  "epicBranch": "epic/{epic-slug}",
  "milestoneTitle": "{Epic名}",
  "trackerIssueNumber": null,
  "features": [
    {
      "id": "F-01",
      "title": "{Feature名}",
      "storyIds": ["S-01"],
      "acIds": ["AC-01", "AC-02"],
      "issueSlug": "{issue-slug}"
    }
  ],
  "issues": [
    {
      "slug": "{issue-slug}",
      "title": "{Issueタイトル}",
      "category": "{category}",
      "scopePath": "docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md",
      "dependsOn": [],
      "featureIds": ["F-01"],
      "storyIds": ["S-01"],
      "acIds": ["AC-01", "AC-02"],
      "uiFrameIds": ["dashboard"],
      "transitionIds": ["TR-01"],
      "githubIssueNumber": null,
      "branch": null,
      "prUrl": null
    }
  ],
  "acceptanceCriteria": [
    {
      "id": "AC-01",
      "summary": "{AC概要}",
      "ownerIssueSlug": "{issue-slug}"
    }
  ],
  "uiFrames": [
    {
      "id": "dashboard",
      "name": "dashboard",
      "ownerIssueSlug": "{issue-slug}"
    }
  ],
  "transitions": [
    {
      "id": "TR-01",
      "from": "dashboard",
      "to": "settings-profile",
      "trigger": "{ユーザー操作またはシステムイベント}",
      "ownerIssueSlug": "{issue-slug}"
    }
  ]
}
```

### scope.md

各Issueの `scope.md` はYAML frontmatterを必須にする。本文は人間とIssueSpec生成エージェントが読む説明、frontmatterはvalidatorが読む契約とする。

```markdown
---
epicId: EPIC-{N}
issueSlug: {issue-slug}
featureIds:
  - F-01
storyIds:
  - S-01
acIds:
  - AC-01
  - AC-02
dependsOn: []
uiFrameIds:
  - dashboard
transitionIds:
  - TR-01
---

# Scope: {Issue名}

## 参照Epic
- Epic requirements: docs/specs/epics/{epic-slug}/requirements.md
- Epic design: docs/specs/epics/{epic-slug}/design.md
- Epic ui-design: docs/specs/epics/{epic-slug}/ui-design.pen
- Epic screen transitions: docs/specs/epics/{epic-slug}/screen-transitions.drawio
- Epic manifest: docs/specs/epics/{epic-slug}/epic-manifest.json

## このIssueが担当するFeature
{Featureと担当範囲}

## ユーザーストーリー
{該当Storyの抜粋}

## 受け入れ基準
{該当ACの抜粋}

## 技術的前提・制約
{Epic designから継承する前提}

## 担当する画面・遷移
| 種別 | ID | 備考 |
|------|----|------|
| UI Frame | dashboard | Epic ui-design.pen参照 |
| Transition | TR-01 | screen-transitions.drawio参照 |

## スコープ境界
### In Scope
### Out of Scope

## Issue固有の補足情報
```

## Epic成果物

### requirements.md

Epic粒度の要件定義書。Issue単体では判断しづらい以下を扱う。

- プロダクトビジョン・ゴール・KPI
- ペルソナ
- Epic全体のIn/Out Scope
- ユーザーストーリーマップ
- Feature Map
- Epic AC一覧
- Issue分割対応表
- 非機能要件
- リスクと対策

### screen-transitions.drawio

drawio MCP / drawio-guide を使用して生成する。画面遷移ロジックの正式成果物とする。

| コンテンツ | 内容 |
|------------|------|
| 画面遷移フロー | 全画面間の遷移、認証ガード、エラー遷移 |
| 遷移トリガー | ユーザー操作、システムイベント |
| 状態遷移 | ローディング、空状態、エラー状態 |
| Issue割当 | 遷移ごとに `TR-*` と担当Issueを紐づける |

### ui-design.pen

Pencil MCPで生成する。Epic粒度ではOverview粒度に留め、詳細モックは各Issueの `ui-design.pen` に委ねる。

| コンテンツ | 内容 |
|------------|------|
| 画面一覧 | 全画面のサムネイル一覧 + 画面ID |
| 主要画面ワイヤーフレーム | 優先度Highの画面 |
| デザインシステム参照 | 使用コンポーネント、カラー、タイポ方針 |
| Issue別画面割当 | Issueと画面IDの対応 |

### design.md

Epic粒度の技術設計書。詳細実装設計ではなく、Issue間で共有する技術判断を扱う。

- C4 Level 1-2
- データモデル全体像
- API設計方針
- 外部サービス統合
- Issue間の技術的依存関係
- 横断的技術決定事項
- テスト戦略

## Headless / Resume設計

### `einja-issue-spec-create` Headless mode

`einja-issue-spec-create` に、Epicから呼ばれる非対話モードを追加する。

| 入力 | 説明 |
|------|------|
| `mode=headless` | AskUserQuestionとユーザー承認待ちを直接発生させない |
| `epic-context` | Epicディレクトリパス |
| `manifest-path` | `epic-manifest.json` のパス |
| `scope-path` | 対象Issueの `scope.md` パス |
| `resume-state-path` | 対象Issueの再開状態ファイル |
| `issue-base-branch` | `issue/{N}` の作成元。原則 `epic/{slug}` |
| `pr-base-branch` | Issue Spec PRのbase。原則 `epic/{slug}` |
| `milestone` | GitHub Milestone名 |
| `epic-tracker-issue` | Epic Tracker Issue番号 |

Headless modeのルール:

- AskUserQuestionは使わない。
- ユーザー承認待ちは発生させない。
- `einja-review-spec` は必ず実行する。
- tasks-validatorは必ず実行する。
- `_einja-epic-contract-validator` が必要とするメタデータを更新する。
- ビジネス判断が必要な不明点は `PENDING_QUESTIONS` と `resume-state` を返して一時停止する。

### resume-state

各Issueごとに以下へ保存する。

`docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json`

```json
{
  "epicId": "EPIC-{N}",
  "issueSlug": "{issue-slug}",
  "status": "pending",
  "currentPhase": "requirements",
  "generatedArtifacts": [],
  "githubIssueNumber": null,
  "branch": null,
  "prUrl": null,
  "pendingQuestions": [],
  "answers": [],
  "attemptCount": 0,
  "updatedAt": "YYYY-MM-DDTHH:mm:ssZ"
}
```

| status | 意味 |
|--------|------|
| `pending` | 未開始 |
| `running` | 実行中 |
| `blocked` | 質問待ち |
| `resumed` | 回答後に再開済み |
| `completed` | 完了 |
| `failed` | 回復不能エラー |

### Epic側の質問・再開フロー

1. IssueSpec Headless実行中に不明点が出た場合、IssueSpec側は `PENDING_QUESTIONS` と `resume-state` を返して停止する。
2. `einja-epic-spec-create` は対象Issueを `blocked` にする。
3. Epic側が質問内容を統合し、ユーザーへAskUserQuestionで確認する。
4. 回答を `resume-state.json` に追記する。
5. 同じIssueSpec作成を `resume` として再開する。
6. 再開時は既存のGitHub Issue、ブランチ、生成済み成果物を読み込み、未完了フェーズだけ実行する。
7. 同一Issueで質問ループが3回続いた場合はEpic全体を停止し、未解決事項をまとめて報告する。

## 新規/更新するSkill・エージェント

### `einja-epic-spec-create`

| 項目 | 値 |
|------|-----|
| name | `einja-epic-spec-create` |
| description | Epic（複数Issueを束ねる大規模機能）仕様書を作成し、Epic契約ファイルを検証してから各Issue仕様書をHeadless展開するSkill。「Epic」「Epic仕様」「プロダクト仕様」「複数Issue」「大規模タスク」で使用する。Do NOT use for: 単一Issueの仕様書作成（`einja-issue-spec-create`を使う） |
| 分類 | オーケストレーター / ユーザー向け |
| 配置先 | `.claude/skills/einja-epic-spec-create/SKILL.md` |
| 依存 | `einja-issue-spec-create` Headless + resume対応、`_einja-epic-contract-validator`, `einja-task-commit`, drawio MCP / drawio-guide, Pencil MCP |
| allowed-tools | Bash, Read, Write, Edit, MultiEdit, Grep, Glob, Agent, Skill, AskUserQuestion, `mcp__github__*`, `mcp__pencil__*`, `mcp__drawio__*`, `mcp__claude_ai_Asana__*` |

### `epic-planner`

| 項目 | 値 |
|------|-----|
| 配置先 | `.claude/agents/einja/epic-specs/epic-planner.md` |
| 責務 | `epic-overview.md`, `epic-manifest.json`, 各Issue `scope.md` を生成 |
| 質問 | サブエージェントなのでAskUserQuestionは使わず、`PENDING_QUESTIONS` で親へ返す |

### `_einja-epic-contract-validator`

| 項目 | 値 |
|------|-----|
| 配置先 | `.claude/skills/_einja-epic-contract-validator/SKILL.md` |
| 分類 | インナー配布Skill |
| 責務 | `epic-manifest.json` と `scope.md` の整合性検証 |

検証項目:

- 各Featureが1つ以上のIssueに割り当てられていること
- 各ACが1つのIssueに割り当てられていること
- ACの重複割当がないこと
- Issue依存DAGに循環がないこと
- `dependsOn` の参照先Issueが存在すること
- `uiFrameIds` の参照先が `uiFrames` に存在すること
- `transitionIds` の参照先が `transitions` に存在すること
- `scope.md` frontmatterとmanifestのIssue定義が一致すること
- 各Issueが独立してデプロイ・テスト可能な縦切り単位になっていること

### `einja-issue-spec-create` 更新

追加する機能:

- Headless mode
- resume mode
- `scope.md` + `epic-manifest.json` 入力
- `issue-base-branch` / `pr-base-branch` 外部指定
- Milestone設定
- Epic Tracker Issueリンク付与
- 既存成果物を読み込んだ冪等な再開

既存通常モードの挙動は変更しない。

## タスク概要

| # | タスク | 使用Skill/エージェント | 依存 |
|---|--------|----------------------|------|
| 0 | Planファイルを `docs/plans/202603/20260314-epic-spec-create.plan.md` にリネーム | 直接実行 | - |
| 1 | QA成果物名の不整合修正（`qa-test.md` に統一） | general-purpose | 0 |
| 2 | Epic manifest / scope schemaを定義 | general-purpose | 0 |
| 3 | `epic-planner` エージェント作成 | `einja-skill-creator` | 2 |
| 4 | `_einja-epic-contract-validator` 作成 | `einja-skill-creator` | 2 |
| 5 | `einja-issue-spec-create` Headless + resume mode追加 | general-purpose | 1,2 |
| 6 | `screen-transitions.drawio` 生成手順をEpic workflowに組み込む | general-purpose | 2 |
| 7 | `einja-epic-spec-create` 作成 | `einja-skill-creator` | 3,4,5,6 |
| 8 | CLAUDE.md / 配布設定更新 | 直接編集 | 7 |
| 9 | Skill品質レビュー + コードレビュー | `einja-skill-plan-guide`, `einja-review-code` | 8 |
| 10 | 小規模Epic動作確認（2 Issue規模） | 手動実行 / Playwright・MCP確認 | 9 |

## 並列実行計画

```
Phase 0:
  └─ タスク0

Phase 1:
  ├─ タスク1
  └─ タスク2

Phase 2:
  ├─ タスク3
  ├─ タスク4
  ├─ タスク5
  └─ タスク6

Phase 3:
  └─ タスク7

Phase 4:
  ├─ タスク8
  └─ タスク9

Phase 5:
  └─ タスク10
```

## リスク・対策

| リスク | 対策 |
|--------|------|
| Headless modeで不明点が発生し自動展開が止まる | Epic側が質問を集約し、回答を `resume-state.json` に保存して対象Issueだけ再開する |
| 自然文のscopeから抽出がぶれる | YAML frontmatterと `epic-manifest.json` を契約として使い、validatorで検証する |
| EpicとIssueのAC整合性が崩れる | ACはmanifest上でownerを一意にし、重複/未割当をvalidatorでFAILUREにする |
| drawio遷移とui-designの割当がずれる | `uiFrameIds` と `transitionIds` をmanifestに持たせる |
| 10 Issue展開が長時間化する | v1は依存DAG順の順次実行。並列化は将来拡張 |
| 既存IssueSpec通常モードが壊れる | Headless modeを明示指定時のみ有効にし、通常モード回帰テストを必須にする |

## 検証・動作確認方法

1. `pnpm prepush` が通ること。
2. 通常の `einja-issue-spec-create` が従来通り動作すること。
3. Headless modeで2 Issue規模のEpic展開が完了すること。
4. Headless mode中に意図的に不明点を発生させ、Epic側が質問、回答保存、IssueSpec resumeを実行できること。
5. `_einja-epic-contract-validator` が以下を検出できること。
   - AC未割当
   - AC重複割当
   - 循環依存
   - UI frame未割当
   - drawio遷移未割当
   - scope frontmatter欠落
6. 各Issue Spec PRが `epic/{slug}` baseで作成されること。
7. `screen-transitions.drawio` が生成され、Issue別の遷移IDまたは担当Issue参照を持つこと。
8. `qa-tests/scenarios.md` 参照が残っておらず、`qa-test.md` に統一されていること。

## 完了条件

- `einja-epic-spec-create` のPlanが、Epic契約ファイル、Headless + resume、drawio成果物、ブランチ/PRモデル、validator、QA名統一を含む決定済み仕様になっていること。
- 実装者が追加判断なしでSkill作成に着手できること。
