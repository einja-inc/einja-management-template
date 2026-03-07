---
description: "テンプレート同期を実行。dev-cli/create-einja-appのsyncをカテゴリ選択式で実行し、コンフリクトも自動解消します"
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob, Edit
---

# テンプレート同期コマンド

## コマンドの目的

`@einja/dev-cli sync` と `create-einja-app sync` をカテゴリ選択式で実行し、テンプレート更新をリポジトリに取り込む。コンフリクト発生時は対話的に解消する。

## 処理フロー

### Step 1: CLI検出

以下のコマンドで利用可能なCLIを検出する。

```bash
npx --no @einja/dev-cli --version 2>/dev/null
npx --no create-einja-app --version 2>/dev/null
```

| 検出結果 | 動作 |
|---------|------|
| 両方なし | エラーメッセージを表示して終了: `「@einja/dev-cli または create-einja-app が必要です。npm install @einja/dev-cli でインストールしてください。」` |
| dev-cli のみ | dev-cli カテゴリのみ表示 |
| create-einja-app のみ | create-app カテゴリのみ表示 |
| 両方あり | Step 2 の質問1で選択 |

### Step 2: カテゴリ選択（AskUserQuestion）

2段階で同期対象を選択する。

#### 質問1: 同期ソースの選択（両方利用可能な場合のみ）

```yaml
AskUserQuestion:
  question: "どのCLIで同期しますか？"
  header: "同期ソース選択"
  options:
    - label: "dev-cli のみ（Claude Code関連ファイル）"
      description: ".claude/ 配下のcommands, agents, skills, hooks、docs/einja/、.envrc、.vscode/settings.json"
    - label: "create-einja-app のみ（プロジェクトテンプレート）"
      description: "biome.json, .gitignore, .github/, Dockerfile, turbo.json, package.json 等のプロジェクト基盤ファイル"
    - label: "両方"
      description: "dev-cli → create-einja-app の順で両方実行（推奨）"
```

片方のみ利用可能な場合はこの質問をスキップする。

#### 質問2: カテゴリ選択

選択されたCLIに応じて、対象カテゴリを選択する。AskUserQuestion の options は最大4つまでのため、以下の形式で提示する。

```yaml
AskUserQuestion:
  question: "同期するカテゴリを選択してください"
  header: "カテゴリ選択"
  options:
    - label: "全カテゴリ（デフォルト推奨）"
      description: "apps, packages を除く全カテゴリを同期します。最も安全で推奨される選択です"
    - label: "カスタム選択（除外カテゴリを指定）"
      description: "特定のカテゴリを除外したい場合。次の入力で除外カテゴリをコンマ区切りで指定します"
```

**「カスタム選択」の場合**: 以下のカテゴリ一覧を表示し、除外したいカテゴリをコンマ区切りで入力してもらう。

**dev-cli カテゴリ一覧:**

| カテゴリ名 | 対象ファイル | デフォルト |
|-----------|-------------|-----------|
| `commands` | `.claude/commands/` | ON |
| `agents` | `.claude/agents/` | ON |
| `skills` | `.claude/skills/` | ON |
| `hooks` | `.claude/hooks/` | ON |
| `docs` | `docs/einja/` | ON |
| `env` | `.envrc` | ON |
| `tools` | `.vscode/settings.json` | ON |
| `claude-md` | `CLAUDE.md`, `AGENTS.md` | ON |
| `scripts` | `scripts/` | ON |
| `root-config` | `package.json`, `.mcp.json` | ON |
| `claude-config` | `.claude/settings.json` | ON |

**create-einja-app カテゴリ一覧:**

| カテゴリ名 | 対象ファイル | デフォルト |
|-----------|-------------|-----------|
| `env` | `.env*`, `.node-version` | ON |
| `tools` | `biome.json`, `.biomeignore`, `.vibe-kanban.json`, `.prettierrc`, `.editorconfig` | ON |
| `git` | `.gitignore`, `.gitattributes` | ON |
| `git-hooks` | `.husky/`, `.lintstagedrc.js` | ON |
| `github` | `.github/workflows/`, `.github/actions/` | ON |
| `docker` | `Dockerfile*`, `docker-compose*.yml` | ON |
| `monorepo` | `turbo.json`, `pnpm-workspace.yaml` | ON |
| `root-config` | `package.json`, `tsconfig.json`, `vitest.config.ts`, `postcss.config.cjs`, `next.config.ts`, `components.json`, `worktree.config.json` | ON |
| `scripts` | `scripts/` | ON |
| `docs` | `README.md`, `docs/` | ON |
| `apps` | `apps/**` | **OFF** |
| `packages` | `packages/**` | **OFF** |

> **重複に関する注意**: dev-cli の `tools` は `.vscode/settings.json` のみを管理し、create-einja-app の `tools` は `biome.json` 等を管理する。`.vscode/` 配下は dev-cli 側が管轄するため、create-einja-app の `tools` カテゴリでは `.vscode/` は対象外。

> **デフォルトOFFのカテゴリ**: `apps` と `packages` はデフォルトOFF。これらを同期に含めたい場合は、カスタム選択で明示的に追加する旨をユーザーに伝える（例: 「`+apps,+packages` のように `+` 付きで追加カテゴリを指定できます」）。

### Step 3: dry-run で差分プレビュー

選択されたカテゴリで dry-run を実行し、変更予定の差分をユーザーに表示する。

```bash
# dev-cli の場合
npx --yes @einja/dev-cli@latest sync --only <categories> --dry-run --yes

# create-einja-app の場合
npx --yes create-einja-app@latest sync --categories <categories> --dry-run
```

> **注**: 両CLIでカテゴリ指定のオプション名が異なる（dev-cli: `--only` / create-einja-app: `--categories`）

- `<categories>` はStep 2で選択されたカテゴリをコンマ区切りで渡す
- 差分がない場合は「変更はありません」と表示して該当CLIの処理をスキップ
- 差分がある場合はファイル一覧と変更内容をユーザーに提示

#### dev-cli 使用時: 孤児ファイルの事前検出

dry-run の JSON出力から `orphans` 配列を確認する。存在する孤児（`exists: true`）がある場合は一覧をテーブル表示し、Step 4 の確認時に孤児削除を含めるかユーザーに確認する。

### Step 4: 実行確認 → sync実行

差分プレビューと孤児ファイル情報を見せた上で、ユーザーに実行可否を確認する。

#### 孤児ファイルがない場合

```yaml
AskUserQuestion:
  question: "上記の変更を適用しますか？"
  header: "同期実行の確認"
  options:
    - label: "はい、実行する"
      description: "表示された差分の通りにファイルを更新します"
    - label: "いいえ、キャンセル"
      description: "変更を適用せずに終了します"
```

#### 孤児ファイルがある場合（dev-cli 使用時）

```yaml
AskUserQuestion:
  question: "上記の変更を適用しますか？（孤児ファイルN個を検出）"
  header: "同期実行の確認"
  options:
    - label: "孤児ファイルも削除して同期（推奨）"
      description: "表示された差分を適用し、テンプレートから削除されたファイル(N個)も削除します"
    - label: "孤児ファイルは残して同期"
      description: "表示された差分のみ適用し、孤児ファイルは残します"
    - label: "キャンセル"
      description: "変更を適用せずに終了します"
```

**実行順序**: dev-cli を先に実行し、次に create-einja-app を実行する（dev-cli が Claude Code 設定を先に更新するため）。

```bash
# dev-cli（孤児削除あり）
npx --yes @einja/dev-cli@latest sync --only <categories> --yes --json --clean

# dev-cli（孤児削除なし）
npx --yes @einja/dev-cli@latest sync --only <categories> --yes --json

# create-einja-app
npx --yes create-einja-app@latest sync --categories <categories>
```

- dev-cli は `--json` オプションで構造化出力を取得しパースする
- 孤児削除を選択した場合は `--clean` フラグを追加する（sync と孤児削除を1回の実行で完了）
- create-einja-app sync には `--yes` フラグがない。`--categories` 指定時でもプロジェクト設定検出失敗時や依存バージョン競合時に対話プロンプトが発生する可能性がある。その場合は標準出力を確認し、必要に応じてユーザーに手動対応を促す

### Step 5: コンフリクト検出 → 対話的解消（dev-cli のみ）

dev-cli の sync 固有のコンフリクトを検出し、1ファイルずつ対話的に解消する（git コンフリクトとは異なる）。create-einja-app にはファイルコンフリクトの概念がないため、このStepは dev-cli 使用時のみ実行する。

#### 5-1. コンフリクトファイル一覧取得

dev-cli の JSON出力の `files` 配列から `status === "conflict"` のエントリを抽出する。

- コンフリクトなし → このStepをスキップ
- コンフリクトファイル一覧をテーブル表示（ファイルパス、コンフリクト箇所数）
- JSON出力のパースに失敗した場合は、標準出力をそのまま表示し、同期対象カテゴリのファイルパスのみを対象に `Grep` で dev-cli 固有のコンフリクトマーカー `<<<<<<< LOCAL (your changes)` を検索して検出する（プロジェクト全体を検索しないこと）

#### 5-2. 各ファイルを1ファイルずつ処理

以下を各コンフリクトファイルについて繰り返す:

a. `Read` でファイル全体を読み込む
b. コンフリクトマーカーブロックを特定し、**双方の内容を分析・説明**:
   - ローカル側: 何がカスタマイズされているか（例: プロジェクト固有の設定値）
   - テンプレート側: 何が更新されたか（例: 新しいフィールド追加、バグ修正）
   - 影響の説明: どちらを採用した場合に何が起きるか
c. **具体的なマージ案を提案**: 両方の変更を分析し、統合案を作成（可能な場合）
d. AskUserQuestion で解消方法を確認:

```yaml
AskUserQuestion:
  question: "{ファイル名}のコンフリクト解消方法を選択してください"
  header: "コンフリクト解消"
  options:
    - label: "テンプレート優先"
      description: "テンプレートの内容を採用。メリット: 最新の更新を取り込める。デメリット: ローカルのカスタマイズが失われる"
    - label: "ローカル優先"
      description: "現在の内容を維持。メリット: カスタマイズを保全できる。デメリット: テンプレートの更新が適用されない"
    - label: "マージ案（両方の変更を統合）"
      description: "{具体的なマージ内容の説明}。メリット: {利点}。デメリット: {欠点}"
    - label: "このファイルをスキップ"
      description: "コンフリクトマーカーを残して後で手動解消。メリット: 判断を保留できる。デメリット: 後で対応が必要"
```

**重要**: 必ず1ファイルごとにAskUserQuestionを実行する。複数ファイルをまとめて質問しない。

e. 選択に応じて `Edit` でコンフリクトマーカーを解消する
   - 複数マーカーがある場合はファイル末尾側から処理し、行番号ずれを防止する
   - テンプレート優先: `<<<<<<< LOCAL` 〜 `=======` を削除し、`=======` 〜 `>>>>>>> TEMPLATE` のテンプレート側を残す
   - ローカル優先: `<<<<<<< LOCAL` のローカル側を残し、`=======` 〜 `>>>>>>> TEMPLATE` を削除する
   - マージ案: 提案したマージ内容でマーカーブロック全体を置換する
f. 解消結果を `Read` で確認し、ユーザーに表示

**コンフリクトマーカー形式**: `<<<<<<< LOCAL (your changes)` / `=======` / `>>>>>>> TEMPLATE (from @einja/cli)`

#### 5-3. 全ファイル解消後の検証

- `Grep` で `<<<<<<<` パターンを検索し、未解消マーカーが残っていないか検証
- スキップされたファイルがあれば一覧を再表示

### Step 6: 孤児ファイル処理結果の確認（dev-cli のみ）

Step 4 で孤児削除を選択した場合、JSON出力の `summary.orphansDeleted` を確認し、削除されたファイル一覧を記録する（Step 9 の詳細表示で使用）。

Step 4 で孤児削除をスキップした場合、孤児ファイル一覧を再表示し「後で `npx --yes @einja/dev-cli@latest sync --only <categories> --clean --yes` で削除できます」と案内する。

### Step 7: direnv allow 実行確認

`.envrc` が正常に更新された場合に `direnv allow` を実行する。

1. dev-cli の JSON出力の `files` 配列から `.envrc` のエントリを確認する
2. 以下の条件をすべて満たす場合のみ実行対象とする:
   - `.envrc` の `status` が `"success"` である（`"skipped"`, `"conflict"`, `"error"` は対象外）
   - ファイル内にコンフリクトマーカー（`<<<<<<< LOCAL`）が含まれていない
3. `command -v direnv` で direnv の存在を確認する（インストールされていなければスキップし、Step 8 で案内表示）
4. AskUserQuestion で確認:

```yaml
AskUserQuestion:
  question: ".envrc が更新されました。direnv allow を実行しますか？"
  header: "direnv allow"
  options:
    - label: "実行する（推奨）"
      description: "更新済み .envrc を有効化します。環境変数が即座に反映されます"
    - label: "スキップ"
      description: "後で手動で direnv allow を実行します"
```

5. 「実行する」選択時に `direnv allow` を実行
6. 結果を表示（成功/失敗。失敗しても同期処理全体は継続する）

### Step 8: 結果サマリー表示

テーブル形式で同期結果の概要を表示する。

```markdown
## 同期結果サマリー

| CLI | 成功 | スキップ | コンフリクト | 孤児削除 |
|-----|------|---------|------------|---------|
| dev-cli | 5 | 2 | 1 (解消済み) | 2 |
| create-einja-app | 8 | 3 | 0 | - |
| **合計** | **13** | **5** | **1** | **2** |
```

- `.envrc` が変更された場合は「✓ direnv allow 実行済み」を表示
- `.envrc` が変更されたが direnv 未インストールの場合は「⚠ direnv 未インストール。手動で `direnv allow` を実行してください」を表示

### Step 9: 結果詳細表示

各ファイルの詳細結果を以下の形式で表示する。

```markdown
### dev-cli sync 詳細
  ✓ .claude/commands/einja/task-exec.md (更新)
  ✓ .claude/skills/einja-task-commit/SKILL.md (更新)
  ⏭ .claude/agents/einja/task-executer.md (変更なし)
  ⚠ .claude/hooks/einja/pre-commit.sh (コンフリクト → 解消済み)
  🗑️ .claude/skills/old-skill/SKILL.md (孤児ファイル削除)

### create-einja-app sync 詳細
  ✨ .github/workflows/ci.yml (新規)
  ✓ biome.json (更新)
  ⏭ .gitignore (変更なし)
```

**アイコンの意味:**

| アイコン | 意味 |
|---------|------|
| ✓ | 更新成功 |
| ✨ | 新規ファイル追加 |
| ⏭ | 変更なし（スキップ） |
| ⚠ | コンフリクト発生（解消済み） |
| 🗑️ | 孤児ファイル削除 |

**パース方法:**
- dev-cli: `--json` 出力の `files` 配列をパースして各ファイルのステータスを表示。JSON形式が不正な場合は標準出力をそのまま表示
- create-einja-app: 標準出力から `✓` / `⚠️` / `スキップ` 行を抽出して表示。抽出できない場合は標準出力をそのまま表示

## 注意事項

- `npx` 経由で実行するため、利用者側に事前インストールは不要
- dev-cli は `.vscode/settings.json` を管理し、create-einja-app の `tools` カテゴリでは `.vscode/` 配下は対象外
- `apps` と `packages` カテゴリはデフォルト OFF。既存の実装コードを上書きするリスクがあるため、明示的な指定が必要
- コンフリクト解消は sync 固有のもので、git コンフリクトとは異なる。`einja-conflict-resolver` Skill は使用しない
- 両方のCLIを実行する場合、dev-cli を先に実行すること（Claude Code 設定が先に更新される必要があるため）

<!-- @einja:project-private:start id="einja-sync-project" -->
<!-- プロジェクト固有の情報を記入 -->
<!-- @einja:project-private:end -->
