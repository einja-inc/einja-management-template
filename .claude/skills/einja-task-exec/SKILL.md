---
name: einja-task-exec
description: "タスク実行 Skill"
---

# タスク実行 Skill

## 役割

指定されたタスクグループの実装を管理し、QA合格まで自動的にループ実行する。

## 入力の解析

$ARGUMENTSから以下を解析：
- **Issue番号**（必須、例: `#123`、`123`）
- **タスクグループ番号**（必須、例: `1.1`、`2.3`）

どちらかが欠けている場合はユーザーに要求する。

解析した値は、各サブエージェント呼び出し時のpromptに含めて渡す。

## サブエージェント出力の表示ルール

サブエージェントの出力表示は、**CLAUDE.mdの「サブエージェント結果報告のルール」セクションに従うこと**。

### 要点
- Taskツールから返却されたメッセージを**そのまま全文出力**する
- 出力後、次のフェーズへの移行メッセージを追加する
- 省略・要約・言い換えは**禁止**

## 処理フロー

### タスク種別の判定

タスクグループ番号の先頭（Phase番号）に基づいて処理を分岐：

| Phase番号 | 判定 | 処理フロー |
|-----------|------|-----------|
| 1〜98 | 通常タスク | Issueパース → spec読込 → TaskCreate登録 → 並列実行 → task-reviewer → task-qa → einja-task-commit Skill |
| 99 | ドキュメント反映タスク | docs-updater → einja-task-commit Skill |

### 通常タスクのフロー（Phase 1〜98）

```
┌──────────────────────────────────────────────────────────────┐
│                       品質保証ループ                          │
│                                                              │
│  Step 1: Issueパース（UIタスク判定含む）                      │
│  Step 1.5: 環境前提条件チェック                              │
│  Step 2: specパス特定 + AC抽出 + UIデザインフィールドパース   │
│  Step 2.5: UI design context load（UIタスクのみ）            │
│            Pencil MCP batch_get → get_screenshot             │
│            → baseline.png + manifest.json 生成               │
│  Step 3: TaskCreate登録                                      │
│       ↓                                                      │
│  Step 4: 依存関係ベース並列実行:                              │
│       task-executer × N（独立タスク並列）                    │
│       ↓ 全タスク完了                                         │
│  Step 5: task-reviewer（コードレビュー）                      │
│       ↓ PASS/MINOR                                           │
│  Step 5.5: task-design-reviewer（UIタスクのみ・直列）         │
│       ↑ FAIL → Step 4 に差し戻し                             │
│       ↓ PASS/CONDITIONAL                                     │
│  Step 6: task-qa（品質保証）                                  │
│       ↑ テスト失敗 → Step 4 に差し戻し                       │
│       ↓ 全テスト合格                                         │
│  Step 6.5: 技術的受け入れゲート（自動判定）                   │
│       ↑ ゲートFAIL → Step 4 に差し戻し                       │
│       ↓ ゲートPASS                                           │
│  ┌─────────────────────────────────────────────┐            │
│  │ Step 7: einja-task-commit Skill              │            │
│  │ （コミット・プッシュ）                        │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                           │
                           ↓ コミット完了
                   実行モード判定
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
    issue-exec経由              スタンドアロン実行
    （Director配下）            （直接Skill呼び出し）
              │                         │
              ↓                         ↓
    Director承認待ちループ       追加指示待ち状態
    （awaiting_review）                 │
              │                ┌────────┴────────┐
              ↓                ↓                 ↓
    directorVerdict確認    ユーザーが追加指示  ユーザーが「終了」
    ├─ approved → 正常終了     │                 │
    ├─ fix_required → 修正     ↓                 ↓
    │    → 再度awaiting_review task-modification  コマンド終了
    └─ rejected → 失敗終了     -analyzer
                               │
                               ↓ 承諾後
                        推奨パターンで実行
                               │
                               └──→ 追加指示待ち状態に戻る
```

### Phase 99 タスクのフロー（ドキュメント反映）

```
┌─────────────────────────────────────────────────────────┐
│               ドキュメント反映フロー                       │
│                                                         │
│  docs-updater（タスク仕様書をfeature/steering仕様書に反映）│
│       │                                                 │
│       ↓ 反映完了                                        │
│  ┌─────────────────────────────────────────────┐       │
│  │ einja-task-commit Skill（コミット・プッシュ） │       │
│  │ ※ 確認なしで自動実行                         │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓ コミット完了
                       コマンド終了
```

**Phase 99 の特徴**:
- task-executer、task-reviewer、task-qa をスキップ
- docs-updater エージェントを直接呼び出し
- 追加指示待ち状態なし（完了後は即座に終了）

各フェーズ完了後、サブエージェントの出力を表示したら即座に次のフェーズへ進む。ユーザーの応答は待たない。

### Step 0: 入力解析

$ARGUMENTSからIssue番号とタスクグループ番号を解析する（現行通り）。

### Step 1: Issueフェッチ + タスク解析

1. `gh issue view {issue番号} --json body,title` でIssue本文を取得
2. 指定タスクグループ（X.Y）配下のタスク（X.Y.Z）をパース
3. 各タスクのメタデータを抽出:
   - タスク名
   - 要件（Story番号）
   - 依存関係（なし / X.Y.Z形式）
   - 完了条件
   - 対応設計セクション名
   - シナリオテスト
   - 実行サブエージェント（任意、タスクグループレベルまたはタスクレベル）
   - 使用Skill（任意、タスクグループレベルまたはタスクレベル）
   - **対応UIデザイン**（任意、タスクグループレベルまたはタスクレベル）: `ui-design.pen` のパスとフレーム名

**UIタスク判定**（Step 1完了後に実施）:

以下のいずれかに該当する場合、そのタスクグループを **UIタスク** としてフラグを立てる:

- タスクグループまたは配下タスクのメタデータに「対応UIデザイン」フィールドが存在する
- 変更予定ファイル（タスクの「完了条件」や設計セクションから推定）に `*.tsx` / `*.css` / `*.scss` が含まれる

UIタスクフラグは Step 2.5・Step 5.5・TaskCreate の description に反映する。

**実行サブエージェント・使用Skillの継承ルール**:
- タスクグループレベルで指定されている場合 → 配下タスクに継承
- タスクレベルで指定されている場合 → タスクグループレベルの値をオーバーライド
- 両方省略 → task-executerがデフォルトで処理

### Step 1.5: 環境前提条件チェック（警告）

タスクグループが外部API/サービスに依存する場合、QAフェーズで動作確認が失敗するリスクを事前に警告する。

1. **環境変数の特定**: タスクグループの実装対象コード内で `process.env.` を検索し、外部サービス用の環境変数（例: `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` 等）を特定
2. **設定状況の確認**: `.env` / `.env.local` を確認し、未設定の環境変数があれば警告を出力:
   - `⚠️ 環境変数 XXX が未設定です。QAフェーズで動作確認がFAILURE（環境問題）になる可能性があります`
3. **実装はブロックしない**: このステップは警告のみ。必須チェックはQA（task-qa）のステップ4冒頭で行う
4. **外部API連携フラグ**: 以下のいずれかに該当する場合、`外部API連携あり` フラグを記録する。このフラグはStep 4でtask-executerのプロンプトに含めて渡す：
   - 環境変数スキャン（1〜2）で外部サービス用変数が検出された場合
   - タスク指示またはdesign.mdに「外部API」「サードパーティ」「webhook」「SDK」等のキーワードが含まれる場合

### Step 2: spec読み込み + AC抽出（「対応UIデザイン」フィールドのパース含む）

**目的**: task-executerから spec/Issue 読み込み責務を移管し、親が一括で行う。

1. **specディレクトリを探索**: `docs/specs/issues/*/issue{N}-*/` パターンで検索
2. **存在チェック**:
   - 完全なspec（requirements.md + design.md + qa-tests/） → 次へ
   - 部分的spec → エラー終了（`einja-issue-spec-create` Skill の実行を案内）
   - specなし → `_einja-general-context-loader` Skill を呼び出してコンテキスト収集
3. **requirements.md を読み込み**、各タスクのメタデータ（`**要件**: Story X`）に基づいてACを抽出
   - ACはGiven/When/Then形式で小さい（~50-100トークン/AC）ので直接保持
4. **design.md はパスのみ特定**（内容は読み込まない）
   - 各タスクの`**対応設計**: design.md「セクション名」`からセクション名を記録
5. **「対応UIデザイン」フィールドのパース**（UIタスクの場合）:
   - `**対応UIデザイン**: ui-design.pen「フレーム名」` 形式で記述されているフィールドをパース（例: `ui-design.pen「dashboard--empty-state」`）
   - specディレクトリ配下の `ui-design.pen` のパスとフレーム名（`「」`で囲まれた部分）を抽出して保持
   - この情報は Step 2.5・Step 5.5 および task-executer への渡し情報に使用する

   **複数フレーム縮退ルール**（1つのタスクの「対応UIデザイン」フィールドに複数フレームが指定されている場合）:

   > **縮退はタスクグループ全体で1枚ではなく、各タスクの「対応UIデザイン」フィールドから独立して解決する。**
   > 異なるタスクが異なるフレームを担当するケースがあるため、タスクグループ共通の `primaryFrameName` に縮退すると誤った baseline が渡される。

   - 各タスクごとに「対応UIデザイン」フィールドをパースし、フレーム名の配列を取得する
   - 単一フレームの場合: そのフレーム名をそのまま使用する
   - 複数フレームが指定されている場合:
     - `primaryFrameName = frameNames[0]`（そのタスクの Step 2.5 / task-executer 起動時に使用）
     - `skippedFrames = frameNames[1:]`（未照合フレーム）
     - **einja-task-exec（親エージェント）が** `skippedFrames` を `riskFlags` に記録する（task-executer や task-qa に記録させない）:
       `{"type": "skipped_frames", "taskId": "{タスクID}", "frames": skippedFrames, "reason": "複数フレーム対応は別Issue"}`
   - Step 2.5 の `baseline.png` / `manifest.json` はタスクグループ共通ではなく、各タスクの起動時に必要に応じて生成する（design-engineer が指定されたタスクは Step 2.5 実行後に起動する）

### Step 2.5: UI design context load（UIタスクの場合のみ）

**UIタスクフラグが立っていない場合はこのステップをスキップする。**

1. Step 1〜2 で抽出した「対応UIデザイン」フィールドから `ui-design.pen` のパスとフレーム名を取得する
   - `ui-design.pen` が存在しない場合: **spec defect** として停止し、ユーザーにエラーを報告する（`ui-design.pen が存在しません。einja-issue-spec-create でデザインファイルを生成してください`）
2. **Pencil MCP `batch_get`** で対象フレームのノード要約を取得する
   - `patterns: ["{フレーム名}"]` または `nodeIds` でフレームを指定
3. **Pencil MCP `get_screenshot`** で baseline.png を生成し、`artifacts/ui-design/baseline.png` に保存する
4. 取得情報から **manifest.json** を生成し、`artifacts/ui-design/manifest.json` に保存する:
   ```json
   {
     "frameName": "{primaryFrameName}",
     "frameNames": ["{全フレーム名の配列（複数フレーム縮退時に記録）}"],
     "skippedFrames": ["{未照合フレーム名（複数指定時のみ。単一フレームの場合は省略可）}"],
     "components": ["{Pencil batch_get から抽出したコンポーネント種別一覧}"],
     "layout_axis": "{vertical | horizontal}",
     "expected_states": ["{デフォルト状態・インタラクション状態一覧}"],
     "variables_used": ["{manifest から抽出したデザイントークン一覧}"]
   }
   ```
5. Step 4（task-executer への渡し情報）と Step 5.5（task-design-reviewer への渡し情報）のために、以下を保持する:
   - `baseline_png`: `artifacts/ui-design/baseline.png`（絶対パス）
   - `manifest_json`: `artifacts/ui-design/manifest.json`（絶対パス）

**注意**: Pencil MCP の呼び出しは einja-task-exec（親エージェント）が実施する。task-qa・task-executer は Pencil MCP を呼ばない。

### Step 3: TaskCreate登録

各タスクを `TaskCreate` で登録し、依存関係を設定する。

**TaskCreate の形式**:
```
TaskCreate:
  subject: "X.Y.Z タスク名"
  description: |
    ## 受け入れ基準（抽出済み）
    - AC1.2: Given: ... When: ... Then: ...
    - AC1.3: Given: ... When: ... Then: ...
    ## 設計参照
    {specパス}/design.md → 「セクション名」セクション
    ## 完了条件
    （Issueから抽出した完了条件 + ACを満たす）
    ## 実行サブエージェント（指定されている場合のみ）
    このタスクは [エージェント名] サブエージェントに委託して実装すること
    ## 使用Skill（指定されている場合のみ）
    以下のSkillを事前に読み込んでから作業すること: [Skill名]
    ## 参考（追加情報が必要な場合）
    - requirements.md: {specパス}/requirements.md
    - design.md: {specパス}/design.md
  activeForm: "タスクX.Y.Zを実装中"
```

**依存関係の設定**:
- `TaskUpdate` の `addBlockedBy` で依存関係を設定
- `**依存関係**: X.Y.Z` → 対応するTaskのIDを `addBlockedBy` に設定
- `**依存関係**: なし` → ブロックなし
- `**依存関係**: X.Y`（タスクグループ依存） → グループ外依存のため事前に完了済みと想定

**タスク番号→TaskID のマッピングテーブル**を保持し、依存関係解決に使用する。

### Step 4: 依存関係ベース並列実行ループ

#### 実行サブエージェントの判定（タスクごとに実施）

各タスクのメタデータから `実行サブエージェント: [...]` フィールドを読み取り、
以下のマッピングで起動するエージェントを決定する:

| 指定値 | 使用エージェント | 主な用途 |
|--------|----------------|---------|
| [design-engineer] | design-engineer | UIデザイン実装（Figma/Pencil参照必須） |
| [frontend-coder] | frontend-coder | フロントエンド実装 |
| [backend-architect] | backend-architect | バックエンド設計 |
| [codex-agent] | codex-agent | Codex活用実装 |
| （未指定 or [task-executer]） | task-executer | 通常の実装タスク |
| [phase-reviewer] | phase-reviewer | Phase末尾の品質確認（後述の特殊処理を参照） |

判定ロジック:
1. タスクメタデータの `実行サブエージェント` フィールドを抽出（Step 1の継承ルールを適用済みであること）
2. 上記マッピングに従い、起動するエージェントを決定
3. **design-engineer が指定された場合は必ず Step 2.5（UI design context load）を実行してから起動**
4. 指定がない or 認識できない値の場合は task-executer を使用（デフォルト）

**重要**: この判定を行わず常に task-executer を使うことは禁止。
実行サブエージェント指定はユーザーの意図であり、無視してはならない。

```
while (未完了タスクが存在):
  1. TaskList で未完了タスクを確認
  2. blockedBy が空かつ pending のタスクを収集
  3. 収集したタスクを TaskUpdate で in_progress に設定
  4. 【実行サブエージェント判定】各タスクの `実行サブエージェント` フィールドを確認し、
     上記マッピングで起動エージェントを決定する:
     - [design-engineer] の場合:
       * そのタスクの「対応UIデザイン」フィールドからフレーム名を独立して解決し、複数フレームの場合は frameNames[0] を使用、残りは einja-task-exec（親）が riskFlags に記録する
       * Step 2.5 が未実行（またはそのタスクの対象フレームで未生成）であれば先に実行（baseline.png + manifest.json を生成）
       * Task ツールで design-engineer を起動
       * promptに含める: タスクID + タスク名 + AC + 設計パス + 完了条件 +
         baseline_png（Step 2.5 で保存した絶対パス） + manifest_json（同）+
         使用Skill指示（指定されている場合）+ 外部API連携フラグ（該当する場合）
     - [frontend-coder] / [backend-architect] / [codex-agent] の場合:
       * Task ツールで対応エージェントを起動
       * promptに含める: タスクID + タスク名 + AC + 設計パス + 完了条件 +
         使用Skill指示（指定されている場合）+ 外部API連携フラグ（該当する場合）+
         baseline_png（UIタスクかつ Step 2.5 完了済みの場合のみ）+
         manifest_json（同上）
     - 未指定 or [task-executer] の場合（デフォルト）:
       * Task ツールで task-executer を起動
       * promptに含める（ハイブリッド方式）:
         a. タスクID + タスク名 + 実装指示（Issueから抽出したサブタスク内容）
         b. AC（受け入れ基準）→ 直接埋め込み（親が抽出済み）
         c. 設計 → design.mdパス + セクション名（executerが自分でRead）
         d. 完了条件
         e. フォールバック用specファイルパス（追加情報が必要な場合）
         f. 使用Skill指示（指定されている場合）→ 「以下のSkillを事前に読み込んでから作業すること: [Skill名]」
         g. 外部API連携フラグ（Step 1.5で検出された場合）→ 「⚠️ このタスクは外部API連携を含みます。実装前にAPI打鍵テスト（curl等）で正しいリクエスト/レスポンス形式を確認してから実装してください（task-executer 4.6参照）」
         h. baseline_png（UIタスクかつ Step 2.5 完了済みの場合のみ）→ 「UIデザイン基準画像: {絶対パス}」
         i. manifest_json（同上）→ 「UIデザインマニフェスト: {絶対パス}」
         j. 対応UIデザインフレーム名（対応UIデザインフィールドが存在する場合）:
            - 各タスクの「対応UIデザイン」フィールドから独立して解決する（タスクグループ共通の primaryFrameName を使い回さないこと）
            - 単一フレームの場合: 「対応UIデザイン: ui-design.pen「{frameName}」」
            - 複数フレームの場合: そのタスクの frameNames[0] を渡す → 「対応UIデザイン: ui-design.pen「{primaryFrameName}」」
              （残りの skippedFrames は einja-task-exec（親）が riskFlags に記録してから task-executer を起動すること）
     - **必ず `run_in_background: true`** で非同期起動する（1タスクでも同様。親エージェントがメッセージ受信等を並行処理できるようにするため）
  5. 各エージェントの完了を待機（TaskOutput で結果取得）
  6. 完了したタスクを TaskUpdate で completed に設定
  7. ループ先頭に戻る
```

**注意事項**:
- 並列起動するタスク間でファイル変更対象が重複しないよう、設計セクションから推定して確認する
- 重複懸念がある場合は直列化する
- どのエージェントを起動した場合もコミットさせない（Step 7でまとめて実行）

#### Phase末尾タスクグループの特殊処理

タスクグループのメタデータ（Step 1で抽出した「実行サブエージェント」フィールド）に `[phase-reviewer]` が含まれる場合、通常の並列実行ループではなく以下の特殊処理を行う:

1. **task-executer の代わりに phase-reviewer エージェントを起動する**
   - Task ツールで `phase-reviewer` エージェントを直列起動（並列不可）
   - 入力: 全Outcome Manifest（`artifacts/outcomes/` 配下の `{taskId}-outcome.json`）、Phase diff範囲（`git diff --name-only origin/issue/{N}...HEAD`）、specパス

2. **判定結果の処理**

   | 判定 | 処理 |
   |------|------|
   | PASS | Step 7（einja-task-commit Skill）へ進む |
   | CONDITIONAL | Step 7（einja-task-commit Skill）へ進む。phase-reviewer が返した改善事項をコミットメッセージに付記する |
   | FAIL | 指摘リスト（fixRequired）を元に影響タスクグループを特定し、該当タスクグループに `fix_required` を設定して Step 4（task-executer）に差し戻す |
   | PHASE_ESCALATE | einja-task-exec を即座に終了し、呼び出し元（einja-issue-exec または einja-issue-team-exec）に「Phase全体の再設計が必要」として上位エスカレーションを報告する。ステータスファイル `task-{X.Y}.json` の `status` を `phase_escalated` に更新し、根本原因と推奨アクションを `fixInstructions` に記録する |

3. **FAIL 差し戻し時の注意**:
   - `fixRequired` の `taskGroupId` フィールドを参照して差し戻し先のタスクグループを特定する
   - 差し戻し後は Step 4 → Step 5 → Step 5.5（UIタスクの場合）→ Step 6 → Step 6.5 を再実行してから再度 phase-reviewer を起動する

### Step 5: レビューフェーズ（task-reviewer）
- 全タスク完了後、グループ全体で1回実行
- 要件定義・設計との整合性確認
- MAJOR判定 → 該当タスクのみ再実行（Step 4に戻る）
- PASS/MINOR判定 → デザイン整合性レビューフェーズへ（UIタスクの場合）または品質保証フェーズへ（非UIタスクの場合）

### Step 5.5: デザイン整合性レビュー（UIタスクの場合のみ）

**UIタスクフラグが立っていない場合はこのステップをスキップし、Step 6に進む。**

Task ツールで `task-design-reviewer` エージェントを **直列実行** する（並列不可）。

**渡す情報**（promptに含める）:
- `baseline_png`: Step 2.5 で保存した `artifacts/ui-design/baseline.png` の絶対パス
- `manifest_json`: Step 2.5 で保存した `artifacts/ui-design/manifest.json` の絶対パス
- `changed_files`: Step 5（task-reviewer）完了時点の変更ファイル一覧（`git diff --name-only HEAD` 等で取得）

**判定と後続処理**:

| 判定 | 処理 |
|------|------|
| PASS | Step 6（task-qa）に進む |
| CONDITIONAL | Step 6（task-qa）に進む。task-design-reviewerが返した `riskFlags` を Step 6（task-qa）の呼び出しプロンプトに含めて渡す |
| FAIL | Step 4（task-executer）に差し戻し。差し戻し時のプロンプトに task-design-reviewer の指摘内容を含めること。修正完了後は Step 5 → Step 5.5 を再度実行する |

### Step 6: 品質保証フェーズ（task-qa）
- グループ全体で1回実行
- 受け入れ条件に基づく動作確認
- テスト失敗 → 該当タスクのみ再実行（Step 4に戻る）
- 全テスト合格 → L2技術的受け入れゲートへ

### Step 6.5: 技術的受け入れゲート（自動判定）

task-qa 完了後、以下のハードゲートを自動でチェックする。**ゲートPASSまでコミット・プッシュフェーズ（Step 7）に進めない。**

#### ハードゲート（1つでもFAILならStep 7不可）

| チェック項目 | PASS条件 |
|------------|---------|
| MUST AC全件検証 | task-qa の Outcome Manifest で、全 MUST AC の `candidateVerdict` が `candidate_verified` であること（スコアより優先） |
| エビデンス記録 | 各 AC の `evidenceRefs` に `bytes > 0` かつ `toolCallId` が記録されていること |
| UIテスト完全性 | UIタスクの場合、「保護リソースへのアクセス成功」まで確認済みであること（「ログインページ表示」のみで終了しないこと） |
| Step 0 前提条件 | Step 0（入力解析）の前提条件チェックがPASS |
| ハードブロッカーなし | task-qa および task-design-reviewer（UIタスクの場合）でハードブロッカーが検出されていないこと |

**ゲートFAILの場合**: 失敗した項目を明示して task-executer に差し戻し（Step 4 に戻る）。

#### autoAcceptance禁止条件（常に人間確認必須）

以下のいずれかに該当する場合、ハードゲートがPASSであっても自動でコミット・プッシュせず、AskUserQuestion でユーザーの確認を取ること:

- 変更対象が `auth` / `billing` / `migration` / 外部API / UIの主要導線に関わる
- MUST AC に `blocked` / `blocked_spec` が 1件でも存在する

**ハードゲートPASS かつ autoAcceptance禁止条件に非該当** → Step 7（コミット・プッシュフェーズ）に自動で進む。

### Step 7: コミット・プッシュフェーズ（einja-task-commit Skill）
- QA合格後、Skill toolで `einja-task-commit` Skillを直接呼び出し
- 変更がある場合のみ実行（変更なしの場合はスキップ）
- コミット分割案の確認はスキップ（QA合格済みのため自動適用）
- 品質チェック（lint/typecheck/test/build）はQAで実行済みのためスキップ
- 完了後、Step 8（issue-exec経由時）または追加指示待ち状態（スタンドアロン時）へ

### Step 8: Director承認待ちループ（issue-exec経由時のみ）

issue-exec経由で実行されている場合（セッションパスが存在する場合）、コミット完了後に以下のループに入る:

1. PR作成完了を確認した後、ステータスファイル `task-{X.Y}.json` の `status` を `awaiting_review` に更新（Fast Gateは `prNumber` の存在を前提とするため、必ずPR作成後に遷移すること）
2. 以下のループで Director の判定を待機:

```
while true:
  1. task-{X.Y}.json の directorVerdict を確認（15秒間隔）
  2. directorVerdict = "approved" → 正常終了（tmux window終了）
  3. directorVerdict = "fix_required" → fixInstructions を読み、修正実行:
     - fixInstructions の内容に基づいて task-executer で修正
     - 修正後、再度 task-reviewer → task-qa → einja-task-commit
     - status を再度 "awaiting_review" に更新
     - directorVerdict をクリア（null に戻す）
  4. directorVerdict = "rejected" → 失敗終了（status="failed"、tmux window終了）
  sleep 15
```

3. スタンドアロン実行の場合（セッションパスなし）はこのステップをスキップし、従来の追加指示待ち状態へ進む

**判定方法**: `~/.einja/sessions/issue-{N}/` ディレクトリが存在するかどうかで issue-exec経由かを判定する。

### 5. Phase 99 タスクの処理（docs-updater）

タスクグループ番号が `99.*` 形式の場合、以下のフローで処理：

1. **タスク種別判定**
   - タスクグループ番号の先頭が `99` かどうかを確認
   - 例: `99.1` → Phase 99 タスク

2. **docs-updater の呼び出し**
   - Task ツールで docs-updater エージェントを呼び出し
   - prompt に以下を含める：
     - Issue番号
     - タスクグループ番号
     - 対象タスクspecのパス（全Phaseで完了したタスクspec）

3. **コミット・プッシュ**
   - docs-updater 完了後、Skill toolで `einja-task-commit` Skillを呼び出し
   - ドキュメント変更をコミット・プッシュ

4. **終了**
   - Phase 99 タスクは追加指示待ち状態なし
   - 完了後、即座にコマンド終了

**docs-updater への prompt 例**:
```
Issue #123 のPhase 99 タスク（タスクグループ 99.1）を実行してください。

以下のタスクspecをfeature/steering仕様書に反映してください：
- docs/specs/tasks/feature-name/20251104-task1
- docs/specs/tasks/feature-name/20251105-task2
```

---

## 失敗時のリカバリーフロー

### 失敗原因の分類

task-qa は以下の基準で失敗原因を分類し、適切な戻し先を決定します：

#### A: 実装ミス（コードロジックの問題）
- **症状**: 期待値と実際の挙動が異なる、エラーが発生
- **戻し先**: task-executer（実装フェーズ）
- **対応**: コード修正 → 再度 reviewer → qa
- **例**: API が 404 を返す、バリデーションが動作しない

#### B: 要件理解の齟齬（要件定義の問題）
- **症状**: 実装は正しいが、要件と一致しない
- **戻し先**: requirements.md 修正 → 再度 task-executer
- **対応**: 要件明確化 + 再実装 → reviewer → qa
- **例**: 想定していなかったエッジケース、曖昧な要件の誤解

#### C: 設計不備（アーキテクチャの問題）
- **症状**: 実装方法が技術的に不適切
- **戻し先**: design.md 修正 → 再度 task-executer
- **対応**: 設計見直し + 再実装 → reviewer → qa
- **例**: パフォーマンス問題、セキュリティ脆弱性

#### D: テスト環境の問題（一時的なエラー）
- **症状**: 実装は正しいが、環境要因で失敗
- **戻し先**: QA 再実行（修正不要）
- **対応**: 環境調整のみ
- **例**: ネットワークタイムアウト、データベース接続エラー

### task-qa の判定ロジック

1. テスト結果を詳細に確認
2. 失敗原因を以下の 4 分類に分類:
   - A: 実装ミス
   - B: 要件理解の齟齬
   - C: 設計不備
   - D: テスト環境の問題
3. 分類に基づいて戻し先を決定
4. 完了報告に分類結果と推奨アクションを明記
5. 分類に応じた戻し先に自動的に進む

---

## QA仕様書の作成・更新フロー

### 初回実行時（qa-tests/story{N}.md が存在しない場合）

1. **ファイルの新規作成**
   - タスクメタデータの「実装AC」からストーリー番号を特定し、`qa-tests/story{N}.md` を新規作成
   - 例: 実装AC が AC1.1, AC1.2 → `qa-tests/story1.md`

2. **受け入れ基準の抽出**
   - `requirements.md` の各ユーザーストーリー配下の「受け入れ基準」セクションから各ACを抽出

3. **テストシナリオの作成**
   - 各ACに対してテストシナリオを作成
   - テンプレート: `docs/einja/steering/acceptance-criteria-and-qa-guide.md` 参照

4. **QA仕様書の構造**:
```markdown
## 機能名: [タスク名]
- 背景/価値: [requirements.mdから抽出]
- 関連 AC: AC1.1, AC1.2, AC2.1
- テスト範囲: Integration / Browser

- シナリオ:
  1. [AC1.1に対応するシナリオ]
     - 前提: [Given]
     - 操作: [When]
     - 期待結果: [Then]
     - ログ/メトリクス確認方法: [確認手段]

### 実施結果（最終更新: YYYY-MM-DD）
**ステータス: [✅ SUCCESS / ❌ FAILURE / ⚠️ PARTIAL]**
```

### 2回目以降の実行時（qa-tests/story{N}.md が既に存在する場合）

1. **既存ファイルの読み込み**
   - `qa-tests/story{N}.md` を読み込む

2. **更新対象の特定**
   - 「実施結果」セクションのみを更新対象とする
   - シナリオ部分は**保持**（変更しない）

3. **結果の記録**
   - 最新のテスト実施結果を「実施結果」セクションに追記
   - ステータスを更新（SUCCESS / FAILURE / PARTIAL）

---

## 追加指示待ち状態

> **注意**: issue-exec経由で実行されている場合、この追加指示待ち状態には入らず、Step 8（Director承認待ちループ）に進みます。以下はスタンドアロン実行時のみ適用されます。

QA合格後、以下を表示：

```
タスクグループの実装が完了しました。

追加の修正や改善がある場合は指示してください。
完了する場合は「終了」または「完了」と入力してください。
```

### 追加修正の対応（task-modification-analyzer）

ユーザーから追加指示があった場合、以下の手順で対応：

#### 1. 修正規模の確認

まず、修正の規模を確認するため、AskUserQuestionで以下を提示：

```yaml
AskUserQuestion:
  question: "追加修正の規模を確認してください"
  header: "修正規模の選択"
  options:
    - label: "小規模（ロジック修正のみ）"
      description: "メリット: 迅速に対応可能。デメリット: 影響範囲を見逃す可能性。対応: task-executerのみで実施"
    - label: "中規模（複数ファイル修正）"
      description: "メリット: 関連箇所も含めて修正。デメリット: 時間がかかる。対応: task-executer → task-reviewer"
    - label: "大規模（設計変更が必要）"
      description: "メリット: 根本的な問題解決。デメリット: 全ワークフローの再実行が必要。対応: requirements.md/design.md修正後に再実行"
```

#### 2. 修正内容の曖昧性確認（必要な場合）

修正内容が不明確な場合、以下をAskUserQuestionで確認：

```yaml
AskUserQuestion:
  question: "修正内容を明確にしてください"
  header: "修正内容の分類"
  options:
    - label: "追加機能の実装"
      description: "メリット: 新機能追加で価値向上。デメリット: 既存機能への影響リスク。対応: 新しい機能やコンポーネントを追加"
    - label: "既存機能の変更"
      description: "メリット: 要件に合った改善。デメリット: 回帰テストが必要。対応: 既存の動作を変更または拡張"
    - label: "バグ修正"
      description: "メリット: 品質向上、ユーザー満足度向上。デメリット: 根本原因の調査に時間がかかる場合あり。対応: 期待通りに動作しない箇所を修正"
    - label: "リファクタリング"
      description: "メリット: 保守性向上、技術的負債の解消。デメリット: 短期的には機能追加なし。対応: 機能は変えずにコード品質を改善"
```

#### 3. task-modification-analyzerの呼び出し

上記の確認後、task-modification-analyzerを呼び出し：
1. Issue番号、タスクグループ番号、ユーザー指示を渡す
2. 分析結果を表示してユーザーの承諾を待つ
3. 承諾後、推奨パターンで実行：
   - 小規模修正: task-executerのみ
   - 中規模以上: task-executer → task-reviewer → task-qa
4. 完了後、追加指示待ち状態に戻る

### 終了条件

ユーザーが「終了」「完了」「done」と入力した場合、コマンドを終了。

## 注意事項

- Issue番号とタスクグループ番号の両方が必須
- GitHub Issueのチェックボックス更新は自動では行わない
- コミット時は [コミットルール](../../docs/einja/steering/commit-rules.md) を遵守

<!-- @einja:project-private:start id="task-exec-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
