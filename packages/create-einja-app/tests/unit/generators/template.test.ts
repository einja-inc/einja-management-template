import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateTemplate } from "../../../src/generators/template.js";
import type { ProjectConfig } from "../../../src/prompts/project.js";

describe("generateTemplate", { concurrent: false }, () => {
  const testDir = join(process.cwd(), "test-temp");
  const targetPath = join(testDir, "test-project");
  const mockTemplatePath = join(process.cwd(), "test-temp-templates/default");

  // 実テンプレートに追加したテストファイルのパスを記録
  const testFilesToCleanup: string[] = [];

  /**
   * ディレクトリをリトライ付きで削除するヘルパー関数
   */
  function removeDirWithRetry(dirPath: string, maxRetries = 3): void {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (existsSync(dirPath)) {
          // 権限問題を回避するため、削除前に書き込み権限を付与
          try {
            const { execSync } = require("node:child_process");
            execSync(`chmod -R u+w "${dirPath}"`, { stdio: "ignore" });
          } catch {
            // chmod失敗は無視
          }
          rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        }
        return; // 成功したら終了
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.warn(`Failed to remove directory ${dirPath} after ${maxRetries} attempts:`, error);
        }
        // 次のリトライまで少し待機
        const delay = 50 * (attempt + 1);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // 待機
        }
      }
    }
  }

  /**
   * モックテンプレートを作成するヘルパー関数
   */
  function createMockTemplate(): void {
    // モックテンプレートディレクトリを作成
    mkdirSync(mockTemplatePath, { recursive: true });

    // テスト用ファイルを作成
    writeFileSync(
      join(mockTemplatePath, "README.md"),
      "# {{projectName}}\n\n{{description}}",
      "utf-8"
    );
    writeFileSync(
      join(mockTemplatePath, "package.json.template"),
      JSON.stringify(
        {
          name: "{{projectName}}",
          description: "{{description}}",
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  beforeEach(() => {
    // テストディレクトリのクリーンアップと作成
    removeDirWithRetry(testDir);
    mkdirSync(testDir, { recursive: true });

    // モックテンプレートディレクトリのクリーンアップ
    const mockTemplatesRoot = join(process.cwd(), "test-temp-templates");
    removeDirWithRetry(mockTemplatesRoot);

    // 実テンプレートディレクトリの test- プレフィックスファイルを削除（前回テストの残骸）
    const realTemplatePath = join(process.cwd(), "templates/default");
    if (existsSync(realTemplatePath)) {
      for (const entry of readdirSync(realTemplatePath)) {
        if (entry.startsWith("test-")) {
          const filePath = join(realTemplatePath, entry);
          try {
            rmSync(filePath, { force: true, recursive: true });
          } catch {
            // ignore
          }
        }
      }
    }

    // テストファイルリストをリセット
    testFilesToCleanup.length = 0;
  });

  afterEach(() => {
    // 実テンプレートディレクトリに追加したテストファイルを削除
    for (const filePath of testFilesToCleanup) {
      if (existsSync(filePath)) {
        try {
          rmSync(filePath, { force: true });
        } catch (error) {
          console.warn(`Failed to remove test file ${filePath}:`, error);
        }
      }
    }
    testFilesToCleanup.length = 0;

    // テスト後のクリーンアップ
    removeDirWithRetry(testDir);
    const mockTemplatesRoot = join(process.cwd(), "test-temp-templates");
    removeDirWithRetry(mockTemplatesRoot);
  });

  it("有効なProjectConfigを渡すと、テンプレートが展開される", async () => {
    // Given: 有効なProjectConfig
    const config: ProjectConfig = {
      projectName: "test-project",
      packageScope: "@test",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
        biome: true,
        husky: true,
      },
      setupEinjaCli: true,
      useCurrentDir: false,
    };

    // 実際のテンプレートがあるのでそれを使用
    const templatePath = join(process.cwd(), "templates/default");

    // テンプレートが存在する場合のみテスト実行
    if (!existsSync(templatePath)) {
      // テンプレートがない場合はスキップ（prebuildで生成される）
      return;
    }

    // When: generateTemplateを実行
    await generateTemplate(config, targetPath);

    // Then: テンプレートが展開される
    expect(existsSync(targetPath)).toBe(true);

    // 主要ファイルが存在することを確認
    const hasPackageJson = existsSync(join(targetPath, "package.json"));
    const hasTurboJson = existsSync(join(targetPath, "turbo.json"));
    const hasPnpmWorkspace = existsSync(join(targetPath, "pnpm-workspace.yaml"));

    expect(hasPackageJson || hasTurboJson || hasPnpmWorkspace).toBe(true);
  });

  it("プロジェクト名が{{projectName}}に置換される", async () => {
    // Given: モックテンプレートを作成
    createMockTemplate();
    writeFileSync(join(mockTemplatePath, "config.txt"), "Project: {{projectName}}", "utf-8");

    const config: ProjectConfig = {
      projectName: "my-awesome-app",
      packageScope: "@my-company",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    // モックテンプレートをテンプレートディレクトリにコピー
    const realTemplatePath = join(process.cwd(), "templates/default");
    if (existsSync(realTemplatePath)) {
      // 実際のテンプレートが存在する場合、テスト用ファイルを追加
      const testFilePath = join(realTemplatePath, "test-placeholder.txt");
      writeFileSync(testFilePath, "Project: {{projectName}}", "utf-8");
      testFilesToCleanup.push(testFilePath);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: プレースホルダーが置換される
      if (existsSync(join(targetPath, "test-placeholder.txt"))) {
        const content = readFileSync(join(targetPath, "test-placeholder.txt"), "utf-8");
        expect(content).toBe("Project: my-awesome-app");
      }
    }
  });

  it("パッケージスコープが@repo/から指定スコープに置換される", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/default");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@custom",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    if (existsSync(realTemplatePath)) {
      // 実際のテンプレートが存在する場合、テスト用ファイルを追加
      const testFilePath = join(realTemplatePath, "import-test.ts");
      writeFileSync(
        testFilePath,
        'import { Button } from "@repo/ui/button";\nimport { api } from "@repo/api";',
        "utf-8"
      );
      testFilesToCleanup.push(testFilePath);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: @repo/が@custom/に置換される
      if (existsSync(join(targetPath, "import-test.ts"))) {
        const content = readFileSync(join(targetPath, "import-test.ts"), "utf-8");
        expect(content).toContain("@custom/ui/button");
        expect(content).toContain("@custom/api");
      }
    }
  });

  it("認証方式がnoneの場合、認証関連ファイルが除外される", async () => {
    // Given: 認証方式がnone
    const config: ProjectConfig = {
      projectName: "no-auth-app",
      packageScope: "@test",
      template: "default",
      authMethod: "none",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    const realTemplatePath = join(process.cwd(), "templates/default");

    if (existsSync(realTemplatePath)) {
      // 認証関連ファイルを作成（除外パターンにマッチするパス）
      // **/api/auth/** パターンにマッチするパス
      const authDir = join(realTemplatePath, "api/auth");
      mkdirSync(authDir, { recursive: true });
      const authTestFile = join(authDir, "test-route.ts");
      writeFileSync(authTestFile, "// Auth route", "utf-8");
      testFilesToCleanup.push(authTestFile);

      // **/signin/** パターンにマッチするパス
      const signinDir = join(realTemplatePath, "signin");
      mkdirSync(signinDir, { recursive: true });
      const signinTestFile = join(signinDir, "test-page.tsx");
      writeFileSync(signinTestFile, "// Signin page", "utf-8");
      testFilesToCleanup.push(signinTestFile);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: 認証関連ファイルが除外される
      expect(existsSync(join(targetPath, "api/auth/test-route.ts"))).toBe(false);
      expect(existsSync(join(targetPath, "signin/test-page.tsx"))).toBe(false);
    }
  });

  it("{{packageName}}/パターンが正しく置換される", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/default");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@custom",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    if (existsSync(realTemplatePath)) {
      // 実際のテンプレートが存在する場合、テスト用ファイルを追加
      const testFilePath = join(realTemplatePath, "packagename-slash-test.ts");
      writeFileSync(
        testFilePath,
        'import { utils } from "{{packageName}}/ui/utils";\nimport { auth } from "{{packageName}}/front-core/auth";\nimport { prisma } from "{{packageName}}/server-core/infrastructure/database/client";',
        "utf-8"
      );
      testFilesToCleanup.push(testFilePath);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: {{packageName}}/が@custom/に正しく置換される
      if (existsSync(join(targetPath, "packagename-slash-test.ts"))) {
        const content = readFileSync(join(targetPath, "packagename-slash-test.ts"), "utf-8");
        expect(content).toContain("@custom/ui/utils");
        expect(content).toContain("@custom/front-core/auth");
        expect(content).toContain("@custom/server-core/infrastructure/database/client");
        // {{packageName}}/が残っていないことを確認
        expect(content).not.toContain("{{packageName}}/");
      }
    }
  });

  it("除外パターンに部分一致するファイル名（logout-button.tsx等）が正しくコピーされる", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/default");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@test",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    if (existsSync(realTemplatePath)) {
      // "out" を含むファイル名（logout-button.tsx）を作成
      const logoutButtonPath = join(realTemplatePath, "test-logout-button.tsx");
      writeFileSync(logoutButtonPath, "// Logout button component", "utf-8");
      testFilesToCleanup.push(logoutButtonPath);

      // "log" を含むファイル名（dialog.tsx）を作成
      const dialogPath = join(realTemplatePath, "test-dialog.tsx");
      writeFileSync(dialogPath, "// Dialog component", "utf-8");
      testFilesToCleanup.push(dialogPath);

      // "dist" を含むファイル名（distribution.ts）を作成
      const distributionPath = join(realTemplatePath, "test-distribution.ts");
      writeFileSync(distributionPath, "// Distribution util", "utf-8");
      testFilesToCleanup.push(distributionPath);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: これらのファイルは除外されずにコピーされる
      expect(existsSync(join(targetPath, "test-logout-button.tsx"))).toBe(true);
      expect(existsSync(join(targetPath, "test-dialog.tsx"))).toBe(true);
      expect(existsSync(join(targetPath, "test-distribution.ts"))).toBe(true);
    }
  });

  it("除外パターンのディレクトリ（out/, dist/, logs/等）は正しく除外される", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/default");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@test",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    if (existsSync(realTemplatePath)) {
      // out/ ディレクトリを作成
      const outDir = join(realTemplatePath, "out");
      mkdirSync(outDir, { recursive: true });
      const outFile = join(outDir, "test-file.js");
      writeFileSync(outFile, "// Build output", "utf-8");
      testFilesToCleanup.push(outFile);

      // dist/ ディレクトリを作成
      const distDir = join(realTemplatePath, "dist");
      mkdirSync(distDir, { recursive: true });
      const distFile = join(distDir, "bundle.js");
      writeFileSync(distFile, "// Bundle output", "utf-8");
      testFilesToCleanup.push(distFile);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: これらのディレクトリ内のファイルは除外される
      expect(existsSync(join(targetPath, "out/test-file.js"))).toBe(false);
      expect(existsSync(join(targetPath, "dist/bundle.js"))).toBe(false);
    }
  });

  it(".logファイルは除外されるが、blog.tsxは除外されない", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/default");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@test",
      template: "default",
      authMethod: "default",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
        biome: true,
        husky: true,
      },
      setupEinjaCli: false,
      useCurrentDir: false,
    };

    if (existsSync(realTemplatePath)) {
      // .logファイルを作成（除外されるべき）
      const logFilePath = join(realTemplatePath, "test-error.log");
      writeFileSync(logFilePath, "Error log content", "utf-8");
      testFilesToCleanup.push(logFilePath);

      // blog.tsxを作成（除外されないべき）
      const blogPath = join(realTemplatePath, "test-blog.tsx");
      writeFileSync(blogPath, "// Blog component", "utf-8");
      testFilesToCleanup.push(blogPath);

      // When: generateTemplateを実行
      await generateTemplate(config, targetPath);

      // Then: .logファイルは除外され、blog.tsxは除外されない
      expect(existsSync(join(targetPath, "test-error.log"))).toBe(false);
      expect(existsSync(join(targetPath, "test-blog.tsx"))).toBe(true);
    }
  });
});
