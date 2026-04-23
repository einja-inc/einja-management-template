---
name: einja-issue-spec-create
description: "Issue仕様書を段階的に作成するSkill。単一Issue仕様書（requirements/design/qa-test/GitHub Issue/PR）の対話的作成、または Epic オーケストレーター（einja-epic-spec-create）から <<MODE: HEADLESS>> プロンプトマーカーで呼び出されて Headless 展開。Do NOT use for: Epic単位の仕様書作成（→ einja-epic-spec-create）"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - MultiEdit
  - Grep
  - Glob
  - Agent
  - Skill
  - AskUserQuestion
  - mcp__github__create_branch
  - mcp__github__create_issue
  - mcp__github__create_pull_request
  - mcp__github__issue_read
  - mcp__github__issue_write
  - mcp__github__pull_request_read
  - mcp__github__update_pull_request
  - mcp__github__search_issues
  - mcp__github__search_pull_requests
  - mcp__github__get_file_contents
  - mcp__github__list_branches
  - mcp__pencil__open_document
  - mcp__pencil__batch_design
  - mcp__pencil__batch_get
  - mcp__pencil__get_editor_state
  - mcp__pencil__get_screenshot
  - mcp__pencil__find_empty_space_on_canvas
  - mcp__pencil__snapshot_layout
---

# Issue仕様書作成Skill

## あなたの役割
プロダクト開発のシニアテクニカルアーキテクト兼シニアプロダクトエンジニアとして、ATDD（受け入れテスト駆動開発）に基づく仕様書を段階的に作成します。

## 実行モード判定

本Skillは **Interactive mode**（通常モード）と **Headless mode** の2モードで動作する。**モード判定はプロンプト先頭の `<<MODE: HEADLESS>>` マーカーの有無で行う単一ガード設計**とし、分岐漏れによる誤発火を防ぐ。

### モード判定ロジック（単一ガード）

```
isInteractive := プロンプト先頭に `<<MODE: HEADLESS>>` マーカーが存在しない
isHeadless    := プロンプト先頭に `<<MODE: HEADLESS>>` マーカーが存在する
isResume      := isHeadless かつ プロンプト先頭に `<<RESUME>>` マーカーが存在する（2行目以内）
```

- 全ての対話ポイント・承認ゲート・外部リソース作成処理は、**このガードのみ**で分岐させること
- モード判定は実行開始時に1回だけ行い、以後は状態として保持する
- マーカーが存在しない限り、本Skillは従来通り Interactive mode として動作する（既存挙動は一切変更しない）
- **Headless 新規**（`<<RESUME>>` なし）: 通常の Headless フロー（`status=pending` から開始）
- **Headless resume**（`<<RESUME>>` あり）: `RESUMED_ANSWERS` セクションを読み取り、resume-state の `status` を `"resumed"` に更新後、`answers[]` へ回答を追記して該当フェーズから再開する。詳細は「Headless: PENDING_QUESTIONS 返却プロトコル」§4「再開時の入力受領」を参照

### モード別挙動の概要

| 項目 | Interactive mode（既存） | Headless mode（追加） |
|------|------------------------|----------------------|
| 起動条件 | マーカーなし（デフォルト） | プロンプト先頭に `<<MODE: HEADLESS>>` |
| 呼び出し元 | ユーザー直接、他Skillからの通常呼び出し | `einja-epic-spec-create` 等のオーケストレーター |
| AskUserQuestion | 使用する | **使用しない**（全て自動判定 or PENDING_QUESTIONS返却） |
| ユーザー承認ゲート | 発生させる | **発生させない**（`einja-review-spec` 結果で判定） |
| worktree作成 | 必要に応じて実施（0.4） | **実施しない**（親worktree内で作業） |
| `einja-skill-first` | 評価実施 | **無効化** |
| GitHub Issue作成 | Skill内で実施 | **実施しない**（`github-issue-number` を受領） |
| Issue Spec PR | 新規作成 | **create-or-update**（永続マーカー `kind=issue-spec-pr` で検索） |
| 不明点への対応 | AskUserQuestion | **Markdown `## PENDING_QUESTIONS` で返却して停止**（`_einja-subagent-question-protocol` 準拠） |

### 対話ポイント分岐表（網羅）

以下は既存Skillに存在する全ての対話・分岐ポイントと、Headless時の挙動を一覧化したもの。**Interactive mode の挙動は本表・本Skill全体を通して一切変更しない**。Headless分岐の具体処理は、後続タスク（3-2: resume処理、3-3: PENDING_QUESTIONS返却、3-4: 外部指定対応）で詳細化する。

| # | 箇所 | 種別 | Interactive挙動（現行維持） | Headless挙動 |
|---|------|------|------------------------------|--------------|
| 1 | Phase 0.3 要件ヒアリング | AskUserQuestion（最大3ループ） | 不明点を対話で解消 | 外部入力の `scope.md` から抽出。不足があれば PENDING_QUESTIONS を返して停止 |
| 2 | Phase 0.4 IssueBranchBase選択 / worktree作成 | AskUserQuestion + EnterWorktree | 通常base候補提示→worktree作成 | 親から `issue-base-branch` を必須入力で受領。**worktree作成はスキップ**（親worktree内で作業） |
| 3 | Phase 0.5 Skill作成必要性評価 | `einja-skill-first` 評価 + AskUserQuestion | Skill化有無を対話で判定 | **無効化**（Epic側が一括評価済み前提） |
| 4 | Phase 0.6 フェーズレビューゲート | `einja-review-spec` | PASS/MINOR→ユーザー確認、MAJOR→再レビュー | `einja-review-spec` は必ず実行。PASS/MINOR→自動継続、MAJOR→自動再生成（`attemptCounts.reviewSpec` 2回まで）。それでも MAJOR なら PENDING_QUESTIONS |
| 5 | GitHub Issue作成（Step 2） | `mcp__github__create_issue` | 新規Issue作成 | **スキップ**。受領した `github-issue-number` を使用。Issue本文更新は create-or-update で冪等化、本文冒頭の永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=issue-spec -->` を維持 |
| 6 | Phase 1 requirements承認待ち | ユーザー承認待ち | 成果物レビュー→ユーザー承認→コミット | `einja-review-spec` 結果で判定（上記 #4 と同じルール）。ユーザー承認は発生させない |
| 7 | Phase 2 スキップ判定（UI要否） | キーワード判定 + AskUserQuestion | 判定曖昧時に対話 | manifestの `uiFrameIds` が空配列 or 省略 → UIなしと判定（AskUserQuestion発火禁止） |
| 8 | Phase 2 設計・QA・UI並列完了後承認 | ユーザー承認待ち | 一括提示→ユーザー承認→一括コミット | `einja-review-spec` 結果で判定（上記 #4 と同じルール）。ユーザー承認は発生させない |
| 9 | Phase 3.1 tasks-validator失敗 | 手動修正依頼（3回失敗時） | ユーザーに手動修正を依頼 | 2回まで自動再生成（`attemptCounts.tasksValidator`）、それでも失敗なら PENDING_QUESTIONS |
| 10 | Phase 3.2 tasks承認待ち | ユーザー承認待ち | 成果物レビュー→ユーザー承認 | `einja-review-spec` 結果で判定（上記 #4 と同じルール）。ユーザー承認は発生させない |
| 11 | Phase 3.2 Issue Spec PR作成 | `mcp__github__create_pull_request` | 新規PR作成 | **create-or-update**。永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=issue-spec-pr -->` で既存PR検索、存在すればupdate、無ければcreate。base は受領した `pr-base-branch` |
| 12 | Phase 3.2 GitHub Issue説明文更新 | `mcp__github__issue_write` | 本文全面更新 | 本文冒頭の永続マーカーを保持しつつ create-or-update で冪等更新。Milestone / Epic Tracker Issue へのリンクも付与 |
| 13 | ビジネス要件の不明点発生 | AskUserQuestion | 対話で確認 | Markdown `## PENDING_QUESTIONS` を返却し、`resume-state` を更新して停止（`_einja-subagent-question-protocol` 準拠） |

### 分岐実装ルール

- 上記表の各ポイントで、必ず `if isInteractive` / `if isHeadless` の条件分岐を明示すること
- 新規の対話ポイントを追加する場合は、本表への追記と Interactive/Headless 双方の挙動定義を必須とする
- Interactive mode の文言・手順は、本表・Headlessノート追記以外では一切変更しない

## Headless mode 入力契約

Headless mode 有効時、**プロンプト先頭**に以下のMarkdownブロック形式でメタ情報を受領する。ブロックの位置・キー名は固定とし、パーサーが機械的に解釈できる形にする。

### 入力フォーマット（プロンプト先頭）

```markdown
<<MODE: HEADLESS>>

## Epic Context
- epic-context: docs/specs/epics/{epic-slug}
- manifest-path: docs/specs/epics/{epic-slug}/epic-manifest.json
- scope-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md
- resume-state-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json
- github-issue-number: 123
- issue-base-branch: epic/{epic-slug}
- pr-base-branch: epic/{epic-slug}
- milestone: {Milestone名 or null}
- epic-tracker-issue: 456
```

### 入力キー一覧

| キー | 必須 | 型 | 説明 |
|------|------|----|------|
| `<<MODE: HEADLESS>>` マーカー | ○ | - | プロンプト先頭の最初の非空行に配置。モード判定の単一ガードが参照する |
| `epic-context` | ○ | path | Epic ディレクトリパス（`docs/specs/epics/{epic-slug}`） |
| `manifest-path` | ○ | path | `epic-manifest.json` へのパス |
| `scope-path` | ○ | path | 対象Issueの `scope.md` へのパス（YAML frontmatter必須） |
| `resume-state-path` | ○ | path | 対象Issueの `resume-state.json` へのパス（git管理対象） |
| `github-issue-number` | ○ | integer | Epic側が事前作成したGitHub Issue番号。本Skillでは新規作成しない |
| `issue-base-branch` | ○ | branch name | `issue/{N}` ブランチの作成元（Epic配下では通常 `epic/{slug}`） |
| `pr-base-branch` | ○ | branch name | Issue Spec PR の base（通常 `epic/{slug}`） |
| `milestone` | △ | string or null | GitHub Milestone名。未指定時は `null` または行省略 |
| `epic-tracker-issue` | △ | integer or null | Epic Tracker Issue番号。未指定時は `null` または行省略 |

### 入力バリデーション

- Headless mode 有効時、必須キー（`epic-context` / `manifest-path` / `scope-path` / `resume-state-path` / `github-issue-number` / `issue-base-branch` / `pr-base-branch`）のいずれかが欠落している場合は、作業を開始せず PENDING_QUESTIONS で理由を明示して停止すること
- `manifest-path` / `scope-path` のいずれかが存在しないファイルを指している場合も同様
- `resume-state-path` が指すファイルが存在しない場合は **PENDING_QUESTIONS で停止しない**。`HEADLESS_RESUME_STATE` ブロックの手順に従い、初期値（`status: "pending"`）で新規作成してから処理を継続する（初回実行を想定した動作）
- 受領した値の詳細な読み書きロジックは **Task 3-4 で詳細化**（本タスクでは契約宣言のみ）

#### 数値型フィールドの検証

**`github-issue-number`（必須）**

- 受領した値が 1 以上の正の整数（正規表現 `^[1-9][0-9]*$`）でなければ PENDING_QUESTIONS で停止する
  - 型: integer、範囲: `>= 1`
  - 不正値の例: `0`、`-1`、`abc`、空文字列、小数点付き数値
- Bash での検証例（プロセス内で実行可能な判定式）:
  ```bash
  [[ "$github_issue_number" =~ ^[1-9][0-9]*$ ]] || echo "INVALID"
  ```
- 検証失敗時の PENDING_QUESTIONS タイトル例: `"Headless入力バリデーション失敗: github-issue-number"`

**`epic-tracker-issue`（任意）**

- `null` または行省略は許容する（フィールド省略可）
- 値が指定されている場合は `github-issue-number` と同様に `^[1-9][0-9]*$` で検証し、不正値なら PENDING_QUESTIONS で停止する
- Bash での検証例:
  ```bash
  if [[ -n "$epic_tracker_issue" && "$epic_tracker_issue" != "null" ]]; then
    [[ "$epic_tracker_issue" =~ ^[1-9][0-9]*$ ]] || echo "INVALID"
  fi
  ```
- 検証失敗時の PENDING_QUESTIONS タイトル例: `"Headless入力バリデーション失敗: epic-tracker-issue"`

**`milestone`（任意）**

- `null` または行省略は許容する
- 空文字列（`""`）が指定された場合は `null` として扱い、検証失敗にはしない
- 値が指定されている場合（空文字列以外、`null` 以外）は非空文字列であることを確認する
- 検証失敗時の PENDING_QUESTIONS タイトル例: `"Headless入力バリデーション失敗: milestone"`

#### 検証失敗時の共通挙動

数値型バリデーション失敗時は、以下の形式で PENDING_QUESTIONS を返却してEpic全体を停止する:

```markdown
## PENDING_QUESTIONS

### Headless入力バリデーション失敗: {field-name}

**問題**: `{field-name}` に不正な値が渡されました。
**受領値**: `{received-value}`
**期待値**: {期待する型・範囲の説明}

正しい値を指定して再実行してください。
```

### モード・入力の併用ルール

- `<<MODE: HEADLESS>>` マーカーがあるのに上記ブロックが欠落している場合は、モード不整合として PENDING_QUESTIONS 返却
- マーカーが無い場合は本ブロックを参照せず、従来の Interactive mode として動作する

## タスク管理
TaskCreateツールを使用して全体の進捗を可視化し、ユーザーに現在の状況を明確に伝えます：
- 各仕様書作成フェーズ（requirements.md、ui-design.pen、design.md、QAテスト仕様、GitHub Issueへのタスク記述）をトップレベルタスクとして管理
- エージェント起動前にタスクを「in_progress」に更新
- エージェント完了後に「completed」に更新
- 各フェーズの成果物生成後にレビューゲート（`einja-review-spec`）を挿入し、レビュー中も進捗を更新
- ユーザー承認待ちの状態も明示的に表示

## 命名規則

⚠️ **重要**: ディレクトリ名とブランチ名の規則は異なります。混同しないこと。

| 対象 | 規則 | 例 |
|------|------|-----|
| ディレクトリ | `issue{issue番号}-{機能名}` | `issue42-user-management` |
| Issueブランチ | `issue/{issue番号}` | `issue/42` |
| Phaseブランチ | `issue/{issue番号}-phase{N}` | `issue/42-phase1` |

- **ディレクトリ**: 機能名を含める（人間が識別しやすくするため）
- **ブランチ**: Issue番号のみ（[branch-strategy.md](../docs/einja/steering/branch-strategy.md)参照）

## 実行手順

### 0. 前提確認フェーズ（ワークフロー開始時）

**⚠️ 重要**: 仕様書作成開始前に、以下の確認を行うこと。

#### 0.1 TDD方針

原則TDD（テスト駆動開発）を適用する。タスクグループ・タスク作成時にTDDプロセスを徹底すること。

#### 0.2 要件方針

**基本方針**: ビジネス要件・スコープ・優先度はユーザーにしか決められない。推測で補完せず、必ず確認する。

- 技術的な事実（ライブラリ仕様、既存実装パターン等）は自力調査で解決してよい
- ビジネス要件・スコープ・優先度・ユーザー意図に関する不明点は、推測せずAskUserQuestionで確認する
- 各サブエージェントも同じ方針に従い、ビジネス要件の不明点はPENDING_QUESTIONSで即座に停止する

#### 0.3 要件ヒアリング（Phase 1開始前に必須実施）

**目的**: 段階的仕様書作成 Phase 1（requirements.md生成）の開始前に、ユーザーの要件を構造的に確認し、不明点を解消する。

> **Headless mode 時の挙動**: 本節の対話処理（AskUserQuestion）は実行しない。代わりに `scope-path` で受領した `scope.md` のYAML frontmatter + 本文から要件を抽出し、`manifest-path` の `epic-manifest.json` と突き合わせて「要件ヒアリングサマリ」相当の構造を生成する。抽出不能な不明点が残った場合は PENDING_QUESTIONS で停止する。詳細は「対話ポイント分岐表」#1 と、Task 3-2（resume処理）・Task 3-3（PENDING_QUESTIONS返却）で詳細化。

##### 0.3.1 事前調査（サブエージェント並列起動）

**方針**: Explore/general-purposeエージェントを並列起動して広く浅く調査する。深掘りはrequirements-generatorのStep 0に委譲する。

**調査観点と委託先**:

※ Explore = Agent toolの `subagent_type: Explore`、general-purpose = Agent toolの `subagent_type: general-purpose`

| 調査観点 | 委託先 | 目的 |
|---------|--------|------|
| 関連Issue・既存仕様書 | Explore | 類似機能の過去実装・決定事項を把握 |
| 既存コードの概要 | Explore | 影響範囲の見当をつける |
| 過去類似Planの確認 | Explore | 同じ失敗を繰り返さない文脈取得 |
| 外部リソース（Asana/Figma URL） | general-purpose | デザイン・タスクの意図を事前把握 |
| 外部依存の有無 | general-purpose | 外部API連携があれば専門的な質問が必要 |

- コンテキストに応じて不要な観点はスキップ（例: Asana URL未提供なら外部リソース調査は不要）
- Explore 1-2個 + general-purpose 0-1個を並列起動（最大3個）

##### 0.3.2 要件ヒアリング

**新規Issue作成時**:
1. 事前調査結果と一次情報（指示文、Asana URL、Figma URL等）を統合し、明示済み/不明を分離
2. ヒアリング観点チェックリストで不明点を洗い出す:

   | カテゴリ | 確認観点 | 例 |
   |---------|---------|-----|
   | 対象ユーザー | 誰が使うか、ペルソナ | 管理者のみ？一般ユーザーも？ |
   | ビジネス目的 | なぜ必要か、KPI | コンバージョン率向上？運用コスト削減？ |
   | 機能スコープ | 含む/含まないの境界 | 一覧・詳細・作成・編集・削除のどこまで？ |
   | 優先度・時期 | リリース優先度、期限 | MVP？次スプリント？ |
   | 既存機能との関係 | 新規/改修/拡張 | 既存画面に追加？新規画面？ |
   | エッジケース | 例外処理の方針 | 大量データ、同時操作、権限なし時 |
   | 非機能要件 | パフォーマンス、セキュリティ | レスポンス要件、認証要件 |
   | 外部連携 | API、決済、認証等 | サードパーティAPI連携あるか？ |
   | デザイン制約 | Figma有無、既存UIパターン | 既存デザインシステムに従うか？ |

3. 1回目のAskUserQuestionで全不明点を一括提示。回答不十分な場合のみ追加確認（最大2回追加 = 合計3回）
4. **3回後も必須要件が不明な場合**: 残存不明点を明示した上で「続行/中止/その他（自由入力）」をAskUserQuestionで確認
5. 要件ヒアリングサマリを構造化し、Phase 1以降のサブエージェントに渡す:
   ```
   ## 要件ヒアリングサマリ
   ### 確定事項
   - [確定した要件を箇条書き]
   ### ユーザー回答
   - Q1: [質問] → A: [回答]
   ### 事前調査結果の要約
   - [関連Issue・既存コード・外部リソースから得た知見]
   ### 未解決事項（残存リスク）
   - [解消できなかった不明点があれば記載]
   ```

**既存Issue操作時**:
1. 事前調査で既存仕様書（requirements.md、design.md等）を把握済み
2. 追加・変更要件との差分を分析し、影響範囲を特定
3. 新規作成時と同じヒアリング観点チェックリストを差分に対して適用し、不明点をAskUserQuestionで確認
4. サブエージェントへの情報渡し時、差分サマリの「追加・変更要件」と「未解決事項」を明示する。サブエージェントは差分サマリで確定済みの事項について重複質問しない
5. 既存仕様との整合性について確認が必要な点も提示
6. 差分サマリを作成:
   ```
   ## 差分サマリ
   ### 既存仕様の要約
   - [現在のrequirements.md/design.mdの要点]
   ### 追加・変更要件
   - [ユーザーが指示した追加・変更内容]
   ### ユーザー回答
   - Q1: [質問] → A: [回答]
   ### 影響範囲
   - [既存仕様への波及箇所]
   ### 未解決事項（残存リスク）
   - [解消できなかった不明点があれば記載]
   ```

#### 0.4 ワークツリー作成とIssueBranchBaseの選択

> **Headless mode 時の挙動**: AskUserQuestion およびworktree作成は**実行しない**。IssueBranchBase は入力契約の `issue-base-branch` を使用し、作業は親オーケストレーター（`einja-epic-spec-create`）のworktree内で継続する。`EnterWorktree` を呼び出さないこと。詳細は「対話ポイント分岐表」#2。

**質問: Issueブランチの作成元を確認**

```yaml
AskUserQuestion:
  question: "Issueブランチ（issue/{issue番号}）の作成元（IssueBranchBase）を選択してください"
  header: "IssueBranchBase選択"
  options:
    - label: "デフォルトブランチ（推奨）"
      description: "gitのデフォルトブランチ（main/developなど）を使用します"
    - label: "main"
      description: "mainブランチをIssueBranchBaseとして使用します"
    - label: "develop"
      description: "developブランチをIssueBranchBaseとして使用します"
    - label: "その他（ブランチ名を入力）"
      description: "例: release/2025-01"
```

**「その他」選択時の対応**:
- ブランチ名をユーザーに確認し、IssueBranchBaseとして記録する

**ワークツリーの作成**:
1. `EnterWorktree` でワークツリーを作成（名前: `issue-{issue番号}-spec`）
   - `.claude/worktrees/` 配下に作成される（issue-execの `~/.einja/worktrees/` とは競合しない）
2. `_einja-worktree-guide` Skillの手順に従ってworktreeをセットアップ
   - ブランチ名: `issue/{issue番号}`、ベース: `origin/{IssueBranchBase}`
3. 以降のPhase 1〜3はすべてワークツリー内で作業

#### 0.5 Skill作成必要性の評価

> **Headless mode 時の挙動**: 本節は **完全に無効化** する。`einja-skill-first` を呼び出さず、AskUserQuestion も発火させない。Epic側（`einja-epic-spec-create`）が一括評価済みである前提。詳細は「対話ポイント分岐表」#3。

`einja-skill-first` Skillを使用して、このタスクに対してSkillを先に作るべきかを自動評価する。

- **スキップ基準に該当する場合**（単発修正、具体的な小規模指示等）: 評価を省略し次へ進む
- **評価実行時**: Skillが構造化された評価結果（🟢推奨/🟡拡張推奨/⚪不要）を返却
  - 🟢推奨 → AskUserQuestionでユーザーに提案。承認されたら仕様書作成前にSkill作成を実施
  - 🟡拡張推奨 → 既存Skill拡張の提案をユーザーに確認
  - ⚪不要 → そのまま次へ進む

#### 0.6 フェーズレビューゲート

> **Headless mode 時の挙動**: `einja-review-spec` の呼び出しは **Interactive と同じく必ず実行** する。判定結果の扱いのみが異なる:
> - **PASS / MINOR**: ユーザー確認を挟まず自動継続
> - **MAJOR**: 自動再生成を最大2回試行（`attemptCounts.reviewSpec` を `resume-state.json` にインクリメント）。3回目もMAJORなら PENDING_QUESTIONS 返却 + `resume-state.status = "blocked"` で停止
>
> `einja-review-spec` 自体はSkillとして変更しない。詳細は「対話ポイント分岐表」#4・#6・#8・#10、および Task 3-2（resume処理）・Task 3-3（PENDING_QUESTIONS返却）。

各フェーズの成果物をユーザーに提示する**前**に、必ず `einja-review-spec` Skill を呼び出して多観点・並列レビューを行うこと。

- Phase 1: `review_scope=requirements`
- Phase 2: `review_scope=phase2_bundle`
- Phase 3: `review_scope=tasks`

レビュー結果の扱い:
- **PASS**: そのままユーザー確認へ進む
- **MINOR**: 可能な限り修正を反映してからユーザー確認へ進む
- **MAJOR**: 先に修正し、再レビューを実施する（最大2回）

`einja-review-spec` には、対象成果物のパス、ユーザー要求、要件ヒアリングサマリまたは差分サマリ、残存リスクを前置コンテキストとして渡すこと。Phase 2 では `ui-design.pen` のスクリーンショット要約も渡すこと。

### 1. 外部リソースの確認

**AsanaタスクURL**の場合：
- AsanaMCPでタスク情報を取得（タイトル、説明、カスタムフィールド）
- タスクIDから適切なディレクトリ名を生成

**FigmaURL**が含まれる場合：
- FigmaDevModeMCPでデザイン分析
- UI要件、コンポーネント仕様、デザイントークンを抽出

### 2. GitHub Issue作成（最初に実行）

> **Headless mode 時の挙動**: 新規Issue作成（`mcp__github__create_issue`）は **実行しない**。入力契約の `github-issue-number` を使用する。Issue本文の更新は、冒頭の永続マーカー `<!-- einja:epic-id=... issue-slug=... kind=issue-spec schema=1.0 -->` を維持したまま create-or-update で冪等に行う（詳細は Task 3-4）。ブランチ作成（`mcp__github__create_branch`）も `issue-base-branch` を受領済みのため、ローカル/リモートの存在確認→未存在時のみ作成、の順で冪等化する。ディレクトリパス決定ロジックは Interactive と同一のまま使用可能（`github-issue-number` と `epic-context` から導出）。詳細は「対話ポイント分岐表」#5・#12。

1. **GitHub IssueをMCPで作成**
   - タイトル: ユーザー指定またはAsanaタスクから取得
   - 本文: 空または簡易的な説明
   - `mcp__github__create_issue` を使用
   - **Issue番号を取得して記録**

2. **Issue番号に基づいてディレクトリパスを決定**
   - パス指定あり → 指定ディレクトリを使用
   - パス指定なし → `/docs/specs/issues/{機能カテゴリ名}/issue{issue番号}-{機能名}/` で自動作成

3. **Issueブランチ作成（MCP）**
   - 0.4でワークツリー内にローカルブランチは作成済み
   - リモートへの反映: `mcp__github__create_branch` を使用
   - branch: `issue/{issue番号}`（例: `issue/42`）
   - from_branch: IssueBranchBase（0.4で選択）

### 3. 段階的仕様書作成
**重要**: 各段階で必ずユーザー承認を得て、コミット＆プッシュしてから次へ進行すること。

#### Phase 1: requirements.md（要件定義書）
**Phase 1 フロー（UI要件あり）**:

> **Headless mode 時の挙動**: ステップ3（ユーザー内容確認依頼）とステップ4（ユーザー承認後のコミット＆プッシュ）のうち、**ユーザー承認待ちは発生させない**。`einja-review-spec` が PASS/MINOR であれば自動継続し、`resume-state.json` の `generatedArtifacts` に `requirements.md` パスを追記して Phase 2 へ進む。コミット＆プッシュ自体は実施してよい（成果物の永続化のため）。詳細は「対話ポイント分岐表」#6。

**Phase 1a**: requirements-generatorエージェントで requirements.md 生成
   - エージェント内で既存コードの分析を実施
   - 標準の項目構造で要件を作成
   - **追加指示（呼び出し時にプロンプトに含める）**:
     - 以下のsteering文書を事前に読み込んでから作業すること:
       - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
       - `docs/einja/steering/development/testing-strategy.md`
     - また、過去Planを `docs/plans/` ディレクトリから検索し、類似Issueがあれば「実装参考情報」セクションに参考情報として記載すること。
     - **0.3で作成した「要件ヒアリングサマリ」と「事前調査結果」を必ずプロンプトに含める**こと。requirements-generatorはこのサマリを基に要件定義書を作成する。事前調査済みの内容はStep 0で重複調査せず、より深い分析に集中する。
     - requirements.md は最低限、以下のセクションを持つこと:
       - Sources
       - §1 目的・役割（+ §1.1 対象外, §1.2 スコープ境界・コンテキスト + コンテキスト図, §1.3 主要ユースケース + ユースケース図）
       - §2 前提条件・制約
       - §3 画面構成・状態（+ §3.3 ローファイWF参照 — UI要件時のみ）
       - §4 受け入れ条件（Story単位に再構成 — 各Story配下に As a/I want to/So that + Story内AC一覧表 + AC詳細 正常系/異常系）
       - §5 表示・計算ルール
       - §6 入力ルール
       - §7 権限マトリクス
       - §8 画面遷移（+ §8.2 画面遷移図）
       - §9 業務フロー — 権限・承認・部門横断がある場合必須
       - §10 処理フロー（主要フロー + 例外フロー）
       - §11 状態遷移 — 状態を持つ機能の場合必須
       - §12 概念データモデル — 複数エンティティ間に関係がある場合必須
       - §13 非機能要件
       - §14 実装参考情報
     - **AC命名体系**: `AC{Story#}.{Cat}.{N|E}.{連番3桁}` 形式（例: `AC1.UI.N.001`, `AC1.VAL.E.001`）
       - カテゴリ: `UI / NAV / VAL / ERR / PERM / UX` のみ
       - `N` = 正常系 / `E` = 異常系
       - 連番は各 Story × カテゴリ × 区分 ごとに001から
       - AC採番は Story起点（Story1配下のUI正常系は AC1.UI.N.001 から始まる）
     - **Story ↔ WF参照規約**: UI/NAV カテゴリACは該当の lo-fi WF フレームを `[参照: WF-S1-F01]` 形式で引用する
     - **mermaid記法方針**: C4記法（`C4Context`/`C4Container`等）は公式experimentalのため使用しない。`graph TB` + `subgraph` で C4 相当を表現すること
     - AC は Story番号ベースの単純連番ではなく、`カテゴリ / 区分 / 強度 / 検証レベル` を持つ `AC一覧` を先に出力すること。
     - AC本文は振る舞いの骨格だけを記述し、詳細条件は `→§N` の形で後続セクションに委譲すること。
     - AC詳細は `正常系` と `異常系` を分けること。

**UI要件の判定基準**:
- requirements.md 内に「画面」「UI」「フォーム」「ダッシュボード」「表示」「ボタン」「入力」等のキーワードが含まれる場合、UI要件あり
- 判断が曖昧な場合はAskUserQuestionでユーザーに確認

**Phase 1b（UI要件あり時のみ）**: lo-fi WF を ui-design-generator で作成
   - `mode=lo-fi`, `phase=1`, `requirements_path={仕様書ディレクトリ}/requirements.md` をパラメータで渡す
   - 出力: `{仕様書ディレクトリ}/ui-design.pen`（`WF-S{n}-F{nn}` フレーム群）
   - UI要件なしの場合は Phase 1b/1c をスキップし、直接 Phase 1d へ進む

**Phase 1c（UI要件あり時のみ）**: 横断チェック（オーケストレーター実施）
   - requirements.md の AC（UI/NAV カテゴリ）の WF参照（`[参照: WF-S1-F01]`）と ui-design.pen のフレーム命名（`WF-S{n}-F{nn}`）が一致しているか確認
   - 不整合がある場合は該当ファイルを修正

**Phase 1d**: `einja-review-spec` Skillで並列レビューを実施
   - `review_scope=requirements`
   - requirements.md の内容、要件ヒアリングサマリ、残存リスクを渡す
   - UI要件ありの場合は ui-design.pen の lo-fi WF も対象に含める
   - Phase 1 の ui-design.pen レビュー観点（lo-fi WF）:
     - 構成・情報優先度・操作導線のみ評価
     - 色・フォント・詳細コンポーネントは評価対象外
   - **MAJOR** の場合は requirements-generator（または ui-design-generator）に修正指示を返し、再レビューする（最大2回）

**Phase 1e**: ユーザーに内容確認を依頼（requirements.md + lo-fi ui-design.pen 一括提示）
   - 作成したファイルのパスと概要を提示
   - 確認ポイントを明示（要件の過不足、受け入れ基準の明確性など）
   - UI要件ありの場合: Pencil MCPのget_screenshotで lo-fi フレームプレビューを提示
   - `einja-review-spec` が PASS/MINOR であることを明記する

**Phase 1f**: ユーザー承認後、コミット＆プッシュ
   - コミットメッセージ: `docs: {機能名}の要件を追加`
   - ブランチは `issue/{issue番号}` にプッシュ
   - 他のメンバーがレビューできるようにする

**承認を得てから次のステップ（design.md）に進む**

#### Phase 2: 三又並列生成（design + ui-design + QA）

**Phase 2 スキップ判定**（Phase 2 開始前に実施）:
- requirements.mdに画面・UI関連の要件がない場合、ui-design-generatorをスキップ（二又並列に変更）
- 判定基準: requirements.md内に「画面」「UI」「フォーム」「ダッシュボード」「表示」「ボタン」「入力」等のキーワードが含まれるか確認
- 判断が曖昧な場合はAskUserQuestionでユーザーに確認

> **Headless mode 時の挙動**: manifest の対象Issue（`scope-path` の `issueSlug` に対応するエントリ）の `uiFrameIds` が **空配列または省略されている** 場合は UIなしと判定し、二又並列（design + qa）で実行する。`uiFrameIds` に1つ以上のフレームIDがある場合は三又並列（design + ui-design + qa）。**AskUserQuestion は発火禁止**。判断材料が不足してどちらとも言えない場合のみ PENDING_QUESTIONS 返却。詳細は「対話ポイント分岐表」#7。

**⚠️ 外部API連携がある場合の必須記載事項（design-generator・qa-generator共通）**:
design-generatorエージェントへの追加指示に以下を含めること:
- design.mdの「テスト設計」または「環境設定」セクションに以下を含める：
  1. 使用する外部APIのサンドボックス/テスト環境の概要
  2. QA打鍵確認に必要な環境変数の一覧（変数名・取得方法・設定先）
  3. curlコマンド例（正常系1例・異常系1例）
- 未記載の場合、task-reviewerがMAJOR判定する

requirements.md承認後に、以下のエージェントを**並列（同時にAgent呼び出し）**で起動する:

##### パターンA: UI要件あり（三又並列）

**[並列-1] design-generatorエージェント → design.md**
1. エージェント内で既存アーキテクチャの調査を実施
2. 差分設計を中心に設計書を作成
3. requirements.mdの内容を参照
4. **⚠️ ui-design.pen は並列生成中のため参照不可。UI関連セクション（9-11）では、UIの詳細仕様は `ui-design.pen` を参照先として記載すること（例: 「UIレイアウトの詳細は ui-design.pen を参照」）**
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/development/backend-architecture.md`
    - `docs/einja/steering/development/frontend-development.md`
    - `docs/einja/steering/development/api-development.md`
    - `docs/einja/steering/development/testing-strategy.md`
    - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
  - requirements.mdの「実装参考情報」セクションを参照し、design.mdに「関連ドキュメント」「関連Skill・サブエージェント」セクションを出力すること。
  - **外部API連携がある場合**: 上記「外部API連携がある場合の必須記載事項」に従うこと
  - design.md は最低限、`Overview` / `Existing Architecture Analysis` / `Architecture Pattern & Boundary Map`（C4 Container相当 graph TB+subgraph、外部システム明示）/ `Technology Stack` / `System Flows`（主要+例外 alt/opt/loop/par）/ `Requirements Traceability` / `Component Summary`（C4 Component図 + 一覧テーブル）/ `Components and Interfaces` / `Data Model`（物理ERD erDiagram + Entity/DTO + Persistence）/ `API Contract` / `State Transitions`（該当時）/ `Rules Mapping` / `Testing Strategy for This Feature` / `Related Documents` / `Related Skills / Subagents` を持つこと。
  - **mermaid記法方針**: C4記法（`C4Context`/`C4Container`等）は公式experimentalのため使用しない。`graph TB` + `subgraph` で C4 相当を表現すること。
  - requirements.md の `Story単位AC一覧` と `§5〜§8 のルール系セクション（表示・計算ルール / 入力ルール / 権限マトリクス / 画面遷移）` と `§9〜§12 のフロー・状態・データモデル` を参照し、設計へトレースすること。
  - 一般論ではなく、既存実装に対して何を再利用し何を追加するかを優先して書くこと。

**[並列-2] ui-design-generatorエージェント → ui-design.pen（hi-fi 詳細化）**
1. Phase 1 で作成した lo-fi WF を同一 `.pen` 上で詳細化する
   - `mode=hi-fi`, `phase=2`, `existing_pen_path={仕様書ディレクトリ}/ui-design.pen`, `requirements_path={仕様書ディレクトリ}/requirements.md` をパラメータで渡す
   - lo-fi フレーム（`WF-*`）は削除せず残す
   - hi-fi フレーム群（`HF-S{n}-F{nn}` 命名）を追加する
2. requirements.mdの内容を参照
3. einja-pencil-design-manager の共通コンポーネントと同期
4. 出力: `{仕様書ディレクトリ}/ui-design.pen`（lo-fi + hi-fi 共存）
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/development/pencil-design-management.md`

**[並列-3] qa-generatorエージェント → qa-test.md**
1. requirements.mdの内容を参照（**design.mdは参照しない — 並列生成中のため**）
2. `docs/einja/templates/qa-test.md.template` をテンプレートとして使用し、feature単位の単一QAテストファイルを生成
3. 受け入れ基準（AC）との対応付け
- **追加指示（呼び出し時にプロンプトに含める）**:
  - 以下のsteering文書を事前に読み込んでから作業すること:
    - `docs/einja/steering/acceptance-criteria-and-qa-guide.md`
    - `docs/einja/steering/development/testing-strategy.md`
  - `docs/einja/templates/qa-test.md.template` をテンプレートとして使用し、feature単位の単一 `qa-test.md` ファイルを生成すること。
  - `AC一覧 → シナリオ一覧 → シナリオ詳細` の構造で QA 仕様を作成すること。
  - QA仕様は最低限、`概要`、`テスト環境`、`必須自動テスト結果`、`AC一覧`、`シナリオ一覧`、各シナリオの `目的`、`関連AC`、`前提条件`、`テスト手順`、`結果`、`統合テスト結果サマリー` を持つこと。
  - 各シナリオの `前提条件` には `テストデータ`、`ログインロール`、`依存` を必ず含めること。
  - `テスト手順` の表は `No / 手順 / 確認項目 / 期待値 / 結果 / 備考` を使用すること。
  - シナリオは Story単位ではなく、画面操作や契約確認のまとまりで切ること。
  - 少なくとも `初期表示`、`保存フロー`、`バリデーション`、`権限制御`、`エラーハンドリング` の観点をカバーすること。
  - **外部API連携がある場合の必須記載事項**:
    - 外部APIを呼び出すACのQAテストシナリオに「実API打鍵確認ステップ」を含めること
    - 「モックでのPASS」と「実APIでの打鍵確認」は別ステップとして分けて記載
    - 打鍵確認に必要な前提条件（環境変数、サンドボックスアカウント等）を「前提条件」欄に明記

##### パターンB: UI要件なし（二又並列）

**[並列-1] design-generatorエージェント → design.md**（パターンAと同じ）
**[並列-2] qa-generatorエージェント → qa-test.md**（パターンAの並列-3と同じ）

##### 三又（または二又）並列完了後の処理

1. **横断チェック**（オーケストレーター実施）
   - designのAPIパス・画面名がQAシナリオで正しく参照されているか確認
   - 不整合がある場合は該当ファイルを修正

2. **`einja-review-spec` Skillで並列レビューを実施**
   - `review_scope=phase2_bundle`
   - requirements.md、design.md、qa-test.md、`ui-design.pen` がある場合はスクリーンショット要約を渡す
   - design / qa / ui の用語・画面名・API名・外部API前提の不整合を重点確認する
   - Phase 2 の ui-design.pen レビュー観点（hi-fi）:
     - デザイントークン・コンポーネント妥当性・実装可能性
     - カラー・タイポ・スペーシング・ブランド適合
   - **MAJOR** の場合は該当エージェントに修正指示を返し、再レビューする（最大2回）

> **Headless mode 時の挙動**: 下記ステップ3「一括承認（ユーザー確認）」は **ユーザー承認待ちを発生させない**。`einja-review-spec`（`review_scope=phase2_bundle`）が PASS/MINOR であれば自動継続、生成物パスを `resume-state.json` の `generatedArtifacts` に追記して Phase 3 へ進む。一括コミット＆プッシュは実施してよい。詳細は「対話ポイント分岐表」#8。

3. **一括承認（ユーザー確認）**
   - 全成果物を構造化フォーマットで一括提示:
     - **design.md**: パスと概要、確認ポイント（アーキテクチャの妥当性、API設計）
     - **ui-design.pen**（該当時のみ）: Pencil MCPのget_screenshotで各画面プレビュー、確認ポイント（レイアウト、コンポーネント選択）
     - **qa-test.md**: 概要、確認ポイント（テスト網羅性、AC対応、シナリオテストの妥当性）
   - `einja-review-spec` が PASS/MINOR であることを明記する
   - 承認後、一括コミット＆プッシュ
     - コミットメッセージ: `docs: {機能名}の設計・QAテスト仕様を追加`（ui-design含む場合: `docs: {機能名}の設計・UIデザイン・QAテスト仕様を追加`）

4. **承認を得てから次のステップ（GitHub Issueへのタスク記述）に進む**

#### Phase 3: GitHub Issueへのタスク記述

##### 3.1 タスク生成・検証ループ

**重要**: タスク生成後は自動的にフォーマット検証を行い、違反があれば差し戻します。

```
【タスク生成・検証ループ】（最大3回）
  │
  ├─ tasks-generator 呼び出し
  │   └─ タスク一覧を生成（またはエラーフィードバックを元に修正版を生成）
  │
  ├─ tasks-validator 呼び出し
  │   └─ フォーマット検証
  │
  └─ 検証結果判定
      ├─ SUCCESS → ループ終了、ユーザー確認へ
      └─ FAILURE → tasks-generator に差し戻し
                   └─ エラーレポート付きで再呼び出し
                   └─ ループ再開（最大3回）

  ※ 3回失敗 → ユーザーに手動修正を依頼
```

1. **tasks-generatorエージェントでタスク生成**
   - エージェント内で実装の影響範囲を分析
   - 実装タスクの分解と依存関係
   - requirements.md、design.md、**qa-test.md**の内容を参照
   - 各タスクに**QAテストシナリオ実施タイミング**を明記
   - **GitHub Issueの説明文にタスク一覧を記述**
   - **追加指示（呼び出し時にプロンプトに含める）**:
     - 🔴 **フォーマット厳守**: タスク一覧は必ず `_einja-issue-spec-tasks-generator` Skill（フロントマターでプリロード済み）のフォーマットに従うこと。特に: Phase見出しは `### Phase N:`、タスクグループは `- [ ] X.Y`、タスクは `  - X.Y.Z`、メタデータは `    - **太字キー**: 値` 形式。`Task X-Y` 形式や太字なしメタデータは即バリデーションエラーとなる。
     - requirements.mdの「実装参考情報」とdesign.mdの「関連ドキュメント」「関連Skill・サブエージェント」セクションを参照し、各タスクグループ/タスクに `**実行サブエージェント**` と `**使用Skill**` を付与すること。
     - 委託ルール対応表（参考）:
       | 作業 | 推奨サブエージェント |
       |------|---------------------|
       | フロントエンド アーキテクチャ設計 | [frontend-architect] |
       | フロントエンド デザイン実装 | [design-engineer] |
       | フロントエンド コーディング | [frontend-coder] |
       | バックエンド アーキテクチャ設計 | [backend-architect] |

2. **tasks-validatorエージェントでフォーマット検証**
   - タスク階層（Phase/タスクグループ/タスク/サブタスク）の形式チェック
   - メタデータ（要件・実装AC・依存関係・完了条件・対応設計・シナリオテスト）の必須チェック
   - 依存関係の書式・参照先の検証
   - ATDD粒度チェック（Phase数、縦切り/横切り）

3. **検証結果の処理**
   - **SUCCESS**: ユーザー確認フェーズへ進む
   - **FAILURE（リトライ可能）**:
     - エラーレポートを tasks-generator に渡して再生成
     - ループ再開（現在の試行回数をインクリメント）
   - **MAX_RETRIES_EXCEEDED（3回失敗）**:
     - ユーザーに手動修正を依頼
     - エラー内容を提示し、修正後に続行できるよう案内

> **Headless mode 時の挙動**: `attemptCounts.tasksValidator` を `resume-state.json` にインクリメントしつつ **2回まで自動再生成**（Interactive の3回より1回少ない）。それでも FAILURE なら PENDING_QUESTIONS を返却し `resume-state.status = "blocked"` で停止する。ユーザーへの手動修正依頼は発生させない。詳細は「対話ポイント分岐表」#9。

##### 3.2 ユーザー確認

> **Headless mode 時の挙動**: ステップ5「ユーザーに内容確認を依頼」は実行しない。`einja-review-spec`（`review_scope=tasks`）が PASS/MINOR であれば自動で 6.a〜6.d の処理に進む。ステップ6.c「PR作成」は **create-or-update で冪等化**（永続マーカー `kind=issue-spec-pr` で既存PR検索、存在すればupdate、無ければcreate。base は入力契約の `pr-base-branch`）。ステップ6.d「GitHub Issue説明文更新」も冒頭の永続マーカーを保持しつつ create-or-update。Milestone / Epic Tracker Issue へのリンクは入力契約の `milestone` / `epic-tracker-issue` から付与する。詳細は「対話ポイント分岐表」#10・#11・#12、および Task 3-4。

4. **`einja-review-spec` Skillで並列レビューを実施**
   - `review_scope=tasks`
   - requirements.md、design.md、qa-test.md、タスク一覧本文を渡す
   - tasks-validator合格後に実施し、ATDD粒度・依存関係・実行準備性を横断確認する
   - **MAJOR** の場合は tasks-generator に修正指示を返し、再レビューする（最大2回）

5. **ユーザーに内容確認を依頼**
   - 更新したGitHub IssueのURL（#{issue_number}）と概要を提示
   - 確認ポイントを明示（タスク分解の粒度、依存関係の妥当性など）
   - **tasks-validator合格済み**かつ `einja-review-spec` が PASS/MINOR であることを明記

6. **ユーザー承認後、以下の処理を実行**

   a. **Issueブランチの確認**
   - 0.4でワークツリー内にIssueブランチ（`issue/{issue番号}`）は作成済み
   - リモートへの反映は `mcp__github__create_branch` で実施（未作成時のみ）

   b. **仕様書ファイルをプッシュ**
   - worktree内で `git push origin issue/{issue番号}` を実行
   - ※ 各Phase承認時にコミット＆プッシュ済みのため、最終プッシュは不要な場合が多い

   c. **PR作成（MCP）**
   - `mcp__github__create_pull_request` を使用
   - base: デフォルトブランチ
   - head: `issue/{issue番号}`
   - title: `docs: {機能名} 仕様書`
   - body: `Issue #{issue番号} の仕様書を作成しました。`
   - **PR URLを記録**

   d. **GitHub Issue説明文を更新（MCP）**
   - `mcp__github__issue_write` を使用（method: update）
   - 本文に以下を含める:
     - Spec PR へのリンク
     - 要件ドキュメントへのリンク（requirements.mdまたはrequirements/README.md）
     - UIデザインへのリンク（ui-design.pen、存在する場合のみ）
     - 設計ドキュメントへのリンク（design.mdまたはdesign/README.md）
     - QAテスト仕様へのリンク（qa-test.md）
     - タスク一覧（Phase別チェックボックス形式、QAテストシナリオ実施タイミング明記）

6. **全ての仕様書作成が完了したことを報告**
   - GitHub Issue URLを明記
   - Spec PR URLを明記


### 4. 既存ファイル処理
- 既存ファイルは内容確認後に次段階へ進行
- 修正指示がある場合のみ該当エージェントで再生成

### 4. 成果物の構成

#### 基本構成（各ファイルが1000行以下の場合）
```
/docs/specs/issues/
└── {機能カテゴリ名}/
    └── issue{issue番号}-{機能名}/
        ├── requirements.md  # 要件定義書（ATDD形式）
        ├── ui-design.pen    # UIデザイン（UI関連のみ）
        ├── design.md        # 設計書（技術詳細）
        └── qa-test.md       # QAテスト仕様（feature単位の単一ファイル、テンプレート: docs/einja/templates/qa-test.md.template）

（注: タスク一覧はGitHub Issueに記述）
```

#### 分割構成（ファイルが1000行超過の場合）
```
/docs/specs/issues/
└── {機能カテゴリ名}/
    └── issue{issue番号}-{機能名}/
        ├── requirements/             # 要件定義書ディレクトリ
        │   ├── README.md            # 目次
        │   ├── overview.md          # 概要とスコープ
        │   ├── stories.md           # ユーザーストーリー
        │   └── technical.md         # 技術要件
        ├── ui-design.pen            # UIデザイン（UI関連のみ）
        ├── design/                  # 設計書ディレクトリ
        │   ├── README.md            # 目次
        │   ├── architecture.md      # アーキテクチャ
        │   ├── implementation.md    # 実装詳細
        │   └── quality.md           # 品質と運用
        └── qa-test.md               # QAテスト仕様（feature単位の単一ファイル、テンプレート: docs/einja/templates/qa-test.md.template）

（注: タスク一覧はGitHub Issueに記述）
```

**自動分割機能**:
- 各エージェント（requirements/design）は生成後に自動的にファイルサイズをチェック
- 1000行を超える場合、意味のあるまとまりで2-3個のパートに自動分割
- README.mdで全体構成とナビゲーションを提供
- 分割されたファイルも他エージェントから正しく参照可能

## 既存進行中Issueへの移行判断

本Skillのテンプレート・AC命名体系・章立ては 2026-04-20 に刷新された。既存の進行中Issueについては以下の判断ルールに従うこと。

| 状態 | 判断 |
|------|------|
| 新規Issue（本Skillで spec-create を新規実行） | **新テンプレ必須** |
| 完全新規着手（Phase 0-1段階の既存Issue） | 新テンプレへ移行推奨 |
| Phase 2以降進行中（requirements.md承認済み） | **現行のまま完遂**（混在回避） |
| 要件変更で大改訂が必要なIssue | 個別判断（残工数・AC数で判定。30件未満なら移行推奨） |

旧形式サンプル（`/docs/einja/example/specs/issues/issue999-example-task/` の旧版）は本刷新時に新形式に完全書き換えされている。参照するサンプルは新形式のみ。

## 重要な原則
- 段階的開発：requirements承認後は並列生成し一括承認
- ATDD形式による受け入れ基準の明確化
- Next.js + Hono + Prisma技術スタック対応
- Asana/Figma連携によるトレーサビリティ確保

## Headless mode 詳細実装（後続タスクで拡充）

本Skillの Headless mode は、以下のサブセクションに分けて段階的に実装する。本タスク（Task 3-1）は**ゲート構造と入力契約の整備のみ**を完了させており、具体的な処理ロジックは後続タスクで埋める。各セクションは独立した編集境界を持つため、並行編集時の衝突を避けられる。

### Headless: resume-state 読み書き・冪等再開（Task 3-2 で詳細化）

<!-- HEADLESS_RESUME_STATE_START (Task 3-2 owns this block) -->

本ブロックは Headless mode における `resume-state.json` の読み書きと冪等再開ロジックを定義する。参照スキーマ:

- `docs/einja/templates/epic-specs/schemas/resume-state.schema.json`
- `docs/einja/templates/epic-specs/schemas/operation-log-entry.schema.json`
- `docs/einja/templates/epic-specs/schemas/persistent-marker.schema.json`
- サンプル: `docs/einja/templates/epic-specs/samples/resume-state.sample.json`
- マーカー仕様: `docs/einja/templates/epic-specs/persistent-marker-spec.md`

v1 は順次実行のみのため、ファイルロックや atomic write は不要。並列化は将来の `einja-epic-exec` で別途対応する。

#### 1. resume-state.json のロードと初期化

Headless 起動直後（外部入力のバリデーション後・Phase 1 開始前）に、以下の順で実行する:

1. 入力 `resume-state-path` を絶対パスに正規化し、親ディレクトリが存在することを確認する（存在しない場合は `mkdir -p` で作成）。
2. ファイルが存在しない場合は**新規作成**し、以下の初期値を書き込む（`schemaVersion: "1.0"` 固定）:
   ```json
   {
     "schemaVersion": "1.0",
     "epicId": "{Headless入力 epicId}",
     "issueSlug": "{Headless入力 issueSlug}",
     "status": "pending",
     "currentPhase": "requirements",
     "generatedArtifacts": [],
     "githubIssueNumber": {Headless入力 github-issue-number または null},
     "milestoneId": {Headless入力 milestone の ID または null},
     "trackerIssueNumber": {Headless入力 epic-tracker-issue または null},
     "branch": null,
     "issuePrNumber": null,
     "pendingQuestions": [],
     "answers": [],
     "operationLog": [],
     "attemptCounts": { "reviewSpec": 0, "tasksValidator": 0, "questionLoop": 0 },
     "updatedAt": "{現在時刻 ISO 8601 UTC}"
   }
   ```
3. ファイルが存在する場合は JSON として読み込み、`resume-state.schema.json` で**検証**する。
   - `schemaVersion` が `"1.x"` 系でない（pattern `^1\.` に不一致） → `PENDING_QUESTIONS` 返却（メジャー不一致は非互換、マーカーブロック HEADLESS_PENDING_QUESTIONS の手順に従う）。
   - 必須キーの欠落 / enum 違反 → `PENDING_QUESTIONS` 返却。
   - `epicId` / `issueSlug` が Headless 入力と不一致 → `PENDING_QUESTIONS` 返却（別 Issue の resume-state を誤指定している疑い）。
4. **短絡終了チェック**: `status === "completed"` の場合、既に完了済みなので**即時 return**（何も書き込まない、成果物も再生成しない）。サブエージェントは「この Issue は既に完了済み」を 1 行で報告する。

#### 2. 冪等再開（resume）の判定

`status` が `pending` 以外の場合、以下の順で再開可否を判定する:

1. `status === "blocked"` の場合:
   - `pendingQuestions[]` に列挙された `Q-*` ID それぞれについて、`answers[]` に対応する `questionId` + 非空 `answer` が存在するか確認。
   - **全質問に回答あり** → `status = "resumed"` に遷移し、Phase 3（後述）へ進む。
   - **未回答が 1 件でも残存** → 既存 `pendingQuestions` を再返却（HEADLESS_PENDING_QUESTIONS ブロックの形式に従う）。`resume-state.json` は変更しない。
2. `status === "failed"` の場合 → 回復不能エラーの再開は自動で行わず、`PENDING_QUESTIONS` で「failed 状態からの再開方針」をユーザーへ確認。
3. `status === "running"` の場合 → **前回の中断からのクラッシュリカバリ**扱いとし、直ちに `resumed` へ遷移して Phase 3 の再開地点特定に進む（`updatedAt` から 1 時間以上経過していれば安全に resume 可能と判断）。
4. `status === "resumed"` の場合 → 何もせず Phase 3 へ進む。

#### 3. 再開地点の特定（未完了フェーズ検出）

`currentPhase` と `generatedArtifacts[]` を突き合わせて実行すべきフェーズを決める。フェーズの標準順序は次の通り:

```
requirements → (ui-design) → design → qa-test → tasks → completed
```

`ui-design` は `scope.md` / `epic-manifest.json` の `uiFrameIds` が空（または省略）の場合スキップする。

- 各フェーズの想定成果物パス（例: `{issueDir}/requirements.md`, `{issueDir}/ui-design.pen`, `{issueDir}/design.md`, `{issueDir}/qa-test.md`, タスク一覧は GitHub Issue 本文のため artifacts には含めない）が `generatedArtifacts[]` に存在するフェーズは**完了済み**として扱い、スキップする。
- 実行フェーズは `currentPhase` を基準にし、未完了成果物が最初に現れるフェーズから再開する。
- `generatedArtifacts` に記録があっても、ディスク上のファイルが欠落している場合は **matcher 不整合** として `PENDING_QUESTIONS` を返す（手動削除検出）。
- Phase 3 (tasks) は GitHub Issue 本文のタスク記述で完了判定するため、Issue 本文に永続マーカー + 「タスク一覧」セクションが両方揃っているかを GET で確認する。

#### 4. 外部リソース再照合・冪等再利用手順

`operationLog[]` を**スキップ根拠として単独で信頼せず**、外部状態を必ず GET で再照合してから reuse / create を判定する。根拠: resume 後に GitHub 側で手動削除・リネーム・本文書き換えが発生している可能性があるため。

対象リソースごとに以下の順序で処理する:

1. `operationLog[]` を走査し、対象 `idempotencyKey`（形式 `{epicId}:{issueSlug|null}:{kind}`）に一致するエントリを探す。
2. **一致エントリが `status: "success"` + `remoteId` 有** → GET で再照合:
   - Issue / PR: `GET /repos/{owner}/{repo}/issues/{number}`（PR も `issues` エンドポイントで取得可能）
   - Milestone: `GET /repos/{owner}/{repo}/milestones/{id}`
3. **GET 成功 + 本文（Milestone は description）冒頭のマーカーが完全一致** → そのリソースを **reuse**（必要なら update で内容だけ書き換え、マーカー行は維持）。`operationLog` エントリの `updatedAt` を現在時刻で更新。
4. **GET 404、またはマーカー不一致**（schema バージョン違い・epic-id 違い・kind 違い等）→ マーカー検索へフォールバック:
   - Issue / PR: GitHub Search API `q=repo:{owner}/{repo} "einja:epic-id={epicId}" in:body`、必要に応じて `type:issue` / `type:pr` / `"kind={kind}"` を追加。ヒット番号ごとに GET で本文を取得してマーカー完全一致を再確認する（Search API はスニペット部分一致のため）。
   - Milestone: REST `GET /repos/{owner}/{repo}/milestones?state=all&per_page=100` を `Link` ヘッダの `rel="next"` を追跡してページング取得。各 milestone の `description` を走査し、`einja:epic-id={epicId}` を含むものをクライアント側で抽出 → `kind=milestone` を完全一致で再確認。
5. **マーカー検索で発見** → `operationLog` 該当エントリの `remoteId` を補正し、`updatedAt` を現在時刻で更新、`status` は `success` のまま保持。該当リソースを reuse。
6. **いずれの手段でも見つからない** → 新規 create を実行し、成功後に `operationLog` へ新規エントリを push（`operationType` / `idempotencyKey` / `remoteId` / `persistentMarker` / `status: "success"` / `createdAt` / `updatedAt` / `error: null` を設定）。
7. **`status: "failed"` エントリはスキップ禁止**:
   - `error.retryable === true` → 再試行（再試行成功なら同エントリを `updatedAt` 更新 + `status: "success"` + `error: null` に書き換え。失敗なら error を最新化して維持）。
   - `error.retryable === false` → `PENDING_QUESTIONS` に昇格（ユーザー判断を仰ぐ）。
8. reuse / create / update いずれも、対応するリソース本文（または Milestone description）冒頭の永続マーカー行を必ず維持する（マーカー仕様 L109-L113 に従う）。

#### 5. フェーズ実行中の状態更新

各フェーズの開始・終了時に resume-state を以下のように更新する。書き込みのたびに `updatedAt` を現在時刻（ISO 8601, UTC）で上書きする。

| タイミング | 更新内容 |
|-----------|---------|
| フェーズ開始時 | `status = "running"`, `currentPhase = "{phase}"` |
| フェーズ成果物が生成・保存された直後 | `generatedArtifacts` に相対パスを push（重複回避のため既存チェック） |
| `einja-review-spec` が MAJOR を返し自動再生成する前 | `attemptCounts.reviewSpec += 1` |
| tasks-validator が FAILURE を返し自動再生成する前 | `attemptCounts.tasksValidator += 1` |
| PENDING_QUESTIONS 返却直前 | `status = "blocked"`, `pendingQuestions` 更新（HEADLESS_PENDING_QUESTIONS ブロック参照）、`attemptCounts.questionLoop += 1` |
| 全フェーズ完了時 | `status = "completed"`, `currentPhase = "completed"` |
| 回復不能エラー発生時 | `status = "failed"`（ただしまず再試行を試みてから） |

**attemptCounts は resume 時にリセットしない**（無限ループ防止のため引き継ぐ）。ユーザー回答反映後も保持する。

#### 6. attemptCounts の上限チェック

各フェーズでの再生成ループに入る前に、以下の上限を必ずチェックする:

- `attemptCounts.reviewSpec >= 2` → `einja-review-spec` の MAJOR が 2 回連続した状態。これ以上の自動再生成は行わず `PENDING_QUESTIONS` を返却（sourceSkill=`einja-review-spec`）。
- `attemptCounts.tasksValidator >= 2` → tasks-validator 失敗が 2 回連続。`PENDING_QUESTIONS` を返却（sourceSkill=`tasks-validator`）。
- `attemptCounts.questionLoop >= 3` → 同一 Issue で質問ループが 3 回発生。`PENDING_QUESTIONS` に「Epic 全体の停止が必要」を明示して返却（Epic 側がこれを検出して Epic 停止する）。

上限に達した場合は resume-state の `status = "blocked"` に更新し、ただちに停止する。

#### 7. ファイル書き込み規約

- 文字コード: UTF-8、改行: LF、インデント: 2 スペース（JSON 標準）。
- 書き込み順: JSON Schema 検証 → 一時ファイル書き出し → rename で置換（v1 では atomic write 強制ではないが、簡易的な安全措置として推奨）。
- 書き込み前に必ず `resume-state.schema.json` で検証し、スキーマ違反があれば**書き込みを中止**して `PENDING_QUESTIONS` を返す（壊れた resume-state を永続化しない）。
- `operationLog[]` への push 時は `operation-log-entry.schema.json` で、永続マーカー文字列は `persistent-marker.schema.json` の string 側パターンで個別検証する。
- 書き込み失敗（I/O エラー等）は fatal として `status = "failed"`（最終試行後）で報告する。

#### 8. 操作手順の Bash コマンド例

参考用の具体コマンド例（jq / ajv を想定。環境依存のため実装時は存在確認を行うこと）。

**読み込みと検証（ajv がある場合）**:
```bash
# 存在確認
test -f "$RESUME_STATE_PATH" || echo "新規作成対象"

# JSON 読込
STATE="$(cat "$RESUME_STATE_PATH")"

# スキーマ検証（ajv-cli があれば推奨）
npx -y ajv-cli validate \
  -s docs/einja/templates/epic-specs/schemas/resume-state.schema.json \
  -r docs/einja/templates/epic-specs/schemas/operation-log-entry.schema.json \
  -d "$RESUME_STATE_PATH" || exit 1

# status 確認
STATUS="$(jq -r '.status' "$RESUME_STATE_PATH")"
[ "$STATUS" = "completed" ] && echo "短絡終了" && exit 0
```

**ajv が使えない場合のフォールバック（jq のみで必須キー・enum の簡易確認）**:
```bash
REQUIRED_KEYS='["schemaVersion","epicId","issueSlug","status","currentPhase","generatedArtifacts","operationLog","attemptCounts","updatedAt"]'
jq -e --argjson keys "$REQUIRED_KEYS" '[.[$keys[]]?] | length == ($keys | length)' "$RESUME_STATE_PATH" >/dev/null \
  || { echo "必須キー欠落"; exit 1; }
jq -e '.status | IN("pending","running","blocked","resumed","completed","failed")' "$RESUME_STATE_PATH" >/dev/null \
  || { echo "status enum 違反"; exit 1; }
jq -e '.schemaVersion | test("^1\\.")' "$RESUME_STATE_PATH" >/dev/null \
  || { echo "schemaVersion 不一致（1.x 系でない）"; exit 1; }
```

**状態更新（フェーズ開始時）**:
```bash
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp)"
jq --arg phase "design" --arg now "$NOW" \
  '.status = "running" | .currentPhase = $phase | .updatedAt = $now' \
  "$RESUME_STATE_PATH" > "$TMP" \
  && mv "$TMP" "$RESUME_STATE_PATH"
```

**成果物追加**:
```bash
ARTIFACT="docs/specs/epics/{epic-slug}/issues/{issue-slug}/design.md"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp)"
jq --arg a "$ARTIFACT" --arg now "$NOW" \
  '.generatedArtifacts |= (. + [$a] | unique) | .updatedAt = $now' \
  "$RESUME_STATE_PATH" > "$TMP" \
  && mv "$TMP" "$RESUME_STATE_PATH"
```

**attemptCounts インクリメント**:
```bash
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp)"
jq --arg now "$NOW" \
  '.attemptCounts.reviewSpec += 1 | .updatedAt = $now' \
  "$RESUME_STATE_PATH" > "$TMP" \
  && mv "$TMP" "$RESUME_STATE_PATH"
```

**operationLog への追記（create 成功時）**:
```bash
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ENTRY=$(jq -n \
  --arg t "issue-create" \
  --arg k "EPIC-1:profile-view-edit:issue-spec" \
  --argjson r 101 \
  --arg m "<!-- einja:epic-id=EPIC-1 issue-slug=profile-view-edit kind=issue-spec schema=1.0 -->" \
  --arg now "$NOW" \
  '{operationType:$t, idempotencyKey:$k, remoteId:$r, persistentMarker:$m, status:"success", createdAt:$now, updatedAt:$now, error:null}')
TMP="$(mktemp)"
jq --argjson e "$ENTRY" --arg now "$NOW" \
  '.operationLog += [$e] | .updatedAt = $now' \
  "$RESUME_STATE_PATH" > "$TMP" \
  && mv "$TMP" "$RESUME_STATE_PATH"
```

**operationLog の更新（再照合で remoteId を補正）**:
```bash
KEY="EPIC-1:profile-view-edit:issue-spec"
NEW_REMOTE_ID=105
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp)"
jq --arg k "$KEY" --argjson id "$NEW_REMOTE_ID" --arg now "$NOW" \
  '(.operationLog[] | select(.idempotencyKey == $k) | .remoteId) = $id
   | (.operationLog[] | select(.idempotencyKey == $k) | .updatedAt) = $now
   | .updatedAt = $now' \
  "$RESUME_STATE_PATH" > "$TMP" \
  && mv "$TMP" "$RESUME_STATE_PATH"
```

書き込み後は毎回 ajv（または簡易 jq チェック）で再検証し、壊れていたら旧版に巻き戻す。

<!-- HEADLESS_RESUME_STATE_END -->

### Headless: PENDING_QUESTIONS 返却プロトコル（Task 3-3 で詳細化）

<!-- HEADLESS_PENDING_QUESTIONS_START (Task 3-3 owns this block) -->

Headless mode で不明点が発生した場合、本Skillは **既存 `_einja-subagent-question-protocol` の Markdown `## PENDING_QUESTIONS` セクション形式をそのまま返却**し、作業を停止する。プロトコル互換を保つため、本Skillから `_einja-subagent-question-protocol` への変更は一切加えない。Epic 側（`einja-epic-spec-create`）が受領した Markdown を `question-broker.json`（スキーマ: `docs/einja/templates/epic-specs/schemas/question-broker.schema.json`）のエントリに正規化する。

> **重要（Interactive mode との分離）**: Interactive mode（`<<MODE: HEADLESS>>` マーカーなし）では従来通り `AskUserQuestion` を使う。本ブロックの処理は Headless mode 時にのみ有効化される。

#### 1. PENDING_QUESTIONS 発火条件（発生トリガー）

Headless 実行中に以下のいずれかを検知した場合、直ちに PENDING_QUESTIONS を返却して停止する。発火前に同等質問が `pendingQuestions` / `answers` に存在しないか必ず照合し、存在すれば既存回答を再利用して発火を回避する。

| # | トリガー | 検知条件 | `type`（broker 分類参考） | 関連対話ポイント |
|---|----------|----------|---------------------------|------------------|
| T1 | 要件ヒアリング不足 | `scope-path` の `scope.md` frontmatter + 本文から、必須要件（AC / Story / ペルソナ / ビジネス目的 / スコープ境界）を抽出できない | `requirement-ambiguity` | #1（Phase 0.3）|
| T2 | scope.md frontmatter 欠落 / 不整合 | `scope-frontmatter.schema.json` 必須キー欠落、`schemaVersion` 不整合、`epic-manifest.json` との不整合 | `requirement-ambiguity` | 入力契約・#1 |
| T3 | 入力契約欠落 | 必須キー（`epic-context` / `manifest-path` / `scope-path` / `resume-state-path` / `github-issue-number` / `issue-base-branch` / `pr-base-branch`）のいずれかが欠落、または存在しないパスを指す | `requirement-ambiguity` | 「Headless mode 入力契約」節 |
| T4 | `einja-review-spec` MAJOR が上限到達 | `attemptCounts.reviewSpec >= 2` に達した後の再レビューでも MAJOR（= 3回目も MAJOR） | `review-major` | #4 / #6 / #8 / #10 |
| T5 | tasks-validator 失敗が上限到達 | `attemptCounts.tasksValidator >= 2` に達した後の再生成でも FAILURE（= 3回目も FAILURE） | `validator-failure` | #9 |
| T6 | 外部リソース操作の非再試行失敗 | `operationLog[]` に `status="failed"` かつ `error.retryable=false` のエントリが存在 | `validator-failure` | 外部指定処理（Task 3-4）|
| T7 | Phase 2 UI 要否判断不能 | manifest の対象 Issue エントリで `uiFrameIds` の有無が判断不能（未定義かつ本文から UI 要件有無を決定できない） | `design-decision` | #7 |
| T8 | 質問ループ上限（停止推奨） | `attemptCounts.questionLoop >= 3` に到達。このトリガーは単独でも発火し、同時に「Epic 全体停止推奨」を本文に明示する | `requirement-ambiguity`（ループ継続不能の文脈） | 全般（「無限ループ防止」参照）|

**発火前の重複チェック**:
1. `resume-state.answers[]` に同等質問（後述の正規化規則で等価）があれば、その回答をコンテキストに注入して処理を続行し、発火を回避する。
2. `resume-state.pendingQuestions[]` に既出の questionId と等価な質問が残存している場合（resume 前に回答が未反映）、同じ質問を再追加せず、その questionId を再掲する。

#### 2. 返却 Markdown フォーマット（`_einja-subagent-question-protocol` 準拠）

出力は `## PENDING_QUESTIONS` セクション1つに**全未解決質問をまとめて**含める。1問ずつ返却しない。以下のテンプレートを厳守する（見出しレベル・太字キー・タイプ表記を機械的に解釈できる形に保つこと）。

```markdown
## PENDING_QUESTIONS

以下の不明点の解消が必要です。

### Q1: {質問タイトル（簡潔な名詞句）}
**背景**: {なぜこの質問が必要か、どのフェーズ・どの入力からの不明点か。参照パスがあれば相対パスで明記}
**タイプ**: `researchable` | `decision-required`

| 選択肢 | 説明 | メリット | デメリット |
|--------|------|----------|------------|
| A: {ラベル} | {詳細説明} | {メリット} | {デメリット} |
| B: {ラベル} | {詳細説明} | {メリット} | {デメリット} |
| C: {ラベル} | {詳細説明} | {メリット} | {デメリット} |

**推奨**: {A/B/C}（{推奨理由}）

### Q2: ...
```

**本文要件**（Epic 側が broker JSON 変換時に欠落検知で再発火するのを避けるため、以下は必須）:

- `### Q{N}:` は 1 から連番。独立した Section として分離する。
- `**背景**` / `**タイプ**` / `**推奨**` を必ず含める（推奨理由まで記述）。
- 選択肢テーブルは最低 2 件（A / B）。Markdown パイプテーブルの列構成は上記固定。「その他（自由入力）」に相当する選択肢は、Epic 側の AskUserQuestion が自動付与するため、ここで含める必要はない。
- 選択肢ラベル・説明は 1 行で収まる長さに留める（Markdown 表セル内の改行は禁止）。
- タイプ値は `researchable`（技術的事実・ライブラリ仕様等で客観的に答えられる）か `decision-required`（ビジネス要件・ユーザー意図・スコープ決定）のいずれか。迷ったら `decision-required`。
- 質問本文（背景・質問タイトル含む）には `## PENDING_QUESTIONS` リテラル文字列を含めない（パース混乱防止）。
- Epic 側の fingerprint 計算と整合する「**正規化前**の本文」で記載する（末尾記号除去・空白圧縮等は Epic 側が行うため、サブエージェント側は自然な日本語で記述する）。
- T4（review-spec MAJOR）/ T5（tasks-validator 失敗）発火時は、背景欄に「試行回数（例: `attemptCounts.reviewSpec=2` 後も MAJOR）」と「最後のレビュー/検証指摘の要約」を必ず記載する。
- T8（`attemptCounts.questionLoop >= 3`）発火時は、**必ず先頭の Q1 を停止推奨質問**とし、背景欄に過去3回の質問ループ履歴（`pendingQuestions` と対応する `answers` を Markdown 小テーブルで要約）を含める。推奨選択肢は「Epic 全体を停止して未解決事項を報告」とする。

#### 3. 返却直前の resume-state 更新

Markdown を出力する**直前**に、`resume-state.json`（スキーマ: `resume-state.schema.json`）を次のとおり更新し保存する。書き込みは Task 3-2 で定義する共通ライター手順に従って行い、書き込み後に Markdown を stdout に出力して即時停止する。

| フィールド | 更新内容 |
|-----------|---------|
| `status` | `"blocked"` に遷移 |
| `currentPhase` | 変更しない（質問解消後に同フェーズから再開するため） |
| `pendingQuestions[]` | **questionId は付与しない**。本Skillは questionId 未付与のまま Epic 側に委譲する。Epic 側が Markdown → broker JSON 正規化時に `Q-{sha256先頭12桁}` を付与し、直後に本 Skill の `pendingQuestions[]` に questionId を追記する（詳細は §5）|
| `attemptCounts.questionLoop` | `+1` インクリメント（トリガー種別に関わらず、1回の停止で1加算）|
| `attemptCounts.reviewSpec` / `attemptCounts.tasksValidator` | T4 / T5 発火時はインクリメント済み。その他トリガーでは変更しない |
| `operationLog[]` | T6 由来の `failed` エントリはそのまま保持（Epic 側の再試行判定に利用）|
| `updatedAt` | 現在時刻（ISO 8601, UTC）を設定 |

**注意**:
- `pendingQuestions` には schema 上 `Q-[a-f0-9]{12}` パターンの文字列しか入れられない。サブエージェント側は **questionId 未付与のままでは `pendingQuestions` を追記しない**（schema 違反を避けるため）。未付与状態の質問は stdout の Markdown セクションのみで Epic 側へ伝達し、questionId 付与と `pendingQuestions` への反映は Epic 側の責務とする。
- `status="blocked"` への遷移は、再開前に Epic 側が broker JSON を作成し、ユーザー回答を `answers[]` に反映し終わった時点で、Epic 側が `status="resumed"` に更新する。本Skill は `resumed` → `running` の遷移を再開時に行う（詳細は Task 3-2）。

#### 4. 再開時の入力受領（RESUMED_ANSWERS）

Epic 側が回答を集約した後、本Skillを `resume` パラメータで再起動する。再起動プロンプトには `<<MODE: HEADLESS>>` マーカーに加えて、以下の Markdown セクションが含まれる。本Skillはこのセクションを読み取り、該当フェーズから再開する。

```markdown
## RESUMED_ANSWERS

### Answer to Q1: {質問タイトル}
- **選択**: A | B | C | その他
- **回答本文**: {ユーザー回答本文}
- **questionId**: Q-xxxxxxxxxxxx

### Answer to Q2: ...
```

**再開時の本Skill側の処理**:
1. `RESUMED_ANSWERS` セクションをパースし、各 `questionId` / `question` / `answer` / `answeredAt` を `resume-state.answers[]` に追加（重複チェック: 同一 `questionId` が既にあれば上書きせずスキップ）。
2. 対応する `pendingQuestions[]` エントリを削除。
3. `status` を `"resumed"` → `"running"` に更新（Task 3-2 の共通ライター手順に従って実施）。
4. `updatedAt` を更新。
5. `operationLog` と `generatedArtifacts` を照合し、未完了フェーズ（`currentPhase` の保持値）から再開する。
6. 回答内容を対応するエージェント（requirements-generator / design-generator / tasks-generator / qa-generator）への入力コンテキストに組み込む。回答がフェーズを跨いで適用される場合（例: スコープ決定）、後続フェーズへの情報継承も行う。

> **未開始 Issue への回答伝播（参考）**: Epic 側は broker JSON の `appliesToIssueSlugs` を参照し、未開始 Issue の `resume-state.answers[]` にも同じ回答を事前注入する。本Skillは Headless 初回実行時に `answers[]` を必ず読み込み、関連質問の再発火を回避する（既出 fingerprint との照合）。

#### 5. Epic 側の正規化ステップ（参考情報・本Skillの責務外）

本Skillの責務ではないが、Markdown ↔ broker JSON の接続仕様を明示するため記載する（実装は Task 4 `einja-epic-spec-create` 側）。

1. Markdown `## PENDING_QUESTIONS` をパースし、`### Q{N}:` 単位で質問を切り出す。
2. 各質問について以下の正規化を実施してから fingerprint / questionId を計算する:
   - 前後空白 trim
   - 改行コードを LF (`\n`) に統一
   - 連続空白（全角スペース含む）を半角スペース1つに圧縮
   - 行末の記号（`。` / `.` / `?` / `？` / `!` / `！`）を除去
   - 小文字化
3. `fingerprint = sha256(sourceSkill + "|" + 正規化後 question 本文)` の 64 文字 hex を計算。
4. `questionId = "Q-" + fingerprint の先頭 12 文字`。
5. `question-broker.json` に以下で追記:
   - 同一 `fingerprint` が既存 → `appliesToIssueSlugs` に `sourceIssueSlug` を追加し、既存エントリを再利用（重複排除）。
   - 新規 → `sourceSkill="einja-issue-spec-create"` / `sourceIssueSlug={issueSlug}` / `type={発火トリガー #1 表の分類}` / `status="open"` / `answer=null` / `normalizedFromMarkdown=true` を付与して追記。
6. 本Skillの `resume-state.pendingQuestions[]` に、付与した `questionId` を追記（schema パターン準拠）。
7. AskUserQuestion で集約質問し、回答を broker JSON の `answer` と、`appliesToIssueSlugs` 全 Issue の `resume-state.answers[]` に反映。

#### 6. 無限ループ防止

- `attemptCounts.questionLoop` を発火ごとにインクリメントし、`>= 3` に到達した時点で T8 を発火させる。
- T8 発火時は `### Q1` を以下のテンプレートに固定する（ユーザーが Epic 全体の継続可否を判断できるようにする）:

```markdown
### Q1: 質問ループが上限に到達（Epic 全体の継続可否確認）
**背景**: 本 Issue `{issueSlug}` で PENDING_QUESTIONS が 3 回連続発生しました。過去の質問と回答は以下の通りです。
| 回 | 質問タイトル | ユーザー回答 |
|----|-------------|-------------|
| 1 | {タイトル} | {回答本文} |
| 2 | {タイトル} | {回答本文} |
| 3 | {タイトル} | {回答本文} |

今回の未解決事項: {今回発生した質問群の要約}

**タイプ**: `decision-required`

| 選択肢 | 説明 | メリット | デメリット |
|--------|------|----------|------------|
| A: Epic 全体を停止 | 未解決事項をまとめて報告し Epic 全体を停止する | 要件再検討の時間確保 | 進行済み成果物の再開タイミングが遅れる |
| B: 本 Issue のみスキップして継続 | この Issue を `failed` 扱いで skip し、残り Issue を継続 | 他 Issue の進捗は維持 | スキップ Issue の仕様が欠落したまま Epic 完了 |
| C: 追加ヒアリングで再開 | ユーザーから追加情報を得て質問ループを継続 | 本 Issue を完遂可能 | 根本原因が未解消だと再度ループ化するリスク |

**推奨**: A（3 回連続での質問発生は要件定義自体に曖昧さがあるシグナルのため、Epic 全体を停止して整理することを推奨）
```

- T8 発火時は同時に今回新規発生した他トリガーの質問（Q2 以降）も同じ Markdown セクション内に含めてよい（Epic 側で一括処理可能）。

#### 7. プロトコル互換性チェックリスト（実装時の自己検証）

本ブロック実装時に以下を満たすこと（Task 3-5 回帰テストで検証）:

- [ ] 出力 Markdown が `_einja-subagent-question-protocol` の「PENDING_QUESTIONS フォーマット」節のテンプレートと構造的に一致する（見出し・太字キー・表の列構成）。
- [ ] Markdown セクション直後にサブエージェントが必ず停止する（追加の発話・ツール呼び出しを行わない）。
- [ ] `resume-state.json` 書き込み後に Markdown を出力する順序を守る（書き込み失敗時は出力しない）。
- [ ] `_einja-subagent-question-protocol/SKILL.md` に一切の変更を加えていない（`git diff .claude/skills/_einja-subagent-question-protocol/` でゼロ確認）。
- [ ] Interactive mode（`<<MODE: HEADLESS>>` マーカーなし）では本ブロックの処理が発火しない（単一ガード `isHeadless` のみで分岐）。

<!-- HEADLESS_PENDING_QUESTIONS_END -->

### Headless: 外部指定入力の詳細処理（Task 3-4 で詳細化）

<!-- HEADLESS_EXTERNAL_INPUTS_START (Task 3-4 owns this block) -->

本ブロックは Task 3-1 で宣言した **Headless mode 入力契約**の各キー（`github-issue-number` / `issue-base-branch` / `pr-base-branch` / `milestone` / `epic-tracker-issue`）を、Skill 実行フロー上でどう使用するかの詳細を定義する。**Headless mode のみ適用**。Interactive mode の挙動は変更しない。

Issue Spec PR の create-or-update は、他 Skill に分散せず **Headless IssueSpec 側に一元集約**する（Epic 側は Epic PR のみ扱う）。

#### 1. 受領入力の使い方（入力キー → 処理対応）

##### 1.1 `github-issue-number`（GitHub Issue 番号）

- **Issue 新規作成は行わない**。Epic 側（`einja-epic-spec-create`）が先行して Issue 作成済みである前提で、受領した `github-issue-number` をそのまま使用する。
- **Issue 本文の更新**（Epic 参照リンク・タスク一覧・Related セクション等）は **create-or-update（冪等）** で実施する。
  - 取得: `mcp__github__issue_read`（または `gh issue view {N} --json body,url,number,title,milestone,state`）で現在の Issue 本文を取得
  - 更新: `mcp__github__issue_write` の update メソッド（または `gh issue edit {N} --body "..."` / GitHub API `PATCH /repos/{owner}/{repo}/issues/{number}`）
- **永続マーカーの維持**: 本文冒頭の `<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec schema=1.0 -->` を**絶対に破壊しない**。本文を更新する際は以下の手順に従う:
  1. 既存本文を取得
  2. 冒頭行がマーカー形式に一致するか検証（正規表現 `^<!-- einja:epic-id=EPIC-\d+ issue-slug=([a-z0-9-]+|null) kind=issue-spec schema=1\.0 -->$`）
  3. マーカーが欠落している場合は先頭に再挿入（`docs/einja/templates/epic-specs/persistent-marker-spec.md` の「マーカー保持のルール」に従う）
  4. マーカー行はそのまま維持し、2行目以降を差し替え or 追記
  5. 更新後の本文が `issue-slug` / `epic-id` / `kind=issue-spec` / `schema=1.0` の4要素を保持していることを送信前に検証
- **ディレクトリパス決定ロジック**: Interactive と同様に `github-issue-number` と `epic-context` から導出する（`docs/specs/epics/{epic-slug}/issues/{issue-slug}/` を基準に配置）。

##### 1.2 `issue-base-branch`（Issue ブランチの作成元）

- `issue/{N}` ブランチの作成元として使用。Epic 配下では通常 `epic/{slug}` が指定される。
- **ユーザー選択（AskUserQuestion）は行わない**。受領した値をそのまま使用する。
- リモートへの反映は `mcp__github__create_branch` を使用（`from_branch = issue-base-branch`）。**存在確認 → 未存在時のみ作成**で冪等化する。
- worktree 作成は行わない（親 Epic worktree 内で作業、「対話ポイント分岐表」#2 参照）。

##### 1.3 `pr-base-branch`（Issue Spec PR の base）

- Issue Spec PR 作成時の `base` パラメータに使用。通常 `epic/{slug}`。
- Issue Spec PR の head は作業中の `issue/{N}` ブランチ。
- **Epic 側からは PR を作成しない**（PR 作成責務は本 Skill に一元化、「2. Issue Spec PR の create-or-update」参照）。

##### 1.4 `milestone`（任意、GitHub Milestone 名）

- 受領した場合、以下に対して **Milestone を自動設定**する:
  - 対象 GitHub Issue（`mcp__github__issue_write` または `gh issue edit {N} --milestone "{name}"`）
  - Issue Spec PR（`gh pr edit {pr-number} --milestone "{name}"` または GitHub API `PATCH /repos/{owner}/{repo}/issues/{pr-number}`）
- **Milestone の新規作成は行わない**（Epic 側責務）。受領した Milestone 名が GitHub 上に存在しない場合は `error.retryable=false` / `code=milestone-not-found` の `operationLog` エントリを記録し PENDING_QUESTIONS で停止する。
- `milestone` が `null` または行省略の場合は、設定処理自体をスキップ（Issue/PR の既存 Milestone を変更しない）。

##### 1.5 `epic-tracker-issue`（任意、Epic Tracker Issue 番号）

- 受領した場合、Issue 本文に **Tracker Issue へのリンク**を付与する（下記「6. Tracker Issue / Milestone へのリンク埋込」参照）。
- **Tracker Issue 側の更新**（子 Issue 完了通知、チェックリスト同期等）は本 Skill では実施しない（Epic 側責務）。
- `epic-tracker-issue` が `null` または行省略の場合は、Related セクションに Tracker リンクを含めない。

#### 2. Issue Spec PR の create-or-update（一元責務）

**責務境界**: Issue Spec PR（`issue/{N}` → `pr-base-branch`）の作成・更新は **Headless IssueSpec 側が一元担当**。Epic 側は Epic PR のみ扱う。

##### 2.1 検索方式（冪等再利用）

以下の順序で既存 PR を検索し、存在すれば update、無ければ create する。永続マーカー仕様（`docs/einja/templates/epic-specs/persistent-marker-spec.md` の「再照合手順」）に準拠。

1. **operationLog 由来の再照合**
   - `resume-state.json` の `operationLog[]` から `idempotencyKey = "{epicId}:{issueSlug}:issue-spec-pr"` かつ `status=success` のエントリを検索（複数ある場合は `updatedAt` 最大）
   - 該当エントリがあれば `remoteId`（PR 番号）を取得し、`gh pr view {remoteId} --json number,body,state,headRefName,baseRefName,url` で GET
   - GET 成功 + 永続マーカー（`kind=issue-spec-pr`）完全一致 → **update 確定**
   - GET 404 or マーカー不一致 → 次ステップへフォールバック（operationLog を後で補正）

2. **GitHub Search API によるフォールバック検索**
   - クエリ例:
     ```
     gh pr list \
       --search '"einja:epic-id={epicId}" "issue-slug={issueSlug}" "kind=issue-spec-pr" in:body' \
       --state all \
       --json number,body,url,state,headRefName,baseRefName
     ```
   - または GitHub Search API: `q=repo:{owner}/{repo} "einja:epic-id={epicId}" "kind=issue-spec-pr" in:body type:pr`
   - ヒットした各 PR 本文から永続マーカーの**完全一致**を再確認（部分一致のみで判定しない）
   - 発見 → `operationLog` エントリを補正（`remoteId` を発見した PR 番号に更新、`updatedAt` を現在時刻に更新）→ **update 確定**

3. **いずれも見つからない → create 確定**

##### 2.2 PR 本文の永続マーカー

PR 本文の**冒頭**（最初の行、または空行を挟んで2行目まで）に以下を必須で配置:

```
<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec-pr schema=1.0 -->
```

- `epicId` は manifest から、`issueSlug` は `scope.md` frontmatter から取得
- update 時は PR 本文冒頭のマーカー行を**絶対に破壊しない**（Issue 本文と同じ保持ルールを適用）

##### 2.3 PR create の具体操作

```bash
gh pr create \
  --base "{pr-base-branch}" \
  --head "issue/{github-issue-number}" \
  --title "docs: {機能名} 仕様書" \
  --draft \
  --body "$(cat <<'EOF'
<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec-pr schema=1.0 -->

## Summary
Issue #{github-issue-number} の仕様書を作成しました。

## Related
- Epic: epic/{epic-slug}
- Epic Tracker: #{epic-tracker-issue}  （指定時のみ）
- Milestone: {milestone}  （指定時のみ）

## 成果物
- requirements.md
- design.md
- qa-test.md
- ui-design.pen  （UI要件ありの場合のみ）
EOF
)"
```

- **必ず `--draft` 指定**で作成（Ready for review 遷移はユーザー判断、本 Skill では実施しない）
- 作成後、返却された PR 番号を `operationLog` に記録（`operationType=pr-create`）

##### 2.4 PR update の具体操作

```bash
gh pr edit {pr-number} --body "$(cat <<'EOF'
<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec-pr schema=1.0 -->

{更新後の本文}
EOF
)"
```

- または GitHub API `PATCH /repos/{owner}/{repo}/pulls/{number}` の `body` フィールドを更新
- update 時は PR 本文の永続マーカー行を**絶対に破壊しない**（`2.2` 参照）
- 更新後、`operationType=pr-update` の新規エントリを `operationLog` に追記（既存エントリは破棄しない）

##### 2.5 Draft vs Ready

- Issue Spec PR は **必ず Draft で作成**（Interactive と同じ挙動）
- Ready for review への遷移は本 Skill 対象外（ユーザー判断 or Epic 側ワークフロー）
- Epic PR（`epic/{slug}` → IssueBranchBase）は本 Skill の対象外（Epic 側責務）

#### 3. operationLog への記録

外部リソース操作（Issue 更新 / PR 作成・更新 / Milestone 設定）ごとに `resume-state.json` の `operationLog[]` に追記する。スキーマは `docs/einja/templates/epic-specs/schemas/operation-log-entry.schema.json` 準拠。

##### 3.1 冪等キー

| 操作 | `operationType` | `idempotencyKey` |
|------|----------------|------------------|
| Issue 本文更新 | `issue-update` | `{epicId}:{issueSlug}:issue-spec` |
| PR 作成 | `pr-create` | `{epicId}:{issueSlug}:issue-spec-pr` |
| PR 更新 | `pr-update` | `{epicId}:{issueSlug}:issue-spec-pr` |

- 同じ `idempotencyKey` で複数の `operationType` エントリが共存可能（`pr-create` 成功後に `pr-update` が追記される等）
- 再照合時は **最新の success エントリ**（`updatedAt` 最大）を参照する

##### 3.2 エントリフォーマット

```json
{
  "operationType": "pr-create",
  "idempotencyKey": "EPIC-1:profile-view-edit:issue-spec-pr",
  "remoteId": 234,
  "persistentMarker": "<!-- einja:epic-id=EPIC-1 issue-slug=profile-view-edit kind=issue-spec-pr schema=1.0 -->",
  "status": "success",
  "createdAt": "2026-04-19T10:00:00Z",
  "updatedAt": "2026-04-19T10:00:00Z",
  "error": null
}
```

- `error` は `status=success` 時は `null`
- `status=failed` 時は `{ "message": "...", "retryable": bool, "code": "..." }` を必須で記録
- `persistentMarker` は実際に本文に埋め込んだマーカー文字列と**完全一致**させる（永続マーカー schema 正規表現に合致すること）

##### 3.3 書き込みタイミング

- 外部 API 呼び出し**直後**にエントリを追記（失敗時も `status=failed` で記録）
- `resume-state.json` は git 管理対象なので、各操作後にファイルを保存し、次のコミットに含める
- 書き込み手順（atomic write / ファイルロック等）は Task 3-2（resume-state 書き込みロジック）の定義に従う

#### 4. エラーハンドリング

##### 4.1 retryable 判定基準

| エラー種別 | GitHub API / gh CLI の兆候 | `retryable` | `code` 例 |
|----------|--------------------------|------------|----------|
| rate-limit 到達 | HTTP 403 + `X-RateLimit-Remaining: 0` | `true` | `rate-limit-exceeded` |
| 一時的ネットワークエラー | タイムアウト、5xx | `true` | `network-timeout`, `server-error` |
| 権限不足 | HTTP 403 (non-rate-limit), 401 | `false` | `permission-denied` |
| 永続マーカー不整合 | 本文冒頭がマーカー形式と不一致 | `false` | `marker-mismatch` |
| PR base ブランチ不存在 | 422 validation error | `false` | `base-branch-missing` |
| Milestone 名不存在 | 422 validation error | `false` | `milestone-not-found` |
| Issue 番号不存在 | 404 | `false` | `issue-not-found` |
| 400系バリデーション失敗 | 422 | `false` | `validation-failed` |

##### 4.2 リトライ戦略

- `retryable=true` → **最大2回まで自動再試行**（指数バックオフ: 1秒 → 2秒 → 4秒）
  - 2回目の再試行も失敗した場合は PENDING_QUESTIONS に昇格
- `retryable=false` → **即座に PENDING_QUESTIONS に昇格**（再試行しない）
- `operationLog` の `status=failed` エントリは**スキップ禁止**。resume 時に必ず再評価する（`docs/einja/templates/epic-specs/persistent-marker-spec.md` の「再照合手順」に準拠）

##### 4.3 PENDING_QUESTIONS 昇格時の挙動

- `resume-state.json` の `status = "blocked"` に更新（Task 3-2 の定義に従う）
- 外部リソース失敗の質問を **`question-broker.json` の `.questions[]`** に登録する（以下の情報を含む `question` エントリとして追加）:
  - `type: "validator-failure"` （外部リソース失敗の場合）
  - `sourceSkill: "einja-issue-spec-create"`
  - `question` 本文: `operationType`（`pr-create` / `pr-update` / `issue-update` 等）/ `idempotencyKey` / `error.message` / `error.code` / `error.retryable` / ユーザー判断要請内容（例: 手動対処 or 設定見直しが必要）を含める
  - `status: "open"`、`answer: null`
- `resume-state.json` の `pendingQuestions[]` には、上記で登録した質問の **questionId 文字列** のみを追加する（`"Q-{12文字hex}"` 形式）。質問詳細は `question-broker.json` の `.questions[]` に保持する
- Skill 実行を即座に停止し、親（`einja-epic-spec-create`）に返却する

#### 5. コマンド例（実行リファレンス）

##### 5.1 既存 Issue 確認

```bash
gh issue view {github-issue-number} --json body,url,number,title,milestone,state
```

##### 5.2 既存 PR の永続マーカー検索

```bash
gh pr list \
  --search '"einja:epic-id={epicId}" "issue-slug={issueSlug}" "kind=issue-spec-pr" in:body' \
  --state all \
  --json number,body,url,state,headRefName,baseRefName
```

ヒット結果から、本文冒頭のマーカー完全一致を再確認してから reuse 判定する。

##### 5.3 operationLog への追記（jq 例）

```bash
jq --arg op "pr-create" \
   --arg key "{epicId}:{issueSlug}:issue-spec-pr" \
   --argjson id {pr-number} \
   --arg marker "<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec-pr schema=1.0 -->" \
   --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.operationLog += [{
     operationType: $op,
     idempotencyKey: $key,
     remoteId: $id,
     persistentMarker: $marker,
     status: "success",
     createdAt: $ts,
     updatedAt: $ts,
     error: null
   }] | .updatedAt = $ts' \
   "{resume-state-path}" > "{resume-state-path}.tmp" \
   && mv "{resume-state-path}.tmp" "{resume-state-path}"
```

実際の書き込み手順（atomic write / ロック等）は Task 3-2 の定義に従う。

#### 6. Tracker Issue / Milestone へのリンク埋込（Issue 本文）

Issue 本文更新時、受領した `epic-tracker-issue` / `milestone` を **Related セクション**として付与する（冪等: 既存 Related セクションがあれば上書き、なければ追加）。

##### 6.1 Related セクションの生成ルール

```markdown
<!-- einja:epic-id={epicId} issue-slug={issueSlug} kind=issue-spec schema=1.0 -->

## Epic コンテキスト
- Epic: {epic-slug}
- Epic requirements: docs/specs/epics/{epic-slug}/requirements.md
- Epic design: docs/specs/epics/{epic-slug}/design.md

## Related
- Epic Tracker: #{epic-tracker-issue}  （`epic-tracker-issue` 指定時のみ）
- Milestone: {milestone-name}  （`milestone` 指定時のみ）

## タスク一覧
{tasks-generator で生成したタスク一覧}
```

##### 6.2 冪等更新のルール

- **既存 Related セクションがある場合**: セクション全体を新しい内容で置換（`## Related` 〜 次の `## ` 見出しまで）
- **既存 Related セクションがない場合**: `## Epic コンテキスト` の直後に新規挿入
- `epic-tracker-issue` / `milestone` の**どちらも null または省略**の場合は Related セクション自体を出力しない（既存があれば削除）
- 本文冒頭のマーカー行は保持（`1.1` と同じ保持ルール）

#### 7. 入力契約と既存分岐表の対応関係

本ブロックで詳細化した処理と、Task 3-1 で定義した「対話ポイント分岐表」の対応:

| 分岐表 # | 対応する本ブロックの項目 |
|---------|--------------------------|
| #2 | 1.2 `issue-base-branch` |
| #5 | 1.1 `github-issue-number` の Issue 本文更新 |
| #11 | 2. Issue Spec PR の create-or-update |
| #12 | 1.1 `github-issue-number` + 6. Tracker / Milestone リンク埋込 |

Task 3-2（resume-state 冪等再開）・Task 3-3（PENDING_QUESTIONS 返却プロトコル）で定義される挙動と組み合わせて使用する。

<!-- HEADLESS_EXTERNAL_INPUTS_END -->

<!-- @einja:project-private:start id="issue-spec-create-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
