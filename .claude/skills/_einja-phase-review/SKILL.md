---
name: _einja-phase-review
description: "フェーズ単位包括レビュー。Outcome Manifest全件検証 + Weighted Scorecard判定。Phase末尾タスクグループからphase-reviewer Agent経由で呼び出す。Do NOT use for: 単一タスクグループのレビュー（→ task-reviewer）、コードdiffのみの観点別レビュー（→ einja-review-code）、直接ユーザー呼び出し（内部Skillのため）"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Agent
  - Task
  - TaskCreate
  - TaskUpdate
  - ToolSearch
  - mcp__playwright__*
---

# _einja-phase-review Skill: フェーズ単位包括レビュー

あなたはフェーズ品質保証のスペシャリストです。Phase内の全タスクグループが完了した時点で、Outcome Manifest全件を検証し、Weighted Scorecardで合否判定を行います。

## 前提条件

- **呼び出し元**: `phase-reviewer` Agent（Phase末尾タスクグループの完了後に呼び出される）
- **コンテキスト不要**: fork なし（このSkillはサブエージェント起動・Skill呼び出しを行うため）
- **依存Skill**: `einja-review-code`（Step 4で使用）
- **不明点がある場合**: 推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照してPENDING_QUESTIONS形式で質問を返却し、作業を停止すること

---

## 入力形式

以下を自然言語で受け取る:

```
Issue #123 のPhase 2 フェーズレビューを実行してください。
spec: docs/specs/issues/issue123-feature-name/
```

- **Issue番号** (必須): `#123` または `123`
- **Phase番号** (必須): `2`
- **specパス** (任意): `docs/specs/issues/issue{N}-{name}/`（省略時は自動検索）

---

## Outcome Manifest形式（参照形式）

このSkillが検証するOutcome Manifestの標準形式:

```json
{
  "taskId": "1.2.3",
  "acResults": [
    {
      "acId": "AC2.UI.N.001",
      "claim": "実装内容の主張",
      "verdict": "implemented",
      "evidenceRefs": ["artifacts/evidence/1.2.3-ac2.ui.n.001.log"],
      "evidenceBytes": 12345,
      "toolCallId": "toolu_01ABC..."
    }
  ],
  "changedFiles": ["apps/web/src/components/Foo.tsx"],
  "testsAdded": ["apps/web/src/__tests__/Foo.test.tsx"],
  "evidenceCommands": [
    {
      "cmd": "pnpm --filter @repo/web test",
      "exitCode": 0,
      "stdoutSummary": "42 tests passed",
      "artifactPath": "artifacts/logs/1.2.3-test.log",
      "gitSha": "abc123"
    }
  ],
  "riskFlags": [],
  "notes": ""
}
```

Outcome Manifestは `artifacts/outcomes/{taskId}-outcome.json` に保存される。
存在しない場合はハードブロッカー（`outcome missing`）として判定する。

---

## Weighted Scorecard

### スコア計算式

```
Total Score = AC検証率(40) + required checks通過(20) + reviewセベリティペナルティ(-15)
            + QAエビデンス密度(10) + リトライペナルティ(-10) + コストバジェット(5)

最大スコア: 75点（ペナルティなしの場合）
※ ペナルティは0を下限として適用（マイナスにはならない）
```

### 各項目の算出方法

| 項目 | 満点 | 算出方法 |
|------|------|---------|
| AC検証率 | 40pt | (verdict = "verified" の AC数) / (Phase対象AC総数) × 40 |
| required checks通過 | 20pt | lint + typecheck + build + test の4項目が全pass → 20pt、1項目失敗 → -5pt（最低0pt） |
| reviewセベリティペナルティ | -15pt上限 | MAJOR指摘1件あたり -5pt、MINOR指摘1件あたり -1pt（上限-15pt） |
| QAエビデンス密度 | 10pt | evidenceRefs/evidenceCommandsの充実度（Phase対象ACの80%以上に証跡あり → 10pt、50%以上 → 5pt、未満 → 0pt） |
| リトライペナルティ | -10pt上限 | タスクグループ毎のfixCount合計 × -2pt（上限-10pt） |
| コストバジェット | 5pt | 実行完了かつ予算超過なし → 5pt（現状は常時付与。10件以上の実績後に調整） |

### ハードブロッカー（スコア関係なくFAIL）

以下のいずれかを検出した場合、スコアに関わらず即座に**FAIL**判定:

| ブロッカー種別 | 検出方法 |
|--------------|---------|
| secret漏洩 | diff内にAPIキー・パスワード・トークン等のリテラルが含まれる |
| migration破壊的変更 | Prismaマイグレーションに `DROP COLUMN` / `DROP TABLE` / `ALTER TABLE ... DROP` が含まれる |
| required check失敗 | lint / typecheck / build / test のいずれかがexit code != 0 |
| outcome missing | Phase対象タスクグループの `artifacts/outcomes/{taskId}-outcome.json` が1件以上存在しない |

### 判定基準

```
Score >= 65  → PASS
              （PR descriptionにScorecardサマリを追記して承認）
Score 45〜64 → CONDITIONAL
              （MINOR指摘付きPASS。PR descriptionに改善事項を追記して承認）
Score < 45   → FAIL
              （fix_required。指摘リストを返却して呼び出し元のeinja-task-execに差し戻し）
```

> **初期キャリブレーション**: 初期10件以上の実績データを蓄積するまでは、スコアの記録のみ行い閾値判定はガイドライン的に運用する。実績蓄積後に閾値を調整する。

### フェーズ全体障害（PHASE_ESCALATE）の判定

以下のいずれかに該当する場合、通常の FAIL ではなく **PHASE_ESCALATE** として上位エスカレーション:

1. **デザイン全面乖離**: phase-reviewer が確認した UI 変更の 50% 以上でデザイン整合性 FAIL
2. **仕様-実装全面乖離**: requirements.md と actual 実装の AC カバレッジが 60% 未満（AC 検証率スコアが 40pt × 0.6 = 24pt 未満）
3. **アーキテクチャ全面逸脱**: 4層構造違反が 5 件以上、または全タスクグループにまたがる共通パターン違反（同一モジュールで繰り返し検出）
4. **複数Phase影響**: 前 Phase の成果物（interfaces, contracts）に破壊的変更が発生し、当 Phase がそれに依存している

> **判定優先順位**: ハードブロッカーチェック → PHASE_ESCALATE 判定 → スコア判定 の順に評価する。

**PHASE_ESCALATE 時の処理**:
- 「このPhaseは個別タスク修正では対応できない根本問題があります」と報告
- 具体的な根本原因（設計変更が必要か、Figmaが誤っているか、仕様が曖昧か）を特定
- 推奨アクション（以下のいずれかを明示）:
  - a. spec-create フェーズに戻って仕様を修正する
  - b. Figma（ui-design-url.md）を更新してから再実装する
  - c. 前 Phase の成果物を修正してから当 Phase を再実装する
- 結果レポートの「判定」欄に `🚨 PHASE_ESCALATE` を記載し、根本原因と推奨アクションを詳述する
- 呼び出し元の `einja-task-exec` に PHASE_ESCALATE 判定を返却する（差し戻しリストは不要）

---

## diff範囲

Phase内の変更を取得するGitコマンド:

```bash
# Phase内の変更ファイル一覧
git diff --name-only origin/issue/{N}...HEAD

# Phase内のdiff全量
git diff origin/issue/{N}...HEAD
```

- `origin/issue/{N}`: issueブランチ（PhaseブランチのマージベースとなるIssueブランチ）
- `HEAD`: 現在のPhaseブランチの最新コミット（`issue/{N}-phase{P}` ブランチ上で実行）

---

## 8ステップフロー

作業開始時にTaskCreateツールで以下のタスクリストを作成し、TaskUpdateで進捗管理すること。

### Step 1: フェーズ情報ロード

以下を読み込む:

1. **specディレクトリ探索**: `docs/specs/issues/*/issue{N}-*/` でspecパスを特定
2. **requirements.md の読み込み**: Phase対象のStory・AC一覧を抽出
3. **design.md のパス特定**: 内容は必要に応じて参照
4. **Phase diff取得**: `git diff --name-only origin/issue/{N}...HEAD` で変更ファイル一覧
5. **Outcome Manifest全件ロード**: `artifacts/outcomes/` 配下のPhase対象タスクグループの `{taskId}-outcome.json` を全件読み込む

Phase対象タスクグループの特定方法:
- Issue本文を `gh issue view {N} --json body` で取得
- Phase番号に対応するタスクグループ番号（例: Phase 2 → `2.*`）を抽出

---

### Step 2: AC全件カバレッジ確認

Phase対象の全ACについて、Outcome Manifestの `acResults[].verdict` を集計する:

| 状態 | 条件 |
|------|------|
| `verified` | verdict = "verified" かつ evidenceRefs が1件以上 |
| `suspect` | verdict = "implemented" だが evidenceRefs が空（task-qa 未処理） |
| `missing` | 対応するOutcome Manifestが存在しない、またはacResults内に該当ACなし |

カバレッジ一覧を以下の形式で出力:

```
## AC カバレッジ一覧

| AC番号 | 主張 | 状態 | 証跡数 |
|--------|------|------|--------|
| AC1.UI.N.001 | ログイン画面が表示される | verified | 2 |
| AC1.UI.N.002 | バリデーションが動作する | suspect  | 0 |
| AC2.UI.N.001 | ダッシュボードが表示される | missing | - |
```

---

### Step 3: アーキテクチャ整合性確認

Phase diffに対して以下を確認する:

1. **4層構造遵守**: `presentation` → `application` → `domain` → `infrastructure` の依存方向を確認
   - `grep -r "from.*infrastructure" apps/*/src/presentation/` 等で逆方向import検出
2. **インポート方向**: 相対パスの禁止（`coding-standards.md`に従い絶対パスのみ）
3. **責務分離**: UI コンポーネントに直接DBアクセスや外部API呼び出しが含まれていないか

違反を検出した場合は MAJOR 指摘として記録する。

---

### Step 4: 仕様整合性（requirements → design → 実装）

**einja-review-code Skill を呼び出してコードレビューを実行する**（観点B・C・Dを中心に）。

Skill toolで `einja-review-code` を呼び出す。以下を前置コンテキストとして準備する:
- Phase diffの概要（変更ファイル数、主要変更箇所）
- AC一覧（Step 2で抽出済み）
- 特に仕様との乖離が疑われる箇所（Step 2で `suspect` / `missing` と判定されたAC）

`einja-review-code` の結果判定をこのステップの「仕様整合性レビュー判定」として採用する。

---

### Step 5: フル回帰テスト

以下を順次実行し、全て成功することを確認する:

```bash
pnpm lint       # Biomeエラーがゼロであること
pnpm typecheck  # 型エラーがゼロであること
pnpm build      # ビルドが成功すること
pnpm test       # すべてのテストが成功すること
```

**いずれか1つでも失敗した場合**: ハードブロッカー（required check失敗）として即座にFAIL判定。

各コマンドの結果（exitCode + stdoutSummaryの先頭50行）を記録する。

---

### Step 6: フェーズAC検証（シナリオテスト）

`qa-tests/scenarios.md` を読み込み、Phase対象のシナリオを特定する。

フロントエンド変更が含まれる場合、Playwright MCP Browserを使用して代表シナリオを確認する:

1. ローカル開発サーバーの起動確認（`curl -s http://localhost:3000` でヘルスチェック）
2. 未起動の場合は `einja-start-dev` Skill を呼び出してサーバーを起動
3. `qa-tests/scenarios.md` の対象PhaseのシナリオをPlaywright MCPで実行
4. 各シナリオの結果（SUCCESS/FAILURE）を記録

APIのみの変更の場合は curl でエンドポイント確認を実施する。

スクリーンショットやレスポンスは `artifacts/evidence/phase{P}/` に保存する。

---

### Step 7: ユーザビリティ確認（フロントエンド変更時のみ）

Phase diffに `.tsx`, `.jsx`, `.css`, `ui-design-url.md` の変更が含まれる場合のみ実施。

確認項目:
- 画面遷移に矛盾がないか（リンク先が存在するか）
- エラー状態・ローディング状態が適切に表示されるか
- レスポンシブ対応（モバイル幅 375px でのレイアウト崩れ）
- アクセシビリティ基本項目（alt属性、aria-label等）
- 操作後フィードバック（toast/snackbar/インラインメッセージ）の存在確認
  - FAIL条件: フィードバックが一切ない → MAJOR指摘として記録
- 空状態（empty state）UIの表示確認
  - FAIL条件: データ0件時に空のリストが表示される（empty stateなし）→ MINOR指摘
- フォーカス管理（初期フォーカス・エラー時フォーカス移動）
  - FAIL条件: 初期フォーカスなし、またはエラー後のフォーカス移動なし → MINOR指摘

以下の手順でtask-qaのuxFindingsを集計する:
1. Step 1で読み込み済みのOutcome Manifest（artifacts/outcomes/{taskId}-outcome.json全件）から
   type: "ux_finding" のriskFlagsエントリを収集する
2. FAIL件数を確認:
   - severity: "MAJOR" のエントリ → MAJOR指摘として記録
   - severity: "MINOR" のエントリ → MINOR指摘として記録
3. 集計した ux_major_count / ux_minor_count を Step 8の算出に渡す

Playwright MCPでスクリーンショットを撮影し、`artifacts/evidence/phase{P}/ux/` に保存する。

---

### Step 8: Weighted Scorecard算出 + 結果レポート出力

ここまでのステップで収集した情報からScorecardを算出し、結果レポートを出力する。

#### ハードブロッカーチェック（最優先）

以下を確認してハードブロッカーがあれば即座にFAIL:

```bash
# secret漏洩スキャン（APIキー・トークンパターン）
git diff origin/issue/{N}...HEAD | grep -E "(api[_-]?key|api[_-]?secret|password|token|secret)['\"]?\s*[:=]\s*['\"][a-zA-Z0-9+/]{16,}" -i

# migration破壊的変更スキャン
find . -path "*/prisma/migrations/*.sql" -newer <(git show origin/issue/{N}:.) 2>/dev/null | xargs grep -l "DROP COLUMN\|DROP TABLE\|ALTER TABLE.*DROP" 2>/dev/null

# Outcome Manifest存在確認
# Phase対象タスクグループのoutcome.jsonが全て存在するか確認
```

#### スコア算出

各項目のスコアを計算し、合算する:

```
AC検証率スコア    = (verified AC数) / (Phase対象AC総数) × 40
required checks  = 4項目 全pass → 20pt
reviewペナルティ = MAJOR件数 × (-5) + MINOR件数 × (-1)  ※最大-15pt
エビデンス密度   = (証跡付きAC数 / Phase対象AC総数) に応じて 0/5/10pt
リトライペナルティ = fixCount合計 × (-2)  ※最大-10pt
コストバジェット  = 5pt（常時）

Total Score = 合算（ペナルティは各項目で0を下限とする）
```

```
# Step 7 ユーザビリティチェック結果の集計
ux_major_count = uxFindings where severity == "MAJOR" and result == "FAIL"
ux_minor_count = uxFindings where severity == "MINOR" and result == "FAIL"

# reviewセベリティペナルティ（-15上限）に統合
review_severity_penalty = max(
  -15,
  -( (major_count + ux_major_count) × 5 + (minor_count + ux_minor_count) × 1 )
)
# ※ スコア式の最大値（75点）・PASS閾値（65点）は変更しない
```

#### 判定

```
ハードブロッカーあり → FAIL（ブロッカー種別を明示）
Score >= 65          → PASS
Score 45〜64         → CONDITIONAL
Score < 45           → FAIL
```

#### 結果レポート出力形式

```markdown
## フェーズレビュー結果: Issue #{N} Phase {P}

### 判定: [✅ PASS / ⚠️ CONDITIONAL / ❌ FAIL]

### Weighted Scorecard

| 項目 | スコア | 詳細 |
|------|--------|------|
| AC検証率 (40pt) | {score}pt | verified: {n}/{total} |
| required checks (20pt) | {score}pt | lint:{result} typecheck:{result} build:{result} test:{result} |
| reviewペナルティ (-15pt上限) | -{score}pt | MAJOR:{n}件 MINOR:{n}件 |
| ユーザビリティチェック（UX-1〜6） | ux_major_count件MAJOR, ux_minor_count件MINOR | reviewセベリティペナルティに加算済み |
| QAエビデンス密度 (10pt) | {score}pt | 証跡付きAC: {n}/{total} |
| リトライペナルティ (-10pt上限) | -{score}pt | fixCount合計: {n} |
| コストバジェット (5pt) | {score}pt | - |
| **合計** | **{total}pt** | - |

### ACカバレッジサマリ

- verified: {n}件
- suspect: {n}件（証跡なし実装主張）
- missing: {n}件（Manifest未存在）

### 検出事項

#### ハードブロッカー
{なしの場合は「なし」と記載}

#### MAJOR指摘
{指摘内容、該当ファイル・行番号}

#### MINOR指摘
{指摘内容、該当ファイル・行番号}

### フル回帰テスト結果

| コマンド | 結果 | 備考 |
|---------|------|------|
| pnpm lint | ✅ PASS / ❌ FAIL | {エラー件数等} |
| pnpm typecheck | ✅ PASS / ❌ FAIL | {エラー件数等} |
| pnpm build | ✅ PASS / ❌ FAIL | {ビルド時間等} |
| pnpm test | ✅ PASS / ❌ FAIL | {通過率等} |

### シナリオテスト結果

{qa-tests/scenarios.mdから対象シナリオとその実行結果}

### 次のステップ

[PASS / CONDITIONAL] → phase-reviewerが呼び出し元（einja-issue-exec / einja-issue-team-exec Manager）に承認報告
[FAIL] → 以下の指摘リストをeinja-task-execに差し戻し

{FAILの場合のみ: 修正が必要な指摘の優先リスト}
```

---

## FAIL処理（差し戻し）

**このSkillはFAIL時の指摘リストを返却するのみ**。差し戻し処理（fix_required遷移）は呼び出し元が担う:

- **einja-issue-exec** / **einja-issue-team-exec**: Manager/Leadが `directorVerdict = "fix_required"` + `fixInstructions` を設定し、該当Workerを再起動
- **issue-exec-protocol.md** の `approved / fix_required / rejected` 状態機械をそのまま使用

指摘リストは以下の形式で返却する:

```json
{
  "verdict": "FAIL",
  "score": 55,
  "hardBlockers": ["outcome missing: task 2.3"],
  "fixRequired": [
    {
      "priority": "P0",
      "taskGroupId": "2.3",
      "type": "hardBlocker",
      "description": "artifacts/outcomes/2.3-outcome.json が存在しない",
      "recommendation": "task-executerでOutcome Manifestを生成してください"
    },
    {
      "priority": "P1",
      "taskGroupId": "2.1",
      "type": "MAJOR",
      "description": "AC1.UI.N.002のevidenceRefsが空（suspect状態）",
      "recommendation": "動作確認コマンドの実行ログをevidenceRefsに追加してください"
    }
  ]
}
```

### 優先度定義

| 優先度 | 種別 |
|--------|------|
| P0 | ハードブロッカー（必須修正） |
| P1 | MAJOR指摘（リリースブロック） |
| P2 | MINOR指摘（推奨修正） |

---

## 連携

- **呼び出し元**: `phase-reviewer` Agent（Phase末尾タスクグループ完了後）
- **依存Skill**: `einja-review-code`（Step 4: 仕様整合性）
- **参照プロトコル**: `docs/einja/instructions/issue-exec-protocol.md`（状態機械）
- **差し戻し先**: `einja-task-exec` Skill（FAIL時の fix_required 処理）

---

## 参考資料

- `docs/einja/instructions/issue-exec-protocol.md` - ゲートチェック仕様・状態遷移定義
- `docs/einja/steering/acceptance-criteria-and-qa-guide.md` - QAテストの目的・動作確認ツール
- `docs/einja/steering/development/coding-standards.md` - コーディング規約・インポートパス規約
- `.claude/skills/einja-review-code/SKILL.md` - 観点別並列コードレビュー

<!-- @einja:project-private:start id="_einja-phase-review-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
