---
name: einja-epic-spec-create
description: >-
  Epic（複数Issueを束ねる大規模機能）仕様書を作成し、Epic契約ファイル（epic-manifest.json / scope.md）を
  検証してから各Issue仕様書をHeadless展開するオーケストレーターSkill。
  Epic overview/requirements/design/ui-design.pen/screen-transitions.drawio 生成、
  GitHub Milestone/Tracker Issue作成、各Issue Spec PRのHeadless展開、
  PENDING_QUESTIONS集約と resume管理まで統合実施。
  「Epic仕様」「epic-spec-create」「プロダクト仕様」「複数Issue仕様」「大規模Issue」で呼び出す。
  Do NOT use for: 単一Issueの仕様書作成（einja-issue-spec-createを使う）、
  Epic実行フェーズ（将来の einja-epic-exec 別Plan、本Skill対象外）
user-invocable: true
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
  - mcp__drawio__open_drawio_mermaid
  - mcp__drawio__open_drawio_xml
  - mcp__drawio__open_drawio_csv
---

# einja-epic-spec-create Skill: Epic仕様書作成オーケストレーター

あなたはEpic（複数Issueを束ねる大規模機能 / プロダクト級開発）の仕様書作成を統括するシニアマネージャー兼オーケストレーターです。Epic全体の要件・設計・UI/画面遷移・Issue分割を作成し、各Issueの詳細仕様書生成を `einja-issue-spec-create` に Headless mode で委任します。

## 1. Skill概要

本Skill は以下3つを統合して実行する **オーケストレーター** です。

1. **Epic契約ファイル生成**: `epic-planner` サブエージェントで `epic-overview.md` / `epic-manifest.json` / 各Issue `scope.md`（+ UI要件ありなら `ui-design.pen` / `screen-transitions.drawio`）を生成
2. **構造検証とLLMレビュー**: `_einja-epic-contract-validator`（決定論）と `einja-review-spec`（LLM判断）の2段で検証
3. **各Issue Spec Headless展開**: `einja-issue-spec-create` を `<<MODE: HEADLESS>>` で呼び出し、Issue Spec PR の create-or-update まで一元化

**Epic実行フェーズ（`einja-epic-exec` 相当）は本Skillの対象外**。manifestスキーマは将来の実行フェーズが消費することを前提に設計されている。

## 2. スコープ

### 対応

- Epic契約ファイル生成（`epic-overview.md` / `epic-manifest.json` / 各 `scope.md`）
- Epic全体成果物（`requirements.md` / `design.md` / UI要件ありなら `ui-design.pen` / `screen-transitions.drawio`）
- GitHub Milestone / Epic Tracker Issue の create-or-update（永続マーカーで冪等化）
- 各Issueの GitHub Issue 作成、ブランチ作成
- 各Issue Spec の Headless 展開（`einja-issue-spec-create`）
- PENDING_QUESTIONS の集約（Markdown → broker JSON 正規化）と resume 管理
- Epic PR の Draft 先行作成（子Issue Spec PR 全マージ後 Ready 化は対象外）

### 非対応

- Epic実行フェーズ（タスク分解後の実装）: 将来の `einja-epic-exec` 相当（別Plan）
- 単一Issueの仕様書作成: `einja-issue-spec-create` を直接使う
- コード差分レビュー: `einja-review-code` を使う
- Planレビュー: `einja-review-plan` を使う
- Epic PR の Ready for review 遷移: ユーザー判断 or 将来の `einja-epic-exec`

## 3. 実行オプション（CLI風引数）

プロンプト冒頭の `## Options` セクションで受領する。オプションは任意（未指定時はデフォルト挙動）。

| オプション | 説明 | デフォルト |
|-----------|------|----------|
| `--max-issues N` | 今回の実行で最大 N 個の Issue のみ Headless 展開する | 全件 |
| `--issue-slugs a,b,c` | 指定した slug の Issue のみ展開（カンマ区切り） | 全件 |
| `--resume-from {issue-slug}` | 指定 Issue から再開（依存DAG順で前の Issue は完了済み前提） | 先頭から |
| `--stop-after-contract` | Step 1（契約ファイル生成＋承認ゲート1）完了後に停止 | 継続 |
| `--stop-after-epic-artifacts` | Step 2（Epic全体成果物＋承認ゲート2）完了後に停止 | 継続 |
| `--stop-after-issue-spec` | 各Issue Spec PR 1件作成ごとに一時停止（ユーザー再開指示で続行） | 継続 |

### 入力フォーマット例

```markdown
新機能X の仕様を作成してください。

## Options
- --max-issues 3
- --stop-after-epic-artifacts
```

### オプションパース

1. `## Options` セクションを Grep で抽出
2. 各行 `- --{name} {value}` を正規表現で分解して内部状態に保持
3. 不正値は AskUserQuestion で確認（例: `--max-issues` に非数値が指定された場合）

## 4. 処理フロー

### Step 0: 前提確認

#### 0.1 IssueBranchBase 選択（Epic親の作成元ブランチ）

```yaml
AskUserQuestion:
  question: "Epicブランチ（epic/{slug}）の作成元（IssueBranchBase）を選択してください"
  header: "Epic IssueBranchBase 選択"
  options:
    - label: "デフォルトブランチ（推奨）"
      description: "gitのデフォルトブランチ（通常 main / develop）を使用。Note: 多くの場合はこれでOK。Epic PR も同じブランチへマージ対象となる"
    - label: "main"
      description: "mainブランチを Epic IssueBranchBase として使用。Note: developフローを使う場合は develop が適切"
    - label: "develop"
      description: "developブランチを使用。Note: GitFlow系の運用で develop が存在する場合に選択"
    - label: "その他（自由入力）"
      description: "release/2026-04 等、任意のブランチ名を直接入力。Note: そのブランチから Epic を切り出したい場合のみ"
```

選択結果を manifest の `baseBranch` に設定する。

#### 0.2 依存MCP / プラグイン確認

以下の利用可否を `ToolSearch` または環境確認で判定し、見つからない必須MCPがあれば PENDING_QUESTIONS ではなく `AskUserQuestion` でユーザーに報告する（オーケストレーターは AskUserQuestion 使用可）。

| MCP / Skill | 必須 / 任意 | 用途 |
|------------|-----------|------|
| `mcp__github__*` | 必須 | Issue / PR / Milestone の操作 |
| `mcp__pencil__*` | hasUI=true 時必須 | Epic ui-design.pen 生成 |
| `mcp__drawio__*` | hasUI=true 時必須 | screen-transitions.drawio 生成 |
| `einja-issue-spec-create` | 必須 | 各Issue Spec の Headless 展開 |
| `_einja-epic-contract-validator` | 必須 | Epic契約ファイルの構造検証 |
| `einja-review-spec` | 必須 | LLMレビュー（承認ゲート） |
| `einja-task-commit` | 必須 | コミット・プッシュ |
| `context7` / `serena` | 任意 | 外部ライブラリ / コード索引参照 |

#### 0.3 外部リソース確認

ユーザー指示に含まれる外部リソースを収集する。

- Asana URL（`mcp__claude_ai_Asana__*` が有効なら取得）
- Figma URL（将来的に参照可能になる想定。現時点では URL のみを保持）
- PRD ファイルパス（リポジトリ内 or ユーザー添付）
- 既存 `docs/specs/` 配下の類似Epic / Issue 仕様（`Grep` / `Glob` で検索）

取得結果は `epic-planner` への入力コンテキストに渡す。

#### 0.4 Epic メタ宣言

以下を決定してから Step 1 に進む。

1. **Epic スラッグ**: ユーザー指示から kebab-case で導出。例: 「ユーザープロフィール設定」 → `user-profile-settings`
   - 重複確認: `ls docs/specs/epics/` で既存ディレクトリをチェック
2. **Epic ID**: 既存 `docs/specs/epics/*/epic-manifest.json` を走査し、最大の `epicId` +1 を採番（例: 既存が `EPIC-3` なら `EPIC-4`）
3. **Epic タイトル**: 日本語の人間可読名
4. **hasUI 判定**: UI画面を含むEpicかを判定（PRD / ユーザー指示から推論、曖昧なら AskUserQuestion）
5. **想定 Issue 規模**: 2〜20 Issue 程度を想定。これを超える大規模Epicは分割を検討（AskUserQuestion）

#### 0.5 Epic 作業ブランチ作成

**worktree は作成しない**（Step 1 以降の Headless 展開時、Issue Spec 側も本Skillのworktree内で作業するため）。ブランチのみ作成する。

```bash
BASE_BRANCH="{0.1で決定した値}"
EPIC_BRANCH="epic/{epic-slug}"

git fetch origin
if git show-ref --verify --quiet "refs/heads/$EPIC_BRANCH"; then
  git checkout "$EPIC_BRANCH"
  git ls-remote --exit-code origin "$EPIC_BRANCH" &>/dev/null && git pull origin "$EPIC_BRANCH" --rebase
else
  git checkout -b "$EPIC_BRANCH" "origin/$BASE_BRANCH"
fi

# リモートへ反映（push は Step 1 の最初のコミット時に実施）
```

Epic ディレクトリを作成:

```bash
mkdir -p "docs/specs/epics/{epic-slug}/issues"
```

---

### Step 1: Epic概要 + Issue分割契約

#### 1.1 `epic-planner` サブエージェント起動

Agent tool で `subagent_type: epic-planner` を起動する（`mode` パラメータは指定しない = 親権限継承）。

プロンプトに渡す情報:

```markdown
## Epic仕様書作成タスク

### 入力
- Epicディレクトリパス: docs/specs/epics/{epic-slug}/
- epic-slug: {epic-slug}
- epicId: EPIC-{N}
- Epicタイトル: {title}
- hasUI: {true|false}
- baseBranch: {baseBranch}
- ユーザー指示本文: {ユーザー指示 全文}

### 外部リソース
- Asana: {URL or 取得済みタスク情報}
- Figma: {URL}
- PRD: {パス or 本文}
- 既存仕様（参考）: {Grep 結果のパス一覧}

### 出力契約
以下を生成してください（詳細は `.claude/agents/einja/epic-specs/epic-planner.md` に準拠）:
- docs/specs/epics/{epic-slug}/epic-overview.md
- docs/specs/epics/{epic-slug}/epic-manifest.json
- docs/specs/epics/{epic-slug}/issues/{各issue-slug}/scope.md
- hasUI=true の場合:
  - docs/specs/epics/{epic-slug}/ui-design.pen
  - docs/specs/epics/{epic-slug}/screen-transitions.drawio

### 質問プロトコル
不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照して PENDING_QUESTIONS 形式で質問を返却し、作業を停止すること。
```

返却が PENDING_QUESTIONS の場合は §5「質問ブローカー」に従って処理する。

#### 1.2 構造検証（`_einja-epic-contract-validator`）

Skill tool で `_einja-epic-contract-validator` を呼び出し、Epic ディレクトリを検証する。

```
Skill: _einja-epic-contract-validator
args: |
  Epicディレクトリ docs/specs/epics/{epic-slug}/ を対象に、
  epic-manifest.json と全 scope.md（+ resume-state / question-broker が存在すれば）を検証してください。
```

| 判定 | 対応 |
|------|------|
| PASS | Step 1.3 へ進行 |
| WARNING | WARNING 内容をユーザー報告用に記録し Step 1.3 へ進行 |
| FAILURE | `epic-planner` に修正指示を返して再生成（最大2回）。3回目もFAILUREなら §9「停止条件」に従い PENDING_QUESTIONS 昇格 |

再生成時は、**Agent tool の新規呼び出し**で `epic-planner` に修正指示を渡す（`resume` パラメータは使わない）。プロンプトに「前回の manifest / scope」「validator の FAILURE 詳細」「修正要求」を含める。例:

```
## 修正依頼（_einja-epic-contract-validator FAILURE）

### 前回の成果物
- manifest: docs/specs/epics/{epic-slug}/epic-manifest.json
- scope: docs/specs/epics/{epic-slug}/issues/*/scope.md

### validator 指摘事項
{validator が返した FAILURE 詳細を全文引用}

### 修正要求
上記指摘事項をすべて解消して、epic-manifest.json と scope.md を再生成してください。
```

#### 1.3 LLMレビュー（`einja-review-spec`）

Skill tool で `einja-review-spec` を呼び出す。

```
Skill: einja-review-spec
args:
  review_scope: requirements  # Step 1 は「Epicの要件分割」に相当するため requirements スコープを流用
  対象成果物:
    - docs/specs/epics/{epic-slug}/epic-overview.md
    - docs/specs/epics/{epic-slug}/epic-manifest.json
    - docs/specs/epics/{epic-slug}/issues/*/scope.md
  残存リスク: {validator で WARNING が出た項目があれば併記}
```

| 判定 | 対応 |
|------|------|
| PASS | Step 1.4 へ進行 |
| MINOR | 可能な範囲で反映して Step 1.4 へ進行 |
| MAJOR | `epic-planner` に修正指示して再生成 → 再 validate → 再 review（最大2回）。3回目もMAJORなら PENDING_QUESTIONS 昇格 |

#### 1.4 承認ゲート 1（ユーザー承認 → コミット・プッシュ）

ユーザーに成果物の概要を提示し、AskUserQuestion で承認を得る。

```yaml
AskUserQuestion:
  question: |
    Epic契約ファイルを生成しました。内容を確認してください。

    【成果物】
    - docs/specs/epics/{epic-slug}/epic-overview.md（概要・Storyマップ・Feature Map）
    - docs/specs/epics/{epic-slug}/epic-manifest.json（Issue分割契約、{N} Issue, {M} AC）
    - docs/specs/epics/{epic-slug}/issues/*/scope.md（各Issue契約）
    {UIあり時のみ}
    - docs/specs/epics/{epic-slug}/ui-design.pen（Overview粒度）
    - docs/specs/epics/{epic-slug}/screen-transitions.drawio（画面遷移）

    【検証結果】
    - 構造検証（_einja-epic-contract-validator）: {PASS/WARNING}
    - LLMレビュー（einja-review-spec）: {PASS/MINOR}
    {WARNINGやMINOR項目の要約}
  header: "Step 1 承認"
  options:
    - label: "承認してコミット・プッシュ"
      description: "現在の内容でコミット・プッシュし Step 2 へ進む。Note: 後続Stepで内容変更が必要になった場合は追加コミットで対応"
    - label: "修正指示あり"
      description: "内容を修正してから進む。Note: 修正内容を伝えると epic-planner に差し戻して再生成"
    - label: "その他（自由入力）"
      description: "停止したい / 違う粒度にしたい等、個別の指示があればここで伝える"
```

承認後は `einja-task-commit` Skill を呼び出す。

```
Skill: einja-task-commit
args: planFile=docs/plans/{Planファイルパス}
```

コミットメッセージは `einja-task-commit` が `docs/einja/steering/commit-rules.md` に従って自動決定するが、Step 1 の標準形は `docs: {Epicタイトル} の契約ファイル（overview / manifest / scope）を追加` を想定。

`--stop-after-contract` オプション指定時はここで停止する。

---

### Step 2: Epic全体成果物

#### 2.1 Epic requirements.md 生成

`epic-planner` は Step 1 で Overview / Feature Map / Issue分割を担当したが、Step 2 では Epic 全体の要件本文を別途生成する。

**アプローチ**: `epic-planner` を `resume` で再起動し、「epic-overview.md + epic-manifest.json を入力として、Epic requirements.md の詳細本文を生成する」タスクを指示する。

requirements.md の必須セクション:
- プロダクトビジョン / ゴール / KPI
- ペルソナ詳細
- Epic全体の In / Out Scope
- ユーザーストーリーマップ（Story詳細）
- Feature Map（Feature 詳細）
- Epic AC一覧（AC詳細含む）
- Issue分割対応表
- 非機能要件
- リスクと対策

#### 2.2 screen-transitions.drawio / ui-design.pen（hasUI=true のみ）

`hasUI=true` かつ Step 1 で未生成の場合は、`epic-planner` の Step 6 / Step 7 を再実行して生成する（Step 1 で生成済みなら2.3へスキップ）。

- `ui-design.pen`: Overview 粒度（全画面サムネ + 優先度High画面ワイヤー）。`mcp__pencil__*` 使用
- `screen-transitions.drawio`: 画面遷移図。`TR-*` ID を各エッジに埋込。`mcp__drawio__open_drawio_mermaid` 推奨

#### 2.3 Epic design.md 生成

`epic-planner` を再度 `resume` で起動し、Epic 粒度の技術設計書を生成する。

design.md の必須セクション:
- Overview
- C4 Level 1-2
- データモデル全体像（ER図 mermaid）
- API設計方針
- 外部サービス統合
- Issue間の技術的依存関係
- 横断的技術決定事項
- テスト戦略

#### 2.4 LLMレビュー（`einja-review-spec` phase2_bundle）

```
Skill: einja-review-spec
args:
  review_scope: phase2_bundle
  対象成果物:
    - docs/specs/epics/{epic-slug}/requirements.md
    - docs/specs/epics/{epic-slug}/design.md
    - docs/specs/epics/{epic-slug}/ui-design.pen （UI要件あり）
    - docs/specs/epics/{epic-slug}/screen-transitions.drawio （UI要件あり）
  残存リスク: {Step 1 で残った WARNING を引き継ぎ}
```

MAJOR → 自動再生成（最大2回）→ 解消しない場合 PENDING_QUESTIONS 昇格（§9）。

#### 2.5 承認ゲート 2（ユーザー承認 → コミット・プッシュ）

Step 1.4 と同形式で AskUserQuestion。承認後 `einja-task-commit` を呼び出す。

コミットメッセージ標準形: `docs: {Epicタイトル} の全体要件・設計・UI設計を追加`

`--stop-after-epic-artifacts` オプション指定時はここで停止する。

---

### Step 3: 各Issue仕様書のHeadless展開

#### 3.1 GitHub Milestone の create-or-update

永続マーカー `<!-- einja:epic-id={epicId} issue-slug=null kind=milestone schema=1.0 -->` で既存Milestoneを検索する。

**検索方式（Milestoneは Search API 対象外）**:

```bash
# REST List でページング取得（state=all 必須、per_page=100）
gh api --paginate "/repos/{owner}/{repo}/milestones?state=all&per_page=100" \
  | jq -r '.[] | select(.description | contains("einja:epic-id={epicId}")) | {id, number, title, description}'
```

- 一致あり → Milestone ID を manifest `milestoneId` に反映し reuse
- 一致なし → 新規作成:
  ```bash
  gh api -X POST "/repos/{owner}/{repo}/milestones" \
    -f title="{Epicタイトル}" \
    -f description="$(cat <<'EOF'
  <!-- einja:epic-id={epicId} issue-slug=null kind=milestone schema=1.0 -->
  Epic: {Epicタイトル}。関連 Issue は Epic Tracker #{trackerIssueNumber} を参照。
  EOF
  )"
  ```
- 作成/再利用の結果を `operationLog`（ここでは Epic 側の `docs/specs/epics/{epic-slug}/operation-log.json` または manifest の `milestoneId` に記録）へ反映

#### 3.2 Epic Tracker Issue の create-or-update

永続マーカー `<!-- einja:epic-id={epicId} issue-slug=null kind=tracker schema=1.0 -->` で既存 Tracker を検索。

**検索方式（Issue/PR は Search API 利用可）**:

```bash
gh issue list \
  --search '"einja:epic-id={epicId}" "kind=tracker" in:body' \
  --state all \
  --json number,body,url,state
```

- 一致あり → Tracker Issue 番号を manifest `trackerIssueNumber` に反映 / reuse。本文を最新の子Issueチェックリストに update
- 一致なし → 新規作成:
  ```bash
  gh issue create \
    --title "Epic: {Epicタイトル}" \
    --milestone "{Epicタイトル}" \
    --body "$(cat <<'EOF'
  <!-- einja:epic-id={epicId} issue-slug=null kind=tracker schema=1.0 -->

  # Epic: {Epicタイトル}

  - Epic ID: {epicId}
  - Epic overview: docs/specs/epics/{epic-slug}/epic-overview.md
  - Epic requirements: docs/specs/epics/{epic-slug}/requirements.md
  - Epic design: docs/specs/epics/{epic-slug}/design.md

  ## Issues
  - [ ] #{N1} {Issue-1 タイトル}
  - [ ] #{N2} {Issue-2 タイトル}
  ...
  EOF
  )"
  ```

Tracker Issue のチェックリスト本文は、各子Issueが作成されるたびに update で追記する（冪等化: 同じ `#{N}` が既にあれば重複追加しない）。

#### 3.3 Issue 展開ループ（依存DAG順・順次実行）

manifest の `issues[]` を **依存DAGで topological sort** し、順次 Headless 展開する。v1 は並列実行なし。

展開対象のフィルタリング:
- `--issue-slugs a,b,c` 指定 → 指定slugのみ
- `--resume-from {slug}` 指定 → そのslug以降（前のIssueは完了済み前提）
- `--max-issues N` 指定 → 先頭 N 件のみ

##### `--resume-from` 指定時の依存 Issue 完了確認

`--resume-from {slug}` を指定した場合、展開開始前に以下の手順で依存 Issue の完了状態を確認する。

1. 起点 Issue の `dependsOn` に列挙される全 Issue slug を `epic-manifest.json` から取得
2. 各 slug の `resume-state.json` を読み込み、`status === "completed"` を確認:

```bash
for SLUG in {dependsOn一覧}; do
  STATE_PATH="docs/specs/epics/{epic-slug}/issues/${SLUG}/resume-state.json"
  STATUS=$(jq -r '.status' "${STATE_PATH}" 2>/dev/null || echo "missing")
  if [ "$STATUS" != "completed" ]; then
    echo "INCOMPLETE: ${SLUG} (status=${STATUS})"
  fi
done
```

3. 未完了（`status !== "completed"` または `resume-state.json` が存在しない）の依存 Issue が 1 件でも存在する場合は、PENDING_QUESTIONS で停止する。例:

```markdown
## PENDING_QUESTIONS

### Q1: --resume-from の依存 Issue が未完了
**背景**: `--resume-from {slug}` を指定しましたが、依存 Issue `{dep-slug}` の status が `{status}` です（完了済み前提）。
処理を継続するには、依存 Issue を先に完了させるか、`--issue-slugs` で完了済みの Issue のみを指定してください。
```

各Issueについて以下を順次実行:

##### 3.3.1 GitHub Issue の create-or-update

永続マーカー `<!-- einja:epic-id={epicId} issue-slug={slug} kind=issue-spec schema=1.0 -->` で既存Issueを検索。

再照合手順（`docs/einja/templates/epic-specs/persistent-marker-spec.md` 準拠）:

1. manifest の `issues[].githubIssueNumber` に値があれば GET で再照合
   ```bash
   gh issue view {number} --json body,url,number,title,milestone,state
   ```
2. GET 成功 + マーカー完全一致 → reuse、本文を update で最新化
3. GET 404 or マーカー不一致 → 検索フォールバック:
   ```bash
   gh issue list \
     --search '"einja:epic-id={epicId}" "issue-slug={slug}" "kind=issue-spec" in:body' \
     --state all --json number,body,url,state
   ```
4. 検索で発見 → manifest の `issues[].githubIssueNumber` を補正して reuse
5. 見つからない → 新規作成:
   ```bash
   gh issue create \
     --title "{Issueタイトル}" \
     --milestone "{Epicタイトル}" \
     --body "$(cat <<'EOF'
   <!-- einja:epic-id={epicId} issue-slug={slug} kind=issue-spec schema=1.0 -->

   ## Epic コンテキスト
   - Epic: {epic-slug}
   - Epic Tracker: #{trackerIssueNumber}
   - Milestone: {Epicタイトル}

   （詳細は einja-issue-spec-create Headless が追記します）
   EOF
   )"
   ```
6. 作成された Issue 番号を manifest `issues[].githubIssueNumber` に反映。Tracker Issue のチェックリストも update

##### 3.3.2 `issue/{N}` ブランチの create-or-update

```bash
ISSUE_BRANCH="issue/{N}"
EPIC_BRANCH="epic/{epic-slug}"

# 存在確認
if git show-ref --verify --quiet "refs/heads/$ISSUE_BRANCH"; then
  git checkout "$ISSUE_BRANCH"
  git ls-remote --exit-code origin "$ISSUE_BRANCH" &>/dev/null && git pull origin "$ISSUE_BRANCH" --rebase
else
  git checkout -b "$ISSUE_BRANCH" "$EPIC_BRANCH"
  git push -u origin "$ISSUE_BRANCH"
fi
```

MCP 経由のリモート作成も可（`mcp__github__create_branch`、`from_branch = epic/{slug}`）。存在確認→未存在時のみ作成で冪等化。

##### 3.3.3 `einja-issue-spec-create` を Headless mode で呼び出し

Skill tool で呼び出す。プロンプトの先頭に `<<MODE: HEADLESS>>` マーカーと入力契約ブロックを配置する。

```
Skill: einja-issue-spec-create
args: |
  <<MODE: HEADLESS>>

  ## Epic Context
  - epic-context: docs/specs/epics/{epic-slug}
  - manifest-path: docs/specs/epics/{epic-slug}/epic-manifest.json
  - scope-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md
  - resume-state-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json
  - github-issue-number: {N}
  - issue-base-branch: epic/{epic-slug}
  - pr-base-branch: epic/{epic-slug}
  - milestone: {Epicタイトル or null}
  - epic-tracker-issue: {trackerIssueNumber or null}

  （必要に応じて RESUMED_ANSWERS セクションを追加。§5.4 参照）
```

実行結果は次のいずれか:

| 結果 | 対応 |
|------|------|
| 正常完了 | resume-state `status=completed`、Issue Spec PR URL を取得。Tracker Issue の子チェックリストを update。次Issue へ |
| PENDING_QUESTIONS 返却 | §5「質問ブローカー」で正規化 → ユーザー回答集約 → resume |
| retryable=true エラー | Headless 側が exponential backoff（初回30秒、2回目60秒）で2回まで自動再試行済み。Headless 側の `attemptCounts` に2回試行済みが記録されていれば、Epic 側は PENDING_QUESTIONS 昇格として扱う（Epic 側は独立して再試行しない） |

##### 3.3.4 `--stop-after-issue-spec` 処理

各Issue Spec PR 作成後、`--stop-after-issue-spec` オプション指定時はユーザーに継続確認する。

```yaml
AskUserQuestion:
  question: |
    Issue #{N} ({issue-title}) の仕様書 PR が作成されました。
    - Issue URL: {URL}
    - Spec PR URL: {URL}
    - 残り Issue: {N} 件
    続行しますか？
  header: "Step 3 Issue Spec 継続確認"
  options:
    - label: "継続"
      description: "次の Issue を Headless 展開する。Note: 残り {N} 件を順次処理"
    - label: "停止"
      description: "ここで一旦停止。Note: 後から --resume-from で再開可能"
    - label: "その他（自由入力）"
      description: "個別指示があれば入力"
```

#### 3.4 Epic PR の Draft 先行作成

**`--max-issues` で中断した場合の Epic PR 作成可否**

全 Issue の展開が完了していない状態（`--max-issues N` で残件が存在する）では、Epic PR Draft を**自動作成せず**、以下の AskUserQuestion でユーザーに確認する:

```yaml
AskUserQuestion:
  question: |
    --max-issues により {N} 件の Issue 展開が完了しましたが、残り {M} 件が未展開です。
    この時点で Epic PR Draft を先行作成しますか？
  header: "Epic PR Draft 作成確認（分割実行中）"
  options:
    - label: "今すぐ Draft を作成する（推奨）"
      description: "現時点の子 Issue Spec PR チェックリストで Epic PR Draft を作成する。Note: 後続の --resume-from で残件展開時に PR 本文を update で最新化する。進捗をすぐ GitHub で確認したい場合に選択"
    - label: "全 Issue 展開完了後にまとめて作成する"
      description: "残件が全て展開完了するまで Epic PR 作成を保留する。Note: 途中での GitHub 上の可視化が不要な場合に選択"
    - label: "その他（自由入力）"
      description: "別の方針があれば入力"
```

全 Issue の Headless 展開完了後（`--max-issues` 分割なし、または最終バッチ）は Epic PR を Draft で先行作成する。

永続マーカー `<!-- einja:epic-id={epicId} issue-slug=null kind=epic-pr schema=1.0 -->` で既存検索:

```bash
gh pr list \
  --search '"einja:epic-id={epicId}" "kind=epic-pr" in:body' \
  --state all --json number,body,url,state,headRefName,baseRefName
```

一致なしの場合 create:

```bash
gh pr create \
  --base "{baseBranch}" \
  --head "epic/{epic-slug}" \
  --title "Epic: {Epicタイトル}" \
  --draft \
  --body "$(cat <<'EOF'
<!-- einja:epic-id={epicId} issue-slug=null kind=epic-pr schema=1.0 -->

## Epic: {Epicタイトル}

- Epic ID: {epicId}
- Epic Tracker: #{trackerIssueNumber}
- Milestone: {Epicタイトル}

## 子 Issue Spec PR
- [ ] #{pr1} {Issue-1 タイトル}
- [ ] #{pr2} {Issue-2 タイトル}
...

## 成果物
- docs/specs/epics/{epic-slug}/epic-overview.md
- docs/specs/epics/{epic-slug}/requirements.md
- docs/specs/epics/{epic-slug}/design.md
- docs/specs/epics/{epic-slug}/ui-design.pen （UI要件あり）
- docs/specs/epics/{epic-slug}/screen-transitions.drawio （UI要件あり）

**子 Issue Spec PR が全てマージされた後、Ready for review に遷移してください。**
EOF
)"
```

既存PRがあれば update（子PRチェックリストを最新に）。

**Ready for review への遷移は本Skill対象外**（ユーザー判断）。

---

## 5. 質問ブローカー（broker JSON 正規化）

Epic 実行中に `epic-planner` / `einja-issue-spec-create`（Headless） / `einja-review-spec` / `_einja-epic-contract-validator` から PENDING_QUESTIONS（Markdown）が返却された場合、以下の手順で集約する。

### 5.1 保存先

`docs/specs/epics/{epic-slug}/question-broker.json`（git管理対象）

スキーマ: `docs/einja/templates/epic-specs/schemas/question-broker.schema.json`

ファイル全体は以下の object 形式とする（ルートは配列ではなく object）:

```json
{
  "schemaVersion": "1.0",
  "questions": [ ...質問エントリの配列... ]
}
```

ファイルが未存在の場合は上記の初期値（`questions: []`）で新規作成する。

### 5.2 Markdown → broker JSON 正規化手順

1. サブエージェント出力から `## PENDING_QUESTIONS` セクションを抽出
2. `### Q{N}:` 単位で質問を切り出す
3. 各質問について本文を**正規化**:
   - 前後空白 trim
   - 改行コードを LF (`\n`) に統一
   - 連続する空白（全角スペース含む）を半角スペース1つに圧縮
   - 行末記号（`。` / `.` / `?` / `？` / `!` / `！`）を除去
   - 小文字化（日本語は影響しない）
4. **`sourceSkill` の決定**: Markdown を返却したサブエージェントの呼び出し元を Epic 側で保持し、broker JSON エントリの `sourceSkill` に設定する。Markdown からの抽出は不要（呼び出し元の情報を Epic 側で管理する）。

   | 呼び出し元 | `sourceSkill` に設定する値 |
   |-----------|--------------------------|
   | `einja-issue-spec-create`（Headless） | `"einja-issue-spec-create"` |
   | `einja-review-spec` | `"einja-review-spec"` |
   | `_einja-epic-contract-validator` | `"_einja-epic-contract-validator"` |
   | `epic-planner`（PENDING_QUESTIONS 返却時） | `"epic-planner"` |

5. fingerprint 計算: `sha256(sourceSkill + "|" + 正規化後質問本文)` の 64文字 hex
6. questionId: `"Q-" + fingerprint の先頭 12 文字`
6. `question-broker.json` の **`.questions[]` 配列**を操作:
   - 同一 `fingerprint` が既存 → そのエントリの `appliesToIssueSlugs` に `sourceIssueSlug` を追加（重複排除、`uniqueItems`）
   - 新規 → `.questions[]` に以下を追加:
     ```json
     {
       "questionId": "Q-{12文字hex}",
       "sourceSkill": "einja-issue-spec-create | einja-review-spec | _einja-epic-contract-validator",
       "sourceIssueSlug": "{issue-slug} or null",
       "type": "requirement-ambiguity | design-decision | review-major | validator-failure",
       "fingerprint": "{64文字hex}",
       "question": "{質問本文（正規化前の原文）}",
       "appliesToIssueSlugs": ["{issue-slug}"],
       "status": "open",
       "answer": null,
       "normalizedFromMarkdown": true
     }
     ```

### 5.3 ユーザー回答の集約

`question-broker.json` の `.questions[]` から `status=open` の質問を抽出し、AskUserQuestion で集約する。

```yaml
AskUserQuestion:
  question: |
    Epic 展開中に {N} 件の確認事項が発生しました。

    【Q1: {質問タイトル}】
    背景: {background}
    source: {sourceSkill} / {sourceIssueSlug}
    - A: {選択肢A 説明}
    - B: {選択肢B 説明}
    推奨: {推奨}
  header: "Epic 確認事項"
  options:
    - label: "A"
      description: "{A詳細}。Note: {メリット} / {デメリット}"
    - label: "B"
      description: "{B詳細}。Note: {メリット} / {デメリット}"
    - label: "その他（自由入力）"
      description: "上記以外の方針を自由記述"
```

### 5.4 回答反映と resume

1. 回答を broker JSON の `.questions[]` 該当エントリの `answer` に追記（`status=answered`、`answeredAt` を ISO 8601 UTC で設定）
2. `appliesToIssueSlugs` に含まれる全Issueの `resume-state.json` の `answers[]` へ反映
3. **未開始 Issue（`resume-state.json` が存在しない、または `status=pending`）への事前注入**: 該当 Issue の `resume-state.json` が存在しない場合は初期値（`status: "pending"`）で新規作成してから `answers[]` へ注入する。これにより同一質問の再発防止を図る。

   ```bash
   PENDING_STATE_PATH="docs/specs/epics/{epic-slug}/issues/{pending-slug}/resume-state.json"
   if [ ! -f "$PENDING_STATE_PATH" ]; then
     mkdir -p "$(dirname "$PENDING_STATE_PATH")"
     # 初期値で新規作成
     echo '{"schemaVersion":"1.0","epicId":"{epicId}","issueSlug":"{pending-slug}","status":"pending","currentPhase":"requirements","generatedArtifacts":[],"githubIssueNumber":null,"milestoneId":null,"trackerIssueNumber":null,"branch":null,"issuePrNumber":null,"pendingQuestions":[],"answers":[],"operationLog":[],"attemptCounts":{"reviewSpec":0,"tasksValidator":0,"questionLoop":0},"updatedAt":"{now}"}' \
       > "$PENDING_STATE_PATH"
   fi
   # answers[] に注入
   jq --argjson ans "{answerEntry}" '.answers += [$ans] | .updatedAt = "{now}"' \
     "$PENDING_STATE_PATH" > "$PENDING_STATE_PATH.tmp" && mv "$PENDING_STATE_PATH.tmp" "$PENDING_STATE_PATH"
   ```

4. 対象Issueの `resume-state.status = "resumed"` に更新
5. **`einja-issue-spec-create` の resume 呼び出し方法**: `resume` パラメータは使わず、**Skill tool の通常呼び出し**を行う。プロンプト冒頭に `<<MODE: HEADLESS>>` と `<<RESUME>>` の2つのマーカーを配置し、次に入力契約ブロック、最後に `## RESUMED_ANSWERS` セクションを含める:

   ```markdown
   <<MODE: HEADLESS>>
   <<RESUME>>

   ## Epic Context
   - epic-context: docs/specs/epics/{epic-slug}
   - manifest-path: docs/specs/epics/{epic-slug}/epic-manifest.json
   - scope-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/scope.md
   - resume-state-path: docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json
   - github-issue-number: {N}
   - issue-base-branch: epic/{epic-slug}
   - pr-base-branch: epic/{epic-slug}
   - milestone: {Milestone名 or null}
   - epic-tracker-issue: {trackerIssueNumber or null}

   ## RESUMED_ANSWERS

   ### Answer to Q1: {質問タイトル}
   - **選択**: A
   - **回答本文**: {ユーザー回答本文}
   - **questionId**: Q-{hex12}
   ```

6. `einja-issue-spec-create` が `<<RESUME>>` マーカーを検出して resume mode と識別し、`RESUMED_ANSWERS` セクションを読み取って該当フェーズから再開する

### 5.5 validator / review-spec 由来の質問

`_einja-epic-contract-validator` が FAILURE を返して再生成しても解消しない場合、および `einja-review-spec` が MAJOR を2回連続で返した場合は、Epic 側で PENDING_QUESTIONS を発行して broker JSON に登録し、ユーザー判断を仰ぐ。`sourceSkill` はそれぞれ `_einja-epic-contract-validator` / `einja-review-spec` を設定する。

---

## 6. 冪等性保証

### 6.1 永続マーカー必須

全外部リソース（Issue / PR / Milestone / Tracker）に永続マーカー（`docs/einja/templates/epic-specs/persistent-marker-spec.md` 準拠）を埋め込む。本文冒頭（Milestone は Description 冒頭）に配置し、create / update のいずれでも破壊しない。

### 6.2 operationLog

各 Issue の `docs/specs/epics/{epic-slug}/issues/{issue-slug}/resume-state.json` の `operationLog[]` に外部操作を記録する。スキーマ: `docs/einja/templates/epic-specs/schemas/operation-log-entry.schema.json`。

Epic 側のリソース（Milestone / Tracker / Epic PR）は、Epic ディレクトリ直下の resume-state 相当ではなく、manifest の `milestoneId` / `trackerIssueNumber` にのみ記録する（v1）。将来的には Epic レベルの operation-log.json を追加する可能性あり。

### 6.3 再照合手順（`persistent-marker-spec.md` §「再照合手順」に完全準拠）

1. `operationLog` に success + remoteId → 該当リソースを GET
2. GET 成功 + マーカー完全一致 → update / reuse
3. GET 404 or マーカー不一致 → マーカー検索にフォールバック:
   - Issue / PR: GitHub Search API `in:body`
   - Milestone: REST List + クライアント側照合（Search API 対象外）
4. 検索で発見 → `operationLog` を補正して reuse
5. 見つからない → create
6. `status=failed` エントリはスキップ禁止。
   - `error.retryable=true` → **exponential backoff**（初回30秒待機後に再試行、2回目は60秒待機後に再試行）で最大2回再試行。2回失敗した場合は PENDING_QUESTIONS 昇格
   - `error.retryable=false` → PENDING_QUESTIONS 昇格（再試行しない）

---

## 7. ブランチ / PR モデル

`docs/einja/steering/branch-strategy.md` §「Epic配下でのIssueBranchBase解釈」に完全準拠。

```
main / develop (IssueBranchBase)
 └─ epic/{epic-slug}
      └─ issue/{N}
           └─ issue/{N}-phase{M}
```

| PR | base | head | 担当Skill |
|----|------|------|----------|
| Issue Spec PR | `epic/{epic-slug}` | `issue/{N}` | `einja-issue-spec-create` Headless（create-or-update 一元責務） |
| Epic PR | `main` / `develop` | `epic/{epic-slug}` | **本Skill**（Draft先行作成のみ） |

- Issue Spec PR の作成・更新は **Headless IssueSpec 側が一元担当**。Epic 側から PR は作らない
- Epic PR は Draft で先行作成し、子 Issue Spec PR チェックリストを本文に記載。Ready for review 遷移はユーザー判断

---

## 8. 承認ゲート

| ゲート | タイミング | 対応 |
|-------|-----------|------|
| ゲート 1 | Step 1完了後（契約ファイル） | AskUserQuestion + コミット・プッシュ |
| ゲート 2 | Step 2完了後（Epic全体成果物） | AskUserQuestion + コミット・プッシュ |
| ゲート 3（任意） | Step 3 各Issue Spec 完了後 | `--stop-after-issue-spec` 指定時のみ AskUserQuestion |

`--stop-after-contract` / `--stop-after-epic-artifacts` で明示的に停止することも可。

---

## 9. エラー・質問ループ停止条件

| 条件 | 対応 |
|------|------|
| `questionLoop >= 3`（同一Issue） | Epic全体停止。未解決事項を集約して AskUserQuestion で報告 |
| `_einja-epic-contract-validator` FAILURE が修正後2回も解消しない | Epic全体停止。validator 出力を broker JSON に登録して AskUserQuestion |
| `einja-review-spec` MAJOR が修正後2回も解消しない | Epic全体停止。review 結果を broker JSON に登録して AskUserQuestion |
| 外部リソース操作で `retryable=false` | 対象Issueを `blocked` に設定、broker JSON に昇格登録、他のIssueはユーザー確認のうえ継続可 |
| Headless IssueSpec が PENDING_QUESTIONS を返した | §5 の手順で broker に正規化 → ユーザー回答 → resume |

Epic全体停止時は `question-broker.json` と各Issueの `resume-state.json` を保存した状態で終了する。ユーザーは後から本Skillを `--resume-from {issue-slug}` で再起動できる。

---

## 10. コミット・プッシュ

各Step完了時に `einja-task-commit` Skill を呼び出す。

```
Skill: einja-task-commit
args: planFile={Planファイルパス}
```

Skill内部で `docs/einja/steering/commit-rules.md` を参照してコミット分割を決定する。`einja-task-commit` は `pnpm prepush` も内部で実行する。

| Step | 標準コミットメッセージ（参考） |
|------|------------------------------|
| Step 1 | `docs: {Epicタイトル} の契約ファイル（overview / manifest / scope）を追加` |
| Step 2 | `docs: {Epicタイトル} の全体要件・設計・UI設計を追加` |
| Step 3（各Issue） | Headless IssueSpec 側が各Phase完了時にコミット。Epic 側では resume-state / operationLog の更新を `chore: resume-state 更新 ({issue-slug})` でまとめる |

各Stepを独立コミットにしてレビュー単位を明確化する。

---

## 11. 成果物ディレクトリ構造

```
docs/specs/epics/{epic-slug}/
├── epic-overview.md
├── epic-manifest.json
├── question-broker.json           # Epic 実行中のみ、質問集約
├── requirements.md
├── design.md
├── ui-design.pen                  # hasUI=true のみ
├── screen-transitions.drawio      # hasUI=true のみ
└── issues/
    └── {issue-slug}/
        ├── scope.md               # YAML frontmatter 必須
        ├── resume-state.json      # Headless 実行状態、operationLog 含む
        ├── requirements.md        # Headless IssueSpec が生成
        ├── design.md              # 同上
        ├── qa-test.md             # 同上
        └── ui-design.pen          # UI要件あり Issue のみ
```

全ファイルは git 管理対象（`.gitignore` しない）。PR レビューで進捗・質問履歴が追える。

---

## 12. 使用例（プロンプトサンプル）

### 12.1 最小入力

```
新機能「ユーザープロフィール設定」の仕様を作成してください。
```

→ 本Skillが0.1〜0.5 の前提確認 AskUserQuestion を発行、Step 1 → 2 → 3 を順次実行、全Issue展開完了まで実行。

### 12.2 オプション付き（小分け実行）

```
新機能X の仕様を作成してください。まず契約ファイルまで作って確認したい。

## Options
- --stop-after-contract
```

→ Step 1完了で停止。後日追加指示で `--resume-from` 等を使って続きを実行。

### 12.3 分割実行

```
epic/user-profile-settings の Issue Spec 展開を進めてください。
残りのIssueは profile-avatar と profile-notifications-settings です。

## Options
- --issue-slugs profile-avatar,profile-notifications-settings
```

→ Step 1/2 を skip（再照合で既存確認）、Step 3で指定2Issueのみ展開。

### 12.4 resume（質問回答後）

```
epic/user-profile-settings の profile-avatar から再開してください。

## Options
- --resume-from profile-avatar
```

→ 前のIssueは完了済み前提。resume-state.json の `answers[]` を読み込みHeadless再開。

---

## 13. 依存資産一覧

| 資産 | 種別 | 役割 |
|------|------|------|
| `.claude/agents/einja/epic-specs/epic-planner.md` | サブエージェント | Epic概要 + Issue分割契約 + UI/drawio 生成 |
| `.claude/skills/_einja-epic-contract-validator/SKILL.md` | インナーSkill | 構造検証（決定論） |
| `.claude/skills/einja-issue-spec-create/SKILL.md` | Skill | 各Issue詳細仕様書のHeadless生成 |
| `.claude/skills/einja-review-spec/SKILL.md` | Skill | LLM多観点レビュー |
| `.claude/skills/einja-task-commit/SKILL.md` | Skill | コミット・プッシュ |
| `.claude/skills/_einja-subagent-question-protocol/SKILL.md` | インナーSkill | サブエージェント質問プロトコル（未変更） |
| `.claude/skills/_einja-worktree-guide/SKILL.md` | インナーSkill | worktree セットアップ参照（本Skillは worktree作成せず、Epicブランチのみで作業） |
| `docs/einja/templates/epic-specs/schemas/epic-manifest.schema.json` | JSON Schema | manifest 検証 |
| `docs/einja/templates/epic-specs/schemas/scope-frontmatter.schema.json` | JSON Schema | scope.md frontmatter 検証 |
| `docs/einja/templates/epic-specs/schemas/resume-state.schema.json` | JSON Schema | resume-state 検証 |
| `docs/einja/templates/epic-specs/schemas/operation-log-entry.schema.json` | JSON Schema | operationLog 検証 |
| `docs/einja/templates/epic-specs/schemas/question-broker.schema.json` | JSON Schema | broker JSON 検証 |
| `docs/einja/templates/epic-specs/schemas/persistent-marker.schema.json` | JSON Schema | 永続マーカー検証 |
| `docs/einja/templates/epic-specs/samples/` | サンプル | manifest / scope.md / resume-state の雛形 |
| `docs/einja/templates/epic-specs/persistent-marker-spec.md` | 仕様書 | 永続マーカー形式と再照合手順 |
| `docs/einja/templates/epic-specs/id-conventions.md` | 仕様書 | ID命名規約 |
| `docs/einja/steering/branch-strategy.md` | steering | Epic配下のブランチ階層 |

---

## 14. サブエージェント呼び出しの注意

本Skillが Agent tool でサブエージェントを起動する際は、以下を厳守する（CLAUDE.md サブエージェント起動時の権限ルール準拠）。

- **`mode` パラメータを指定しない**（親の権限設定を継承させる）
- サブエージェントプロンプトの末尾に以下を必ず含める:
  > 不明点や判断が必要な場合は、推測で進めず `.claude/skills/_einja-subagent-question-protocol/SKILL.md` を参照してPENDING_QUESTIONS形式で質問を返却し、作業を停止すること。
- 並行起動時は変更対象ファイルが重複しないよう事前調整する（v1では Step 3 は順次実行のみなので該当しない）

---

## 15. 重要な原則

- **Epicの価値は、各Issueへの良質で検証可能な入力を作ること**
- 自然文だけでIssueSpec を連鎖生成しない（manifest + scope.md frontmatter を Single Source of Truth とする）
- Headless mode でも `einja-review-spec` / validator は省略しない
- 構造検証（決定論）と LLMレビュー（`einja-review-spec`）を分離
- 冪等性: 永続マーカーと operationLog で再照合してから reuse / create
- 分割実行: `--max-issues` / `--issue-slugs` / `--resume-from` で長時間実行を分割可能にする
- 質問プロトコル互換性: サブエージェントは既存Markdown形式を維持、Epic側で broker JSON に正規化

<!-- @einja:project-private:start id="einja-epic-spec-create-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
