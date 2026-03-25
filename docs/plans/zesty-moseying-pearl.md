# DOTENV_PRIVATE_KEY_* 未設定時のエラーハンドリング改善

## Context

下流リポジトリで `DOTENV_PRIVATE_KEY_PREVIEW` が GitHub Secrets に未設定のままPRを作成すると、`neon-and-schema` ジョブが不明瞭なエラーで失敗する。原因は3つ:

1. **einja-infra-maintenance Step 7（GitHub Secrets設定）がスキップ可** — セットアップ時に設定を飛ばせてしまう
2. **カテゴリ9（デプロイ検査）が提案のみ** — 未設定を検出しても自動修正しない
3. **GitHub Actionsのエラーメッセージが不親切** — dotenvx復号失敗時に「DOTENV_PRIVATE_KEY_* がGitHub Secretsに未設定」と明示しない

## 現状

### workflow-env-setup.md (Step 7)
- 行200: `スキップ可` — AskUserQuestionで「スキップしますか？」と聞いて飛ばせる
- `.env.keys` が存在すれば設定可能だが、ユーザーがスキップすると未設定のままデプロイ失敗

### category-9-deploy-inspection.md (Step 3)
- 行86-94: `DOTENV_PRIVATE_KEY_*` の設定有無を検査
- 行183: 「自動実行ではなく提案ベース」と明記 — 未設定を検出しても案内のみ

### GitHub Actions (.github/actions/neon-export-env/action.yml)
- 行22-23: `NEON_API_KEY` / `NEON_PROJECT_ID` が空の場合にエラー出力するが、根本原因（Secret未設定）を示さない
- `${{ secrets.DOTENV_PRIVATE_KEY_PREVIEW }}` が空文字列でもアクション自体は開始してしまう

### GitHub Actions (deploy-pr-preview.yml / deploy-stable-branches.yml)
- Secret未設定の事前チェックステップがない

## 変更内容

### 1. workflow-env-setup.md: Step 7 を条件付き必須に変更

**ファイル**: `.claude/skills/einja-infra-maintenance/references/workflow-env-setup.md`

- Step 7 を `スキップ可` → **`.env.keys` が存在する場合は必須**に変更
- `.env.keys` 存在時は **AskUserQuestionを出さずに必須実行**（スキップ選択肢を提示しない）
- `.env.keys` が存在しない場合のみスキップ可（その場合 `unexpected_events` に記録し、デプロイ時にSecret未設定エラーが発生する旨を警告）
- ステップ一覧テーブル（行53）とStep 7セクション（行198-208）を修正

### 2. category-9-deploy-inspection.md: 未設定検出時の自動修正

**ファイル**: `.claude/skills/einja-infra-maintenance/references/category-9-deploy-inspection.md`

- Step 3 の `DOTENV_PRIVATE_KEY_*` 未設定検出時:
  - `.env.keys` が存在する場合: `category-5-github-secrets.md` の Step 1（dotenvx秘密鍵自動抽出）と同じコマンドで自動設定を実行。ユーザー確認なし（検査で検出された明確な不足のため）
  - `.env.keys` が存在しない場合: 案内のみ（現状維持）— `.env.keys` を取得してからカテゴリ5で設定するよう誘導
- 行183 の「提案ベース」注記を更新: `DOTENV_PRIVATE_KEY_*` は `.env.keys` 存在時に限り自動修正。その他のSecrets（VERCEL_TOKEN等）は引き続き提案ベース

### 3. GitHub Actions: Secret未設定の早期検出

**技術的背景**: composite action の `required: true` は空文字列を実行時にバリデーションしない。`${{ secrets.XXX }}` が未設定の場合、空文字列が渡されるだけでエラーにならない。そのためシェルでの明示的チェックが必要。

**ファイル**: `.github/actions/neon-export-env/action.yml`

- `dotenvx run` の前にチェックステップを追加。`${{ inputs.dotenv-private-key-preview }}` をYAML expression構文で直接チェック（環境変数経由では検出できないため）:
  ```yaml
  - name: Validate DOTENV_PRIVATE_KEY_PREVIEW
    run: |
      if [ -z "${{ inputs.dotenv-private-key-preview }}" ]; then
        echo "::error::DOTENV_PRIVATE_KEY_PREVIEW が GitHub Secrets に設定されていません。"
        echo "::error::ローカル環境で以下を実行してください:"
        echo "::error::gh secret set DOTENV_PRIVATE_KEY_PREVIEW --body \"\$(grep DOTENV_PRIVATE_KEY_PREVIEW .env.keys | cut -d= -f2 | tr -d \\\"\\')\" "
        exit 1
      fi
    shell: bash
  ```

**ファイル**: `.github/actions/migrate/action.yml`

- `migrate/action.yml` は複数環境（preview/develop/staging/production）から呼ばれるため、エラーメッセージは環境非依存の汎用形にする:
  ```yaml
  - name: Validate dotenv private key
    run: |
      if [ -z "${{ inputs.dotenv-private-key }}" ]; then
        echo "::error::dotenv-private-key が渡されていません。GitHub Secrets に該当環境の DOTENV_PRIVATE_KEY_* が設定されているか確認してください。"
        echo "::error::設定方法: gh secret set DOTENV_PRIVATE_KEY_<ENV> --body \"<.env.keysから取得した値>\""
        exit 1
      fi
    shell: bash
  ```

## タスク概要

| ID | タスク | 使用ツール | 依存 |
|----|--------|-----------|------|
| 0-0 | タスク登録 [TaskCreate] | TaskCreate | - |
| 0-1 | Planファイル配置 [Bash] | Bash (mv) | - |
| 1 | workflow-env-setup.md 修正: Step 7 を条件付き必須に [Edit] | general-purpose | - |
| 2 | category-9-deploy-inspection.md 修正: 自動修正追加 [Edit] | general-purpose | - |
| 3 | neon-export-env/action.yml 修正: Secret空チェック追加 [Edit] | general-purpose | - |
| 4 | migrate/action.yml 修正: Secret空チェック追加 [Edit] | general-purpose | - |
| 99-1 | コードレビュー [einja-review-code] | einja-review-code | 1,2,3,4 |
| 99-G | コミット承認ゲート [AskUserQuestion] | AskUserQuestion | 99-1 |
| 99-3 | コミット・プッシュ [einja-task-commit] | einja-task-commit | 99-G |

## 並列実行計画

- タスク1, 2 は並列実行可（Skillファイル同士で依存なし）
- タスク3, 4 は並列実行可（別ファイル）
- タスク1-4 はすべて並列実行可

## リスク・不明点

- deploy-stable-branches.yml でも同様の早期チェックが必要か？ → `neon-export-env` と `migrate` アクション内でチェックするため、呼び出し元ワークフローの修正は不要
- `.env.keys` が存在しない状態でカテゴリ9が実行された場合 → 案内のみで自動修正しない（現状と同じ）

## 検証・動作確認方法

1. 各修正ファイルの構文・整合性を目視確認
2. `pnpm prepush`（lint/typecheck/test）が通ること
3. GitHub Actions のYAMLが有効であること（actionlintがあれば実行）
