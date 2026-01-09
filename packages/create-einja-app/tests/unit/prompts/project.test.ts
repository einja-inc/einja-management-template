import { describe, it, expect, vi, beforeEach } from "vitest";
import inquirer from "inquirer";
import {
  promptProjectConfig,
  type ProjectConfig,
} from "../../../src/prompts/project";

// inquirerのpromptメソッドをモック化
vi.mock("inquirer");

describe("promptProjectConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("デフォルト値でプロジェクト設定が返される", async () => {
    // Given: デフォルト値を含むプロンプト回答
    const mockAnswers = {
      projectName: "my-project",
      packageScope: "@repo",
      template: "turborepo-pandacss",
      authMethod: "google",
      tools: ["direnv", "dotenvx", "volta"],
      setupEinjaCli: true,
      customizeWorktree: false,
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: ProjectConfig = await promptProjectConfig();

    // Then: ProjectConfigが返される
    expect(result).toEqual({
      projectName: "my-project",
      packageScope: "@repo",
      template: "turborepo-pandacss",
      authMethod: "google",
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
        biome: true,
        husky: true,
      },
      setupEinjaCli: true,
      worktreeConfig: undefined,
    });
  });

  it("カスタムプロジェクト名が指定された場合、そのプロジェクト名が返される", async () => {
    // Given: カスタムプロジェクト名
    const mockAnswers = {
      projectName: "custom-project",
      packageScope: "@custom",
      template: "minimal",
      authMethod: "credentials",
      tools: ["direnv"],
      setupEinjaCli: false,
      customizeWorktree: false,
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: ProjectConfig = await promptProjectConfig("custom-project");

    // Then: カスタム設定が返される
    expect(result.projectName).toBe("custom-project");
    expect(result.packageScope).toBe("@custom");
    expect(result.template).toBe("minimal");
    expect(result.authMethod).toBe("credentials");
    expect(result.tools.direnv).toBe(true);
    expect(result.tools.dotenvx).toBe(false);
    expect(result.tools.volta).toBe(false);
    expect(result.tools.biome).toBe(true);
    expect(result.tools.husky).toBe(true);
    expect(result.setupEinjaCli).toBe(false);
  });

  it("認証なしを選択した場合、authMethodがnoneになる", async () => {
    // Given: 認証なしの設定
    const mockAnswers = {
      projectName: "no-auth-project",
      packageScope: "@repo",
      template: "turborepo-pandacss",
      authMethod: "none",
      tools: [],
      setupEinjaCli: true,
      customizeWorktree: false,
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: ProjectConfig = await promptProjectConfig();

    // Then: authMethodがnoneになる
    expect(result.authMethod).toBe("none");
    expect(result.tools.direnv).toBe(false);
    expect(result.tools.dotenvx).toBe(false);
    expect(result.tools.volta).toBe(false);
  });

  it("Worktree設定をカスタマイズする場合、worktreeConfigが設定される", async () => {
    // Given: Worktree設定カスタマイズ
    const mockAnswers = {
      projectName: "worktree-project",
      packageScope: "@repo",
      template: "turborepo-pandacss",
      authMethod: "google",
      tools: ["direnv", "dotenvx", "volta"],
      setupEinjaCli: true,
      customizeWorktree: true,
    };

    const mockWorktreeAnswers = {
      postgresPort: "25432",
      containerName: "worktree-project-postgres",
      appId: "web",
      portRangeStart: "3000",
      rangeSize: "1000",
    };

    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce(mockAnswers)
      .mockResolvedValueOnce(mockWorktreeAnswers);

    // When: プロンプト実行
    const result: ProjectConfig = await promptProjectConfig();

    // Then: worktreeConfigが設定される
    expect(result.worktreeConfig).toBeDefined();
    expect(result.worktreeConfig?.postgres.port).toBe(25432);
    expect(result.worktreeConfig?.postgres.containerName).toBe(
      "worktree-project-postgres"
    );
    expect(result.worktreeConfig?.apps).toHaveLength(1);
    expect(result.worktreeConfig?.apps?.[0]?.id).toBe("web");
    expect(result.worktreeConfig?.apps?.[0]?.portRangeStart).toBe(3000);
    expect(result.worktreeConfig?.apps?.[0]?.rangeSize).toBe(1000);
  });

  it("GitHub OAuth認証を選択した場合、authMethodがgithubになる", async () => {
    // Given: GitHub OAuth認証の設定
    const mockAnswers = {
      projectName: "github-auth-project",
      packageScope: "@repo",
      template: "turborepo-pandacss",
      authMethod: "github",
      tools: ["direnv", "dotenvx", "volta"],
      setupEinjaCli: true,
      customizeWorktree: false,
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: ProjectConfig = await promptProjectConfig();

    // Then: authMethodがgithubになる
    expect(result.authMethod).toBe("github");
  });
});
