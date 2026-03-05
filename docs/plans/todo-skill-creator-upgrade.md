# TODO: einja-skill-creator 公式版追従改善

## Phase 0: plan-mode-skill-loader.sh hook修正
- [x] hookのデバッグ・修正（`hookSpecificOutput`内に`additionalContext`を配置）

## Phase 1: スクリプト互換性修正
- [x] 1-a. run_loop.py を公式版ベースに再構築（holdout float化、並列バッチ評価、blinded_history、ブラウザ自動起動、results-dir）
- [x] 1-b. improve_description.py のblinded_history対応（test_results引数削除）
- [x] 1-c. aggregate_benchmark.py を公式版に差し替え（旧版→compare_runs.py）

## Phase 2: SKILL.md内容補完
- [x] 2-a. Phase 1連動のコマンド例更新（holdout 0.4、improve-model、results-dir記載）
- [x] 2-b. 公式版の重要な詳細を追記（#5 grading.jsonフィールド警告, #6 eval query Good/Bad例, #7 タイミング即時処理, #8 コアループ再掲+TodoList, #9 Claude.ai制限拡充, #12 feedback.jsonスキーマ, #13 Coworkアクセス注記）
- [x] 2-c. compare_runs.py の説明追加

## Phase 3: UX改善
- [x] generate_report.py のstdin対応追加（位置引数、-o省略可、stdoutデフォルト）
- [x] 回帰テスト（init_skill.py, quick_validate.py構文チェック・import確認）
