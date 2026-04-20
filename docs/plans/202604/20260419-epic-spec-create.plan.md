# Plan: einja-epic-spec-create Skill 新規作成

## Context

現在、Issue単位の仕様書作成（`einja-issue-spec-create`）と実行（`einja-issue-exec` / `einja-issue-team-exec`）は整備済みだが、複数Issueにまたがる大規模機能や新規プロダクト開発を扱うEpic単位の仕様書作成Skillがない。

このPlanでは `einja-epic-spec-create` を新規作成し、Epic全体の要件・設計・UI/画面遷移・Issue分割を作成したうえで、各Issueの詳細仕様書を `einja-issue-spec-create` にHeadless modeで展開する。

本Planのスコープは **仕様書生成まで**。Epic実行フェーズ（`einja-epic-exec` 相当）は別Planで扱うが、manifestスキーマは将来の実行フェーズが消費することを前提に設計する。

### 核心思想

- Epicの価値は、各Issueへの良質で検証可能な入力を作ること。
- Skillは型付き関数APIではなくMarkdown指示であるため、自然文だけでIssueSpecを連鎖生成しない。
- EpicからIssueへ渡す契約を `epic-manifest.json` と各Issueの `scope.md` に固定する。
- 各Issueの詳細仕様書生成は `einja-issue-spec-create` に委任するが、Headless modeとresume-stateで再入可能にする。
- Headless modeでも `einja-review-spec`、tasks-validator、契約validatorは省略しない。
- Validatorは「構造検証（決定論）」と「LLMレビュー（`einja-review-spec` 等）」に分離し、前者を `_einja-epic-contract-validator` に集約する。

## 現状

### 既存Skill / エージェント

| 既存Skill | 機能 | 粒度 |
|-----------|------|------|
| `einja-issue-spec-create` | requirements / ui-design / design / qa-test / GitHub Issueタスク記述 / Spec PR作成 | 単一Issue |
| `einja-issue-exec` | Issue内タスクの階層的並列実行 | 単一Issue |
| `einja-issue-team-exec` | Agent Teams版のIssue実行 | 単一Issue |
| Epic対応 | なし | - |

### 既存 `einja-issue-spec-create` の対話・分岐ポイント（棚卸し）

Headless化の影響範囲を事前に明確化する。

| 箇所 | 種別 | 現行挙動 | Headless時の方針 |
|------|------|----------|-----------------|
| Phase 0.3 要件ヒアリング | AskUserQuestion（最大3ループ） | 不明点を対話で解消 | `scope.md` から抽出。不足は `PENDING_QUESTIONS` で親へ返却 |
| Phase 0.4 IssueBranchBase選択 | AskUserQuestion | 通常base候補提示 | 親から `issue-base-branch` を必須入力で受領 |
| Phase 0.5 Skill作成必要性評価（`einja-skill-first`） | AskUserQuestion | Skill化有無を対話で判定 | Headless時は無効化（Epic側が一括評価） |
| Phase 0.x worktree作成 | 自動 or 確認 | 必要に応じて作成 | 親が `epic/{slug}` worktreeを持つため、Issue側はworktree作成しない（親worktree内で作業） |
| Phase 1 requirements生成後承認 | ユーザー承認待ち | 成果物レビュー | `einja-review-spec` のレビュー結果でPASS/MINORなら自動継続、MAJORなら `PENDING_QUESTIONS` |
| Phase 1.5 UI要否判断 | AskUserQuestion | UIあり/なしを対話 | manifestの `uiFrameIds` が空配列 or 省略 → UIなしと判定 |
| Phase 2 design生成後承認 | ユーザー承認待ち | 成果物レビュー | Phase 1と同じルール |
| Phase 3 tasks-validator失敗 | 手動修正依頼 | ユーザーに修正方針確認 | 3回まで自動再生成。それでも失敗で `PENDING_QUESTIONS` |
| GitHub Issue作成 | Skill内で自動 | 新規Issue作成 | **Epic側が先行作成**。Headlessには `github-issue-number` を必須入力で受領（責務一元化） |
| Issue Spec PR作成 | Skill内で自動 | base = IssueBranchBase | 親から `pr-base-branch`（通常 `epic/{slug}`）を必須入力で受領 |

通常モードでは上記挙動を維持する。Headlessは `mode: headless` 明示指定時のみ有効化し、条件分岐を `isInteractive()` 相当の単一ガードに集約する。

### 既存ブランチ戦略との整合

既存 `docs/einja/steering/branch-strategy.md` は `IssueBranchBase → issue/{N} → issue/{N}-phase{M}` の3階層。

**本Planでの統一方針**:
- **Epicがない場合**: `IssueBranchBase（main/develop等）→ issue/{N} → issue/{N}-phase{M}`（既存維持）
- **Epicがある場合**: `main/develop → epic/{slug} → issue/{N} → issue/{N}-phase{M}`
- Epic内では「そのEpicにおける IssueBranchBase = `epic/{slug}`」と再定義する。
- 既存 `issue/{N}` / `issue/{N}-phase{M}` 階層は**一切変更しない**。
- `branch-strategy.md` に「Epic配下での IssueBranchBase の解釈」を追記するのみ。

### 解決すべき制約

| 制約 | 問題 | 対応 |
|------|------|------|
| IssueSpec作成が対話前提 | AskUserQuestionと承認待ちがあり、Epicから複数Issueを安定展開できない | `einja-issue-spec-create` にHeadless modeとresume modeを追加（上表ポイントを網羅） |
| 外部コンテキストが自然文依存 | Epic全体の設計・AC・UI割当を各Issueへ安定して渡せない | `epic-manifest.json` + YAML frontmatter付き `scope.md` を導入 |
| Issue間整合性の検証がない | AC未割当、重複割当、循環依存、UI/遷移割当漏れを検出できない | `_einja-epic-contract-validator` を追加（構造検証） |
| ブランチ階層が既存と不整合 | EpicブランチとIssueブランチのbaseが曖昧 | `branch-strategy.md` にEpic配下のIssueBranchBase解釈を追記 |
| QA成果物名が揺れている | 既存agent・Skillに `qa-tests/scenarios.md` 参照が残る一方、現行IssueSpecは `qa-test.md` を生成 | **案A採用**: `qa-tests/scenarios.md` のみ `qa-test.md` に改名統一。story分割（`qa-tests/storyN.md`）は**本Planでは触らない**（`_einja-task-qa` のStory特定ロジックを保護） |
| GitHub Issue作成責務の二重化 | Epic側とIssueSpec側で重複作成リスク | Epic側が **Issue作成のみ** 担当、Headlessには `github-issue-number` を必須入力。**PR作成は Headless IssueSpec 側が create-or-update で一元管理**（Epic側は Epic PR のみ） |
| Milestone/Tracker/PR の冪等性不足 | resume時に重複作成リスク | ① Issue/PR/Milestone 本文（または Milestone Description）に **HTMLコメント永続マーカー** `<!-- einja:epic-id=EPIC-{N} issue-slug={slug} kind={issue-spec\|issue-spec-pr\|tracker\|epic-pr\|milestone} schema=1.0 -->` を必須化、② resume-state に `operationLog[]`（スキーマ後述、`error.retryable` 含む）を保持、③ 検索はリソース種別別に実施（Issue/PR は Search API `in:body`、**Milestone は REST List + クライアント側照合**）、④ operationLog は GET 再照合してから reuse/create 判定（再照合ルール後述） |
| 質問プロトコルのフォーマット互換 | 既存 `_einja-subagent-question-protocol` は Markdown `## PENDING_QUESTIONS` セクション形式が必須。Planの JSON ブローカーと不整合 | 既存Markdown形式は**サブエージェント↔親の通信プロトコルとして維持**。Epic側で**正規化ステップ**（Markdown PENDING_QUESTIONS → broker JSON）を実施。`_einja-subagent-question-protocol` 自体は変更しない |

## 変更内容

### 処理フロー

```
Step 0: 前提確認
├── 0.1 IssueBranchBase選択（Epic親の作成元ブランチ）
├── 0.2 依存MCP/プラグイン確認（GitHub / Pencil / drawio / Context7 / Serena）
├── 0.3 外部リソース確認（Asana / Figma / PRD / 既存仕様）
├── 0.4 Epicメタ宣言（UI要件あり/なし、Issue規模の想定）
└── 0.5 Epic作業ブランチ epic/{slug} 作成

Step 1: Epic概要 + Issue分割契約
├── epic-planner エージェントで epic-overview.md を生成
├── epic-manifest.json を生成（schemaVersion付き）
├── 各Issueの scope.md を生成（YAML frontmatter）
├── _einja-epic-contract-validator で構造検証
├── einja-review-spec でレビュー（承認ゲート1）
└── ユーザー承認 → コミット＆プッシュ

Step 2: Epic全体成果物
├── Epic requirements.md
├── screen-transitions.drawio（UI要件ありの場合）
├── Epic ui-design.pen（UI要件ありの場合）
├── Epic design.md
├── einja-review-spec でレビュー（承認ゲート2）
└── ユーザー承認 → コミット＆プッシュ

Step 3: 各Issue仕様書のHeadless展開
├── GitHub Milestone作成 or 再利用（永続マーカーで検索）
├── Epic Tracker Issue作成 or 再利用（永続マーカー `kind=tracker` で検索）
├── 各Issueについて依存DAG順に実行（v1は順次、--max-issues / --issue-slugs / --resume-from で分割可）
│   ├── GitHub Issue作成 or 再利用（永続マーカー `kind=issue-spec` で検索、外部再照合手順に従う）
│   │   └── Issue本文冒頭に `<!-- einja:epic-id=EPIC-{N} issue-slug={slug} kind=issue-spec schema=1.0 -->` を必須埋込
│   ├── issue/{N} ブランチ作成 or 再利用（base: epic/{slug}）
│   ├── einja-issue-spec-create mode=headless 実行
│   │   ├── 入力: github-issue-number, scope-path, manifest-path, resume-state-path, issue-base-branch, pr-base-branch, milestone, epic-tracker-issue
│   │   ├── Headlessガードで既存対話ポイントを全てバイパス
│   │   └── **Issue Spec PR作成・更新は Headless IssueSpec 側が責務を持つ**（PR本文に永続マーカー埋込、create-or-update 冪等化）
│   └── PENDING_QUESTIONS（Markdown）発生時はEpic側が broker JSON に正規化 → ユーザー確認 → resume
└── Epic PR作成（base: IssueBranchBase, head: epic/{slug}、Draft で先行作成し、子 Issue Spec PR のチェックリストを本文に記載。子PR全マージ後に Ready for review へ）
```

### ブランチ/PRモデル

| 階層 | ブランチ | 作成元 | 目的 |
|------|----------|--------|------|
| Base | `main` / `develop` / 任意 | - | Epic親のIssueBranchBase |
| Epic | `epic/{slug}` | IssueBranchBase | Epic全体成果物と各Issue Spec PRの統合先 |
| Issue | `issue/{N}` | `epic/{slug}` | 各Issue仕様書・実装の作業ブランチ |
| Issue Phase | `issue/{N}-phase{M}` | `issue/{N}` | 既存 branch-strategy.md どおり |

| PR | base | head | 目的 |
|----|------|------|------|
| Issue Spec PR | `epic/{slug}` | `issue/{N}` | 個別Issue仕様書レビュー |
| Epic PR | IssueBranchBase | `epic/{slug}` | Epic全体の仕様レビュー |

## Epic契約ファイル

### epic-manifest.json

`epic-manifest.json` はEpicから各Issueへ渡すSingle Source of Truthとする。`epic-planner` が生成し、`_einja-epic-contract-validator` が検証する。将来の `einja-epic-exec` がこれを消費する。

`uiFrames` / `transitions` はv1では **任意フィールド**。UI要件ありEpicで推奨、UI要件なしEpicでは省略可。

```json
{
  "schemaVersion": "1.0",
  "epicId": "EPIC-{N}",
  "slug": "{epic-slug}",
  "title": "{Epic名}",
  "hasUI": true,
  "baseBranch": "develop",
  "epicBranch": "epic/{epic-slug}",
  "milestoneTitle": "{Epic名}",
  "milestoneId": null,
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
      "specPrUrl": null
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
schemaVersion: "1.0"
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
- Epic ui-design: docs/specs/epics/{epic-slug}/ui-design.pen （UI要件ありの場合）
- Epic screen transitions: docs/specs/epics/{epic-slug}/screen-transitions.drawio （同上）
- Epic manifest: docs/specs/epics/{epic-slug}/epic-manifest.json

## このIssueが担当するFeature
## ユーザーストーリー
## 受け入れ基準
## 技術的前提・制約
## 担当する画面・遷移（UI要件ありの場合のみ）
## スコープ境界（In/Out Scope）
## Issue固有の補足情報
```

## Epic成果物

### requirements.md（必須）

- プロダクトビジョン・ゴール・KPI
- ペルソナ
- Epic全体のIn/Out Scope
- ユーザーストーリーマップ
- Feature Map
- Epic AC一覧
- Issue分割対応表
- 非機能要件
- リスクと対策

### screen-transitions.drawio（UI要件ありの場合のみ）

drawio MCP / drawio-guide を使用して生成する。

- 画面遷移フロー（認証ガード、エラー遷移含む）
- 遷移トリガー
- 状態遷移（ローディング、空、エラー）
- 遷移ごとに `TR-*` ID と担当Issueを紐づける

### ui-design.pen（UI要件ありの場合のみ）

Pencil MCPで生成。Epic粒度ではOverview粒度に留め、詳細モックは各Issueの `ui-design.pen` に委ねる。

- 全画面サムネイル + 画面ID
- 優先度Highの画面ワイヤーフレーム
- デザインシステム参照
- Issue別画面割当

### design.md（必須）

Epic粒度の技術設計書。

- C4 Level 1-2
- データモデル全体像
- API設計方針
- 外部サービス統合
- Issue間の技術的依存関係
- 横断的技術決定事項
- テスト戦略

## Headless / Resume設計

### `einja-issue-spec-create` Headless mode

Headless modeは `mode=headless` を明示指定したときのみ有効化。通常モードの挙動は一切変更しない。条件分岐は `isInteractive()` 相当の単一ガード関数で集約し、分岐漏れによる誤発火を防ぐ。

| 入力 | 必須 | 説明 |
|------|------|------|
| `mode=headless` | ○ | Headlessモード有効化（マーカーとしてプロンプト先頭に `<<MODE: HEADLESS>>` を配置） |
| `github-issue-number` | ○ | Epic側で事前作成したGitHub Issue番号 |
| `epic-context` | ○ | Epicディレクトリパス |
| `manifest-path` | ○ | `epic-manifest.json` のパス |
| `scope-path` | ○ | 対象Issueの `scope.md` パス |
| `resume-state-path` | ○ | 対象Issueの再開状態ファイルパス |
| `issue-base-branch` | ○ | `issue/{N}` の作成元（原則 `epic/{slug}`） |
| `pr-base-branch` | ○ | Issue Spec PRのbase（原則 `epic/{slug}`） |
| `milestone` | △ | GitHub Milestone名 |
| `epic-tracker-issue` | △ | Epic Tracker Issue番号 |

Headless modeのルール（前述「既存対話ポイント棚卸し」表の全箇所を網羅）:

- AskUserQuestionは使わない。
- ユーザー承認待ちは発生させない。
- `einja-skill-first` は無効化する。
- worktree作成は行わない（親worktree内で作業）。
- `einja-review-spec` は必ず実行し、結果をresume-stateに記録する。
  - MAJOR時は自動再生成（`attemptCounts.reviewSpec` 2回まで）、それでもMAJORなら `PENDING_QUESTIONS` 返却。
- tasks-validatorは必ず実行。失敗時は `attemptCounts.tasksValidator` 2回まで自動再生成、それでも失敗で `PENDING_QUESTIONS`。
- GitHub Issue作成は行わず、受領した `github-issue-number` を使う。Issue本文の更新（概要・Epic参照・タスク一覧）は **create-or-update** で冪等化し、本文冒頭の永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=issue-spec -->` は維持する。
- **Issue Spec PR 作成・更新は Headless IssueSpec 側が一元責務を持つ**。既存PR検索は本文冒頭の永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=issue-spec-pr -->` で実施。存在時は update、無ければ create。Epic 側からは PR 作成しない。
- ビジネス判断が必要な不明点は、既存 `_einja-subagent-question-protocol` に従い **Markdown の `## PENDING_QUESTIONS` セクション**で返す（JSON broker への正規化は Epic 側の責務）。同時に `resume-state` を更新して停止する。

### resume-state

各Issueごとに `docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json` に保存。git管理対象（PRレビューで進捗が追えるよう）。

```json
{
  "schemaVersion": "1.0",
  "epicId": "EPIC-{N}",
  "issueSlug": "{issue-slug}",
  "status": "pending",
  "currentPhase": "requirements",
  "generatedArtifacts": [],
  "githubIssueNumber": null,
  "milestoneId": null,
  "trackerIssueNumber": null,
  "branch": null,
  "issuePrNumber": null,
  "pendingQuestions": [],
  "answers": [],
  "operationLog": [],
  "attemptCounts": {
    "reviewSpec": 0,
    "tasksValidator": 0,
    "questionLoop": 0
  },
  "updatedAt": "YYYY-MM-DDTHH:mm:ssZ"
}
```

`attemptCounts` は resume 時に引き継ぐ（無限ループ防止）。ユーザー回答反映後も再試行回数は保持。

### operationLog スキーマ

外部リソース操作（Issue/Milestone/PR の create/update）の監査ログ。冪等再開時の再利用判定に使う。

```json
{
  "operationType": "issue-create | issue-update | milestone-create | tracker-issue-create | tracker-issue-update | pr-create | pr-update",
  "idempotencyKey": "{epicId}:{issueSlug}:{kind}",
  "remoteId": "{GitHub Issue番号 or PR番号 or Milestone ID}",
  "persistentMarker": "<!-- einja:epic-id=... issue-slug=... kind=... -->",
  "status": "success | failed",
  "createdAt": "YYYY-MM-DDTHH:mm:ssZ",
  "updatedAt": "YYYY-MM-DDTHH:mm:ssZ",
  "error": null
}
```

### GitHub リソースの永続マーカー規約

全ての Epic 関連 GitHub リソース（Issue / PR）は本文冒頭に以下形式のHTMLコメントを必須で埋め込む:

```
<!-- einja:epic-id={epicId} issue-slug={issueSlug|null} kind={kind} schema=1.0 -->
```

`kind` 値: `issue-spec` / `issue-spec-pr` / `tracker` / `epic-pr` / `milestone`（MilestoneはDescription冒頭）。

**検索方式は外部リソース種別ごとに異なる:**

| リソース種別 | 検索方式 |
|------------|---------|
| GitHub Issue / PR（`issue-spec` / `issue-spec-pr` / `tracker` / `epic-pr`） | GitHub Search API: `"einja:epic-id={epicId}" in:body` |
| GitHub Milestone（`milestone`） | **Search API 非対応**。REST `GET /repos/{owner}/{repo}/milestones?state=all&per_page=100` でページング取得し、**各 Milestone の `description` をクライアント側でマーカー照合**（`einja:epic-id={epicId}` が含まれるか） |

タイトル検索やリネームへの耐性を担保する。

### 外部リソース再照合・冪等再利用手順

`operationLog` を**スキップ根拠としてそのまま信頼せず**、必ず以下の順序で外部状態と再照合する:

1. `operationLog` に `status=success` + `remoteId` のエントリがある場合、該当リソースを GET（Issue/PR は `GET /repos/{owner}/{repo}/issues/{number}`、Milestone は `GET /repos/{owner}/{repo}/milestones/{id}`）
2. GET 成功 + 永続マーカー一致 → update / reuse
3. GET 404 or マーカー不一致 → **マーカー検索へフォールバック**（上表の種別別検索）
4. マーカー検索で発見 → `operationLog` を補正し（`remoteId` 更新、`updatedAt` 更新）reuse
5. いずれも見つからない → create（新規エントリを `operationLog` に追加）
6. `status=failed` エントリは**スキップ禁止**。`error.retryable: true` の場合は再試行、`false` の場合は `PENDING_QUESTIONS` に昇格

operationLog スキーマの `error` フィールドは以下を持つ:

```json
"error": {
  "message": "{エラー内容}",
  "retryable": true,
  "code": "{GitHub APIエラーコード等}"
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

`operationLog` は外部リソース操作（Issue作成/Milestone作成/PR作成）の履歴。冪等再開時にこれを参照し、実施済み操作はスキップする。

v1は順次実行のみ。resume-state のファイルロック / atomic write は **v1では実装不要**（順次実行のため競合なし）。並列実行対応と atomic write は将来の `einja-epic-exec`（別Plan）で導入。

### PENDING_QUESTIONS 質問ブローカー

サブエージェント ↔ Epic 間の **通信プロトコルは既存 `_einja-subagent-question-protocol` の Markdown `## PENDING_QUESTIONS` 形式を維持**（プロトコル互換を保つため）。`einja-issue-spec-create` / `einja-review-spec` / validator はすべて Markdown 形式で返却する。

Epic側はそれを受け取った後、**正規化ステップ**で以下の JSON 構造（broker JSON）に変換し、質問を一元管理する。

```json
{
  "questionId": "Q-{sha256短縮ハッシュ}",
  "sourceSkill": "einja-issue-spec-create | einja-review-spec | _einja-epic-contract-validator",
  "sourceIssueSlug": "{issue-slug} | null",
  "type": "requirement-ambiguity | design-decision | review-major | validator-failure",
  "fingerprint": "{同一質問検出用ハッシュ（sourceSkill + question 正規化テキスト）}",
  "question": "{質問本文}",
  "appliesToIssueSlugs": ["{issue-slug}"],
  "status": "open | answered | obsolete",
  "answer": null,
  "normalizedFromMarkdown": true
}
```

broker JSON は `docs/specs/epics/{epic-slug}/question-broker.json` に保存（git管理対象）。

### Epic側の質問・再開フロー

1. IssueSpec Headless実行中に不明点が出た場合、IssueSpec側は Markdown `## PENDING_QUESTIONS` セクションと `resume-state` を返して停止する。
2. `einja-epic-spec-create` は Markdown を **broker JSON に正規化**し、`question-broker.json` に登録（fingerprintで重複排除）、対象Issueを `blocked` にする。
3. Epic側が質問内容を統合し、ユーザーへAskUserQuestionで確認する。
4. 回答を broker JSON に追記、`appliesToIssueSlugs` に応じて該当Issueの `resume-state.json` の `answers[]` に反映。
5. 対象Issueを `resume` として再開する。resume 入力にも Markdown 形式の「前回の質問と回答」セクションを生成して渡し、サブエージェント側は Markdown 読取のみで完結する。
   - **未開始Issueへの回答伝播**: `appliesToIssueSlugs` に含まれる未開始Issueについても、Headless 初回実行時に `resume-state.answers[]` を読み込み、Markdown 形式の「共有回答コンテキスト」セクションとしてプロンプトに注入する（同一質問の再発を防ぐ）。
6. 再開時は `operationLog` と `generatedArtifacts` を参照し、未完了フェーズだけ実行する。
7. 同一Issueで質問ループが3回続いた（`attemptCounts.questionLoop >= 3`）場合はEpic全体を停止し、未解決事項をまとめて報告する。

## 新規/更新するSkill・エージェント

### `einja-epic-spec-create`（新規）

| 項目 | 値 |
|------|-----|
| name | `einja-epic-spec-create` |
| description | Epic（複数Issueを束ねる大規模機能）仕様書を作成し、Epic契約ファイルを検証してから各Issue仕様書をHeadless展開するSkill。「Epic」「Epic仕様」「プロダクト仕様」「複数Issue」「大規模タスク」で使用する。Do NOT use for: 単一Issueの仕様書作成（`einja-issue-spec-create`を使う） |
| 分類 | オーケストレーター / ユーザー向け |
| 配置先 | `.claude/skills/einja-epic-spec-create/SKILL.md` |
| 依存 | `einja-issue-spec-create` Headless + resume対応、`_einja-epic-contract-validator`, `einja-review-spec`, `einja-task-commit`, drawio MCP / drawio-guide, Pencil MCP |
| allowed-tools | Bash, Read, Write, Edit, MultiEdit, Grep, Glob, Agent, Skill, AskUserQuestion, `mcp__github__*`, `mcp__pencil__*`, `mcp__drawio__*`, `mcp__claude_ai_Asana__*` |

実行オプション: `--max-issues N` / `--issue-slugs a,b,c` / `--resume-from {issue-slug}` / `--stop-after-contract` / `--stop-after-epic-artifacts` / `--stop-after-issue-spec` をサポートし、長時間実行を分割可能にする。

### `epic-planner`（新規サブエージェント）

| 項目 | 値 |
|------|-----|
| 配置先 | `.claude/agents/einja/epic-specs/epic-planner.md` |
| 責務 | `epic-overview.md`, `epic-manifest.json`, 各Issue `scope.md` を生成 |
| 入力 | ユーザー指示、PRD、既存 `docs/specs/` 配下の関連仕様、Asana/Figma等外部リソース |
| 出力契約 | manifest schemaVersion 1.0 準拠、Issue縦切り独立性の根拠を overview に明記 |
| 質問 | サブエージェントなのでAskUserQuestionは使わず、`PENDING_QUESTIONS` で親へ返す |

### `_einja-epic-contract-validator`（新規インナーSkill）

| 項目 | 値 |
|------|-----|
| 配置先 | `.claude/skills/_einja-epic-contract-validator/SKILL.md` |
| 分類 | インナー配布Skill |
| 責務 | `epic-manifest.json` と `scope.md` の**構造検証**（決定論的） |

**構造検証項目（決定論）:**

- `schemaVersion` の互換性検証:
  - manifest と scope.md の `schemaVersion` 一致必須（不一致は FAILURE）
  - major 一致（例: `1.x` 系は互換、`2.x` は FAILURE）
  - minor 追加は warning 扱い（未知keyはエラーにせずログ出力）
  - v1系は v1.0 のみ。v1.1 以降は後方互換を保つこと
- 全ID（`epicId`/`features[].id`/`issues[].slug`/`acceptanceCriteria[].id`/`uiFrames[].id`/`transitions[].id`）の一意性
- 各Featureが1つ以上のIssueに割り当てられていること
- 各ACが**ちょうど1つ**のIssueに割り当てられていること（未割当/重複どちらも失敗）
- 各Issueが最低1つのACを持つこと
- Issue依存DAGが topological sort 可能（循環なし）
- `dependsOn` の参照先Issueが存在すること
- `scope.md` ファイルが `scopePath` に存在すること
- `scope.md` frontmatterの必須キーが揃い、manifestのIssue定義と一致すること
- **`uiFrameIds` / `transitionIds` は任意フィールド**。存在する場合のみ以下を検証:
  - `uiFrameIds` の参照先が `uiFrames` に存在すること
  - `transitionIds` の参照先が `transitions` に存在すること
  - `transitions[].from` / `transitions[].to` が `uiFrames` に存在すること

**LLMレビューへ委譲する項目（`einja-review-spec` で扱う）:**

- Issue縦切り独立性（デプロイ・テスト可能な単位か）の妥当性
- Feature/Story分割の粒度妥当性
- ACの検証可能性・網羅性

### `einja-issue-spec-create` 更新

追加する機能:

- Headless mode（`<<MODE: HEADLESS>>` マーカー認識、`isInteractive()` 相当単一ガードで分岐集約）
- resume mode（`operationLog` 参照で冪等再開）
- `scope.md` + `epic-manifest.json` 入力
- `github-issue-number` / `issue-base-branch` / `pr-base-branch` 外部指定
- Milestone / Epic Tracker Issueリンク付与
- 既存成果物を読み込んだ冪等な再開

**既存通常モードの挙動は変更しない。** スナップショット/回帰テストでこれを担保する。

### QA成果物名統一（`qa-test.md`） — **案A: `qa-tests/scenarios.md` のみ改名**

本Plan内で対応。**Story分割（`qa-tests/storyN.md`）は一切触らない**（`_einja-task-qa` のStory特定ロジック `AC番号先頭 → storyN.md` を保護するため）。統一対象は **`qa-tests/scenarios.md` → `qa-test.md` の改名のみ**。

| 対象ファイル | 変更内容 |
|------|---------|
| `.claude/agents/einja/issue-specs/qa-generator.md` | `qa-tests/scenarios.md` 参照を `qa-test.md` に更新（story分割記述は残す） |
| `.claude/agents/einja/issue-specs/tasks-generator.md` | 同上 |
| `.claude/skills/_einja-task-qa/SKILL.md` | `scenarios.md` 参照を `qa-test.md` 優先・無ければ `qa-tests/scenarios.md` フォールバック。**`storyN.md` 系は変更なし** |
| `.claude/skills/_einja-spec-context-loader/SKILL.md` | 同上 |
| `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md` | `qa-tests/scenarios.md` 参照を更新（存在する場合） |
| `.claude/skills/einja-task-exec/SKILL.md` | 同上 |
| `.claude/skills/einja-issue-exec/SKILL.md` | 同上 |
| `.claude/skills/einja-issue-team-exec/SKILL.md` | 同上 |
| `.claude/skills/_einja-task-qa/templates/`（存在する場合） | 同上 |
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | 同上 |
| `docs/einja/steering/development/playwright-guidelines.md` | 同上 |

**検索コマンド（ゼロ残確認）**: タスク完了時に `rg "qa-tests/scenarios\.md" .claude/ docs/einja/` を実行し、ヒット0件を確認（検索対象は `.claude/` と `docs/einja/` のみ、実生成物がある `docs/specs/` は対象外）。story分割は対象外のため `story\{N\}.md` 参照は残ってOK。

**フォールバック戦略**: 移行期間中は `qa-test.md` 優先、無ければ既存 `qa-tests/scenarios.md` を読込。新規生成は全て `qa-test.md`。フォールバック解除は本Plan完了後、別Planで既存spec群の移行完了確認後に実施。

### `docs/einja/steering/branch-strategy.md` 更新

「Epic配下での IssueBranchBase の解釈」セクションを追記:

- 通常時: `IssueBranchBase = main/develop`、以下3階層
- Epic配下: `IssueBranchBase = epic/{slug}`、以下3階層
- Epicブランチ自体は `main/develop` から作成し、最終的に `main/develop` へマージ

既存の issue-exec-protocol / einja-issue-exec 等は一切変更しない（IssueBranchBase の解釈が1箇所増えるだけ）。

## タスク概要

| # | タスク | 使用Skill/サブエージェント | 依存 |
|---|--------|----------------------|------|
| 0-1 | Planファイルを現在の作業環境で定められた保存先・命名規則に従って配置する | 直接実行 | - |
| 0-2 | worktree作成（`_einja-worktree-guide` 参照） | 直接実行 | 0-1 |
| 1-a | Epic manifest / scope / resume-state / operationLog / broker JSON の **JSON Schema 定義**（`schemaVersion: "1.0"`、enum値・必須キー明示、サンプル付き）。永続マーカー形式も同 schema に含める | general-purpose | 0-2 |
| 1-b | `docs/einja/steering/branch-strategy.md` 更新（Epic配下のIssueBranchBase解釈追記） | general-purpose | 0-2 |
| 2-a | `epic-planner` サブエージェント作成 | `einja-skill-creator` | 1-a |
| 2-b | `_einja-epic-contract-validator` 作成（構造検証項目・LLM委譲項目を明示） | `einja-skill-creator` | 1-a |
| 2-c | `screen-transitions.drawio` 生成手順を **`epic-planner.md` エージェント定義内の手順セクション** に直接記述（別ガイドは切り出さない） | general-purpose | 1-a |
| 2-d-QA | QA成果物名統一（案A: `qa-tests/scenarios.md` のみ改名）+ フォールバック実装 + `rg` ゼロ残確認 | general-purpose | 1-a |
| 3-1 | `einja-issue-spec-create` Headless入力契約整備（`<<MODE: HEADLESS>>` マーカー、単一ガード設計） | general-purpose | 1-a, 2-d-QA |
| 3-2 | resume-state.json スキーマ定義・読み書き・冪等再開ロジック（operationLog活用） | general-purpose | 3-1 |
| 3-3 | PENDING_QUESTIONS返却プロトコル（questionId/fingerprint/sourceSkill等） | general-purpose | 3-1 |
| 3-4 | github-issue-number / issue-base-branch / pr-base-branch / milestone / tracker-issue 外部指定対応 | general-purpose | 3-1 |
| 3-5 | 通常モード非破壊検証（スナップショット/回帰テスト） | general-purpose | 3-1〜3-4 |
| 4 | `einja-epic-spec-create` 作成（--max-issues等の分割実行オプション含む） | `einja-skill-creator` | 2-a, 2-b, 2-c, 3-2, 3-3, 3-4 |
| 5-a | CLAUDE.md キーワードトリガー表に以下キーワードを追加: `Epic仕様` / `epic-spec-create` / `プロダクト仕様` / `複数Issue仕様` / `大規模Issue`（テンプレートリポジトリ専用セクション）。併せて Skill description（L390）と一貫性確認 | 直接編集 | 4 |
| 5-b | 配布設定（copy-presets / template-whitelist）確認・更新 | 直接編集 | 4 |
| 6-a | Skill品質レビュー（`einja-skill-plan-guide` Workflow B） | `einja-skill-plan-guide` | 5-a, 5-b |
| 6-b | コード差分レビュー | `einja-review-code` | 5-a, 5-b |
| 7-a | Validator故意破損サンプル検証（AC未割当/重複/循環/参照不整合/frontmatter欠落） | 手動実行 | 6-a, 6-b |
| 7-b | 小-中規模Epic動作確認（2 Issue / 5 Issue dry-run） | 手動実行 / Playwright・MCP確認 | 6-a, 6-b |
| 7-c | 通常 `einja-issue-spec-create` 回帰確認 | 手動実行 | 6-a, 6-b |

## 並列実行計画

```
Phase 0:
  └─ 0-1 → 0-2

Phase 1（並列）:
  ├─ 1-a  Epic manifest/scope JSON Schema
  └─ 1-b  branch-strategy.md 更新

Phase 2（並列）:
  ├─ 2-a  epic-planner 作成
  ├─ 2-b  _einja-epic-contract-validator 作成
  ├─ 2-c  screen-transitions.drawio 手順
  └─ 2-d-QA  QA成果物名統一 + フォールバック

Phase 3（順次・Issue Spec Headless化）:
  3-1 → 3-2 → 3-3 → 3-4 → 3-5
  （3-2/3-3/3-4は3-1完了後に並列化可）

Phase 4:
  └─ 4  einja-epic-spec-create 作成

Phase 5（並列）:
  ├─ 5-a  CLAUDE.md / トリガー更新
  └─ 5-b  配布設定

Phase 6（並列）:
  ├─ 6-a  Skill品質レビュー
  └─ 6-b  コード差分レビュー

Phase 7（並列）:
  ├─ 7-a  Validator故意破損検証
  ├─ 7-b  小-中規模Epic dry-run
  └─ 7-c  通常モード回帰確認
```

## リスク・対策

| リスク | 対策 |
|--------|------|
| Headless modeで不明点が発生し自動展開が止まる | 質問ブローカーで一元集約、`resume-state.json` に保存して対象Issueだけ再開 |
| 自然文のscopeから抽出がぶれる | YAML frontmatterと `epic-manifest.json` を契約、`_einja-epic-contract-validator` で構造検証 |
| EpicとIssueのAC整合性が崩れる | ACはmanifest上でownerを一意、重複/未割当をvalidatorでFAILURE |
| drawio遷移とui-designの割当がずれる | `uiFrameIds` / `transitionIds` をmanifestで管理（任意フィールドだが存在時は整合検証） |
| 10 Issue展開が長時間化する | v1は順次実行。`--max-issues` / `--issue-slugs` / `--resume-from` で分割実行対応 |
| 既存IssueSpec通常モードが壊れる | `<<MODE: HEADLESS>>` 明示指定時のみ有効、タスク3-5の回帰テスト必須、単一ガード関数で分岐集約 |
| GitHub Issue / Milestone / PR の重複作成 | Epic側が責務を一元化、`epicId`+`issueSlug` で検索→無ければ作成、resume-stateの `operationLog` を参照 |
| QA名統一で既存spec破壊 | フォールバック期間: `qa-test.md` 優先・無ければ `qa-tests/` 読込 |
| Headless時の PENDING_QUESTIONS が review-spec / validator からも発生し、source識別が必要 | 質問ブローカーに `sourceSkill` / `sourceIssueSlug` / `fingerprint` を持たせ識別・重複排除 |
| 質問プロトコル互換性の破壊 | サブエージェント側は既存 `_einja-subagent-question-protocol` の Markdown 形式を維持、Epic側で broker JSON に正規化。`_einja-subagent-question-protocol` 自体は変更しない |
| GitHub リソースがタイトルリネームで検索不能になる | 本文HTMLコメント永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=... -->` でGitHub Search API `in:body` 検索 |
| Issue Spec PR の作成責務二重化 | **PR は Headless IssueSpec 側が create-or-update で一元担当**。Epic側は Epic PR のみ。Epic PR は Draft で先行作成、子 Issue Spec PR のチェックリストを本文に記載、子PR全マージ後に Ready for review に遷移 |
| resume-stateがworktreeで失われる | Epic親worktreeに `docs/specs/epics/{slug}/issues/{slug}/resume-state.json` として配置、git管理対象 |

## 検証・動作確認方法

1. `pnpm prepush` が通ること。
2. **回帰**: 通常の `einja-issue-spec-create`（Headless指定なし）が従来通り動作すること（タスク3-5・タスク7-c）。
3. **Headless基本動作**: 2 Issue規模のEpic展開が完了すること。
4. **Headless分割実行**: `--max-issues 1` で1 Issueずつ進行、`--resume-from` で続きから再開できること。
5. **Headless質問ループ**: 意図的に不明点を発生させ、Epic側が質問ブローカーに登録、ユーザー回答保存、IssueSpec resumeを実行できること。
6. **冪等性**: Milestone / Tracker Issue / Issue Spec PR が resume 時に重複作成されないこと（`epicId`+`issueSlug` 検索＋`operationLog` で再利用）。
7. **Validator 故意破損サンプル検証**: 以下をFAILUREで検出できること。
   - AC未割当（owner なし）
   - AC重複割当（同一ACが複数Issue所有）
   - 循環依存（Issue A→B→A）
   - `dependsOn` 参照先欠落
   - `uiFrameIds` 参照先欠落（UI要件ありEpicで存在する場合）
   - `transitionIds` 参照先欠落（同上）
   - `scope.md` frontmatter欠落
   - `schemaVersion` 不整合
8. **UIなしEpic**: `hasUI: false` の2 Issue Epic で、`uiFrames` / `transitions` 未定義でも validator が PASS すること。
9. **ブランチ/PR**: 各Issue Spec PR が `epic/{slug}` baseで作成、Epic PR が IssueBranchBase base で作成されること。
10. **drawio成果物**: UI要件ありEpicで `screen-transitions.drawio` が生成され、遷移ごとに `TR-*` IDと担当Issueが紐づいていること。
11. **QA統一（案A）**: 新規生成物は全て `qa-test.md`。既存spec互換で `qa-tests/scenarios.md` も読める（フォールバック）こと。`rg "qa-tests/scenarios\.md"` ヒット0件（story分割は対象外）。
12. **5 Issue dry-run**: 実トークン消費を計測し、現実的な実行時間内で完了すること（分割実行を前提としても）。
13. **PR 責務一元化**: Issue Spec PR が Headless IssueSpec 側で create-or-update されること、Epic 側からは PR 作成されないこと、PR 本文に永続マーカー `kind=issue-spec-pr` が埋め込まれていること。
14. **永続マーカー検索**: タイトルリネーム後も GitHub Search API `"einja:epic-id={epicId}" in:body` で既存 Issue / PR / Milestone が検索・再利用できること。
15. **質問プロトコル互換**: サブエージェントが返す Markdown `## PENDING_QUESTIONS` が、Epic 側で broker JSON に正規化されて `question-broker.json` に記録されること。既存 `_einja-subagent-question-protocol` は未変更であること。

## 完了条件

- `einja-epic-spec-create` のPlanが、Epic契約ファイル、Headless + resume、drawio成果物、ブランチ/PRモデル（既存 branch-strategy.md 拡張）、Validator（構造/LLM分離）、QA名統一（フォールバック付き）、GitHub Issue責務一元化、冪等性、質問ブローカー、分割実行オプション、通常モード回帰テストを含む決定済み仕様になっていること。
- 実装者が追加判断なしでSkill作成に着手できること。
- Epic実行フェーズ（`einja-epic-exec` 相当）は本Planスコープ外。manifestスキーマは将来の消費を前提に設計されていること。
