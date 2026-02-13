/**
 * Vibe-Kanban MCP クライアントのテスト
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// @modelcontextprotocol/sdk をモック
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    callTool: vi.fn(),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

// node:child_process をモック
vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

// node:fs をモック
vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { VibeKanbanClient } from "./vibe-kanban-client.js";

describe("VibeKanbanClient", () => {
  let client: VibeKanbanClient;
  let mockCallTool: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Client モックの callTool をセットアップ
    mockCallTool = vi.fn();
    vi.mocked(Client).mockImplementation(
      () =>
        ({
          connect: vi.fn(),
          close: vi.fn(),
          callTool: mockCallTool,
        }) as unknown as InstanceType<typeof Client>
    );

    client = new VibeKanbanClient();
  });

  describe("listOrganizations", () => {
    it("接続状態で組織一覧APIを呼び出すと、組織の配列が返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { id: "org-1", name: "Organization 1" },
              { id: "org-2", name: "Organization 2" },
            ]),
          },
        ],
      });

      // When: listOrganizations を呼び出す
      const result = await client.listOrganizations();

      // Then: 組織一覧が返る
      expect(result).toEqual([
        { id: "org-1", name: "Organization 1" },
        { id: "org-2", name: "Organization 2" },
      ]);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "list_organizations",
        arguments: {},
      });
    });

    it("未接続状態で呼び出すと、エラーがスローされる", async () => {
      // Given: 未接続状態

      // When/Then: エラーがスローされる
      await expect(client.listOrganizations()).rejects.toThrow(
        "Vibe-Kanban MCP サーバーに接続されていません"
      );
    });

    it("空の組織一覧の場合、空の配列が返る", async () => {
      // Given: 接続済み状態と空のレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "[]" }],
      });

      // When: listOrganizations を呼び出す
      const result = await client.listOrganizations();

      // Then: 空の配列が返る
      expect(result).toEqual([]);
    });
  });

  describe("listProjects", () => {
    it("組織IDを指定してプロジェクト一覧APIを呼び出すと、プロジェクトの配列が返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      const organizationId = "org-123";
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { id: "proj-1", name: "Project 1" },
              { id: "proj-2", name: "Project 2" },
            ]),
          },
        ],
      });

      // When: listProjects を呼び出す
      const result = await client.listProjects(organizationId);

      // Then: プロジェクト一覧が返る
      expect(result).toEqual([
        { id: "proj-1", name: "Project 1" },
        { id: "proj-2", name: "Project 2" },
      ]);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "list_projects",
        arguments: { organization_id: organizationId },
      });
    });

    it("未接続状態で呼び出すと、エラーがスローされる", async () => {
      // Given: 未接続状態

      // When/Then: エラーがスローされる
      await expect(client.listProjects("org-123")).rejects.toThrow(
        "Vibe-Kanban MCP サーバーに接続されていません"
      );
    });
  });

  describe("startWorkspaceSession", () => {
    it("必須パラメータでワークスペースセッションを開始すると、セッション情報が返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      const mockSession = {
        id: "session-123",
        executor: "CLAUDE_CODE",
        base_branch: "main",
      };
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(mockSession) }],
      });

      // When: startWorkspaceSession を呼び出す
      const result = await client.startWorkspaceSession(
        "Test Session",
        "CLAUDE_CODE",
        [{ repo_id: "repo-1", base_branch: "main" }]
      );

      // Then: セッション情報が返る
      expect(result).toEqual(mockSession);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "start_workspace_session",
        arguments: {
          title: "Test Session",
          executor: "CLAUDE_CODE",
          repos: [{ repo_id: "repo-1", base_branch: "main" }],
        },
      });
    });

    it("issueIdを指定してワークスペースセッションを開始すると、issue_idが引数に含まれる", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      const mockSession = {
        id: "session-456",
        issue_id: "issue-789",
        executor: "CLAUDE_CODE",
        base_branch: "main",
      };
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(mockSession) }],
      });

      // When: issueId付きで startWorkspaceSession を呼び出す
      const result = await client.startWorkspaceSession(
        "Test Session with Issue",
        "CLAUDE_CODE",
        [{ repo_id: "repo-1", base_branch: "main" }],
        "issue-789"
      );

      // Then: issue_idが引数に含まれる
      expect(result).toEqual(mockSession);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "start_workspace_session",
        arguments: {
          title: "Test Session with Issue",
          executor: "CLAUDE_CODE",
          repos: [{ repo_id: "repo-1", base_branch: "main" }],
          issue_id: "issue-789",
        },
      });
    });

    it("セッション開始に失敗した場合、エラーがスローされる", async () => {
      // Given: 接続済み状態と空オブジェクトのレスポンス（idがない）
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [],
      });

      // When/Then: エラーがスローされる
      await expect(
        client.startWorkspaceSession("Test Session", "CLAUDE_CODE", [
          { repo_id: "repo-1", base_branch: "main" },
        ])
      ).rejects.toThrow("ワークスペースセッションの開始に失敗しました");
    });

    it("未接続状態で呼び出すと、エラーがスローされる", async () => {
      // Given: 未接続状態

      // When/Then: エラーがスローされる
      await expect(
        client.startWorkspaceSession("Test Session", "CLAUDE_CODE", [
          { repo_id: "repo-1", base_branch: "main" },
        ])
      ).rejects.toThrow("Vibe-Kanban MCP サーバーに接続されていません");
    });
  });

  describe("parseToolResult (内部メソッド - 公開メソッド経由でテスト)", () => {
    it("structuredContentがある場合、それを使用する", async () => {
      // Given: 接続済み状態とstructuredContent付きレスポンス
      await client.connect();
      const expectedData = [{ id: "org-1", name: "Org 1" }];
      mockCallTool.mockResolvedValueOnce({
        structuredContent: expectedData,
      });

      // When: listOrganizations を呼び出す
      const result = await client.listOrganizations();

      // Then: structuredContentの値が返る
      expect(result).toEqual(expectedData);
    });

    it("isErrorフラグがtrueの場合、エラーがスローされる", async () => {
      // Given: 接続済み状態とエラーレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: "API Error" }) }],
      });

      // When/Then: エラーがスローされる
      await expect(client.listOrganizations()).rejects.toThrow("API Error");
    });

    it("is_errorフラグがtrueの場合、エラーがスローされる", async () => {
      // Given: 接続済み状態とエラーレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        is_error: true,
        content: [
          { type: "text", text: JSON.stringify({ error: "Another Error", details: "Some details" }) },
        ],
      });

      // When/Then: エラーがスローされる
      await expect(client.listOrganizations()).rejects.toThrow("Another Error: Some details");
    });

    it("success: false のレスポンスの場合、エラーがスローされる", async () => {
      // Given: 接続済み状態とsuccess: falseレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [
          { type: "text", text: JSON.stringify({ success: false, error: "Operation failed" }) },
        ],
      });

      // When/Then: エラーがスローされる
      await expect(client.listOrganizations()).rejects.toThrow("Operation failed");
    });
  });

  describe("listIssues", () => {
    it("プロジェクトIDを指定してIssue一覧を取得すると、Issueの配列が返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { id: "issue-1", title: "Issue 1", status: "todo" },
              { id: "issue-2", title: "Issue 2", status: "in-progress" },
            ]),
          },
        ],
      });

      // When: listIssues を呼び出す
      const result = await client.listIssues("proj-123");

      // Then: Issue一覧が返る
      expect(result).toEqual([
        { id: "issue-1", title: "Issue 1", status: "todo" },
        { id: "issue-2", title: "Issue 2", status: "in-progress" },
      ]);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "list_issues",
        arguments: { project_id: "proj-123" },
      });
    });

    it("プロジェクトIDなしで呼び出すと、空のargumentsでAPIが呼ばれる", async () => {
      // Given: 接続済み状態
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "[]" }],
      });

      // When: プロジェクトIDなしで listIssues を呼び出す
      await client.listIssues();

      // Then: 空のargumentsでAPIが呼ばれる
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "list_issues",
        arguments: {},
      });
    });
  });

  describe("getIssue", () => {
    it("IssueIDを指定してIssueを取得すると、Issueオブジェクトが返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({ id: "issue-1", title: "Test Issue", status: "done" }),
          },
        ],
      });

      // When: getIssue を呼び出す
      const result = await client.getIssue("issue-1");

      // Then: Issueオブジェクトが返る
      expect(result).toEqual({ id: "issue-1", title: "Test Issue", status: "done" });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "get_issue",
        arguments: { issue_id: "issue-1" },
      });
    });
  });

  describe("createIssue", () => {
    it("必須パラメータでIssueを作成すると、IssueIDが返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ issue_id: "new-issue-123" }) }],
      });

      // When: createIssue を呼び出す
      const result = await client.createIssue("proj-123", "New Issue", "Description");

      // Then: Issue IDが返る
      expect(result).toBe("new-issue-123");
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "create_issue",
        arguments: {
          project_id: "proj-123",
          title: "New Issue",
          description: "Description",
        },
      });
    });

    it("プロジェクトIDなしでIssueを作成すると、project_idが引数に含まれない", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ issue_id: "new-issue-456" }) }],
      });

      // When: プロジェクトIDなしで createIssue を呼び出す
      const result = await client.createIssue(undefined, "New Issue", "Description");

      // Then: project_idが引数に含まれない
      expect(result).toBe("new-issue-456");
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "create_issue",
        arguments: {
          title: "New Issue",
          description: "Description",
        },
      });
    });

    it("Issue作成に失敗した場合、エラーがスローされる", async () => {
      // Given: 接続済み状態と空のレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [],
      });

      // When/Then: エラーがスローされる
      await expect(client.createIssue("proj-123", "New Issue", "Description")).rejects.toThrow(
        "Issueの作成に失敗しました"
      );
    });
  });

  describe("updateIssue", () => {
    it("IssueIDとステータスを指定してIssueを更新する", async () => {
      // Given: 接続済み状態
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "text", text: "{}" }],
      });

      // When: updateIssue を呼び出す
      await client.updateIssue("issue-123", "done");

      // Then: 正しい引数でAPIが呼ばれる
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "update_issue",
        arguments: {
          issue_id: "issue-123",
          status: "done",
        },
      });
    });
  });

  describe("listRepos", () => {
    it("リポジトリ一覧を取得すると、リポジトリの配列が返る", async () => {
      // Given: 接続済み状態とモックレスポンス
      await client.connect();
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { id: "repo-1", name: "Repo 1" },
              { id: "repo-2", name: "Repo 2" },
            ]),
          },
        ],
      });

      // When: listRepos を呼び出す
      const result = await client.listRepos();

      // Then: リポジトリ一覧が返る
      expect(result).toEqual([
        { id: "repo-1", name: "Repo 1" },
        { id: "repo-2", name: "Repo 2" },
      ]);
      expect(mockCallTool).toHaveBeenCalledWith({
        name: "list_repos",
        arguments: {},
      });
    });
  });
});
