# Phase 6-7 テスト仕様（生成後セットアップ〜CI/CD・テスト・ドキュメント）

## 概要

Phase 6（生成後セットアップ）、Phase 7（CI/CD・テスト・ドキュメント）のテスト仕様を定義します。

---

## Phase 6: 生成後セットアップ

### P6-001: 依存関係インストール

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-001-1 | `--skip-install` なしで `pnpm install` が実行される | 依存関係がインストールされる | AC-001-2 |
| P6-001-2 | `--skip-install` 指定時は実行されない | インストールがスキップされる | - |
| P6-001-3 | インストール中にスピナーが表示される | "依存関係をインストール中..." | - |
| P6-001-4 | インストール成功時にメッセージが表示される | "依存関係をインストールしました" | - |
| P6-001-5 | インストール失敗時にエラーメッセージが表示される | エラーメッセージが表示される | - |

### P6-002: Prismaクライアント生成

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-002-1 | 依存関係インストール後に `pnpm db:generate` が実行される | Prismaクライアントが生成される | - |
| P6-002-2 | 生成中にスピナーが表示される | "Prismaクライアントを生成中..." | - |
| P6-002-3 | 生成成功時にメッセージが表示される | "Prismaクライアントを生成しました" | - |
| P6-002-4 | 生成失敗時は警告として扱われる | 警告メッセージが表示される | - |

### P6-003: Git初期化

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-003-1 | `--skip-git` なしで `git init` が実行される | .git ディレクトリが作成される | - |
| P6-003-2 | `--skip-git` 指定時は実行されない | .git が作成されない | - |
| P6-003-3 | 初期コミットが作成される | "Initial commit from create-einja-app" | - |
| P6-003-4 | 全ファイルがステージングされる | `git status` で clean | - |
| P6-003-5 | 初期化中にスピナーが表示される | "Gitリポジトリを初期化中..." | - |

### P6-004: direnv allow実行

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-004-1 | direnv選択時に `direnv allow` の確認が表示される | 確認プロンプトが表示される | AC-003-4 |
| P6-004-2 | 「はい」選択時に `direnv allow` が実行される | 環境変数が有効化される | AC-003-4 |
| P6-004-3 | 「いいえ」選択時はスキップされる | 実行されない | - |

### P6-005: @einja/cliセットアップ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-005-1 | セットアップ選択時に `npx @einja/cli init` が実行される | CLI設定が初期化される | - |
| P6-005-2 | セットアップ中にスピナーが表示される | "@einja/cli をセットアップ中..." | - |
| P6-005-3 | セットアップ成功時にメッセージが表示される | "@einja/cli をセットアップしました" | - |
| P6-005-4 | セットアップ失敗時は警告として扱われる | 警告メッセージが表示される | - |

### P6-006: 完了メッセージ

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P6-006-1 | 完了メッセージが表示される | "✔ プロジェクトを作成しました: {projectName}" | AC-001-5 |
| P6-006-2 | 次のステップが表示される | コマンド一覧が表示される | AC-001-5 |
| P6-006-3 | `cd {projectName}` が含まれる | true | AC-001-5 |
| P6-006-4 | `docker-compose up -d postgres` が含まれる | true | AC-001-5 |
| P6-006-5 | `pnpm install` が含まれる（スキップ時） | true | AC-001-5 |
| P6-006-6 | `pnpm db:push` が含まれる | true | AC-001-5 |
| P6-006-7 | `pnpm dev` が含まれる | true | AC-001-5 |
| P6-006-8 | 開発サーバーURLが表示される | "開発サーバー: http://localhost:3000" | AC-001-5 |

---

## Phase 7: CI/CD・テスト・ドキュメント

### P7-001: CI/CDパイプライン

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P7-001-1 | `.github/workflows/create-einja-app.yml` が存在する | ファイルが存在する | - |
| P7-001-2 | push時にワークフローがトリガーされる | `on: push` が設定されている | - |
| P7-001-3 | `pnpm template:sync` ステップが含まれる | ステップが存在する | - |
| P7-001-4 | ビルドステップが含まれる | `pnpm -F create-einja-app build` | - |
| P7-001-5 | テストステップが含まれる | `pnpm -F create-einja-app test` | - |
| P7-001-6 | 型チェックステップが含まれる | `pnpm -F create-einja-app typecheck` | - |
| P7-001-7 | lintステップが含まれる | `pnpm -F create-einja-app lint` | - |

### P7-002: ユニットテスト

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P7-002-1 | `vitest.config.ts` が存在する | ファイルが存在する | - |
| P7-002-2 | `pnpm -F create-einja-app test` が成功する | exit code 0 | - |
| P7-002-3 | プロンプトモジュールのテストが存在する | テストファイルが存在する | - |
| P7-002-4 | ジェネレーターモジュールのテストが存在する | テストファイルが存在する | - |
| P7-002-5 | ユーティリティモジュールのテストが存在する | テストファイルが存在する | - |

### P7-003: 統合テスト

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P7-003-1 | 統合テストディレクトリが存在する | `tests/integration/` | - |
| P7-003-2 | createコマンドの統合テストが存在する | `create.test.ts` | - |
| P7-003-3 | setupコマンドの統合テストが存在する | `setup.test.ts` | - |
| P7-003-4 | 統合テストが成功する | exit code 0 | - |

### P7-004: E2Eテスト

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P7-004-1 | E2Eテストディレクトリが存在する | `tests/e2e/` | - |
| P7-004-2 | プロジェクト生成E2Eテストが存在する | `project-generation.test.ts` | - |
| P7-004-3 | 実際のプロジェクト生成が成功する | プロジェクトが作成される | - |
| P7-004-4 | 生成されたプロジェクトでビルドが成功する | exit code 0 | - |

### P7-005: README

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P7-005-1 | `packages/create-einja-app/README.md` が存在する | ファイルが存在する | - |
| P7-005-2 | インストール方法が記載されている | `npx create-einja-app` | - |
| P7-005-3 | 使用方法が記載されている | コマンド例が含まれる | - |
| P7-005-4 | オプション一覧が記載されている | `--setup`, `--template` 等 | - |
| P7-005-5 | テンプレート構成が記載されている | ディレクトリ構造 | - |
| P7-005-6 | 環境ツールの説明が記載されている | direnv, dotenvx, Volta | - |

---

## 認証方式別テスト

### P-AUTH-001: Google OAuth選択時

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-AUTH-001-1 | `packages/auth/` に Google OAuth 設定が含まれる | true | AC-009-2 |
| P-AUTH-001-2 | `.env.example` に `GOOGLE_CLIENT_ID` が含まれる | true | AC-009-2 |
| P-AUTH-001-3 | `.env.example` に `GOOGLE_CLIENT_SECRET` が含まれる | true | AC-009-2 |

### P-AUTH-002: Credentials選択時

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-AUTH-002-1 | `packages/auth/` に Credentials 設定が含まれる | true | AC-009-2 |
| P-AUTH-002-2 | ログインフォームが含まれる | `signin/` にフォームコンポーネント | AC-009-2 |

### P-AUTH-003: GitHub OAuth選択時

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-AUTH-003-1 | `packages/auth/` に GitHub OAuth 設定が含まれる | true | AC-009-2 |
| P-AUTH-003-2 | `.env.example` に `GITHUB_CLIENT_ID` が含まれる | true | AC-009-2 |
| P-AUTH-003-3 | `.env.example` に `GITHUB_CLIENT_SECRET` が含まれる | true | AC-009-2 |

### P-AUTH-004: 認証なし選択時

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-AUTH-004-1 | `packages/auth/` が含まれない | false | AC-009-3 |
| P-AUTH-004-2 | `signin/` ディレクトリが含まれない | false | AC-009-3 |
| P-AUTH-004-3 | `signup/` ディレクトリが含まれない | false | AC-009-3 |
| P-AUTH-004-4 | `api/auth/` ディレクトリが含まれない | false | AC-009-3 |
| P-AUTH-004-5 | 認証関連の環境変数が `.env.example` に含まれない | NEXTAUTH_* がない | AC-009-3 |

---

## Worktree設定テスト

### P-WT-001: worktree.config.json生成

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-WT-001-1 | `worktree.config.json` が生成される | ファイルが存在する | AC-010-3 |
| P-WT-001-2 | `schemaVersion` が `1` | true | AC-010-3 |
| P-WT-001-3 | `postgres.port` がカスタム値または `25432` | 設定値と一致 | AC-010-1 |
| P-WT-001-4 | `postgres.containerName` がカスタム値 | 設定値と一致 | AC-010-2 |
| P-WT-001-5 | `apps` 配列が正しく設定される | 設定値と一致 | AC-010-4 |

### P-WT-002: docker-compose.yml連携

| テストID | テスト内容 | 期待結果 | AC対応 |
|---------|-----------|---------|--------|
| P-WT-002-1 | `docker-compose.yml` のポートがカスタム値と一致 | ポートが一致 | AC-010-1 |
| P-WT-002-2 | コンテナ名がカスタム値と一致 | コンテナ名が一致 | AC-010-2 |

---

## テスト実行方法

### ユニットテスト

```bash
# 全テスト実行
pnpm -F create-einja-app test

# 特定ファイルのテスト
pnpm -F create-einja-app test tests/unit/generators/post-setup.test.ts
```

### 統合テスト

```bash
# 統合テストのみ実行
pnpm -F create-einja-app test tests/integration/
```

### E2Eテスト

```bash
# E2Eテスト実行（時間がかかる）
pnpm -F create-einja-app test tests/e2e/
```

### カバレッジ

```bash
# カバレッジ付きテスト
pnpm -F create-einja-app test:coverage
```

---

## テストコード例

### P6-006: 完了メッセージテスト

```typescript
// tests/unit/generators/post-setup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printCompletionMessage } from "../../../src/generators/post-setup";

describe("完了メッセージ", () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("P6-006-1: プロジェクト名が表示される", () => {
    printCompletionMessage({ projectName: "test-project" });

    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("test-project");
  });

  it("P6-006-2: 次のステップが表示される", () => {
    printCompletionMessage({ projectName: "test-project" });

    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("次のステップ");
  });

  it("P6-006-3: cd コマンドが含まれる", () => {
    printCompletionMessage({ projectName: "test-project" });

    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("cd test-project");
  });

  it("P6-006-8: 開発サーバーURLが表示される", () => {
    printCompletionMessage({ projectName: "test-project" });

    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("http://localhost:3000");
  });
});
```

### P7-003: 統合テスト例

```typescript
// tests/integration/create.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("createコマンド統合テスト", () => {
  let testDir: string;
  let projectDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `create-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    projectDir = path.join(testDir, "test-project");
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it("非対話モードでプロジェクトが作成される", async () => {
    const cliPath = path.resolve(__dirname, "../../dist/cli.js");

    await execa("node", [cliPath, "test-project", "--yes"], {
      cwd: testDir,
    });

    expect(await fs.pathExists(projectDir)).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "package.json"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "turbo.json"))).toBe(true);
  });

  it("期待するディレクトリ構造が作成される", async () => {
    expect(await fs.pathExists(path.join(projectDir, "apps/web"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "packages/database"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "packages/auth"))).toBe(true);
  });

  it("環境ツール設定が生成される", async () => {
    expect(await fs.pathExists(path.join(projectDir, ".envrc"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, ".node-version"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, ".env.example"))).toBe(true);
  });
});
```
