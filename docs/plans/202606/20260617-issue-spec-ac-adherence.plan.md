# Issue-Spec 受け入れ条件(AC)の遵守性(adherence)強化 改訂

## Context

Issue-Spec の受け入れ条件は「§4 振る舞いAC ↔ §6 入力ルール表」の分離・振る舞い単位の粒度ルールが**設計としては既に存在**する（`requirements.md.template` の `→§6` 参照、`acceptance-criteria-and-qa-guide.md` の「AC記述の粒度」節）。しかし **requirements-generator が生成する実ドキュメントがこの方針に従わないことが多い**——フィールドごとにACを水増しする、AC本文にバリデーション詳細を直書きする、等。

本改訂の主目的は新構造の発明ではなく、**既存ルールを「守られやすくする」（adherence強化）**。あわせて、可読性・凝集のための「シーン主軸の見出し」、AC↔ルールのトレーサビリティのための「VR-ID」を新規導入する。

スコープは Issue-Spec 層に閉じる。確定仕様Docsへの反映アーキテクチャ（docs-impact-generator）、PageSpec/project function-spec とのSSoT統合（PR #152 関連）は**別Plan**とし、本Planでは扱わない。

## 現状（調査で確定した事実）

- **シーン主軸・VR-ID は未実装**。既存は §4/§6 分離（`→§6` 参照）と粒度ノードまで。本改訂が新規導入。
- **カテゴリは AC-ID に残す必須**: `qa-generator.md` L303-307 が AC一覧表の「カテゴリ」列を読み、`UI→Browser` / `VAL→Unit+Browser` 等のテスト種別分岐に使う。IDからカテゴリを外すと壊れる。シーンは§4詳細の見出しのみで、AC一覧表のカテゴリ列には影響しない（＝qa-generator 非破壊）。
- **§6 入力ルール表・VR-ID の消費者はゼロ**。VR-ID列追加は安全。
- **example issue999/requirements.md** §4 は全3Storyがカテゴリ別見出し（`##### UI/NAV/...`）。§6.2 にVR-IDなし。
- **ビルド二重管理**: 原本は `docs/einja/` ・ `.claude/`。`packages/cli/scripts/copy-presets.mjs` が `presets/default/` へ自動コピー。**presets 直接編集禁止**。
- **既存バグ（ついで修正）**: `_einja-spec-context-loader/SKILL.md`（旧体系 `AC{N}.{M}` 前提）、`_einja-issue-spec-tasks-validator`（SKILL.md L81 / validation-rules.md L12 に旧 `AC1.1` 例示）。

## 確定した設計判断

1. **粒度**: ACの分割は「観測可能な結果(Then)が異なるか？」だけで決める。フィールド数・バリデーション種別数でACを増やさない。詳細は §6 へ委譲し AC本文は `（→§6 VR-1-001）` で参照。
2. **シーン主軸**: §4 AC詳細の見出しをシーン別にする。**固定enumにしない**——フォーム画面の推奨ベースライン＝`初期表示/入力中/送信時/送信成功時/送信失敗時`、ただし画面により増減（一覧/ウィザード/ダッシュボード等は異なる）。**「画面横断」だけは常設**し、横断AC（PERM/PERF/SEC）の受け皿とする（オーファン防止）。該当ACの無いシーンは空セクションを作らず省略。
3. **AC-ID 現状維持**: `AC{Story#}.{カテゴリ}.{N|E}.{連番3桁}`。カテゴリはIDに残し、一覧表の列にも併記。シーンはIDに入れない。
4. **VR-ID**: `VR-{Story#}-{連番3桁}`（例 `VR-1-001`）。§6.2 入力ルール表の各行に付与、§4 AC「参照」列から参照。**エラーメッセージ文言のSSoTは §6.2**（Issue-Spec内、現状維持）。
5. **example は統合して模範化**: issue999 の観測結果が同じVAL系ACは1本に統合し詳細を §6.2(VR複数行)へ。qa-tests のAC参照リンクも example 内で整合修正。
6. **追加（Codex合意）**: D分類(QA環境問題)に再試行上限・判定基準 / 強度MUST-SHOULD-MAYのリリースゲート / オーファン検出(QA Phase2 実装→AC逆引き) / SEC観点はカテゴリ新設せずレビューチェックリストで担保。

## 変更内容（推奨アプローチ）

遵守性は **5層を同一語彙で多重化**して担保する（単一指示では守られないため）。最も効くのは template スキャフォールドと example。

### 1. 規範SSoT: `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
- **既存「AC記述の粒度」節（L239付近）を先に読み、不足分のみ追加（重複記述を作らない）**。追加内容: 判定基準（Then差のみで分割）／DO／DON'T（フィールド単位AC・規則単位AC・本文直書きの3アンチパターン）／§4↔§6役割分担表／生成後セルフチェック4項目。
- シーン主軸の規範を追記（推奨ベースライン＋画面適応＋「画面横断」常設）。
- **既存 §8「失敗原因分類(A/B/C/D)」に追記**: §8.2(定義)/§8.3(優先順位)へ「D判定基準＝接続/タイムアウト/ポート/secret未注入を明示する場合のみD。実装由来例外をDに誤分類禁止」＋「再試行上限2回、3回目もD症状なら**ブロッカー昇格(人手判断)**」。
- **強度ゲートを §8.5 として新設**（表: MUST FAIL→リリース不可 / SHOULD FAIL→申し送り必須 / MAY FAIL→記録のみ）。
- **§7 QA実行フロー Phase2 に追記**: オーファン検出（実装差分→AC逆引き、AC無き実装は B:要件齟齬として requirements へAC追記を促す）。
- SEC: レビュー観点チェックリストとして §13 に外部入力→危険sink/authz/secrets を識別する記述。
- **このガイドが粒度・シーン語彙のSSoT**。下流（generator/template/review-spec）は要約＋参照に留め二重管理を避ける。

### 2. 権威プロンプト: `.claude/agents/einja/issue-specs/requirements-generator.md`
- AC採番ロジック節の直後に「振る舞い単位粒度の遵守ルール」小節（guide要約＋DON'T＋guideリンク）。
- §4構造節を改訂: AC詳細をシーン別見出しへ。横断ACは「画面横断」に集約。シーン語彙は画面適応・任意省略可を明記。
- §6記述ステップに「各行へ `VR-{Story#}-{連番}` 付与」。
- 品質チェックリストにセルフチェック4項目＋シーン構成＋VR-ID整合を追加。

### 3. 自己強制スキャフォールド: `docs/einja/templates/requirements.md.template`（最重要）
- §4 Story1 AC詳細をシーン見出し骨組みへ置換。各所に**インラインコメント**で誘導（`<!-- バリデーション詳細はここに書かず §6.2 のVR行へ。フィールドごとにACを増やさない -->`）。
- §4 冒頭「構造方針」を「シーン主軸＋振る舞い単位＋§6委譲」に更新。
- §4 AC一覧「参照」列サンプルを `§6 VR-1-001` 形式へ。
- §6.2 表の先頭に **VR-ID列**追加。

### 4. 模範例: `docs/einja/example/specs/issues/issue999-example-task/`
- requirements.md §4 を全3Storyシーン再編、AC-ID維持。観測結果が同じVAL系ACは統合（欠番/再採番が生じる）。
- §6.2 にVR-ID列付与、§4参照列からVR参照。
- qa-tests/（story*.md・scenarios.md）のAC参照リンクを統合後AC-IDに整合修正。

### 5. 検出ゲート: `.claude/skills/einja-review-spec/SKILL.md`（既存観点へ追記、新validator新設せず）
- **Skill-First結論**: 新規validatorは作らない（ビルド対象追加・配線・二重メンテのコスト＞便益。遵守チェックは生成直後1回で足りる）。既存 review-spec の観点に追記する。
- **観点割当（実態に合わせる）**: 観点B＝UI/UX・画面整合のため要件構造チェックは置かない。**粒度・§4/§6分離・VR-ID整合・シーン構成は観点C（トレーサビリティ）に追加**、**SEC観点は既存観点F（セキュリティ・脅威モデリング）に追記**（Planの「SECはカテゴリ新設せずチェックリスト」方針と観点Fが整合）。
- `requirements` scope に追加する**チェック項目（具体・箇条書きで記述）**:
  1. §4 AC詳細がシーン見出しで構成され「画面横断」が常設されているか（フォーム系画面）
  2. §4参照列のVR-IDが §6.2 の行に実在するか（双方向①）
  3. §6.2 の全行にVR-IDが付与されているか（双方向②）
  4. Then文が同一の複数ACが存在しないか（粒度重複＝Then差のみで分割。過検出防止のため「Then同文の重複のみ」に限定）
  5. AC本文に正規表現・桁数・形式詳細が直書きされず `→§6 VR-xxx` 参照になっているか／エラーメッセージ文言が §6.2 のみに存在するか
  6. SEC: §13 外部入力チェックリストを参照する生成後セルフチェックがあるか（観点F側）

### 6. 軽微追従＋既存バグ
- `einja-issue-spec-create/SKILL.md`: AC構造説明に「§4詳細はシーン見出し」1行追記（許容カテゴリ列挙は維持）。
- `tasks-generator.md` / `_einja-issue-spec-tasks-generator/SKILL.md`: ACサンプルの参照表記を新形式へ（AC-ID不変で影響小）。
- 旧体系バグ: `_einja-spec-context-loader/SKILL.md`、`_einja-issue-spec-tasks-validator`（SKILL.md L81・validation-rules.md L12）を新体系へ修正。
- `qa-generator.md` / `qa-test.md.template`: **変更不要**（カテゴリ→テスト種別マッピング・AC一覧表読み取りは不変）。

## タスク概要（依存・並列）

- **0-0** TaskCreateで全タスク登録
- **0-1** Planファイルを保存先・命名規則に従って配置 `docs/plans/202606/`
- **0-2** worktree作成 [`_einja-worktree-guide`]（複数ファイルの実質改訂のため作成）
- **A**（最上流・単独先行）規範SSoT改訂 [`Edit`] — `acceptance-criteria-and-qa-guide.md`（粒度DO/DON'T・シーン規範・D再試行・強度ゲート・オーファン・SEC）。A完了が B/C/E の語彙SSoT
- **B**（A後・並列）権威プロンプト [`Edit`] — `requirements-generator.md`
- **C**（A後・並列）スキャフォールド [`Edit`] — `requirements.md.template`
- **E**（A後・並列）検出ゲート [`Edit`] — `einja-review-spec/SKILL.md` 観点B
- **D**（C後）模範例 [`Edit`] — issue999 requirements.md §4再編・VR付与・VAL系AC統合 → 続けて qa-tests 整合修正。**統合でAC-IDが欠番/再採番される場合、影響は4種に及ぶ**: (a)story*.md本文の各ACセクション見出し (b)「対象AC」「完了AC: 0/N」の件数表記 (c)evidenceパス命名（`AC1-VAL-E-001-*` 等）(d)`scenarios.md` のAC列挙。**修正後 `grep` で欠番AC-IDへの参照が残っていないことを確認**
- **F**（全工程と並列可・独立）軽微＋旧体系バグ修正 [`Edit`] — issue-spec-create SKILL / tasks-generator / spec-context-loader / tasks-validator
- **99-1** 観点別並列レビュー [`einja-review-code`]＋差分確認
- **99-2** 動作確認（下記検証方法）
- **99-G** コミット承認ゲート [`AskUserQuestion`]
- **99-3** コミット・プッシュ [`einja-task-commit`]（prepush・presetsコピー確認含む）

## 並列実行計画

```
0-2 → A → ( B ∥ C ∥ E ∥ F ) ; C → D(→qa整合) ; 全完了 → 99系
```
A は単独先行（語彙SSoT確定）。A後に B/C/E/F を同時着手。D は C（テンプレ構造）確定後。F は語彙非依存のため全工程と並列可。

## リスク・不明点

- **example統合でAC-ID欠番/再採番** → qa-tests リンク切れ。D内で4種（本文/件数/evidenceパス/scenarios列挙）を整合修正＋grep確認（同一example内で完結、影響範囲限定）。
- **VAL統合のやりすぎ** → 観測結果が実際に異なるACまで潰すと検証漏れ。判定を「Then差のみ」に厳格固定、文言違いは§6行で表現。
- **シーン語彙の硬直化** → 固定enum化しない方針で回避。フォーム外画面はシーン任意、「画面横断」のみ常設。
- **guide↔generator 二重管理** → 詳細はguideがSSoT、generatorは要約＋リンク。
- **タスクFの並列前提** → Fの旧体系バグ修正は「AC-ID形式不変（確定設計判断§3）」が前提。万一A作業中にAC-ID形式自体を変える判断になった場合はFをA後続に変更すること。
- **presets直接編集事故** → 原本のみ編集。今回は**新規トップレベルファイル追加なし**（全て既存パス配下の編集）のため template-whitelist 警告リスクは低い。example再採番で新規ファイルを作る場合のみ whitelist 確認が要る。
- **review-spec過検出** → 粒度チェックは「Then同文の重複のみ」に限定し誤検出抑制。

## 検証・動作確認方法

1. **静的整合**: guide / requirements-generator / requirements.md.template / issue999 間で VR-ID命名・シーン語彙・カテゴリ列挙を grep 突合。
2. **example self-review**: issue999/requirements.md を `einja-review-spec`(requirements scope) の新チェックにかけ **PASS** すること（模範例がゲートを通らなければルール破綻）。
3. **generator実走**: ダミーの1フォーム画面Issueディレクトリで requirements-generator を実行し、観測可能な合格条件を確認: (a)§4詳細がシーン見出しで構成 (b)**VAL系ACがフィールド数分に増えていない**（Then差のない複数フィールドが1ACに集約され詳細が§6.2のVR行になっている）(c)§6.2全行にVR-ID (d)AC参照列がVR-IDを引く。不足ならプロンプト文面を補強。
4. **ゲート逆テスト**: 「フィールド単位水増し＋本文直書き」の不正requirementsを作り、review-spec観点Bが検出するか（検出力確認）。
5. **下流非破壊**: qa-generator を issue999 に対し実走/ドライ確認し、カテゴリ→テスト種別マッピングが従来通り動くこと。
6. **ビルド**: `copy-presets.mjs` は `pnpm prepush`（99-3 `einja-task-commit` 内で実行）の一部として自動実行されるため、99-3前に手動実行は不要。コミット後に presets/default へ全変更が反映され未登録警告が出ないことを確認。
