# Plan: issue-exec系 PR重複問題の修正

## Context

下流リポジトリ（eenchow-bot #212）でissue-exec実行時に、同一タスクブランチ（`task/212-1.3`, `task/212-1.8`）に対してWorkerとManagerの両方がPRを作成し、重複PR（#223 vs #224, #225 vs #226）が発生した。

根本原因は3つの構造的欠陥:
1. `einja-task-exec`にPR作成ステップが欠落（protocolでは「Workerが作る」と定義されているのに実装がない）
2. `einja-create-pr`に重複チェックがない（冪等でない）
3. `einja-issue-team-exec`のPhase PR作成に`gh pr create`直接呼び出しと`einja-create-pr`経由の2方式が混在

## 現状

### PR作成責務の定義（`issue-exec-protocol.md` セクション6）

| PR種別 | 作成者（定義上） |
|--------|---------------|
| タスクPR (`task/` → `issue/-phase`) | Worker(einja-task-exec) / Teammate |
| Phase PR (`issue/-phase` → `issue/`) | Manager / Lead |
| 最終PR (`issue/` → base) | Manager / Lead |

### 実装の乖離

- **`einja-task-exec`**: Step 7はコミット・プッシュ（`einja-task-commit`）のみ。PR作成なし。Step 8冒頭に「PR作成完了を確認した後」と書かれているが、誰がいつ作るか未定義
- **`director-prompt.md`**（Agent Teams版）: Step 7に「einja-create-pr Skill で PR 作成」が明記 → こちらは正しく動作しており変更不要
- **`einja-create-pr`**: `gh pr create`前の既存PRチェックなし。エラーハンドリングに「既存PR」ケースなし。`--head`パラメータ未対応
- **`einja-issue-team-exec`**: Step 6は`gh pr create`直接、Step 7は`einja-create-pr`経由（同じPhase PRに2方式混在）

### `gh pr create` 直接呼び出し箇所（修正対象）

`.claude/skills/` 配下で `gh pr create` を直接呼んでいる箇所:
- `einja-create-pr/SKILL.md` Step 5 — **ここが唯一の正当な呼び出し箇所**（変更不要）
- `einja-issue-team-exec/SKILL.md` L396〜399 — **Change 3 で修正対象**

## 変更内容

### Change 1: `einja-create-pr`を冪等化（最優先）

**ファイル**: `.claude/skills/einja-create-pr/SKILL.md`

#### 1a. `--head`パラメータ追加（L31付近）

ARGUMENTSに`--head <branch>`を追加。未指定時は現在ブランチを使用（現行動作を維持）。

```
$ARGUMENTS: [--auto] [--base <branch>] [--head <branch>] [--title <title>]
```

#### 1b. Step 1 を「引数解析・BASE/HEAD決定 + 既存PR重複チェック」に再構成（L40付近）

現行Step 1（差分分析）の冒頭でBASEを決定しているが、重複チェックにはBASEとHEAD両方が必要。
Step 1の先頭に「BASE/HEAD決定 → 重複チェック」を挿入する。既存のStep番号は変更せず、Step 1の中に組み込む。

```markdown
### Step 1: 引数解析・重複チェック・差分分析

#### Step 1a: BASE/HEAD決定

```bash
# ベースブランチの決定
BASE=$(git rev-parse --abbrev-ref HEAD@{upstream} 2>/dev/null | sed 's|origin/||' || echo "main")
# --base指定があればそちらを優先

# ヘッドブランチの決定
HEAD_BRANCH="${HEAD:-$(git rev-parse --abbrev-ref HEAD)}"
```

#### Step 1b: 既存PR重複チェック

```bash
EXISTING_PR=$(gh pr list --head "$HEAD_BRANCH" --base "$BASE" --state open --json number,url --jq '.[0]')
if [ -n "$EXISTING_PR" ]; then
  PR_NUMBER=$(echo "$EXISTING_PR" | jq -r '.number')
  PR_URL=$(echo "$EXISTING_PR" | jq -r '.url')
  # 既存PRを成功として返却。Step 2〜6をすべてスキップ
  # 出力形式: 通常のPR作成成功時と同じ（PR URL、PR番号）
  # ログに「[既存PR検出] PR #${PR_NUMBER} が既に存在するため作成をスキップ」を出力
  exit 0
fi
```

- `--head` + `--base` 両方でexact match（同一headでbase違いの誤検知を防止）
- 既存OPENあり → changeset生成もスキップして即座にPR情報を返却
- closed/merged PRは検出対象外（新規PR作成を許可）

#### Step 1c: 差分分析（既存の差分分析ロジックをそのまま維持）
```

#### 1c. Step 5 の `gh pr create` に `--head` を明示的に渡す（L118付近）

```bash
gh pr create \
  --base "${BASE}" \
  --head "${HEAD_BRANCH}" \
  --title "${TITLE}" \
  --body "..." \
  --label "${LABEL}"
```

#### 1d. Step 5 に `gh pr create` 失敗時のリカバリ追加

レースコンディション対策: 2プロセスが同時に重複チェック通過後に `gh pr create` を呼ぶ場合に備え、既存PRエラー（HTTP 422）発生時に再度 `gh pr list` して既存PRを返却する。

```markdown
`gh pr create` が既存PRエラー（"A pull request already exists"）で失敗した場合:
1. `gh pr list --head "$HEAD_BRANCH" --base "$BASE" --state open` で再検索
2. 既存PRが見つかれば、そのPR情報を成功として返却（冪等）
3. 見つからなければエラーとして報告
```

#### 1e. エラーハンドリングテーブルに行追加（L154付近）

| 同一ブランチペアのOPEN PRが既に存在 | PR作成をスキップ、既存PR情報を返却（冪等） |
| `gh pr create` 既存PRエラー（422） | 再検索して既存PR情報を返却（レースコンディション対策） |

#### 1f. 出力セクションに既存PR検出時の形式を追記（L156付近）

```markdown
## 出力

PR作成後（または既存PR検出時）、以下を出力:
- PR URL
- PR番号
- 付与したラベル（新規作成時のみ）
- changeset情報（生成した場合のみ）
- CI確認結果（実行した場合のみ）
- `[既存PR検出]` ラベル（既存PR返却時のみ）
```

### Change 2: `einja-task-exec`にPR作成ステップ追加（tmux版のみ）

**ファイル**: `.claude/skills/einja-task-exec/SKILL.md`

> **適用範囲**: このChangeはtmux版（einja-issue-exec経由）のWorkerにのみ適用される。Agent Teams版（einja-issue-team-exec経由）では`director-prompt.md` Step 7で既にPR作成が明記されており、変更不要。

#### 2a. フロー図に Step 7.5 追加（L73〜74の間）

```
│  │ Step 7: einja-task-commit Skill              │            │
│  │ （コミット・プッシュ）                        │            │
│  └─────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────┐            │
│  │ Step 7.5: einja-create-pr Skill              │            │
│  │ （PR作成・issue-exec経由時のみ）              │            │
│  └─────────────────────────────────────────────┘            │
```

#### 2b. Step 7.5 本文をStep 7とStep 8の間に挿入（L445〜446の間）

```markdown
### Step 7.5: PR作成（issue-exec経由時のみ）

issue-exec経由で実行されている場合（`~/.einja/sessions/issue-{N}/` が存在する場合）、コミット・プッシュ完了後にタスクグループPRを作成する。

> **注意**: この判定条件はStep 8と同一。セッションパスの存在判定はeinja-task-execの既存方式に合わせている。

1. **PR作成**: `einja-create-pr` Skillを呼び出し
   - `--auto` フラグ付与（確認なしで自動実行）
   - `--base issue/{N}-phase{M}` を指定（Phase ブランチ宛て）
   - `--head task/{N}-{X.Y}` を指定（現在のブランチ）
2. **prNumber の記録**: 作成/検出されたPR番号をステータスファイル `task-{X.Y}.json` の `prNumber` フィールドに書き込む
3. **status更新**: ステータスファイルの `status` を `awaiting_review` に更新
4. **シグナルファイル作成**（最後に実行）: `touch ~/.einja/sessions/issue-{N}/signals/worker-{X.Y}.signal`

> **順序の重要性**: prNumber書き込み → status更新 → シグナルファイル作成の順序を厳守。シグナルファイルはManagerの起床トリガーであり、Managerがステータスを読む前にデータが揃っている必要がある。

スタンドアロン実行の場合（セッションパスなし）はこのステップをスキップする。
Phase 99 タスクもスキップする（ドキュメント反映のみでPR不要）。
```

#### 2c. Step 8 冒頭の修正（L447〜451）

Step 7.5にprNumber記録・status更新・シグナルファイル作成を移動したため、Step 8はループのみに簡素化:

```markdown
### Step 8: Director承認待ちループ（issue-exec経由時のみ）

issue-exec経由で実行されている場合（セッションパスが存在する場合）、Step 7.5でPR作成・ステータス更新済みであることを前提に、以下のループでDirectorの判定を待機する:
```

### Change 3: `einja-issue-team-exec` Phase PR作成を統一

**ファイル**: `.claude/skills/einja-issue-team-exec/SKILL.md`

#### 3a. Step 6のPhase PR作成（L396〜399）

`gh pr create`直接呼び出しを`einja-create-pr` Skill経由に変更:

```markdown
# Phase PR 作成
einja-create-pr Skill で作成:
  --auto --base issue/${N}
  --head issue/${N}-phase{M}
```

> **changeset生成について**: Phase PRでは`einja-create-pr`のchangesetスキップ条件「`apps/` 配下に変更がない」に自然に該当するケースが多い。該当しない場合もchangesetが生成されるが、Phase PRでは無害（squash merge時に消える）。専用の `--pr-kind` パラメータ追加はオーバーエンジニアリングのため見送り。

#### 3b. Step 7のPhase PR作成（L434）

「未作成の場合」の条件付き記述はそのまま維持。Change 1の重複チェックにより、einja-create-prを呼んでも既存PRがあればスキップされるため安全。

### Change 4: `einja-issue-exec` Manager PR処理の明確化

**ファイル**: `.claude/skills/einja-issue-exec/SKILL.md`

Step 6 item 2（L377）の「マージモードに応じたPR処理」を明確化:

「ゲート通過後はマージモードに応じたPR処理」→「ゲート通過後はマージモードに応じたタスクPRマージ処理（タスクPRはWorker側のeinja-task-exec Step 7.5で作成済み。ManagerはタスクPRを自ら作成しない）」

### Change 5: `issue-exec-protocol.md` セクション6の明確化

**ファイル**: `docs/einja/instructions/issue-exec-protocol.md`

L171のタスクPR行を修正:

```
| タスクPR | `issue/{N}-phase{M}` | `task/{N}-{X.Y}` | Worker(einja-task-exec Step 7.5) / Director Teammate（Agent Teams版 director-prompt Step 7）。einja-create-pr Skill 経由で作成 |
```

## タスク概要

| # | タスク | 依存 | Skill/エージェント |
|---|--------|------|-------------------|
| 0-0 | TaskCreate一括登録 | - | TaskCreate |
| 0-1 | Planファイル配置（`docs/plans/202605/`） | - | Bash/Write |
| 1.1 | Change 1: einja-create-pr 冪等化（`--head`追加、重複チェック、レースコンディション対策、出力形式） | - | general-purpose subagent |
| 1.2 | Change 2: einja-task-exec Step 7.5 追加（tmux版のみ。フロー図、本文、Step 8修正） | 1.1（引数仕様参照） | general-purpose subagent |
| 1.3 | Change 3: einja-issue-team-exec Phase PR統一（Step 6修正） | 1.1（引数仕様参照） | general-purpose subagent |
| 1.4 | Change 4: einja-issue-exec 明確化（Step 6 item 2修正） | - | general-purpose subagent |
| 1.5 | Change 5: issue-exec-protocol 明確化（セクション6修正） | - | general-purpose subagent |
| 99-1 | 観点別並列コードレビュー | 1.1〜1.5 | einja-review-code |
| 99-G | コミット承認ゲート | 99-1 | AskUserQuestion |
| 99-3 | コミット・プッシュ | 99-G | einja-task-commit |

## 並列実行計画

- **1.1 を先に実行**（引数仕様・出力形式の確定が1.2, 1.3に影響）
- **1.1完了後、1.2〜1.5 を並列実行**（各Changeは異なるファイルを対象。1.2と1.3はPlan記載の引数仕様を参照）
- **1.4, 1.5 は1.1と並列実行可能**（einja-create-prの引数仕様に依存しない文言修正のみ）
- 99系は直列（99-1 → 99-G → 99-3）

## リスク・不明点

| リスク | 影響 | 対策 |
|--------|------|------|
| fix_required後のStep 7.5再実行 | 2回目のPR作成 | Change 1の重複チェックにより冪等。既存PRを返却 |
| Phase 99でStep 7.5が不要なのにPR作成される | 不要なPR | Step 7.5にPhase 99スキップ条件を明記 |
| `--head`パラメータ追加の後方互換性 | 既存呼び出し元への影響 | 未指定時は現在ブランチ使用（現行動作維持） |
| レースコンディション（2プロセス同時list→create） | 重複PR | `gh pr create`失敗時に再listして既存PR返却 |
| セッションディレクトリ残骸での誤判定 | スタンドアロン時にStep 7.5発火 | 既存のeinja-task-exec Step 8と同一判定方式を使用。堅牢化（環境変数方式等）は別Issue |
| Phase PRにchangesetが不要 | 不要なchangeset生成 | 既存スキップ条件で概ねカバー。`--pr-kind`追加は見送り |
| シグナルファイル作成の順序不整合 | Managerが空statusを読む | prNumber→status→signal の順序をStep 7.5に明記 |

## 検証・動作確認方法

1. **静的検証**: 各Skill間のPR作成責務フロー図を照合し、全経路で`einja-create-pr`経由であることを確認
2. **grep検証**: `.claude/skills/` 配下で`gh pr create`の直接呼び出しが残っていないことを確認（`einja-create-pr/SKILL.md`内のみ許可）
3. **ドキュメント整合性**: `issue-exec-protocol.md`セクション6のロール定義と各Skill実装の一致を確認
4. **プリセット自動コピー確認**: `.claude/skills/`配下の変更がビルド時に`presets/default/`へ自動コピーされることを確認（CLAUDE.mdの原本管理ルールに基づき手動コピー不要）
5. **下流リポジトリでの実地テスト**: 次回issue-exec実行時に重複PRが発生しないことを確認（本PR後に実施）
