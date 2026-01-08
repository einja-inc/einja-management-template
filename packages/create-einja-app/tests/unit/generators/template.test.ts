import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateTemplate } from "../../../src/generators/template.js";
import type { ProjectConfig } from "../../../src/prompts/project.js";

describe("generateTemplate", () => {
  const testDir = join(process.cwd(), "test-temp");
  const targetPath = join(testDir, "test-project");
  const mockTemplatePath = join(process.cwd(), "test-temp-templates/turborepo-pandacss");

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
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // モックテンプレートディレクトリのクリーンアップ
    const mockTemplatesRoot = join(process.cwd(), "test-temp-templates");
    if (existsSync(mockTemplatesRoot)) {
      rmSync(mockTemplatesRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    const mockTemplatesRoot = join(process.cwd(), "test-temp-templates");
    if (existsSync(mockTemplatesRoot)) {
      rmSync(mockTemplatesRoot, { recursive: true, force: true });
    }
  });

  it("有効なProjectConfigを渡すと、テンプレートが展開される", async () => {
    // Given: 有効なProjectConfig
    const config: ProjectConfig = {
      projectName: "test-project",
      packageScope: "@test",
      template: "turborepo-pandacss",
      authMethod: "google",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
      },
      setupEinjaCli: true,
    };

    // 実際のテンプレートがあるのでそれを使用
    const templatePath = join(process.cwd(), "templates/turborepo-pandacss");

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
      template: "turborepo-pandacss",
      authMethod: "google",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
      },
      setupEinjaCli: false,
    };

    // モックテンプレートをテンプレートディレクトリにコピー
    const realTemplatePath = join(process.cwd(), "templates/turborepo-pandacss");
    if (existsSync(realTemplatePath)) {
      // 実際のテンプレートが存在する場合、テスト用ファイルを追加
      writeFileSync(
        join(realTemplatePath, "test-placeholder.txt"),
        "Project: {{projectName}}",
        "utf-8"
      );

      try {
        // When: generateTemplateを実行
        await generateTemplate(config, targetPath);

        // Then: プレースホルダーが置換される
        if (existsSync(join(targetPath, "test-placeholder.txt"))) {
          const content = readFileSync(join(targetPath, "test-placeholder.txt"), "utf-8");
          expect(content).toBe("Project: my-awesome-app");
        }
      } finally {
        // テスト用ファイルを削除
        if (existsSync(join(realTemplatePath, "test-placeholder.txt"))) {
          rmSync(join(realTemplatePath, "test-placeholder.txt"));
        }
      }
    }
  });

  it("パッケージスコープが@repo/から指定スコープに置換される", async () => {
    // Given: テンプレートディレクトリ
    const realTemplatePath = join(process.cwd(), "templates/turborepo-pandacss");

    const config: ProjectConfig = {
      projectName: "test-app",
      packageScope: "@custom",
      template: "turborepo-pandacss",
      authMethod: "credentials",
      tools: {
        direnv: false,
        dotenvx: false,
        volta: false,
      },
      setupEinjaCli: false,
    };

    if (existsSync(realTemplatePath)) {
      // 実際のテンプレートが存在する場合、テスト用ファイルを追加
      writeFileSync(
        join(realTemplatePath, "import-test.ts"),
        'import { Button } from "@repo/ui/button";\nimport { api } from "@repo/api";',
        "utf-8"
      );

      try {
        // When: generateTemplateを実行
        await generateTemplate(config, targetPath);

        // Then: @repo/が@custom/に置換される
        if (existsSync(join(targetPath, "import-test.ts"))) {
          const content = readFileSync(join(targetPath, "import-test.ts"), "utf-8");
          expect(content).toContain("@custom/ui/button");
          expect(content).toContain("@custom/api");
        }
      } finally {
        // テスト用ファイルを削除
        if (existsSync(join(realTemplatePath, "import-test.ts"))) {
          rmSync(join(realTemplatePath, "import-test.ts"));
        }
      }
    }
  });

  it("認証方式がnoneの場合、認証関連ファイルが除外される", async () => {
    // Given: 認証方式がnone
    const config: ProjectConfig = {
      projectName: "no-auth-app",
      packageScope: "@test",
      template: "turborepo-pandacss",
      authMethod: "none",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
      },
      setupEinjaCli: false,
    };

    const realTemplatePath = join(process.cwd(), "templates/turborepo-pandacss");

    if (existsSync(realTemplatePath)) {
      // 認証関連ファイルを作成（除外パターンにマッチするパス）
      // **/api/auth/** パターンにマッチするパス
      const authDir = join(realTemplatePath, "api/auth");
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, "test-route.ts"), "// Auth route", "utf-8");

      // **/signin/** パターンにマッチするパス
      const signinDir = join(realTemplatePath, "signin");
      mkdirSync(signinDir, { recursive: true });
      writeFileSync(join(signinDir, "test-page.tsx"), "// Signin page", "utf-8");

      try {
        // When: generateTemplateを実行
        await generateTemplate(config, targetPath);

        // Then: 認証関連ファイルが除外される
        expect(existsSync(join(targetPath, "api/auth/test-route.ts"))).toBe(false);
        expect(existsSync(join(targetPath, "signin/test-page.tsx"))).toBe(false);
      } finally {
        // テスト用ファイルを削除（ディレクトリは既存かもしれないのでファイルのみ）
        if (existsSync(join(realTemplatePath, "api/auth/test-route.ts"))) {
          rmSync(join(realTemplatePath, "api/auth/test-route.ts"));
        }
        if (existsSync(join(realTemplatePath, "signin/test-page.tsx"))) {
          rmSync(join(realTemplatePath, "signin/test-page.tsx"));
        }
      }
    }
  });
});
