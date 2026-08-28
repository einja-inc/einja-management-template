import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectSyncFiles } from "@/generators/sync.js";

/**
 * collectSyncFiles のフィルタリング動作テスト
 *
 * apps/packages カテゴリに対する詳細フィルタ（appsDetail / packagesDetail）が
 * 正しく動作することを検証する。
 *
 * テンプレートディレクトリ全体を mock するのではなく、
 * 一時ディレクトリに必要な最小限のファイル構造を作成して検証する。
 */
describe("collectSyncFiles - apps/packages 詳細フィルタ", { concurrent: false }, () => {
  // テスト用一時テンプレートディレクトリ
  const testTemplateDir = join(process.cwd(), "test-temp-sync-template");

  /**
   * テスト用テンプレートを作成
   *
   * 構造:
   *   apps/web/page.tsx
   *   apps/admin/page.tsx
   *   packages/admin-ui/index.ts
   *   packages/ui/button.tsx
   */
  function setupMockTemplate(): void {
    mkdirSync(join(testTemplateDir, "apps/web"), { recursive: true });
    mkdirSync(join(testTemplateDir, "apps/admin"), { recursive: true });
    mkdirSync(join(testTemplateDir, "packages/admin-ui"), { recursive: true });
    mkdirSync(join(testTemplateDir, "packages/ui"), { recursive: true });

    writeFileSync(join(testTemplateDir, "apps/web/page.tsx"), "// web", "utf-8");
    writeFileSync(join(testTemplateDir, "apps/admin/page.tsx"), "// admin", "utf-8");
    writeFileSync(join(testTemplateDir, "packages/admin-ui/index.ts"), "// admin-ui", "utf-8");
    writeFileSync(join(testTemplateDir, "packages/ui/button.tsx"), "// ui", "utf-8");
  }

  beforeEach(() => {
    if (existsSync(testTemplateDir)) {
      rmSync(testTemplateDir, { recursive: true, force: true });
    }
    setupMockTemplate();
  });

  afterEach(() => {
    if (existsSync(testTemplateDir)) {
      rmSync(testTemplateDir, { recursive: true, force: true });
    }
  });

  it("packagesDetail に admin-ui を指定すると packages/admin-ui/** のみが収集される", async () => {
    // Given: categories=["packages"], packagesDetail=["admin-ui"]
    // When: collectSyncFiles を実行
    const files = await collectSyncFiles(
      testTemplateDir,
      ["packages"],
      undefined,
      ["admin-ui"]
    );

    // Then: packages/admin-ui のファイルのみが含まれる
    expect(files).toContain("packages/admin-ui/index.ts");
    // packages/ui は対象外
    expect(files).not.toContain("packages/ui/button.tsx");
    // 件数も検証（admin-ui には index.ts 1 ファイルのみ）
    expect(files).toHaveLength(1);
    expect(files.every((f) => f.startsWith("packages/admin-ui/"))).toBe(true);
  });

  it("appsDetail に web を指定すると apps/web/** のみが収集される", async () => {
    // Given: categories=["apps"], appsDetail=["web"]
    // When: collectSyncFiles を実行
    const files = await collectSyncFiles(
      testTemplateDir,
      ["apps"],
      ["web"],
      undefined
    );

    // Then: apps/web のファイルのみが含まれる
    expect(files).toContain("apps/web/page.tsx");
    // apps/admin は対象外
    expect(files).not.toContain("apps/admin/page.tsx");
    // 件数も検証（web には page.tsx 1 ファイルのみ）
    expect(files).toHaveLength(1);
    expect(files.every((f) => f.startsWith("apps/web/"))).toBe(true);
  });

  it("packagesDetail に空配列を渡すと全 packages がマッチする", async () => {
    // Given: categories=["packages"], packagesDetail=[]
    // 空配列は「詳細指定なし」として扱われ、packages/** 全てが収集される
    const files = await collectSyncFiles(testTemplateDir, ["packages"], undefined, []);

    // Then: packages 配下の全ファイルが含まれる
    expect(files).toContain("packages/admin-ui/index.ts");
    expect(files).toContain("packages/ui/button.tsx");
    expect(files).toHaveLength(2);
  });

  it("packagesDetail に複数指定すると指定された全 packages がマッチする", async () => {
    // Given: categories=["packages"], packagesDetail=["admin-ui", "ui"]
    const files = await collectSyncFiles(
      testTemplateDir,
      ["packages"],
      undefined,
      ["admin-ui", "ui"]
    );

    // Then: admin-ui と ui の両方のファイルが含まれる
    expect(files).toContain("packages/admin-ui/index.ts");
    expect(files).toContain("packages/ui/button.tsx");
    expect(files).toHaveLength(2);
  });

  it("packagesDetail に存在しない名前を渡すと0件返る", async () => {
    // Given: categories=["packages"], packagesDetail=["nonexistent"]
    const files = await collectSyncFiles(
      testTemplateDir,
      ["packages"],
      undefined,
      ["nonexistent"]
    );

    // Then: マッチするファイルがないため空配列
    expect(files).toEqual([]);
    expect(files).toHaveLength(0);
  });

  it("appsDetail と packagesDetail を同時指定し、categories=['apps', 'packages'] でそれぞれフィルタされる", async () => {
    // Given: categories=["apps", "packages"], appsDetail=["web"], packagesDetail=["admin-ui"]
    const files = await collectSyncFiles(
      testTemplateDir,
      ["apps", "packages"],
      ["web"],
      ["admin-ui"]
    );

    // Then: apps/web と packages/admin-ui のみが収集される
    expect(files).toContain("apps/web/page.tsx");
    expect(files).toContain("packages/admin-ui/index.ts");
    // apps/admin と packages/ui は対象外
    expect(files).not.toContain("apps/admin/page.tsx");
    expect(files).not.toContain("packages/ui/button.tsx");
    expect(files).toHaveLength(2);
  });
});
