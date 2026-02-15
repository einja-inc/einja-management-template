import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VibeKanbanClient } from "./vibe-kanban-client.js";

// MCP SDK クライアントをモック
vi.mock("@modelcontextprotocol/sdk/client/index.js");
vi.mock("@modelcontextprotocol/sdk/client/stdio.js");

describe("VibeKanbanClient", () => {
  let client: VibeKanbanClient;
  let mockMCPClient: {
    connect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // MCP クライアントのモックを作成
    mockMCPClient = {
      connect: vi.fn(),
      close: vi.fn(),
      callTool: vi.fn(),
    };

    // Client コンストラクタがモックを返すように設定
    vi.mocked(Client).mockImplementation(() => mockMCPClient as unknown as Client);

    client = new VibeKanbanClient();
  });

  describe("API名変更", () => {
    describe("listTasks", () => {
      it("内部で list_issues ツールを呼び出し、Issue一覧を取得できる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        const mockIssues = [
          { id: "issue-1", title: "Task 1", status: "todo" },
          { id: "issue-2", title: "Task 2", status: "in-progress" },
        ];

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issues: mockIssues }),
            },
          ],
        });

        // When: listTasks メソッドを呼び出す
        const result = await client.listTasks("project-123");

        // Then: list_issues ツールが呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "list_issues",
          arguments: { project_id: "project-123" },
        });

        // Then: Issue一覧が取得できる
        expect(result).toEqual(mockIssues);
      });
    });

    describe("getTask", () => {
      it("内部で get_issue ツールを issue_id パラメータで呼び出し、Issueを取得できる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        const mockIssue = {
          id: "issue-001",
          title: "Test Issue",
          status: "todo",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockIssue),
            },
          ],
        });

        // When: getTask メソッドを呼び出す
        const result = await client.getTask("issue-001");

        // Then: get_issue ツールが issue_id パラメータで呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "get_issue",
          arguments: { issue_id: "issue-001" },
        });

        // Then: Issueが取得できる
        expect(result).toEqual(mockIssue);
      });

      it("task_id パラメータではなく issue_id パラメータを使用する", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ id: "issue-001", title: "Test" }),
            },
          ],
        });

        // When: getTask メソッドを呼び出す
        await client.getTask("issue-001");

        // Then: task_id ではなく issue_id が使用される
        const callArgs = mockMCPClient.callTool.mock.calls[0][0];
        expect(callArgs.arguments).toHaveProperty("issue_id");
        expect(callArgs.arguments).not.toHaveProperty("task_id");
      });
    });

    describe("createTask", () => {
      it("内部で create_issue ツールを呼び出し、Issue IDを返す", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "new-issue-123" }),
            },
          ],
        });

        // When: createTask メソッドを呼び出す
        const result = await client.createTask("project-123", "New Task", "Description");

        // Then: create_issue ツールが呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "create_issue",
          arguments: {
            project_id: "project-123",
            title: "New Task",
            description: "Description",
          },
        });

        // Then: Issue IDが返る
        expect(result).toBe("new-issue-123");
      });

      it("レスポンスに issue_id が含まれる（task_id ではない）", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "new-issue-456" }),
            },
          ],
        });

        // When: createTask メソッドを呼び出す
        const result = await client.createTask("project-123", "Task", "Desc");

        // Then: issue_id が正しく取得される
        expect(result).toBe("new-issue-456");
      });
    });

    describe("updateTask", () => {
      it("内部で update_issue ツールを issue_id パラメータで呼び出す", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true }),
            },
          ],
        });

        // When: updateTask メソッドを呼び出す
        await client.updateTask("issue-001", "done");

        // Then: update_issue ツールが issue_id パラメータで呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: {
            issue_id: "issue-001",
            status: "done",
          },
        });
      });

      it("task_id パラメータではなく issue_id パラメータを使用する", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true }),
            },
          ],
        });

        // When: updateTask メソッドを呼び出す
        await client.updateTask("issue-001", "inprogress");

        // Then: task_id ではなく issue_id が使用される
        const callArgs = mockMCPClient.callTool.mock.calls[0][0];
        expect(callArgs.arguments).toHaveProperty("issue_id");
        expect(callArgs.arguments).not.toHaveProperty("task_id");
      });
    });
  });

  describe("型定義の整合性", () => {
    it("TypeScript型エラーが発生せず、戻り値の型が正しく推論される", async () => {
      // Given: Vibe-Kanban MCPが接続済み
      await client.connect();

      const mockIssues = [{ id: "issue-1", title: "Task 1", status: "todo" }];

      mockMCPClient.callTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({ issues: mockIssues }),
          },
        ],
      });

      // When: listTasks メソッドを呼び出す
      const result = await client.listTasks("project-123");

      // Then: 型推論が正しく機能する（TypeScriptコンパイル時に検証）
      const firstIssue = result[0];
      expect(firstIssue.id).toBeDefined();
      expect(firstIssue.title).toBeDefined();
    });
  });
});
