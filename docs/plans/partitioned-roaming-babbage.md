# CLAUDE.md sync対応 + マーカー構造修正

## Context

dev-cli の `sync` コマンドを実行しても、CLAUDE.md と `.claude/` ディレクトリが同期されない。
PR #349（einja-dev/thecreativeacademy）で初回テンプレート同期を実施したが、CLAUDE.md が変更ファイルに含まれていなかった。

**根本原因**:
1. `CATEGORY_PATTERNS` と `SyncCategory` 型に `claude` カテゴリが存在しない
2. CLAUDE.md にマーカーがほぼなく、既存ファイルがある場合はsyncしても更新されない（unmanaged扱い）

## 現状

### sync のアーキテクチャ
- テンプレートソース: `packages/create-app/templates/default/`
- `CATEGORY_PATTERNS`（`generators/sync.ts`）で glob パターンを定義
- `SyncCategory` 型（`types/index.ts`）で有効なカテゴリを列挙
- `CATEGORY_CONFIGS`（`prompts/sync.ts`）でUI表示設定を定義

### templates/default/CLAUDE.md のマーカー構造（修正前）
- CLAUDE.md の全共通ルール部分に**マーカーなし**（= sync時にローカル優先 = 更新不可）
- 末尾の「図の記述ルール」のみ `@einja:project-private` 内（本来は共通ルールなのに誤ってproject-private）
- `@einja:managed` マーカーが**一切ない**
- `@einja:excluded` ブロックはテンプレート生成時に除外済み

### マーカーベースマージ（merger.ts）
- `@einja:managed` → テンプレート側が優先（sync時に更新される）
- `@einja:project-private` → ローカル側が優先（syncで上書きされない）
- マーカーなし → ローカル側が優先

## 変更内容

### 修正ファイル一覧

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `packages/create-app/src/types/index.ts` | `SyncCategory` 型に `"claude"` を追加 |
| 2 | `packages/create-app/src/generators/sync.ts` | `CATEGORY_PATTERNS` に `claude` カテゴリ追加 |
| 3 | `packages/create-app/src/prompts/sync.ts` | `CATEGORY_CONFIGS` に `claude` カテゴリ追加 |
| 4 | `CLAUDE.md`（原本） | マーカー構造を修正 |
| 5 | `packages/create-app/templates/default/CLAUDE.md` | マーカー構造を修正（原本と同期） |

### 具体的な変更

#### A. syncカテゴリ追加（3ファイル）

**1. types/index.ts (L79-91)**

```typescript
export type SyncCategory =
  | "env"
  // ... 既存カテゴリ ...
  | "docs"
  | "claude";  // ← 追加
```

**2. generators/sync.ts — CATEGORY_PATTERNS**

```typescript
claude: ["CLAUDE.md", ".claude/**"],
```

**3. prompts/sync.ts — CATEGORY_CONFIGS**

```typescript
claude: {
  name: "Claude Code",
  description: "CLAUDE.md, .claude/settings.json, .claude/rules/",
  patterns: ["CLAUDE.md", ".claude/**"],
  defaultChecked: true,
  firstRunDefault: true,
},
```

- `defaultChecked: true` — `--yes` モードでも含まれる。マーカーベースマージで安全
- `CATEGORY_PATTERNS` と `CATEGORY_CONFIGS.patterns` を統一
- `description` は実際にsyncされるファイルのみ記載

#### B. CLAUDE.md マーカー構造修正（2ファイル）

**4. `CLAUDE.md`（原本）と 5. `templates/default/CLAUDE.md`**

変更前:
```
# Claude Code 指示書
（全内容がマーカーなし = unmanaged）
...
<!-- @einja:project-private:start id="claude-md-project" -->
### 図の記述ルール  ← 共通ルールなのにproject-private
<!-- @einja:project-private:end -->
<!-- @einja:excluded:start -->
...
```

変更後:
```
<!-- @einja:managed:start id="claude-md-main" -->
# Claude Code 指示書
（全共通ルール：基本原則、委託ルール、コード変更方針、
　完了判定基準、図の記述ルール 等）
<!-- @einja:managed:end -->

<!-- @einja:project-private:start id="claude-md-project" -->
## プロジェクト固有の設定
（下流で自由に追記。syncで上書きされない）
<!-- @einja:project-private:end -->

<!-- @einja:excluded:start -->  ← 原本のみ。テンプレートではgenerate-template.mjsが除去
## このリポジトリ限定の設定
...
<!-- @einja:excluded:end -->
```

**具体的な操作:**
- `# Claude Code 指示書` の直前に `<!-- @einja:managed:start id="claude-md-main" -->` を挿入
- 「図の記述ルール」を `project-private` ブロックから出す（managed内に移動）
- 「完了判定の基準」セクションの後（`@einja:excluded` の前）に `<!-- @einja:managed:end -->` を挿入
- `project-private` ブロックの中身を空テンプレートに変更:
  ```
  <!-- @einja:project-private:start id="claude-md-project" -->
  <!-- @einja:project-private:end -->
  ```

**注意**: 原本（`CLAUDE.md`）の `@einja:excluded` ブロック内容はそのまま維持。`templates/default/CLAUDE.md` では `generate-template.mjs` により除去済み。テンプレート側は**ビルド時に原本から自動生成**されるため、原本を修正すれば `pnpm --filter @einja-inc/cli build` でテンプレートも更新される。→ テンプレート側の手動修正は不要（ビルドで自動反映）

### templates/default/.claude/ について

`templates/default/.claude/` には `settings.json` と `rules/` のみ存在。agents/skills/hooks は `presets/default/` にのみ存在するため、syncでは配布されない。これは別課題（テンプレートディレクトリ統合）であり今回スコープ外。

今回同期されるようになるもの:
- `CLAUDE.md`（managed部分がsyncで更新される）← **主目的**
- `.claude/settings.json`
- `.claude/rules/**`

## タスク概要

| ID | タスク | 依存 | Skill/ツール |
|----|-------|------|-------------|
| 0-0 | TaskCreate でタスク登録 | - | [TaskCreate] |
| 0-1 | Planファイルを docs/plans/ に配置 | 0-0 | [Bash] |
| 1 | `SyncCategory` 型に `"claude"` を追加 | 0-1 | [Edit] |
| 2 | `CATEGORY_PATTERNS` に `claude` カテゴリ追加 | 0-1 | [Edit] |
| 3 | `CATEGORY_CONFIGS` に `claude` カテゴリ追加 | 0-1 | [Edit] |
| 4 | CLAUDE.md（原本）にマーカー構造を追加 | 0-1 | [Edit] |
| 5 | `pnpm --filter @einja-inc/cli build` でテンプレート再生成 | 4 | [Bash] |
| 99-1 | コードレビュー | 1,2,3,5 | [einja-review-code] |
| 99-2 | 動作確認（ビルド通過） | 99-1 | [Bash] |
| 99-G | コミット承認ゲート | 99-2 | [AskUserQuestion] |
| 99-3 | コミット・プッシュ | 99-G | [einja-task-commit] |

タスク1, 2, 3, 4 は並列実行可能（ファイルが異なる）。タスク5はタスク4完了後に実行。

## 並列実行計画

```
Phase 1: [タスク1] [タスク2] [タスク3] [タスク4]  ← 並列（4ファイルが独立）
Phase 2: [タスク5] CLIビルド（タスク4のマーカー変更をテンプレートに反映）
Phase 3: [99-1] コードレビュー
Phase 4: [99-2] ビルド確認（create-appも含む）
Phase 5: [99-G] → [99-3] コミット
```

## リスク・不明点

| リスク | 影響 | 対策 |
|-------|------|------|
| agents/skills/hooks がsyncで配布されない | 中 | 今回はCLAUDE.md + settings + rulesのみで許容。別PRで対応 |
| 既存プロジェクトでCLAUDE.mdが上書きされる | 低 | `@einja:managed` → テンプレート優先、`@einja:project-private` → ローカル保持 |
| 下流プロジェクトの既存CLAUDE.mdにマーカーがない | 低 | merger.tsの仕様上、マーカーなし既存ファイルはローカル優先。初回はovewriteモードで同期するか手動対応 |

## 検証・動作確認方法

1. `pnpm --filter @einja-inc/cli build` で CLIビルド通過を確認（テンプレート再生成）
2. `pnpm --filter @einja-inc/create-app build` で create-appビルド通過を確認
3. 生成された `templates/default/CLAUDE.md` に `@einja:managed:start id="claude-md-main"` マーカーが含まれ、`@einja:excluded` ブロックが除去されていることをgrepで確認
4. ビルド後のコードで `claude` カテゴリが `CATEGORY_PATTERNS`, `CATEGORY_CONFIGS`, `SyncCategory` に含まれることを grep で確認
