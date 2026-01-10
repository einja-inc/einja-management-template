/**
 * Vibe-Kanban REST API クライアント
 *
 * MCP では対応していないプロジェクト作成機能を提供
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/** プロジェクト作成レスポンス */
interface CreateProjectResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
  };
  error_data?: unknown;
  message?: string;
}

/**
 * Vibe-Kanban REST API クライアント
 */
export class VibeKanbanRestClient {
  private baseUrl: string;

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
      const response = await fetch(`${this.baseUrl}/api/projects`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * プロジェクトを作成
   *
   * @param name プロジェクト名
   * @param repoPath リポジトリの絶対パス
   * @returns 作成されたプロジェクトの ID
   */
  async createProject(name: string, repoPath: string): Promise<string> {
    const displayName = basename(repoPath);

    const response = await fetch(`${this.baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        repositories: [
          {
            path: repoPath,
            display_name: displayName,
            git_repo_path: repoPath,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`プロジェクト作成に失敗しました: ${text}`);
    }

    const result = (await response.json()) as CreateProjectResponse;

    if (!result.success || !result.data?.id) {
      throw new Error(`プロジェクト作成に失敗しました: ${result.message || "Unknown error"}`);
    }

    return result.data.id;
  }
}
