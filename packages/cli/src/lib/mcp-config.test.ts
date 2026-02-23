import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExistingMcpConfig, mergeMcpConfigs, setupMcpConfig } from "./mcp-config.js";
import type { McpConfig } from "./mcp-config.js";

// fs-extraのモック
vi.mock("fs-extra");

describe("mcp-config", () => {
  describe("mergeMcpConfigs", () => {
    it("既存がnullの場合、テンプレートをそのまま返す", () => {
      // Given: テンプレート設定のみ存在
      const template: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
          codex: {
            type: "stdio",
            command: "codex",
            args: ["mcp-server"],
          },
        },
      };

      // When: 既存設定がnullの状態でマージ
      const result = mergeMcpConfigs(null, template);

      // Then: テンプレートがそのまま返り、すべて追加扱い
      expect(result.config.mcpServers).toEqual(template.mcpServers);
      expect(result.added).toEqual(["vibe_kanban", "codex"]);
      expect(result.overwritten).toEqual([]);
      expect(result.preserved).toEqual([]);
    });

    it("既存にないサーバーは追加される", () => {
      // Given: 既存設定にない新しいサーバーがテンプレートに存在
      const existing: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
        },
      };

      const template: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
          codex: {
            type: "stdio",
            command: "codex",
            args: ["mcp-server"],
          },
        },
      };

      // When: マージを実行
      const result = mergeMcpConfigs(existing, template);

      // Then: 新しいサーバーが追加される
      expect(result.config.mcpServers).toHaveProperty("codex");
      expect(result.added).toEqual(["codex"]);
      expect(result.overwritten).toEqual(["vibe_kanban"]);
      expect(result.preserved).toEqual([]);
    });

    it("同名サーバーはテンプレートで上書き", () => {
      // Given: 既存とテンプレートに同名サーバーが存在（設定が異なる）
      const existing: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "old-command",
            args: ["old-arg"],
          },
        },
      };

      const template: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
        },
      };

      // When: マージを実行
      const result = mergeMcpConfigs(existing, template);

      // Then: テンプレートの設定で上書きされる
      expect(result.config.mcpServers?.vibe_kanban).toEqual({
        command: "npx",
        args: ["-y", "vibe-kanban@latest", "--mcp"],
      });
      expect(result.added).toEqual([]);
      expect(result.overwritten).toEqual(["vibe_kanban"]);
      expect(result.preserved).toEqual([]);
    });

    it("テンプレートにないが既存にあるサーバーは保持", () => {
      // Given: 既存設定にのみ存在するカスタムサーバー
      const existing: McpConfig = {
        mcpServers: {
          custom_server: {
            command: "custom-command",
            args: ["custom-arg"],
          },
        },
      };

      const template: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
        },
      };

      // When: マージを実行
      const result = mergeMcpConfigs(existing, template);

      // Then: 既存のカスタムサーバーが保持され、新しいサーバーが追加される
      expect(result.config.mcpServers).toHaveProperty("custom_server");
      expect(result.config.mcpServers?.custom_server).toEqual({
        command: "custom-command",
        args: ["custom-arg"],
      });
      expect(result.config.mcpServers).toHaveProperty("vibe_kanban");
      expect(result.added).toEqual(["vibe_kanban"]);
      expect(result.overwritten).toEqual([]);
      expect(result.preserved).toEqual(["custom_server"]);
    });

    it("複合ケース: 追加・上書き・保持が混在する", () => {
      // Given: 複数のサーバー設定が混在
      const existing: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "old-vibe",
            args: ["old"],
          },
          custom_server: {
            command: "custom",
            args: ["arg"],
          },
        },
      };

      const template: McpConfig = {
        mcpServers: {
          vibe_kanban: {
            command: "npx",
            args: ["-y", "vibe-kanban@latest", "--mcp"],
          },
          codex: {
            type: "stdio",
            command: "codex",
            args: ["mcp-server"],
          },
        },
      };

      // When: マージを実行
      const result = mergeMcpConfigs(existing, template);

      // Then: 各カテゴリに正しく分類される
      expect(result.added).toEqual(["codex"]);
      expect(result.overwritten).toEqual(["vibe_kanban"]);
      expect(result.preserved).toEqual(["custom_server"]);

      // Then: マージ後の設定が正しい
      expect(result.config.mcpServers).toBeDefined();
      if (result.config.mcpServers) {
        expect(Object.keys(result.config.mcpServers)).toHaveLength(3);
        expect(result.config.mcpServers.vibe_kanban?.command).toBe("npx");
        expect(result.config.mcpServers.custom_server?.command).toBe("custom");
        expect(result.config.mcpServers.codex?.command).toBe("codex");
      }
    });

    it("既存がnullの場合でもテンプレートの全サーバーが追加扱いになる", () => {
      // Given: 既存設定がnull、複数のテンプレートサーバー
      const template: McpConfig = {
        mcpServers: {
          server1: { command: "cmd1" },
          server2: { command: "cmd2" },
          server3: { command: "cmd3" },
        },
      };

      // When: マージを実行
      const result = mergeMcpConfigs(null, template);

      // Then: すべてのサーバーが追加扱い
      expect(result.added).toHaveLength(3);
      expect(result.added).toContain("server1");
      expect(result.added).toContain("server2");
      expect(result.added).toContain("server3");
      expect(result.overwritten).toEqual([]);
      expect(result.preserved).toEqual([]);
    });

    it("既存設定のトップレベルプロパティが保持される", () => {
      // Given: mcpServers以外のプロパティを持つ既存設定
      const existing = {
        mcpServers: { server1: { command: "old" } },
        customProperty: "value",
        anotherProperty: { nested: true },
      } as McpConfig;

      const template: McpConfig = {
        mcpServers: { server2: { command: "new" } },
      };

      // When: マージ
      const result = mergeMcpConfigs(existing, template);

      // Then: customProperty, anotherPropertyが保持される
      expect((result.config as unknown as { customProperty: string }).customProperty).toBe("value");
      expect(
        (result.config as unknown as { anotherProperty: { nested: boolean } }).anotherProperty
      ).toEqual({ nested: true });

      // mcpServersは正しくマージされる
      expect(result.config.mcpServers).toHaveProperty("server1");
      expect(result.config.mcpServers).toHaveProperty("server2");
    });
  });

  describe("loadExistingMcpConfig", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("ファイルが存在しない場合、success: true, config: undefinedを返す", async () => {
      // Given: ファイルが存在しない
      vi.mocked(fs.pathExists).mockResolvedValueOnce(false as never);

      // When: loadExistingMcpConfig
      const result = await loadExistingMcpConfig("/test/dir");

      // Then: success: true, config: undefined
      expect(result.success).toBe(true);
      expect(result.config).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("パースエラーの場合、success: false, errorを返す", async () => {
      // Given: 不正なJSON
      vi.mocked(fs.pathExists).mockResolvedValueOnce(true as never);
      vi.mocked(fs.readJson).mockRejectedValueOnce(new Error("JSON parse error"));

      // When: loadExistingMcpConfig
      const result = await loadExistingMcpConfig("/test/dir");

      // Then: { success: false, error: "..." }
      expect(result.success).toBe(false);
      expect(result.error).toContain("ファイルの読み込みに失敗しました");
    });

    it("正常な設定ファイルの場合、success: true, configを返す", async () => {
      // Given: 正常な設定ファイル
      vi.mocked(fs.pathExists).mockResolvedValueOnce(true as never);

      const validConfig = {
        mcpServers: {
          server1: { command: "cmd1" },
        },
      };
      vi.mocked(fs.readJson).mockResolvedValueOnce(validConfig);

      // When: loadExistingMcpConfig
      const result = await loadExistingMcpConfig("/test/dir");

      // Then: { success: true, config: ... }
      if (!result.success) {
        console.error("Validation error:", result.error);
      }
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config?.mcpServers).toHaveProperty("server1");
    });
  });

  describe("setupMcpConfig", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("既存ファイルパースエラー時、success: falseを返し既存ファイルを保護する", async () => {
      // Given: テンプレートは存在するが、既存ファイルがパースエラー
      // getTemplateMcpConfigのモックは複雑なので、直接ファイルシステムをモック
      vi.mocked(fs.pathExists).mockImplementation(async (p) => {
        const pathStr = String(p);
        if (pathStr.includes("presets")) return true; // テンプレート存在
        if (pathStr.endsWith(".mcp.json")) return true; // 既存ファイル存在
        return false;
      });

      vi.mocked(fs.readJson).mockImplementation(async (p) => {
        const pathStr = String(p);
        if (pathStr.includes("presets")) {
          // テンプレート
          return { mcpServers: { server1: { command: "template" } } };
        }
        // 既存ファイル - パースエラー
        throw new Error("Parse error");
      });

      // When: setupMcpConfig
      const result = await setupMcpConfig("/test/dir");

      // Then: success: false, errorあり
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Then: writeJsonが呼ばれていない（既存ファイル保護）
      expect(vi.mocked(fs.writeJson)).not.toHaveBeenCalled();
    });
  });
});
