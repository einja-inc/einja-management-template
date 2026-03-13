# Plan: syncコマンドの `.claude/` 系カテゴリが `.gitignore` で除外される問題の修正

## Context

`npx @einja-inc/dev-cli sync` を実行しても `.claude/skills/` と `.claude/agents/` 配下に einja 標準の Skill やサブエージェントがコピーされない問題が報告された。

利用者プロジェクト `/Users/kzp/code/GitHub/einja-inc/MDB_Digital_Search_demo` の `.gitignore` に以下の記述がある：
```
# claude
.claude/
```

この記述により、`sync` コマンドが `.claude/` 配下のすべてのファイルを除外してしまう。

## 現状

### バグの再現フロー

1. `FileFilter` クラスが `scanSyncTargets()` 内で `loadGitignore()` を呼び出す
2. `loadGitignore()` は **利用者プロジェクト（`cwd`）の `.gitignore`** を読み込む
3. `shouldExclude()` で各ファイルパスを `.gitignore` にマッチするか確認する
4. 利用者プロジェクトの `.gitignore` に `.claude/` が記載されている場合、`agents`/`skills`/`hooks`/`claude-config` カテゴリのすべてのファイルが除外される

```typescript
// file-filter.ts L315-L328
private async loadGitignore(): Promise<void> {
  const gitignorePath = path.join(this.projectRoot, ".gitignore"); // ← 利用者プロジェクト側
  ...
  this.ignoreFilter = ignore().add(content); // ← これをテンプレート側のパスに適用してしまう
}

// L221
if (this.ignoreFilter?.ignores(filePath)) { // ← ".claude/agents/..." がマッチして除外される
  return true;
}
```

### 影響を受けるカテゴリ

| カテゴリ | テンプレートパス | .gitignore影響 |
|---------|---------------|--------------|
| `agents` | `.claude/agents/einja/` | `.claude/` でマッチ → 除外 |
| `skills` | `.claude/skills/` | `.claude/` でマッチ → 除外 |
| `hooks` | `.claude/hooks/` | `.claude/` でマッチ → 除外 |
| `claude-config` | `.claude/settings.json` | `.claude/` でマッチ → 除外（ただし別コードパス） |
| `docs` | `docs/einja/` | 影響なし |
| `tools` | `.vscode/settings.json` | 影響なし |

### `--clean` オプションの追加被害

- `--clean --yes` を指定すると、孤児（メタデータにあるが currentTemplateFiles にないファイル）が自動削除される
- `agents`/`skills`/`hooks` が 0件検出されるため、過去に sync 管理された `.claude/` 系ファイルが孤児として削除される
- これが「agents/ → specs, task のみ」「skills/ → frontend-design のみ」残存の原因

### なぜ `claude-config` は残ったか

`claude-config` カテゴリ（`.claude/settings.json`）は `scanSyncTargets` 内の別コードパス（117-131行）で処理され、`shouldExclude` を通らないため生き残っている。

### presets/default の実在確認

コピー元は正常に存在する：
- `packages/cli/presets/default/.claude/agents/einja/` - 17ファイル
- `packages/cli/presets/default/.claude/skills/` - 31ディレクトリ（einja-/_einja-）

## 変更内容

### 推奨アプローチ: `.gitignore` の適用を sync では無効化する

`shouldExclude()` から `.gitignore` チェックを削除し、sync 管理ファイルは gitignore に関わらず常にコピー対象とする。

**理由**: sync の目的は「テンプレートリポジトリから利用者プロジェクトへファイルを配布すること」であり、利用者の `.gitignore` 設定は配布の阻害要因にならないべき。`.claude/` を gitignore している利用者でも sync は機能すべき。

### 対象ファイル

- `packages/cli/src/lib/sync/file-filter.ts`
  - `loadGitignore()` メソッドを削除（または非活性化）
  - `shouldExclude()` から `.gitignore` チェックのロジックを削除
  - `ignoreFilter` フィールドを削除
  - `scanSyncTargets()` から `await this.loadGitignore()` の呼び出しを削除
- `packages/cli/src/lib/sync/file-filter.test.ts`
  - `.gitignore` 関連テストを更新（gitignore が無視されることを検証するテストに変更）

### 変更の詳細

#### `file-filter.ts` の変更

```typescript
// 削除する箇所:
// - private ignoreFilter: ReturnType<typeof ignore> | null = null; (フィールド)
// - import ignore from "ignore"; (インポート)
// - await this.loadGitignore(); (scanSyncTargets内)
// - if (this.ignoreFilter?.ignores(filePath)) { return true; } (shouldExclude内)
// - loadGitignore() メソッド全体
```

#### 影響範囲の確認

- `_` プレフィックスファイル除外・バイナリ除外・追加パターン除外は引き続き有効
- `.gitignore` チェックのみを取り除く
- テストファイルの更新が必要（gitignore テストケースが変わる）

## タスク概要

- **タスク0-0**: Planファイルを `docs/plans/202603/20260313-fix-sync-gitignore.plan.md` にリネーム
- **タスク1**: `file-filter.ts` から gitignore 関連ロジックを削除 [frontend-coder / backend-architect]
- **タスク2**: `file-filter.test.ts` の gitignore 関連テストを更新 [frontend-coder]
- **タスク3**: 手動動作確認（`--dry-run` で 0件→正常件数に変化することを確認）
- **タスク99-1**: コードレビュー [einja-review-code]
- **タスク99-G**: コミット承認ゲート [AskUserQuestion]
- **タスク99-3**: コミット・プッシュ [einja-task-commit]

## 並列実行計画

- タスク1・2は同一ファイルへの変更のため逐次実行
- タスク3はタスク1・2完了後に実行

## リスク・不明点

### 検討事項: `_` プレフィックスファイルの除外ルール

現在 `shouldExclude()` には以下の除外ロジックがある：
```typescript
if (fileName.startsWith("_")) {
  return true;
}
```

この `_` 除外ルールは `.gitignore` とは独立しているため影響なし。

### `ignore` ライブラリの依存

`ignore` パッケージが `file-filter.ts` のみで使われているか確認が必要。他で使われていなければ `package.json` の依存からも削除できる（任意）。

### テストの更新範囲

`.gitignore` 関連のテストケースが存在する場合、削除または「gitignore を尊重しない」ことを検証するテストに変更する。

## 検証・動作確認方法

1. `packages/cli` のユニットテストを実行: `pnpm --filter @einja-inc/dev-cli test`
2. 利用者プロジェクトで `--dry-run` 実行して件数を確認:
   ```bash
   cd /Users/kzp/code/GitHub/einja-inc/MDB_Digital_Search_demo
   npx @einja-inc/dev-cli sync --only agents,skills --dry-run
   # → 0ファイルではなく正常な件数が表示されること
   ```
3. 実際に sync を実行して `.claude/agents/einja/` と `.claude/skills/einja-*/` が作成されること
