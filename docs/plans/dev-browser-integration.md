# dev-browser プラグイン導入 + einja-use-browser-guide Skill（einja-common）+ x-reader移行 + 下流波及

## Context

Claude Code プラグイン `dev-browser`（Playwrightベースのサンドボックスブラウザ操作）を導入し、既存の Playwright MCP ガイドラインと統合した `einja-use-browser-guide` Skill を `einja-skills/plugins/einja-common/skills/` に新設する。また、dev-browser のセッション永続機能と最適合する `x-reader` Skill を dev-browser ベースに移行する。下流リポジトリまで確実に波及させるため、presets/templates反映 + CLIリリースまでスコープに含める。`CLAUDE_CODE_NO_FLICKER=1` も同時に波及。

## 現状

- `.claude/settings.json` の `enabledPlugins` に5つのプラグイン登録済み（`einja-common@einja-skills` 含む）
- `CLAUDE_CODE_NO_FLICKER=1` はルートの `.claude/settings.json` env に追加済みだが presets/templates 側は未反映
- `docs/einja/steering/development/playwright-guidelines.md`（59行、@einja:managed + @einja:project-private）
- `../einja-skills/plugins/einja-common/` にツール系ガイドSkill多数。`plugin.json` の `skills` 配列でSkillを明示列挙（現在v0.1.41）
- `x-reader` Skill（einja-common、259行）: `require('playwright')` 直接実行 + `~/.playwright-x-state.json` で手動セッション管理。dev-browser の persistent sessions で大幅に簡素化可能
- 配布メカニズム:
  - **dev-cli presets**（`copy-presets.mjs`）: `.claude/settings.json`, `.claude/skills/einja-*/`, `.claude/hooks/einja/` をコピー → 既存プロジェクトは `einja sync` で取得
  - **create-app templates**（`template-update.ts`）: `.claude/settings.json`, `.envrc` はコピー対象。`.claude/hooks/` は未登録だが direnv アプローチで不要

## 変更内容

### リポジトリA: einja-management-template（このリポジトリ）

#### A1. `.claude/settings.json` 一括編集

**ファイル**: `.claude/settings.json`

```jsonc
// env に CLAUDE_CODE_NO_FLICKER は既に追加済み（presets/templatesへの波及はA5のビルドで自動反映）

// enabledPlugins に追加
"dev-browser@sawyerhood": true

// extraKnownMarketplaces に追加
"sawyerhood": {
  "source": { "source": "github", "repo": "sawyerhood/dev-browser" }
}

// permissions.allow に追加
"Bash(dev-browser:*)"
```
※ hooks.SessionStart は不要（direnv で代替）

#### A2. `.envrc` に dev-browser チェック追加

**ファイル**: `.envrc`（`@einja:managed:start` ～ `@einja:managed:end` ブロック内に追記）

```bash
# dev-browser チェック
if ! command -v dev-browser &>/dev/null; then
  log_status "⚠ dev-browser未インストール。実行: npm install -g dev-browser && dev-browser install"
fi
```

メリット:
- `.envrc` は既に `fileMappings` で create-app / dev-cli 両方で配布済み
- create-app whitelist（A4タスク）が不要になりスコープ縮小
- `cd` でプロジェクトに入るたびにチェックされるため、Claude Code 以外の開発者にも通知される

#### A3. playwright-guidelines.md 縮退 + README.md 更新

**ファイル**: `docs/einja/steering/development/playwright-guidelines.md`
- Skill へのリダイレクト案内に縮退
- `@einja:managed` + `@einja:project-private` セクション保持

**ファイル**: `docs/einja/steering/README.md`（L101付近）
- Playwright行の説明を「ブラウザ操作ガイド（einja-common Skill統合済み）」に更新

#### A4. presets/templates 反映

- `pnpm -C packages/cli build`（copy-presets.mjs）→ settings.json, .envrc, docs が presets/default に反映
- `pnpm -C packages/create-app template:update` → settings.json, .envrc が templates/default に反映
- **検証**: `CLAUDE_CODE_NO_FLICKER`, `dev-browser`, `sawyerhood`, dev-browserチェック が各所に存在することを jq/grep で確認

#### A5. CLI patch リリース

- `npm-release` Skill で `@einja-inc/dev-cli` と `@einja-inc/create-app` **両方**を patch リリース
- CHANGELOG に「dev-browser プラグイン追加、初回 `dev-browser install` 必要」明記

### リポジトリB: einja-skills（`../einja-skills`）

#### B1. `einja-use-browser-guide` Skill 新設

**ファイル**: `../einja-skills/plugins/einja-common/skills/einja-use-browser-guide/SKILL.md`

frontmatter（pencil-guide, figma-guide に倣う）:
```yaml
---
name: einja-use-browser-guide
description: >-
  ブラウザ操作ツール（Playwright MCP / dev-browser）の利用ガイド。
  Playwright MCP と dev-browser の使い分けルール、一時ファイル管理、
  初回セットアップ手順を定義する。
  Triggers: mcp__playwright、dev-browser、ブラウザ動作確認、スクリーンショット保存先、
  画面確認、ブラウザ操作、E2Eテスト。
  Do NOT use for: Playwright テスト実装（→ testing-strategy.md）
user-invocable: true
metadata:
  author: einja-inc
---
```

本文:
- 使い分けルール（mcp__playwright優先、dev-browserは明示指示時）
- Playwright MCP ルール（tmp/playwright-mcp/、browser_resize必須、命名規約、QAエビデンスはqa-tests/）
- dev-browser ルール（初回setup、tmp/dev-browser/、セッション永続）

#### B2. `x-reader` Skill を dev-browser ベースに移行

**ファイル**: `../einja-skills/plugins/einja-common/skills/x-reader/SKILL.md`

現状の問題:
- `require('playwright')` で直接 Chromium を起動（`npm install -g playwright` が前提）
- `~/.playwright-x-state.json` でセッション状態を手動管理（storageState 保存/読込/chmod 600）
- headless=false でログインブラウザ起動 → 状態保存 → headless で再実行、の3段階フロー

dev-browser 移行後:
- **セッション管理を dev-browser の persistent pages に委譲**（storageState ファイル管理不要）
- **Playwright 直接インストール不要**（dev-browser に内蔵）
- **allowed-tools**: `Bash` のみ → dev-browser CLI 呼び出しに変更
- Step 1（前提確認）: `playwright --version` → `dev-browser --version` に変更
- Step 2（認証状態確認）: `~/.playwright-x-state.json` 確認 → dev-browser セッション存在確認に変更
- Step 3（初回ログイン）: `chromium.launch({ headless: false })` → dev-browser の visible モードに変更
- Step 4（投稿取得）: Node.js スクリプト → dev-browser 内での Playwright コード実行に変更
- セッション期限切れ時の再ログインフローも dev-browser で簡素化

#### B3. plugin.json 更新 + コミット・プッシュ

**ファイル**: `../einja-skills/plugins/einja-common/.claude-plugin/plugin.json`

```jsonc
// skills 配列に追加
"einja-use-browser-guide"

// version をバンプ
"version": "0.1.42"  // 現在 0.1.41 → patch bump
```

コミット・プッシュ後、einja-skills のリリースフローに従ってプラグイン更新を公開。

## タスク概要

| タスクID | 内容 | リポジトリ | 依存 | 並行 |
|---------|------|-----------|------|------|
| 0-0 | タスク分解・登録 [`TaskCreate`] | - | - | - |
| 0-1 | Planファイル配置 | template | 0-0 | - |
| 0-2 | worktree作成 [`_einja-worktree-guide`] | template | 0-1 | - |
| A1 | settings.json 一括編集（plugin+perms） | template | 0-2 | ★ |
| A2 | .envrc に dev-browser チェック追加 | template | 0-2 | ★ |
| B1 | einja-use-browser-guide Skill 新設 | einja-skills | 0-2 | ★ |
| B2 | x-reader Skill を dev-browser ベースに移行 | einja-skills | 0-2 | ★ |
| A3 | playwright-guidelines.md 縮退 + README更新 | template | **B1** | - |
| A4 | presets/templates 反映 [`pnpm build`] | template | **A1,A2,A3** | - |
| B3 | plugin.json 更新 + コミット・プッシュ | einja-skills | **B1,B2** | - |
| 99-1 | 観点別並列コードレビュー [`einja-review-code`] | template | A4 | - |
| 99-2 | 動作確認（下記具体項目） [`Bash`] | both | A4, B3 | - |
| 99-G | コミット承認ゲート [`AskUserQuestion`] | - | 99-1, 99-2 | - |
| 99-3 | コミット・プッシュ [`einja-task-commit`] | template | 99-G | - |
| 99-4 | CLI patch リリース [`npm-release`]（dev-cli + create-app） | template | **99-3, B3** | - |

**並列実行**: A1, A2, B1, B2 は並行可。A3 は B1 後。A4 は A1+A2+A3 後。B3 は B1+B2 後。

## リスク・不明点

1. **dev-browser バージョン固定不可**: `enabledPlugins: true` でバージョン指定できない → 低リスク
2. **下流 3-wayマージ**: 新規キー追加は安全にマージ（確認済み）
3. **CI環境**: direnv は `direnv allow` されていなければ無視。CI影響なし
4. **enabledPlugins キー形式**: `dev-browser@sawyerhood` が正しいか 99-2 で実機検証
5. **einja-skills リリースフロー**: B3 で plugin.json version bump + コミット・プッシュ。公開手順は実行時に確認
6. **x-reader 移行**: dev-browser のセッション永続APIが x-reader のユースケース（X/Twitter認証状態保持）に十分対応するか実装時に検証

## 検証・動作確認方法（タスク99-2）

```bash
# --- リポジトリA: einja-management-template ---

# 1. settings.json 設定値を個別assert
jq -e '.enabledPlugins["dev-browser@sawyerhood"] == true' .claude/settings.json
jq -e '.extraKnownMarketplaces.sawyerhood.source.repo == "sawyerhood/dev-browser"' .claude/settings.json
jq -e '.permissions.allow | index("Bash(dev-browser:*)")' .claude/settings.json
jq -e '.env.CLAUDE_CODE_NO_FLICKER == "1"' .claude/settings.json

# 2. .envrc dev-browser チェック確認
grep -q "dev-browser" .envrc && echo "envrc OK"

# 3. presets/default 反映確認
jq -e '.enabledPlugins["dev-browser@sawyerhood"] == true' packages/cli/presets/default/.claude/settings.json
jq -e '.env.CLAUDE_CODE_NO_FLICKER == "1"' packages/cli/presets/default/.claude/settings.json
grep -q "dev-browser" packages/cli/presets/default/.envrc && echo "presets envrc OK"

# 4. create-app/templates/default 反映確認
jq -e '.enabledPlugins["dev-browser@sawyerhood"] == true' packages/create-app/templates/default/.claude/settings.json
jq -e '.env.CLAUDE_CODE_NO_FLICKER == "1"' packages/create-app/templates/default/.claude/settings.json
grep -q "dev-browser" packages/create-app/templates/default/.envrc && echo "templates envrc OK"

# 5. pnpm prepush
pnpm prepush

# --- リポジトリB: einja-skills ---

# 6. Skill ファイル存在 + plugin.json 登録確認
test -f ../einja-skills/plugins/einja-common/skills/einja-use-browser-guide/SKILL.md && echo "Guide Skill OK"
jq -e '.skills | index("einja-use-browser-guide")' ../einja-skills/plugins/einja-common/.claude-plugin/plugin.json

# 7. x-reader 移行確認
grep -c "dev-browser" ../einja-skills/plugins/einja-common/skills/x-reader/SKILL.md  # dev-browser参照あり
grep -c "require.*playwright" ../einja-skills/plugins/einja-common/skills/x-reader/SKILL.md  # 0（直接require廃止）
grep -c "playwright-x-state" ../einja-skills/plugins/einja-common/skills/x-reader/SKILL.md  # 0（手動状態管理廃止）

# 8. 実機検証（Claude Code再起動後）
# /plugin list で dev-browser が有効化されていることを確認
# dev-browser --help がプロンプトなしで実行できることを確認
# x-reader でX投稿URLを読み取れることを確認（セッション永続動作）
```

## レビュー指摘対応サマリー（2回目）

| 指摘 | 対応 |
|------|------|
| [MAJOR] plugin.json Skill登録必要 | B2 に plugin.json skills配列追加 + version bump を明記 |
| [MAJOR] create-app hooks whitelist未対応 | direnv アプローチに変更（.envrc は既に配布済み）。A4 タスク削除 |
| [MAJOR] create-appリリースも必要 | A5（99-4）で dev-cli + create-app 両方をリリース |
| [MAJOR] A4依存にA3欠落 | A4 の依存を A1+A2+A3 に修正 |
| [MAJOR] 検証コマンド浅い | jq -e による個別assert + test -f に改善 |
| [MAJOR] B2内容空 | plugin.json更新 + version bump + コミット・プッシュを具体化 |
| [MAJOR] einja-skills コミット漏れ | B2 にコミット・プッシュを含む。99-4 依存に B2 追加 |
| [MINOR] FLICKER波及明示 | A1 に「env は既に追加済み、A5ビルドで自動波及」明記。検証にも追加 |
| [MINOR] enabledPlugins形式 | 99-2 に実機検証ステップ追加 |
