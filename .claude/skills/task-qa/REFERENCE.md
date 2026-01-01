# QA Skill リファレンスドキュメント

## 概要

このドキュメントは、task-qa Skillの技術詳細、ベストプラクティス、実装ガイドを提供します。

---

## 1. QAベストプラクティス

このセクションは `docs/steering/acceptance-criteria-and-qa-guide.md` の内容を統合したものです。

### 1.1 受け入れ基準の原則

#### Do（推奨事項）
- **振る舞い・入力・観測可能な結果をセットで書く**（Given/When/Then または 条件/操作/期待結果）
- **ビジネス価値やユーザー影響が分かる文脈を添える**（誰が何のために使うか）
- **正常系に加え、代表的な異常・境界ケースを列挙する**
- **観測手段を明示する**（API レスポンス、イベント、DB 状態など）
- **実装と無関係な用語で書く**、内部構造への言及は避ける

#### Don't（禁止事項）
- ❌ 「ファイルが存在する」「〇〇を返すクラスがある」など構造・命名のみを確認させる
- ❌ 単一の肯定文で完結させて振る舞いの条件や観測結果を書かない
- ❌ テストレベルを曖昧にし、誰がどの観点で検証するか不明瞭にする
- ❌ 期待結果を「問題ないこと」「成功すること」で済ませる
- ❌ 実装手段（特定フレームワーク、DB テーブル構造など）を強制する

#### 振る舞い駆動テンプレート
```
ACx.y: <振る舞いの名前>
- 前提: <状態/入力/役割>
- 操作: <ユーザー操作 or システムイベント>
- 期待結果: <観測可能なアウトプット>（例: HTTP ステータス/レスポンス/DB 変化/イベント）
- 検証レベル: <Unit | Integration | E2E>（複数可）
- 補足: <ビジネスルールやエッジケース>
```

### 1.2 テスト設計の原則

#### テストレベルと責務
- **単体 (Unit)**: 単一モジュールの意思決定ロジックを高速に検証。外部依存はモック化し、条件分岐とエッジケース網羅。
  - **担当**: task-executer（開発者）
  - **対象外**: task-qa Skill

- **統合 (Integration)**: 境界（Repository+DB, UseCase+Gateway, API+Middleware など）越しの契約を検証。実際のインフラ接続や本物に近いセットアップを使い、主要なハッピーパス＋代表的な異常系を確認。
  - **担当**: task-qa Skill
  - **対象**: requirements.md で「検証レベル: Integration」と記載されたAC

- **E2E**: ユーザー視点で最終価値を確認。シナリオは少数に絞り、クリティカルパスと主要なバックオフ/ロールバック挙動を検証。
  - **担当**: task-qa Skill
  - **対象**: requirements.md で「検証レベル: E2E」と記載されたAC

#### 価値あるテスト判定基準
- **仮説**: テストが守るべきビジネスルールや SLA が明文化されている
- **分離**: 振る舞い単位の原因→結果を説明できる
- **再現性**: 決定論的で、入力と期待結果から誰でも同じ結論を得られる
- **監視性**: 失敗時に「何が壊れたか」がメッセージやログから分かる
- **保守性**: 実装ディテールではなく契約・振る舞いに結び付いているため、内部構造変更で安易に壊れない
- **コスト対価**: 実行時間/セットアップコストに見合うリスク低減効果がある

### 1.3 QAテスト項目の作成方針

#### 価値あるQAテスト項目（必須）
- ✅ **振る舞いを検証する**シナリオを作成
- ✅ Given/When/Then 形式で記述
- ✅ 観測可能なアウトプット（API レスポンス、DB 状態、画面表示）を検証
- ✅ 正常系・異常系・境界ケースを含める

#### 禁止事項：構造確認のみのテスト
- ❌ ファイル・ディレクトリの存在確認のみ
- ❌ 文字列がファイルに含まれるかの確認のみ
- ❌ モジュールが import できるかの確認のみ
- ❌ 実際のビジネスロジックや動作を検証しないテスト

**重要**: 構造確認チェックは「非対象」に明記し、必要に応じてlintや型チェックに委譲する。

---

## 2. 失敗原因分類の詳細ガイド

QAテスト失敗時、以下の4分類（A/B/C/D）のいずれかに分類し、適切な戻し先を決定します。

### 2.1 分類フローチャート

```
QAテスト失敗
    ↓
質問1: 実装コードに問題があるか？
  YES → 【A: 実装ミス】 → task-executer
  NO → 質問2へ
    ↓
質問2: requirements.md の受け入れ条件が不正確・不完全か？
  YES → 【B: 要件齟齬】 → requirements.md修正 → task-executer
  NO → 質問3へ
    ↓
質問3: design.md の設計・アーキテクチャに問題があるか？
  YES → 【C: 設計不備】 → design.md修正 → task-executer
  NO → 質問4へ
    ↓
質問4: 環境・インフラ・テストツールに問題があるか？
  YES → 【D: 環境問題】 → qa再実行
  NO → デフォルトで【A: 実装ミス】として扱う
```

### 2.2 各分類の詳細

#### A: 実装ミス
**定義**: コードの論理エラー、バグ、実装漏れ

**判定基準**:
- TypeScriptエラー、ランタイムエラーが発生
- ロジックが期待通り動作しない
- バリデーション・エラーハンドリングの実装漏れ
- 単体テストが失敗している
- API レスポンスが仕様と異なる

**例**:
- ユニットテスト失敗: `TypeError: Cannot read property 'token' of undefined`
- 認証トークン検証ロジックの条件分岐ミス
- メールアドレスのバリデーション未実装
- DB クエリ結果の null チェック漏れ

**戻し先**: task-executer（実装修正）

#### B: 要件齟齬
**定義**: requirements.md の受け入れ条件が実際の要求と異なる、または不明確

**判定基準**:
- 実装は正しいが、要件定義が間違っている
- ACの期待結果が曖昧で複数の解釈が可能
- ビジネスルールが requirements.md に記載されていない
- ステークホルダーの要求と AC が一致しない

**例**:
- requirements.md: 「エラーを返す」→ 実際の要求: 「400エラーと詳細メッセージを返す」
- ACに記載されていない境界ケース（例: トークン長さ制限）
- 複数AC間での矛盾（AC1.2で「即座削除」、AC1.3で「バッチ削除」）

**戻し先**: requirements.md修正 → task-executer

#### C: 設計不備
**定義**: design.md のアーキテクチャ・設計方針に問題がある

**判定基準**:
- トランザクション管理の設計が不適切
- データモデル・スキーマ設計に不具合
- アーキテクチャパターンの選択ミス（例: 同期処理 vs 非同期処理）
- インターフェース設計の不備

**例**:
- セッション管理でトランザクションが設計されておらず、競合状態が発生
- ユーザーテーブルのインデックス設計が不適切でパフォーマンス劣化
- リポジトリ層のインターフェースが要件を満たさない

**戻し先**: design.md修正 → task-executer

#### D: 環境問題
**定義**: テスト環境、インフラ、ツールの問題

**判定基準**:
- データベース接続エラー
- Playwright MCP の接続失敗
- タイムアウト（ネットワーク遅延）
- テストデータの初期化失敗
- Docker コンテナの起動失敗

**例**:
- PostgreSQL コンテナが起動していない
- Playwright のブラウザ起動タイムアウト
- テスト用DB のマイグレーション未実行
- ポート競合（5432番が既に使用されている）

**戻し先**: 環境を修復してqa再実行

### 2.3 判定の優先順位

複数の分類に該当する可能性がある場合、以下の優先順位で判定：

1. **D（環境問題）**: エラーメッセージが明確に環境起因の場合は最優先で判定
2. **B（要件齟齬）**: requirements.md の記載が不正確・不完全な場合
3. **C（設計不備）**: design.md のアーキテクチャに問題がある場合
4. **A（実装ミス）**: デフォルト（不明な場合は実装ミスとして扱う）

### 2.4 実践例：10パターン

#### 例1: トークン検証エラー
**症状**: `TypeError: Cannot read property 'token' of undefined`

**分析**:
- 質問1: 実装コードに問題があるか？ → YES（nullチェック漏れ）

**判定**: **A: 実装ミス**
**戻し先**: task-executer

---

#### 例2: バリデーションエラーメッセージ不一致
**症状**: requirements.md「400エラーを返す」、実装「422エラーを返す」

**分析**:
- 質問1: 実装コードに問題があるか？ → NO（実装は正しい）
- 質問2: requirements.md が不正確か？ → YES（ステータスコードが不明確）

**判定**: **B: 要件齟齬**
**戻し先**: requirements.md修正 → task-executer

---

#### 例3: トランザクション未実装
**症状**: 「競合状態で整合性が保証されない」

**分析**:
- 質問1: 実装コードに問題があるか？ → NO（実装は設計通り）
- 質問2: requirements.md が不正確か？ → NO（要件には問題なし）
- 質問3: design.md のアーキテクチャに問題があるか？ → YES（トランザクション設計が欠如）

**判定**: **C: 設計不備**
**戻し先**: design.md修正 → task-executer

---

#### 例4: PostgreSQL接続エラー
**症状**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**分析**:
- 質問1-3: すべてNO
- 質問4: 環境に問題があるか？ → YES（PostgreSQLコンテナ未起動）

**判定**: **D: 環境問題**
**戻し先**: qa再実行（環境修復後）

---

#### 例5: ユニットテスト失敗
**症状**: `pnpm test` で5件のテストが失敗

**分析**:
- 質問1: 実装コードに問題があるか？ → YES（テスト失敗は実装ミス）

**判定**: **A: 実装ミス**
**戻し先**: task-executer

---

#### 例6: Lintエラー
**症状**: `pnpm lint` で Biome エラー10件

**分析**:
- 質問1: 実装コードに問題があるか？ → YES（コーディング規約違反）

**判定**: **A: 実装ミス**
**戻し先**: task-executer

---

#### 例7: Playwright MCP タイムアウト
**症状**: `Timeout 30000ms exceeded`（ネットワーク遅延）

**分析**:
- 質問1-3: すべてNO
- 質問4: 環境に問題があるか？ → YES（ネットワーク一時的な遅延）

**判定**: **D: 環境問題**
**戻し先**: qa再実行

---

#### 例8: ビルドエラー
**症状**: `pnpm build` で TypeScript エラー

**分析**:
- 質問1: 実装コードに問題があるか？ → YES（型エラー）

**判定**: **A: 実装ミス**
**戻し先**: task-executer

---

#### 例9: AC間の矛盾
**症状**: AC1.2「即座削除」vs AC1.3「バッチ削除」の矛盾

**分析**:
- 質問1: 実装コードに問題があるか？ → NO
- 質問2: requirements.md が不正確か？ → YES（AC間の矛盾）

**判定**: **B: 要件齟齬**
**戻し先**: requirements.md修正 → task-executer

---

#### 例10: DBスキーマ設計ミス
**症状**: 「ユーザーテーブルのインデックスが不適切でパフォーマンス劣化」

**分析**:
- 質問1: 実装コードに問題があるか？ → NO（実装は設計通り）
- 質問2: requirements.md が不正確か？ → NO
- 質問3: design.md のアーキテクチャに問題があるか？ → YES（スキーマ設計ミス）

**判定**: **C: 設計不備**
**戻し先**: design.md修正 → task-executer

---

## 3. qa-tests/ディレクトリ構造とパス規則

### 3.1 ディレクトリ構造

```
{spec_dir}/
└── qa-tests/
    ├── phase1/
    │   ├── 1-1.md           # フェーズ1、グループ1
    │   ├── 1-2.md           # フェーズ1、グループ2
    │   └── evidence/
    │       ├── 1-1-1-migration.log
    │       └── 1-1-2-error.png
    ├── phase2/
    │   ├── 2-1.md
    │   ├── 2-2.md
    │   └── evidence/
    └── phase3/
        └── 3-1.md
```

### 3.2 パス規則

#### 仕様書ディレクトリパス
```
{spec_dir} = docs/specs/tasks/{task_name}/
または
{spec_dir} = docs/specs/issues/{issue_name}/
```

#### QAテストファイルパス
```
{qa_test_file} = {spec_dir}/qa-tests/phase{phase_num}/{phase_num}-{group_num}.md
```

#### タスクグループIDからの変換ロジック
```typescript
// タスクグループID例: "1.1", "2.3", "3.1"
const [phaseNum, groupNum] = taskGroupId.split(".");

// QAテストファイルパス生成
const qaTestFile = `${specDir}/qa-tests/phase${phaseNum}/${phaseNum}-${groupNum}.md`;

// 例:
// taskGroupId = "1.1" → qa-tests/phase1/1-1.md
// taskGroupId = "2.3" → qa-tests/phase2/2-3.md
```

#### エビデンスファイルパス
```
{evidence_file} = {spec_dir}/qa-tests/phase{phase_num}/evidence/{phase_num}-{group_num}-{evidence_id}.{ext}
```

### 3.3 ファイル初回作成 vs 更新の判定

```typescript
// QAテストファイルの存在確認
if (fs.existsSync(qaTestFile)) {
  // 2回目以降: 「実施結果」セクションのみを更新
  updateQaTestResultSection(qaTestFile, testResults);
} else {
  // 初回: テンプレートを使用して全体を作成
  createQaTestFromTemplate(qaTestFile, taskGroupId, acs);
}
```

---

## 4. 使用例：5パターン

### パターン1: task-execからの呼び出し（既存ワークフロー）

**シナリオ**: ユーザーが `task-exec #123 1.1` を実行

```
ユーザー: task-exec #123 1.1
    ↓
task-exec → starter → executer → reviewer → qa
                                              ↓
                                    .claude/agents/task/task-qa.md（薄いラッパー）
                                              ↓
                                    Skill("task-qa", args: "...")
                                              ↓
                                    .claude/skills/task-qa/SKILL.md
                                              ↓
                                    - 必須自動テスト実行
                                    - AC抽出（Integration/E2E）
                                    - 動作確認（Playwright MCP/curl）
                                    - 失敗原因分類（A/B/C/D）
                                    - qa-tests/記録
                                              ↓
                                    結果JSON返却
                                              ↓
                                    task-qa.md が完了報告生成
                                              ↓
                                    task-exec が次のステップ決定
                                      - SUCCESS → finisher
                                      - FAILURE → 分類に応じた戻し先
```

**重要**: 既存フォーマット（`## 🧪 品質保証フェーズ完了`）を100%維持

---

### パターン2: 独立使用（Model-Invoked）

**シナリオ**: ユーザーが自然言語で「QAを実行して」と指示

```
ユーザー: "docs/specs/tasks/user-auth/ のQAを実行して"
    ↓
Claude: トリガーワード「QA」「実行」を検出
    ↓
.claude/skills/task-qa/ を自動起動
    ↓
- 仕様書パス: docs/specs/tasks/user-auth/
- requirements.md読み込み
- Integration/E2E AC抽出
- 必須自動テスト実行
- 動作確認
- qa-tests/phase1/1-1.md 作成・更新
    ↓
QA実行結果を報告
    ↓
ユーザーに結果サマリーを表示
```

**トリガーワード**:
- "QAを実行"
- "品質保証を実施"
- "テストを確認"
- "動作確認して"

---

### パターン3: CLI明示的呼び出し（仮想）

**注意**: 現時点ではSkillの直接CLI呼び出しは未サポート。将来的な拡張機能。

```bash
# 仮想コマンド（将来的な実装）
claude skill task-qa --spec-dir docs/specs/tasks/user-auth/
```

---

### パターン4: CI/CD統合

**シナリオ**: GitHub Actionsで自動QA実行

```yaml
# .github/workflows/qa.yml
name: QA Tests
on: [pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run QA Tests
        run: |
          # task-qa Skill を明示的に呼び出し（将来的な実装）
          claude skill task-qa --spec-dir docs/specs/tasks/${{ github.event.pull_request.head.ref }}/
```

---

### パターン5: 手動QAレビュー

**シナリオ**: QAエンジニアが手動でQA結果をレビュー

```
QAエンジニア: "タスク1.1のQA結果を見せて"
    ↓
Claude: qa-tests/phase1/1-1.md を読み込み
    ↓
QA結果サマリーを表示
    ↓
QAエンジニア: "失敗したテストの詳細を教えて"
    ↓
Claude: 失敗したテストケースの詳細を抽出・説明
```

---

## 5. トラブルシューティング

### 5.1 Playwright MCP 接続失敗

**症状**:
```
Error: Failed to connect to Playwright MCP server
```

**原因**:
- Playwright MCPサーバーが起動していない
- ポート競合
- MCP設定ファイルの誤り

**対処法**:
```bash
# 1. MCPサーバーステータス確認
claude mcp status

# 2. MCPサーバー再起動
claude mcp restart playwright

# 3. ポート確認（デフォルト: 3000）
lsof -i :3000
```

---

### 5.2 requirements.md 不在

**症状**:
```
Error: requirements.md not found in {spec_dir}/
```

**原因**:
- 仕様書ディレクトリパスが間違っている
- requirements.md がまだ作成されていない

**対処法**:
```bash
# 1. 仕様書ディレクトリ確認
ls -la {spec_dir}/

# 2. requirements.md が存在しない場合は作成
# spec-requirements-generator エージェントを使用
```

**失敗分類**: **D: 環境問題**（仕様書不在）または **B: 要件齟齬**（要件未定義）

---

### 5.3 qa-tests/ 書き込み権限エラー

**症状**:
```
Error: EACCES: permission denied, open '{spec_dir}/qa-tests/phase1/1-1.md'
```

**原因**:
- ディレクトリの書き込み権限がない
- ファイルが読み取り専用

**対処法**:
```bash
# 1. ディレクトリ権限確認
ls -la {spec_dir}/qa-tests/

# 2. 権限変更
chmod -R u+w {spec_dir}/qa-tests/

# 3. qa-tests/ ディレクトリが存在しない場合は作成
mkdir -p {spec_dir}/qa-tests/phase{phase_num}/evidence/
```

---

### 5.4 必須自動テストの失敗

**症状**:
```
pnpm test: 5 tests failed
pnpm lint: 10 errors
```

**判定**: **必ずFAILURE**として扱う

**対処法**:
- 失敗原因を分類（A/B/C/D）
- 適切な戻し先に差し戻し
- **PARTIAL判定は禁止**（テスト失敗は必ずFAILURE）

---

### 5.5 タイムアウト問題

**症状**:
```
Timeout 30000ms exceeded
```

**原因**:
- ネットワーク遅延
- 重い処理（大量データのDB操作）
- Playwright のページ読み込みタイムアウト

**対処法**:
```typescript
// Playwright タイムアウト延長
await page.goto(url, { timeout: 60000 }); // 60秒

// waitFor タイムアウト延長
await page.waitForSelector(selector, { timeout: 60000 });
```

**失敗分類**: 状況に応じて **D: 環境問題**（一時的な遅延）または **C: 設計不備**（パフォーマンス設計ミス）

---

### 5.6 AC抽出エラー

**症状**:
```
Warning: No Integration or E2E acceptance criteria found in requirements.md
```

**原因**:
- requirements.md に「検証レベル: Integration」または「検証レベル: E2E」の記載がない
- Unit ACのみが定義されている

**対処法**:
1. requirements.md を確認
2. Integration/E2E ACが本当に不要か判断
3. 必要な場合は **B: 要件齟齬**として差し戻し

---

## 6. JSON出力フォーマット

task-qa Skillは、実行完了時に以下のJSON形式で結果を返却します。

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

## 7. まとめ

このリファレンスドキュメントは、task-qa Skillの実装者・利用者が参照すべき技術詳細を網羅しています。

**主要なポイント**:
- ✅ 価値あるQAテスト（振る舞い検証、構造確認禁止）
- ✅ 失敗原因分類（A/B/C/D）の厳密な判定
- ✅ qa-tests/ディレクトリ構造の一貫性
- ✅ 5パターンの使用例（task-exec、独立使用、CI/CD等）
- ✅ トラブルシューティングの実践的なガイド

**更新履歴**:
- 2025-12-20: 初版作成（QA Skill migration計画に基づく）
