# 最終受け入れ E2E-ready ゲートの追加（"できたつもり"完了の禁止）

> 単一テーマ・1PR。テーマ別コミット分割。feature/spec-process-resilience-harness ブランチ上で実施（直前コミット `4f90965` の再現性ハーネスの自然な続き）。

## Context

直前コミット `4f90965`（feat(harness): spec/レビュー工程に再現性ゲートを追加）が readiness level の5段階規約（`created`/`configured`/`external-deps-ready`/`healthy`/`E2E-ready`）を spec/レビュー工程に導入済み。ただしこの規約は**「1つのAC内でlevelを混在させるな」という粒度規約（§G1）**であり、**「最終受け入れがどのlevelに到達すれば完了か」という到達下限は定めていない**。そのため `created`/`configured` 止まり（"できたつもり"）を「完了」と呼べてしまう。

ユーザー要件: **Issue/機能の最終受け入れは、ユーザーと同等の操作で価値が端から端まで届く（`E2E-ready`）を担保しなければ"完了"としない**。これを spec/レビュー層に「生成時に埋め込み + レビュー時に落とす」二重化で追加する。

確定した適用ルール:
1. **デフォルト（ユーザー導線あり）**: 最終受け入れACに `E2E-ready` 担保ACを1件以上含める。`created`/`configured` 止まりの集合だけで完了としない。
2. **ユーザー導線が無い変更（インフラ/ライブラリ）**: `E2E-ready` は免除可だが**検証ゼロは不可**。変更後に `healthy`（疎通している）ことを確認するACを必ず置き、N/A理由を明記する。
3. **マージ後/デプロイ後にしか確認できない場合**: (a) 後続フェーズ/工程への**申し送り事項**（readiness matrix `deferred-to`）と (b) **人間QAテスト手順**（qa-test.md の人手E2Eシナリオ）の両方を必須にする。
4. **N/A は「本当に確認不可能な場合のみ」**。理由なきN/Aは不可。

## 現状（実ファイル確認済み・`4f90965` 適用後）

- `acceptance-criteria-and-qa-guide.md`「完了レベル（readiness level）を混在させない」節 = §G1の本体。`E2E-ready` は最上位levelとして定義済みだが「最終受け入れの下限」規約は無い。§5チェックリスト「### 要件レビュー」には readiness 関連3項目が既存。
- `einja-review-spec/SKILL.md` の横断必須ゲートは**既に §G1〜§G5 まで存在**（§G5 = **AI processing flow gate / 観点H**）。導入文は「以下 **5** ゲート」「観点（E/F/G/**H**）」。観点ピックは requirements=E/F/G、phase2_bundle=E/F/G/**H**、tasks=E/F/G。**→ 新ゲートは §G6、観点記号は増やさず既存「観点E（Readiness）」の延長として扱う**（§G1/§G2 と同じく観点Eに同居）。
- `readiness-matrix.md.template` は `blocked-by`/`deferred-to` 列を持つ（申し送りの受け皿）。セル凡例は「✅到達 / ⏳未到達 / **N/A 非該当**」、`deferred-to` は ⏳ に必須。
- project系Spec: `einja-project-requirements` = 検収/契約根拠 §1〜§16（「重要な原則」は**1〜6**まで・§14でqa-test整合）、`einja-project-function-spec` = 業務フロー（`4f90965` で threat-modeling 申し送り＝原則10が入済）、`einja-project-screen-flow-figma` = 画面遷移。最終受け入れ思想は未整合。
- 関連**未実装**Plan `docs/plans/202605/20260528-issue-exec-phase-e2e.plan.md` は**実行・QA層**（phase-reviewer/task-qa でデプロイ環境 AC を実際に実行。qa-test.md にランタイム検証サブセクションを追加予定）。今回（仕様・レビュー層）とは補完関係で重複しない。

> **位置特定は行番号でなく見出し（`####`/§記号/原則番号）で行う**。実ファイルは更新されており行番号はずれるため、実装サブエージェントには見出しベースの挿入を指示する。

## 変更内容

**設計核**: 規約本文の SSOT は `acceptance-criteria-and-qa-guide.md`「最終受け入れの readiness 下限」節に集約。他ファイルは**参照で受ける**（§G4 SSOT規約に自己準拠、規約全文を複製しない）。**参照記法は既存テンプレに倣い、コメント/本文中の文字列パス `docs/einja/steering/acceptance-criteria-and-qa-guide.md「最終受け入れの readiness 下限」節` 形式**とする（Markdown相対リンク `[..](../..)` は使わない＝テンプレは `docs/specs/issues/...` 配下にコピーされ相対パスが破綻するため）。新ゲート **§G6** は §G1（混在禁止＝横）と直交する「到達下限＝縦の頂点」規約。

### ───────── A. Issue仕様層（メカニクス・7ファイル）─────────

| ファイル | 変更 |
|---------|------|
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | **【SSOT本文】**「完了レベル」節 `#### 規約` 末尾に小節「**最終受け入れの readiness 下限**」を追加（ルール1〜4を規約化）。**人間QAテスト手順の記法もここで定義**（qa-test.md の「種別」列に `人手E2E` を用い、マージ/デプロイ後検証の手順を記す旨）。§5「### 要件レビュー」チェックリスト末尾に3項目追加 |
| `.claude/skills/einja-review-spec/SKILL.md` | 横断必須ゲートに **§G6（最終受け入れゲート）を新設**（既存 §G5＝AI processing flow の直後）。チェック項目=「E2E-ready担保ACの存在/導線無し時のhealthy疎通+N/A理由/マージ・デプロイ後検証時の申し送り+人間QA手順/matrix整合」。観点E説明（requirements・tasks の観点E行）に「+§G6」追記し**requirements/tasks scopeで無条件適用**。導入文「以下 5 ゲート」→「6 ゲート」、プロンプト埋め込みマッピング（`requirements 観点E→§G1+§G2`、`tasks 観点E→§G2のみ` 等）に §G6 を追加＋参照ドキュメント追記。phase2_bundleは§G6本体を付けず観点C（QA網羅性）に「人手E2Eシナリオ有無」を1文補足 |
| `docs/einja/templates/requirements.md.template` | 「## 4. 受け入れ条件」に「最終受け入れの下限」注記（E2E-ready 1件以上 / 導線無しはhealthy+N/A理由 / マージ後は申し送り+人間QA手順）。ガイドへ文字列パス参照 |
| `docs/einja/templates/readiness-matrix.md.template` | 「## AC との対応」にコメント注記、「## 備考」に追記。**既存凡例（N/A=非該当）と整合**: 「最終受け入れ対象 component の `E2E-ready` 列は ✅（到達）/ ⏳（`deferred-to`＝申し送り先必須）/ N/A（非該当だが**理由を併記**）のいずれかで埋め、空欄・無印は禁止」。`deferred-to`＝申し送り事項に対応する旨も明記 |
| `docs/einja/steering/task-management.md` | Phase完了条件テンプレに最終受け入れ1行。external-deps節の後に新小節「### 最終受け入れの readiness 下限」。実行層責務との境界を明記 |
| `.claude/skills/_einja-issue-spec-tasks-generator/SKILL.md` | 「2. 機能的受け入れ確認」に「3. 最終受け入れのE2E-ready担保（最終Phaseのみ）」追記。**最終Phaseの機械判定ロジック＝「Phase 99（ドキュメント反映）を除く最大Phase番号」を明文化**。テンプレ X.N.2 完了条件に最終Phase時のE2E-ready到達状況を受け入れパケットに含める（不能時は申し送り+人間QA手順提示）を**追記**（置換でなく追記。検証実体は実装Phase側タスクが担保しX.N.2は提示に留める） |
| `.claude/skills/einja-review-plan/SKILL.md` | レビュアー「### B. タスク分割・依存関係」末尾に「最終受け入れゲート」観点1項目を追加 |

### ───────── B. プロジェクト仕様層（薄い思想整合・3ファイル）─────────

メカニクスは複製せず、SSOT（ガイド）へのポインタ＋高視座の原則のみ。

| ファイル | 変更 |
|---------|------|
| `.claude/skills/einja-project-requirements/SKILL.md` | 「重要な原則」に**原則7として新規追加**（既存の原則6を上書きしない）「**検収/受け入れの基準＝動く実物でユーザーが業務フローを端から端まで通せ価値が届くこと（E2E）。成果物の存在のみで検収完了としない**」。§14（qa-test整合）の生成方針に「最終受け入れシナリオはE2Eで」を1文補足 |
| `.claude/skills/einja-project-function-spec/SKILL.md` | 「重要な原則」に**原則11として追加**（既存の原則10の後）「**ここで定義した業務フローが下流のE2E受け入れシナリオの基準になる**」1行ポインタ |
| `.claude/skills/einja-project-screen-flow-figma/SKILL.md` | §1「このSkillはいつ起動するか」付近に「**画面遷移で定義する端から端までの導線が、E2E受け入れで検証するユーザージャーニーの基準になる**」1行注記 |

**人間QAテスト手順の出力先（設計判断）**: 主出力=`qa-test.md`（既存の「シナリオ一覧」手順テーブルの「種別」列に `人手E2E` を用いて記述。種別の定義はSSOT本文＝acceptance-criteria-and-qa-guide.md に置く）、申し送り先ポインタ=readiness-matrix `deferred-to` 列、受け入れ時の参照提示=tasks-generator 受け入れパケット（X.N.2）。requirements には手順を書かず「qa-test.mdに用意せよ」の要請注記のみ（ATDD責務分離）。

**再利用資産**: 既存 readiness level 定義・readiness-matrix の `deferred-to` 列・qa-test.md 手順テーブル・review-spec 横断ゲート機構（新ツール/Skill無し）。
**配布**: 全て原本（`docs/einja/` と `.claude/skills/einja-*`・`_einja-*`）。ビルドで `presets/default/` へ自動コピー（cli-package-specs 二重管理禁止準拠・presets側は直接編集しない）。ルート新規ファイル追加無し → template-whitelist 更新不要。

## タスク概要

- **0-0**: TaskCreate一括登録（A系列7 + B系列3 + 検証、依存明示）
- **0-1**: Plan配置 `docs/plans/202606/20260617-final-acceptance-e2e-ready-gate.plan.md`（現作業環境の保存先・命名規則に従う）
- **0-2**: worktreeは作成せず現feature ブランチ上で直接作業（ドキュメント/Skillのみの変更でworktree例外に該当。worktree fresh baseRef=origin/main は 4f90965 を含まず編集対象ファイルが古くなるため不可。コミット先も feature/spec-process-resilience-harness が正）

**A. Issue仕様層**
- A1: acceptance-criteria-and-qa-guide.md **【SSOT本文・最優先】** [Task] ← A2以降の参照元
- A2: einja-review-spec §G6 [Task]（A1後）
- A3: requirements.md.template [Task] / A4: readiness-matrix.md.template [Task] / A5: task-management.md [Task] / A6: tasks-generator SKILL [Task] / A7: review-plan SKILL [Task]（A1後に並列）

**B. プロジェクト仕様層（A1後・Aと並列可）**
- B1: project-requirements [Task] / B2: project-function-spec [Task] / B3: project-screen-flow-figma [Task]（A1のSSOT節確定後に並列）

**検証**
- 99-1: 観点別並列コードレビュー [`einja-review-code`]（差分確認含む。MAJOR→修正→再レビュー）
- 99-2: 動作確認（`grep` で §G6/最終受け入れ/E2E-ready の整合確認・SSOT集約と参照整合・既存§G1/§G5と番号衝突や矛盾が無いことを確認）+ ビルドで presets/default 反映確認
- 99-G: コミット承認ゲート [`AskUserQuestion`]（レビュー指摘全件報告含む）
- 99-3: コミット・プッシュ [`einja-task-commit`]

## 並列実行計画

```
A1（SSOT本文）→ ┬ A2 ∥ A3 ∥ A4 ∥ A5 ∥ A6 ∥ A7   （Issue仕様層）
                └ B1 ∥ B2 ∥ B3                   （project層・Aと並列）
→ 99-1 → 99-2 → 99-G → 99-3
```
- 全タスクが別ファイルのため A1 完了後は完全並列可。同一ファイル多重編集なし。
- 各サブエージェントに変更対象ファイルを明示、他ファイル編集不可、`git add` は対象ファイルのみを指示。

## リスク・不明点

| リスク | 対応 |
|-------|------|
| **§G5番号衝突（既存=AI processing flow gate）** | **新ゲートは §G6 に確定**（観点記号は増やさず観点Eの延長）。現状節・変更内容・検証方法すべて §G6 で記述済み。レビュー指摘の最重要対応 |
| 規約本文を各ファイルに複製し SSOT 違反 | 本文はガイドに集約・他は文字列パス参照。レビューで重複が無いか確認 |
| テンプレのガイド参照が相対リンクで破綻 | Markdown相対リンクを使わず文字列パス（`docs/einja/steering/...「節名」`）で参照。既存テンプレ記法に統一 |
| phase2_bundle 観点Eへ §G6 を付けるか | 適用範囲（requirements/tasks無条件）に合わせ phase2_bundleは§G6本体を付けず観点Cで人手E2Eシナリオ有無を見る（設計判断・確定済み） |
| 「最終Phase」の機械判定が tasks-generator に未定義 | A6で「Phase 99（ドキュメント反映）を除く最大Phase番号を最終受け入れ対象」と明文化 |
| qa-test.md「種別: 人手E2E」の定義箇所 | SSOT本文（acceptance-criteria-and-qa-guide.md）に記法を定義。テンプレ側は参照 |
| 実装順序: 20260528 Plan 先行マージで qa-test.md 構造変化 | 本Planは「種別」列に値を足すのみで構造非依存。20260528 は別サブセクション追加で衝突しないが、先行時は qa-test.md 構造を再確認 |
| 「ユーザー導線の有無」判定が人手依存で免除の抜け道 | §G6でN/A理由必須化により緩和（完全には塞げない＝許容） |
| テンプレ内相対パス（ガイドへのリンク） | A3/A4/A5で既存テンプレのリンク記法に合わせ実配置の相対パスを検証 |
| 実行層（未実装Plan 20260528）との重複 | 本Planは「申し送り+人間QA手順を仕様時点で用意させる」入口ゲートに限定し、実行（デプロイ環境でAC実行）には踏み込まない。各所に境界文言を明記 |
| X.N.2 完了条件の既存AskUserQuestionフロー衝突 | 置換でなく追記に留める |

## 検証・動作確認方法

1. **SSOT集約**: `grep -rn "最終受け入れ\|E2E-ready" docs/einja/ .claude/skills/` で規約本文がガイドに1箇所・他は参照のみであることを確認
2. **§G6整合**: review-spec の §G6 チェック項目が規約ルール1〜4を網羅し、観点E参照・適用範囲（requirements/tasks無条件）・導入文「6 ゲート」が一貫しているか確認
3. **既存§G1/§G5非矛盾**: §G1（混在禁止）と §G6（到達下限）が重複・矛盾せず、既存 §G5（AI processing flow）と番号衝突していないことを確認
4. **生成時埋め込み**: requirements.md.template / readiness-matrix.md.template / tasks-generator が最終受け入れを生成物に反映する記述になっているか
5. **project層**: project-requirements/function-spec/screen-flow が思想整合（薄い原則＋ポインタ）に留まりメカニクス複製が無いか
6. **ビルド反映**: ビルドで `presets/default/` に10ファイルが反映されることを確認
7. **観点別レビュー**（99-1）+ codex-agent で要件カバレッジ・整合を独立検証
