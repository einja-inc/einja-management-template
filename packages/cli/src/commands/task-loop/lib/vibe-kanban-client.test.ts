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

        // Then: Issue一覧が取得できる（in-progress は inprogress に変換される）
        expect(result).toEqual([
          { id: "issue-1", title: "Task 1", status: "todo" },
          { id: "issue-2", title: "Task 2", status: "inprogress" },
        ]);
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

  describe("組織対応", () => {
    describe("listOrganizations", () => {
      it("list_organizations ツールを呼び出し、組織一覧が取得できる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        const mockOrganizations = [
          { id: "org-1", name: "Organization A" },
          { id: "org-2", name: "Organization B" },
        ];

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ organizations: mockOrganizations }),
            },
          ],
        });

        // When: listOrganizations メソッドを呼び出す
        const result = await client.listOrganizations();

        // Then: list_organizations ツールが呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "list_organizations",
          arguments: {},
        });

        // Then: 組織一覧が取得できる
        expect(result).toEqual(mockOrganizations);
      });
    });

    describe("listProjects", () => {
      it("organization_id パラメータで list_projects ツールを呼び出す", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ projects: [] }),
            },
          ],
        });

        // When: listProjects メソッドを組織IDで呼び出す
        await client.listProjects("org-123");

        // Then: organization_id パラメータで呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "list_projects",
          arguments: { organization_id: "org-123" },
        });
      });
    });
  });

  describe("ステータス値統一", () => {
    describe("updateTask", () => {
      it("inprogress を指定すると、MCP には in-progress として送信される", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        });

        // When: inprogress を指定してタスクを更新
        await client.updateTask("issue-001", "inprogress");

        // Then: MCP には in-progress として送信される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: {
            issue_id: "issue-001",
            status: "in-progress",
          },
        });
      });

      it("todo や done は変換されずにそのまま送信される", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        });

        // When: todo と done を送信
        await client.updateTask("issue-001", "todo");
        await client.updateTask("issue-002", "done");

        // Then: 変換されずにそのまま送信される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: { issue_id: "issue-001", status: "todo" },
        });
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: { issue_id: "issue-002", status: "done" },
        });
      });
    });

    describe("getTask", () => {
      it("MCP から in-progress を受信すると、内部では inprogress として扱う", async () => {
        // Given: MCP が in-progress ステータスのタスクを返す
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: "issue-001",
                title: "Test",
                status: "in-progress",
              }),
            },
          ],
        });

        // When: getTask を呼び出す
        const task = await client.getTask("issue-001");

        // Then: 内部では inprogress として扱う
        expect(task?.status).toBe("inprogress");
      });
    });

    describe("listTasks", () => {
      it("MCP から in-progress を受信すると、各タスクで inprogress に変換される", async () => {
        // Given: MCP が in-progress ステータスのタスクを含む一覧を返す
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issues: [
                  { id: "1", title: "Task 1", status: "todo" },
                  { id: "2", title: "Task 2", status: "in-progress" },
                  { id: "3", title: "Task 3", status: "done" },
                ],
              }),
            },
          ],
        });

        // When: listTasks を呼び出す
        const tasks = await client.listTasks("project-123");

        // Then: in-progress が inprogress に変換される
        expect(tasks[0].status).toBe("todo");
        expect(tasks[1].status).toBe("inprogress");
        expect(tasks[2].status).toBe("done");
      });
    });
  });

  describe("パラメータ変更対応", () => {
    describe("listRepos", () => {
      it("project_id パラメータなしで list_repos ツールを呼び出し、リポジトリ一覧が取得できる", async () => {
        // Given: vibe-kanban MCPが最新バージョンで接続済み
        await client.connect();

        const mockRepos = [
          { id: "repo-1", name: "Repository A" },
          { id: "repo-2", name: "Repository B" },
        ];

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ repos: mockRepos }),
            },
          ],
        });

        // When: listRepos メソッドを呼び出す
        const result = await client.listRepos();

        // Then: list_repos ツールがパラメータなし（空オブジェクト）で呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "list_repos",
          arguments: {},
        });

        // Then: リポジトリ一覧が取得できる
        expect(result).toEqual(mockRepos);
      });

      it("project_id パラメータが含まれていないことを確認", async () => {
        // Given: vibe-kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ repos: [] }),
            },
          ],
        });

        // When: listRepos メソッドを呼び出す
        await client.listRepos();

        // Then: arguments に project_id が含まれていない
        const callArgs = mockMCPClient.callTool.mock.calls[0][0];
        expect(callArgs.arguments).not.toHaveProperty("project_id");
        expect(callArgs.arguments).toEqual({});
      });
    });

    describe("startTaskAttempt", () => {
      it("title、executor、repos、issue_id のパラメータで start_workspace_session を呼び出し、Attemptが開始される", async () => {
        // Given: 有効なIssue ID、executor、reposが存在
        await client.connect();

        const mockAttempt = {
          id: "attempt-123",
          task_id: "issue-001",
          executor: "CLAUDE_CODE",
          base_branch: "main",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockAttempt),
            },
          ],
        });

        const title = "Test Task";
        const executor = "CLAUDE_CODE";
        const repos = [
          { repo_id: "repo-1", base_branch: "main" },
          { repo_id: "repo-2", base_branch: "develop" },
        ];
        const issueId = "issue-001";

        // When: startTaskAttempt を呼び出す
        const result = await client.startTaskAttempt(title, executor, repos, issueId);

        // Then: start_workspace_session に全パラメータが渡される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "start_workspace_session",
          arguments: {
            title,
            executor,
            repos,
            issue_id: issueId,
          },
        });

        // Then: Attemptが返る
        expect(result).toEqual(mockAttempt);
      });

      it("issue_id がオプショナルで、指定しない場合はパラメータに含まれない", async () => {
        // Given: vibe-kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ id: "attempt-456" }),
            },
          ],
        });

        const title = "Test Task Without Issue ID";
        const executor = "CLAUDE_CODE";
        const repos = [{ repo_id: "repo-1", base_branch: "main" }];

        // When: startTaskAttempt を issue_id なしで呼び出す
        await client.startTaskAttempt(title, executor, repos);

        // Then: arguments に issue_id が含まれていない
        const callArgs = mockMCPClient.callTool.mock.calls[0][0];
        expect(callArgs.arguments).not.toHaveProperty("issue_id");
        expect(callArgs.arguments).toEqual({
          title,
          executor,
          repos,
        });
      });

      it("task_id パラメータではなく issue_id パラメータを使用する", async () => {
        // Given: vibe-kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ id: "attempt-789" }),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        await client.startTaskAttempt(
          "Test Task",
          "CLAUDE_CODE",
          [{ repo_id: "repo-1", base_branch: "main" }],
          "issue-001"
        );

        // Then: task_id ではなく issue_id が使用される
        const callArgs = mockMCPClient.callTool.mock.calls[0][0];
        expect(callArgs.arguments).toHaveProperty("issue_id");
        expect(callArgs.arguments).not.toHaveProperty("task_id");
      });
    });
  });

  describe("レスポンス形式変更対応（TDD: Red-Green-Refactor）", () => {
    describe("startTaskAttempt - 新形式対応", () => {
      it("新形式（attempt_id, issue_id）のレスポンスを渡すと、VibeKanbanAttemptにマッピングされる", async () => {
        // Given: 新形式のレスポンス
        await client.connect();

        const mockResponse = {
          attempt_id: "attempt-123",
          issue_id: "issue-001",
          executor: "CLAUDE_CODE",
          base_branch: "main",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockResponse),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        const result = await client.startTaskAttempt(
          "Test Task",
          "CLAUDE_CODE",
          [{ repo_id: "repo-1", base_branch: "main" }],
          "issue-001"
        );

        // Then: フィールド名がマッピングされる
        expect(result.id).toBe("attempt-123");
        expect(result.task_id).toBe("issue-001");
        expect(result.executor).toBe("CLAUDE_CODE");
        expect(result.base_branch).toBe("main");
      });

      it("旧形式（id, task_id）のレスポンスを渡すと、そのままVibeKanbanAttemptとして扱われる", async () => {
        // Given: 旧形式のレスポンス
        await client.connect();

        const mockResponse = {
          id: "attempt-456",
          task_id: "task-002",
          executor: "CLAUDE_CODE",
          base_branch: "develop",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockResponse),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        const result = await client.startTaskAttempt(
          "Test Task",
          "CLAUDE_CODE",
          [{ repo_id: "repo-1", base_branch: "develop" }]
        );

        // Then: 旧形式がそのまま返る
        expect(result.id).toBe("attempt-456");
        expect(result.task_id).toBe("task-002");
      });

      it("ネスト形式のレスポンスを渡すと、attempt.idが正しく取得される", async () => {
        // Given: ネスト形式のレスポンス
        await client.connect();

        const mockResponse = {
          attempt: {
            id: "attempt-789",
            status: "in-progress",
          },
          issue_id: "issue-003",
          executor: "CLAUDE_CODE",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockResponse),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        const result = await client.startTaskAttempt(
          "Test Task",
          "CLAUDE_CODE",
          [{ repo_id: "repo-1", base_branch: "main" }],
          "issue-003"
        );

        // Then: ネストが解除される
        expect(result.id).toBe("attempt-789");
        expect(result.task_id).toBe("issue-003");
      });

      it("配列形式のレスポンスを渡すと、最初の要素が取得される", async () => {
        // Given: 配列形式のレスポンス
        await client.connect();

        const mockResponse = {
          attempts: [
            {
              id: "attempt-aaa",
              issue_id: "issue-004",
              executor: "CLAUDE_CODE",
              base_branch: "feature",
            },
          ],
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockResponse),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        const result = await client.startTaskAttempt(
          "Test Task",
          "CLAUDE_CODE",
          [{ repo_id: "repo-1", base_branch: "feature" }]
        );

        // Then: 配列の最初の要素が返る
        expect(result.id).toBe("attempt-aaa");
        expect(result.task_id).toBe("issue-004");
      });
    });

    describe("startTaskAttempt - 異常系", () => {
      it("未対応のレスポンス形式の場合、エラーがスローされる", async () => {
        // Given: 未対応の形式
        await client.connect();

        const mockResponse = {
          unknown_field: "value",
        };

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify(mockResponse),
            },
          ],
        });

        // When: startTaskAttempt を呼び出す
        // Then: エラーがスローされる
        await expect(
          client.startTaskAttempt(
            "Test Task",
            "CLAUDE_CODE",
            [{ repo_id: "repo-1", base_branch: "main" }]
          )
        ).rejects.toThrow("未対応のレスポンス形式です");
      });
    });
  });
});
