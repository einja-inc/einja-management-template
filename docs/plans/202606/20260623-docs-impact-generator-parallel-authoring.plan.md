# 確定仕様Docsへの並列authoring（docs-impact-generator 新設・Phase 99再設計）

## Context

Issue-Spec AC遵守性強化（PR #159, main マージ済み `df9622b`）の終了時に「別Plan」として残した2つのフォローアップのうちの1つを実装する。

**解決したい問題:** 現状、Issue仕様（requirements/design）から「確定仕様Docs」（Steering / Feature仕様）への反映は、実装が**全部終わった後**の `einja-task-exec` Phase 99 で `docs-updater` エージェントが事後的に推論して行う「docs-updater任せ」になっている。このため:
1. 反映先の判断材料（要件ヒアリングの文脈）が実装完了時には薄れている
2. `docs-updater` の反映先判定が AskUserQuestion 依存だが、Phase 99 はサブエージェント環境で対話不可 → 実質破綻
3. 既存バグで反映先パスが壊れている（後述）

**目指す姿（ユーザー承認済み方針）:** requirements 生成と**並列**で「Docs反映計画（`docs-impact.md`）」を作る `docs-impact-generator` エージェントを新設。反映先の意思決定を**仕様作成時（Phase 1, 親が対話可能な文脈）に前倒し**し、Phase 99 はその計画を読んで**決定論的に反映実行**するだけにする。

## 現状（調査で確定した事実）

| 項目 | 事実 | 出典 |
|------|------|------|
| spec-create フロー | Phase 0〜3。Phase 1a=requirements-generator 起動。Docs反映は**含まない** | `.claude/skills/einja-issue-spec-create/SKILL.md` |
| Issue仕様の保存先 | `docs/specs/issues/{カテゴリ}/issue{N}-{機能名}/{requirements,design,qa-test}.md` | spec-create SKILL L508-541 |
| Docs反映の実行場所 | `einja-task-exec` Phase 99（タスクグループ `99.*`）で docs-updater→einja-task-commit を直列実行 | task-exec SKILL L538-569 |
| docs-updater | task-exec Phase 99 から Task 起動。`einja-update-docs-by-issue-specs` SKILL を Read して反映 | `.claude/agents/einja/docs/docs-updater.md` |
| 反映先 | Steering: `architecture.md`/`db-schema-design.md`/`product.md`、Feature: `docs/specs/features/<feature>/{requirements,design}.md` | `einja-update-docs-by-issue-specs/SKILL.md` |
| **バグ1** | SKILL が反映先を `db-design.md` と記載。実ファイルは `db-schema-design.md`（リネーム由来の壊れた参照） | SKILL L206,208,344,417,432 |
| **バグ2** | docs-updater.md は入力元を `docs/specs/tasks/` と記載。実在は `docs/specs/issues/`（agent側が古い） | docs-updater.md L11,26 |
| **バグ3** | `docs/specs/features/` が**未実在**（`docs/specs/` 配下は `issues/` のみ） | `ls docs/specs/` |
| AskUserQuestion依存 | SKILL の Feature判定(L43-63)・重複処理(L267-280)・最終承認(L330-354)が対話必須 → Phase 99（無人サブエージェント）で破綻 | SKILL本文 |
| §6文言のSSoT | エラーメッセージ文言は `requirements.md §6.2` が正本。VR-ID 等の識別子は未導入。AC 行は既に `§6` を参照する慣行あり | requirements.md.template §6 / acceptance-criteria-and-qa-guide.md |
| 配布の仕組み | `docs/einja/` はビルド時 `copy-presets.mjs` で preset へ丸ごと自動コピー。`docs/specs/` は配布対象外（プロジェクト・ローカル作業データ） | `packages/cli/scripts/copy-presets.mjs` L61-64 / create-app `template-update.ts` |

## 変更内容（推奨アプローチ）

### 設計の核
- `docs-impact-generator` は **エージェント**（既存パターン: generator=agent, ルール/フォーマットのSSoT=Skill に整合）。`requirements-generator` 等と同じ `issue-specs/` 配下に配置。
- 並列起動ゆえ requirements.md にまだ依存できないため、入力は **Phase 0.3 の要件ヒアリングサマリ + 事前調査結果 + 既存 Steering/Feature の現状**（requirements-generator の Step 0 と同一ソース）。
- `docs-impact.md` は **「反映計画（plan）」であり「反映本文（content）」ではない**。本文は requirements/design 確定後の Phase 99 で生成。Phase 1 では「どこに・何を・どの粒度で」を決めるメタ計画に徹する。
- **Feature判定（どの Feature に集約するか、新規か既存か）を Phase 1 に前倒し**。docs-impact-generator が判断必須点を PENDING_QUESTIONS で返し、親（spec-create オーケストレーター）が AskUserQuestion で解決→ docs-impact.md の targets に記録。これにより Phase 99 から AskUserQuestion を排除。

### `docs-impact.md` 構造（YAMLフロントマター + Markdown本文）
- frontmatter: `targets[]`（`id` / `file` / `section` / `action`(append|merge|new-section) / `source_section`（Phase 99 が本文生成時に参照する確定仕様の出所）/ `status`(confirmed|tentative) / `rationale`）、`unresolved[]`（Phase 99 が本文生成前に必ず確認すべき残課題）
- 本文: 反映サマリ表（人間レビュー用）
- トレーサビリティ: 反映先に `<!-- Issue: #N (日付) source: T1 -->` マーカー埋込（現行 SKILL のラベル方式踏襲）。docs-impact.md 自体が spec ディレクトリに残り backward 追跡可能

### 反映スコープ（ユーザー選択: Steering3 + Feature仕様 + §6文言SSoT）
- **Steering 3点**: `architecture.md`(design由来), `db-schema-design.md`(design由来), `product.md`(requirements由来) へ非破壊追記
- **Feature仕様**: `docs/specs/features/<feature>/{requirements,design}.md` を**新設**。命名=ケバブ・ドメイン名詞（`login`等、Issueプレフィックス禁止）。複数Issueを `## Issue: {名} ({日付})` ブロックで時系列追記（既存 SKILL の非破壊マージ準拠）。専用テンプレは作らず既存 `requirements/design.md.template` を流用
- **§6バリデーション文言SSoT伝播**: `requirements.md §6.2 フィールド別ルール`（エラーメッセージ列、`requirements.md.template` L294-296 に実在を確認）を唯一の正本とし、`api-development.md` の **§5 バリデーション戦略**（実ファイル L373、Zodスキーマの章）へは**参照リンク化**（文言を転記しない）。**【実装時の事実訂正】VR-ID（`VR-{Story#}-{連番3桁}`）は PR #159 で既に導入済み**、`acceptance-criteria-and-qa-guide.md` に「§6.2 を文言SSoTとする原則」も既存（L301, L312）。計画時の「VR-ID 未導入」前提は誤りのため**既存VR-ID規約を維持**し、acceptance-criteria への追記は重複回避のため最小（既存で充足なら追記なし）。`einja-review-spec` の grep 突合観点に「§6.2 文言の重複直書き検査」を追加。ただしエラーメッセージは自然言語のため grep 機械突合の検出力には限界がある → **機械検査は補助、最終はレビュアー目視**と位置づけ（検証3で実効性を確認）

### Phase 99 再設計
- docs-impact.md **存在**: docs-updater が frontmatter targets を SSoT として処理。`confirmed`→source_section から本文生成して反映、`tentative`→requirements/design 確定内容と突合（矛盾なし反映／矛盾あり PENDING_QUESTIONS）、`unresolved` 残存→PENDING_QUESTIONS。AskUserQuestion 完全排除
- docs-impact.md **不在**（旧Issue）: フォールバック=Steering 3点のみ反映に固定、判断必須点は PENDING_QUESTIONS で親へエスカレーション（現行の features 参照破綻より厳密に改善）

### 既存バグ修正（同時実施）
- `db-design.md`→`db-schema-design.md`（SKILL **5箇所**: L206,208,344,417,432）
- `docs/specs/tasks/`→`docs/specs/issues/`（docs-updater.md 2箇所: L11,26）
- `docs/specs/features/` 新設（`.gitkeep` or README で空ディレクトリ確定）

### docs-impact.md スキーマSSoT に含める決定論ロジック（タスクA で SKILL に明記）
Phase 99 の docs-updater が推測実装に走らないよう、以下を SKILL のスキーマ定義§に**アルゴリズムとして**記述する:
- **`tentative` 突合**: docs-updater が `source_section` で指す requirements.md/design.md の確定セクションを Read し、target の `section`/`action` と矛盾しないか判定。矛盾なし→反映、矛盾あり→当該 target を PENDING_QUESTIONS 化（スキップして握りつぶさない）
- **`unresolved` 処理順**: アーリーリターンせず **targets 全件を処理し切ってから** 残った unresolved/突合失敗を1本の PENDING_QUESTIONS にまとめて返す（部分反映を最大化し再開コストを下げる）
- **`source_section` の事後ズレ**: 並列起動ゆえ Phase 1 時点の source_section は仮置き。Phase 1c の整合チェックで親（spec-create オーケストレーター）が requirements.md 確定後に docs-impact.md を必要に応じ更新（誰が更新するか＝親、を SKILL/spec-create に明記）

### 変更対象ファイル
| # | パス | 新規/修正 | 内容 |
|---|------|----------|------|
| 1 | `.claude/agents/einja/issue-specs/docs-impact-generator.md` | **新規** | エージェント定義。入力=ヒアリングサマリ+事前調査+既存Docs、出力=docs-impact.md、PENDING_QUESTIONS対応、ルールSkillをプリロード |
| 2 | `.claude/skills/einja-update-docs-by-issue-specs/SKILL.md` | 修正 | (a)バグ1修正 (b)docs/specs/issues統一 (c)**docs-impact.md スキーマ定義§追加**（生成側/消費側の共有SSoT） (d)AskUserQuestion対話点を決定論ルール+PENDING_QUESTIONSへ置換 (e)Feature命名規則・§6.2文言SSoT追記方針を明記 |
| 3 | `.claude/agents/einja/docs/docs-updater.md` | 修正 | バグ2修正、入力に docs-impact.md 追加、処理フローに「**docs-impact.md 存在チェック分岐**（存在→決定論ルート / 不在→Steering 3点フォールバック）」を新設（現状フォールバック記述はゼロ＝新規追加） |
| 4 | `.claude/skills/einja-issue-spec-create/SKILL.md` | 修正 | Phase 1a に docs-impact-generator 並列起動、1c に整合チェック（+source_section の事後更新責務）、1d レビュー対象に docs-impact.md、1e/1f 確認・コミット、成果物構成に docs-impact.md 追加 |
| 5 | `.claude/skills/einja-task-exec/SKILL.md` | 修正 | Phase 99（L538-569）再設計: docs-impact.md 存在判定→決定論/フォールバック分岐、**Phase 99 が返す PENDING_QUESTIONS のハンドリング**（現状「即座に終了」L106-124 に、unresolved 時は親へエスカレーションする分岐を追加）、prompt例を `docs/specs/issues/`+docs-impact.md 参照に更新 |
| 6 | `.claude/skills/einja-review-spec/SKILL.md` | 修正(小) | `requirements` scope に docs-impact.md 追加、観点に「反映先実在性・source_section妥当性」追記。※`acceptance-criteria-and-qa-guide.md`/`api-development.md` の**実体編集は行わない**（タスクG担当） |
| 7 | `docs/einja/steering/development/api-development.md` | 修正(G) | **§5 バリデーション戦略**末尾(managed領域内)に「エラーメッセージ文言の正本は requirements.md §6.2」参照注記 |
| 8 | `docs/einja/steering/acceptance-criteria-and-qa-guide.md` | 修正(G) | §6.2 を文言SSoT とする原則を1段落明文化(managed領域内) |
| 9 | `docs/specs/features/.gitkeep`(or README) | **新規(G)** | 空ディレクトリの確定。配布対象外 |
| - | `packages/cli/presets/default/...` | 自動再生成 | `copy-presets.mjs`（ビルド時にマーカー検証 `validate-markers.mjs` 実行）が原本から再生成。**手で触らない** |

> **編集対象ファイルの排他割当（衝突回避）**: タスクA は `einja-update-docs-by-issue-specs/SKILL.md` のみ。タスクF は `einja-review-spec/SKILL.md` のみ。`docs/einja/steering/` 実体ファイル（`api-development.md`, `acceptance-criteria-and-qa-guide.md`）と `docs/specs/features/.gitkeep` の実体編集は**すべてタスクG に集約**。A/F は Steering を「参照記述」するのみで実体は触らない。これにより並列グループ内のファイル衝突を排除する。

## タスク概要

- **0-0**: タスク分解して TaskCreate 一括登録（依存関係明示）
- **0-1**: Planファイルを `docs/plans/202606/20260623-docs-impact-generator-parallel-authoring.plan.md` に配置 [Write]
- **0-2**: worktree作成（複数ファイル横断のため）[`_einja-worktree-guide` / EnterWorktree]
- **A**（最上流・単独先行）反映規約SSoT拡張 [`Edit`] — `einja-update-docs-by-issue-specs/SKILL.md`（バグ修正+docs-impact.mdスキーマ定義+決定論ルール化）。**A完了が B/C/E の語彙・スキーマSSoT**
- **B**（A後・並列）docs-impact-generator エージェント新設 [`Write`] — `requirements-generator.md` を雛形に並列起動契約を踏襲
- **C**（A後・並列）docs-updater 修正 [`Edit`] — バグ2+docs-impact.md駆動フロー
- **D**（A後・並列）spec-create Phase 1 統合 [`Edit`] — 並列起動・整合チェック・レビュー・確認・コミット・成果物構成
- **E**（A後・並列）task-exec Phase 99 再設計 [`Edit`]
- **F**（A後・並列）review-spec scope拡張 [`Edit`]
- **G**（独立・全工程と並列可）Steering文言SSoT追記＋ディレクトリ整理 [`Edit`] — `api-development.md §5` / `acceptance-criteria-and-qa-guide.md` / `docs/specs/features/.gitkeep`。**冒頭で `docs/specs/` と `docs/einja/steering/` 配下の階層を棚卸し**し、整理が必要なら対象を列挙、不要なら「features 新設のみ・他は現状維持」と根拠（Steering 階層再編は参照波及が大きく過剰）を明記
- **99-1**: 観点別並列コードレビュー [`einja-review-code`] + 差分確認
- **99-2**: 動作確認（後述）
- **99-G**: コミット承認ゲート [AskUserQuestion]
- **99-3**: コミット・プッシュ [`einja-task-commit`]

## 並列実行計画

```
A（規約SSoT拡張: 語彙・スキーマ確定）── 単独先行
   └─ A完了後、B/C/D/E/F を同時着手（互いにファイル独立）
G（Steering文言追記+features新設）── A非依存・全工程と並列可
99系 ── B〜G 全完了後に直列
```
- 並列グループ {B, C, D, E, F, G} は変更対象ファイルが重複しないため衝突なし
- D(spec-create) と E(task-exec) は docs-impact.md の「生成側」「消費側」で、両者とも A が定義するスキーマに依存するため A 完了が前提

## リスク・不明点

| リスク | 対応 |
|--------|------|
| docs-impact.md スキーマが生成側(B)/消費側(C,E)でズレると決定論性が崩れる | スキーマSSoTを A（SKILL）に一元化。B/C/E は A を参照のみ。二重定義しない |
| 並列起動で requirements.md 未確定のまま反映先を誤判定 | docs-impact.md は「計画」のみ。`tentative`/`unresolved` で確定先送り。本文確定は Phase 99 |
| Feature判定の前倒しで Phase 1 のユーザー確認回数が増える | requirements-generator と docs-impact-generator の PENDING_QUESTIONS を親が1回の AskUserQuestion に統合 |
| `@einja:managed` マーカー破壊でビルド失敗 | Steering編集は managed 領域内のみ。マーカー行を触らない。prepush で検証 |
| 旧Issue（docs-impact.md なし）の Phase 99 が無人で詰まる | フォールバック=Steering 3点固定+PENDING_QUESTIONS で完走保証。docs-updater 現状にフォールバック記述ゼロ→タスクC で新規追加 |
| Feature spec 階層を「廃止すべき」という別案あり（Agent 1） | ユーザーが Q2 で Feature を反映先に明示選択。前倒しで AskUserQuestion 懸念は解消するため**新設で確定** |
| `tentative` 突合・`unresolved` 処理を B/C/E が推測実装 | アルゴリズムをタスクA（SKILL スキーマ§）に明文化（突合手順・全件処理後 PENDING_QUESTIONS 集約・source_section 事後更新の責務） |
| §6.2 文言の重複直書きを grep で検出しきれない | 自然言語ゆえ機械検査は補助。レビュアー目視を最終手段と位置づけ、検証3で実効性を確認 |
| `api-development.md` の対象セクション取り違え | §5 バリデーション戦略（L373）と実ファイルで確定済み。§6 はエラーハンドリングのため対象外と明記 |

## 検証・動作確認方法

ドキュメント/Skill/エージェント定義の変更のため、実コード実行はなし。以下で検証:
1. **整合性 grep**: `db-design.md` の壊れた参照が全消滅（`grep -rn "db-design.md" .claude/` が 0 件）、`docs/specs/tasks/` の残存なし
2. **スキーマ一貫性**: docs-impact.md スキーマが A(SKILL) で1箇所定義され、B/C/E が同一フィールド名を参照していること（grep でフィールド名突合）
3. **ドライラン的レビュー**: サンプル docs-impact.md に**意図的な違反**（実在しない反映先・§6.2 文言の重複直書き）を仕込み、`einja-review-spec` の追加観点でレビュアーが検出できるか確認。検出困難なら「機械検査は補助・目視最終」とリスク欄通りに運用
4. **ビルド検証**: `pnpm prepush`（内部でビルド→`copy-presets.mjs`＋`validate-markers.mjs` 実行）が通り、(a)`presets/default/` へ原本が正しくコピーされ managed マーカーが保持される (b)**新規 `presets/default/.claude/agents/einja/issue-specs/docs-impact-generator.md` が生成される**こと
5. **フロー机上検証（最終受け入れゲート）**: spec-create Phase 1（並列起動→docs-impact.md生成）と task-exec Phase 99（docs-impact.md読込→決定論反映）が矛盾なく繋がるか親視点でトレース。**合格基準**: docs-impact.md の `targets[]` 各フィールド（特に `action`(append/merge/new-section)・`status`(confirmed/tentative)）と Phase 99 の分岐（confirmed→反映 / tentative→突合 / unresolved→PENDING_QUESTIONS）が**1対1で対応する網羅マッピング表**を作成し、未対応の組合せが無いことを確認（このマッピング表をトレース成果物とする）
