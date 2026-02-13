/**
 * Vibe-Kanban MCP クライアント
 *
 * @modelcontextprotocol/sdk を使用して Vibe-Kanban MCP サーバーと通信
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  VibeKanbanIssue,
  VibeKanbanOrganization,
  VibeKanbanProject,
  VibeKanbanRepo,
  VibeKanbanWorkspaceSession,
} from "./types.js";

/**
 * Vibe-Kanban MCP クライアント
 */
export class VibeKanbanClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor() {
    this.client = new Client({
      name: "task-vibe-kanban-loop",
      version: "1.0.0",
    });
  }

  /**
   * MCP サーバーに接続
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    console.log("🔌 Vibe-Kanban MCP サーバーに接続中...");

    // MCPサーバー起動前にポートファイルを同期
    this.syncPortFile();

    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "vibe-kanban@latest", "--mcp"],
      env: {
        ...process.env,
        RUST_LOG: "error", // DEBUGログを抑制
      },
      stderr: "ignore", // stderrからのデバッグログを抑制
    });

    await this.client.connect(this.transport);
    this.connected = true;

    console.log("✅ Vibe-Kanban MCP 接続完了");
  }

  /**
   * ポートファイルを実際のプロセスと同期
   *
   * ポートファイルが古い場合、lsof でプロセスからポートを検出して更新
   */
  private syncPortFile(): void {
    const portFilePath = join(tmpdir(), "vibe-kanban", "vibe-kanban.port");
    const portFromFile = this.getPortFromFile(portFilePath);
    const portFromProcess = this.getPortFromProcess();

    // プロセスが見つからない場合は何もしない（MCPサーバー起動時にエラーになる）
    if (portFromProcess === null) {
      return;
    }

    // ポートファイルが存在しないか、古い場合は更新
    if (portFromFile !== portFromProcess) {
      console.log(`📝 ポートファイルを更新: ${portFromFile ?? "なし"} → ${portFromProcess}`);
      const portDir = join(tmpdir(), "vibe-kanban");
      if (!existsSync(portDir)) {
        mkdirSync(portDir, { recursive: true });
      }
      writeFileSync(portFilePath, String(portFromProcess));
    }
  }

  /**
   * ポートファイルからポートを取得
   */
  private getPortFromFile(portFilePath: string): number | null {
    try {
      if (!existsSync(portFilePath)) {
        return null;
      }
      const content = readFileSync(portFilePath, "utf-8").trim();
      const port = Number.parseInt(content, 10);
      return Number.isNaN(port) ? null : port;
    } catch {
      return null;
    }
  }

  /**
   * lsof でプロセスからポートを検出
   */
  private getPortFromProcess(): number | null {
    try {
      const output = execSync(
        'lsof -i -P -n 2>/dev/null | grep "vibe-kanb" | grep LISTEN | head -1',
        { encoding: "utf-8" }
      );
      const match = output.match(/:(\d+)\s+\(LISTEN\)/);
      return match ? Number.parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * MCP サーバーから切断
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    console.log("🔌 Vibe-Kanban MCP サーバーから切断中...");

    await this.client.close();
    this.connected = false;

    console.log("✅ Vibe-Kanban MCP 切断完了");
  }

  /**
   * 組織一覧を取得
   */
  async listOrganizations(): Promise<VibeKanbanOrganization[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_organizations",
      arguments: {},
    });

    return this.parseToolResult<VibeKanbanOrganization[]>(result, []);
  }

  /**
   * プロジェクト一覧を取得
   */
  async listProjects(organizationId: string): Promise<VibeKanbanProject[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_projects",
      arguments: { organization_id: organizationId },
    });

    return this.parseToolResult<VibeKanbanProject[]>(result, []);
  }

  /**
   * Issue一覧を取得
   */
  async listIssues(projectId?: string): Promise<VibeKanbanIssue[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_issues",
      arguments: projectId ? { project_id: projectId } : {},
    });

    return this.parseToolResult<VibeKanbanIssue[]>(result, []);
  }

  /**
   * リポジトリ一覧を取得
   */
  async listRepos(): Promise<VibeKanbanRepo[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_repos",
      arguments: {},
    });

    return this.parseToolResult<VibeKanbanRepo[]>(result, []);
  }

  /**
   * Issueを取得
   */
  async getIssue(issueId: string): Promise<VibeKanbanIssue | null> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "get_issue",
      arguments: { issue_id: issueId },
    });

    return this.parseToolResult<VibeKanbanIssue | null>(result, null);
  }

  /**
   * Issueを作成
   * @returns Issue ID
   */
  async createIssue(projectId: string | undefined, title: string, description: string): Promise<string> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "create_issue",
      arguments: {
        ...(projectId && { project_id: projectId }),
        title,
        description,
      },
    });

    const parsed = this.parseToolResult<{ issue_id: string } | null>(result, null);
    if (!parsed?.issue_id) {
      throw new Error("Issueの作成に失敗しました");
    }
    return parsed.issue_id;
  }

  /**
   * Issueを更新
   */
  async updateIssue(issueId: string, status: string): Promise<void> {
    this.ensureConnected();

    await this.client.callTool({
      name: "update_issue",
      arguments: {
        issue_id: issueId,
        status,
      },
    });
  }

  /**
   * ワークスペースセッションを開始
   */
  async startWorkspaceSession(
    title: string,
    executor: "CLAUDE_CODE",
    repos: Array<{ repo_id: string; base_branch: string }>,
    issueId?: string
  ): Promise<VibeKanbanWorkspaceSession> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "start_workspace_session",
      arguments: {
        title,
        executor,
        repos,
        ...(issueId && { issue_id: issueId }),
      },
    });

    const session = this.parseToolResult<VibeKanbanWorkspaceSession | null>(result, null);
    if (!session) {
      throw new Error("ワークスペースセッションの開始に失敗しました");
    }
    return session;
  }

  /**
   * 接続状態を確認
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        "Vibe-Kanban MCP サーバーに接続されていません。先に connect() を呼び出してください。"
      );
    }
  }

  /**
   * ツール結果をパース
   */
  private parseToolResult<T>(result: unknown, defaultValue: T): T {
    if (!result || typeof result !== "object") {
      return defaultValue;
    }

    const typedResult = result as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: T;
      isError?: boolean;
      is_error?: boolean;
    };

    // エラーフラグをチェック
    if (typedResult.isError || typedResult.is_error) {
      const errorMessage = this.extractErrorMessage(typedResult.content);
      throw new Error(errorMessage || "Vibe-Kanban API エラー");
    }

    // structuredContent がある場合はそれを使用
    if (typedResult.structuredContent !== undefined) {
      return typedResult.structuredContent;
    }

    // content から JSON をパース
    if (typedResult.content && typedResult.content.length > 0) {
      const textContent = typedResult.content.find((c) => c.type === "text");
      if (textContent?.text) {
        try {
          const parsed = JSON.parse(textContent.text) as Record<string, unknown>;
          // success: false のレスポンスをエラーとして扱う
          if (parsed.success === false) {
            const error = parsed.error || "Unknown API error";
            const details = parsed.details ? `: ${parsed.details}` : "";
            throw new Error(`${error}${details}`);
          }
          return parsed as T;
        } catch (e) {
          // JSON パースエラーの場合は再throw（APIエラーの場合）
          if (e instanceof Error && e.message !== "Unexpected token") {
            throw e;
          }
          // パース失敗時はデフォルト値を返す
        }
      }
    }

    return defaultValue;
  }

  /**
   * エラーメッセージを抽出
   */
  private extractErrorMessage(content?: Array<{ type: string; text?: string }>): string | null {
    if (!content || content.length === 0) {
      return null;
    }
    const textContent = content.find((c) => c.type === "text");
    if (textContent?.text) {
      try {
        const parsed = JSON.parse(textContent.text) as { error?: string; details?: string };
        const details = parsed.details ? `: ${parsed.details}` : "";
        return parsed.error ? `${parsed.error}${details}` : textContent.text;
      } catch {
        return textContent.text;
      }
    }
    return null;
  }
}
