# Plan: `/sync` コマンドの作成

## Context

利用者が別リポジトリでテンプレート更新を取り込む際、`npx @einja/dev-cli sync` と `npx create-einja-app sync` を手動実行する必要がある。これを Claude Code コマンド一発で選択式に実行できるようにする。

## 作成ファイル

**`.claude/commands/einja/sync.md`** — 1ファイルのみ

## コマンド仕様

### フロントマター

```yaml
---
description: "テンプレート同期を実行。dev-cli/create-einja-appのsyncをカテゴリ選択式で実行し、コンフリクトも自動解消します"
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob
---
```

### 処理フロー

#### Step 1: CLI検出

```bash
npx @einja/dev-cli --version 2>/dev/null
npx create-einja-app --version 2>/dev/null
```

- 両方なし → エラー終了
- 片方のみ → そちらだけ使用
- 両方あり → 両方利用可能として進む

#### Step 2: カテゴリ選択（AskUserQuestion）

利用可能なCLIに応じて、**2段階**で選択肢を提示。

**質問1: 同期ソースの選択**（両方利用可能な場合のみ）
- dev-cli のみ（Claude Code関連ファイル）
- create-einja-app のみ（プロジェクトテンプレート）
- 両方

**質問2: カテゴリ選択**（multiSelect=true）

dev-cli と create-einja-app のカテゴリは**明確に区別して表示**する。

| 表示名 | CLI | 対象 | デフォルト |
|--------|-----|------|-----------|
| [dev-cli] commands | dev-cli | `.claude/commands/` | ON |
| [dev-cli] agents | dev-cli | `.claude/agents/` | ON |
| [dev-cli] skills | dev-cli | `.claude/skills/` | ON |
| [dev-cli] hooks | dev-cli | `.claude/hooks/` | ON |
| [dev-cli] docs | dev-cli | `docs/einja/` | ON |
| [dev-cli] env | dev-cli | `.envrc` | ON |
| [dev-cli] tools | dev-cli | `.vscode/settings.json` | ON |
| [create-app] env | create-app | `.env*`, `.node-version` | ON |
| [create-app] tools | create-app | `biome.json`, `.prettierrc`, `.editorconfig` | ON |
| [create-app] git | create-app | `.gitignore`, `.gitattributes` | ON |
| [create-app] git-hooks | create-app | `.husky/` | ON |
| [create-app] github | create-app | `.github/workflows/`, `.github/actions/` | ON |
| [create-app] docker | create-app | `Dockerfile*`, `docker-compose*.yml` | ON |
| [create-app] monorepo | create-app | `turbo.json`, `pnpm-workspace.yaml` | ON |
| [create-app] root-config | create-app | `package.json`, `tsconfig.json` | ON |
| [create-app] scripts | create-app | `scripts/` | ON |
| [create-app] docs | create-app | `README.md`, `docs/` | ON |
| [create-app] apps | create-app | `apps/**` | **OFF** |
| [create-app] packages | create-app | `packages/**` | **OFF** |

> **重複に関する注意**: dev-cli の `tools` は `.vscode/settings.json` のみ、create-app の `tools` は `biome.json` 等。`.vscode/` 配下は dev-cli 側が管理するため、create-app 側の tools から `.vscode/` を除外する旨を説明に含める。

#### Step 3: dry-run で差分プレビュー

選択されたカテゴリで dry-run を実行し、差分をユーザーに表示。

```bash
# dev-cli
npx @einja/dev-cli sync --only <categories> --dry-run --yes

# create-einja-app
npx create-einja-app sync --categories <categories> --dry-run
```

#### Step 4: 実行確認 → sync実行

差分プレビューを見せた上で、ユーザーに実行可否を確認。

**実行順序: dev-cli → create-einja-app**（dev-cliがClaude Code設定を先に更新）

```bash
# dev-cli
npx @einja/dev-cli sync --only <categories> --yes --json

# create-einja-app
npx create-einja-app sync --categories <categories>
```

dev-cli は `--json` で構造化出力を取得しパース。

#### Step 5: コンフリクト検出 → 手動解消サポート

- dev-cli: JSON出力の `status: "partial_success"` + `conflicts > 0` で検出
- create-einja-app: 出力の「コンフリクト」文字列で検出

**コンフリクト時の対応**（sync固有のコンフリクトはgitコンフリクトとは異なる）:
1. コンフリクトファイルの一覧を表示
2. 各ファイルの差分内容を `Read` で確認
3. ユーザーに解決方針を確認（テンプレート優先 / ローカル優先 / 手動マージ）
4. 方針に従って `Edit` で解消

#### Step 6: 結果サマリー表示

| 項目 | dev-cli | create-einja-app |
|------|---------|------------------|
| 成功 | N件 | N件 |
| スキップ | N件 | N件 |
| コンフリクト | N件 | N件 |

#### Step 7: 結果詳細表示

サマリーの後に、各ファイルの詳細結果を表示。

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

- dev-cli: `--json` 出力の `files` 配列をパースして表示
- create-einja-app: 標準出力から `✓` / `⚠️` / `スキップ` 行を抽出して表示

## 実装の注意点

- コマンドはマークダウンプロンプト（Claude Codeへの指示書）として書く
- 実際のロジックはClaude Codeが解釈して実行する
- `npx` 経由で実行（利用者側にインストール不要）
- create-einja-app sync には `--yes` がないが、`--categories` 指定時は対話プロンプトをスキップする
- `.vscode/` の重複管理: dev-cli 側で管理。create-app の tools を選択してもClaude Codeが `.vscode/` 以外のファイルのみ対象とする旨を指示

## 検証方法

1. `.claude/commands/einja/sync.md` が正しいフロントマター形式であること
2. このリポジトリで `/sync` を実行し、フローが正常に動作すること（CLI検出 → カテゴリ選択 → dry-run → 実行）
3. ビルド時に `presets/default/.claude/commands/einja/sync.md` へ自動コピーされること（既存のcopy-presets.mjsで対応済み）
