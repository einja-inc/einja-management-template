/**
 * Vibe-Kanban REST API クライアント
 *
 * MCP では対応していないプロジェクト作成機能を提供
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** REST API から取得したIssue情報 */
export interface RemoteIssue {
  id: string;
  title: string;
  status: string;
  parent_issue_id: string | null;
  description?: string;
}

/**
 * Vibe-Kanban REST API クライアント
 */
export class VibeKanbanRestClient {
  private baseUrl: string;

  /** リトライ設定 */
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 1000;

  constructor(port: number) {
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  /**
   * Vibe-Kanban バックエンドのポートを発見
   *
   * 1. ポートファイルから取得を試みる
   * 2. 失敗した場合、lsof でプロセスから検出
   */
  static discoverPort(): number | null {
    // 1. ポートファイルから取得
    const portFromFile = VibeKanbanRestClient.discoverPortFromFile();
    if (portFromFile !== null) {
      return portFromFile;
    }

    // 2. プロセスから検出（フォールバック）
    return VibeKanbanRestClient.discoverPortFromProcess();
  }

  /**
   * ポートファイルからポートを取得
   */
  private static discoverPortFromFile(): number | null {
    const portFilePath = join(tmpdir(), "vibe-kanban", "vibe-kanban.port");

    try {
      if (!existsSync(portFilePath)) {
        return null;
      }

      const content = readFileSync(portFilePath, "utf-8").trim();
      const port = Number.parseInt(content, 10);

      if (Number.isNaN(port)) {
        return null;
      }

      return port;
    } catch {
      return null;
    }
  }

  /**
   * lsof でプロセスからポートを検出
   *
   * macOS/Linux 専用
   */
  private static discoverPortFromProcess(): number | null {
    try {
      // vibe-kanban プロセスがリッスンしているポートを検出
      const output = execSync(
        'lsof -i -P -n 2>/dev/null | grep "vibe-kanb" | grep LISTEN | head -1',
        { encoding: "utf-8" }
      );

      // 出力例: "vibe-kanb 72645 kzp 23u IPv4 ... TCP 127.0.0.1:60911 (LISTEN)"
      const match = output.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        return Number.parseInt(match[1], 10);
      }

      return null;
    } catch {
      // lsof が失敗した場合（プロセスが見つからない等）
      return null;
    }
  }

  /**
   * バックエンドに接続可能か確認
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * IssueにparentIssueIdを設定（サブIssue化）
   *
   * @param issueId 対象IssueのID
   * @param parentIssueId 親IssueのID
   */
  async setParentIssue(issueId: string, parentIssueId: string): Promise<void> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/remote/issues/${issueId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_issue_id: parentIssueId }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`parent_issue_id の設定に失敗しました (${response.status}): ${text}`);
    }
  }

  /**
   * Issueの親子関係を解除
   *
   * @param issueId 対象IssueのID
   */
  async removeParentIssue(issueId: string): Promise<void> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/remote/issues/${issueId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_issue_id: null }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`parent_issue_id の解除に失敗しました (${response.status}): ${text}`);
    }
  }

  /**
   * Issue一覧を取得（parent_issue_id フィールド含む）
   *
   * @param projectId プロジェクトID
   * @returns Issue一覧
   */
  async listIssuesWithParent(projectId: string): Promise<RemoteIssue[]> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/remote/issues?project_id=${encodeURIComponent(projectId)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Issue一覧の取得に失敗しました (${response.status}): ${text}`);
    }

    const result = (await response.json()) as { issues?: RemoteIssue[] };
    return result.issues ?? [];
  }

  /**
   * REST API の動作確認（Capability Probe）
   * 起動時にREST APIが利用可能か確認する
   *
   * @returns true=利用可能, false=利用不可
   */
  async probeCapability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/remote/issues?project_id=probe`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      // 200 or 404 (プロジェクトが見つからない) いずれもAPIは動作している
      return response.status !== 502 && response.status !== 503;
    } catch {
      return false;
    }
  }

  /**
   * 指数バックオフ付きリトライで fetch を実行
   * 429 (Too Many Requests) と 5xx エラーで自動リトライ
   *
   * @param url リクエストURL
   * @param init fetchオプション
   * @returns Responseオブジェクト
   */
  private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < VibeKanbanRestClient.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, init);

        // 401/403 は専用メッセージで即座にエラー
        if (response.status === 401 || response.status === 403) {
          const text = await response.text();
          throw new Error(`認証エラー (${response.status}): ${text}`);
        }

        // 429 または 5xx: リトライ対象
        if (response.status === 429 || response.status >= 500) {
          if (attempt < VibeKanbanRestClient.MAX_RETRIES - 1) {
            const delay = VibeKanbanRestClient.BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(
              `   ⚠️ REST API リトライ (${attempt + 1}/${VibeKanbanRestClient.MAX_RETRIES}): ${response.status} - ${delay}ms 待機`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          // 最終リトライでも失敗: エラーをスロー
          throw new Error(
            `REST API request failed after ${VibeKanbanRestClient.MAX_RETRIES} retries: ${response.status} ${response.statusText}`
          );
        }

        return response;
      } catch (error) {
        // 認証エラーは即座に再スロー
        if (error instanceof Error && error.message.startsWith("認証エラー")) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < VibeKanbanRestClient.MAX_RETRIES - 1) {
          const delay = VibeKanbanRestClient.BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("REST API リクエストに失敗しました");
  }
}
