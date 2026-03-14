# sync Skill 全面改善

## Context

`einja-dev:sync` Skill（`/Users/kzp/code/GitHub/einja-inc/einja-skills/plugins/einja-dev/skills/sync/SKILL.md`）に20の問題が判明。CLI実装との乖離、大原則違反（ユーザーに技術操作を要求）、エラーハンドリング欠如、既存PJ対応の不備を全て修正する。

## 現状

- Skillファイル: `/Users/kzp/code/GitHub/einja-inc/einja-skills/plugins/einja-dev/skills/sync/SKILL.md`
- 対象CLIは2つ: `@einja-inc/dev-cli sync`（10カテゴリ）と `@einja-inc/create-app sync`（12カテゴリ）
- SKILL.mdのフラグ・カテゴリ・エラー処理が実装と多数乖離

## 変更内容

SKILL.md を全面書き換え。以下20問題を修正する。

### Critical: CLI実装との乖離（4件）

| # | 問題 | 対応 |
|---|------|------|
| 1 | `npx --no` フラグが不正 | CLI検出を `npx --yes @einja-inc/dev-cli@latest --version` に変更 |
| 2 | create-appの `--force`, `--rollback`, `--backup`, `--all` 未文書化 | フラグ一覧テーブルに全フラグを正確に記載 |
| 3 | create-appに `--yes` フラグが存在しない | `--categories` 指定でプロンプトスキップする設計に変更。`--yes` 参照を全削除 |
| 4 | カテゴリリスト不完全 | dev-cli 10種、create-app 12種の完全リストを `VALID_CATEGORIES`/`CATEGORY_CONFIGS` から転記 |

### High: 大原則違反（4件）

| # | 問題 | 対応 |
|---|------|------|
| 5 | .npmrc手動設定をユーザーに要求 | Agentが自動設定。トークンない場合のみAskUserQuestionで入力依頼→Agent書き込み |
| 6 | CLI未検出時にnpm installコマンド提示 | `npx --yes` で自動DL実行する方式に統一。ローカルインストール不要 |
| 7 | 孤児スキップ時にCLIコマンド提示 | syncコマンドでは常に孤児削除する（`--clean`を常時付与）。スキップ選択肢自体を除去 |
| 8 | カテゴリ名が技術的すぎる | 日本語ラベル主体（例: `agents` → "Claude Code エージェント"）、技術名はカッコ併記 |

### High: エラーハンドリング欠如（5件）

| # | 問題 | 対応 |
|---|------|------|
| 9 | dry-run失敗時の分岐未定義 | exit code確認→stderrを表示し「リトライ/キャンセル」の選択肢提示 |
| 10 | ネットワーク/認証エラー未対応 | stderr監視。認証エラー→.npmrcトークン再確認案内。ネットワーク→リトライ提案 |
| 11 | 部分失敗時のロールバック案内なし | dev-cli: partial_success時にコンフリクト一覧表示。create-app: `--rollback`案内 |
| 12 | gitリポジトリ外チェックなし | Step 0に `git rev-parse --git-dir` チェック追加 |
| 13 | npxコマンド自体の失敗 | exit code + stderrでトラブルシューティング手順表示 |

### Medium: 既存PJ対応（3件）

| # | 問題 | 対応 |
|---|------|------|
| 14 | 非create-appプロジェクトのシナリオ未記述 | 「既存プロジェクトへの適用」セクション新設。dev-cliのみで段階的に開始を推奨 |
| 15 | 危険カテゴリへの警告なし | `root-config`, `apps`, `packages` 選択時にAskUserQuestionで確認 |
| 16 | .einja-sync.json不在時の説明なし | 初回sync判定ロジックと挙動を明記 |

### Medium: その他（4件）

| # | 問題 | 対応 |
|---|------|------|
| 17 | create-appバックアップ/ロールバック未案内 | Step 4にバックアップ情報、失敗時のロールバック手順を追記 |
| 18 | create-app conflictStrategy未説明 | デフォルト`merge`使用を明記 |
| 19 | create-app Git未コミットチェック未記述 | Step 0に追加。`--force`バイパスも説明 |
| 20 | dev-cli `--skip-deps`未説明 | Agent経由では`--skip-deps`を常時付与する設計に |

## 新フロー設計

```
Step 0: 前提条件チェック（新規）
  ├─ gitリポジトリ確認
  ├─ 未コミット変更チェック（create-app使用時は警告）
  ├─ .npmrc設定確認 → 不足時はAgentが自動設定
  └─ .einja-sync.json存在確認 → 初回sync判定

Step 1: CLI利用可能性確認（npx --yes方式に変更）

Step 2: 同期ソース・カテゴリ選択
  ├─ 質問1: 同期ソース選択
  ├─ 質問2: カテゴリ選択（日本語ラベル主体）
  └─ 危険カテゴリ選択時の警告

Step 3: dry-run差分プレビュー（エラーハンドリング追加）

Step 4: 実行確認 → sync実行（バックアップ/ロールバック案内追加）

Step 5: コンフリクト対話解消（dev-cliのみ、既存踏襲）

Step 6: 孤児ファイル処理（CLIコマンド案内削除）

Step 7: direnv allow（既存踏襲）

Step 8-9: 結果サマリー・詳細（既存踏襲）
```

## タスク概要

| ステップ | 作業 | 委託先 |
|---------|------|--------|
| 1 | create-appに `--yes` フラグ追加（CLI実装変更） | `general-purpose` サブエージェント |
| 2 | SKILL.md全面書き換え（19問題すべて反映） | `general-purpose` サブエージェント |
| 3 | 書き換え結果のレビュー | `einja-review-code` Skill |

## 並列実行計画

- ステップ1と2は**並列実行可能**（SKILL.mdはCLI側の新フラグを前提に書くが、ファイルが別リポジトリで独立）
- ステップ3はステップ1,2完了後

## create-app `--yes` フラグ追加の実装詳細

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/create-app/src/types/index.ts` L107 | `SyncOptions` に `yes?: boolean` 追加 |
| `packages/create-app/src/cli.ts` L47-48間 | `.option("-y, --yes", "確認プロンプトをスキップ")` 追加 |
| `packages/create-app/src/cli.ts` L50型定義 | `yes?: boolean` 追加 |
| `packages/create-app/src/cli.ts` L57-64 | `syncCommand()` 呼び出しに `yes` 追加 |
| `packages/create-app/src/commands/sync.ts` L155-186 | `--yes` 時にカテゴリ選択プロンプトスキップ（`--all` と同じパスへ） |
| `packages/create-app/src/commands/sync.ts` L205-247 | `--yes` 時にプロジェクト設定検出失敗でエラー終了 |
| `packages/create-app/src/commands/sync.ts` L22-60 | `handleInterrupt` に `yes` フラグを渡す設計変更 |

### 対話プロンプト3箇所の `--yes` 時挙動

| プロンプト | 場所 | `--yes` 時の挙動 |
|-----------|------|----------------|
| カテゴリ選択 | `promptSyncCategories()` | `--all` と同じ動作（全カテゴリ、conflictStrategy=merge） |
| プロジェクト設定入力 | `detectProjectConfig()` 失敗時 | エラー終了（必須情報のためスキップ不可） |
| Ctrl+C ロールバック確認 | `handleInterrupt()` | 自動ロールバック（`true`） |

## CLIフラグ正確版（参照用）

### dev-cli

| フラグ | 省略 | 型 | デフォルト | 説明 |
|--------|------|-----|-----------|------|
| `--only` | `-o` | string | — | カンマ区切りカテゴリ指定 |
| `--dry-run` | `-d` | boolean | false | 差分表示のみ |
| `--force` | `-f` | boolean | false | ローカル変更無視で強制上書き |
| `--yes` | `-y` | boolean | false | 確認プロンプトスキップ |
| `--json` | `-j` | boolean | false | JSON出力 |
| `--clean` | — | boolean | false | 孤児ファイル削除 |
| `--skip-deps` | — | boolean | false | 依存チェックスキップ |

カテゴリ: `agents, skills, hooks, docs, scripts, env, tools, claude-md, root-config, claude-config`

### create-app

| フラグ | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| `--categories` | string | — | カンマ区切りカテゴリ指定 |
| `--all` | boolean | false | 全カテゴリ同期 |
| `--dry-run` | boolean | false | プレビューのみ |
| `--backup` | boolean | **true** | バックアップ作成。`--no-backup`で無効化 |
| `--rollback` | boolean | false | 直前バックアップから復元 |
| `--force` | boolean | false | Git未コミットチェックバイパス |

カテゴリ: `env, tools, git, git-hooks, github, docker, monorepo, root-config, scripts, apps, packages, docs`

> **`--yes` は存在しない**。`--categories` 指定でカテゴリ選択プロンプトスキップ。

## リスク・不明点

| リスク | 対策 |
|--------|------|
| create-appの対話プロンプト（conflictStrategy等）がAgent経由で制御不能 | `--categories` 指定 + Bashのstdin制御で対応。最悪の場合はユーザーに対話操作を委ねる |
| .npmrc自動書き込みがセキュリティリスク | トークン値はユーザー入力のみ。Agentが勝手にトークンを生成しない |
| 作業対象がeinja-skillsリポジトリ | einja-management-template内ではなく別リポジトリのファイルを編集する点に注意 |

## 検証・動作確認方法

1. SKILL.mdの全文を `Read` で確認し、20問題すべてが反映されていることを検証
2. CLIフラグ・カテゴリが実装コードと一致することをクロスチェック
3. エラーハンドリングの分岐が網羅されていることを確認

## 参照ファイル

- `/Users/kzp/code/GitHub/einja-inc/einja-skills/plugins/einja-dev/skills/sync/SKILL.md` — 書き換え対象
- `packages/cli/src/cli.ts` — dev-cli フラグ定義
- `packages/cli/src/lib/sync/category-validator.ts` — dev-cli カテゴリ定義
- `packages/cli/src/lib/sync/file-filter.ts` — dev-cli ファイルマッピング
- `packages/cli/src/commands/sync.ts` — dev-cli sync本体
- `packages/create-app/src/cli.ts` — create-app フラグ定義
- `packages/create-app/src/generators/sync.ts` — create-app カテゴリ定義
- `packages/create-app/src/prompts/sync.ts` — create-app UIラベル
- `packages/create-app/src/utils/backup.ts` — バックアップ/ロールバック実装
