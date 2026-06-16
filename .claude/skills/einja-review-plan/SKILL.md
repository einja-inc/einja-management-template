---
name: einja-review-plan
description: "Planモードで作成した計画のレビューを実施するSkill。レビューサブエージェント（general-purpose）とcodex-agentを並行で呼び出し、計画の要件カバレッジ・タスク分割・リスク網羅性・実現性を検証する。「Planレビュー」「plan review」「計画レビュー」等で呼び出す。Do NOT use for: コード変更のレビュー（→ einja-review-code）、Skill実装のレビュー（→ einja-skill-plan-guide ワークフローB）"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Agent
  - ToolSearch
---

# einja-review-plan Skill: 計画の品質レビュー

あなたはシニアプロジェクトマネージャー兼プランレビュアーです。Planモードで作成された計画の品質を多角的に検証し、構造化された判定結果を返却します。

## スキップ条件（呼び出し元で判断）

以下に該当する場合のみ、このSkillを呼び出す必要はありません:
- **ユーザー明示スキップ**: ユーザーが「レビュー不要」「スキップ」等と明示的に指示した場合のみ。変更規模に関わらず、ユーザー指示がなければ必ずレビューを実行すること

## 実行フロー

### Step 1: planファイルの読み込み

- Planモードのplanファイルを Read で取得
- ユーザーの元要求（会話コンテキストから把握。Skillの呼び出し元が渡す）を確認

### Step 1.5: Codex MCP利用可否の事前確認

ToolSearchで `mcp__codex__codex` が利用可能か確認する。この結果に基づいてStep 2でレビュアー2を呼び出すか判断する。

### Step 2: レビューサブエージェントの並行呼び出し

Step 1で取得したplanファイル内容をレビュアーのプロンプトに埋め込み、**1つのメッセージで複数のAgent tool呼び出しを同時に行う**ことで並行実行する。Codex MCP利用不可の場合はレビュアー1のみ起動する。

#### レビュアー1: Planレビューサブエージェント【必須】

Agent tool（general-purpose）で無名サブエージェントを起動し、以下のプロンプトを渡す:

```
あなたはシニアプロジェクトマネージャーです。以下のPlan（計画書）を分析し、レビュー結果を報告してください。

## レビュー観点

### A. 要件カバレッジ
- ユーザーの元要求がすべて計画に反映されているか
- 要件の抜け漏れ、暗黙の前提条件の見落とし

### B. タスク分割・依存関係
- タスクの粒度は適切か（大きすぎ/小さすぎないか）
- 並列化戦略に矛盾はないか
- タスク間の依存関係は正しく整理されているか
- **external-deps DAG**: サービス・API・DB・認証・外部連携・インフラを伴う場合、「リソースを作れる（materialized / configured）」タスクと「healthy になる（外部依存込みで稼働する）」タスクが別ノードに分かれているか。healthy 到達の前提となる external-deps（DB migrate / secret / DNS / OAuth 等）が依存エッジ（blockedBy）として張られているか（例: 「API healthy ← DB migrated + connection string injected」）。「作れる」と「healthy」を 1 タスクに混ぜると順序事故・完了誤認を招く
- **最終受け入れゲート**: 最終 Phase の受け入れに「動く実物がユーザーと同等の操作で価値を端から端まで届ける（`E2E-ready`）」確認が計画されているか。`created` / `configured` 止まり（"できたつもり"）で完了とする計画になっていないか。ユーザー導線が無い変更は `healthy` 疎通確認＋ N/A 理由、マージ / デプロイ後にしか確認できない場合は申し送り（readiness matrix `deferred-to`）と人間 QA 手順（`qa-test.md` の種別 `人手E2E`）が計画に含まれているか（詳細は `docs/einja/steering/acceptance-criteria-and-qa-guide.md`「最終受け入れの readiness 下限」節）

### C. リスク・見落とし
- 技術的リスク、影響範囲の見落とし
- エッジケースの考慮漏れ
- 既存コードへの副作用

### D. 実現性・スコープ
- アプローチは現実的か
- 過剰な変更（オーバーエンジニアリング）がないか
- 不足な変更（必要な対応の漏れ）がないか

## 出力形式

### 判定: [PASS / MINOR / MAJOR]

#### 指摘事項（ある場合）
- **[観点] セクション名**: 指摘内容
  - 修正案: 具体的な修正方法

#### 良い点（任意）
- 良かった点があれば記載

## 重要
不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照してPENDING_QUESTIONS形式で質問を返却し、作業を停止すること。

## ユーザーの元要求:
{呼び出し元から渡されたユーザー要求}

## 対象Plan:
{Step 1で取得したplanファイル内容}
```

#### レビュアー2: codex-agent【Step 1.5でCodex MCP有効と判定された場合のみ】

Agent toolで `codex-agent`（subagent_type: codex-agent）を起動し、レビューモードでplanの技術的妥当性を検証する。Step 1で取得したplanファイル内容をプロンプトに含める。

codex-agentへの依頼内容:

```
以下のPlan（実装計画書）を技術的観点からレビューしてください（レビューモード）。
技術的妥当性、アプローチの現実性、潜在的な問題を検出し、判定（PASS/MINOR/MAJOR）と指摘事項を報告してください。

## 重要
不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照してPENDING_QUESTIONS形式で質問を返却し、作業を停止すること。

対象Plan:
{planファイル内容}
```

### Step 3: レビュー結果の統合

両方のレビュー結果を統合し、最終判定を決定する。

#### 統合ルール

| レビュアー1 | レビュアー2 | 最終判定 |
|------------|------------|---------|
| PASS | PASS / スキップ | **PASS** |
| PASS | MINOR | **MINOR** |
| MINOR | PASS / スキップ | **MINOR** |
| MINOR | MINOR | **MINOR** |
| MAJOR | any | **MAJOR** |
| any | MAJOR | **MAJOR** |

#### PENDING_QUESTIONSの処理

レビュアーからPENDING_QUESTIONSが返却された場合、そのまま親エージェントに返却する。

### Step 4: 結果返却

以下の形式で返却する:

```markdown
## Planレビュー結果

### 最終判定: [PASS / MINOR / MAJOR]

### レビュアー1（Planレビュー）: [判定]
{レビュー結果の全文}

### レビュアー2（codex-agent）: [判定 / スキップ]
{レビュー結果の全文 or "Codex MCP利用不可のためスキップ"}

### 統合サマリー
- 指摘数: N件（MAJOR: X, MINOR: Y）
- 対応方針: {PASS→ExitPlanModeへ / MINOR→指摘をplanに反映後ExitPlanMode / MAJOR→親エージェントがplan修正→再レビュー}
```

#### MAJOR指摘時の挙動（呼び出し元の責務）

- MAJOR指摘あり → 親エージェントがplanを修正 → 再レビュー（最大2回）
- 2回修正してもMAJOR残存 → レビュー結果を付記してExitPlanMode（ユーザー判断に委ねる）
- MINOR/PASSのみ → MINOR指摘があればplanに反映 → ExitPlanMode

## 判定基準

| 判定 | 基準 | 後続アクション |
|------|------|---------------|
| **PASS** | 指摘なし | ExitPlanModeに進む |
| **MINOR** | 軽微な指摘（表現の曖昧さ、補足追加で改善可能な箇所等） | planに反映後、再レビュー不要でExitPlanModeへ |
| **MAJOR** | 計画レベルの問題（要件カバレッジ不足、タスク分割の重大な矛盾、重大なリスク見落とし） | 親エージェントがplan修正後、再レビュー |
