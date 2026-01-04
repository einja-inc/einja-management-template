# Phase 1-3 テスト仕様（パッケージ基盤〜対話式プロンプト）

## 概要

Phase 1（パッケージ基盤）、Phase 2（テンプレートシステム）、Phase 3（対話式プロンプト）のテスト仕様を定義します。

---

## Phase 1: パッケージ基盤

### P1-001: パッケージディレクトリ構造

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-001-1 | `packages/create-einja-app/` ディレクトリが存在する | true | - |
| P1-001-2 | `packages/create-einja-app/package.json` が存在する | true | - |
| P1-001-3 | `packages/create-einja-app/tsconfig.json` が存在する | true | - |
| P1-001-4 | `packages/create-einja-app/src/cli.ts` が存在する | true | - |

### P1-002: package.json 設定

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-002-1 | `name` が `create-einja-app` | true | - |
| P1-002-2 | `bin` フィールドに `create-einja-app` が設定されている | true | - |
| P1-002-3 | `type` が `module` | true | - |
| P1-002-4 | `files` に `dist` と `templates` が含まれている | true | - |
| P1-002-5 | 必要な依存関係（commander, inquirer, ora, chalk, execa）が含まれている | true | - |

### P1-003: ビルド設定

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-003-1 | `pnpm -F create-einja-app build` が成功する | exit code 0 | - |
| P1-003-2 | `dist/cli.js` が生成される | true | - |
| P1-003-3 | `dist/cli.js` の先頭に shebang がある | `#!/usr/bin/env node` | - |
| P1-003-4 | ESM形式で出力されている | `import` 文が使用されている | - |

### P1-004: CLIエントリーポイント

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P1-004-1 | `node dist/cli.js --version` がバージョンを出力する | バージョン番号が表示される | - |
| P1-004-2 | `node dist/cli.js --help` がヘルプを出力する | コマンド一覧が表示される | - |
| P1-004-3 | 不正なコマンドでエラーメッセージが表示される | エラーメッセージとヘルプが表示される | - |

---

## Phase 2: テンプレートシステム

### P2-001: テンプレート同期スクリプト

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-001-1 | `scripts/template-sync.ts` が存在する | true | AC-008-1 |
| P2-001-2 | `pnpm template:sync` が成功する | exit code 0 | AC-008-1 |
| P2-001-3 | 同期後に `templates/turborepo-pandacss/` が存在する | true | AC-008-1 |

### P2-002: .templateignore 除外

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-002-1 | `.templateignore` ファイルが存在する | true | AC-008-2 |
| P2-002-2 | `packages/cli/` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-3 | `packages/create-einja-app/` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-4 | `node_modules/` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-5 | `.git/` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-6 | `.next/` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-7 | `.env` が除外されている | templates に含まれない | AC-008-2 |
| P2-002-8 | `.env.local` が除外されている | templates に含まれない | AC-008-2 |

### P2-003: プレースホルダー置換

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-003-1 | `package.json` の `name` が `{{projectName}}` に置換されている | true | AC-008-3 |
| P2-003-2 | 元のプロジェクト名（einja-management-template）が含まれていない | true | AC-008-3 |

### P2-004: テンプレート内容の整合性

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-004-1 | `apps/web/` ディレクトリが含まれている | true | - |
| P2-004-2 | `packages/database/` ディレクトリが含まれている | true | - |
| P2-004-3 | `packages/auth/` ディレクトリが含まれている | true | - |
| P2-004-4 | `packages/ui/` ディレクトリが含まれている | true | - |
| P2-004-5 | `packages/config/` ディレクトリが含まれている | true | - |
| P2-004-6 | `turbo.json` が含まれている | true | - |
| P2-004-7 | `pnpm-workspace.yaml` が含まれている | true | - |
| P2-004-8 | `docker-compose.yml` が含まれている | true | - |

### P2-005: CLIテンプレートディレクトリ構造

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-005-1 | `.claude/commands/einja/` が含まれている | true | - |
| P2-005-2 | `.claude/agents/einja/` が含まれている | true | - |
| P2-005-3 | `.claude/skills/einja/` が含まれている | true | - |
| P2-005-4 | `docs/einja/` が含まれている | true | - |

### P2-006: 汎用ダッシュボードサンプル

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P2-006-1 | `apps/web/src/app/(authenticated)/dashboard/` が含まれている | true | - |
| P2-006-2 | ダッシュボードが汎用的な内容になっている（Einja固有でない） | true | - |

---

## Phase 3: 対話式プロンプト

### P3-001: プロジェクト名入力

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-001-1 | プロジェクト名プロンプトが表示される | "プロジェクト名:" が表示される | AC-001-4 |
| P3-001-2 | コマンド引数で指定した名前がデフォルト値になる | 引数の値がデフォルト | - |
| P3-001-3 | 空の場合 `my-project` がデフォルト | "my-project" | - |
| P3-001-4 | 不正な文字を含む名前はバリデーションエラー | エラーメッセージが表示される | - |
| P3-001-5 | 既存ディレクトリ名は警告が表示される | 警告メッセージが表示される | - |

### P3-002: テンプレート選択

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-002-1 | テンプレート選択プロンプトが表示される | 選択肢が表示される | AC-001-4 |
| P3-002-2 | `turborepo-pandacss` が選択可能 | true | - |
| P3-002-3 | `minimal` が無効化されている（将来拡張） | disabled: true | - |
| P3-002-4 | `--template` オプションで指定した値がデフォルト | オプションの値がデフォルト | - |

### P3-003: 認証方式選択

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-003-1 | 認証方式選択プロンプトが表示される | 選択肢が表示される | AC-009-1 |
| P3-003-2 | `Google OAuth` が選択可能 | true | AC-009-1 |
| P3-003-3 | `Credentials` が選択可能 | true | AC-009-1 |
| P3-003-4 | `GitHub OAuth` が選択可能 | true | AC-009-1 |
| P3-003-5 | `なし` が選択可能 | true | AC-009-1 |
| P3-003-6 | デフォルトは `Google OAuth` | true | - |

### P3-004: 環境ツール選択

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-004-1 | 環境ツール選択プロンプトが表示される（複数選択） | チェックボックスが表示される | AC-001-4 |
| P3-004-2 | `direnv` が選択可能 | true | - |
| P3-004-3 | `dotenvx` が選択可能 | true | - |
| P3-004-4 | `Volta` が選択可能 | true | - |
| P3-004-5 | デフォルトで全て選択されている | checked: true | - |

### P3-005: @einja/cli セットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-005-1 | @einja/cli セットアップ確認プロンプトが表示される | 確認プロンプトが表示される | AC-001-4 |
| P3-005-2 | デフォルトは `はい` | default: true | - |

### P3-006: Worktree設定カスタマイズ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-006-1 | Worktree設定確認プロンプトが表示される | 確認プロンプトが表示される | AC-010-1 |
| P3-006-2 | `はい` を選択するとカスタマイズプロンプトが表示される | PostgreSQLポート等のプロンプトが表示される | AC-010-1 |
| P3-006-3 | PostgreSQLポートのデフォルトは `25432` | default: 25432 | AC-010-1 |
| P3-006-4 | コンテナ名のデフォルトはプロジェクト名ベース | default: `{projectName}-postgres` | AC-010-2 |
| P3-006-5 | アプリ追加が可能 | アプリ追加プロンプトが表示される | AC-010-4 |

### P3-007: 非対話モード（--yes）

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P3-007-1 | `--yes` オプションでプロンプトがスキップされる | プロンプトなしで生成開始 | - |
| P3-007-2 | デフォルト値が使用される | 全てデフォルト設定 | - |

---

## テスト実行方法

### ユニットテスト

```bash
# プロンプトモジュールのテスト
pnpm -F create-einja-app test src/prompts/

# バリデーション関数のテスト
pnpm -F create-einja-app test src/utils/validation.test.ts
```

### 統合テスト

```bash
# 対話モードのテスト（inquirer のモックを使用）
pnpm -F create-einja-app test tests/integration/prompts.test.ts
```

### 手動テスト

```bash
# ビルド
pnpm -F create-einja-app build

# テンプレート同期
pnpm template:sync

# 対話モードで実行
node packages/create-einja-app/dist/cli.js test-project

# 非対話モードで実行
node packages/create-einja-app/dist/cli.js test-project --yes
```

---

## テストコード例

### P1-003: ビルド設定テスト

```typescript
// tests/unit/build.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";

describe("ビルド設定", () => {
  beforeAll(async () => {
    await execa("pnpm", ["-F", "create-einja-app", "build"]);
  });

  it("P1-003-1: ビルドが成功する", async () => {
    const result = await execa("pnpm", ["-F", "create-einja-app", "build"]);
    expect(result.exitCode).toBe(0);
  });

  it("P1-003-2: dist/cli.js が生成される", async () => {
    const cliPath = path.join(__dirname, "../../dist/cli.js");
    expect(await fs.pathExists(cliPath)).toBe(true);
  });

  it("P1-003-3: shebang が含まれている", async () => {
    const cliPath = path.join(__dirname, "../../dist/cli.js");
    const content = await fs.readFile(cliPath, "utf-8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
```

### P3-001: プロジェクト名入力テスト

```typescript
// tests/unit/prompts/project.test.ts
import { describe, it, expect, vi } from "vitest";
import { validateProjectName } from "../../../src/prompts/project";

describe("プロジェクト名バリデーション", () => {
  it("P3-001-4: 不正な文字を含む名前はエラー", () => {
    expect(validateProjectName("my project")).toContain("エラー");
    expect(validateProjectName("my/project")).toContain("エラー");
    expect(validateProjectName("my\\project")).toContain("エラー");
  });

  it("有効な名前は true を返す", () => {
    expect(validateProjectName("my-project")).toBe(true);
    expect(validateProjectName("my_project")).toBe(true);
    expect(validateProjectName("myProject")).toBe(true);
  });
});
```
