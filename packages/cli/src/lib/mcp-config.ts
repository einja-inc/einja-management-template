import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import { getScaffoldsPath } from "./file-system.js";

// Zodスキーマ定義
const McpServerConfigSchema = z
  .object({
    type: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const McpConfigSchema = z
  .object({
    mcpServers: z.record(z.string(), McpServerConfigSchema).optional(),
  })
  .passthrough();

// TypeScript型定義（Zodから推論）
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;

export interface MergeMcpConfigResult {
  config: McpConfig;
  added: string[];
  overwritten: string[];
  preserved: string[];
}

// Result型パターン
export interface LoadMcpConfigResult {
  success: boolean;
  config?: McpConfig;
  error?: string;
}

export interface SetupMcpConfigResult {
  success: boolean;
  result?: MergeMcpConfigResult;
  error?: string;
  skipped?: boolean;
}

export async function getTemplateMcpConfig(): Promise<McpConfig | null> {
  const scaffoldsPath = getScaffoldsPath();
  const templatePath = path.join(scaffoldsPath, ".mcp.json");
  if (!(await fs.pathExists(templatePath))) {
    return null;
  }
  return fs.readJson(templatePath);
}

export async function loadExistingMcpConfig(targetDir: string): Promise<LoadMcpConfigResult> {
  const mcpPath = path.join(targetDir, ".mcp.json");

  // ファイルが存在しない場合
  if (!(await fs.pathExists(mcpPath))) {
    return { success: true, config: undefined };
  }

  try {
    const rawConfig = await fs.readJson(mcpPath);

    // Zodバリデーション
    const parseResult = McpConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      return {
        success: false,
        error: `設定ファイルの形式が不正です: ${parseResult.error.message}`,
      };
    }

    return { success: true, config: parseResult.data };
  } catch (error) {
    return {
      success: false,
      error: `ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function mergeMcpConfigs(
  existing: McpConfig | null,
  template: McpConfig
): MergeMcpConfigResult {
  const added: string[] = [];
  const overwritten: string[] = [];
  const preserved: string[] = [];

  // 既存設定をベースにする（mcpServers以外のプロパティも保持）
  const baseConfig: McpConfig = existing ? { ...existing } : {};

  const existingServers = existing?.mcpServers ?? {};
  const templateServers = template.mcpServers ?? {};
  const mergedServers: Record<string, McpServerConfig> = {};

  // 既存サーバーのうち、テンプレートにないものを保持
  for (const serverName of Object.keys(existingServers)) {
    if (!(serverName in templateServers)) {
      mergedServers[serverName] = existingServers[serverName];
      preserved.push(serverName);
    }
  }

  // テンプレートのサーバーを追加/上書き
  for (const serverName of Object.keys(templateServers)) {
    if (serverName in existingServers) {
      overwritten.push(serverName);
    } else {
      added.push(serverName);
    }
    mergedServers[serverName] = templateServers[serverName];
  }

  // ベース設定にマージしたサーバー設定を適用
  return {
    config: { ...baseConfig, mcpServers: mergedServers },
    added,
    overwritten,
    preserved,
  };
}

export async function writeMcpConfig(targetDir: string, config: McpConfig): Promise<void> {
  const mcpPath = path.join(targetDir, ".mcp.json");
  await fs.writeJson(mcpPath, config, { spaces: "\t" });
}

export async function setupMcpConfig(targetDir: string): Promise<SetupMcpConfigResult> {
  // テンプレート取得
  const template = await getTemplateMcpConfig();
  if (!template) {
    return { success: true, skipped: true };
  }

  // 既存設定の読み込み
  const loadResult = await loadExistingMcpConfig(targetDir);
  if (!loadResult.success) {
    // パースエラーの場合、既存ファイルを保護するためエラーを返す
    return {
      success: false,
      error: loadResult.error,
    };
  }

  // マージと書き込み
  const result = mergeMcpConfigs(loadResult.config ?? null, template);
  await writeMcpConfig(targetDir, result.config);

  return { success: true, result };
}
