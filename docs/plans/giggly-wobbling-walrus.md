# デザイン忠実性パイプライン: ui-design.pen → 実装 → レビューの断絶修正

## Context

Issue #133（drlove_demo_app）のDualCharacterDisplay実装で、ui-design.penに精密に定義されたデザイン仕様（ターンテーブル演出、左右固定配置、opacity:0.35、会話中バッジ、スワイプ切替ヒント）がworkerに完全に無視された。原因は`ui-design.pen`の情報が実装フェーズに届かないアーキテクチャ上の断絶。

前回Plan（`20260315-tasks-generator-improvement.plan.md`）で`対応UIデザイン`メタデータフィールドは追加済みだが、**下流（task-exec → worker → reviewer）でこのフィールドが活用されていない**。

```
仕様書作成 (issue-spec-create)          実装 (task-exec)
┌─────────────────────────┐          ┌──────────────────────────┐
│ ui-design.pen ───────────── ✗ ───→ │ 参照されない             │
│ 対応UIデザインメタデータ ── ✗ ───→ │ パースされない           │
│ design.md ───────────────────────→ │ テキストのみ読込         │
└─────────────────────────┘          └──────────────────────────┘
```

## 現状

### 断絶ポイント（5箇所）

| # | 場所 | 現状 | 影響 |
|---|------|------|------|
| 1 | `_einja-issue-spec-tasks-generator` | `[design-engineer]`がUIタスクに自動付与されない | workerがPencil MCPなしで実装 |
| 2 | `einja-task-exec/SKILL.md` Step 2 | `対応UIデザイン`メタデータをパースしない。`ui-design.pen`パスをworkerに渡さない | workerがデザイン存在を知らない |
| 3 | `einja-task-exec/SKILL.md` Step 4 | UIタスクでも`task-executer`に委託（`design-engineer`ルーティングなし） | Pencil MCPなしのworkerがUI実装 |
| 4 | `task-reviewer.md` | デザイン忠実性チェックなし | 乖離がレビューで検出されない |
| 5 | `einja-review-code/SKILL.md` | デザイン忠実性観点（H）なし | コードレビューでも検出されない |

### 既存リソース（再利用可能）

- `対応UIデザイン`メタデータフォーマット: 前回Planで定義済み（`ui-design.pen「フレーム名」`形式）
- `design-engineer`エージェント: Pencil MCPツール保持済み
- `task-exec` Step 4の`実行サブエージェント`ルーティング: 既存メカニズム
- `einja-review-code`の観点自動ピック機構: 条件追加で拡張可能

### 対象外スコープ

- **`einja-issue-team-exec`経路**: 同様の断絶が存在するが、内部でtask-execを呼び出すため、task-execの修正（Fix 1）が自動的に適用される。team-exec固有の修正は不要

## 変更内容

### 多層防御の設計意図

| 層 | Fix | タイミング | 役割 |
|----|-----|-----------|------|
| 第1防衛線（上流） | Fix 2 | タスク生成時 | tasks-generatorが`[design-engineer]`を自動付与 |
| 第2防衛線（中流） | Fix 1 | タスク実行時 | task-execが`対応UIデザイン`をパースし、未指定ならdesign-engineerにフォールバック |
| 第3防衛線（実装） | Fix 3 | 実装完了時 | design-engineerがPencil MCPでデザインとコードを自己照合 |
| 第4防衛線（レビュー） | Fix 4 | レビュー時 | task-reviewerがデザイン要点サマリとコードを照合 |

Fix 2が正しく動作すればFix 1のフォールバックは発動しない。Fix 1はtasks-generatorが付け忘れた場合の安全網。

### Fix 1: task-exec に`対応UIデザイン`パース + design-engineer自動ルーティング追加（Gap 2+3）

**ファイル**: `.claude/skills/einja-task-exec/SKILL.md`

**Step 1（メタデータ抽出）に追加**:
- `対応UIデザイン`を抽出対象メタデータに追加

**Step 2（spec読み込み）に追加**:
- specディレクトリに`ui-design.pen`が存在するか確認 → パス記録
- 各タスクの`対応UIデザイン`メタデータからフレーム名を記録

**Step 4（worker起動）に追加**:
- **自動ルーティングルール**: 以下の条件をすべて満たす場合、`design-engineer`に自動委託
  1. `対応UIデザイン`メタデータが存在する
  2. `実行サブエージェント`が未指定
  3. タスク名にUI実装を示すキーワードが含まれる（コンポーネント、画面、レイアウト、スタイル等）
- **除外条件**: タスク名がAPI・DB・バッチ・マイグレーション等のバックエンド中心キーワードのみの場合はルーティングしない（`対応UIデザイン`はタスクグループから継承される場合があるため）
- workerプロンプトにUIデザイン参照セクション追加:
  ```
  ## UIデザイン参照
  ui-design.penパス: {specパス}/ui-design.pen
  対応フレーム: {フレーム名リスト}
  ※ Pencil MCPでui-design.penを開き、指定フレームのデザインに忠実に実装すること
  ※ 実装完了前に、Pencil MCPでデザインのノード構造を取得し、コード上の値（カラー、サイズ、opacity、gap等）と照合すること
  ```

### Fix 2: tasks-generator に`[design-engineer]`自動割り当てルール追加（Gap 1）

**ファイル**:
- `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md`
- `.claude/agents/einja/issue-specs/tasks-generator.md`

**追加ルール**:
- `対応UIデザイン`を付与するタスクには`実行サブエージェント: [design-engineer]`を自動設定（明示的な別指定がない限り）
- サブエージェント推奨表に「ui-design.pen参照あり → `[design-engineer]`（自動割り当て対象）」を明記
- **注意**: `対応UIデザイン`はタスクグループレベルとタスクレベルの両方で指定可能。グループレベルで指定した場合、配下の全UIタスクに`[design-engineer]`が継承される。ただしバックエンド専用タスクには個別に異なるサブエージェントを指定すること

### Fix 3: design-engineer に自己検証ステップ追加（Gap 4 — shift-left）

**ファイル**: `.claude/agents/einja/design-engineer.md`

**実装完了前の必須ステップとして追加**:
1. Pencil MCP `batch_get`で`ui-design.pen`の対応フレームのノード構造を取得
2. 実装コードの主要値（カラー、サイズ、opacity、gap、レイアウト方向等）とPencilノードのプロパティを照合
3. 乖離がある場合は修正してから完了報告
4. **完了報告に「デザイン要点サマリ」を含める**: Pencilから抽出した主要プロパティ一覧（レイアウト方向、カラー値、サイズ、opacity、gap等）をテキストで記載 → task-reviewerが後続の照合に使用

※ Playwright MCPによるスクリーンショット比較は行わない（design-engineerのtools定義にPlaywrightがないため）。コードレベルの値照合で十分な精度を確保。

### Fix 4: task-reviewer にデザイン忠実性チェック追加（Gap 4 — 後方検証）

**ファイル**: `.claude/agents/einja/task/task-reviewer.md`

**「2. 要件との照合」の後に「2.5. デザイン忠実性チェック」追加**:
- 条件: design-engineerからの完了報告に「デザイン要点サマリ」が含まれている場合のみ
- **Pencil MCP不要** — design-engineerが完了報告で出力したデザイン要点テキストと実装コードを照合
- 照合対象: レイアウト構造、カラー値、スペーシング、opacity、インタラクション
- 判定: MAJOR（重大乖離）/ MINOR（軽微差異）/ PASS
- デザイン要点サマリが含まれていない場合（task-executerが実行した場合）: 「デザイン忠実性チェック: SKIP（design-engineer未使用）」と記録し、警告として出力

### Fix 5: review-code に観点H「デザイン忠実性」追加（Gap 5）

**ファイル**: `.claude/skills/einja-review-code/SKILL.md`

**観点テーブルに追加**:

| ID | 観点名 | 対象 | ピック条件 |
|----|--------|------|-----------|
| H | デザイン忠実性 | レイアウト、カラー、スペーシング、インタラクションの仕様一致 | 変更ファイルに.tsx/.jsx/.css含む AND specにui-design.pen存在 |

**観点Hレビュアーの入力**:
- design.mdのUI仕様セクション（テキスト照合）
- task-reviewer経由で渡されるデザイン要点サマリ（design-engineerが出力した場合）
- 両方を入力として、実装コードとの照合を実施

**Pencil MCP未起動時・デザイン要点サマリなし時**:
- design.mdテキストのみで照合（精度は落ちるが、最低限の検出機能）
- レビュー結果に「⚠️ デザイン要点サマリなし: design.mdテキストのみで照合。精度が限定的」と警告を付記

## タスク概要

| ID | タスク | 依存 | 使用Skill/サブエージェント |
|----|--------|------|--------------------------|
| 0-0 | TaskCreate一括登録 | - | - |
| 0-1 | Planファイルを`docs/plans/202603/20260316-design-fidelity-pipeline.plan.md`にリネーム | 0-0 | [Bash] |
| 0-2 | worktree作成 | 0-1 | [_einja-worktree-guide] |
| 1-1 | task-exec: `対応UIデザイン`パース + design-engineer自動ルーティング + UIデザイン参照プロンプト | 0-2 | [general-purpose] |
| 1-2 | tasks-generator: `[design-engineer]`自動割り当てルール | 0-2 | [general-purpose] |
| 1-3 | design-engineer: 自己検証ステップ + デザイン要点サマリ出力 | 0-2 | [general-purpose] |
| 2-1 | task-reviewer: デザイン忠実性チェック追加 | 1-3 | [general-purpose] |
| 2-2 | review-code: 観点H追加（デザイン要点サマリ入力対応含む） | 1-3 | [general-purpose] |
| 99-1 | 観点別並列コードレビュー | 1-1,1-2,1-3,2-1,2-2 | [einja-review-code] |
| 99-2 | 動作確認（Skill構文・参照整合性チェック） | 99-1 | [Bash] |
| 99-G | コミット承認ゲート | 99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

## 並列実行計画

```
Phase 0: 0-0 → 0-1 → 0-2（順次）
Phase 1: 1-1 ‖ 1-2 ‖ 1-3（並列）← 3ファイルすべて独立
Phase 2: 2-1 ‖ 2-2（並列）← 1-3完了後。reviewer と review-code は独立
Phase 3: 99-1 → 99-2 → 99-G → 99-3（順次）
```

**依存関係の根拠**:
- 1-1（task-exec）、1-2（tasks-generator）、1-3（design-engineer）は変更対象ファイルが異なるため並列可能
- 2-1（task-reviewer）と2-2（review-code）は1-3（design-engineerの出力仕様）に依存 — デザイン要点サマリのフォーマットが確定しないと入力仕様が書けない

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| design-engineerへの自動ルーティングでトークンコスト増 | 中 | `対応UIデザイン`メタデータ存在 + UI実装キーワード一致時のみ。除外条件（バックエンド中心タスク）で誤ルーティング防止 |
| Pencil MCP未起動時のフォールバック | 中 | design-engineerはdesign.mdテキスト仕様にフォールバック。task-reviewer/review-codeでは「精度限定的」の警告を付記 |
| デザイン要点サマリの精度 | 低 | Pencil MCP batch_getのノード構造は具体的な値（カラーコード、px値等）を含むため十分な精度 |
| 既存Issueタスクとの後方互換性 | なし | `対応UIデザイン`未指定タスクは従来通りtask-executer経由。デザイン忠実性チェックもSKIP |

## 検証・動作確認方法

1. **構文チェック**: 変更後の全Skillファイル・エージェント定義がMarkdown構文エラーなく記述されていることを確認
2. **参照整合性**: 以下のキーワードがパイプライン全体で一貫していることをgrep確認
   - `対応UIデザイン`（task-exec、tasks-generator、design-engineer、task-reviewer）
   - `デザイン要点サマリ`（design-engineer出力 → task-reviewer入力 → review-code入力）
   - `ui-design.pen`（パス参照の一貫性）
3. **回帰チェック**: 既存の`実行サブエージェント`ルーティング（明示指定済みタスク）が影響を受けないことを確認
4. **想定シナリオ検証**:
   - シナリオA: `対応UIデザイン`あり + `実行サブエージェント`未指定 → design-engineerルーティング ✓
   - シナリオB: `対応UIデザイン`あり + `実行サブエージェント: [frontend-coder]`指定 → frontend-coderルーティング（明示指定優先）✓
   - シナリオC: `対応UIデザイン`なし → 従来通りtask-executerルーティング ✓
   - シナリオD: `対応UIデザイン`あり + タスク名が「APIエンドポイント実装」→ 除外条件によりtask-executerルーティング ✓
