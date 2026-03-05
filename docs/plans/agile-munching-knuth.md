# Plan: create-einja-app を Claude Code から実行可能にする

## Context

`create-einja-app` CLI は inquirer v12 による対話的プロンプトを使用しているため、Claude Code の Bash ツール（非対話実行のみ）からは実行できない。AskUserQuestion で回答を収集し、CLI 引数として渡す方式で解決する。

**2段階の実装:**
1. CLI に非対話モード（全パラメータの CLI 引数化）を追加
2. Claude Code コマンドを作成し、AskUserQuestion → CLI 引数変換の仲介を行う

## スコープ

- `create` コマンドのみ（`sync` コマンドは対象外 — 既に `einja:einja-sync` Skill が存在）
- 既存の対話モードは完全に維持（後方互換）

---

## Step 1: `CliConfigOverrides` 型の追加

**ファイル:** `packages/create-einja-app/src/types/index.ts`

```typescript
export type CliConfigOverrides = {
  packageScope?: string;
  authMethod?: "default" | "none";
  setupEinjaCli?: boolean;
  useCurrentDir?: boolean;
  postgresPort?: number;
  containerName?: string;
  appId?: string;
  portRangeStart?: number;
  rangeSize?: number;
};
```

## Step 2: commander オプション追加

**ファイル:** `packages/create-einja-app/src/cli.ts`

既存の `--skip-git`, `--skip-install` に加えて以下を追加:

| フラグ | 説明 |
|--------|------|
| `-y, --yes` | 非対話モード（デフォルト値使用） |
| `--scope <scope>` | パッケージスコープ |
| `--auth <method>` | 認証方式: `default` \| `none` |
| `--no-einja-cli` | einja CLI セットアップをスキップ |
| `--use-current-dir` | カレントディレクトリに展開 |
| `--postgres-port <port>` | PostgreSQL ポート |
| `--container-name <name>` | Docker コンテナ名 |
| `--app-id <id>` | アプリ ID |
| `--port-range-start <port>` | ポート範囲開始 |
| `--range-size <size>` | ポート範囲サイズ |

## Step 3: `create.ts` の 3 パターン分岐

**ファイル:** `packages/create-einja-app/src/commands/create.ts`

### 3.1 `CreateOptions` 拡張

CLI引数の全フィールドを受け取れるよう拡張。

### 3.2 `validateCliOverrides()` 追加

CLI 引数のバリデーション（scope 正規表現、auth 値チェック、ポート番号範囲）。エラー時は `process.exit(1)`。

### 3.3 メインフロー変更

```
options.yes → パターンA: 完全非対話（デフォルト + overrides）
overrides あり → パターンB: 部分指定（未指定フィールドのみ対話）
それ以外 → パターンC: 完全対話（従来通り）
```

### 3.4 `buildConfigWithDefaults()` 追加

`--yes` 時にデフォルト値 + overrides から `ProjectConfig` を構築。既存の L80-95 のハードコード部分をこの関数に統合。

## Step 4: `project.ts` の overrides 対応

**ファイル:** `packages/create-einja-app/src/prompts/project.ts`

- `promptProjectConfig(defaultProjectName?, overrides?)` にシグネチャ変更
- 各質問に `when: () => overrides?.xxx === undefined` を追加し、CLI 引数で指定済みの項目をスキップ
- worktree 関連 overrides が 1 つでもある場合、`customizeWorktree` 質問をスキップ（カスタマイズ済みとみなす）
- 最終的な return で `overrides?.xxx ?? answers.xxx` のマージ

## Step 5: `post-setup.ts` の非対話対応

**ファイル:** `packages/create-einja-app/src/generators/post-setup.ts`

- `PostSetupOptions` に `yes?: boolean` を追加
- `yes === true` 時は `promptAndExecuteDirenvAllow` の inquirer をスキップし、デフォルト動作（direnv allow 実行）

## Step 6: Claude Code コマンド作成

**ファイル:** `.claude/commands/einja/create-app.md`

AskUserQuestion で回答を収集し、CLI 引数に変換して実行するコマンド。

### フロー

```
1. AskUserQuestion: プロジェクト名（テキスト入力）
2. AskUserQuestion: 基本設定 3問同時
   - パッケージスコープ（@repo / @{プロジェクト名} / カスタム）
   - 認証方式（NextAuth.js / なし）
   - einja CLI セットアップ（はい / いいえ）
3. AskUserQuestion: Worktree カスタマイズ（はい / いいえ）
4. (条件付き) AskUserQuestion: Worktree 詳細設定
5. ビルド + CLI 実行:
   pnpm -F create-einja-app build
   node packages/create-einja-app/dist/cli.js <name> --yes \
     --scope <scope> --auth <auth> [--no-einja-cli] [worktree flags] \
     --skip-install
6. 結果報告
```

**注意:** `--skip-install` をデフォルトで付与（Claude Code 内でのインストールは別途制御）

## Step 7: テスト

### ユニットテスト
- `overrides` マージの正確性
- CLI 引数バリデーションのエラーケース

### 統合テスト
- `--yes` でデフォルト生成
- `--yes --scope @custom --auth none` でカスタム生成
- 部分指定（`--scope` のみ）で残りが対話入力されること

### 手動検証
```bash
# 非対話モード
node packages/create-einja-app/dist/cli.js test-proj --yes --skip-git --skip-install

# 部分指定
node packages/create-einja-app/dist/cli.js test-proj --scope @test --skip-git --skip-install
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/create-einja-app/src/types/index.ts` | `CliConfigOverrides` 型追加 |
| `packages/create-einja-app/src/cli.ts` | commander オプション追加 |
| `packages/create-einja-app/src/commands/create.ts` | 3パターン分岐、バリデーション、デフォルト構築 |
| `packages/create-einja-app/src/prompts/project.ts` | overrides 対応、`when` 条件追加 |
| `packages/create-einja-app/src/generators/post-setup.ts` | `yes` オプション追加 |
| `.claude/commands/einja/create-app.md` | 新規: AskUserQuestion 仲介コマンド |
| テストファイル（既存 + 新規） | 非対話モードのテストケース追加 |

## 検証方法

1. `pnpm -F create-einja-app build` が成功すること
2. `pnpm -F create-einja-app typecheck` が成功すること
3. `pnpm -F create-einja-app test` が成功すること
4. 手動で `--yes` モード実行し、プロジェクトが正しく生成されること
5. Claude Code から `/einja:create-app` で実行できること
