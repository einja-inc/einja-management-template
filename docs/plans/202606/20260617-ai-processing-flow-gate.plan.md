# AI処理フロー図の条件付き必須化（Issue-Spec-create 設計工程）

## Context

`einja-issue-spec-create` の設計（design）工程では、`design-generator` エージェントが「条件付き必須図」テーブル（UI変更→C4 Component図、DB変更→物理ERD、状態を持つ機能→状態遷移図、外部連携→C4 Container、複雑ドメイン→ERD）に基づいて図を必須化している。

条件分岐そのものは `System Flows` の `sequenceDiagram`（alt/opt/loop/par、常時必須）と `State Transitions` でカバーされる。しかし **「AI処理（LLM呼び出し / 推論 / 分類 / 生成 / RAG / エージェント等の非決定的処理）」が独立した必須図トリガーになっていない**。そのため、AI特有の分岐（出力検証、低信頼/失敗/タイムアウト時のリトライ・フォールバック・デフォルト処理、非決定性への対応）が図示される保証がなく、担当アーキテクトの裁量任せになっている。

本変更は、既存の threat-modeling / readiness / SSOT ゲートと**完全に同一の構造**で「AI処理フロー」ゲートを追加し、設計工程での生成と einja-review-spec でのレビュー検証の両方で担保する。

- ユーザー確定事項①: 適用範囲 = **design 3点セット**（design-generator.md / design.md.template / einja-review-spec）。requirements 側は対象外
- ユーザー確定事項②: 必須図の内容 = **シーケンス図（alt/optで低信頼・失敗・タイムアウト分岐）を必須とし、信頼度閾値などの判定ロジックが複雑な場合は flowchart を併用**
- **`design-simple.md.template` は対象外**: 旧来の簡易テンプレートで `design-generator` の自動生成フローからは参照されないため（AI処理機能の設計書がここに生成される経路は無い）
- **トリガー定義の正本（SSOT）**: AI処理トリガーの定義文（「LLM/推論/分類/生成/要約/RAG/埋め込み検索/エージェント等、出力が非決定的な処理」）の正本は **design-generator.md の条件付き必須図テーブル**とする。template / SKILL は同義の短縮表現で参照し、文言は grep で一致を突合する（§G4 SSOT の自己整合を保つ）

## 現状

| ファイル | 現状 |
|---------|------|
| `.claude/agents/einja/issue-specs/design-generator.md` | 「条件付き必須図」テーブル（333-339行）に5条件。「5つの新規図の作成指示」（341行〜）に図1-図5。「最終確認」（708-712行）に条件付き必須図チェック。最低セクション構成（497-519行）。AI処理の行・図は無し |
| `docs/einja/templates/design.md.template` | 冒頭コメント（5-6行）に条件付き必須化ガイド。`System Flows`（90行）に sequence。条件付きセクション（Threat Model / Readiness / SSOT）あり。AI処理セクションは無し |
| `.claude/skills/einja-review-spec/SKILL.md` | `phase2_bundle` 観点テーブル（82-90行）はA-G。「横断必須ゲート」（104行〜）は §G1-§G4 の**4ゲート**。プロンプトテンプレのゲートマッピング（165-170行） |

3ファイルとも source-of-truth であり、ビルド時に自動で `presets/default/` 配下へコピーされる（`.claude/agents/`、`.claude/skills/einja-*`、`docs/einja/`）。**コピー先は直接編集しない**。

## 変更内容（推奨アプローチ）

新ゲートを **§G5「AI processing flow gate」**、新図を **図6「AI処理フロー」**、新観点を `phase2_bundle` の **観点 H** として、既存パターンに揃えて追加する。

### ゲートの定義（共通）

- **トリガー条件**: AI処理あり（LLM呼び出し / 推論 / 分類 / 生成 / 要約 / RAG / 埋め込み検索 / エージェント等、出力が非決定的な処理を含む場合）
- **必須図**: `System Flows` 内に AI処理のシーケンス図（`sequenceDiagram` + alt/opt）。信頼度閾値分岐・再生成ループ等の判定ロジックが複雑な場合は `flowchart TD` を併用
- **必須要素（チェックリスト）**:
  - 入力（プロンプト / コンテキスト）の構築が明示されているか
  - AIサービス呼び出し（外部連携の場合は §G3 / C4 Container の External Systems とも整合）
  - 出力の検証・パース（スキーマ検証 / 型変換失敗時の扱い）があるか
  - 非決定性への対応（リトライ / フォールバック / デフォルト値 / 人手エスカレーション）が分岐として描かれているか
  - 失敗 / タイムアウト / レート制限 / トークン上限超過時の挙動が定義されているか
  - （該当時）信頼度・スコア閾値による分岐が `flowchart` で表現されているか

### ファイル1: `design-generator.md`

1. 「条件付き必須図」テーブル（339行付近、複雑ドメイン行の前後）に1行追加:
   `| AI処理あり（LLM/推論/分類/生成/RAG/エージェント等） | System Flows に AI処理シーケンス図（出力検証・低信頼/失敗/タイムアウト時のリトライ/フォールバック/デフォルト分岐）。判定ロジックが複雑な場合は flowchart 併用 | 外部連携を伴う場合は C4 Container の External Systems とも整合 |`
2. 「## 5つの新規図の作成指示」見出しを「## 6つの新規図の作成指示」に変更し、図5の後に **「### 図6: AI処理フロー（System Flows 強化、AI処理がある場合は必須）」** を追加。sequenceDiagram（alt: 低信頼→リトライ/フォールバック、失敗→デフォルト/エスカレーション）の例と、複雑な判定ロジック用の `flowchart TD` 例（信頼度閾値分岐・再生成ループ）を併記
3. 「最低セクション構成」の System Flows 説明（507行）と注記（519行）に「AI処理がある場合は AI処理フローを含める」を追記
4. 「最終確認」チェックリスト（704-712行）に1項目追加:
   `- AI処理あり → System Flows に AI処理フロー（出力検証・失敗/低信頼分岐）があるか`
5. 「mermaid記法方針」セクション（321-327行、現状はC4記法禁止のみ）に「`flowchart TD` は判定ロジック（信頼度閾値分岐・再生成ループ等）の表現に使用可」を1行追記し、図種の許可方針を記法方針節に集約する既存構造に揃える

### ファイル2: `design.md.template`

1. 冒頭の条件付き必須化コメント（6行付近）に追記:
   `<!-- 条件付き必須化（追加）: AI処理（LLM/推論/分類/生成/RAG）→ System Flows に AI処理フロー（出力検証・リトライ/フォールバック/デフォルト分岐）。判定ロジックが複雑なら flowchart 併用 -->`
2. `System Flows` セクション内（例外フローの後、161行付近）に条件付きサブセクション **「### AI処理フロー（AI処理がある場合は必須）」** を追加。HTMLコメントでトリガー条件と必須要素を説明し、サンプルとして sequenceDiagram（プロンプト構築→呼び出し→出力検証→alt 低信頼/失敗/タイムアウト分岐）＋ flowchart TD（信頼度閾値→再生成ループ）の2図を記載

### ファイル3: `einja-review-spec/SKILL.md`

**観点 H は `phase2_bundle`（design 成果物を含む scope）限定**で追加する。`requirements` / `tasks` テーブルには追加しない（AI処理フロー図は design 成果物の観点のため）。

1. `phase2_bundle` 観点テーブル（90行の後）に観点 H を追加（既存 E/F/G と同じ「必ずピック」語法を含める）:
   `| H | AI処理フロー | 「横断必須ゲート」§G5。design の System Flows に AI処理フロー（入力構築・出力検証・低信頼/失敗/タイムアウト時のリトライ/フォールバック/デフォルト分岐・非決定性対応）があるか。LLM/推論/分類/生成/RAG 等のAI処理を含む場合は必ずピック |`
2. 「横断必須ゲート」導入文の**本文「以下 4 ゲートは…」（106行）**を「以下 5 ゲートは…」に修正
3. §G4 の後（137行付近）に **§G5: AI processing flow gate（→ 観点 H）** をチェックリスト形式で追加（上記「必須要素」を転記）
4. プロンプトテンプレの参照ドキュメント（155-162行）に「design.md.template『System Flows / AI処理フロー』節（観点 H をピックした場合）」を追加
5. **ゲートマッピングの埋め込みブロック（164-171行、`観点 G → §G4` の後）**に `- phase2_bundle 観点 H → §G5` を追加。
   - ⚠️ MINOR-1対応: §G5/観点H の追記は **(a) phase2_bundle 観点テーブル（90行付近）** と **(b) Step 3 プロンプトテンプレ内のゲートマッピングブロック（164-171行）** の**両方**に行うこと。片方だけだとレビュアーへのチェックリスト注入が漏れ、観点とチェックが乖離する

## タスク概要

- **0-1**: Planファイルを `docs/plans/202606/` に命名規則（`YYYYMMDD-<topic>.plan.md`）で配置
- **1**: `design-generator.md` を編集（上記5点: 条件付き必須図テーブル / 図6 / 最低セクション構成 / 最終確認 / mermaid記法方針）[Edit]
- **2**: `design.md.template` を編集（上記2点）[Edit]
- **3**: `einja-review-spec/SKILL.md` を編集（上記5点）[Edit]
- タスク1-3は別ファイルで競合せず**並列可能**だが、ゲート定義文言の一貫性が要るため、§G5 / 図6 の確定文言を先に固め、3ファイルへ転記する

### 並列実行計画

- 3ファイルは独立 → 並列編集可。ただし軽量なため親エージェントが直接 Edit で順次適用しても可（worktree不要: ドキュメント/プロンプトのみの編集）
- Skill-First評価: 既存ゲート追加パターンの踏襲であり、新規Skill化は不要（ゲート構造自体が既にSSOT化されている）

## リスク・不明点

- **mermaid記法方針との整合**: `flowchart TD` は requirements-generator 側でスイムレーン/画面遷移に使用済みで許可記法。design 側の「許可事項（OK）」にもフローチャートは含まれる（NG: C4記法のみ）。問題なし
- **観点 H の追加が既存A-G番号に影響しないか**: 追加のみで既存IDは不変。マッピング・テンプレ参照も追記のみ
- **二重管理**: 3ファイルとも source-of-truth。`presets/default/` 配下は編集しない（ビルドで自動コピー）
- **トリガーの過剰適用**: 「AI処理」の定義を「出力が非決定的な処理」と明示し、単なる外部API呼び出しと区別する

本変更は**コードではなくエージェント定義・テンプレート・Skill（ドキュメント/プロンプト）の編集**である。検証は実行系テストではなく整合性チェックが中心。

1. **文言一貫性 / SSOT突合**: `grep -rn "§G5\|AI処理フロー\|図6" .claude/agents .claude/skills docs/einja/templates` で3ファイルに新ゲートが一貫して入っているか確認。さらに AI処理トリガー定義文（正本=design-generator.md）が template / SKILL の参照表現と矛盾しないか grep で突合（§G4 自己整合）
2. **mermaid構文**: 追加した sequenceDiagram / flowchart TD のサンプルが描画可能か（記法レビュー。必要なら drawio/mermaid MCP でプレビュー）
3. **ゲート整合（4箇所が閉じているか）**: einja-review-spec の (a) phase2_bundle 観点テーブル、(b) §G5 本体、(c) Step 3 プロンプトテンプレのゲートマッピング、(d) 参照ドキュメント が相互参照として閉じているか目視確認
4. **99系レビュー**: einja-review-code による観点別並列レビューを実施（コードdiffではないため、観点はドキュメント/プロンプト整合・ゲート構造の一貫性中心。spec成果物そのものの改修ではないため einja-review-spec ではなく review-code を使用）→ 99-G コミット承認ゲート → einja-task-commit（prepush 実行）
5. **ビルドコピー確認**: `node packages/cli/scripts/copy-presets.mjs`（CLIの`prebuild`で自動実行）後、`git diff --stat presets/default/.claude/agents/einja/issue-specs/design-generator.md presets/default/.claude/skills/einja-review-spec/ presets/default/docs/einja/templates/design.md.template` で3ファイルの変更が presets 側に反映されたことを確認（presets は直接編集しない）
