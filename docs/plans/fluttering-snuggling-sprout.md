# Plan: einja-skill-creator を公式版に追従改善 + skill-first hook修正

## Context

公式 Anthropic skill-creator（`anthropics/claude-plugins-official`）が更新されており、einja版は以前のバージョンをベースに日本語化・カスタマイズしたもの。
公式版との差分を分析し、einja版に取り込むべき改善点を特定した。

また、Plan mode時に `einja-skill-first` の評価リマインダーを自動注入する `plan-mode-skill-loader.sh` hookが正常に機能していないことが判明。hookの修正も本Planに含める。

---

## 差分分析サマリー

### 優先度: 高（機能・正確性に影響）

| # | 差分 | 影響 |
|---|------|------|
| 1 | **run_loop.py のシグネチャ不一致** — `holdout`が公式=float(割合) vs einja=int(件数)、第一引数が`eval_set:list` vs `eval_set_path:str` | SKILL.mdの手順通りに`--holdout 0.4`で実行すると動作しない |
| 2 | **run_loop.py のtrain/test順次実行** — 公式版は1バッチで並列実行してから分割、einja版は順次 | 評価実行時間が約2倍 |
| 3 | **run_loop.py のblinded_history欠落** — 公式版はimprove時にtest結果を隠蔽してオーバーフィット防止 | einja版はtestスコアが改善プロンプトに漏れてオーバーフィットリスクあり |
| 4 | **aggregate_benchmark.py が完全別機能** — 公式版はschemas.md準拠のbenchmark.json生成、einja版は複数run_loop出力の横断比較 | Benchmarkモード（viewer.htmlのBenchmarkタブ）が動作しない |
| 5 | **SKILL.md: grading.jsonフィールド名警告の欠落** — `text`/`passed`/`evidence`必須、`name`/`met`/`details`禁止 | viewerがフィールド不一致で正しく表示されないリスク |

### 優先度: 中（品質・UXに影響）

| # | 差分 | 影響 |
|---|------|------|
| 6 | **SKILL.md: eval queryのGood/Bad具体例が欠落** — トリガー評価クエリの品質基準 | 低品質なevalクエリが生成されdescription最適化の精度低下 |
| 7 | **SKILL.md: タイミングデータ即時処理の警告欠落** — 「通知は1回限り、バッチ不可」 | timing.jsonの保存漏れリスク |
| 8 | **SKILL.md: コアループ再掲+TodoList指示の欠落** — 末尾のフロー要約とCowork向けTodoList指示 | 作業手順の抜け漏れリスク（特にCowork環境） |
| 9 | **SKILL.md: Claude.ai制限の文脈説明欠落** — ブラインドテスト不可の注意 | ユーザーが結果の制限を理解できない |
| 10 | **run_loop.py: ブラウザ自動オープン+results_dir保存機能なし** | ライブモニタリング・出力管理の利便性低下 |
| 11 | **generate_report.py: stdin対応なし** — 公式版は`--input -`でstdinから読める | パイプライン連携の柔軟性が低い |

### 優先度: 低（軽微・好みの問題）

| # | 差分 | 影響 |
|---|------|------|
| 12 | **SKILL.md: feedback.jsonのスキーマ例欠落** | ユーザーがフィードバック形式を理解しにくい |
| 13 | **SKILL.md: Coworkフィードバックアクセス権限の注意欠落** | Coworkユーザーがfeedback.json読み込みで詰まる |
| 14 | **generate_report.py: UIデザインの差異** — 公式版はtest/train色分けが明確 | 視認性の差（機能的には同等） |

### einja版の独自強み（維持すべき）

| 要素 | 内容 |
|------|------|
| `init_skill.py` | Skill初期化スクリプト（公式版にない） |
| 参考ドキュメント記録規約 | 設計根拠追跡のHTMLコメント記録 |
| `@einja:excluded` / `@einja:project-private` | テンプレート除外マーカー |
| `quick_validate.py` のeinja固有チェック | プレフィックス推奨、行数チェック |
| import フォールバック | `run_eval.py`のtry/except import |
| description日英併記 | 日本語ユーザー向けトリガー精度向上 |

---

## 推奨改善アプローチ

### Phase 0: plan-mode-skill-loader.sh hook修正

**対象ファイル**: `.claude/hooks/einja/plan-mode-skill-loader.sh`

**現状**: hook自体は正常終了（exit 0）するが、`additionalContext` のリマインダーがAIコンテキストに到達していない。会話冒頭で `UserPromptSubmit hook success: Success` のみ表示され、リマインダーテキストが注入されていない。

**調査・修正方針**:

1. **デバッグ確認**: hookにデバッグ出力を追加し、`permission_mode` の実際の値を確認
   - `echo "DEBUG: permission_mode=$permission_mode" >&2` を追加して値を特定
2. **原因候補の検証**:
   - `permission_mode` が `"plan"` 以外の値（例: `"default"` でPlan modeでも変わらない等）
   - `additionalContext` の出力が "discrete"（背景的）すぎて実効性がない
   - jqの出力がパイプで消失している
3. **修正案**:
   - **案A**: `additionalContext` を `hookSpecificOutput` でネストして明示的に注入
   - **案B**: Plain text stdoutに切り替えてトランスクリプトに直接表示
   - **案C**: `permission_mode` の条件を緩和/修正（値が異なる場合）
4. **検証**: Plan modeで新セッションを開始し、リマインダーが表示されることを確認

### Phase 1: スクリプト互換性修正（高優先度 #1-4）

**注意**: Phase 1完了後、SKILL.mdのコマンド例が一時的に不整合になる。Phase 2で連動更新する。

#### 1-a. run_loop.py を公式版ベースに再構築
   - `holdout` を float 割合に統一（公式: `0.4` = 40%）
   - train/test 並列バッチ実行に変更（1バッチで並列→分割）
   - blinded_history を追加（test結果を隠蔽してオーバーフィット防止）
   - ブラウザ自動オープン（`webbrowser.open`）・`results_dir` 保存を追加
   - 終了条件を公式版に統一（trainのみ全パスで終了、testは過学習チェック用）
   - **einja独自機能の保持判断**:
     - `--improve-model`（評価/改善モデル分離）→ **保持**（公式版より柔軟）
     - `--seed`（再現性確保）→ **保持**（デバッグに有用）
     - import フォールバック・日本語コメント → **保持**

#### 1-b. improve_description.py の互換性確認・修正
   - blinded_history導入に伴うシグネチャ変更の要否を確認
   - 公式版: `/tmp/official-sc-scripts-improve_description.py`
   - einja版: `.claude/skills/einja-skill-creator/scripts/improve_description.py`
   - 差分があればblinded_history対応を追加

#### 1-c. aggregate_benchmark.py を公式版に差し替え
   - 既存のeinja版横断比較機能は `compare_runs.py` に別名保存
   - schemas.md準拠のbenchmark.json生成を復元（viewer.htmlのBenchmarkタブが動作するように）
   - **現状の不整合**: einja版SKILL.mdに記載のコマンド `python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>` が既にeinja版スクリプトでは動作しない状態。公式版差し替えでこの不整合が解消される

### Phase 2: SKILL.md内容補完（高・中優先度 #5-9） ※Phase 1との連動更新含む

#### 2-a. Phase 1連動のコマンド例更新
   - run_loopのコマンド例を公式版シグネチャに合わせて更新
   - `--holdout 0.4` 引数の追記
   - `--improve-model`（einja独自）の説明追記
   - aggregate_benchmarkのコマンド例は既に正しい（公式版差し替えで整合）

#### 2-b. 公式版の重要な詳細を追記
   - grading.jsonフィールド名警告（#5）— `text`/`passed`/`evidence`必須、誤フィールド禁止
   - eval queryのGood/Bad具体例（#6）— 公式版の具体例を日本語化
   - タイミングデータ即時処理警告（#7）— 「通知は1回限り、バッチ不可」
   - コアループ再掲+TodoList指示（#8）— 末尾にフロー要約を追加
   - Claude.ai制限の文脈説明（#9）— ブラインドテスト不可の注意
   - feedback.jsonスキーマ例（#12）
   - Coworkアクセス権限注意（#13）

#### 2-c. compare_runs.py（別名保存した横断比較）の説明追加（任意）

### Phase 3: UX改善（中・低優先度 #10-14）

4. **generate_report.py のstdin対応追加**（`--input -`）
5. **generate_report.py のtest/train色分け改善**（任意）
6. **回帰テスト**: `init_skill.py`・`quick_validate.py` が引き続き動作することを確認

---

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.claude/hooks/einja/plan-mode-skill-loader.sh` | デバッグ・修正（リマインダー注入が機能するように） |
| `.claude/skills/einja-skill-creator/SKILL.md` | 公式版の詳細指示を追記 + コマンド例更新 |
| `.claude/skills/einja-skill-creator/scripts/run_loop.py` | 公式版ベースに再構築（einja独自機能保持） |
| `.claude/skills/einja-skill-creator/scripts/improve_description.py` | blinded_history対応（要否確認後） |
| `.claude/skills/einja-skill-creator/scripts/aggregate_benchmark.py` | 公式版に差し替え（既存は `compare_runs.py` に別名保存） |
| `.claude/skills/einja-skill-creator/scripts/compare_runs.py` | aggregate_benchmark.pyの旧einja版を別名保存 |
| `.claude/skills/einja-skill-creator/scripts/generate_report.py` | stdin対応追加 |

## 公式版ファイル（参照用）

`/tmp/` にダウンロード済み:
- `/tmp/official-skill-creator-SKILL.md` — 公式SKILL.md（479行）
- `/tmp/official-sc-scripts-run_loop.py` — 公式run_loop.py
- `/tmp/official-sc-scripts-aggregate_benchmark.py` — 公式aggregate_benchmark.py
- `/tmp/official-sc-scripts-generate_report.py` — 公式generate_report.py
- その他 `/tmp/official-sc-*` — 公式版の全ファイル

## 検証方法

### Phase 0: hook修正
- Plan modeで新セッションを開始し、`<system-reminder>` にskill-firstリマインダーが表示されることを確認
- Plan mode以外ではリマインダーが注入されないことを確認

### Phase 1: スクリプト互換性
- `python -m scripts.run_loop --help` で引数が公式版と一致（`--holdout` がfloat、`--results-dir` 等が存在）
- `python -m scripts.aggregate_benchmark --help` で引数が公式版と一致（ディレクトリ引数）
- `python -m scripts.improve_description --help` でblinded_history対応を確認
- 小規模実行テスト: 2-3クエリのeval setで `run_loop` を実際に実行し、benchmark.json生成→viewer.htmlのBenchmarkタブ表示まで確認
- `compare_runs.py` が旧einja版の横断比較機能として動作することを確認

### Phase 2: SKILL.md補完
- SKILL.md の公式版との差分レビュー（grading.jsonフィールド警告、eval query Good/Bad例、コアループ再掲等が反映されていることを目視確認）
- SKILL.md のコマンド例が更新後のスクリプトシグネチャと整合していることを確認

### Phase 3: UX + 回帰テスト
- `python -m scripts.quick_validate` でスキーマ検証パス
- `init_skill.py` が引き続き動作することを確認
- `generate_report.py` のstdin対応テスト
