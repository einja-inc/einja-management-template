# Interactive Regression Checklist: einja-issue-spec-create

本ドキュメントは `einja-issue-spec-create` の Headless化対応（Plan: `docs/plans/202604/20260419-epic-spec-create.plan.md` タスク 3-1〜3-4）以降において、**通常モード（Interactive mode）の動作が従来と変わっていないこと**を保証するための回帰テスト・チェックリストである。

---

## 1. 目的と適用範囲

### 目的

- Headless化（`<<MODE: HEADLESS>>` マーカー + 単一ガード `isHeadless` / `isInteractive` による分岐）が、通常モードの挙動に副作用を与えていないことを検証する。
- 将来的に Headless 関連の追加変更（Epic 契約受領、resume-state、PENDING_QUESTIONS、外部指定入力等）が行われた際も、通常モードの非破壊性を保ち続けるためのチェック観点を提供する。

### 適用範囲

- `einja-issue-spec-create` SKILL.md のすべての変更（特に `<<MODE: HEADLESS>>` / `isHeadless` / `HEADLESS_*_START` マーカーブロック関連）
- 間接的に影響する可能性がある次の Skill・エージェント:
  - `_einja-spec-context-loader`
  - `_einja-task-qa`
  - `_einja-issue-spec-tasks-generator`
  - `_einja-issue-spec-tasks-validator`
  - `.claude/agents/einja/issue-specs/` 配下の全サブエージェント

### 適用外

- Headless mode 自体の動作検証（→ Epic Plan の「7-b 小-中規模Epic動作確認」で扱う）
- resume 実行時の冪等性検証（→ Epic Plan の「Headless 基本動作」検証項目）

---

## 2. Interactive 挙動のチェックリスト（必須確認項目）

Plan「既存 `einja-issue-spec-create` の対話・分岐ポイント（棚卸し）」表を Interactive モードの期待挙動としてチェック項目化する。各項目は**通常モード（プロンプト先頭に `<<MODE: HEADLESS>>` マーカーなし）**における期待動作である。

| # | 対話・分岐ポイント | Interactive時の期待挙動 | 確認方法 |
|---|------------------|---------------------|---------|
| 1 | Phase 0.3 要件ヒアリング | AskUserQuestion で対話（最大3ループ）。不明点が解消されるまでユーザーと往復する | 手動実行時に AskUserQuestion が発火することを目視確認 |
| 2 | Phase 0.4 IssueBranchBase 選択 | AskUserQuestion で main / develop / その他（自由入力）を選択 | 発火とユーザー選択受領を目視確認 |
| 3 | Phase 0.5 `einja-skill-first` 評価 | `einja-skill-first` Skill を呼び出し、Skill化要否を判断 | Skill 呼び出しログを確認 |
| 4 | Phase 0.x worktree 作成 | `_einja-worktree-guide` に従い worktree を作成（該当時） | worktree ディレクトリ生成を確認 |
| 5 | Phase 1 requirements 承認 | 生成後にユーザー承認待ち（AskUserQuestion またはプロンプト） | 承認ゲート発火を目視確認 |
| 6 | Phase 1.5 UI 要否判断 | AskUserQuestion で「UIあり/UIなし」をユーザーに確認 | 発火と分岐結果を目視確認 |
| 7 | Phase 2 design 承認 | 生成後にユーザー承認待ち | 承認ゲート発火を目視確認 |
| 8 | Phase 3 tasks-validator 失敗時 | 失敗メッセージをユーザーに提示、修正方針を確認 | 失敗時挙動を目視確認 |
| 9 | GitHub Issue 作成 | Skill 内で `mcp__github__issue_write` 等により自動作成 | GitHub 上で Issue 作成を確認 |
| 10 | Issue Spec PR 作成 | `base = IssueBranchBase`、`head = issue/{N}` で作成 | GitHub 上で PR 作成と base 設定を確認 |

### 補助チェック（Headless 非発火）

| # | 項目 | 期待挙動 |
|---|------|---------|
| 11 | プロンプト先頭に `<<MODE: HEADLESS>>` が**ない**場合、`isHeadless` 分岐コードが実行されない | Headless 専用セクション（HEADLESS_RESUME_STATE / HEADLESS_PENDING_QUESTIONS / HEADLESS_EXTERNAL_INPUTS）の処理がスキップされる |
| 12 | `resume-state-path` / `scope-path` / `manifest-path` 等の外部入力が要求されない | Interactive では入力バリデーション失敗による停止が起きない |
| 13 | Phase 0.5 の `einja-skill-first` が通常通り起動する | Headless 時のみ無効化される挙動が Interactive に漏れていないこと |
| 14 | PENDING_QUESTIONS（Markdown `## PENDING_QUESTIONS` セクション）が自発的に返却されない | Interactive では AskUserQuestion に置換されるため、PENDING_QUESTIONS は発火しない |

---

## 3. 回帰テストの実施手順

### A. 自動スモークテスト（コマンドレベル）

実行対象: worktree ルート。いずれも**非破壊**（読み取りのみ）で、CI 等にも組み込み可能。

#### A-1. 削除行 0 の確認（純粋追記）

```bash
# Interactive 本文の削除が無いこと（= 純粋追記）
git diff main -- .claude/skills/einja-issue-spec-create/SKILL.md \
  | grep -E "^-[^-]" \
  | wc -l
# 期待値: 0
```

削除行が 0 以外の場合、Interactive 本文が書き換えられた可能性がある → レビュー必須。

#### A-2. Headless マーカー存在確認

```bash
# <<MODE: HEADLESS>> 単一ガードが明記されていること
grep -cE "<<MODE: HEADLESS>>|isHeadless|isInteractive" \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: 数件以上（単一ガード設計のため）
```

#### A-3. Headless 関連追記のブロック境界確認

```bash
# マーカーブロックが対で揃っていること
grep -cE "HEADLESS_RESUME_STATE_START|HEADLESS_RESUME_STATE_END" \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: 2

grep -cE "HEADLESS_PENDING_QUESTIONS_START|HEADLESS_PENDING_QUESTIONS_END" \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: 2

grep -cE "HEADLESS_EXTERNAL_INPUTS_START|HEADLESS_EXTERNAL_INPUTS_END" \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: 2
```

開始と終了の数が一致しないブロックは不整合 → レビュー必須。

#### A-4. Interactive 本文の主要セクションが存在すること

```bash
# Phase 0〜3 の主要セクションが残っていること
grep -cE "^#+\s*(Phase 1|Phase 2|Phase 3|実行手順|成果物の構成|要件ヒアリング|GitHub Issue作成)" \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: Plan 作成時点のセクション数と同等
```

Interactive の主要セクションが減少している場合、本文が失われた可能性がある。

#### A-5. 対話ポイント分岐表の整合性

```bash
# 分岐表エントリ数の確認（表そのものの構造破壊検出）
grep -cE "^\| [0-9]+\." \
  .claude/skills/einja-issue-spec-create/SKILL.md
# 期待値: 本チェックリスト §2 のエントリ数以上
```

### B. マニュアル動作確認

**目的**: 実際に Interactive モードで Issue 仕様書作成を 1 件完了させ、各対話ポイントが発火することを確認する。

#### 手順

1. 簡易な Issue（例: 小規模 UI 修正）を対象に `einja-issue-spec-create` を Interactive モードで起動する。
2. §2 の各チェック項目（#1〜#10）について、対応する対話ポイントが**発火**することを目視確認する。
3. 生成物として以下が揃うことを確認する:
   - `requirements.md`
   - `design.md`
   - `ui-design.pen`（UI 要件ありの場合）
   - `qa-test.md`
   - GitHub Issue 本文（タスクチェックリスト）
   - Issue Spec PR（base が IssueBranchBase）
4. §2 の補助チェック（#11〜#14）について、Headless 側挙動が混入していないことを確認する。

#### 記録

実施結果は以下の形式で残す（ファイル配置は任意 / PR 本文に記載可）:

```markdown
## Interactive 回帰テスト結果 - YYYY-MM-DD

- 実施 Issue: #NNN
- 実施者: @username
- 各チェック項目:
  - #1 要件ヒアリング: PASS / FAIL
  - #2 IssueBranchBase 選択: PASS / FAIL
  - ...（#1〜#14 全て記録）
- 生成物:
  - requirements.md: OK
  - design.md: OK
  - ui-design.pen: OK / N/A
  - qa-test.md: OK
  - GitHub Issue: #NNN
  - Issue Spec PR: #MMM
- 問題点: なし / （あれば列挙）
```

### C. Headless 非発火確認（否定的テスト）

**目的**: Interactive 実行時に Headless 分岐に誤って入らないことを確認する。

#### C-1. プロンプト先頭マーカーなしの起動

- 通常の slash コマンドや自然文プロンプトで `einja-issue-spec-create` を起動する（`<<MODE: HEADLESS>>` マーカーを含まない）。
- Skill 冒頭の「実行モード判定」セクションの単一ガードで `isInteractive=true` に分岐することを確認する。
- `resume-state-path` 等の外部入力が要求されないことを確認する（要求されれば FAIL）。
- AskUserQuestion が Phase 0.3 / 0.4 / 1.5 等で発火することを確認する。

#### C-2. Headless 専用ブロックの非実行

- HEADLESS_RESUME_STATE_START / HEADLESS_PENDING_QUESTIONS_START / HEADLESS_EXTERNAL_INPUTS_START のブロック内に記載された処理（resume-state.json 読み書き、`## PENDING_QUESTIONS` 返却、外部指定入力の処理等）が**発火しない**ことを確認する。
- ログや生成物に `resume-state.json` への書き込みや `## PENDING_QUESTIONS` セクション返却が現れないこと。

---

## 4. Headless 分岐の副作用チェック

Interactive 動作に Headless 側の副作用が漏れ出していないかを検証する。

| 観点 | チェック内容 | NG 判定の目安 |
|------|----------|-------------|
| 単一ガードの厳守 | 全ての Headless 固有処理が `if isHeadless` / `<<MODE: HEADLESS>>` 判定の内側にあること | Headless 固有処理がガード外で実行される記述がある |
| 外部入力の非要求 | `github-issue-number` / `scope-path` / `manifest-path` / `resume-state-path` / `issue-base-branch` / `pr-base-branch` / `milestone` / `epic-tracker-issue` の受領処理が Interactive で発火しない | Interactive で外部入力の不足エラーが出る |
| resume-state.json の非参照 | Interactive では resume-state.json への読み書きが発生しない | resume-state.json が Interactive 実行中に作成・更新される |
| PENDING_QUESTIONS 非返却 | Interactive では `## PENDING_QUESTIONS` セクションの返却が発生せず、全て AskUserQuestion 経由 | Interactive で `## PENDING_QUESTIONS` が出力される |
| `einja-skill-first` 無効化の非漏洩 | Headless のみ `einja-skill-first` を無効化する。Interactive では従来通り発火する | Interactive で `einja-skill-first` が無効化される |
| worktree 作成の非漏洩 | Headless は worktree 作成しない。Interactive は従来通り `_einja-worktree-guide` に従う | Interactive で worktree 作成がスキップされる |
| レビューゲートの非漏洩 | Headless は `einja-review-spec` MAJOR 時に自動再生成 + PENDING_QUESTIONS。Interactive は従来通りユーザー承認 | Interactive で承認ゲートが自動化される |

---

## 5. 差分確認コマンド集

日常的な差分点検・レビュー補助に使うコマンド集。

```bash
# --- 本文変更の確認 ---

# 1. main 比較で削除された行がないか（純粋追記の確認）
git diff main -- .claude/skills/einja-issue-spec-create/SKILL.md \
  | grep -E "^-[^-]" \
  | head -50

# 2. Headless 関連追記の行数カウント
grep -cE "HEADLESS|<<MODE: HEADLESS>>|Headless" \
  .claude/skills/einja-issue-spec-create/SKILL.md

# 3. 単一ガード（isHeadless / isInteractive）の登場箇所
grep -nE "isHeadless|isInteractive" \
  .claude/skills/einja-issue-spec-create/SKILL.md

# 4. Headless ブロックマーカーの対応確認
grep -nE "HEADLESS_.*_START|HEADLESS_.*_END" \
  .claude/skills/einja-issue-spec-create/SKILL.md

# --- 対話ポイント分岐表の整合性 ---

# 5. 対話ポイント表のエントリ数
grep -cE "^\| [0-9]+\." \
  .claude/skills/einja-issue-spec-create/SKILL.md

# --- Interactive 本文の主要セクション存在確認 ---

# 6. Phase 0〜3 の主要セクションが残存しているか
grep -nE "^#+\s*(Phase 0|Phase 1|Phase 2|Phase 3)" \
  .claude/skills/einja-issue-spec-create/SKILL.md

# 7. 外部リソースの確認／GitHub Issue作成／要件ヒアリングセクションの存在
grep -nE "^#+\s*(外部リソース|GitHub Issue|要件ヒアリング|ワークツリー|Skill作成必要性)" \
  .claude/skills/einja-issue-spec-create/SKILL.md

# --- 関連 Skill / エージェントの追従確認 ---

# 8. qa-generator / tasks-generator が Headless 契約を意識しているか
grep -nE "scope\.md|epic-manifest\.json|<<MODE: HEADLESS>>" \
  .claude/agents/einja/issue-specs/*.md

# 9. qa-test.md / qa-tests/scenarios.md 参照の残存確認（案Aで改名済み）
grep -rnE "qa-tests/scenarios\.md" .claude/ docs/einja/
# 期待: フォールバック用記述を除きヒット 0 件
# 注意: _einja-task-qa 等のフォールバック用記述（旧称 scenarios.md への後方互換参照）は意図的残置のため除外する。
#       それ以外の箇所でヒットする場合は改名漏れとしてレビュー必須。
```

---

## 6. 将来の変更に対するガイドライン

### レビュー必須トリガー

以下のいずれかに該当する変更を `einja-issue-spec-create/SKILL.md` に加える場合、必ず本チェックリストを再実行すること。

- `<<MODE: HEADLESS>>` / `isHeadless` / `isInteractive` のガード条件変更
- HEADLESS_RESUME_STATE / HEADLESS_PENDING_QUESTIONS / HEADLESS_EXTERNAL_INPUTS の各ブロック内外の処理移動
- Interactive 本文の Phase セクション（Phase 0〜3）への加筆・修正
- 対話ポイント分岐表の追加・削除・変更
- 新しい Headless 固有入力キーの追加（§4 の副作用チェック欄に追記）

### チェックリストの更新運用

- 新しい対話ポイントが追加された場合は §2 の表にエントリを追加する。
- Headless 固有入力キーが追加された場合は §4 の「外部入力の非要求」行に追記する。
- 否定的テスト（§3-C）の項目を拡充する場合はここに反映する。

### サブエージェントへの波及確認

`einja-issue-spec-create` が呼び出す以下のサブエージェント・Skill についても Headless 契約（`<<MODE: HEADLESS>>`、scope.md、epic-manifest.json 等）を意識していることを確認する。通常モードでは従来どおり動作すること。

- `.claude/agents/einja/issue-specs/requirements-analyst.md`
- `.claude/agents/einja/issue-specs/design-architect.md`
- `.claude/agents/einja/issue-specs/qa-generator.md`
- `.claude/agents/einja/issue-specs/tasks-generator.md`
- `_einja-spec-context-loader`
- `_einja-task-qa`
- `_einja-issue-spec-tasks-generator`
- `_einja-issue-spec-tasks-validator`

---

## 7. CI 組込の提案（任意・将来拡張）

本チェックリスト §3-A の自動スモークテストは、CI で実行可能な非破壊チェックである。将来的に以下の拡張を提案する。

### 提案 1: PR 時の自動スモークテスト

- GitHub Actions の PR ワークフローで §3-A-1〜A-5 のコマンドを実行する。
- SKILL.md に変更がある PR ではチェック結果を PR コメントに投稿する。
- FAIL（削除行あり・マーカー不整合等）の場合はレビュアーに通知し、手動確認を必須にする。

### 提案 2: マニュアル動作確認の記録テンプレ化

- §3-B のマニュアル動作確認記録テンプレートを PR テンプレート / Issue テンプレートに組み込む。
- Interactive モード変更を伴う PR では記録提出を必須にする。

### 提案 3: 完全自動化の検討（Headless 運用実績が積まれた後）

- Interactive モードの動作検証を Playwright MCP ベースで自動化する案を検討する。
- 実運用で Headless モードのフィードバックが十分に蓄積されてから、本項目の実装可否を再評価する。

---

## 付録A: 関連ファイル

- SKILL 本体: `.claude/skills/einja-issue-spec-create/SKILL.md`
- 本チェックリスト: `.claude/skills/einja-issue-spec-create/tests/interactive-regression-checklist.md`
- 元 Plan: `docs/plans/202604/20260419-epic-spec-create.plan.md`
- 質問プロトコル: `.claude/skills/_einja-subagent-question-protocol/SKILL.md`
- worktree ガイド: `.claude/skills/_einja-worktree-guide/SKILL.md`
- Skill 作成必要性評価: `.claude/skills/einja-skill-first/SKILL.md`

## 付録B: 用語対応表

| 用語 | 意味 |
|------|------|
| Interactive mode / 通常モード | プロンプト先頭に `<<MODE: HEADLESS>>` マーカーが**ない**実行形態。AskUserQuestion と承認ゲートを使う従来挙動 |
| Headless mode | プロンプト先頭に `<<MODE: HEADLESS>>` マーカーを含む実行形態。Epic からの非対話実行を想定 |
| 単一ガード | `isInteractive` / `isHeadless` の分岐を全 Headless 処理の冒頭でチェックする設計。分岐漏れを防ぐ |
| resume-state | Headless 実行の冪等再開用 JSON。Interactive では参照しない |
| PENDING_QUESTIONS | Headless 実行中に発生した不明点を親へ返却する Markdown セクション。Interactive では AskUserQuestion に置換される |
| 永続マーカー | GitHub Issue / PR 本文冒頭の HTML コメント（`<!-- einja:epic-id=... -->`）。Headless 実行時の冪等検索に使用 |
