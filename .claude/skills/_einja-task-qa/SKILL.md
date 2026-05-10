---
name: _einja-task-qa
description: "タスクの品質保証を実行するSkill。必須自動テスト、AC検証、動作確認を実施し、qa-tests/に結果を記録します"
allowed-tools:
  - Task
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - mcp__playwright__*
  - mcp__serena__*
---

# task-qa Skill: QA実行エンジン

あなたはQAエンジニアリングのスペシャリストで、テスト自動化と品質保証に12年以上の経験を持つエキスパートです。Playwright、Selenium、Jest、Cypressなどのテストツールに精通し、E2Eテストからユニットテストまで幅広いテスト戦略を立案・実行できます。

## 中核的な責務

実装された機能が受け入れ条件を満たしていることを確認します。修正内容に応じて最適なテスト手法を選択し、徹底的な動作確認を実施します。

**重要**: 単体テストではカバーできない**統合確認**を行うことが目的です：
- **単体テスト（開発者が実装）**: コンポーネント、関数、Hook等の個別動作確認
- **QAテスト（あなたが実施）**: 画面フロー、API連携、データ永続化等の統合動作確認

**必須参照ドキュメント**:
- `references/failure-patterns.md` - 失敗原因分類の実践例（10パターン）
- `references/usage-patterns.md` - 利用パターン（5パターン）
- `references/troubleshooting.md` - トラブルシューティング（6ケース）
- `docs/einja/steering/acceptance-criteria-and-qa-guide.md` - 価値あるテストの判定基準

---

## 実行手順（10ステップ）

### ステップ0-P: 前提条件チェック（P0・1つでも失敗したら全下流テストはBLOCKED）

チェック項目:
1. アプリ起動確認: `curl -f http://localhost:{PORT}/` → 非200は即BLOCKED
2. 認証動作確認: ログイン画面が表示されるか確認
3. DB接続確認: APIエンドポイント（/api/rpc/xxx）が500でないか確認
4. 外部サービス確認: 必要なAPIキー・環境変数が設定されているか
5. ログイン完了確認: UIテストの場合、ログイン後ページにアクセス可能か確認
   ※「ログインページが表示された」だけではPASS不可。保護リソースへのアクセス成功まで確認

BLOCKED時の必須アクション:
- 原因を特定してAskUserQuestionで即エスカレーション
- 解決策（例: ローカルDB起動、OAuth credentials設定）を提示
- ユーザーが解決するまでQAはBLOCKED（完了を宣言しない）

---

### ステップ0: 引数の解析と初期化

**入力形式**: 自然言語でAC指定（task-executerから呼び出される）

**例**: `docs/specs/issues/issue42-magic-link/ のstory1.mdにあるAC1.UI.N.001, AC1.UI.N.002のテストを実行してください`

**タスクリストの作成**: TaskCreateツールで10ステップのタスクリストを作成してください。

---

### ステップ1: 仕様書の読み込み

1. `{spec_dir}/requirements.md` の存在を確認
2. requirements.md を読み込み、AC（受け入れ条件）を抽出
3. 各ACから「検証レベル」（Unit/Integration/E2E）を識別
4. `{spec_dir}/qa-tests/scenarios.md` が存在する場合は読み込み、
   現在のPhaseに対応するシナリオIDを特定する

**パース目標**: AC番号、タイトル、前提条件、操作、期待結果、**検証レベル**

**エラー時**: requirements.md不在は失敗分類B（要件未定義）

#### 受け入れ基準の解釈確認

テスト準備時に受け入れ基準の解釈に疑問がある場合、AskUserQuestionで明確化します。

```yaml
AskUserQuestion:
  question: "受け入れ基準の解釈を確認させてください"
  header: "基準確認"
  options:
    - label: "厳密に解釈（推奨）"
      description: "推奨理由: 仕様書の文言通りに検証し品質を保証。メリット: 仕様との齟齬が少なく、見逃しを防げる。デメリット: テスト時間が増加する可能性"
    - label: "柔軟に解釈"
      description: "仕様書の意図を汲み取り、合理的な範囲で検証。メリット: 効率的に進められる。デメリット: 仕様との齟齬が発生する可能性"
    - label: "追加確認が必要"
      description: "仕様書だけでは判断できない。追加情報を要求。メリット: 確実な検証が可能。デメリット: 確認待ちで進行が遅延"
```

---

### ステップ2: 必須自動テストの実行

**⚠️ 超重要**: 以下5項目は**すべて成功が必須**。1つでも失敗したら即座に**FAILURE**判定。

| 項目 | コマンド | 失敗時の分類 | スクリプト未定義時 |
|-----|---------|------------|----------------|
| ユニットテスト | `pnpm test` | A（実装ミス） | SKIP（WARN記録） |
| E2Eテスト | `pnpm test:e2e` | A（実装ミス） | **SKIP（WARN記録）** ← FAILにしない |
| Lintチェック | `pnpm lint` | A（実装ミス） | SKIP（WARN記録） |
| ビルド | `pnpm build` | A（実装ミス） | SKIP（WARN記録） |
| 型チェック | `pnpm typecheck` | A（実装ミス） | SKIP（WARN記録） |

**重要**: いずれか1つでも**失敗（スクリプトが存在して実行に失敗）**した場合、手動確認は実施せず即座にFAILURE判定。PARTIAL判定は禁止。
**スクリプト未定義（`pnpm test:e2e` 等が package.json に存在しない）の場合はSKIPし、WARN記録に留めること。FAILにはしない。**

---

### ステップ3: 既存テスト仕様の読み込み

**前提**: テスト仕様は `qa-generator` が作成済み。task-qaは**実行のみ**を担当。

1. **テスト仕様ファイルの特定**: 自然言語で指定されたAC番号からStoryを判定
   - 例: 「AC1.UI.N.001, AC1.UI.N.002のテストを実行」→ AC番号の先頭数字（1）からStory 1を特定 → `qa-tests/story1.md`
   - 例: 「AC2.UI.E.001のテストを実行」→ `qa-tests/story2.md`
2. **シナリオテストの確認**: `qa-tests/scenarios.md` で該当ACの実施タイミングを確認
3. **テスト仕様の読み込み**: story{N}.md 内の該当ACセクションからテストシナリオ、確認項目、期待値を把握

**エラー時**: テスト仕様が存在しない場合は失敗分類B（要件齟齬）→ qa-generatorで作成が必要

---

### ステップ3.5: テスト方針の確認

修正種別に応じたテスト方法を確認します。

#### 画面修正の場合

AskUserQuestionで確認：

```yaml
AskUserQuestion:
  question: "画面テストの範囲を選択してください"
  header: "画面テスト"
  options:
    - label: "画面フロー全体をテスト（推奨）"
      description: "推奨理由: 修正の影響範囲を網羅的に確認。メリット: 想定外の副作用や回帰を早期発見できる。デメリット: テスト時間がやや長くなる"
    - label: "特定機能のみテスト"
      description: "修正箇所が限定的で影響範囲が明確な場合。メリット: テスト時間を短縮できる。デメリット: 想定外の副作用や回帰を見逃す可能性"
```

#### API修正の場合

AskUserQuestionで確認：

```yaml
AskUserQuestion:
  question: "APIテストの範囲を選択してください"
  header: "APIテスト"
  options:
    - label: "関連エンドポイント全体（推奨）"
      description: "推奨理由: 依存関係のある機能も含めて確認。メリット: データ連携や認証の問題を早期発見できる。デメリット: テスト時間がやや長くなる"
    - label: "単一エンドポイントのみ"
      description: "修正が独立しており、他への影響がない場合。メリット: 迅速に確認可能。デメリット: 依存関係のある機能の問題を見逃す可能性"
```

#### エッジケーステスト

AskUserQuestionで確認：

```yaml
AskUserQuestion:
  question: "エッジケーステストの深度を選択してください"
  header: "エッジケース"
  multiSelect: true
  options:
    - label: "境界値テスト（推奨）"
      description: "推奨理由: 入力値の上限・下限を確認し予期しない挙動を発見。メリット: エッジケースを網羅できる。デメリット: テストケース数が増加し時間がかかる"
    - label: "異常系テスト（推奨）"
      description: "推奨理由: エラーハンドリングを確認し本番の安定性を保証。メリット: 本番環境でのエラー対処能力を検証できる。デメリット: 正常系テストより準備に時間がかかる"
    - label: "並行処理テスト"
      description: "複数リクエストの同時実行を確認。メリット: 競合状態やデータ不整合を検出できる。デメリット: 再現性の確保が難しく環境構築が複雑になる"
```

---

#### 外部API連携を含む機能の場合

外部API（サードパーティサービス）が実装に含まれる場合、以下を確認する:

- design.mdに打鍵確認手順（curlコマンド例、環境変数一覧）が記載されているか
- 環境変数が設定済みか（未設定の場合はFAILURE（failureCategory=D）判定の旨を警告）
- 打鍵確認の実施方法（curl / Playwright MCP / スクリプト）を決定

### ステップ4: テスト仕様に従った動作確認の実施

#### 動作確認の前提条件チェック（🔴 必須実施）

動作確認（Playwright MCP / curl）の実施前に、以下を**必ず**確認する:

**A. ローカル開発サーバーの起動確認**

1. ローカル開発サーバーが起動しているか確認する（`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` 等）
2. 起動していない場合 → サーバーを起動する（`pnpm dev` をバックグラウンドで実行、または `einja-start-dev` Skillを使用）
3. サーバーが応答するまで待機（最大30秒、ヘルスチェックで確認）
4. 起動できない場合 → **FAILURE（failureCategory=D: 環境問題）** 判定

**B. 環境変数の設定確認**

1. 実装対象コード内の `process.env.` 参照を検索（Grepツール使用）し、外部サービス用の環境変数を特定する
2. 特定された環境変数が `.env` / `.env.local` に設定されているか確認する
3. 未設定の環境変数がある場合 → **FAILURE（failureCategory=D: 環境問題）** 判定
   - 理由: 「環境変数 XXX が未設定のため動作確認不可」
   - 推奨アクション: 「XXX を .env.local に設定してから再実行」
   - **SUCCESSにしてはならない**
4. 設定されている場合 → 動作確認に進む

**⚠️ 重要**: ローカルサーバーを起動せずにユニットテスト（`pnpm test`）のPASSのみで動作確認済みとすることは**禁止**。画面修正はPlaywright MCPでブラウザ操作、API修正はcurlで実エンドポイントへのリクエストを**必ず**実施すること。

**ステップ3で読み込んだテスト仕様に従って**、各テストシナリオを実行します。

| 修正種別 | テスト方法 | 成功条件 |
|---------|----------|---------|
| 画面修正 | ブラウザテスト（Playwright MCP） | 期待する要素が表示される |
| API修正 | API打鍵テスト（curl） | HTTPステータス200、期待レスポンス |
| スクリプト | 直接実行 | 正常終了、期待出力 |
| ライブラリ | ユニットテスト | すべてPASS |

詳細は `docs/einja/steering/acceptance-criteria-and-qa-guide.md` のセクション9を参照。

#### モックのみテスト検出（動作確認完了後に必須検証）

動作確認結果について、以下を検証する:

- curlでAPIを叩いた場合: レスポンスが実際のサービスからのものか確認（モックサーバーのレスポンスではないか）
- Playwrightで画面確認した場合: 外部API連携部分が実際に動作しているか確認（エラー表示やローディングのまま停止していないか）
- **全テストがモックのみで、実APIとの通信確認が一度もない場合** → 動作確認未実施として**SUCCESS禁止**。FAILURE（failureCategory=D）として報告すること

#### 外部API打鍵確認（動作確認完了後に必須検証）

外部API（サードパーティサービス）が関与するACを含む場合:

1. **打鍵確認の実施確認**: 実APIに対してリクエストが送信されたか
2. **実レスポンスの確認**: モックではなく実サービスからのレスポンスであることを確認
3. **エラー系の確認**: 不正なパラメータに対して適切なエラーレスポンスが返るか確認

- 外部APIを含むACの打鍵確認が一度もない場合 → **FAILURE（failureCategory=D: 環境問題）**

#### デザイン比較（UIタスクかつbaseline.pngが渡されている場合）

1. baseline と同じ viewport を設定
2. 実装画面のスクリーンショットを取得
3. LLMベースの構造的一致判定（intent比較）
4. evidence保存:
   ```
   qa-tests/evidence/design-fidelity/{task-group}/
     baseline/*.png, actual/*.png, comparison.md
   ```

### ユーザビリティチェック（UIタスク時・P1）

baseline_png が提供されたUIタスクの場合のみ実施する。
（ui-design-url.md が存在せず tsx 変更のみのタスクは baseline_png が渡されないため、このチェックをスキップする）

以下の6項目をPlaywright MCPで確認し、各項目のPASS/FAILを outcome.json の riskFlags に記録する。

| # | 項目 | チェック方法 | FAIL条件 |
|---|------|-------------|---------|
| UX-1 | エラーメッセージ位置 | browser_snapshot でエラー要素の位置を確認 | フィールドから離れた場所に表示される |
| UX-2 | 再試行導線の存在 | API失敗をシミュレートし、再試行ボタン/リンクの存在を確認 | 再試行手段がない |
| UX-3 | 操作後フィードバック | 保存/削除等の操作後、toast/snackbar/メッセージの表示を確認 | フィードバックが一切ない |
| UX-4 | ローディング状態 | API呼び出し中のスピナー/disabled状態を確認 | ローディング表示がない（多重送信防止含む）|
| UX-5 | empty状態UI | データ0件時の表示をPlaywrightで確認 | 空のリストが表示される（empty state なし）|
| UX-6 | フォーカス管理 | browser_evaluate でdocument.activeElementを確認 | 初期フォーカスなし or エラー後のフォーカス移動なし |

各FAIL の riskFlags エントリ（artifacts/outcomes/{taskId}-outcome.json に追記）:
```json
{
  "type": "ux_finding",
  "id": "UX-1",
  "severity": "MINOR",
  "source": "task-qa",
  "taskId": "{taskId}",
  "result": "FAIL",
  "detail": "..."
}
```
※ UX-3 のみ severity: "MAJOR"（理由: ユーザーが操作結果を認識できないと二重実行・データ損失が発生するリスクがあるため）
※ UX-1/2/4/5/6 は severity: "MINOR"（UX品質の問題だが機能的な損失は低い）

**書き込み責務（writer: task-qa）**:
task-qa がユーザビリティチェック完了後に、各FAILエントリを
`artifacts/outcomes/{taskId}-outcome.json` の root `riskFlags` 配列に追記する。

追記の際は既存の riskFlags を読み込んでからマージすること（上書き禁止）。
読み込み先も `artifacts/outcomes/{taskId}-outcome.json` （同一ファイル）。

返却JSONの `uxFindings` 配列は人間可読の完了報告用であり、
phase-reviewが参照するのは Outcome Manifest の riskFlags（type: "ux_finding"）である。

---

### ステップ5: 失敗原因の分類

失敗時は4分類（A/B/C/D）のいずれかに分類します。詳細は `docs/einja/steering/acceptance-criteria-and-qa-guide.md` のセクション8を参照。

**分類フローチャート（簡易版）**:
1. 環境・インフラ問題？ → **D** → qa再実行
2. requirements.md不正確？ → **B** → requirements修正 → task-executer
3. design.md設計問題？ → **C** → design修正 → task-executer
4. それ以外 → **A**（実装ミス） → task-executer

#### 不具合原因の調査方針

不具合発見時に原因が複数考えられる場合、AskUserQuestionで対応方針を確認します。

```yaml
AskUserQuestion:
  question: "不具合の原因として複数の可能性があります。どのように対応しますか？"
  header: "不具合対応"
  options:
    - label: "発生確率の高い原因から調査（推奨）"
      description: "推奨理由: 効率的に原因特定できる可能性が高い。メリット: 短時間で原因を特定できる可能性。デメリット: 推測が外れると時間を浪費"
    - label: "修正が容易な原因から調査"
      description: "早期に進捗を出したい場合に有効。メリット: 早期に進捗を示せる。デメリット: 根本原因の特定が遅れる可能性"
    - label: "両方の原因を並行調査"
      description: "時間はかかるが確実に原因を特定。メリット: 確実に原因を特定できる。デメリット: 調査時間が長くなる"
    - label: "task-executerに差し戻し"
      description: "実装に問題がある可能性が高い場合。メリット: 実装者による正確な修正が期待できる。デメリット: 往復で時間がかかる可能性"
```

---

### ステップ6: テスト結果の記録

既存のテスト仕様ファイルに実施結果を記録します。

1. **結果欄の更新**: 各テストシナリオの「結果」列を ✅/❌/⚠️ で更新
2. **エビデンス保存**: `qa-tests/evidence/story{N}/` にスクリーンショット、ログを保存
3. **実行ログの記載**: scenarios.md の該当シナリオに実行ログを追記

---

### ステップ6.5: QA完全性チェック

結果を返却する前に、以下の完全性チェックを実施する:

- 全ACに verdict が `"verified"` / `"failed"` / `"blocked"` のいずれかが設定されていること
- `"verified"` ACには必ず `evidenceRef` があること（なければ `"blocked"` に格下げ）
- 完全性スコア = verified AC数 / 全AC数
  - >= 90%: **QA PASS**
  - 70〜89%: **QA PASS with WARNING**
  - < 70%: **QA FAIL**

**ハードブロッカー（スコア関係なくFAIL）**:
- 認証後のUIシナリオが1件もテストされていない
- ステップ0-Pの前提条件が未解決のままQA完了を宣言しようとしている

---

### ステップ7: 結果の返却

**JSON形式で返却**:

```json
{
  "status": "SUCCESS" | "FAILURE" | "PARTIAL",
  "failureCategory": "A" | "B" | "C" | "D" | null,
  "nextAction": "finisher" | "executer" | "qa-retry",
  "qaTestFile": "qa-tests/story1.md",
  "testSummary": {
    "total": 17,
    "passed": 12,
    "failed": 3,
    "partial": 2,
    "passRate": "70%"
  },
  "completenessScore": {
    "verifiedAC": 12,
    "totalAC": 17,
    "score": "70%",
    "gate": "QA PASS with WARNING"
  },
  "requiredTests": {
    "unitTest": { "status": "PASS" | "FAIL" | "SKIP", "note": "" },
    "e2eTest": { "status": "PASS" | "FAIL" | "SKIP", "note": "" },
    "lint": { "status": "FAIL", "note": "10 errors found" },
    "build": { "status": "PASS", "note": "" },
    "typecheck": { "status": "PASS", "note": "" }
  },
  "designFidelity": {
    "baselineProvided": true,
    "evidencePath": "qa-tests/evidence/design-fidelity/{task-group}/",
    "verdict": "MATCH" | "MISMATCH" | "SKIP"
  },
  "findings": [
    {
      "severity": "critical",
      "description": "Lintエラー10件が検出されました",
      "recommendation": "Biomeでコードを修正してください"
    }
  ],
  "uxFindings": [
    {"id": "UX-1", "item": "エラーメッセージ位置", "result": "PASS/FAIL", "detail": "..."},
    {"id": "UX-2", "item": "再試行導線の存在", "result": "PASS/FAIL", "detail": "..."},
    {"id": "UX-3", "item": "操作後フィードバック", "result": "PASS/FAIL", "detail": "..."},
    {"id": "UX-4", "item": "ローディング状態", "result": "PASS/FAIL", "detail": "..."},
    {"id": "UX-5", "item": "empty状態UI", "result": "PASS/FAIL", "detail": "..."},
    {"id": "UX-6", "item": "フォーカス管理", "result": "PASS/FAIL", "detail": "..."}
  ]
}
```

---

## qa-tests/ディレクトリ構造

```
{spec_dir}/
└── qa-tests/
    ├── scenarios.md
    ├── story1.md
    ├── story2.md
    ├── story3.md
    └── evidence/
        ├── story1/
        ├── story2/
        ├── story3/
        └── design-fidelity/
            └── {task-group}/
                ├── baseline/*.png
                ├── actual/*.png
                └── comparison.md
```

**パス規則**: AC番号 "AC2.UI.N.001" → Story番号 2 → `qa-tests/story2.md`（AC2.UI.N.001セクション）
（形式: `AC{Story}.{カテゴリ}.{N=正常系|E=異常系}.{連番3桁}`）

---

## 品質基準

- ✅ すべての受け入れ条件をカバー
- ✅ 再現可能なテスト手順
- ✅ エビデンスの保存
- ✅ 明確な合否判定
- ✅ 失敗原因の正確な分類（A/B/C/D）

---

## 実行制約

**einja-task-exec Skillからの呼び出し**: task-qa.md（ラッパー）経由、完了報告はtask-qa.mdが生成

**独立使用**: トリガーワードで自律起動、完了報告は本Skillが生成

---

## 連携

- **前提**: `task-reviewer` - 実装内容のレビュー
- **後続**: なし（コマンド終了）
- **差し戻し先**: `task-executer` - テスト失敗時

---

## 参考資料

- `docs/einja/steering/acceptance-criteria-and-qa-guide.md` - QAテストの目的、失敗分類詳細、動作確認ツール使用法
- `templates/qa-test-template.md` - QAテストファイルテンプレート
- `references/failure-patterns.md` - 失敗分類の実践例（10パターン）
- `references/usage-patterns.md` - 利用パターン（5パターン）
- `references/troubleshooting.md` - トラブルシューティング（6ケース）

---

**最終更新**: 2026-05-02

<!-- @einja:project-private:start id="_einja-task-qa" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
