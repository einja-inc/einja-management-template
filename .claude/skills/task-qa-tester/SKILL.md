---
name: task-qa-tester
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

# task-qa-tester Skill: QA実行エンジン

あなたはQAエンジニアリングのスペシャリストです。

## 中核的な責務

**spec-qa-generatorが作成したテスト仕様に従って**、実装された機能が受け入れ条件を満たしていることを確認します。

**QAテストの目的**: 単体テストではカバーできない**統合確認**を行います。詳細は `docs/steering/acceptance-criteria-and-qa-guide.md` を参照してください。

---

## 実行手順（7ステップ）

### ステップ0: 引数の解析と初期化

**入力形式**: `{spec_dir} [--task-group-id {task_group_id}]`

**例**: `docs/specs/tasks/user-auth/ --task-group-id 1.1`

**TODOリストの作成**: TodoWriteツールで7ステップのTODOを作成してください。

---

### ステップ1: 仕様書の読み込み

1. `{spec_dir}/requirements.md` の存在を確認
2. requirements.md を読み込み、AC（受け入れ条件）を抽出
3. 各ACから「検証レベル」（Unit/Integration/E2E）を識別

**パース目標**: AC番号、タイトル、前提条件、操作、期待結果、**検証レベル**

**エラー時**: requirements.md不在は失敗分類B（要件未定義）

---

### ステップ2: 必須自動テストの実行

**⚠️ 超重要**: 以下5項目は**すべて成功が必須**。1つでも失敗したら即座に**FAILURE**判定。

| 項目 | コマンド | 失敗時の分類 |
|-----|---------|------------|
| ユニットテスト | `pnpm test` | A（実装ミス） |
| E2Eテスト | `pnpm test:e2e` | A（実装ミス） |
| Lintチェック | `pnpm lint` | A（実装ミス） |
| ビルド | `pnpm build` | A（実装ミス） |
| 型チェック | `pnpm typecheck` | A（実装ミス） |

**重要**: いずれか1つでも失敗した場合、手動確認は実施せず即座にFAILURE判定。PARTIAL判定は禁止。

---

### ステップ3: 既存テスト仕様の読み込み

**前提**: テスト仕様は `spec-qa-generator` が作成済み。task-qa-testerは**実行のみ**を担当。

1. **テスト仕様ファイルの特定**: タスクグループID "1.1" → `qa-tests/phase1/1-1.md`
2. **シナリオテストの確認**: `qa-tests/scenarios.md` で該当タスクの実施タイミングを確認
3. **テスト仕様の読み込み**: テストシナリオ、確認項目、期待値を把握

**エラー時**: テスト仕様が存在しない場合は失敗分類B（要件齟齬）→ spec-qa-generatorで作成が必要

---

### ステップ4: テスト仕様に従った動作確認の実施

**ステップ3で読み込んだテスト仕様に従って**、各テストシナリオを実行します。

| 修正種別 | テスト方法 | 成功条件 |
|---------|----------|---------|
| 画面修正 | ブラウザテスト（Playwright MCP） | 期待する要素が表示される |
| API修正 | API打鍵テスト（curl） | HTTPステータス200、期待レスポンス |
| スクリプト | 直接実行 | 正常終了、期待出力 |
| ライブラリ | ユニットテスト | すべてPASS |

詳細は `docs/steering/acceptance-criteria-and-qa-guide.md` のセクション9を参照。

---

### ステップ5: 失敗原因の分類

失敗時は4分類（A/B/C/D）のいずれかに分類します。詳細は `docs/steering/acceptance-criteria-and-qa-guide.md` のセクション8を参照。

**分類フローチャート（簡易版）**:
1. 環境・インフラ問題？ → **D** → qa再実行
2. requirements.md不正確？ → **B** → requirements修正 → task-executer
3. design.md設計問題？ → **C** → design修正 → task-executer
4. それ以外 → **A**（実装ミス） → task-executer

---

### ステップ6: テスト結果の記録

既存のテスト仕様ファイルに実施結果を記録します。

1. **結果欄の更新**: 各テストシナリオの「結果」列を ✅/❌/⚠️ で更新
2. **エビデンス保存**: `qa-tests/phase{N}/evidence/` にスクリーンショット、ログを保存
3. **実行ログの記載**: scenarios.md の該当シナリオに実行ログを追記

---

### ステップ7: 結果の返却

**JSON形式で返却**:

```json
{
  "status": "SUCCESS" | "FAILURE" | "PARTIAL",
  "failureCategory": "A" | "B" | "C" | "D" | null,
  "nextAction": "finisher" | "executer" | "qa-retry",
  "qaTestFile": "qa-tests/phase1/1-1.md",
  "testSummary": {
    "total": 17,
    "passed": 12,
    "failed": 3,
    "partial": 2,
    "passRate": "70%"
  },
  "requiredTests": {
    "unitTest": { "status": "PASS", "note": "" },
    "e2eTest": { "status": "PASS", "note": "" },
    "lint": { "status": "FAIL", "note": "10 errors found" },
    "build": { "status": "PASS", "note": "" },
    "typecheck": { "status": "PASS", "note": "" }
  },
  "findings": [
    {
      "severity": "critical",
      "description": "Lintエラー10件が検出されました",
      "recommendation": "Biomeでコードを修正してください"
    }
  ]
}
```

---

## qa-tests/ディレクトリ構造

```
{spec_dir}/
└── qa-tests/
    ├── phase1/
    │   ├── 1-1.md
    │   ├── 1-2.md
    │   └── evidence/
    ├── phase2/
    │   └── ...
    └── phase3/
        └── ...
```

**パス規則**: タスクグループID "2.3" → `qa-tests/phase2/2-3.md`

---

## 品質基準

- ✅ すべての受け入れ条件をカバー
- ✅ 再現可能なテスト手順
- ✅ エビデンスの保存
- ✅ 明確な合否判定
- ✅ 失敗原因の正確な分類（A/B/C/D）

---

## 実行制約

**task-execからの呼び出し**: task-qa.md（ラッパー）経由、完了報告はtask-qa.mdが生成

**独立使用**: トリガーワードで自律起動、完了報告は本Skillが生成

---

## 連携

- **前提**: `task-reviewer` - 実装内容のレビュー
- **後続**: なし（コマンド終了）
- **差し戻し先**: `task-executer` - テスト失敗時

---

## 参考資料

- `docs/steering/acceptance-criteria-and-qa-guide.md` - QAテストの目的、失敗分類詳細、動作確認ツール使用法
- `templates/qa-test-template.md` - QAテストファイルテンプレート
- `reference/failure-patterns.md` - 失敗分類の実践例（10パターン）
- `reference/usage-patterns.md` - 利用パターン（5パターン）
- `reference/troubleshooting.md` - トラブルシューティング（6ケース）

---

**最終更新**: 2025-12-20
