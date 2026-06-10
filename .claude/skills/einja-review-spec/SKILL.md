---
name: einja-review-spec
description: "仕様書作成フェーズの成果物を多観点・並列でレビューするSkill。requirements.md、design.md、ui-design-url.md（Figma）、qa-test.md、GitHub Issueのタスク一覧を対象に、観点別レビュアーとcodex-agentを並列起動して統合判定する。einja-issue-spec-create から各Phase完了時に呼び出す。Do NOT use for: コードdiffレビュー（→ einja-review-code）、Planレビュー（→ einja-review-plan）"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Agent
  - ToolSearch
  - mcp__claude_ai_Figma__get_screenshot
  - mcp__claude_ai_Figma__get_design_context
---

# einja-review-spec Skill: 仕様書成果物の多観点並列レビュー

あなたは仕様書レビューの専門家です。仕様書作成フェーズで生成された成果物を、**観点別の並列レビュー**で多角的に検証し、構造化された判定結果を返却します。

## 想定呼び出し元

- `einja-issue-spec-create` が各Phase完了時に呼び出す
- ユーザー確認の**前**に必ず実行する

## スキップ条件

以下に該当する場合のみ、このSkillを呼び出す必要はありません:
- **ユーザー明示スキップ**: ユーザーが「レビュー不要」「スキップ」等と明示した場合のみ

## 呼び出し元が渡すべき情報

呼び出し時に、少なくとも以下を前置コンテキストとして渡すこと:

- `review_scope`: `requirements` / `phase2_bundle` / `tasks`
- ユーザーの元要求
- 対象成果物のパス
- 未解決事項や残存リスク

`phase2_bundle` の場合は追加で以下も渡す:
- `ui-design-url.md` のパス（存在する場合）
- `mcp__claude_ai_Figma__get_screenshot` で取得した画面プレビューの要約（fileKey/nodeIdはui-design-url.mdのYAMLフロントマターから取得）

## 実行フロー

### Step 1: 成果物の読み込み

`review_scope` に応じて対象成果物を読み込む。

- `requirements`
  - `requirements.md` または `requirements/README.md` と各分割ファイル
- `phase2_bundle`
  - `requirements.md`
  - `design.md` または `design/README.md` と各分割ファイル
  - `qa-test.md`
  - `ui-design-url.md` がある場合は `mcp__claude_ai_Figma__get_screenshot` で画面確認（YAMLフロントマターのfileKey/nodeIdを使用）
- `tasks`
  - `requirements.md`
  - `design.md`
  - `qa-test.md`
  - GitHub Issueに記述予定、または記述済みのタスク一覧本文

### Step 1.5: Codex MCP利用可否の事前確認

ToolSearchで `mcp__codex__codex` が利用可能か確認する。この結果に基づいてStep 3でCodexレビュアーを呼び出すか判断する。

### Step 2: 観点ピック

`review_scope` ごとに、以下の観点から必要なレビュアーをピックする。判断が曖昧な場合はピックする。

#### `requirements`

| ID | 観点名 | 説明 |
|----|--------|------|
| A | 要件網羅性・スコープ | ユーザー要求、対象外、前提条件、残存リスクの明確さ |
| B | ATDD・受け入れ基準品質 | AC一覧、AC詳細、正常系/異常系、検証可能性、UXカテゴリのACにインタラクション4状態・エラーメッセージ導線・多重送信防止・フォーカス管理が含まれているか |
| C | 実装可能性・既存整合 | 既存アーキテクチャや実装パターンとの整合、非現実的要件の有無 |
| D | QAトレーサビリティ | 後続の設計・QA・タスク分解に必要な情報が揃っているか |
| E | Readiness & 依存境界 | 「横断必須ゲート」§G1（readiness level 混在）+ §G2（external-deps 明示）。infra/サービス/外部連携を含む場合は必ずピック |
| F | セキュリティ・脅威モデリング | 「横断必須ゲート」§G3（threat-modeling / control-plane / 危険 sink）。外部入力・認証・権限・特権操作・外部連携を含む場合は必ずピック |
| G | SSOT 整合 | 「横断必須ゲート」§G4（同一設定値の重複・矛盾）。設定値・閾値・接続先が複数箇所に登場する場合は必ずピック |

#### `phase2_bundle`

| ID | 観点名 | 説明 |
|----|--------|------|
| A | 設計妥当性 | アーキテクチャ、API、DB、要件トレースの妥当性 |
| B | UI/UX・画面整合 | `ui-design-url.md`（Figma）と requirements/design の整合、一貫性、主要導線、インタラクション4状態設計（disabled/error/empty/loading）の有無、エラーメッセージの位置と再試行導線の明示、多重送信防止とローディング制御、基本フォーカス管理 |
| C | QA網羅性・実行可能性 | AC対応、前提条件、手順の明確さ、打鍵確認可能性 |
| D | 横断整合性 | design / ui / qa の用語、API名、画面名、外部API前提の一致 |
| E | Readiness & external-deps DAG | 「横断必須ゲート」§G1 + §G2。design に readiness matrix があり、healthy 到達の external-deps（DB migrate / secret / DNS / OAuth 等）が依存関係として整理されているか。infra/サービス/外部連携を含む場合は必ずピック |
| F | セキュリティ・脅威モデリング | 「横断必須ゲート」§G3。design に Threat Model セクションがあり、authz / secrets 露出 / injection / SSRF / admin・control-plane 露出 / token scope・衝突 / privilege scope / runtime 入力→危険 sink が識別・対策されているか。外部入力・認証・権限・特権・外部連携を含む場合は必ずピック |
| G | SSOT 整合 | 「横断必須ゲート」§G4。requirements / design / ui / qa にまたがる同一設定値が矛盾しておらず、正本ファイルが定義されているか |

#### `tasks`

| ID | 観点名 | 説明 |
|----|--------|------|
| A | ATDD粒度 | Phase/タスクグループ/タスクが縦切りで、AC検証可能か |
| B | 依存関係・並列性・UX網羅性 | 並列実行可能性、依存関係記法、Phase分割の妥当性。フロントエンド変更を含むタスクグループにUXカテゴリAC（インタラクション4状態・エラーメッセージ導線・多重送信防止・フォーカス管理）が割り当てられているか |
| C | トレーサビリティ | requirements / design / qa との対応関係の明確さ |
| D | 実行準備性 | サブエージェント割当、完了条件、シナリオテスト指定の妥当性 |
| E | 「作れる」≠「healthy」分離 | 「横断必須ゲート」§G2。サービス・外部連携を含むタスクで「リソースを作る」タスクと「healthy にする」タスクが別ノードに分かれ、external-deps が依存関係（blockedBy）として張られているか |
| F | セキュリティ観点の漏れ | 「横断必須ゲート」§G3。タスク完了条件・実装指示に、外部入力→危険 sink（path-traversal 等）の対策や authz / secrets / privilege の考慮が欠けていないか。認証・権限・特権操作・外部連携を含むタスクグループで必ずピック |
| G | SSOT 整合 | 「横断必須ゲート」§G4。タスク完了条件・設定値が requirements / design と矛盾していないか |

### 横断必須ゲート（全 review_scope 共通: 観点 E/F/G の詳細）

以下 4 ゲートは、対象成果物が該当性質を持つ場合に必ず適用する。各ゲートに対応する観点（E/F/G）をピックし、レビュアーのプロンプトに該当ゲートのチェックリストを埋め込む。**Web アプリ開発汎用**（frontend / backend / API / DB / auth / secret / 外部連携 / インフラ）の観点で確認する。

#### §G1: readiness level の混在検出（→ 観点 E）

- [ ] 1 つの AC / 完了条件が `created / configured / external-deps-ready / healthy / E2E-ready`（定義は `docs/einja/steering/acceptance-criteria-and-qa-guide.md`「完了レベル」節）を混在させていないか
- [ ] `healthy` 以上を完了条件にする AC に、前提 external-deps が明記されているか
- [ ] infra / サービス / 外部連携を含む場合、readiness matrix（`docs/einja/templates/readiness-matrix.md.template`）で各コンポーネントの到達レベルと `blocked-by` / `deferred-to` が俯瞰できるか

#### §G2: external-deps の明示（→ 観点 E）

- [ ] 「箱を作れる（materialized / configured）」と「healthy になる」が区別され、healthy 到達に必要な外部依存が列挙されているか
- [ ] 代表的な依存が明示されているか（例: 「API healthy ← DB migrated + connection string injected」「auth ready ← OAuth secret + redirect URI 登録」「webhook ready ← DNS / route 公開 + 署名 secret + 送信元設定」）
- [ ] その external-deps が後続のタスク DAG で依存エッジ（blockedBy）として張れる粒度で書かれているか

#### §G3: threat-modeling gate（→ 観点 F）

設計段階で脅威を先に捕まえるためのゲート。実装中の発覚・コードレビューでの見落としを防ぐ。runtime 入力 → 危険 sink のデータフローと、Web 汎用の脅威観点を確認する。

- [ ] **runtime 入力 → 危険 sink** のデータフローが識別されているか（sink 例: path 結合 / shell 実行 / SQL / URL fetch / file delete・`rm -rf` / `mv` / `cp` / symlink 作成 / untrusted state(JSON / lock / cache / 生成 manifest) の読み込み）。特に **path-traversal**（外部入力をファイルパスに結合）への対策（許可リスト・正規化・basedir 制約）があるか
- [ ] **authz**: 認可境界（誰がどのリソースを操作できるか）が明示され、IDOR / 権限昇格が塞がれているか
- [ ] **secrets 露出**: secret を log / レスポンス / エラーメッセージ / 生成物に出さない方針か。平文保存していないか
- [ ] **injection**: XSS / SQLi / コマンドインジェクション対策（出力エスケープ・パラメタライズドクエリ）があるか
- [ ] **SSRF**: 外部入力由来の URL を fetch する箇所で宛先制限があるか
- [ ] **admin / control-plane 露出**: 管理ダッシュボード / 管理 API / SSH / CI token / root token 等が不要に公開されていないか
- [ ] **token 衝突**: 共有 token・prod/dev key 再利用による衝突が無いか
- [ ] **privilege scope**: 特権 token の常用を避け、最小権限か。bootstrap / 一時特権 token の retire 条件が定義されているか

#### §G4: SSOT 矛盾の検出（→ 観点 G）

- [ ] 同一設定値（cron 間隔 / port / env key / URL / token scope / retention / replica 数 / タイムアウト / 上限値 等）が複数ファイル・複数箇所で**矛盾**していないか（`grep` で重複出現を洗い出して突合する）
- [ ] 重複が避けられない場合、**正本ファイル（SSOT）**と**負け側（参照のみ）**が明示され、負け側に「正本: <path>」の注記があるか
- [ ] requirements / design / ui / qa 間で用語・API 名・画面名・外部 API 前提が一致しているか

### Step 3: 観点別並列レビューの実行

ピックした観点ごとにレビュアー（Agent tool, general-purpose）を**1つのメッセージで複数同時に**起動する。Codex MCP有効時は Codexレビュアー（Agent tool, `codex-agent`）も同時に起動する。

#### 各観点レビュアーのプロンプトテンプレート

```
あなたはシニア仕様書レビュアーです。以下の成果物を【{観点名}】の観点でレビューしてください。

## レビュー対象
- review_scope: {review_scope}
- 対象パス: {対象成果物パス一覧}

## レビュー観点: {観点ID}. {観点名}
{観点の説明}

## 参照すべきドキュメント
- `docs/einja/steering/development-workflow.md`
- `docs/einja/steering/task-management.md`
- `docs/einja/steering/development/review-guidelines.md`
- `docs/einja/steering/acceptance-criteria-and-qa-guide.md`（「完了レベル（readiness level）」節を含む）
- `docs/einja/steering/development/testing-strategy.md`
- `docs/einja/templates/readiness-matrix.md.template`（観点 E をピックした場合）
- `docs/einja/templates/design.md.template`「Threat Model & Security Considerations」節（観点 F をピックした場合）

## 横断必須ゲート（観点 E/F/G をピックした場合のみ）
{ピックした観点の review_scope に応じて以下を埋め込む:
  - requirements 観点 E → §G1 + §G2
  - phase2_bundle 観点 E → §G1 + §G2
  - tasks 観点 E → §G2 のみ
  - 観点 F → §G3
  - 観点 G → §G4
}

## ユーザーの元要求
{呼び出し元から渡されたユーザー要求}

## 未解決事項・残存リスク
{呼び出し元から渡された残存リスク}

## 対象成果物
{Step 1で読み込んだ成果物の内容または要約}

## 出力形式

### 判定: [PASS / MINOR / MAJOR]

#### 指摘事項（ある場合）
- **ファイル:見出し/行番号**: 指摘内容
  - 修正案: 具体的な修正方法

#### 良い点（任意）
- 良かった点があれば記載

## 重要
不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照してPENDING_QUESTIONS形式で質問を返却し、作業を停止すること。
```

#### Codexレビュアー【Step 1.5でCodex MCP有効と判定された場合のみ】

Agent toolで `codex-agent` を起動し、**包括的・批判的な目線**での独立レビューを依頼する:

```
以下の仕様書成果物を包括的・批判的な目線でレビューしてください。
各観点レビュアーが見落とす可能性のある横断的な問題
（設計の一貫性、用語の統一、抜け漏れ、実行可能性）に注目してください。

判定（PASS/MINOR/MAJOR）と指摘事項を報告してください。

review_scope:
{review_scope}

対象成果物:
{対象成果物の要約または全文}
```

### Step 4: レビュー結果の統合

全レビュー結果を統合し、最終判定を決定する。

#### 統合ルール

- 全レビュアーの判定のうち**最も厳しい判定**を最終判定とする
- MAJOR > MINOR > PASS の順
- いずれかのレビュアーがMAJOR → 最終MAJOR
- MAJORなしでいずれかがMINOR → 最終MINOR
- 全員PASS → 最終PASS

#### PENDING_QUESTIONSの処理

レビュアーからPENDING_QUESTIONSが返却された場合、そのまま親エージェントに返却する。

### Step 5: 結果返却

以下の形式で返却する:

```markdown
## Specレビュー結果

### review_scope: {review_scope}
### 最終判定: [PASS / MINOR / MAJOR]

### ピックされた観点
{ピックされた観点ID・名前のリスト}

### 各観点レビュー結果
#### 観点{ID}（{観点名}）: [判定]
{レビュー結果の全文}

### Codexレビュー: [判定 / スキップ]
{レビュー結果の全文 or "Codex MCP利用不可のためスキップ"}

### 統合サマリー
- 指摘数: N件（MAJOR: X, MINOR: Y）
- 対応方針: {PASS→ユーザー確認へ / MINOR→修正反映後ユーザー確認へ / MAJOR→修正して再レビュー}
```

## 呼び出し元の責務

- `MAJOR` の場合は成果物を修正し、再レビューを実施する（最大2回）
- `MINOR` は可能な限り反映してからユーザー確認に進む
- `PASS / MINOR` になってからユーザー承認を取る
