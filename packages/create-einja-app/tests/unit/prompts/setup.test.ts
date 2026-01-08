import { describe, it, expect, vi, beforeEach } from "vitest";
import inquirer from "inquirer";
import {
  promptSetupConfig,
  type SetupConfig,
} from "../../../src/prompts/setup";

// inquirerのpromptメソッドをモック化
vi.mock("inquirer");

describe("promptSetupConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("デフォルト値でセットアップ設定が返される", async () => {
    // Given: デフォルト値を含むプロンプト回答
    const mockAnswers = {
      tools: ["direnv", "dotenvx", "volta"],
      conflictStrategy: "merge",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: SetupConfigが返される
    expect(result).toEqual({
      tools: {
        direnv: true,
        dotenvx: true,
        volta: true,
        biome: false,
        husky: false,
      },
      conflictStrategy: "merge",
    });
  });

  it("Biomeのみを選択した場合、Biomeのみがtrueになる", async () => {
    // Given: Biomeのみを選択
    const mockAnswers = {
      tools: ["biome"],
      conflictStrategy: "merge",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: Biomeのみtrueになる
    expect(result.tools.direnv).toBe(false);
    expect(result.tools.dotenvx).toBe(false);
    expect(result.tools.volta).toBe(false);
    expect(result.tools.biome).toBe(true);
    expect(result.tools.husky).toBe(false);
  });

  it("Huskyを含むツールを選択した場合、Huskyがtrueになる", async () => {
    // Given: Huskyを含むツール選択
    const mockAnswers = {
      tools: ["biome", "husky"],
      conflictStrategy: "overwrite",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: BiomeとHuskyがtrueになる
    expect(result.tools.biome).toBe(true);
    expect(result.tools.husky).toBe(true);
    expect(result.conflictStrategy).toBe("overwrite");
  });

  it("競合戦略をoverwriteに設定した場合、conflictStrategyがoverwriteになる", async () => {
    // Given: 上書き戦略
    const mockAnswers = {
      tools: ["direnv"],
      conflictStrategy: "overwrite",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: conflictStrategyがoverwriteになる
    expect(result.conflictStrategy).toBe("overwrite");
  });

  it("競合戦略をskipに設定した場合、conflictStrategyがskipになる", async () => {
    // Given: スキップ戦略
    const mockAnswers = {
      tools: ["direnv", "dotenvx", "volta"],
      conflictStrategy: "skip",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: conflictStrategyがskipになる
    expect(result.conflictStrategy).toBe("skip");
  });

  it("ツールを何も選択しない場合、すべてのツールがfalseになる", async () => {
    // Given: ツール未選択
    const mockAnswers = {
      tools: [],
      conflictStrategy: "merge",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: すべてのツールがfalseになる
    expect(result.tools.direnv).toBe(false);
    expect(result.tools.dotenvx).toBe(false);
    expect(result.tools.volta).toBe(false);
    expect(result.tools.biome).toBe(false);
    expect(result.tools.husky).toBe(false);
  });

  it("すべてのツールを選択した場合、すべてのツールがtrueになる", async () => {
    // Given: すべてのツールを選択
    const mockAnswers = {
      tools: ["direnv", "dotenvx", "volta", "biome", "husky"],
      conflictStrategy: "merge",
    };

    vi.mocked(inquirer.prompt).mockResolvedValueOnce(mockAnswers);

    // When: プロンプト実行
    const result: SetupConfig = await promptSetupConfig();

    // Then: すべてのツールがtrueになる
    expect(result.tools.direnv).toBe(true);
    expect(result.tools.dotenvx).toBe(true);
    expect(result.tools.volta).toBe(true);
    expect(result.tools.biome).toBe(true);
    expect(result.tools.husky).toBe(true);
  });
});
