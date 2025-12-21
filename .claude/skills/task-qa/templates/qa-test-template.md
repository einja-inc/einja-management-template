# Phase {phase_num}-{group_num}: {task_name} QAテスト結果

## テスト対象タスク
- **タスクID**: {task_id}
- **タスク名**: {task_name}
- **実装日**: {date}
- **テスター**: {tester}
- **最終更新**: {date}

## テストサマリー
| ステータス | 件数 |
|----------|-----|
| ✅ PASS | 0 |
| ❌ FAIL | 0 |
| ⚠️ PARTIAL | 0 |

---

<!--
以下、各ACごとにセクションを作成します。
AC番号は requirements.md の「検証レベル: Integration」または「検証レベル: E2E」のものを対象とします。
-->

## AC{ac_number}: {ac_title}

### 受け入れ条件
<!-- requirements.md から該当ACの受け入れ条件を転記 -->
- 前提: {precondition}
- 操作: {action}
- 期待結果: {expected_result}
- 検証レベル: {verification_level}

### テストシナリオ・実施結果（最終更新: {date}）

#### {test_scenario_name}
```bash
# テスト実行コマンド例
{test_command}
```

### 期待値
<!-- 具体的な期待値を箇条書きで記載 -->
- ✅ {expected_outcome_1}
- ✅ {expected_outcome_2}

### 実施結果
**ステータス: {status}**
<!-- ステータス: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL -->

#### 実行内容
```bash
# 実際に実行したコマンドとその出力
$ {actual_command}
{command_output}
```

#### 確認内容
| No | 確認項目 | 結果 | 備考 |
|----|---------|------|------|
| 1 | {check_item_1} | {result_1} | {note_1} |
| 2 | {check_item_2} | {result_2} | {note_2} |

#### エビデンス
- ログファイル: `qa-tests/phase{phase_num}/evidence/{task_id}-{evidence_id}.log`
- スクリーンショット（該当する場合）: `qa-tests/phase{phase_num}/evidence/{task_id}-{evidence_id}.png`

---

<!-- 追加のACがある場合は上記セクションを繰り返す -->

---

## 必須自動テスト結果

### 実行コマンド
```bash
# 1. ユニットテスト
pnpm test

# 2. E2Eテスト（該当する場合）
pnpm test:e2e

# 3. Lintチェック
pnpm lint

# 4. ビルドチェック
pnpm build

# 5. 型チェック（TypeScript）
pnpm typecheck
```

### 結果
| テスト項目 | ステータス | 備考 |
|----------|----------|------|
| ユニットテスト | {unit_test_status} | {unit_test_note} |
| E2Eテスト | {e2e_test_status} | {e2e_test_note} |
| Lintチェック | {lint_status} | {lint_note} |
| ビルドチェック | {build_status} | {build_note} |
| 型チェック | {typecheck_status} | {typecheck_note} |

**重要**: 上記のいずれか1つでも失敗した場合、全体ステータスは**❌ FAIL**となります。

---

## エラー時の対応フロー

### エラー分類
- **✅ PASS**: 期待通りに動作
- **❌ FAIL**: 明確なエラー、要修正
- **⚠️ PARTIAL**: 動作するが改善が必要

### 備考欄の記載ルール
- **成功時**: パフォーマンス情報、気になる挙動など
- **失敗時**: エラーメッセージ、推定原因、影響範囲
- **部分的成功時**: 問題の詳細と回避策

### エビデンス収集
- エラー画面のスクリーンショット
- コンソールログ
- データベースクエリログ
- エラースタックトレース
- Playwright MCPの場合: ブラウザスナップショット

---

## 統合テスト結果サマリー

### フェーズ{phase_num}-{group_num}全体結果
- **全体ステータス**: {overall_status}
- **完了タスク**: {completed_tasks}/{total_tasks}
- **テスト合格率**: {pass_rate}% ({passed_count}/{total_test_count})
- **検出問題**:
  - **CRITICAL**: {critical_count}件
  - **MINOR**: {minor_count}件

### 修正が必要な項目
1. **優先度HIGH**:
   - [ ] {high_priority_issue_1}
   - [ ] {high_priority_issue_2}

2. **優先度MEDIUM**:
   - [ ] {medium_priority_issue_1}
   - [ ] {medium_priority_issue_2}

### 次フェーズへの引き継ぎ事項
1. {carryover_item_1}
2. {carryover_item_2}

### 改善提案
- {improvement_suggestion_1}
- {improvement_suggestion_2}

---

## 報告と対応

### 失敗原因分類
<!-- 該当する分類にチェック -->
- [ ] **A: 実装ミス** → task-executerへ差し戻し
- [ ] **B: 要件齟齬** → requirements.md修正 → task-executerへ差し戻し
- [ ] **C: 設計不備** → design.md修正 → task-executerへ差し戻し
- [ ] **D: 環境問題** → qa再実行

### task-executerへの差し戻し（該当する場合）
以下の項目について修正が必要:
1. {rework_item_1}
2. {rework_item_2}

### 修正優先度
- **即座対応**: {immediate_fix}
- **1週間以内**: {week_fix}
- **2週間以内**: {biweek_fix}

### 回避策（該当する場合）
- {workaround_1}
- {workaround_2}
