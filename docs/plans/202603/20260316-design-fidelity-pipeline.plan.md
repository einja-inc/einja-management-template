# 外部API連携機能のQA品質ギャップ修正

## Context

Issue #130（音声通話機能）の実装で、OPENAI_API_KEYが未設定のまま全テストがモックのみで通過し、QAがSUCCESS判定した。
実際にAPIと通信して動作することが一度も確認されないまま、PRがレビュー待ちになった。

**原因**: ルール（`acceptance-criteria-and-qa-guide.md`）には「実際のインフラ接続」「動作確認なしでSUCCESS禁止」と書いてあるが、エージェントが実行時に参照する手順書（`_einja-task-qa/SKILL.md`）には、それを強制する具体的なチェックステップがない。

## 現状

### ルール側（steering）
- `acceptance-criteria-and-qa-guide.md` に「QAテスト = 実際のインフラ接続」「モック = 単体テスト側」と明記
- 「動作確認なしでSUCCESS判定禁止」と明記

### 実行側（Skill）
- `_einja-task-qa/SKILL.md`: 動作確認テーブル（curl/Playwright）はあるが、環境変数チェックなし、モックのみ検出なし
- `einja-task-exec/SKILL.md`: 環境変数チェックなし
- `einja-issue-team-exec/director-prompt.md`: Agent Teams/gh auth のみチェック、アプリ固有環境変数チェックなし（`einja-task-exec`経由で間接カバーされるためスコープ外）
- `issue-exec-protocol.md`: 「実行記録があること」のみチェック、モック vs 実APIの区別なし

## 変更内容

### 設計方針（レビュー反映）

1. **BLOCKEDステータスは新設しない**: 既存の `FAILURE + failureCategory=D（環境問題）` に統一する。新ステータス追加は既存フロー（ステータス定義、JSONスキーマ、テンプレート等）への影響が大きすぎる
2. **外部API判定はヒューリスティックではなく機械的に**: 実装コード内の `process.env.` 参照を検索して必要な環境変数を特定する
3. **task-execの環境チェックは警告のみ**: ハードブロックではなく警告。必須チェックはQA（task-qa）のステップ4冒頭で行う
4. **worktree不要**: ドキュメント・Skill定義のみの変更のため

### 修正1: `_einja-task-qa/SKILL.md` — 動作確認の実効性チェック追加

**最も重要な修正。** QAの動作確認フェーズ（Phase 3相当、ステップ4）に以下を追加:

#### A. 環境前提条件チェック（ステップ4の冒頭に追加）
```
動作確認の実施前に、以下を確認する:
1. 実装対象コード内の `process.env.` 参照を検索し、必要な環境変数を特定する
2. 特定された環境変数が .env / .env.local に設定されているか確認する
3. 未設定の環境変数がある場合 → FAILURE（failureCategory=D: 環境問題）判定
   - 理由: 「環境変数 XXX が未設定のため動作確認不可」
   - 推奨アクション: 「XXX を .env.local に設定してから再実行」
   - SUCCESSにしてはならない
4. 設定されている場合 → 動作確認に進む
```

#### B. モックのみテスト検出（ステップ4の動作確認完了後に追加）
```
動作確認結果の検証:
- curlでAPIを叩いた場合: レスポンスが実際のサービスからのものか確認（モックサーバーのレスポンスではないか）
- Playwrightで画面確認した場合: 外部API連携部分が実際に動作しているか確認（エラー表示、ローディングのまま停止していないか）
- 全テストがモックのみで、実APIとの通信確認が一度もない場合 → 動作確認未実施としてSUCCESS禁止
```

### 修正2: `einja-task-exec/SKILL.md` — 実装開始前の環境チェック（警告のみ）

Step 1（タスクグループ解析）の後、Step 2（実装）の前に追加:

```
Step 1.5: 環境前提条件チェック（警告）
- タスクグループの実装対象コード内で `process.env.` を検索し、使用されている外部サービス用環境変数を特定
- .env / .env.local を確認し、未設定の環境変数があれば警告を出力
  - 「⚠️ 環境変数 XXX が未設定です。QAフェーズで動作確認が失敗する可能性があります」
- 実装自体はブロックしない（実装→QAの段階で必須チェック）
```

### 修正3: `docs/einja/steering/acceptance-criteria-and-qa-guide.md` — ルールの具体化

セクション4のエージェント指示に以下の禁止事項を追加:

```
**task-qa**
- 外部API連携機能で、環境変数未設定のまま「テストPASS」を根拠にSUCCESSにすることは禁止
- モックテストのPASSは「動作確認」に該当しない。実APIとの通信確認が必須
- 環境変数未設定で動作確認不可の場合は FAILURE（failureCategory=D: 環境問題）として報告
```

### 修正4: `docs/einja/instructions/issue-exec-protocol.md` — ゲートチェック強化

Fast Gate の QA結果確認項目に追加:

```
| 外部API動作確認 | 外部API連携タスクで、動作確認がモックテストのみ（実API通信なし）の場合はFAIL |
```

## タスク概要

| # | タスク | 使用Skill/ツール | 依存 |
|---|--------|-----------------|------|
| 0-0 | TaskCreate一括登録 | TaskCreate | - |
| 0-1 | Planファイルリネーム | Bash | - |
| 1 | `_einja-task-qa/SKILL.md` 修正 [Edit] | Edit | - |
| 2 | `einja-task-exec/SKILL.md` 修正 [Edit] | Edit | - |
| 3 | `acceptance-criteria-and-qa-guide.md` 修正 [Edit] | Edit | - |
| 4 | `issue-exec-protocol.md` 修正 [Edit] | Edit | - |
| 99-1 | コードレビュー [einja-review-code] | einja-review-code | 1,2,3,4 |
| 99-G | コミット承認ゲート [AskUserQuestion] | AskUserQuestion | 99-1 |
| 99-3 | コミット・プッシュ [einja-task-commit] | einja-task-commit | 99-G |

タスク1〜4は並列実行可能。worktree不要（ドキュメント・Skill定義のみの変更）。

## 並列実行計画

```
Phase 1: [1] [2] [3] [4]  ← 4タスク並列
Phase 2: [99-1]            ← レビュー
Phase 3: [99-G]            ← 承認ゲート
Phase 4: [99-3]            ← コミット・プッシュ
```

## リスク・不明点

- **リスク**: steering文書（`acceptance-criteria-and-qa-guide.md`、`issue-exec-protocol.md`）はマネージドディレクトリだが、このリポジトリが原本なので編集可能
- Skillファイル（`_einja-task-qa`、`einja-task-exec`）もこのリポジトリが原本であり、ビルド時にpresetsへコピーされる
- `director-prompt.md` は `einja-task-exec` 経由で間接的にカバーされるためスコープ外

## 検証・動作確認方法

1. 各ファイルの差分を確認し、追加されたチェックステップが論理的に正しいか検証
2. `pnpm -F @einja-inc/dev-cli build` でCLIパッケージのビルドが通ることを確認

## Planレビュー結果

### 最終判定: MAJOR → 修正済み

| レビュアー | 判定 | 主な指摘 |
|-----------|------|---------|
| レビュアー1（観点別） | MINOR | worktree不要の明記、環境変数検出ロジック具体化、外部API判定基準の明示、director-prompt.mdスコープ外理由 |
| レビュアー2（codex-agent） | MAJOR | BLOCKEDステータス未定義→FAILURE(D)に統一、外部API判定をprocess.env検索で機械化、task-execは警告のみに、対象ファイル不足の指摘 |

**修正対応**:
- BLOCKEDステータス新設を撤回 → 既存の `FAILURE + failureCategory=D` に統一
- 環境変数検出を `process.env.` 検索で機械化
- task-execの環境チェックを警告のみに変更
- worktree不要の明記、director-prompt.mdスコープ外理由を追記
- ビルドコマンドを `pnpm -F @einja-inc/dev-cli build` に修正
