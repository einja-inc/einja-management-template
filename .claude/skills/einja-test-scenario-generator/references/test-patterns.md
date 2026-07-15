# test-patterns.md

einja 標準スタック（Vitest + Playwright）で慣例に従ったテストコードを生成するためのテンプレート集。`SKILL.md` の Step 5（テストコード生成）から参照され、`Step 4` で取り込んだ既存テストのスタイルと整合する形で本ファイルのテンプレートを適用する。

## 目次

1. [共通の einja 慣例（必須チェックリスト）](#1-共通の-einja-慣例必須チェックリスト)
2. [Vitest テンプレート](#2-vitest-テンプレート) — 基本構造(正常系/異常系/境界値) / DIモック / モジュールモック / 非同期 / 表駆動 / 完全サンプル
3. [Playwright テンプレート](#3-playwright-テンプレート) — 基本 E2E / フォーム / ログイン / スクショ / baseURL / 完全サンプル
4. [passing-by-accident の防止](#4-passing-by-accident-の防止)
5. [既存テストスタイルへの適合](#5-既存テストスタイルへの適合)
6. [ファイル末尾の生成テンプレート](#6-ファイル末尾の生成テンプレート)
7. [関連 references](#関連-references)

## 1. 共通の einja 慣例（必須チェックリスト）

生成するテストは以下を**全て**満たすこと。本チェックリストは本リポの正典 `einja-coding-standards/references/testing-strategy.md`（§「describe構造」「describe分類ルール」「it説明文のフォーマット」「モックとスタブ」「チェックリスト」）に準拠する。矛盾する場合は `testing-strategy.md` を優先する。`SKILL.md` Step 5 のチェッカーが Grep で機械検査する項目には ✅ を付す。

- [ ] **名前付き import**: `import { describe, it, expect } from "vitest"` / `import { test, expect } from "@playwright/test"`（default import 禁止）
- [ ] ✅ **describe の階層化（必須）**: 1 階層目 = 対象クラス/関数名、2 階層目 = メソッド名 or 機能名、および **正常系と異常系を別 `describe` に分離** する（例: `describe("create", ...)` と `describe("create - 異常系", ...)`）。フラットな単一 `describe` は不可
- [ ] ✅ **正常系・異常系・境界値を必ず網羅**: 被テスト対象ごとに、正常系（期待動作）／異常系（無効入力・null/undefined・例外処理）／境界値（最小値・最大値・境界±1）の **3 観点それぞれに最低 1 `it`** を生成する。純粋関数で境界が自明に無い場合のみ境界値を省略可、その旨をコメントで明示する
- [ ] ✅ **it 説明文は「〜すると、〜になる」形式**: 条件 → 結果を日本語の文で書く（「何を・どの条件で・どうなるべきか」）。`it("ユーザー作成")` のような体言止め・英語・結果が曖昧なものは不可
- [ ] **Given/When/Then コメント**: 各 `it` ブロック内に `// Given:`, `// When:`, `// Then:` の3コメントを必ず記載する
- [ ] **モック方針**: 外部依存（Repository 等）は `testing-strategy.md` §8 に従い `vi.fn()` を使った依存性注入モックファクトリ（`createMockXxx()`）で分離する（§2.2 参照）
- [ ] **テストデータの setup/cleanup**: 副作用（tmp dir・環境変数・cwd）を伴う場合は `beforeEach`/`afterEach` で初期化・後始末する
- [ ] ✅ **`expect(` が最低 1 回**: アサーション無しのテストは生成失敗扱い
- [ ] **passing-by-accident 禁止**: `expect(true).toBe(true)` 等の常に成立するアサーションを書かない

## 2. Vitest テンプレート

### 2.1 基本構造（純粋関数・正常系/異常系/境界値の3観点）

**使い分け基準**: 外部依存（fs, fetch, DB）を持たない純粋関数・ロジックの検証に使う。最も生成数が多いはずのパターン。`testing-strategy.md` の describe 分類ルールに従い、**2 階層 describe（対象名 → メソッド名 + 異常系分離）** で構成し、正常系・異常系・境界値を必ず含める。

```ts
import { describe, expect, it } from "vitest";
import { computeSomething } from "./target-module";

describe("computeSomething", () => {
  // 正常系
  describe("computeSomething", () => {
    it("正の整数を渡すと、2倍の値を返す", () => {
      // Given: 正の整数 2 を入力として用意する
      const input = 2;
      // When: computeSomething を呼び出す
      const result = computeSomething(input);
      // Then: 入力の 2 倍が返る
      expect(result).toBe(4);
    });

    // 境界値（最小値・最大値・境界±1）
    it("0 を渡すと、0 を返す（境界値: 最小）", () => {
      // Given/When/Then: 境界の下端
      expect(computeSomething(0)).toBe(0);
    });
  });

  // 異常系（無効入力・null/undefined・例外処理）
  describe("computeSomething - 異常系", () => {
    it("負の数を渡すと、RangeError を throw する", () => {
      // Given: 定義域外の入力 / When/Then: 例外がスローされる
      expect(() => computeSomething(-1)).toThrow(RangeError);
    });

    it("null を渡すと、TypeError を throw する", () => {
      // Given/When/Then: null 入力で型エラー
      // @ts-expect-error 異常系: 意図的に不正な型を渡す
      expect(() => computeSomething(null)).toThrow(TypeError);
    });
  });
});
```

> **必須**: この 3 観点（正常系 / 異常系 / 境界値）は Asana チケットの必須対応内容であり、被テスト対象ごとに最低 1 `it` ずつ生成する。境界が自明に存在しない純粋関数のみ境界値を省略可（省略理由をコメントで明示）。

### 2.2 依存性注入モック（本リポ標準 / `vi.fn()` + モックファクトリ）

**使い分け基準**: Repository・外部サービス等の外部依存を持つ UseCase / サービス層の検証に使う。**本リポの正典 `testing-strategy.md` §8「モックとスタブ」が定める標準パターン**。`vi.fn().mockResolvedValue(...)` でインターフェースを満たすモックファクトリ（`createMockXxx()`）を作り、依存性注入で差し込む。

```ts
import { describe, expect, it, vi } from "vitest";
import type { IUserRepository } from "@repo/server-core/domain/repository-interfaces/IUserRepository";

// __tests__/mocks/userRepository.mock.ts に切り出すのが望ましい
const createMockUserRepository = (): IUserRepository => ({
  find: vi.fn().mockResolvedValue({ isSuccess: true, value: { id: "1", email: "test@example.com" } }),
  create: vi.fn().mockResolvedValue({ isSuccess: true, value: { id: "1", email: "test@example.com" } }),
  // 他のメソッドも同様にモック
});

describe("UserUseCase", () => {
  describe("create", () => {
    it("有効なユーザーデータを渡すと、Repository の create が呼ばれる", async () => {
      // Given: モック Repository を注入した UseCase
      const mockRepo = createMockUserRepository();
      const useCase = new UserUseCase(mockRepo);
      // When: create を実行する
      await useCase.create({ email: "test@example.com", name: "Test User" });
      // Then: Repository の create が期待引数で呼ばれる
      expect(mockRepo.create).toHaveBeenCalledWith({ email: "test@example.com", name: "Test User" });
    });
  });

  describe("create - 異常系", () => {
    it("Repository が失敗を返すと、失敗結果を伝播する", async () => {
      // Given: 失敗を返すモック
      const mockRepo = createMockUserRepository();
      (mockRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue({ isSuccess: false });
      const useCase = new UserUseCase(mockRepo);
      // When/Then: 失敗結果がそのまま返る
      const result = await useCase.create({ email: "x@example.com", name: "X" });
      expect(result.isSuccess).toBe(false);
    });
  });
});
```

**ポイント**: `vi.fn()` の DI モックが本リポの標準。`vi.mock()` によるモジュール自動モックは使わず、インターフェース準拠のファクトリを注入する（`testing-strategy.md` §8 準拠）。

### 2.3 モジュールモック（`vi.resetModules` + 動的 `import()`、限定ケース）

**使い分け基準**: DI では差し替えられない、モジュールロード時の副作用（`process.cwd()` / 環境変数 / トップレベル初期化）に依存する対象に**限って**使う。通常の依存分離は §2.2 の DI モックを優先する。

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadTarget() {
  vi.resetModules();
  return import("./target-module");
}

describe("target-module", () => {
  const originalCwd = process.cwd();
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-"));
    process.chdir(tempRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("対象ファイルが存在すると、その内容を返す", async () => {
    // Given: 対象ファイルを一時ディレクトリに用意する
    fs.writeFileSync(path.join(tempRoot, "config.json"), '{"value":1}', "utf-8");
    // When: モジュールをフレッシュロードして読み出す
    const { readConfig } = await loadTarget();
    const result = readConfig();
    // Then: ファイルの内容に応じた値が返る
    expect(result.value).toBe(1);
  });
});
```

**ポイント**: `loadTarget()` ヘルパで `vi.resetModules()` → 動的 `import()` を1セットにし、`beforeEach`/`afterEach` で副作用（cwd・tmp dir・環境変数）を必ず初期化・後始末する。

### 2.4 非同期処理（async / reject）

**使い分け基準**: 対象が `Promise` を返す or `throw` する非同期関数の場合に使う。`await` 漏れは silent pass を生むので必須。

```ts
import { describe, expect, it } from "vitest";
import { fetchUser, validateInput } from "./async-module";

describe("非同期処理", () => {
  it("有効な ID を渡すと、ユーザーオブジェクトを返す", async () => {
    // Given: 有効なユーザー ID を用意する
    const userId = "user-123";
    // When: fetchUser を await で呼び出す
    const result = await fetchUser(userId);
    // Then: id フィールドが入力と一致する
    expect(result.id).toBe(userId);
  });

  it("空文字を渡すと、ValidationError を throw する", async () => {
    // Given: 空文字を入力として用意する
    const invalid = "";
    // When/Then: validateInput が rejection で失敗することを確認する
    await expect(validateInput(invalid)).rejects.toThrow("ValidationError");
  });
});
```

### 2.5 表駆動テスト（`it.each`）

**使い分け基準**: 同一ロジックを入力違いで複数検証する場合に使う。1 ケース 1 `it` で書くと冗長になるときの省力化。

```ts
import { describe, expect, it } from "vitest";
import { classify } from "./classifier";

describe("classify", () => {
  it.each([
    { input: 0, expected: "zero" },
    { input: 1, expected: "positive" },
    { input: -1, expected: "negative" },
  ])("入力が $input のとき、'$expected' を返す", ({ input, expected }) => {
    // Given: 表で定義した input / When: classify を呼び出す / Then: expected と一致
    const result = classify(input);
    expect(result).toBe(expected);
  });
});
```

### 2.6 完全サンプル: ユーティリティ関数

`.work/test-scenario-generator/generated/diff-1-format-currency.test.ts` 相当の出力例。

```ts
import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  // 正常系
  describe("formatCurrency", () => {
    it("整数の円金額を渡すと、3桁区切りと円記号を付けて返す", () => {
      // Given: 整数の金額
      const amount = 1234567;
      // When: formatCurrency を呼び出す
      const result = formatCurrency(amount, "JPY");
      // Then: 3桁区切り + 円記号付きの文字列が返る
      expect(result).toBe("¥1,234,567");
    });

    it("0 を渡すと、'¥0' を返す（境界値: 最小）", () => {
      // Given/When: 境界値 0 を渡す / Then: '¥0' になる
      expect(formatCurrency(0, "JPY")).toBe("¥0");
    });

    it("負の金額を渡すと、マイナス記号を先頭に付ける（境界値: 符号）", () => {
      // Given/When: 負の金額 / Then: マイナス記号付き
      expect(formatCurrency(-500, "JPY")).toBe("-¥500");
    });

    it.each([
      { currency: "USD", amount: 1234.5, expected: "$1,234.50" },
      { currency: "EUR", amount: 1000, expected: "€1,000.00" },
    ])("$currency 通貨で $amount を渡すと '$expected' を返す", ({ currency, amount, expected }) => {
      // Given/When/Then: 通貨ごとの整形を検証
      expect(formatCurrency(amount, currency)).toBe(expected);
    });
  });

  // 異常系
  describe("formatCurrency - 異常系", () => {
    it("未対応の通貨コードを渡すと、RangeError を throw する", () => {
      // Given/When/Then: 未知の通貨で例外
      expect(() => formatCurrency(1000, "XXX")).toThrow(RangeError);
    });

    it("金額に NaN を渡すと、TypeError を throw する", () => {
      // Given/When/Then: 数値でない入力
      expect(() => formatCurrency(Number.NaN, "JPY")).toThrow(TypeError);
    });
  });
});
```

## 3. Playwright テンプレート

### 3.1 基本 E2E（画面表示確認）

**使い分け基準**: 画面の初期表示・要素の存在確認に使う。最もシンプルなパターン。

```ts
import { expect, test } from "@playwright/test";

test.describe("トップページ", () => {
  test("ルートにアクセスすると、見出しが表示される", async ({ page }) => {
    // Given: トップページ URL（playwright.config.ts の baseURL が起点）
    // When: ルートに遷移する
    await page.goto("/");
    // Then: 見出しが見える
    await expect(page.getByRole("heading", { name: "ようこそ" })).toBeVisible();
  });
});
```

### 3.2 フォーム入力 + サブミット

**使い分け基準**: 入力 → 送信 → 遷移/結果確認 までを1本のテストでカバーする場合に使う。

```ts
import { expect, test } from "@playwright/test";

test.describe("お問い合わせフォーム", () => {
  test("必須項目を入力して送信すると、完了画面に遷移する", async ({ page }) => {
    // Given: フォーム画面を開く
    await page.goto("/contact");
    // When: 必須項目を入力して送信する
    await page.getByLabel("お名前").fill("山田太郎");
    await page.getByLabel("メールアドレス").fill("yamada@example.com");
    await page.getByLabel("お問い合わせ内容").fill("テスト送信です");
    await page.getByRole("button", { name: "送信" }).click();
    // Then: URL が完了画面に変わり、確認テキストが表示される
    await expect(page).toHaveURL(/\/contact\/done$/);
    await expect(page.getByText("送信が完了しました")).toBeVisible();
  });
});
```

### 3.3 ログイン状態を必要とするテスト

**使い分け基準**: 認証済みユーザーでないと到達できないページのテスト。実プロジェクトの認証構成（cookie/localStorage/SSO 等）によりセットアップ方法が変わるため、`storageState` ファイルの所在は対象パッケージ側に依存する点を必ずユーザーに確認すること。一般的には `playwright/.auth/user.json` を auth setup プロジェクトで生成する。

```ts
import { expect, test } from "@playwright/test";

// TODO: 実プロジェクトの storageState 出力先に合わせてパスを変更する
test.use({ storageState: "playwright/.auth/user.json" });

test.describe("マイページ", () => {
  test("ログイン済みでアクセスすると、ユーザー名が表示される", async ({ page }) => {
    // Given: storageState で認証済みのコンテキスト
    // When: マイページに遷移する
    await page.goto("/mypage");
    // Then: ユーザー名が表示される
    await expect(page.getByTestId("user-name")).toBeVisible();
  });
});
```

### 3.4 スクリーンショット取得

**使い分け基準**: 失敗時の証跡確保や、視覚的な確認が必要なケースで使う。出力先は **必ず** `.work/test-scenario-generator/generated/screenshots/` 配下に指定する。下記コード例の `path` は対象パッケージルートからの相対パス記法であり、Playwright 実行時は対象パッケージを `cwd` として解釈される。

```ts
import { expect, test } from "@playwright/test";

test("ダッシュボードのスクリーンショットを保存する", async ({ page }) => {
  // Given: ダッシュボードを開く
  await page.goto("/dashboard");
  // When: ページ全体のスクリーンショットを撮影する
  // NOTE: path は対象パッケージルートからの相対パスとして解釈される
  await page.screenshot({
    path: ".work/test-scenario-generator/generated/screenshots/dashboard.png",
    fullPage: true,
  });
  // Then: 主要KPIラベルが存在する（撮影が成功した間接確認）
  await expect(page.getByText("売上")).toBeVisible();
});
```

### 3.5 ベース URL の扱い

`page.goto("/...")` のような相対 URL は対象パッケージの `playwright.config.ts` の `use.baseURL` に依存する。

- 既存設定がある場合: 相対 URL を採用し、設定を尊重する
- 設定が無い場合: フルパス URL（例: `http://localhost:3000/contact`）で生成し、SKILL.md Step 6 でユーザーに baseURL 設定の有無を確認する
- 環境別に切り替える場合: `process.env.E2E_BASE_URL` を `playwright.config.ts` で読む構成を踏襲し、テストコード内で直接 URL を書かない

### 3.6 完全サンプル: ログインフロー

`.work/test-scenario-generator/generated/nl-1-login.spec.ts` 相当の出力例。

```ts
import { expect, test } from "@playwright/test";

test.describe("ログインフロー", () => {
  test("正しい認証情報でログインすると、ダッシュボードに遷移する", async ({ page }) => {
    // Given: ログイン画面を開く
    await page.goto("/login");
    // When: 正しいメールとパスワードを入力して送信する
    await page.getByLabel("メールアドレス").fill("test-user@example.com");
    await page.getByLabel("パスワード").fill("password123");
    await page.getByRole("button", { name: "ログイン" }).click();
    // Then: ダッシュボードに遷移し、ようこそメッセージが表示される
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "ようこそ" })).toBeVisible();
  });

  test("誤ったパスワードでログインすると、エラーメッセージが表示される（異常系）", async ({ page }) => {
    // Given: ログイン画面を開く / When: 誤ったパスワードで送信する
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill("test-user@example.com");
    await page.getByLabel("パスワード").fill("wrong-password");
    await page.getByRole("button", { name: "ログイン" }).click();
    // Then: URL は変わらず、エラーメッセージが表示される
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("alert")).toContainText("認証に失敗しました");
  });
});
```

## 4. passing-by-accident の防止

「テストは pass しているがバグを検出していない」状態を防ぐためのガード。

### 禁止パターン

```ts
// 意味のない常成立アサーション（生成失敗扱い）
expect(true).toBe(true);
expect(1).toBe(1);
// expect を含まない it（生成失敗扱い）
it("動くはず", () => { someFunction(); });
// 常に成立する条件
if (false) { expect(result).toBe(expected); }
```

### 推奨パターン

```ts
// 入力 → 期待出力 の対応を明示する
expect(formatCurrency(1000, "JPY")).toBe("¥1,000");
// エッジケース（空配列・null・境界値）を別 it ブロックで明示する
it("空配列を渡すと、空配列を返す", () => { expect(dedupe([])).toEqual([]); });
it("最大値 + 1 を渡すと、RangeError を throw する", () => {
  expect(() => addItem(MAX + 1)).toThrow(RangeError);
});
```

### Step 5 チェッカー仕様

`SKILL.md` Step 5 のチェッカーは以下を実施する:

- `Grep "expect(" {生成ファイル}` の hit 数をカウント
- 0 件 → **再生成必須**（テストとして成立していない）
- `it(` の出現数 > `expect(` の出現数 → **警告強調**して該当ファイルをユーザーに見せる
- 通過後も「生成テストは目視レビュー必須」を Step 9 の完了報告に明記する

## 5. 既存テストスタイルへの適合

生成前に **必ず** 対象パッケージ内の既存テストを最大 3 件 Read し、以下を確認する（`SKILL.md` Step 4）。既存と異なるスタイル（ESLint で禁止された書式等）は持ち込まない。einja 慣例（`einja-coding-standards` の `testing-strategy.md`）は「既存が無い／矛盾が無い」ときのデフォルトとして適用する。

| 観点 | 反映方針（einja 標準 = `testing-strategy.md`） |
|------|---------|
| import スタイル | 既存に合わせる。einja 標準は名前付き import |
| describe 階層 | 既存を踏襲。einja 標準は 2 階層（対象名 → メソッド名 + 正常系/異常系分離） |
| it 命名 | 既存を踏襲。einja 標準は日本語の「〜すると、〜になる」形式 |
| Given/When/Then コメント | 既存にあれば踏襲、無くても追加可 |
| モック方針 | 既存を踏襲。einja 標準は `vi.fn()` を使った依存性注入モックファクトリ（`testing-strategy.md` §8）。`vi.resetModules` + 動的 import はモジュール副作用依存の限定ケースのみ |
| ファイル配置（`__tests__/` / `tests/` / 隣接） | 既存ディレクトリに揃える |
| Playwright のロケータ（`getByRole`/`getByLabel`/`getByTestId`） | 既存の優先順を踏襲 |

## 6. ファイル末尾の生成テンプレート

実プロジェクトに依存する import パスや認証セットアップは `// TODO:` コメントで明示する。

### Vitest スケルトン（`{scenario-id}-{feature}.test.ts`）

```ts
import { describe, expect, it } from "vitest";
// TODO: 対象モジュールの import パスを実プロジェクトに合わせて修正する
import { /* targetFunction */ } from "./target-module";

describe("<対象クラス/関数名>", () => {
  // 正常系（+ 境界値）
  describe("<メソッド名/機能名>", () => {
    it("<条件>すると、<結果>になる", () => {
      // Given: <前提となる入力・状態>
      const input = /* TODO */ null;
      // When: <実行する操作>
      const result = /* TODO: targetFunction(input) */ null;
      // Then: <期待される結果>
      expect(result).toBe(/* TODO: expected */ null);
    });

    it("<境界値の条件>すると、<結果>になる（境界値）", () => {
      // Given/When/Then: 最小値・最大値・境界±1 のいずれか
      expect(/* TODO: targetFunction(boundary) */ null).toBe(/* TODO */ null);
    });
  });

  // 異常系（無効入力・null/undefined・例外処理）
  describe("<メソッド名/機能名> - 異常系", () => {
    it("<無効な条件>すると、<エラー>になる", () => {
      // Given/When/Then: 不正入力で例外がスローされる
      expect(() => /* TODO: targetFunction(invalid) */ null).toThrow(/* TODO: ErrorType */);
    });
  });
});
```

### Playwright スケルトン（`{scenario-id}-{feature}.spec.ts`）

```ts
import { expect, test } from "@playwright/test";

// TODO: 認証が必要な場合は storageState を有効化する
// test.use({ storageState: "playwright/.auth/user.json" });

test.describe("<scenario-id>: <feature 概要>", () => {
  test("<観測可能な振る舞いの文>", async ({ page }) => {
    // Given: <初期状態>
    // TODO: baseURL が未設定なら絶対 URL に置き換える
    await page.goto("/");
    // When: <ユーザー操作>
    // TODO: page.getByRole / getByLabel で要素を取得して操作
    // Then: <期待される結果>
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
```

## 関連 references

- `./input-routing.md` — 2 種入力（git diff/自然言語）の判定木
- `./judgment-rules.md` — unit vs E2E（Vitest vs Playwright）の自動分類ルール
- `./output-format.md` — 出力ファイルの命名規約・配置ルール・実行ログフォーマット
