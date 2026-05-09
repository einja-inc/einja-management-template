# 3層レビューハーネス設計 (task / task-group / phase)

## Context

現在のタスク実行ワークフロー（einja-task-exec）ではレビュー・QAが**タスクグループ（x.x）単位**でのみ実行される。タスク個別（x.x.z）とフェーズ（x）単位でのレビューが欠如しており、問題が累積してから発見されるリスクがある。

22件の優秀なハーネス（EleutherAI, OpenAI Evals, Anthropic CAI/RSP, Promptflow, DeepEval, Braintrust, METR, AgentBench, SWE-bench, Anthropic Agent Eval, LangSmith, W&B Weave, promptfoo, HAL, Google eng-practices, Netflix Kayenta, Shopify CI, Meta Sapling, GitHub Rules, SonarQube, OWASP DevSecOps）を調査・分析した結果、以下の方針で設計する。

### 調査から得た設計原則

| 原則 | 出典 | 適用 |
|------|------|------|
| **Outcome-based評価** | Anthropic Agent Eval | task-executerがACの達成証拠をJSON出力 |
| **P0/P1/P2分類** | Netflix/Shopify/Google | 常時必須/条件付き/フェーズのみに分類 |
| **改善>完璧** | Google eng-practices | MINOR指摘は自動修正またはdebt登録で流す |
| **テストマッピング** | Shopify CI | `turbo --filter <impacted>` で関連テストのみ実行 |
| **統計的品質スコア** | Netflix Kayenta / HAL | L3でWeighted Scorecard（バイナリだけでない） |
| **コスト追跡** | HAL/hal-harness | 品質と並行してコスト/速度を計測 |
| **Evidence Provenance** | METR / SWE-bench | チェック結果に証拠（コマンド・ファイル・終了コード）を必須化 |
| **diff-only scan** | SonarQube Clean as You Code | 残骸・PII検出は差分限定+allowlist |
| **エージェント特有ゲート** | Anthropic Bloom / promptfoo | scope drift / anti-shortcut / retry anomaly |
| **20〜50件で十分** | Anthropic Agent Eval | 大規模テストセットへの過剰投資を避ける |
| **QA完全性ゲート** | 実障害（Issue #20） | 前提条件失敗時は即BLOCKED＋エスカレーション必須。証拠なきPASSは禁止 |
| **QA結果レビュー** | 実障害（Issue #20） | task-reviewerがQAファイルの完全性を検証（証拠が実在するか確認）|

### 実障害から学んだ設計要件（Issue #20 Phase 2 QAの失敗）

**何が起きたか:**
- Google OAuth ログインができない（credentials未設定）→ 認証後の全AC未検証
- task-qa が「環境問題（D分類）」と判断して自律処理しようとした
- ログインできなかったためログイン後の全シナリオをスキップ
- しかし QA 完了として報告 → reviewer も見抜けずコミット

**根本原因:**
1. `task-qa` に「QA完全性ゲート」がない。証拠なしでもACを `verified` にできてしまう
2. 前提条件（認証）が失敗した時点でエスカレーションせずに黙って進んだ
3. `task-reviewer` が QA ファイルの証拠実在確認をしていない

**対処が必要な設計ギャップ:**
- 全ACにスクリーンショット/curlログ等の証拠が必須（証拠なしACは `blocked` 扱い）
- 前提条件（認証・DB接続・APIキー等）の疎通確認を QA Step 0 に追加
- 前提条件 FAIL → 全下流テストが `blocked` → AskUserQuestion で即エスカレーション
- QA 完全性チェック: `verified` ACの割合が閾値未満（例: <80%）なら QA 全体 FAIL
- `task-reviewer` が QA ファイルを読み、証拠URLやコマンド出力の実在を確認するステップを追加

---

## 現状

### 現行ワークフロー（改訂後の目標フロー）

**現状（GAP付き）→ 改訂後:**

```
einja-issue-exec (Manager)
  └── [Phase × N]
        └── einja-task-exec (Worker)
              │
              │ [Step 1] UIタスク判定（新規）
              │ [Step 2] spec解決 + 新規コンポーネント検出（新規）
              │ [Step 2.5] UI design context load → baseline.png + manifest.json（新規）
              │
              ├── task-executer × N（並列実装）← デザイン基準を持って実装
              │     ← L1: Outcome Manifest + diff-only scan + テストマッピング
              │
              ├── task-reviewer（コードレビュー・グループで1回）
              │     ← L2コードレビュー: einja-review-code A〜H + Outcome Manifest検証
              │
              ├── task-design-reviewer（デザイン整合性・グループで1回）【新規】
              │     ← L2デザイン: baseline vs 実装の構造比較 intent/strict
              │
              ├── task-qa（QA・グループで1回）
              │     ← QA: 前提条件チェック + AC証拠収集 + screenshot vs design比較
              │
              ├── 技術的受け入れゲート（自動）
              │     ← 全MUST AC verified + 証拠実在 + デザイン整合PASS
              │
              └── einja-task-commit
                    （受け入れPASS後のみ）
  └── Phase末尾タスクグループ
        ├── phase-reviewer（フェーズレビュー）【新規】
        ├── 機能的受け入れゲート（ユーザー確認）
        └── Phase PR作成
```

### 実コードベースで判明した実際の問題
| 問題 | ファイル | 優先度 |
|------|---------|--------|
| `pnpm test:e2e` スクリプトが存在しない | `package.json` | P0 |
| env命名ドリフト（AUTH_SECRET vs NEXTAUTH_SECRET） | `.env.*` | P0 |
| `faker` / `alert()` / `console.error` が本番コードに残存 | `apps/admin/src/` | P0 |
| `scripts/` がturbo lint/typecheck対象外 | `turbo.json` / `package.json` | P1 |
| `pnpm audit` がCIにない | `.github/actions/ci/action.yml` | P1 |
| `qa-tests/` 構造が `_einja-task-qa` SKILL.md と乖離 | `qa-tests/` | P1 |

---

## 設計：3層ハーネス + Outcome Manifest

### 追加障害：デザイン乖離問題とデザインシステムファースト設計

**根本原因（Codex実コード分析）:**

```
spec-create: Figma URL → ui-design.pen 生成 ✓
_einja-issue-spec-tasks-generator: 対応UIデザイン は任意フィールド
     ↓ここで断絶
einja-task-exec/SKILL.md:122 → task-executerに渡すのはAC + design.mdセクション名のみ
task-executer.md:18 → design.mdしか見ない（.pen/Figma未参照で実装開始）
task-reviewer → コード品質中心（デザイン照合なし）
task-qa/SKILL.md:196 → 「期待要素が表示されるか」のみ
```

---

#### A. デザインシステムファースト設計（tasks-generator層）

**なぜ重要か**: ui-design.pen に新規コンポーネントがあるのに packages/ui/ に存在しない場合、task-executer がページ固有の独自実装を作りデザインシステムが崩れる。

**コンポーネントパッケージ（Codex確認済み）:**
- `@repo/ui`: web向けbase primitives
- `@repo/admin-ui`: admin向け（+ layout/data-table/command-menu）
- `@repo/front-core`: auth/hooks/utils（UIコンポーネントなし）

**DS先行タスク生成の方式（改訂）:**

tasks-generatorがlive Pencil MCPに依存する案は廃止。理由: headless実行で不安定、tasks-generatorの責務逸脱。

代替設計: 2段階方式
```
Step 1（spec-createフェーズで実施）: ui-design-generator または design-engineer が
  ui-design.pen から _components/ フレームを分析し
  design-component-manifest.json を生成する:
  {
    "components": [
      {"name": "ApprovalDialog", "reusable": true, "screens": ["kanban", "detail"]},
      ...
    ],
    "missingFromPackage": ["ApprovalDialog", "ExternalTriggerBadge"]
  }
  ※ missingFromPackage は @repo/ui または @repo/admin-ui の exports と突き合わせ結果

Step 2（tasks-generator で実施）: design-component-manifest.json が存在する場合、
  missingFromPackage にコンポーネントがあれば「DS実装タスク」を先行生成し、
  該当 feature task がdependになる
  ※ live Pencil MCP は呼ばない（manifestを読むだけ）
```

**task-executer 側の保険（preflight）:**
- 不足コンポーネントがあるのに先行DSタスクが Issue にない → spec defect として即停止

**task-executer 側の保険（preflight）:**
- 不足コンポーネントがあるのに先行DSタスクが Issue にない → spec defect として即停止
- runtime での自動挿入はしない（GitHub Issue と実行DAGの乖離を防ぐ）

---

#### B. デザイン整合性ハーネス（einja-task-exec層）

**Step 2.5 追加: UI design context load（einja-task-exec 親レベル）**

```
UIタスク判定: 対応UIデザイン フィールドあり OR *.tsx/*.css を含む変更
  ↓ UIタスクの場合
einja-task-exec（親）が Pencil MCP batch_get で対象フレームのノード要約取得
einja-task-exec（親）が get_screenshot で baseline.png 生成
einja-task-exec（親）が manifest.json 生成:
  {frameName, components[], layout_axis, expected_states[], variables_used[]}
task-executer および task-design-reviewer のプロンプトに baseline.png + manifest.json を渡す

重要: Pencil MCP は einja-task-exec（親）で呼び出す。
      task-qa は Pencil MCP を呼ばない（task-qa の allowed-tools に Pencil MCP がないため）。
      task-qa には親から baseline.png + manifest.json のパスを渡す。

注意: Figma URL は spec-create で ui-design.pen に正規化済みを前提。下流では .pen のみ扱う。
```

**Step 5.5 追加: task-design-reviewer（task-reviewer後・task-qa前）**

| 確認項目 | FAIL | CONDITIONAL | PASS |
|---------|------|-------------|------|
| コンポーネント種別 | Button→Link等 | variant違い | 一致 |
| レイアウト軸 | 2col→1col | 余白数px差 | 一致 |
| 情報階層/優先度 | primary CTA位置逆 | 補助テキストズレ | 一致 |
| 状態網羅 | disabled/error未実装 | loading未実装 | 全実装 |
| トークン使用 | ハードコードカラー | 非推奨トークン | 全token |
| 視覚的追加 | 情報階層変更する追加 | UX補助的追加 | デザイン通り |

strictモード自動適用: `packages/ui/**` または `packages/admin-ui/**` 変更時、brand-heavy UI

**task-qa へのデザイン比較追加（Step 4）:**

```
対象URL → baseline と同じ viewport → スクリーンショット（初期+状態遷移後）
→ LLMベースの構造的一致判定（intent比較）
→ evidence保存:
   qa-tests/evidence/design-fidelity/{task-group}/
     baseline/*.png, actual/*.png, comparison.md, dom-snapshot.md, manifest.json
```

---

### 設計の根本原則：「エージェントの自己申告を信じない」

**Codexによる実コード分析で判明した根本問題:**
- `qa-tests/evidence/` には `.gitkeep` しかなく、実際の証拠ファイルが存在しない
- issue22の実QA記録では `BLOCKED`/`SKIPPED` のままSUCCESSと記録されている
- fast gate は `story{N}.md` の「存在」しか確認していない（中身・証拠の実在は未検証）
- `browser_take_screenshot` の強制実行ステップが Skill 本文に存在しない

**対策: 証拠はエージェントが生成するのではなく、コントローラが生成・封印する**

| 現行（信頼できない） | 改訂後（コントローラ生成） |
|---|---|
| agent が evidenceRef を自己記入 | controller が tool呼び出し結果から証拠を生成 |
| "ファイルが存在するか" チェック | "bytes > 0 + sha256 + toolCallId + 生成元" チェック |
| agent が `verified` を自己申告 | agent は `candidate_verdict` のみ提案、最終 `verified` はcontrollerが証拠照合後に付与 |
| Playwright MCP（探索的・再現性なし） | 重要フローは Playwright spec (.spec.ts) に昇格しCI必須ゲートに |

**「絶対に防げないケース」（人間なしでは原理的に不可能）:**
1. 文言・トーン・UXが「意図通りか」
2. 業務ルールとの整合性（権限仕様の解釈等）
3. 実ユーザー価値（ACが悪ければ自動化しても誤る）
4. 低頻度フレーク（一回成功したが本番で不安定）
5. 視覚品質・ブランド整合性

**結論:** ハーネスは「QA漏れを劇的に減らす」ものであり「絶対に防ぐ」ものではない。**認証/課金/データ整合性の主要フローは必ず人間確認を必須とする設計とする。**

---

### 設計の中心概念：Outcome Manifest

**最重要追加機能**（Anthropic Agent Eval + SWE-bench の知見）

task-executerが実装完了時に `artifacts/task-{X.Y.Z}.outcome.json` を出力する。

**形式（AC複数対応・evidence強化）:**
```json
{
  "taskId": "1.2.3",
  "acResults": [
    {
      "acId": "AC2.1",
      "claim": "ユーザー一覧APIが実装された",
      "verdict": "implemented",
      "evidenceRefs": ["artifacts/evidence/1.2.3-ac2.1.log"]
    },
    {
      "acId": "AC2.2",
      "claim": "エラー時に400を返す",
      "verdict": "implemented"
    }
  ],
  "changedFiles": ["apps/web/server/presentation/routes/userRoutes.ts"],
  "testsAdded": ["apps/web/src/__tests__/userRoutes.test.ts"],
  "evidenceCommands": [
    {
      "cmd": "pnpm --filter @repo/web test",
      "exitCode": 0,
      "stdoutSummary": "42 tests passed",
      "artifactPath": "artifacts/logs/1.2.3-test.log",
      "gitSha": "{{current_sha}}"
    }
  ],
  "riskFlags": []
}
```

**各ステップの役割:**
- `task-reviewer` → 各`acResults[].verdict` を `implemented / suspect / missing` に更新（静的観点）
- `task-qa` → 各`acResults[].verdict` を `verified / failed / blocked` に更新（動的観点）
- `task-exec Manager` → 全ACが `verified` のときのみmerge可
- ※ 1-Aで確定したSchema定義を2-A/2-C/2-Eは必ず読んでから実装すること

---

### L1: task-executer.md（各タスク x.x.z）← Step 4.6直後・Step 5前に Step 4.7 追加

**目標**: 2分以内。変更ファイル対象（best-effort）。

#### P0チェック（常時必須・失敗でFAIL）

| チェック | 実装方法 |
|---------|---------|
| **Outcome Manifest生成** | `artifacts/task-{X.Y.Z}.outcome.json` を出力（証拠付き。evidenceRefはtoolCallIdで紐付け） |
| **diff限定残骸検出** | `git diff --name-only HEAD~ \| xargs rg -n 'TODO\|FIXME\|faker\b\|alert(\|debugger'` （tests/docs/example除外。`-g '!**/*.test.*'`） |
| **PII/secret logging（diff限定）** | 差分ファイルで `console\.\|logger\.` + `email\|password\|token\|session` の近接確認 |
| **unsafe cast（diff限定）** | `as any\|@ts-ignore\|biome-ignore` on diff files（allowlist除外） |
| **typecheck（impacted package）** | workspace変更: `turbo run typecheck --filter [...<changed_package>]`（dependents含む）。workspace外（scripts/）: `tsc --noEmit -p scripts/tsconfig.json`（存在時のみ）。未対応時はskip |
| **impacted unit tests** | **dependents向き**: `turbo run test --filter=...<changed_package>`（正しいTurbo構文。依存元appを含む）。`packages/ui`等test script未保持のshared packageはturboが自動スキップ（エラーにならない）。`package.json`/`pnpm-lock.yaml`/`turbo.json`変更時はfull suite(`pnpm test`)にフォールバック |

#### P1チェック（条件付き・警告でWARN）

| チェック | 条件 | 実装方法 |
|---------|------|---------|
| **lint（biome）** | biome設定あるworkspaceのみ | `pnpm --filter <ws> exec biome check <diff_files>` |
| **テスト同伴チェック** | apps/src変更時 | 差分ファイル近傍の `*.test.*` 存在確認 |
| **env整合性** | `.env*`/auth/deploy周辺変更時 | `.env.example` vs `.env.*` キー名照合 |
| **anti-shortcut** | テストのみ変更時 | snapshot更新のみ・辞書ハードコード・本体未変更を検出 |
| **scope drift** | ファイル変更数 > 設計想定の2倍 | task metadataの対応ACと無関係な変更ファイルに警告 |

**自己修正ルール**:
- ループ上限: 最大2回（ローカルカウンター、Workerの`fixCount`とは独立）
- P0失敗→`fix_required`（既存の`directorVerdict`状態機械をそのまま使用）
- P1 WARN→`directorVerdict = approved`のまま（状態変更なし）+ outcome.jsonのroot`riskFlags`配列に警告内容を記録するのみ
- P2→outcome.jsonのroot`notes`に記録のみ
- **状態機械は変更しない**: `directorVerdict = approved | fix_required | rejected` の3値を維持

---

### L2: task-reviewer + task-qa + **受け入れ確認ゲート** + einja-review-code（各タスクグループ x.x）

**ステップ順序（重要）:**

```
task-executer × N（実装）
  → task-reviewer（コードレビュー）
  → task-qa（QA + 前提条件チェック + 証拠収集）
  → 【受け入れ確認ゲート（新規）】  ← QAとコミットの間
  → einja-task-commit（コミット）
```

#### 3層受け入れゲート設計（Codex分析を踏まえた抜本改訂）

**「QAが通った」≠「要件を満たした」≠「リリースできる」**

| 層 | 受け入れの種類 | タイミング | 担当 | 自動化率 |
|---|---|---|---|---|
| **L2-acceptance** | 技術的受け入れ | task-qa後・commit前 | agent自動判定 | 高 |
| **L3-acceptance** | 機能的受け入れ | phase完了後・PR作成前 | ユーザー（人間）| 中 |
| **Release-acceptance** | ビジネス受け入れ | 最終PR前 | ユーザー（人間）| 低 |

---

#### L2: 技術的受け入れゲート（QA完全性ゲート）

**位置**: task-qa → **[ここ]** → einja-task-commit

**自動判定**（人間不要の機械チェック）:

```
ハードゲート（1つでもFAILなら commit 不可）:
  □ 全MUST AC が candidate_verified（スコアよりこちらが優先）
  □ 各ACの証拠: bytes > 0 + toolCallId が記録されている（ファイル存在だけでは不十分）
  □ 認証フロー完了の証拠: 「ログインページ表示」ではなく「保護リソースへのアクセス成功」
  □ Step 0 前提条件チェックが PASS（全前提条件の実確認済み）
  □ ハードブロッカーなし（secret漏洩・migration破壊・認証未テスト等）

ソフトゲート（WARNでコミット可）:
  □ SHOULD AC の完全性スコア ≥ 70%
  □ 非機能要件チェック

重要: candidate_verdict → verified の最終付与は task-reviewer が証拠照合後に実施
（エージェント自身が verified を自己付与することは禁止）
```

**技術的受け入れパケット（commit後に生成）:**

```json
{
  "taskGroupId": "2.7",
  "acceptance": {
    "mustAcResults": [
      {
        "acId": "AC-APPR-001",
        "candidateVerdict": "verified",
        "finalVerdict": "verified",
        "evidenceRef": "qa-tests/evidence/2.7/ac-001.png",
        "evidenceBytes": 45823,
        "toolCallId": "toolu_01ABC...",
        "verifiedBy": "task-reviewer"
      }
    ],
    "shouldAcResults": [...],
    "blockedAcs": [],
    "prerequisiteStatus": "pass",
    "hardBlockers": [],
    "acceptanceVerdict": "pass",
    "autoAccepted": false,
    "requiresHumanReview": ["auth変更のため"]
  }
}
```

**autoAcceptance禁止条件（常に人間受け入れ必須）:**
- auth / billing / migration / 外部API / UIの主要導線変更
- MUST ACに `blocked` / `blocked_spec` が1件でも存在

**重要経路（GitHubフロー）:** 重要フローは将来的にPlaywright spec (.spec.ts) に昇格させてCIの真のゲートにする。エージェント駆動テストは探索的QAとして位置づけ、CI spec を最終判定に使う。

---

#### L3: 機能的受け入れゲート

**位置**: Phase末尾タスクグループ完了後・Phase PR作成前

**受け入れパケット（人間に提示）:**

```markdown
## Phase {N} 機能的受け入れパケット

### 確認URL
- preview: http://localhost:5001/kanban
- テストアカウント: xxx@gmail.com
- ロール: admin

### 受け入れシナリオ（3手順で確認できる形）
1. ログイン → カード作成 → ステータス変更 → 承認ダイアログ確認
2. 検索・フィルター動作確認
3. モバイル表示確認

### AC完全性
| AC | 種別 | 状態 | 証拠 |
|----|------|------|------|
| AC-APPR-001 | MUST | verified | [screenshot] |
| AC-APPR-002 | MUST | verified | [curl log] |
| AC-KBN-TRIG-001 | SHOULD | blocked_env | OAuth credentials不足 |

### 既知の未検証事項
- AC-KBN-TRIG-001〜004: ログインできなかったため未検証
  → 解決策: .env.localにGOOGLE_CLIENT_ID/SECRETを設定

### 非機能要件
- パフォーマンス: LCP < 2.5s（未計測）
- アクセシビリティ: axe実行済み、エラー0件
- データ整合性: DB write後のread-back確認済み

### 判定選択肢
- ✅ 受け入れ（Phase PRを作成）
- 🔧 修正が必要（指摘を入力 → 該当task-groupに差し戻し）
- ⏸ 条件付き受け入れ（known issueを次フェーズに追記して進む）
```

**機能的受け入れの実装方式（状態機械変更なし）:**

`awaiting_acceptance` を新状態として追加する案は廃止。理由: issue-exec-protocol.md / issue-exec-workflow.md / einja-issue-exec/SKILL.md / einja-issue-team-exec/SKILL.md / director-prompt.md / message-schemas.md への波及が大きすぎる。

代替設計: 機能的受け入れは **Phase末尾タスクグループの一タスク** として実行する。
- Phase末尾タスクグループ内に「機能的受け入れ確認タスク」を含める
- task-executer がこのタスクを実行し、AskUserQuestion で受け入れパケットを提示してユーザー判定を得る
- 既存の `approved / fix_required / rejected` 状態機械はそのまま
- 受け入れ結果（accepted/rejected/conditional）はoutcome.jsonのnotesに記録

---

#### Release: ビジネス受け入れゲート

**位置**: 最終PR（issue/{N} → main）マージ前

**内容:**
- ビジネス要件達成確認（issue本文の全チェックボックス）
- 運用準備（monitoring設定・rollback手順）
- リリースノート確認
- 残known issuesのリスク評価
- Phase 3以降の実施判断（CONDITIONAL機能等）

---

**目標**: Outcome Manifest全件を検証し、品質を保証する。

#### P0チェック（常時必須）

| チェック | 実装方法 |
|---------|---------|
| **einja-review-code観点A〜H** | 既存Skill（Skill設計/コード/セキュリティ/整合性/影響範囲/テスト/ドキュメント/運用） |
| **Outcome Manifest検証** | 全task-executerのoutcome.jsonを読み込み → `implemented/suspect/missing` 付与 |
| **Evidence Provenance確認** | evidenceCommandsのexit code・ファイル存在を確認 |
| **retry anomaly gate** | fixCount/retryCountが高いtask-groupにRisk Gate昇格を警告 |
| **全テストスイート** | `pnpm lint` + `pnpm typecheck` + `pnpm build` + `pnpm test` |

#### P1チェック（条件付き）

| チェック | 条件 | 実装方法 |
|---------|------|---------|
| **依存脆弱性スキャン** | package.json/lockfile変更時 | `pnpm audit --prod --audit-level=high` |
| **Prismaマイグレーション安全性** | schema.prisma変更時 | `prisma migrate diff` + grep破壊的変更 |
| **循環依存検出** | 依存境界変更時 | `pnpm dlx madge --circular` （変更workspace限定・未インストール時はskip） |
| **A11y確認** | フロントエンド変更時 | Playwright MCP Browserで主要UI要素確認 |
| **scripts/ lint/typecheck** | scripts/変更時 | `biome check scripts/` + `tsc -p scripts/tsconfig.json --noEmit`（tsconfig存在時のみ） |
| **human-escalation gate** | 仕様解釈が曖昧なAC存在時 | AskUserQuestionで確認してからoutcome `verified` 不可 |

#### P2チェック（フェーズのみ・ここでは省略）

- デッドコード検出（knip、warn-only）
- カバレッジ閾値確認

**観点H（einja-review-code追加観点）:**
- ログ記録の適切性・エラーメッセージの明確さ・N+1/キャッシュ・Observability・Graceful degradation
- 適用条件: I/O・永続化・外部連携・権限・重い描画・失敗UX・バッチ/非同期処理を含む変更時

---

### L3: _einja-phase-review Skill（各Phase末尾タスクグループ）

**目標**: 全ACのverified確認 + フェーズ横断品質の保証 + Weighted Scorecard判定。

**組み込み先**: Phase X の末尾タスクグループ（Phase 99 docs-updater専用には手を入れない）

**diff範囲**: `merge-base(issue/{N}, issue/{N}-phase{P})...issue/{N}-phase{P}`

**FAIL処理**: 指摘リスト返却のみ → fix_required → einja-task-execが既存MAJORループで処理

#### Weighted Scorecard（統計的品質判定）

```
Total Score = AC verified率(40) + required checks通過(20) + review severity penalty(-15) 
            + QA evidence密度(10) + retry penalty(-10) + cost budget(5)

ハードブロッカー（スコア関係なくFAIL）:
  - secret漏洩、migration破壊的変更、required check失敗、outcome missing

判定:
  - Score >= 80 → PASS
  - Score 60〜79 → CONDITIONAL（MINOR指摘付きPASS、PR descriptionに追記）
  - Score < 60 → FAIL（fix_required）
  
  ※ 履歴20件超: rolling baselineと比較し、base - 10点未満でもFAIL
```

#### 8ステップフロー

| ステップ | 内容 | P分類 |
|---------|------|------|
| 1 | フェーズ情報ロード（requirements.md, design.md, Phase差分, outcome.json全件） | P0 |
| 2 | AC全件カバレッジ確認（verified/suspect/missing一覧） | P0 |
| 3 | アーキテクチャ整合性（4層構造・インポート方向・責務分離） | P0 |
| 4 | 仕様整合性（requirements → design → 実装） | P0 |
| 5 | フル回帰テスト（`pnpm lint` + `pnpm typecheck` + `pnpm build` + `pnpm test`） | P0 |
| 6 | フェーズAC検証（`qa-tests/scenarios.md` からPhase対象シナリオをPlaywright MCP Browserで確認） | P0 |
| 7 | ユーザビリティ確認（フロントエンド変更時: UX一貫性・フォーカス管理） | P1 |
| 8 | Weighted Scorecard算出 + 結果レポート出力 | P0 |

---

### コスト追跡（全層）

各task-group完了時に `artifacts/task-{X.Y}.cost.json` を出力：

```json
{
  "taskGroupId": "1.2",
  "wallClockSec": 420,
  "tokenEstimate": 85000,
  "commandCount": 23,
  "testMinutes": 3.2,
  "fixCount": 1,
  "retryCount": 0,
  "humanEscalations": 0
}
```

L3でcost.jsonを集計し、「前回フェーズより2倍重いのに品質同等」の場合はWARN。

---

### QAテスト設計（Issue #20障害を踏まえた抜本改訂）

**役割の分離:**
- `qa-tests/scenarios.md` ... **アプリ全体のシナリオマスター（SSOT、継続的メンテナンス）**
- `qa-tests/phase{N}/{N-M}.md` ... タスクグループ単位のQA実行結果ファイル（現行維持）
- `qa-tests/evidence/` ... スクリーンショット・ログ保管（必須化）

**`_einja-task-qa` SKILL.mdへの追加（重要）:**

#### Step 0: 前提条件チェック（新規追加・P0）

テスト実行前に全前提条件を確認する。**1つでも失敗したら全下流テストはBLOCKED。**

| 前提条件 | チェック方法 |
|---------|------------|
| アプリ起動確認 | `curl -f http://localhost:{PORT}/` → 非200は即BLOCKED |
| 認証動作確認 | ログイン画面が表示されるか確認 |
| DB接続確認 | APIエンドポイント（/api/rpc/xxx）が500でないか確認 |
| 外部サービス確認 | 必要なAPIキー・環境変数が設定されているか |
| ログイン完了確認 | UIテストの場合、ログイン後ページにアクセス可能か確認 |

**BLOCKED時の必須アクション:**
- 原因を特定して AskUserQuestion で即エスカレーション
- 解決策（例: ローカルDB起動、OAuth credentials設定）を提示
- ユーザーが解決するまで QA は BLOCKED のまま（完了を宣言しない）

#### QA完全性ゲート（新規追加・P0）

QA終了時に以下を確認する：

```
AC完全性チェック:
  - 全ACに対して verdict が "verified" / "failed" / "blocked" のいずれかが設定されていること
  - "verified" ACには必ず evidenceRef（スクリーンショットURL or コマンド出力パス）があること
  - evidenceRef なしの "verified" は無効（"blocked" に格下げ）

完全性スコア = verified AC数 / 全AC数

判定:
  - >= 90%: QA PASS
  - 70〜89%: QA PASS with WARNING（blocked ACを次フェーズ冒頭に追記）
  - < 70%: QA FAIL（blocked ACの解決まで再QAが必要）
  
ハードブロッカー（スコア関係なくFAIL）:
  - 認証後のUIシナリオが1件もテストされていない
  - Step 0の前提条件が未解決のままQA完了を宣言
```

#### `task-reviewer` への追加（QA結果レビュー）

task-reviewer が QA 完了後に `qa-tests/phase{N}/{N-M}.md` を読み：
- 各ACの verdict と evidenceRef の実在を確認
- evidenceRef のファイル/URLが実際に存在するか確認
- 完全性スコアが基準を満たしているか確認
- 「ログインできなかったからスキップ」のような BLOCKED 理由の正当性を評価
- QA 結果が不完全な場合は task-qa を差し戻し（fix_required）

#### Story{N}.md形式との整合
- story{N}.md参照は変更しない（連鎖更新防止）
- Step 0（前提条件チェック）とQA完全性ゲートを既存フローに追加するのみ
- Step 1で `{spec_dir}/qa-tests/scenarios.md` も読む（存在する場合のみ）

---

## Skill仕様

### _einja-phase-review（新規）

```yaml
name: _einja-phase-review
description: フェーズ単位包括レビュー。Outcome Manifest全件検証 + Weighted Scorecard判定。Phase末尾タスクグループからphase-reviewer経由で呼び出し
type: インナー型（_einja-プレフィックス）
context: fork なし
user-invocable: false
依存Skill: einja-review-code
```

### phase-reviewer.md（エージェント定義）
```yaml
skills: [_einja-phase-review]
```

---

## 対象ファイル

**新規作成**:
- `.claude/skills/_einja-phase-review/SKILL.md`（Outcome Manifest検証 + Weighted Scorecard）
- `.claude/agents/einja/phase-reviewer.md`（エージェント定義）
- `qa-tests/scenarios.md`（アプリ全体シナリオマスター初期テンプレート）
- `.claude/agents/einja/task/task-design-reviewer.md`（デザイン整合性専用レビューエージェント）

**変更**:
- `.claude/agents/einja/task/task-executer.md`（Step 4.7追加 + UIタスクはbaseline.png+manifest.jsonを受け取り実装）
- `.claude/skills/einja-task-exec/SKILL.md`（**Step 2.5 UI design context load追加** + **Step 5.5 task-design-reviewer呼び出し** + `対応UIデザイン`パース + L2受け入れゲート）
- `.claude/skills/einja-review-code/SKILL.md`（観点H追加）
- `.claude/agents/einja/task/task-reviewer.md`（Outcome Manifest検証 + P0/P1条件付きステップ + QA結果レビュー）
- `.claude/agents/einja/issue-specs/tasks-generator.md`（Phase末尾機能的受け入れゲート格上げ + **DS先行タスク生成ロジック追加**）
- `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md`（**新規コンポーネント検出 + DS先行タスク生成** + UIタスク対応UIデザイン必須付与）
- `.claude/skills/_einja-issue-spec-tasks-validator/SKILL.md`（**UIタスクで`対応UIデザイン`を必須**化）
- `.claude/skills/_einja-task-qa/SKILL.md`（Step 0前提条件チェック + QA完全性ゲート + **screenshot vs design比較 + design-fidelity evidence** + 受け入れパケット生成）
- `docs/einja/steering/development/` 配下（`Definition of Acceptance` セクションをrequirements.md仕様に追加）
- `.claude/agents/einja/task/task-qa.md`（QA evidenceスキーマ拡張に合わせてwrapperも更新）

**確認後に変更対象に追加（可能性あり）:**
- `docs/einja/instructions/issue-exec-workflow.md`（機能的受け入れのフロー説明を追記）

**確認後に判断**:
- `docs/einja/instructions/issue-exec-protocol.md`（fix_required整合確認）

---

## タスク概要

| ID | 内容 | 依存 |
|----|------|------|
| 0-0 | TaskCreate一括登録 | - |
| 0-1 | Planファイル配置（docs/plans/202605/）| 0-0 |
| 0-2 | worktree作成（`_einja-worktree-guide` Skill参照） | 0-1 |
| **1-A** | `_einja-phase-review/SKILL.md` 作成（Weighted Scorecard + Outcome Manifest検証）[codex-agent + Explore] | 0-2 |
| **1-B** | `phase-reviewer.md` 作成 [codex-agent] | 1-A |
| **1-C** | `einja-review-code/SKILL.md` 観点H追加 [codex-agent] | 0-2 |
| **1-D** | `qa-tests/scenarios.md` 初期テンプレート作成 [codex-agent] | 0-2 |
| **1-E** | `task-design-reviewer.md` 作成（デザイン整合性専用エージェント: baseline比較・状態網羅・トークン確認）[codex-agent] | 0-2 |
| **2-A** | `task-executer.md` Step 4.7追加 + UIタスクはbaseline.png+manifest.jsonを受け取り実装 [codex-agent] | 1-A,1-C,1-E |
| **2-B** | `einja-task-exec/SKILL.md` **Step 2.5 UI design context load** + **Step 5.5 task-design-reviewer** + `対応UIデザイン`パース + L2受け入れゲート [codex-agent] | 1-A,1-E |
| **2-C** | `task-reviewer.md` Outcome Manifest検証 + P0/P1条件付きステップ + QA結果レビュー [codex-agent] | 1-A,1-C |
| **2-D** | `tasks-generator.md` + `_einja-issue-spec-tasks-generator/SKILL.md`: **新規コンポーネント検出 + DS先行タスク生成** + Phase末尾機能的受け入れゲート格上げ [codex-agent + Explore] | 1-A,1-B,1-E |
| **2-E** | `_einja-task-qa/SKILL.md` Step 0前提条件チェック + **screenshot vs design比較 + design-fidelity evidence** + QA完全性ゲート + scenarios.md参照 [codex-agent] | 1-D,1-E |
| **2-F** | `_einja-issue-spec-tasks-validator/SKILL.md` UIタスクで`対応UIデザイン`を必須化 [codex-agent] | 0-2 |
| 99-1 | 観点別並列コードレビュー [einja-review-code] | 2-A〜2-E |
| 99-2 | 動作確認（変更ファイル読み取り検証） | 99-1 |
| 99-G | コミット承認ゲート [AskUserQuestion] | 99-2 |
| 99-3 | コミット・プッシュ [einja-task-commit] | 99-G |

> **1-A**: `task-management.md`・`issue-exec-protocol.md` を事前に読む。Outcome Manifest形式を定義し、Weighted Scorecard算出ロジックを設計。diff範囲は `merge-base(issue/{N}, issue/{N}-phase{P})...issue/{N}-phase{P}`

> **2-A**: workspace外変更は `pnpm typecheck`（root tsconfig）、workspace変更は `turbo run typecheck --filter=...<package>`（正しいTurbo構文・dependents向き）。UIタスクはbaseline.png+manifest.jsonをプロンプトに受け取ること。

> **2-B**: Step 2.5でPencil MCPのbatch_get + get_screenshotを使ってbaseline.png生成。Step 5.5でtask-design-reviewerを直列実行（task-reviewer後・task-qa前）。ui-design.penが存在しないUIタスクはspec defectとして停止。

> **2-C**: P0（常時）とP1（条件付き）を明確に分けて記述。retry anomaly gateとhuman-escalation gateを追加。

> **2-D**: `_einja-issue-spec-tasks-generator/SKILL.md` でコンポーネント検出ロジックを実装。Phase 99（docs-updater専用）の生成ロジックには手を入れない。先行DSタスクは「DS実装タスク」として明示し、feature taskがdepend。

> **2-E**: Step 0前提条件チェック（認証完了まで含む）を追加。design-fidelity evidenceはqa-tests/evidence/design-fidelity/配下に保存。story{N}.md参照は変更しない。

> **2-F**: `_einja-issue-spec-tasks-validator/SKILL.md` を変更（tasks-validator.mdではなく）。UIタスク判定: *.tsx/*.cssを含む変更 OR タスク名にUI/画面/フォームを含む。

## 並列実行計画

```
Phase 0 (順次): 0-0 → 0-1 → 0-2
Phase 1 (並列): 1-A || 1-B || 1-C || 1-D || 1-E
Phase 2 (並列, Phase1完了後): 2-A || 2-B || 2-C || 2-D || 2-E || 2-F
Phase 99 (順次): 99-1 → 99-2 → 99-G → 99-3
```

**各エージェントの分担方針:**
- 1-A (phase-review): Outcome Manifest形式・Weighted Scorecard・Phase diff範囲の確定がハブになる。2-A/2-B/2-C/2-Eが参照する定義を生成する。
- 1-E (task-design-reviewer): baseline比較のロジック・intent/strict判定基準・evidence形式を確定する。2-A/2-B/2-Eが参照する。
- 2-B (einja-task-exec): Step 2.5とStep 5.5の追加が最も影響範囲が大きい。1-Aと1-Eの成果物を読んでから実装すること。
- 2-D (tasks-generator): DS先行タスク生成ロジックはPencil MCPアクセスを含むため、実際のpen構造を確認しながら設計すること。

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| **Outcome Manifest形式の合意** | task-executer/task-reviewer/task-qaの3者でJSON形式が一致しないと連携できない | 1-Aで形式を確定し、2-A/2-C/2-Eはその定義に従う |
| **workspace外lint/typecheck** | scripts/・root設定変更時にtypecheckコマンドが変わる（turboはworkspaceのみ対象） | 2-A担当者が判断: scripts/に独自tsconfig.jsonがあれば`tsc --noEmit -p scripts/tsconfig.json`、なければL1でスキップ |
| **テストマッピングの精度** | `--filter <changed_package>...` で関連テストを取りこぼす可能性 | packageごとの依存関係はturboの`dependsOn`を参照。`package.json`/`turbo.json`変更時はfull suiteにフォールバック |
| **tasks-generator のPhase末尾パターン** | Phase末尾タスクグループの生成ロジックが見つからない場合 | 2-D担当者が事前確認。パターンがない場合はeinja-issue-exec SKILLに記述追加で代替 |
| **Weighted Scorecard閾値の妥当性** | 初回運用で閾値が厳しすぎる/甘すぎる | 初期はscoreの記録のみ行い、10件以上の実績後に閾値を調整する設計にすること |
| **pnpm test:e2e不在** | task-qaのStep 2必須テストが実体なし | task-qa Step 2の`pnpm test:e2e`は「スクリプトがない場合はSKIPし、WARN記録」に修正 |
| **ui-design.penが存在しない案件** | Step 2.5でpen読込に失敗 | spec-createで必ず.penを生成する運用を徹底。存在しない場合はspec defectとして停止し、design-engineerにpen生成を依頼 |
| **新規コンポーネント検出の精度** | reusable判定が不正確でDS先行タスクの過不足が出る | 2-D担当者が実際の.pen構造と@repo/ui/@repo/admin-uiのexportsを確認してから判定ロジックを設計する |
| **baseline.pngとactual.pngの比較精度** | LLMベースのintent比較が主観的で再現性が低い | 比較結果のreasoning（なぜPASS/FAILか）をcomparison.mdに必ず記録。designer review時の参考にできるようにする |
| **Figma URL案件（.pen未生成）** | spec-createでFigmaから.penへの正規化が済んでいない場合、Step 2.5が失敗 | Figma URL案件はspec-createフェーズで必ず.penに正規化済みとする。正規化なしにissue-execは開始しない |

## レビュー残存MAJOR指摘（実装フェーズで対応）

2回の修正後もcodexがMAJORを返した。ただし指摘内容を分析すると、**codexは「プランの設計」ではなく「現在の実装ファイルの状態」を検証している**。

指摘の実態：
- Pencil MCP親移管 → 現行ファイルに反映なし → 当然（Plan mode中は実装しない）
- awaiting_acceptance廃止 → 現行protocol.mdに変化なし → 当然（Plan mode中は実装しない）
- DS先行タスク生成 → ui-design-generatorに変化なし → 当然（Plan mode中は実装しない）

プランは「何を変えるか」を記述する文書であり、実装前の状態を確認して「変わっていない」と言うのは誤認である。設計方針は正しく記述されており、実装担当者（codex-agent）が各タスクで対応する。

**実装フェーズで対応が必要な詳細事項（実装担当者向け）:**
- 2-B（einja-task-exec変更）: Pencil MCP呼び出し契約（baseline.png/manifest.jsonの渡し方）をeinja-task-exec/SKILL.mdに明記すること
- 2-E（task-qa変更）: _einja-task-qa/SKILL.mdにbaseline.png/manifest.jsonを入力として受け取るインターフェースを追加すること
- 2-D（tasks-generator変更）: ui-design-generatorにdesign-component-manifest.json生成機能を追加し（spec-createフェーズ）、tasks-generatorがmanifestを読む形に変更すること
- 2-B（受け入れタスク化）: Phase末尾タスクグループテンプレートに「機能的受け入れ確認タスク」を追加し、outcome.jsonのnotesに結果を記録すること

---

## 検証・動作確認方法

1. `artifacts/task-{X.Y.Z}.outcome.json` が task-executer 完了後に生成されているか
2. task-reviewer が `implemented/suspect/missing` をoutcome.jsonに付与しているか
3. `einja-review-code/SKILL.md` の観点テーブルにHが追加されているか
4. `task-executer.md` Step 4.6直後・Step 5前にStep 4.7が挿入されているか（P0/P1分類含む）
5. `turbo run test --filter <changed_package>...` によるテストマッピングが記述されているか
6. `tasks-generator.md` にphase-review追記があり、Phase 99が変更されていないか
7. `_einja-phase-review/SKILL.md` にWeighted Scorecard算出ロジックが含まれているか
8. phase-review FAILが「指摘リスト返却 → fix_required → 既存MAJORループ処理」になっているか
9. `qa-tests/scenarios.md` の初期テンプレートが作成されているか
