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
  VibeKanbanAttempt,
  VibeKanbanOrganization,
  VibeKanbanProject,
  VibeKanbanRepo,
  VibeKanbanTask,
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

    const parsed = this.parseToolResult<{ organizations: VibeKanbanOrganization[] }>(result, {
      organizations: [],
    });
    return parsed.organizations;
  }

  /**
   * プロジェクト一覧を取得
   * @param organizationId 組織ID（必須）
   */
  async listProjects(organizationId: string): Promise<VibeKanbanProject[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_projects",
      arguments: { organization_id: organizationId },
    });

    const parsed = this.parseToolResult<{ projects: VibeKanbanProject[] }>(result, {
      projects: [],
    });
    return parsed.projects;
  }

  /**
   * タスク一覧を取得
   * 内部で list_issues ツールを呼び出す（旧API: list_tasks → 新API: list_issues）
   */
  async listTasks(projectId: string): Promise<VibeKanbanTask[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_issues",
      arguments: { project_id: projectId },
    });

    const parsed = this.parseToolResult<{ issues: VibeKanbanTask[] }>(result, { issues: [] });

    // 各タスクのステータス値を変換
    return parsed.issues.map((task) => ({
      ...task,
      status: this.normalizeStatusForReceive(task.status) as VibeKanbanTask["status"],
    }));
  }

  /**
   * リポジトリ一覧を取得
   * 旧API: project_id パラメータ必須 → 新API: パラメータなし
   */
  async listRepos(): Promise<VibeKanbanRepo[]> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "list_repos",
      arguments: {},
    });

    const parsed = this.parseToolResult<{ repos: VibeKanbanRepo[] }>(result, { repos: [] });
    return parsed.repos;
  }

  /**
   * タスクを取得
   * 内部で get_issue ツールを呼び出す（旧API: get_task → 新API: get_issue）
   * パラメータ名も変更（task_id → issue_id）
   */
  async getTask(taskId: string): Promise<VibeKanbanTask | null> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "get_issue",
      arguments: { issue_id: taskId },
    });

    const task = this.parseToolResult<VibeKanbanTask | null>(result, null);

    // 受信時にステータス値を変換
    if (task) {
      task.status = this.normalizeStatusForReceive(task.status) as VibeKanbanTask["status"];
    }
    return task;
  }

  /**
   * タスクを作成
   * 内部で create_issue ツールを呼び出す（旧API: create_task → 新API: create_issue）
   * @returns タスクID
   */
  async createTask(projectId: string, title: string, description: string): Promise<string> {
    this.ensureConnected();

    const result = await this.client.callTool({
      name: "create_issue",
      arguments: {
        project_id: projectId,
        title,
        description,
      },
    });

    const parsed = this.parseToolResult<{ issue_id: string } | null>(result, null);
    if (!parsed?.issue_id) {
      throw new Error("タスクの作成に失敗しました");
    }
    return parsed.issue_id;
  }

  /**
   * タスクを更新
   * 内部で update_issue ツールを呼び出す（旧API: update_task → 新API: update_issue）
   * パラメータ名も変更（task_id → issue_id）
   */
  async updateTask(taskId: string, status: "todo" | "inprogress" | "done"): Promise<void> {
    this.ensureConnected();

    // 送信前にステータス値を変換
    const mappedStatus = this.normalizeStatusForSend(status);

    await this.client.callTool({
      name: "update_issue",
      arguments: {
        issue_id: taskId,
        status: mappedStatus,
      },
    });
  }

  /**
   * タスク実行を開始
   *
   * @param title - ワークスペースのタイトル
   * @param executor - 実行者（現在は "CLAUDE_CODE" のみサポート）
   * @param repos - リポジトリ情報の配列
   * @param issueId - オプショナルなIssue ID
   * @returns タスク実行試行情報
   * @throws {Error} パース失敗または未対応のレスポンス形式の場合
   *
   * @remarks
   * 新旧両形式のMCPレスポンスに対応:
   * - 旧形式: `{ id, task_id, executor, base_branch }`
   * - 新形式: `{ attempt_id, issue_id, executor, base_branch }`
   * - ネスト形式: `{ attempt: { id }, issue_id, executor }`
   * - 配列形式: `{ attempts: [{ id, issue_id, executor, base_branch }] }`
   */
  async startTaskAttempt(
    title: string,
    executor: "CLAUDE_CODE",
    repos: Array<{ repo_id: string; base_branch: string }>,
    issueId?: string
  ): Promise<VibeKanbanAttempt> {
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

    const parsed = this.parseToolResult<unknown>(result, null);
    if (!parsed) {
      throw new Error("タスク実行の開始に失敗しました");
    }

    // 新形式対応: mapToAttemptでフィールド名マッピング
    const attempt = this.mapToAttempt(parsed);
    return attempt;
  }

  /**
   * MCPレスポンスをVibeKanbanAttempt型にマッピング
   * 新旧両形式に対応したフォールバック処理
   *
   * @param parsed - MCPレスポンスのパース済みオブジェクト
   * @returns VibeKanbanAttempt型にマッピングされたオブジェクト
   * @throws {Error} 未対応のレスポンス形式の場合
   *
   * @remarks
   * 以下の4つの形式を判定してマッピング:
   * - 新形式（attempt_id, issue_id）
   * - 旧形式（id, task_id）
   * - ネスト形式（attempt.id, issue_id）
   * - 配列形式（attempts[0]）
   */
  private mapToAttempt(parsed: unknown): VibeKanbanAttempt {
    // パターン判定とマッピング処理（早期リターン）
    if (this.isNewFormat(parsed)) {
      return this.mapNewFormat(parsed);
    }
    if (this.isLegacyFormat(parsed)) {
      return this.mapLegacyFormat(parsed);
    }
    if (this.isNestedFormat(parsed)) {
      return this.mapNestedFormat(parsed);
    }
    if (this.isArrayFormat(parsed)) {
      return this.mapArrayFormat(parsed);
    }

    // 未対応の形式の場合、レスポンス内容をログ出力してエラーをスロー
    console.error(
      "未対応のレスポンス形式です。実際のレスポンス:",
      JSON.stringify(parsed, null, 2)
    );
    throw new Error(
      "未対応のレスポンス形式です。MCPサーバーのバージョンを確認してください。"
    );
  }

  /**
   * 新形式判定（パターン1: フラット構造の変更）
   *
   * @param parsed - 判定対象のオブジェクト
   * @returns 新形式の場合true
   *
   * @remarks
   * 判定条件:
   * - attempt_id フィールドが存在
   * - issue_id フィールドが存在
   *
   * @example
   * ```json
   * {
   *   "attempt_id": "abc123",
   *   "issue_id": "issue-001",
   *   "executor": "CLAUDE_CODE",
   *   "base_branch": "main"
   * }
   * ```
   */
  private isNewFormat(
    parsed: unknown
  ): parsed is { attempt_id: string; issue_id: string; executor: string; base_branch: string } {
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "attempt_id" in parsed &&
      "issue_id" in parsed
    );
  }

  /**
   * 新形式マッピング（パターン1）
   *
   * @param parsed - 新形式のレスポンス
   * @returns VibeKanbanAttempt型
   *
   * @remarks
   * フィールド名マッピング:
   * - attempt_id → id
   * - issue_id → task_id
   */
  private mapNewFormat(parsed: {
    attempt_id: string;
    issue_id: string;
    executor: string;
    base_branch: string;
  }): VibeKanbanAttempt {
    return {
      id: parsed.attempt_id,
      task_id: parsed.issue_id,
      executor: parsed.executor,
      base_branch: parsed.base_branch,
    };
  }

  /**
   * 旧形式判定（後方互換性）
   *
   * @param parsed - 判定対象のオブジェクト
   * @returns 旧形式の場合true
   *
   * @remarks
   * 判定条件:
   * - id フィールドが存在
   * - attempt_id フィールドが存在しない（新形式との区別）
   *
   * @example
   * ```json
   * {
   *   "id": "attempt-456",
   *   "task_id": "task-002",
   *   "executor": "CLAUDE_CODE",
   *   "base_branch": "develop"
   * }
   * ```
   */
  private isLegacyFormat(parsed: unknown): parsed is { id: string; [key: string]: unknown } {
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      !("attempt_id" in parsed)
    );
  }

  /**
   * 旧形式マッピング（後方互換性）
   *
   * @param parsed - 旧形式のレスポンス
   * @returns VibeKanbanAttempt型
   *
   * @remarks
   * オプショナルフィールドの扱い:
   * - task_id, executor, base_branch がない場合は空文字をデフォルト値として設定
   */
  private mapLegacyFormat(parsed: { id: string; [key: string]: unknown }): VibeKanbanAttempt {
    return {
      id: parsed.id as string,
      task_id: (parsed.task_id as string) || "",
      executor: (parsed.executor as string) || "",
      base_branch: (parsed.base_branch as string) || "",
    };
  }

  /**
   * ネスト形式判定（パターン2: ネスト構造の導入）
   *
   * @param parsed - 判定対象のオブジェクト
   * @returns ネスト形式の場合true
   *
   * @remarks
   * 判定条件:
   * - attempt オブジェクトが存在
   * - attempt.id フィールドが存在
   *
   * @example
   * ```json
   * {
   *   "attempt": {
   *     "id": "attempt-789",
   *     "status": "in-progress"
   *   },
   *   "issue_id": "issue-003",
   *   "executor": "CLAUDE_CODE"
   * }
   * ```
   */
  private isNestedFormat(
    parsed: unknown
  ): parsed is { attempt: { id: string }; issue_id: string; executor: string } {
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "attempt" in parsed &&
      typeof parsed.attempt === "object" &&
      parsed.attempt !== null &&
      "id" in parsed.attempt
    );
  }

  /**
   * ネスト形式マッピング（パターン2）
   *
   * @param parsed - ネスト形式のレスポンス
   * @returns VibeKanbanAttempt型
   *
   * @remarks
   * フィールド名マッピング:
   * - attempt.id → id
   * - issue_id → task_id
   * - base_branch がない場合は空文字をデフォルト値として設定
   */
  private mapNestedFormat(parsed: {
    attempt: { id: string };
    issue_id: string;
    executor: string;
    base_branch?: string;
  }): VibeKanbanAttempt {
    return {
      id: parsed.attempt.id,
      task_id: parsed.issue_id,
      executor: parsed.executor,
      base_branch: parsed.base_branch || "",
    };
  }

  /**
   * 配列形式判定（パターン3: 配列形式）
   *
   * @param parsed - 判定対象のオブジェクト
   * @returns 配列形式の場合true
   *
   * @remarks
   * 判定条件:
   * - attempts 配列が存在
   * - 配列が空でない
   *
   * @example
   * ```json
   * {
   *   "attempts": [
   *     {
   *       "id": "attempt-aaa",
   *       "issue_id": "issue-004",
   *       "executor": "CLAUDE_CODE",
   *       "base_branch": "feature"
   *     }
   *   ]
   * }
   * ```
   */
  private isArrayFormat(
    parsed: unknown
  ): parsed is { attempts: Array<{ id: string; issue_id: string; executor: string; base_branch: string }> } {
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "attempts" in parsed &&
      Array.isArray(parsed.attempts) &&
      parsed.attempts.length > 0
    );
  }

  /**
   * 配列形式マッピング（パターン3）
   *
   * @param parsed - 配列形式のレスポンス
   * @returns VibeKanbanAttempt型
   *
   * @remarks
   * 配列の最初の要素を使用してマッピング:
   * - attempts[0].id → id
   * - attempts[0].issue_id → task_id
   */
  private mapArrayFormat(parsed: {
    attempts: Array<{ id: string; issue_id: string; executor: string; base_branch: string }>;
  }): VibeKanbanAttempt {
    const first = parsed.attempts[0];
    return {
      id: first.id,
      task_id: first.issue_id,
      executor: first.executor,
      base_branch: first.base_branch,
    };
  }

  /**
   * ステータス値をMCP送信用に変換
   * 内部形式 "inprogress" → MCP形式 "in-progress"
   */
  private normalizeStatusForSend(status: string): string {
    return status === "inprogress" ? "in-progress" : status;
  }

  /**
   * ステータス値を内部形式に変換
   * MCP形式 "in-progress" → 内部形式 "inprogress"
   */
  private normalizeStatusForReceive(status: string): string {
    return status === "in-progress" ? "inprogress" : status;
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
