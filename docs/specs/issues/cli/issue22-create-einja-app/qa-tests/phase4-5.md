# Phase 4-5 テスト仕様（環境ツールセットアップ〜--setupモード）

## 概要

Phase 4（環境ツールセットアップ機能）、Phase 5（--setupモード）のテスト仕様を定義します。

---

## Phase 4: 環境ツールセットアップ機能

### P4-001: direnvセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P4-001-1 | `.envrc` ファイルが生成される | ファイルが存在する | AC-003-1 |
| P4-001-2 | `.envrc` に `dotenv_if_exists .env` が含まれる | true | AC-003-1 |
| P4-001-3 | `.envrc` に `dotenv_if_exists .env.local` が含まれる | true | AC-003-1 |
| P4-001-4 | `.envrc.example` ファイルが生成される | ファイルが存在する | AC-003-2 |
| P4-001-5 | `.envrc.example` の内容が `.envrc` と同じ | 内容が一致する | AC-003-2 |
| P4-001-6 | `.gitignore` に `.envrc` が追加される | 行が含まれる | AC-003-3 |
| P4-001-7 | `direnv allow` の確認プロンプトが表示される | プロンプトが表示される | AC-003-4 |

### P4-002: dotenvxセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P4-002-1 | `package.json` に `@dotenvx/dotenvx` が追加される | devDependencies に含まれる | AC-004-1 |
| P4-002-2 | `package.json` に `env:encrypt` スクリプトが追加される | scripts に含まれる | AC-004-2 |
| P4-002-3 | `package.json` に `env:decrypt` スクリプトが追加される | scripts に含まれる | AC-004-2 |
| P4-002-4 | `.env.example` ファイルが生成される | ファイルが存在する | AC-004-3 |
| P4-002-5 | `.env.example` に `DATABASE_URL` が含まれる | 行が含まれる | AC-004-3 |
| P4-002-6 | `.env.example` に `NEXTAUTH_URL` が含まれる | 行が含まれる | AC-004-3 |
| P4-002-7 | `.env.example` に `NEXTAUTH_SECRET` が含まれる | 行が含まれる | AC-004-3 |

### P4-003: Voltaセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P4-003-1 | `package.json` に `volta` フィールドが追加される | フィールドが存在する | AC-005-1 |
| P4-003-2 | `volta.node` が `22.16.0` に設定される | バージョンが一致する | AC-005-1 |
| P4-003-3 | `volta.pnpm` が設定される | バージョンが設定される | AC-005-1 |
| P4-003-4 | `.node-version` ファイルが生成される | ファイルが存在する | AC-005-2 |
| P4-003-5 | `.node-version` の内容が `22.16.0` | 内容が一致する | AC-005-2 |

### P4-004: Biomeセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P4-004-1 | `biome.json` ファイルが生成される | ファイルが存在する | AC-006-1 |
| P4-004-2 | `biome.json` に `formatter` 設定が含まれる | 設定が存在する | AC-006-1 |
| P4-004-3 | `biome.json` に `linter` 設定が含まれる | 設定が存在する | AC-006-1 |
| P4-004-4 | `package.json` に `@biomejs/biome` が追加される | devDependencies に含まれる | AC-006-2 |
| P4-004-5 | `package.json` に `lint` スクリプトが追加される | scripts に含まれる | AC-006-2 |
| P4-004-6 | `package.json` に `lint:fix` スクリプトが追加される | scripts に含まれる | AC-006-2 |
| P4-004-7 | `package.json` に `format` スクリプトが追加される | scripts に含まれる | AC-006-2 |
| P4-004-8 | `package.json` に `format:fix` スクリプトが追加される | scripts に含まれる | AC-006-2 |
| P4-004-9 | `.vscode/settings.json` が生成される | ファイルが存在する | AC-006-3 |
| P4-004-10 | VSCode設定に `biomejs.biome` フォーマッター設定が含まれる | 設定が存在する | AC-006-3 |

### P4-005: Huskyセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P4-005-1 | `.husky/` ディレクトリが生成される | ディレクトリが存在する | AC-007-1 |
| P4-005-2 | `.husky/pre-commit` ファイルが生成される | ファイルが存在する | AC-007-2 |
| P4-005-3 | pre-commit に `pnpm lint-staged` が含まれる | コマンドが含まれる | AC-007-2 |
| P4-005-4 | pre-commit が実行可能 (755) | パーミッションが正しい | AC-007-2 |
| P4-005-5 | `package.json` に `husky` が追加される | devDependencies に含まれる | AC-007-3 |
| P4-005-6 | `package.json` に `lint-staged` が追加される | devDependencies に含まれる | AC-007-3 |
| P4-005-7 | `package.json` に `prepare` スクリプトが追加される | scripts に含まれる | AC-007-3 |
| P4-005-8 | `package.json` に `lint-staged` 設定が追加される | 設定が存在する | AC-007-3 |

---

## Phase 5: --setup モード

### P5-001: 既存プロジェクト検出

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-001-1 | `package.json` が存在しない場合エラー | エラーメッセージが表示される | AC-002-1 |
| P5-001-2 | `package.json` が存在する場合プロンプト表示 | プロンプトが表示される | AC-002-1 |
| P5-001-3 | プロジェクト名が正しく検出される | package.json の name が表示される | - |

### P5-002: ツール選択プロンプト

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-002-1 | ツール選択プロンプトが表示される | チェックボックスが表示される | AC-002-1 |
| P5-002-2 | `direnv` が選択可能 | true | AC-002-3 |
| P5-002-3 | `dotenvx` が選択可能 | true | AC-002-3 |
| P5-002-4 | `Volta` が選択可能 | true | AC-002-3 |
| P5-002-5 | `Biome` が選択可能 | true | AC-002-3 |
| P5-002-6 | `Husky + lint-staged` が選択可能 | true | AC-002-3 |
| P5-002-7 | デフォルトで direnv, dotenvx, Volta が選択されている | checked: true | - |
| P5-002-8 | Biome, Husky はデフォルト未選択 | checked: false | - |

### P5-003: 既存ファイル競合戦略

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-003-1 | 競合戦略プロンプトが表示される | 選択肢が表示される | AC-002-2 |
| P5-003-2 | `マージ` が選択可能 | true | AC-002-2 |
| P5-003-3 | `上書き` が選択可能 | true | AC-002-2 |
| P5-003-4 | `スキップ` が選択可能 | true | AC-002-2 |
| P5-003-5 | デフォルトは `マージ` | default: "merge" | - |

### P5-004: マージ戦略の動作

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-004-1 | 既存 `.envrc` にマージで追加される | 既存内容が保持され、新しい設定が追加される | AC-002-4 |
| P5-004-2 | 既存 `package.json` にスクリプトがマージされる | 既存スクリプトが保持される | AC-002-4 |
| P5-004-3 | 既存 `.gitignore` に行が追加される | 既存行が保持される | AC-002-4 |
| P5-004-4 | 重複行は追加されない | 重複なし | AC-002-4 |

### P5-005: 上書き戦略の動作

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-005-1 | 既存 `.envrc` が上書きされる | 新しい内容のみ | - |
| P5-005-2 | 既存 `biome.json` が上書きされる | 新しい内容のみ | - |
| P5-005-3 | 上書き前に確認プロンプトが表示される | 確認プロンプトが表示される | - |

### P5-006: スキップ戦略の動作

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-006-1 | 既存ファイルがある場合スキップされる | ファイルが変更されない | - |
| P5-006-2 | スキップ時にメッセージが表示される | "Skipping existing file: ..." | - |
| P5-006-3 | 新規ファイルは作成される | ファイルが作成される | - |

### P5-007: 選択的ツールセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P5-007-1 | direnv のみ選択時、direnv 関連ファイルのみ生成 | `.envrc`, `.envrc.example` のみ | AC-002-3 |
| P5-007-2 | Biome のみ選択時、Biome 関連ファイルのみ生成 | `biome.json`, VSCode設定のみ | AC-002-3 |
| P5-007-3 | 複数選択時、選択したツール全ての設定が生成 | 全て生成される | AC-002-3 |

---

## テスト実行方法

### ユニットテスト

```bash
# ツールジェネレーターのテスト
pnpm -F create-einja-app test src/generators/tools/

# 競合戦略のテスト
pnpm -F create-einja-app test src/utils/conflict-strategy.test.ts
```

### 統合テスト

```bash
# --setup モードのテスト
pnpm -F create-einja-app test tests/integration/setup.test.ts
```

### 手動テスト

```bash
# 新規プロジェクトでツールセットアップ
mkdir test-project && cd test-project
pnpm init
npx create-einja-app --setup

# 既存ファイルがある状態でのテスト
echo "export EXISTING=value" > .envrc
npx create-einja-app --setup
cat .envrc  # マージ結果を確認
```

---

## テストコード例

### P4-001: direnvセットアップテスト

```typescript
// tests/unit/generators/tools/direnv.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupDirenv } from "../../../../src/generators/tools/direnv";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("direnvセットアップ", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `direnv-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    // package.json を作成
    await fs.writeJson(path.join(testDir, "package.json"), { name: "test" });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("P4-001-1: .envrc ファイルが生成される", async () => {
    await setupDirenv({ targetDir: testDir });
    expect(await fs.pathExists(path.join(testDir, ".envrc"))).toBe(true);
  });

  it("P4-001-2: .envrc に dotenv_if_exists .env が含まれる", async () => {
    await setupDirenv({ targetDir: testDir });
    const content = await fs.readFile(path.join(testDir, ".envrc"), "utf-8");
    expect(content).toContain("dotenv_if_exists .env");
  });

  it("P4-001-4: .envrc.example ファイルが生成される", async () => {
    await setupDirenv({ targetDir: testDir });
    expect(await fs.pathExists(path.join(testDir, ".envrc.example"))).toBe(true);
  });

  it("P4-001-6: .gitignore に .envrc が追加される", async () => {
    // 既存の .gitignore を作成
    await fs.writeFile(path.join(testDir, ".gitignore"), "node_modules/\n");

    await setupDirenv({ targetDir: testDir });

    const content = await fs.readFile(path.join(testDir, ".gitignore"), "utf-8");
    expect(content).toContain(".envrc");
  });
});
```

### P5-004: マージ戦略テスト

```typescript
// tests/unit/utils/conflict-strategy.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mergeContent, mergePackageJson } from "../../../src/utils/conflict-strategy";

describe("マージ戦略", () => {
  it("P5-004-1: 既存内容が保持される", () => {
    const existing = "export EXISTING=value\n";
    const newContent = "dotenv_if_exists .env\n";

    const result = mergeContent(existing, newContent);

    expect(result).toContain("export EXISTING=value");
    expect(result).toContain("dotenv_if_exists .env");
  });

  it("P5-004-4: 重複行は追加されない", () => {
    const existing = "dotenv_if_exists .env\n";
    const newContent = "dotenv_if_exists .env\n";

    const result = mergeContent(existing, newContent);

    const matches = result.match(/dotenv_if_exists .env/g);
    expect(matches?.length).toBe(1);
  });

  it("package.json のスクリプトがマージされる", () => {
    const existing = {
      name: "test",
      scripts: {
        dev: "next dev",
        build: "next build",
      },
    };
    const additions = {
      scripts: {
        lint: "biome lint .",
      },
    };

    const result = mergePackageJson(existing, additions);

    expect(result.scripts.dev).toBe("next dev");
    expect(result.scripts.build).toBe("next build");
    expect(result.scripts.lint).toBe("biome lint .");
  });
});
```
