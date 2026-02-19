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
          { id: "issue-1", title: "Task 1", status: "Todo" },
          { id: "issue-2", title: "Task 2", status: "In Progress" },
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

        // Then: Issue一覧が取得できる（ステータスはそのまま返される）
        expect(result).toEqual([
          { id: "issue-1", title: "Task 1", status: "Todo" },
          { id: "issue-2", title: "Task 2", status: "In Progress" },
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
        await client.updateTask("issue-001", "Done");

        // Then: update_issue ツールが issue_id パラメータで呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: {
            issue_id: "issue-001",
            status: "Done",
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
        await client.updateTask("issue-001", "In Progress");

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
      it("In Progress を指定すると、MCP にそのまま送信される", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        });

        // When: In Progress を指定してタスクを更新
        await client.updateTask("issue-001", "In Progress");

        // Then: MCP にそのまま送信される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: {
            issue_id: "issue-001",
            status: "In Progress",
          },
        });
      });

      it("Todo や Done はそのまま送信される", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        });

        // When: Todo と Done を送信
        await client.updateTask("issue-001", "Todo");
        await client.updateTask("issue-002", "Done");

        // Then: そのまま送信される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: { issue_id: "issue-001", status: "Todo" },
        });
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "update_issue",
          arguments: { issue_id: "issue-002", status: "Done" },
        });
      });
    });

    describe("getTask", () => {
      it("MCP から In Progress を受信すると、そのまま返される", async () => {
        // Given: MCP が In Progress ステータスのタスクを返す
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: "issue-001",
                title: "Test",
                status: "In Progress",
              }),
            },
          ],
        });

        // When: getTask を呼び出す
        const task = await client.getTask("issue-001");

        // Then: そのまま返される
        expect(task?.status).toBe("In Progress");
      });
    });

    describe("listTasks", () => {
      it("MCP から受信したステータス値がそのまま返される", async () => {
        // Given: MCP が各種ステータスのタスクを含む一覧を返す
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issues: [
                  { id: "1", title: "Task 1", status: "Todo" },
                  { id: "2", title: "Task 2", status: "In Progress" },
                  { id: "3", title: "Task 3", status: "Done" },
                ],
              }),
            },
          ],
        });

        // When: listTasks を呼び出す
        const tasks = await client.listTasks("project-123");

        // Then: そのまま返される
        expect(tasks[0].status).toBe("Todo");
        expect(tasks[1].status).toBe("In Progress");
        expect(tasks[2].status).toBe("Done");
      });
    });
  });

  describe("親Issue/サブIssue対応", () => {
    describe("createParentIssue", () => {
      it("createParentIssue を呼び出すと、内部で create_issue ツールが呼ばれ、Issue IDが返る", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "parent-issue-123" }),
            },
          ],
        });

        // When: createParentIssue メソッドを呼び出す
        const result = await client.createParentIssue("project-123", "Parent Task", "Parent Description");

        // Then: create_issue ツールが呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "create_issue",
          arguments: {
            project_id: "project-123",
            title: "Parent Task",
            description: "Parent Description",
          },
        });

        // Then: Issue IDが返る
        expect(result).toBe("parent-issue-123");
      });

      it("createTask と同じパラメータで create_issue が呼び出される", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "issue-abc" }),
            },
          ],
        });

        // When: createParentIssue と createTask を同じ引数で呼び出す
        await client.createParentIssue("project-x", "Title", "Desc");
        await client.createTask("project-x", "Title", "Desc");

        // Then: どちらも同じ引数で create_issue が呼ばれる
        expect(mockMCPClient.callTool).toHaveBeenCalledTimes(2);
        const firstCallArgs = mockMCPClient.callTool.mock.calls[0][0];
        const secondCallArgs = mockMCPClient.callTool.mock.calls[1][0];
        expect(firstCallArgs).toEqual(secondCallArgs);
      });
    });

    describe("createSubIssue", () => {
      it("MCP create_issue 成功 + REST PATCH 成功の場合、サブIssue IDが返る", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "sub-issue-456" }),
            },
          ],
        });

        const mockRestClient = {
          setParentIssue: vi.fn().mockResolvedValueOnce(undefined),
        };

        // When: createSubIssue メソッドを呼び出す
        const result = await client.createSubIssue(
          "project-123",
          "parent-issue-001",
          "Sub Task",
          "Sub Description",
          mockRestClient
        );

        // Then: create_issue ツールが呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "create_issue",
          arguments: {
            project_id: "project-123",
            title: "Sub Task",
            description: "Sub Description",
          },
        });

        // Then: setParentIssue が正しい引数で呼ばれる
        expect(mockRestClient.setParentIssue).toHaveBeenCalledWith("sub-issue-456", "parent-issue-001");

        // Then: サブIssue IDが返る
        expect(result).toBe("sub-issue-456");
      });

      it("REST PATCH が1回目失敗・2回目成功の場合、リトライして成功する", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "sub-issue-789" }),
            },
          ],
        });

        // setTimeout をモックしてすぐ実行させる
        const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(
          (fn: TimerHandler) => {
            if (typeof fn === "function") fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
          }
        );

        const mockRestClient = {
          setParentIssue: vi
            .fn()
            .mockRejectedValueOnce(new Error("Network error"))
            .mockResolvedValueOnce(undefined),
        };

        // When: createSubIssue メソッドを呼び出す
        const result = await client.createSubIssue(
          "project-123",
          "parent-issue-001",
          "Sub Task",
          "Sub Description",
          mockRestClient
        );

        // Then: setParentIssue が2回呼ばれる（1回失敗 + 1回成功）
        expect(mockRestClient.setParentIssue).toHaveBeenCalledTimes(2);

        // Then: サブIssue IDが返る
        expect(result).toBe("sub-issue-789");

        setTimeoutSpy.mockRestore();
      });

      it("REST PATCH が3回全て失敗した場合、deleteTask が呼ばれてからエラーがスローされる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        // create_issue の成功レスポンス + delete_issue の成功レスポンス
        mockMCPClient.callTool
          .mockResolvedValueOnce({
            content: [
              {
                type: "text",
                text: JSON.stringify({ issue_id: "sub-issue-fail" }),
              },
            ],
          })
          .mockResolvedValueOnce({
            content: [{ type: "text", text: JSON.stringify({ success: true }) }],
          });

        // setTimeout をモックしてすぐ実行させる
        const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(
          (fn: TimerHandler) => {
            if (typeof fn === "function") fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
          }
        );

        const mockRestClient = {
          setParentIssue: vi.fn().mockRejectedValue(new Error("Persistent error")),
        };

        // When: createSubIssue メソッドを呼び出す
        await expect(
          client.createSubIssue(
            "project-123",
            "parent-issue-001",
            "Sub Task",
            "Sub Description",
            mockRestClient
          )
        ).rejects.toThrow("サブIssueの作成に失敗しました");

        // Then: setParentIssue が3回呼ばれる
        expect(mockRestClient.setParentIssue).toHaveBeenCalledTimes(3);

        // Then: delete_issue ツールが呼ばれる（deleteTask 経由）
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "delete_issue",
          arguments: { issue_id: "sub-issue-fail" },
        });

        setTimeoutSpy.mockRestore();
      });

      it("restClient.setParentIssue が正しい引数（issueId, parentIssueId）で呼ばれる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ issue_id: "sub-issue-999" }),
            },
          ],
        });

        const mockRestClient = {
          setParentIssue: vi.fn().mockResolvedValueOnce(undefined),
        };

        // When: createSubIssue メソッドを呼び出す
        await client.createSubIssue(
          "project-abc",
          "parent-issue-xyz",
          "My Sub Task",
          "Description",
          mockRestClient
        );

        // Then: setParentIssue が issueId=作成されたID, parentIssueId=指定した親ID で呼ばれる
        expect(mockRestClient.setParentIssue).toHaveBeenCalledWith("sub-issue-999", "parent-issue-xyz");
        expect(mockRestClient.setParentIssue).toHaveBeenCalledTimes(1);
      });
    });

    describe("deleteTask", () => {
      it("deleteTask を呼び出すと、delete_issue ツールが issue_id パラメータで呼ばれる", async () => {
        // Given: Vibe-Kanban MCPが接続済み
        await client.connect();

        mockMCPClient.callTool.mockResolvedValueOnce({
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        });

        // When: deleteTask メソッドを呼び出す
        await client.deleteTask("issue-to-delete-001");

        // Then: delete_issue ツールが issue_id パラメータで呼び出される
        expect(mockMCPClient.callTool).toHaveBeenCalledWith({
          name: "delete_issue",
          arguments: { issue_id: "issue-to-delete-001" },
        });
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
          status: "in-progress",
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
});
