# QAシナリオのPhase対応明確化 ＋ 人間受け入れテスト(xlsx)ハイブリッド導入

## Context

spec-create / issue実行のQAプロセスに2つの課題があり、Codexとの議論・ユーザー確認を経て改善方針が確定した。

- **テーマ①（scenarios.md ↔ Phase 対応の不明瞭さ）**: `scenarios.md` の「実施タイミング」はAC実装ベースで書かれ、`tasks-generator` が各タスクの `**シナリオテスト**:` メタデータに変換している。しかし (a) その変換ロジックが暗黙的で脆い、(b) `_einja-task-qa/SKILL.md:70-71` の「現在のPhaseに対応するシナリオIDを特定する」が実態（AC番号→Story番号ルーティング）と食い違い誤解を招く、(c) `einja-task-exec` がタスクの `**シナリオテスト**:` を task-qa に明示的に渡していない、というギャップがある。
- **テーマ②（人間の受け入れテスト手順の置き場・形式が未定義）**: 直近で `人手E2E`（マージ/デプロイ後に人間が本番相当環境で打鍵）シナリオを追加したが、**人間が記入・証跡添付する運用フォーマット**が未定義。ユーザーは「タブをコピーしてOK/NG・証跡を記入するxlsx運用」を希望。

確定した方針（Codex議論＋ユーザー確認済み）:
- テーマ①: Codex推奨どおり「scenarios.md は変更せず、変換ロジックを明文化＋task-qaの誤解記述を修正＋task-execで伝達」。
- テーマ②: **ハイブリッド** — 手順のSSOTはMarkdown（qa-generator生成）、そこから**実施用xlsxワークブックを生成**。生成は `tasks-generator` が**最終フェーズに固定タスク**として差し込み、実装完了後に確定Markdownから生成（実装前生成による陳腐化を回避）。xlsx生成は**独自のopenpyxl薄ラッパー**（Anthropic公式xlsxスキル `github.com/anthropics/skills` は "source-available・再配布不可" のため同梱せず、アプローチのみ参考）。
- **xlsx生成スクリプトは新規Skillのディレクトリ配下に置く**（ユーザー指示）。
- コミット: **1PR・テーマ別コミット**（過去方針「1PR優先」に整合）。

## 現状（修正対象の所在）

### テーマ①
| ファイル | 現状 |
|---------|------|
| `.claude/agents/einja/issue-specs/tasks-generator.md` | 128-131行・389-430行に「シナリオテスト記載ルール」。scenarios.mdの実施タイミング→該当ACを実装するタスクへ転記する設計だが、AC実装タイミング→タスクグループの**変換ロジックは暗黙的**（自然言語解釈任せ）。287-351行にPhase末尾タスク・Phase 99の固定差し込みパターン（固定タスク追加の前例） |
| `.claude/skills/_einja-task-qa/SKILL.md` | 70-71行「scenarios.md を読み込み、**現在のPhaseに対応するシナリオIDを特定する**」（実態と食い違う誤解記述）。118-119行・430行はAC番号→Story番号ルーティング（正しい） |
| `.claude/skills/einja-task-exec/SKILL.md` | 441-446行 Step 6（task-qa起動）。タスクの `**シナリオテスト**:` メタデータをtask-qaに**渡す記述が無い**。148行でパースはしている |
| `.claude/agents/einja/issue-specs/qa-generator.md` | 473-539行 scenarios.md構造、531-535行 実施タイミング3パターン。Phase情報を持たない（design-generatorと並列・先行のため。`einja-issue-spec-create/SKILL.md` Phase2三又並列で確認済み） |

### テーマ②
| ファイル | 現状 |
|---------|------|
| `docs/einja/templates/qa-test.md.template` | **これは story{N}.md の構造テンプレート**（qa-generator.md:256が参照）。`qa-test.md` というファイルは生成されない。58行 種別凡例に`人手E2E`、67行 SC-06行、209-233行 SC-06本体（229行 `### 結果` は status/実施日/実施者のみの骨格） |
| **`人手E2E` シナリオの実体** | qa-generator が生成するのは `story{N}.md` / `scenarios.md` / `README.md`。**`人手E2E` シナリオは story{N}.md の「シナリオ一覧」に置く設計**（qa-generator.md:264、guide「種別 `人手E2E` の記法」）。scenarios.md は「複数タスクをまたぐフロー」専用で人手E2Eの置き場ではない |
| `docs/einja/example/specs/issues/issue999-example-task/qa-tests/README.md` | 34行 証跡保存先・命名規則 `AC{Story#}-{Cat}-{N|E}-{連番3桁}-{内容}` |
| `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | 41-55行「最終受け入れの readiness 下限」節（人手E2Eの存在は規定済みだが、実施者の具体運用が不足） |
| `docs/einja/steering/task-management.md` | 固定タスク種別の定義場所（tasks-generatorのSSOT） |
| Skill配布 | `copy-presets.mjs` が `.claude/skills/einja-*/` `_einja-*/` プレフィックスのディレクトリを自動スキャンして配布。新Skillは `einja-` プレフィックスで配布対象になる |

source-of-truth はビルド時に `presets/default/` へ自動コピー。**コピー先は直接編集しない**。

## 変更内容（推奨アプローチ）

### コミットA: テーマ①（scenarios.md ↔ Phase 対応の明確化）

1. **`tasks-generator.md`**: 「シナリオテスト記載ルール」(389-430行付近) に、**AC実装タイミング→タスクグループへの変換ロジックを明文化**。「scenarios.mdの実施タイミングに列挙された各ACを、そのACを実装するタスクグループの `**シナリオテスト**:` に転記。複数Storyにまたがる場合は該当する全タスクに記載」を追記。
   - **人手E2E除外ルール（MINOR-3対応・テーマ①②接続点）**: 「`種別: 人手E2E` のシナリオは自動シナリオテスト割当の対象から除外する（実装フェーズのタスクに `**シナリオテスト**:` として割り当てない）。人手E2Eはマージ/デプロイ後のUATであり、テーマ②のUAT固定タスクで別途管理する」を明記する。
2. **`_einja-task-qa/SKILL.md`**: 70-71行の「現在のPhaseに対応するシナリオIDを特定する」を**「task-execから渡された `**シナリオテスト**:` 指定、および scenarios.md の実施タイミングに基づき、実行すべきシナリオと実行範囲（部分/フル/リグレッション）を特定する」**に修正。ステップ3(118-119行)の単一Story例に「実装ACが複数Storyにまたがる場合は該当する全 `story{N}.md` を対象にする」旨を1文追記。
3. **`einja-task-exec/SKILL.md`**: Step 6（441-446行）に「task-qa起動プロンプトに、当該タスクグループの `**シナリオテスト**:` メタデータ（実行すべきシナリオIDと実施範囲）を含めて渡す」を追記。
4. **`qa-generator.md`**: scenarios.md構造説明(473-539行付近)に**設計意図注記**「Phase/タスク番号への割当は tasks-generator が行うため、qa-generator 生成時点では AC実装ベースの実施タイミングのみ記載する」を追記。

### コミットB: テーマ②（人間受け入れテスト xlsx ハイブリッド）

**設計フロー**: spec-create時に qa-generator が手順SSOT(Markdown)を生成 → tasks-generator が最終フェーズに固定タスクを差し込み → 実装完了後に固定タスク実行で確定Markdownから `手動シナリオテスト_Issue{N}.xlsx` を生成 → 人間がタブ複製(`テスト実施_名前_YYYYMMDD`)→打鍵→OK/NG・証跡記入。

**責務分界（二重管理の回避）**: Markdownは**手順の定義（SSOT）**。xlsxは Markdownから**一方向生成**され、**人間UATの実施結果（OK/NG・証跡）はxlsxに記入**する。pre-merge の AI/自動テスト結果は従来どおり story{N}.md / evidence/ に記録（別ステージなので重複しない）。

1. **新規Skill: `.claude/skills/einja-uat-workbook/`**（ユーザー指示によりスクリプトはSkillディレクトリ配下に配置）
   - `SKILL.md`: 人間受け入れテスト用xlsxワークブックの生成手順・運用（タブ複製方式・OK/NG・証跡記入）を定義。Anthropic公式xlsxスキルのopenpyxlアプローチを参考にした旨を明記
   - `gen-uat-xlsx.py`（Skill同梱スクリプト・openpyxl）:
     - **入力**: spec_dir。**主入力 = `qa-tests/story{N}.md` 内の種別 `人手E2E` のシナリオ（テスト手順テーブル）**。`scenarios.md` は補助参照に留め、`qa-test.md` は存在しないため参照しない。
     - **パーサーアンカー仕様**: qa-generator が生成する**SC基準**story{N}.md（`## シナリオ一覧` テーブルの `種別` 列＋ `## SC-NN: ...` セクション＋ `**種別**: 人手E2E` ＋6列手順表。＝template の構造）を前提に、**`**種別**: 人手E2E` を含むSCセクション直後の手順表（`| No | 手順 | ... |`）をパース対象**とする。区切り行（`|---|`）はスキップ。アンカー仕様をSKILL.md・スクリプトコメントに明記。
     - 出力: `{spec_dir}/qa-tests/手動シナリオテスト_Issue{N}.xlsx`
     - 構成: ①凡例/概要シート（記入方法・ステータス定義・タブ複製手順）②手順マスタシート。**Markdown→xlsx列マッピング**: Markdown6列 `No/手順/確認項目/期待値/結果/備考` → xlsx7列 `No/手順/確認項目/期待値/結果[OK/NGデータ検証ドロップダウン]/証跡ファイル名[新規・空]/備考`。ヘッダに実施日/実施者/環境URL/全体ステータス。
     - **best-effort設計**: openpyxl未導入時は明確なエラー（`pip install openpyxl が必要` ＋ Markdown手順はそのまま使える旨）を出して非0終了。
   - 配布: `einja-` プレフィックスSkillなので copy-presets で自動配布。**ホワイトリスト更新不要**
2. **`tasks-generator.md`（固定タスク追加）**: 固定差し込みパターン(287-351行)に倣い、固定タスク「人間受け入れテスト手順書(xlsx)生成」を追記。**配置 = 最終実装Phaseの末尾タスクグループ（Phase 99 の前）**。Phase 99（ドキュメント反映専用・task-execが `99.*` を docs-updater にルーティング）には入れない。タスク内容＝`einja-uat-workbook` Skillで `qa-tests/手動シナリオテスト_Issue{N}.xlsx` を生成。
3. **`docs/einja/steering/task-management.md`**: 固定タスク種別に「人間受け入れテスト手順書生成タスク」を追記。
4. **`qa-test.md.template`（=story{N}.md構造テンプレ）**: SC-06(人手E2E)の `### 結果`(229行)を整理。**二重管理回避**: `### 結果` を「全体ステータス＋実施記録は xlsx を参照」のポインタに置き換える。
5. **Skill同梱フィクスチャ `fixtures/sample-story.md`**: 正準SC基準・人手E2Eシナリオを含む自己完結フィクスチャをSkillディレクトリ内に配置し、gen-uat-xlsx.py の動作確認（99-2）に使う。
6. **`acceptance-criteria-and-qa-guide.md`**: 「最終受け入れの readiness 下限」節(41-55行)に**「人手E2E 実施運用」小節**を追加（story{N}.md→xlsx生成→人間がタブ複製・OK/NG・証跡記入、openpyxl前提）。
7. **example の更新はスコープ外（申し送り）**: 下記リスク欄参照。

**Skill-First評価**: ユーザー指示により**Skill化**（`einja-uat-workbook`）。反復運用（spec毎にUATワークブック生成）であり、生成手順＋運用ルール＋スクリプトをSkillに集約するのは妥当。`einja-skill-plan-guide` ワークフローAでSKILL.md仕様を策定。

## タスク概要

- **0-1**: Planファイルを `docs/plans/202606/20260617-qa-scenario-phase-and-uat-xlsx.plan.md` に配置 [Write]
- **0-0**: TaskCreateで全タスク登録（依存・並列を明示）
- **0-2**: worktree作成 [_einja-worktree-guide]
- **0-3**: `einja-uat-workbook` Skill仕様策定 [einja-skill-plan-guide ワークフローA]
- **A-1**: テーマ① 4ファイル編集（tasks-generator変換ロジック＋人手E2E除外 / task-qa / task-exec / qa-generator） [Edit]
- **B-1**: `einja-uat-workbook` Skill作成（SKILL.md + gen-uat-xlsx.py[アンカー仕様・列マッピング明記] + fixtures/sample-story.md[正準SC基準・人手E2E含む]） [einja-skill-creator / Write]
- **B-2**: テーマ② ドキュメント群編集（tasks-generator固定タスク[Phase99前] / task-management / template[SC-06結果→xlsxポインタ] / guide[人手E2E実施運用]） [Edit]
- **99-1**: 観点別並列コードレビュー [einja-review-code]（A: Skill設計観点、B: ドキュメント/プロンプト整合＋Pythonスクリプトのコード品質・異常系）
- **99-2**: 動作確認 [Bash]: Skill同梱 `fixtures/sample-story.md` を入力に `python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py <spec_dir>` を実行しxlsx生成・soffice検証。grep整合確認。`node packages/cli/scripts/copy-presets.mjs`（dev-cli）+ create-app テンプレ取り込み経路の双方で Skill配布を確認
- **99-G**: コミット承認ゲート [AskUserQuestion]
- **99-3**: テーマ別2コミット＋プッシュ [einja-task-commit]（A: テーマ①、B: テーマ②＋Skill＋Planファイル）

### 並列実行計画
- A-1（テーマ①）と B-1/B-2（テーマ②）はテーマが独立。ただし両テーマとも `tasks-generator.md` を編集するため**同ファイル競合に注意**（A-1=389-430行付近、B-2=287-351行付近で箇所は異なるが、安全のため tasks-generator.md は1エージェントが直列編集 or 親が直接Edit）。
- **依存関係**: B-1（Skill作成＋fixtures/sample-story.md）→ 99-2（フィクスチャを入力にスクリプト動作確認）。フィクスチャはSkill同梱なので外部依存なし。
- worktree使用（0-2）。前例: `einja-md-export/scripts/*.py`、`einja-skill-creator/scripts/*.py` でSkillへのPythonスクリプト同梱は確立パターン。

## リスク・不明点
- **tasks-generator.md の二テーマ同時編集**: 競合回避のため同ファイルは直列編集。
- **openpyxl下流可用性**: 下流のエージェント環境に openpyxl が無い場合あり。スクリプトをbest-effort化し、SKILL.md/ガイドに「`pip install openpyxl`（soffice任意）」を明記。Markdownが常にfallback。
- **Skill内Python**: 既存前例（`einja-md-export/scripts/*.py` 等）に倣い `einja-uat-workbook/gen-uat-xlsx.py` を配置。`python3` 直接実行をSKILL.mdで案内（package.jsonエントリは追加しない）。
- **xlsxバイナリのGit差分**: 人間がxlsxに結果記入するとバイナリ差分が出る（ユーザー了承済みのトレードオフ）。手順SSOTはMarkdownに残す。
- **Markdownテーブルのパース脆弱性**: アンカーは `**種別**: 人手E2E` セクション（SC基準）。表崩れ時はbest-effortエラーで通知。
- **【既存問題・申し送り】example と template のスキーマ乖離**: `docs/einja/example/.../qa-tests/`（story1-3 / README / scenarios）が旧**AC基準**のままで、現行 qa-generator/template の**SC基準**（`シナリオ一覧`/`SC-NN`/`人手E2E`）と乖離（本タスク以前から。grep確認済み: example qa-tests配下に該当語0件）。qa-generator は当該exampleを「テストファイル例」として参照しており（qa-generator.md:178）潜在バグ。**本タスクのスコープ外**とし、別タスクで example を SC基準へ移行することを推奨。本タスクは Skill同梱フィクスチャで動作確認を完結させ、exampleには触れない。

## 検証・動作確認方法
1. **文言整合/SSOT突合**: `grep -rn "シナリオテスト\|現在のPhase\|手動シナリオテスト\|人手E2E\|einja-uat-workbook" .claude docs/einja` で各記述が一貫しているか確認。task-qaの誤解記述が除去されたか確認。
2. **xlsx生成スクリプト動作**: Skill同梱の `fixtures/sample-story.md`（正準SC基準・人手E2E含む）を入力に `python3 .claude/skills/einja-uat-workbook/gen-uat-xlsx.py <spec_dir>` を実行し、xlsxが生成され、SC-06(人手E2E)手順がパースされ、凡例/手順マスタシート・OK/NGドロップダウン・証跡ファイル名列が入っているか確認（必要なら `soffice --headless --convert-to csv` で内容検証）。openpyxl未導入を模した場合に明確なエラーが出るか確認。
3. **ゲート整合**: tasks-generator（固定タスク差し込み）↔ task-management（種別定義）↔ guide（運用フロー）↔ template（ポインタ）↔ einja-uat-workbook（Skill）が相互に閉じているか目視。
4. **99系レビュー**: einja-review-code → 99-G → einja-task-commit（prepush）。
5. **ビルドコピー確認**: `node packages/cli/scripts/copy-presets.mjs` 後、`git diff --stat presets/default/` で対象ファイル＋`.claude/skills/einja-uat-workbook/` がpresets側へ反映されたことを確認（presetsは直接編集しない）。
