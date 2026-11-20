---
name: einja-pr-review
description: "Generates and posts structured PR review comments (PR summary, AI review with Asana consistency check, impact analysis, spec/mermaid update check, and finding classification, plus human-review-required items) by analyzing PR diff, PR body, Issue references, related spec files, and Asana task info locally. Posts as sticky comment on the PR (updates existing bot comment via marker-based detection). Runs entirely within the developer's Claude Code CLI subscription (no API key required). Called by einja-create-pr Step 5.5 when base=main/develop AND (--auto flag OR --with-review flag) is set. Also directly invocable as `/einja-pr-review <PR番号>` for manual re-review on existing PRs. Internally invokes einja-review-code and einja-review-spec for detailed review perspectives. Triggers: 「PRレビュー」「pr-review」「PR概要」「PR自動レビュー」「PR再レビュー」「ローカルPRレビュー」. Do NOT use for: コードdiff単体レビュー（→ einja-review-code）、Planレビュー（→ einja-review-plan）、仕様書レビュー（→ einja-review-spec）"
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Skill
  - mcp__claude_ai_Asana__*
---

<!-- 参考Plan: docs/plans/202607/20260731-pr-review-local.plan.md -->
<!-- ベース: .claude/skills/einja-review-code/SKILL.md -->

# einja-pr-review Skill

PR差分・PR本文・Issue参照・関連仕様書・Asanaタスク情報をローカルで解析し、4セクション構造化レビュー（PR概要 / AIレビュー4観点 / 人間観点 / 指摘サマリー統合）を生成してPRにsticky commentとして投稿するSkill。

## 実行フロー

### Step 1: 入力の受付

- **引数**: PR番号（数値のみ、必須）
- **呼び出し元**: einja-create-pr Step 5.5（自動）または `/einja-pr-review <PR番号>`（手動）
- **発動条件**: 呼び出し元で判定済み。本Skillは受け取ったPR番号を無条件でレビュー

#### 引数正規化とバリデーション

自然言語引数（例: `"PR #123 のレビュー"`）で渡される可能性があるため、以下の手順で正規化する:

```bash
# 引数から数値のみを抽出
RAW_ARG="${1:?PR番号が指定されていません}"
PR_NUMBER=$(echo "$RAW_ARG" | grep -oE '#?[0-9]+' | head -1 | tr -d '#')

# バリデーション（数値・1桁以上・7桁以内）
if ! [[ "$PR_NUMBER" =~ ^[0-9]{1,7}$ ]]; then
  echo "❌ Invalid PR number: '$RAW_ARG' → '$PR_NUMBER'" >&2
  exit 1
fi
readonly PR_NUMBER
echo "▶️  Reviewing PR #${PR_NUMBER}"
```

**重要**: `PR_NUMBER` は `readonly` として不変化し、以降の全 sink（`git fetch`, `gh pr view`, `git branch -D` 等）に対して再バリデーション不要とする。

### Step 2: PR情報の収集

```bash
# 基本情報 + 差分取得
gh pr view "$PR_NUMBER" --json number,title,body,baseRefName,headRefName,author,url > /tmp/pr-${PR_NUMBER}-info.json
gh pr diff "$PR_NUMBER" > /tmp/pr-${PR_NUMBER}-diff.patch
gh pr diff "$PR_NUMBER" --name-only > /tmp/pr-${PR_NUMBER}-files.txt
```

以下を順次実行:

1. **Issue参照抽出**: PR本文/タイトル/ブランチ名から `#N` を抽出（正規表現は `references/review-lenses.md` §C1 参照）
2. **仕様書 Glob探索**: `docs/specs/**/issue{N}-*/{requirements,design,qa-test,ui-design-url}.md` を Glob→Read
3. **Asana URL 抽出**: `requirements.md` の §Sources テーブル行から Asana URL を正規表現で抽出
4. **PR概要データ収集**: `package.json` / `.env.*` / `*.config.*` / `prisma/migrations/**` 変更の有無を判定（C3/C4/C5 表示判定用）

### Step 3: diff範囲の準備【R1対応】

`einja-review-code` は `git diff HEAD` 前提のため、**PR head を作業ツリーに反映した状態**で呼ぶ必要がある。現行は (a) fetch→checkout 方式を採用（(b) diff範囲パラメータ拡張は Plan外の別Issue候補）。

```bash
# 作業破壊防止: 未コミット変更があればエラー終了
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Uncommitted changes exist. Commit or stash before running einja-pr-review." >&2
  exit 1
fi

# 現在のブランチを取得（trap 用）
# detached HEAD 時のフォールバックとして rev-parse HEAD を使用
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse HEAD)
if [ -z "$CURRENT_BRANCH" ]; then
  echo "❌ Failed to detect current branch" >&2
  exit 1
fi

# 【重要】trap は fetch/checkout の前に設定する（fetch/checkout失敗時も復元されるように）
trap 'git checkout "${CURRENT_BRANCH}" 2>/dev/null; git branch -D "pr-review-tmp-${PR_NUMBER}" 2>/dev/null' EXIT

# 既存のtmpブランチをクリーンアップ（冪等性確保: 前回異常終了時の残置対策）
# 残置していると `fetch: ref already exists` エラーになるため事前削除
git branch -D "pr-review-tmp-${PR_NUMBER}" 2>/dev/null || true

# PRブランチをtmpブランチにfetch
git fetch origin "pull/${PR_NUMBER}/head:pr-review-tmp-${PR_NUMBER}"
git checkout "pr-review-tmp-${PR_NUMBER}"
BASE_BRANCH=$(jq -r '.baseRefName' /tmp/pr-${PR_NUMBER}-info.json)
git fetch origin "${BASE_BRANCH}"

# ...レビュー実行...
# 復元は trap により自動実行
```

### Step 4: 内部Skill呼び出し（Skill tool 直接呼び出し）

**R5対応**: Codex起動は `einja-review-code` 内蔵版に任せ、本Skillでは重複起動しない（`einja-review-code` Step 1.5 で ToolSearch により `mcp__codex__codex` を確認し内部で並列起動する）。

#### 4-1. AR-PR4: `einja-review-code` 呼び出し（必須）

Skill tool で `einja-review-code` を呼び出す。args に自然言語で以下の前置コンテキストを渡す:

```
PR #${PR_NUMBER} のコードレビュー。
- base: ${BASE_BRANCH}
- head: pr-review-tmp-${PR_NUMBER} (PR#${PR_NUMBER}のhead)
- diff範囲: origin/${BASE_BRANCH}...pr-review-tmp-${PR_NUMBER}
- 変更ファイル数: N (詳細は /tmp/pr-${PR_NUMBER}-files.txt 参照)
本Skill(einja-pr-review)から呼ばれています。観点A-Hを自動ピック・並列実行し、判定Markdownを返却してください。
```

戻り値の Markdown（`### 最終判定: [PASS/MINOR/MAJOR]` を含む）を AR-PR4 セクションの基データとして保持する。

#### 4-2. AR-PR3補強: `einja-review-spec` 呼び出し（条件付き）

**条件**: Step 2 で取得した仕様書パスに変更ファイル（`docs/specs/**/issue{N}-*/`）が含まれる場合のみ実行。

```
PR #${PR_NUMBER} の仕様書レビュー。
- review_scope: phase2_bundle
- 対象spec: docs/specs/issues/issue${N}-*/
- ユーザーの元要求: PR本文および関連Issue #${N} の概要（Step 2 で取得済み）
本Skill(einja-pr-review)から呼ばれています。仕様書観点で判定Markdownを返却してください。
```

戻り値は AR-PR3 の判定 + AR-PR4 マトリクスへの取り込みに利用する。

### Step 5: 4セクション組み立て

`references/review-lenses.md` の観点定義に従い、以下を組み立てる:

1. **§1 PR概要**: S1-S4 常時 + C1/C3/C4/C5 条件付き（該当なし = 行省略）
2. **§2 AIレビュー**: AR-PR1 → AR-PR2 → AR-PR3 → AR-PR4 固定順（該当なし = サブセクション省略）
   - AR-PR1: Asana URL 抽出成功 & Connector認証済み時のみ `mcp__claude_ai_Asana__get_task` 実行
   - AR-PR2: `gh pr diff --name-only` + Grep で影響範囲マップを生成
   - AR-PR3: Step 4-2 の結果 + Mermaid同期漏れ検出
   - AR-PR4: Step 4-1 の結果を優先度 × ジャンル マトリクスへ再整理
3. **§3 人間観点**: HR1-HR6 のうち diff から該当するものだけ動的リストアップ（該当ゼロ = §3ごと省略）

`references/output-format.md` のテンプレートに従い Markdown 本文（`NEW_BODY`）を生成する。

### Step 6: Sticky Comment 投稿

`references/sticky-comment.md` の実装フローに従う:

1. マーカー `<!-- einja-pr-review:v1 -->` で始まる既存コメントを検索
2. 存在 → `gh api -X PATCH .../issues/comments/{id}` で本文更新
3. 不在 → `gh pr comment ${PR_NUMBER} --body "${NEW_BODY}"` で新規投稿
4. 投稿結果のコメントURLを標準出力に出力

## 呼び出し規約

### 引数

| 位置 | 名前 | 型 | 必須 | 説明 |
|------|------|-----|------|------|
| $1 | PR_NUMBER | 数値 | 必須 | GitHub PR番号（例: `123`）|

自然言語での起動（`/einja-pr-review <PR番号>` および Skill tool 経由の `args`）両方をサポート。args は自然言語文字列として受け取り、Skill 内で `#(\d+)` パースする。

### 戻り値

**Markdown レポート**（人間可読）+ **末尾に構造化サマリJSON**（機械消費用、R4対応）。

- **標準出力**: 投稿結果のコメントURL（呼び出し元がログ表示に利用）
- **本文（Markdown）**: sticky comment に投稿したのと同一の Markdown（呼び出し元での事後参照用）
- **末尾JSON**（Progressive Disclosure, R4対応）: 呼び出し元Skillが後から機械的に判定を消費できるよう、以下の構造で併記する

```json
{
  "verdict": "APPROVED | REQUEST_CHANGES | COMMENT",
  "prNumber": 123,
  "arResults": [
    { "arId": "AR-PR1", "status": "PASS|SKIP|MAJOR", "note": "..." },
    { "arId": "AR-PR2", "status": "PASS|MINOR|MAJOR", "impactedModules": ["..."] },
    { "arId": "AR-PR3", "status": "PASS|SKIP|MAJOR", "sourceSkill": "einja-review-spec" },
    { "arId": "AR-PR4", "status": "PASS|MINOR|MAJOR", "sourceSkill": "einja-review-code",
      "criticalCount": 0, "majorCount": 0, "minorCount": 0, "infoCount": 0 }
  ],
  "stickyCommentId": 123456789,
  "stickyCommentUrl": "https://github.com/..."
}
```

現状は Markdown 中心の運用で問題ないが、将来的な機械消費・CI連携のためのフックとして併記する（`_einja-phase-review` 準拠パターン）。

### 内部Skill呼び出しプロトコル

- **AR-PR4 (einja-review-code)**: 常時実行、戻り値の `### 最終判定: [PASS/MINOR/MAJOR]` を採用
- **AR-PR3補強 (einja-review-spec)**: 仕様書変更時のみ実行、戻り値の判定を AR-PR3 サブセクションに反映
- **前置コンテキスト**: 自然言語文字列で PR番号 / diff範囲 / spec パスを渡す（R3: Skill 間でコンテキストが共有されないため明示的に渡す）
- **PENDING_QUESTIONS**: 呼び出し先 Skill が `## PENDING_QUESTIONS` を返した場合、本 Skill はそのまま親エージェントへ返却して停止（`_einja-subagent-question-protocol` 準拠）

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| PR番号が数値でない | エラー終了（exit 1） |
| `gh pr view` / `gh pr diff` 失敗 | エラー出力しつつ exit 1（後続不可能） |
| 未コミット変更が作業ツリーに存在 | 作業破壊防止のためエラー終了（exit 1） |
| PR head の fetch/checkout 失敗 | エラー終了（exit 1）、trap で元ブランチ復元 |
| Asana MCP 未認証 or URL 不在 | AR-PR1 セクションを**省略**（警告なし） |
| Issue参照抽出失敗 | AR-PR1/AR-PR3 の spec 依存部分をスキップ、他観点は継続 |
| 仕様書不在 | AR-PR3 セクションを省略、AR-PR4 は継続 |
| `einja-review-code` 呼び出し失敗 | AR-PR4 セクションを「レビュー実行失敗」で埋める、他セクション継続、末尾JSONの `verdict: COMMENT` として投稿 |
| `einja-review-spec` 呼び出し失敗 | AR-PR3 補強データをスキップ、独自Mermaid検出のみで AR-PR3 を出力 |
| Sticky comment 投稿失敗 | stderr にエラー出力、レビュー結果Markdown は標準出力に残す（呼び出し元が救済可能） |
| PENDING_QUESTIONS を受領 | そのまま親エージェントへ返却して停止 |

## Progressive Disclosure

Skill body は概要と実行フローに絞り、詳細は references に委任する。

| 参照先 | 内容 |
|--------|------|
| `references/review-lenses.md` | 4セクション観点定義（§1 PR概要 / §2 AIレビュー4観点 / §3 人間観点 / §4 指摘サマリー統合） |
| `references/output-format.md` | Sticky comment Markdown テンプレート・サンプル出力 |
| `references/sticky-comment.md` | Sticky comment 実装フロー（マーカー方式・gh api コマンド全文） |

## 制約

- **マルチユーザー並行実行は非サポート**: 同一PRへの並行実行では sticky comment の last-write-wins が発生する（詳細: `references/sticky-comment.md` 「マルチユーザー並行実行の扱い」）
- **`einja-issue-spec-create` の Spec PR は対象外**: Spec PR は既に `einja-review-spec` × 3回で高品質レビュー済み。`einja-create-pr` を経由しないため本Skillは呼ばれない設計
- **base=main/develop 以外の判定は `einja-create-pr` 側で実施**: 本Skillは受け取ったPR番号を無条件でレビューする（呼び出し元が発動条件を判定する責務を持つ）
- **`einja-review-code` の Codex は内蔵版のみ使用**（R5対応、二重起動禁止）
- **PR head を作業ツリーに反映する**（R1対応）: 未コミット変更がある状態では実行不可
- **GitHub 側の PR head のみをレビュー対象とする**: 本Skillは `git fetch origin pull/${PR_NUMBER}/head` により GitHub 上の最新 PR head を fetch してレビューする。**ローカルに残っている未 push commit や未追跡ファイルはレビュー対象外**。手動再実行前に必要な commit を必ず push しておくこと（呼び出し元 `einja-create-pr` から呼ばれる場合は Step 4 の `gh pr create` により push 済み前提）。
