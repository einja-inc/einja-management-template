# 外部API連携時の実装前打鍵確認ルールを全エージェント・全フェーズに適用

## Context

OpenAI Realtime API（Beta→GA移行）で、specの読みが甘いまま推測でスキーマを実装した結果、format型（string→object）、modalitiesキー名、audioネスト構造など10回以上の修正が連続。毎回デプロイ→エラー→修正の不毛なループが発生した。

**目的**: 外部APIを叩くコードを書く・修正する場合、仕様策定→実装→レビュー→QAの全フェーズで打鍵確認を必須化し、全開発者・全エージェントに適用する。

## 現状

| フェーズ | ファイル | 外部API関連の既存記述 | 不足 |
|---------|---------|---------------------|------|
| 仕様策定 | `einja-issue-spec-create/SKILL.md` | なし | design.mdに打鍵確認手順を含める指示が皆無 |
| 実装 | `task-executer.md` | 1.3にAPI実装参照テーブル | 打鍵確認ルールなし |
| 実装管理 | `einja-task-exec/SKILL.md` | Step 1.5で環境変数チェック（警告のみ） | 打鍵確認フラグなし |
| レビュー | `task-reviewer.md` | セキュリティスキャンでauth/apiマーク | 外部API打鍵確認観点なし |
| レビュー | `einja-review-code/SKILL.md` | 観点Cに外部入力 | 打鍵確認済みかのチェックなし |
| QA | `task-qa.md` | API打鍵テスト禁止の一般記述 | 外部APIモックのみSUCCESS禁止が未記載 |
| QA | `_einja-task-qa/SKILL.md` | Step4にモックのみ検出 | 外部API専用の確認フローが欠落 |

※ `acceptance-criteria-and-qa-guide.md` には「モックテストのPASSは動作確認に該当しない。実APIとの通信確認が必須」が既存。

## 変更内容

### 1. `task-executer.md` — セクション4.6追加

`.claude/agents/einja/task/task-executer.md` の `4.5 形骸化実装の禁止` の直後に追加:

```markdown
#### 4.6 外部API連携時の実装前打鍵確認

**⚠️ 外部API（サードパーティサービス）を叩くコードを新規作成・修正する場合、実装前に必ず以下を実行すること**:

1. **API打鍵テスト**: curl、WebSocket接続、またはスクリプトで実際にAPIを叩き、正しいリクエスト/レスポンス形式を確認する
2. **スキーマ確認**: 公式ドキュメントやOpenAPI specを読むだけでなく、実際のレスポンスボディを目視確認する
3. **確認してから実装**: 打鍵結果に基づいてコードを書く。推測やドキュメントの斜め読みで実装しない

**適用範囲**:
- 新しい外部APIの初期実装
- 既存API連携のバージョンアップ（Beta→GA等）
- APIパラメータの追加・変更

**実装前セルフチェック**:
- [ ] APIエンドポイントにリクエストを送り、成功レスポンスを取得したか？
- [ ] レスポンスの実際の構造（フィールド名、型、ネスト）を確認したか？
- [ ] エラーレスポンスのフォーマットも確認したか？
```

### 2. `einja-task-exec/SKILL.md` — Step 1.5拡張 + Step 4プロンプト追加

**Step 1.5末尾に追記**:
```markdown
4. **外部API連携フラグ**: 以下のいずれかに該当する場合、`外部API連携あり` フラグを記録する。このフラグはStep 4でtask-executerのプロンプトに含めて渡す：
   - 環境変数スキャン（1〜2）で外部サービス用変数が検出された場合
   - タスク指示またはdesign.mdに「外部API」「サードパーティ」「webhook」「SDK」等のキーワードが含まれる場合
```

**Step 4のプロンプト項目（a〜g）に追加**:
```markdown
       h. 外部API連携フラグ（Step 1.5で検出された場合）→ 「⚠️ このタスクは外部API連携を含みます。実装前にAPI打鍵テスト（curl等）で正しいリクエスト/レスポンス形式を確認してから実装してください（task-executer 4.6参照）」
```

### 3. `einja-review-code/SKILL.md` — 観点Cにスキーマ整合性追加

観点Cテーブルの説明欄に `外部APIスキーマ整合性` を追加。観点Cに配置する理由: 外部APIのスキーマ不整合はランタイムエラー（異常系パス）を引き起こすため、セキュリティ・エラーハンドリング観点と同じレビューサイクルで検出すべき。観点Cのレビュープロンプトに以下を追加:
```
- 外部API連携コードがある場合: リクエスト/レスポンスのスキーマが公式ドキュメントと一致しているか確認。特にフィールド名、型（string vs object）、ネスト構造、必須/オプションの区別
```

### 4. `task-reviewer.md` — 外部API連携チェック観点追加

セクション「2. 要件との照合」の後に追加（※ einja-review-codeの観点Cではスキーマ整合性を見るが、こちらではdesign.md自体に打鍵手順が記載されているかの構造確認を行う。両者は補完関係）:

```markdown
### 外部API連携チェック（外部サービス連携が含まれる場合）

外部API（メール送信・決済・OAuth・SMS等）の新規実装・変更が含まれる場合：

1. **design.mdへの打鍵確認手順記載確認**: design.mdに以下が記述されているか確認
   - 使用する外部APIのサンドボックス/テスト環境情報
   - QA打鍵確認に必要な環境変数の一覧（変数名・取得方法）
   - curlコマンド例（正常系・異常系各1例）
   未記載の場合は **MAJOR** 判定（QAが動作確認不可）
2. **モック境界の確認**: 外部API呼び出しがInfrastructure層に正しく隔離されているか確認
3. **環境変数の定義確認**: 外部API認証情報が環境変数経由で注入されており、コードに直書きされていないか確認
```

MAJOR判定条件リストにも追加:
```
- 外部API連携がある場合にdesign.mdに打鍵確認手順が記載されていない
```

### 5. `task-qa.md` — 絶対禁止事項に追加

絶対禁止事項ブロックに追加:
```
- 外部API連携（メール送信・決済・OAuth等）をモックのみで確認してSUCCESSと判定（実APIへの打鍵確認が必須）
```

出力形式「テスト方法」欄に `外部API打鍵確認（実API）` を選択肢として追加。

### 6. `_einja-task-qa/SKILL.md` — 外部API打鍵確認フロー追加

※ task-reviewer（§4）とtask-qa（§6）で同じ確認を行うのは意図的な多層防御。task-reviewerはdesign.md記載の構造確認（実装前ゲート）、task-qaは実行時の打鍵確認（実装後ゲート）。

**ステップ3.5（API修正の確認ダイアログ後）に追加**:
```markdown
#### 外部API連携を含む機能の場合

外部API（サードパーティサービス）が実装に含まれる場合、以下を確認する:

- design.mdに打鍵確認手順（curlコマンド例、環境変数一覧）が記載されているか
- 環境変数が設定済みか（未設定の場合はFAILURE(D)判定の旨を警告）
- 打鍵確認の実施方法（curl / Playwright MCP / スクリプト）を決定
```

**ステップ4のモックのみテスト検出を強化**:
```markdown
#### 外部API打鍵確認（動作確認完了後に必須検証）

外部API（サードパーティサービス）が関与するACを含む場合:

1. **打鍵確認の実施確認**: 実APIに対してリクエストが送信されたか
2. **実レスポンスの確認**: モックではなく実サービスからのレスポンスであることを確認
3. **エラー系の確認**: 不正なパラメータに対して適切なエラーレスポンスが返るか確認

- 外部APIを含むACの打鍵確認が一度もない場合 → **FAILURE（failureCategory=D: 環境問題）**
```

### 8. `docs/einja/steering/development/api-development.md` — 外部API打鍵確認ルール追記

task-executer 1.3で参照されるAPI開発steering文書。現状は外部API・打鍵確認に関する記述が一切ない。以下を1〜2行追記:
```markdown
## 外部API連携時の必須事項

外部API（サードパーティサービス）を呼び出す実装を行う場合、コーディング前に必ずcurl等で実際にAPIを叩き、正しいリクエスト/レスポンス形式を確認すること。推測やドキュメントの斜め読みで実装しない。
```

### 7. `einja-issue-spec-create/SKILL.md` — design-generator/qa-generatorへの指示追加

**Phase 2+3のdesign-generator追加指示に追記**:
```markdown
- **外部API連携がある場合の必須記載事項**:
  - design.mdの「テスト設計」または「環境設定」セクションに以下を含めること：
    1. 使用する外部APIのサンドボックス/テスト環境の概要
    2. QA打鍵確認に必要な環境変数の一覧（変数名・取得方法・設定先）
    3. curlコマンド例（正常系1例・異常系1例）
  - 未記載の場合、task-reviewerがMAJOR判定する
```

**Phase 4のqa-generator追加指示に追記**:
```markdown
- **外部API連携がある場合の必須記載事項**:
  - 外部APIを呼び出すACのQAテストシナリオに「実API打鍵確認ステップ」を含めること
  - 「モックでのPASS」と「実APIでの打鍵確認」は別ステップとして分けて記載
  - 打鍵確認に必要な前提条件（環境変数、サンドボックスアカウント等）を「前提条件」欄に明記
```

## タスク概要

| ID | タスク | 対象ファイル | 依存 |
|----|--------|-------------|------|
| 0-0 | TaskCreate一括登録 | - | - |
| 0-1 | Planファイルリネーム [`Bash`] | - | - |
| 1-1 | task-executer.mdにセクション4.6追加 [`general-purpose`] | `.claude/agents/einja/task/task-executer.md` | なし |
| 1-2 | einja-task-exec Step 1.5拡張 + Step 4プロンプト追加 [`general-purpose`] | `.claude/skills/einja-task-exec/SKILL.md` | なし |
| 1-3 | einja-review-code 観点C拡張 [`general-purpose`] | `.claude/skills/einja-review-code/SKILL.md` | なし |
| 1-4 | task-reviewer 外部API連携チェック観点追加 [`general-purpose`] | `.claude/agents/einja/task/task-reviewer.md` | なし |
| 1-5 | task-qa 絶対禁止事項追加 [`general-purpose`] | `.claude/agents/einja/task/task-qa.md` | なし |
| 1-6 | _einja-task-qa 外部API打鍵確認フロー追加 [`general-purpose`] | `.claude/skills/_einja-task-qa/SKILL.md` | なし |
| 1-7 | einja-issue-spec-create design/qa-generator指示追加 [`general-purpose`] | `.claude/skills/einja-issue-spec-create/SKILL.md` | なし |
| 1-8 | api-development.md に外部API打鍵確認ルール追記 [`general-purpose`] | `docs/einja/steering/development/api-development.md` | なし |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | 全変更ファイル | 1-1〜1-7 |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | - | 99-1 |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | - | 99-G |

## 並列実行計画

- タスク1-1〜1-8は互いに独立。全8タスク並列実行可能（ファイル重複なし）

## リスク・不明点

- なし（既存セクションへの追記のみで、既存機能への影響なし）

## 検証・動作確認方法

- 各ファイルの変更箇所をgrep/readで確認
- 8ファイル全てに外部API打鍵確認関連の記述が追加されていること
- 既存セクション構造が壊れていないこと（前後のセクション番号の整合性）
