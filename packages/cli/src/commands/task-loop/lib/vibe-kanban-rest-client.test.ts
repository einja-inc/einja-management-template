import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VibeKanbanRestClient } from "./vibe-kanban-rest-client.js";

// fetchをモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("VibeKanbanRestClient", () => {
  let client: VibeKanbanRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    client = new VibeKanbanRestClient(12345);
    // setTimeoutをモックしてリトライの待機をスキップ
    vi.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setParentIssue", () => {
    it("正常時、PATCH リクエストが /api/remote/issues/{issueId} に parent_issue_id 付きで送信される", async () => {
      // Given: 正常なレスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "OK",
      });

      // When: setParentIssue を呼び出す
      await client.setParentIssue("issue-123", "parent-456");

      // Then: PATCH リクエストが正しいURL・ボディで送信される
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:12345/api/remote/issues/issue-123",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_issue_id: "parent-456" }),
        }
      );
    });

    it("レスポンスが非200の場合、エラーがスローされる", async () => {
      // Given: 404 レスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      // When/Then: エラーがスローされる
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "parent_issue_id の設定に失敗しました (404)"
      );
    });
  });

  describe("removeParentIssue", () => {
    it("正常時、PATCH リクエストが { parent_issue_id: null } 付きで送信される", async () => {
      // Given: 正常なレスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "OK",
      });

      // When: removeParentIssue を呼び出す
      await client.removeParentIssue("issue-123");

      // Then: PATCH リクエストが null の parent_issue_id で送信される
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:12345/api/remote/issues/issue-123",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_issue_id: null }),
        }
      );
    });

    it("500エラーが3回続いた場合、fetchWithRetryからエラーがスローされる", async () => {
      // Given: 500 レスポンスが毎回返る（リトライ後も失敗）
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal Server Error",
      });

      // When/Then: fetchWithRetry が最終リトライ後にエラーをスローする
      await expect(client.removeParentIssue("issue-123")).rejects.toThrow(
        "REST API request failed after 3 retries: 500"
      );

      // Then: fetch が MAX_RETRIES (3) 回呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("listIssuesWithParent", () => {
    it("正常時、Issue一覧が返される（parent_issue_id フィールド含む）", async () => {
      // Given: Issue一覧を含むレスポンスが返る
      const mockIssues = [
        { id: "issue-1", title: "Task 1", status: "todo", parent_issue_id: null },
        { id: "issue-2", title: "Task 2", status: "done", parent_issue_id: "issue-1" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues: mockIssues }),
      });

      // When: listIssuesWithParent を呼び出す
      const result = await client.listIssuesWithParent("project-abc");

      // Then: Issue一覧が返る
      expect(result).toEqual(mockIssues);
      expect(result[0].parent_issue_id).toBeNull();
      expect(result[1].parent_issue_id).toBe("issue-1");
    });

    it("正常時、GET リクエストが /api/remote/issues?project_id={projectId} に送信される", async () => {
      // Given: 正常なレスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      });

      // When: listIssuesWithParent を呼び出す
      await client.listIssuesWithParent("my-project");

      // Then: 正しいURLで GET リクエストが送信される
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:12345/api/remote/issues?project_id=my-project",
        { method: "GET" }
      );
    });

    it("issues が空の場合、空配列が返される", async () => {
      // Given: 空の issues リストが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      });

      // When: listIssuesWithParent を呼び出す
      const result = await client.listIssuesWithParent("project-abc");

      // Then: 空配列が返る
      expect(result).toEqual([]);
    });

    it("issues フィールドがない場合も空配列が返される", async () => {
      // Given: issues フィールドなしのレスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      // When: listIssuesWithParent を呼び出す
      const result = await client.listIssuesWithParent("project-abc");

      // Then: 空配列が返る
      expect(result).toEqual([]);
    });
  });

  describe("probeCapability", () => {
    it("レスポンスが200の場合、trueが返る", async () => {
      // Given: 200 レスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // When: probeCapability を呼び出す
      const result = await client.probeCapability();

      // Then: true が返る
      expect(result).toBe(true);
    });

    it("レスポンスが404の場合、trueが返る（APIは動作している）", async () => {
      // Given: 404 レスポンスが返る（プロジェクトが見つからないが API は動作中）
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // When: probeCapability を呼び出す
      const result = await client.probeCapability();

      // Then: true が返る（404 はAPIが動作している証拠）
      expect(result).toBe(true);
    });

    it("レスポンスが502の場合、falseが返る", async () => {
      // Given: 502 レスポンスが返る（バックエンドが停止中）
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      // When: probeCapability を呼び出す
      const result = await client.probeCapability();

      // Then: false が返る
      expect(result).toBe(false);
    });

    it("レスポンスが503の場合、falseが返る", async () => {
      // Given: 503 レスポンスが返る（サービス利用不可）
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      // When: probeCapability を呼び出す
      const result = await client.probeCapability();

      // Then: false が返る
      expect(result).toBe(false);
    });

    it("fetch失敗（ネットワークエラー）の場合、falseが返る", async () => {
      // Given: ネットワークエラーが発生する
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // When: probeCapability を呼び出す
      const result = await client.probeCapability();

      // Then: false が返る
      expect(result).toBe(false);
    });
  });

  describe("fetchWithRetry（間接テスト）", () => {
    it("429エラーの場合、リトライして成功する（setParentIssue経由でテスト）", async () => {
      // Given: 最初のリクエストは 429、2回目は成功
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Too Many Requests",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "OK",
        });

      // When: setParentIssue を呼び出す
      await client.setParentIssue("issue-123", "parent-456");

      // Then: 2回 fetch が呼ばれる（リトライされた）
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("500エラーの場合、リトライして成功する", async () => {
      // Given: 最初のリクエストは 500、2回目は成功
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => "OK",
        });

      // When: setParentIssue を呼び出す
      await client.setParentIssue("issue-123", "parent-456");

      // Then: 2回 fetch が呼ばれる（リトライされた）
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("401エラーの場合、リトライせず即座にエラーがスローされる", async () => {
      // Given: 401 レスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      // When/Then: リトライせず即座にエラーがスローされる
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "認証エラー (401)"
      );

      // Then: fetch は1回しか呼ばれない
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("403エラーの場合、リトライせず即座にエラーがスローされる", async () => {
      // Given: 403 レスポンスが返る
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      });

      // When/Then: リトライせず即座にエラーがスローされる
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "認証エラー (403)"
      );

      // Then: fetch は1回しか呼ばれない
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("3回全てネットワークエラーの場合、最後のエラーがスローされる", async () => {
      // Given: 全3回ネットワークエラーが発生する
      const networkError = new Error("Network error");
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      // When/Then: 最後のエラーがスローされる
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "Network error"
      );

      // Then: fetch が MAX_RETRIES (3) 回呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("429エラーが3回続いた場合、最終リトライ後にエラーがスローされる", async () => {
      // Given: 全3回 429 が返る
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Too Many Requests",
      });

      // When/Then: fetchWithRetry が最終リトライ後にエラーをスローする
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "REST API request failed after 3 retries: 429"
      );

      // Then: fetch が MAX_RETRIES (3) 回呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("5xxエラーが3回続いた場合、最終リトライ後にエラーがスローされる", async () => {
      // Given: 全3回 503 が返る
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "Service Unavailable",
      });

      // When/Then: fetchWithRetry が最終リトライ後にエラーをスローする
      await expect(client.setParentIssue("issue-123", "parent-456")).rejects.toThrow(
        "REST API request failed after 3 retries: 503"
      );

      // Then: fetch が MAX_RETRIES (3) 回呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
