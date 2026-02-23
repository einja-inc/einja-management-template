---
description: "テンプレート同期を実行。dev-cli/create-einja-appのsyncをカテゴリ選択式で実行し、コンフリクトも自動解消します"
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob
---

# テンプレート同期コマンド

## コマンドの目的

`@einja/dev-cli sync` と `create-einja-app sync` をカテゴリ選択式で実行し、テンプレート更新をリポジトリに取り込む。コンフリクト発生時は対話的に解消する。

## 処理フロー

### Step 1: CLI検出

以下のコマンドで利用可能なCLIを検出する。

```bash
npx @einja/dev-cli --version 2>/dev/null
npx create-einja-app --version 2>/dev/null
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

**create-einja-app カテゴリ一覧:**

| カテゴリ名 | 対象ファイル | デフォルト |
|-----------|-------------|-----------|
| `env` | `.env*`, `.node-version` | ON |
| `tools` | `biome.json`, `.prettierrc`, `.editorconfig`（※ `.vscode/` はdev-cli管理のため除外） | ON |
| `git` | `.gitignore`, `.gitattributes` | ON |
| `git-hooks` | `.husky/` | ON |
| `github` | `.github/workflows/`, `.github/actions/` | ON |
| `docker` | `Dockerfile*`, `docker-compose*.yml` | ON |
| `monorepo` | `turbo.json`, `pnpm-workspace.yaml` | ON |
| `root-config` | `package.json`, `tsconfig.json` | ON |
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
npx @einja/dev-cli sync --only <categories> --dry-run --yes

# create-einja-app の場合
npx create-einja-app sync --categories <categories> --dry-run
```

> **注**: 両CLIでカテゴリ指定のオプション名が異なる（dev-cli: `--only` / create-einja-app: `--categories`）

- `<categories>` はStep 2で選択されたカテゴリをコンマ区切りで渡す
- 差分がない場合は「変更はありません」と表示して該当CLIの処理をスキップ
- 差分がある場合はファイル一覧と変更内容をユーザーに提示

### Step 4: 実行確認 → sync実行

差分プレビューを見せた上で、ユーザーに実行可否を確認する。

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

**実行順序**: dev-cli を先に実行し、次に create-einja-app を実行する（dev-cli が Claude Code 設定を先に更新するため）。

```bash
# dev-cli
npx @einja/dev-cli sync --only <categories> --yes --json

# create-einja-app
npx create-einja-app sync --categories <categories>
```

- dev-cli は `--json` オプションで構造化出力を取得しパースする
- create-einja-app sync には `--yes` フラグがないが、`--categories` 指定時は対話プロンプトをスキップする

### Step 5: コンフリクト検出 → 手動解消サポート

sync 固有のコンフリクトを検出し、対話的に解消する（git コンフリクトとは異なる）。

#### コンフリクトの検出方法

| CLI | 検出方法 |
|-----|---------|
| dev-cli | JSON出力の `status: "partial_success"` かつ `conflicts > 0` |
| create-einja-app | 標準出力に「コンフリクト」文字列が含まれる |

#### コンフリクト解消フロー

1. **コンフリクトファイルの一覧を取得・表示**
   - dev-cli: JSON出力の `conflicts` 配列からファイルパスを抽出
   - create-einja-app: 標準出力から「コンフリクト」を含む行を抽出し、ファイルパスをパース
   - 取得したファイルパスを表形式で一覧表示

2. **各ファイルの差分内容を確認**
   - `Read` ツールでコンフリクトファイルの内容を読み込み、差分をユーザーに提示

3. **ユーザーに解決方針を確認**

```yaml
AskUserQuestion:
  question: "コンフリクトの解決方針を選択してください"
  header: "コンフリクト解決"
  options:
    - label: "テンプレート優先（リモートの最新版で上書き）"
      description: "テンプレートの内容を採用し、ローカルのカスタマイズを破棄します"
    - label: "ローカル優先（現在の内容を維持）"
      description: "現在のローカルファイルを維持し、テンプレートの変更を破棄します"
    - label: "手動マージ（1ファイルずつ確認）"
      description: "各ファイルの差分を確認しながら、手動でマージ内容を決定します"
```

4. **方針に従って解消**
   - テンプレート優先: dry-run出力やCLIのコンフリクト情報からテンプレート側の内容を特定し、`Edit` ツールで上書き
   - ローカル優先: 現在の内容を維持（変更なし）
   - 手動マージ: テンプレート内容とローカル内容を両方表示し、ユーザーと対話しながら `Edit` で編集

### Step 6: 結果サマリー表示

テーブル形式で同期結果の概要を表示する。

```markdown
## 同期結果サマリー

| CLI | 成功 | スキップ | コンフリクト |
|-----|------|---------|------------|
| dev-cli | 5 | 2 | 1 (解消済み) |
| create-einja-app | 8 | 3 | 0 |
| **合計** | **13** | **5** | **1** |
```

### Step 7: 結果詳細表示

各ファイルの詳細結果を以下の形式で表示する。

```markdown
### dev-cli sync 詳細
  ✓ .claude/commands/einja/task-exec.md (更新)
  ✓ .claude/skills/einja-coding-standards/SKILL.md (更新)
  ⏭ .claude/agents/einja/task-executer.md (変更なし)
  ⚠ .claude/hooks/einja/pre-commit.sh (コンフリクト → 解消済み)

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

**パース方法:**
- dev-cli: `--json` 出力の `files` 配列をパースして各ファイルのステータスを表示。JSON形式が不正な場合は標準出力をそのまま表示
- create-einja-app: 標準出力から `✓` / `⚠️` / `スキップ` 行を抽出して表示。抽出できない場合は標準出力をそのまま表示

## 注意事項

- `npx` 経由で実行するため、利用者側に事前インストールは不要
- dev-cli は `.vscode/settings.json` を管理し、create-einja-app の `tools` カテゴリでは `.vscode/` 配下は対象外
- `apps` と `packages` カテゴリはデフォルト OFF。既存の実装コードを上書きするリスクがあるため、明示的な指定が必要
- コンフリクト解消は sync 固有のもので、git コンフリクトとは異なる。`einja-conflict-resolver` Skill は使用しない
- 両方のCLIを実行する場合、dev-cli を先に実行すること（Claude Code 設定が先に更新される必要があるため）
