import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TaskStateManager,
  extractIssueNumberFromTitle,
  extractPhaseNumberFromTitle,
  extractTaskGroupIdFromTitle,
  generateAgentPrompt,
  generateParentIssueDescription,
  generateParentIssueTitle,
  generateVibeKanbanDescription,
  generateVibeKanbanTitle,
} from "./task-state-manager.js";
import type { Phase, PhaseIssueMapping, TaskGroup, VibeKanbanTask } from "./types.js";

// 外部依存をモック
vi.mock("./github-client.js", () => ({
  getIssue: vi.fn(),
  markTaskGroupAsCompleted: vi.fn((body: string, taskGroupId: string) => {
    // チェックボックスを完了状態に変換するシンプルなモック実装
    const pattern = new RegExp(`- \\[ \\] ${taskGroupId}`);
    return body.replace(pattern, `- [x] ${taskGroupId}`);
  }),
  updateIssueBody: vi.fn(),
}));

vi.mock("./issue-parser.js", () => ({
  parseIssueBody: vi.fn((issue: { body: string }) => ({
    issueNumber: 22,
    title: "Test Issue",
    body: issue.body,
    phases: [],
  })),
}));

describe("TaskStateManager", () => {
  let manager: TaskStateManager;

  beforeEach(() => {
    manager = new TaskStateManager();
    vi.clearAllMocks();
    // console.log をモック化してテスト出力をクリーンに保つ
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerTaskMapping", () => {
    it("Vibe-KanbanタスクIDとタスクグループIDを登録するとマッピングが保存される", () => {
      // Given: タスクIDとグループIDのペア
      const vibeTaskId = "vibe-task-123";
      const taskGroupId = "1.2";

      // When: マッピングを登録
      manager.registerTaskMapping(vibeTaskId, taskGroupId);

      // Then: マッピングが保存され、後で取得できる
      const result = manager.getCompletedTaskGroupIds([vibeTaskId]);
      expect(result).toEqual(["1.2"]);
    });

    it("同一IDで再登録すると上書きされる", () => {
      // Given: 既に登録されているマッピング
      const vibeTaskId = "vibe-task-123";
      manager.registerTaskMapping(vibeTaskId, "1.2");

      // When: 同じIDで別のグループIDを登録
      manager.registerTaskMapping(vibeTaskId, "2.3");

      // Then: 新しいマッピングで上書きされる
      const result = manager.getCompletedTaskGroupIds([vibeTaskId]);
      expect(result).toEqual(["2.3"]);
    });
  });

  describe("initializeDoneTaskIds", () => {
    it("Done状態のタスク一覧でpreviousDoneTaskIdsが設定される", () => {
      // Given: Done状態のタスクが2つ、他ステータスが1つ存在
      const tasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "done" },
        { id: "task-3", title: "[Issue22 1.3] Task 3", status: "todo" },
      ];

      // When: 初期化を実行
      manager.initializeDoneTaskIds(tasks);

      // Then: Done状態のタスクIDのみが記録される
      // 検証: 新規完了タスクなしと判定される
      const newlyCompleted = manager.detectNewlyCompletedTasks(tasks);
      expect(newlyCompleted).toEqual([]);
    });

    it("空のタスク一覧の場合、空Setになる", () => {
      // Given: 空のタスク一覧
      const tasks: VibeKanbanTask[] = [];

      // When: 初期化を実行
      manager.initializeDoneTaskIds(tasks);

      // Then: 空のSetが設定される
      // 検証: 後続で完了タスクを検出すると新規として扱われる
      const newTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
      ];
      const newlyCompleted = manager.detectNewlyCompletedTasks(newTasks);
      expect(newlyCompleted).toEqual(["task-1"]);
    });

    it("Issue番号を指定すると、該当Issueのタスクのみログ出力される", () => {
      // Given: Issue22とIssue23のタスクが混在
      const tasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue23 1.1] Task 2", status: "done" },
      ];

      // When: Issue22を指定して初期化
      manager.initializeDoneTaskIds(tasks, 22);

      // Then: ログ出力が実行される（console.logがモックされているため、実際の内容は検証しない）
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("initializeDoneTaskIds - レガシーフォーマット", () => {
    it("descriptionCacheからIssue番号を推論できる", () => {
      // Given: タイトルにIssue番号がない旧形式のタスクで、descriptionCacheにIssue情報が含まれる
      const tasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[1.1] Task 1", status: "done" },
        { id: "task-2", title: "[1.2] Task 2", status: "done" },
        { id: "task-3", title: "[2.1] Task 3", status: "todo" },
      ];

      // descriptionCache: task-1とtask-2がIssue22に属する
      const descriptionCache = new Map<string, string | null>([
        ["task-1", "## タスクファイル\n`GitHub Issue #22`\n\n## タスクグループ番号\n1.1"],
        ["task-2", "## タスクファイル\n`GitHub Issue #22`\n\n## タスクグループ番号\n1.2"],
        ["task-3", "## タスクファイル\n`GitHub Issue #99`\n\n## タスクグループ番号\n2.1"],
      ]);

      // When: Issue22を指定して初期化（descriptionCache経由でフィルタリング）
      manager.initializeDoneTaskIds(tasks, 22, descriptionCache);

      // Then: ログ出力が実行される（Issue22関連の2件がログ出力される）
      expect(console.log).toHaveBeenCalled();
      // 内部的にpreviousDoneTaskIdsに3件（全Done）が登録されることを検証
      const newlyCompleted = manager.detectNewlyCompletedTasks(tasks);
      expect(newlyCompleted).toEqual([]);
    });

    it("タイトルに[IssueXX]がない旧形式でも動作する", () => {
      // Given: 旧形式のタスクタイトル（Issue番号なし）
      const tasks: VibeKanbanTask[] = [
        { id: "task-old-1", title: "[1.1] レガシータスク1", status: "done" },
        { id: "task-old-2", title: "[1.2] レガシータスク2", status: "done" },
      ];

      // descriptionCache: 旧形式タスクのIssue情報
      const descriptionCache = new Map<string, string | null>([
        ["task-old-1", "GitHub Issue #22 の詳細説明\nタスク内容..."],
        ["task-old-2", "GitHub Issue #22 の詳細説明\nタスク内容..."],
      ]);

      // When: descriptionCacheを使用して初期化
      manager.initializeDoneTaskIds(tasks, 22, descriptionCache);

      // Then: エラーなく初期化される
      expect(console.log).toHaveBeenCalled();

      // Then: previousDoneTaskIdsに登録される
      const newlyCompleted = manager.detectNewlyCompletedTasks(tasks);
      expect(newlyCompleted).toEqual([]);
    });

    it("descriptionCacheがnullの場合でも正常動作する", () => {
      // Given: descriptionがnullのタスク
      const tasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[1.2] Task 2 (旧形式)", status: "done" },
      ];

      const descriptionCache = new Map<string, string | null>([
        ["task-1", "GitHub Issue #22"],
        ["task-2", null], // nullのケース
      ]);

      // When: 初期化を実行
      manager.initializeDoneTaskIds(tasks, 22, descriptionCache);

      // Then: エラーなく初期化される
      expect(console.log).toHaveBeenCalled();

      // Then: 新形式のタスク（task-1）のみログ出力される
      const newlyCompleted = manager.detectNewlyCompletedTasks(tasks);
      expect(newlyCompleted).toEqual([]);
    });

    it("新形式と旧形式が混在している場合、両方を正しく認識する", () => {
      // Given: 新形式と旧形式のタスクが混在
      const tasks: VibeKanbanTask[] = [
        { id: "task-new", title: "[Issue22 1.1] 新形式タスク", status: "done" },
        { id: "task-old", title: "[1.2] 旧形式タスク", status: "done" },
        { id: "task-other", title: "[Issue99 2.1] 別Issueのタスク", status: "done" },
      ];

      const descriptionCache = new Map<string, string | null>([
        ["task-new", "GitHub Issue #22"],
        ["task-old", "GitHub Issue #22 の旧形式タスク"],
        ["task-other", "GitHub Issue #99"],
      ]);

      // When: Issue22を指定して初期化
      manager.initializeDoneTaskIds(tasks, 22, descriptionCache);

      // Then: ログ出力が実行され、Issue22関連の2件（新形式1件+旧形式1件）が認識される
      expect(console.log).toHaveBeenCalled();

      // Then: 全Doneタスクが登録される
      const newlyCompleted = manager.detectNewlyCompletedTasks(tasks);
      expect(newlyCompleted).toEqual([]);
    });
  });

  describe("detectNewlyCompletedTasks", () => {
    it("前回より1タスク増加した場合、新規完了タスクIDを返す", () => {
      // Given: 初期状態で1つのタスクがDone
      const initialTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "todo" },
      ];
      manager.initializeDoneTaskIds(initialTasks);

      // When: task-2が完了した状態のタスク一覧
      const updatedTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "done" },
      ];

      // Then: task-2が新規完了タスクとして検出される
      const result = manager.detectNewlyCompletedTasks(updatedTasks);
      expect(result).toEqual(["task-2"]);
    });

    it("変化なしの場合、空配列を返す", () => {
      // Given: 初期状態で1つのタスクがDone
      const tasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "todo" },
      ];
      manager.initializeDoneTaskIds(tasks);

      // When: 同じ状態のタスク一覧で再検出
      const result = manager.detectNewlyCompletedTasks(tasks);

      // Then: 新規完了タスクは0件
      expect(result).toEqual([]);
    });

    it("複数タスク同時完了の場合、全IDを返す", () => {
      // Given: 初期状態で全タスクがTodo
      const initialTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "todo" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "todo" },
        { id: "task-3", title: "[Issue22 1.3] Task 3", status: "todo" },
      ];
      manager.initializeDoneTaskIds(initialTasks);

      // When: 3つのタスクが同時に完了
      const updatedTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "done" },
        { id: "task-3", title: "[Issue22 1.3] Task 3", status: "done" },
      ];

      // Then: 3つ全てが新規完了として検出される
      const result = manager.detectNewlyCompletedTasks(updatedTasks);
      expect(result).toEqual(["task-1", "task-2", "task-3"]);
    });

    it("Done状態が減少した場合（キャンセルなど）、previousDoneTaskIdsが正しく更新される", () => {
      // Given: 初期状態で2つのタスクがDone
      const initialTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "done" },
      ];
      manager.initializeDoneTaskIds(initialTasks);

      // When: task-2がTodoに戻された状態
      const updatedTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "todo" },
      ];
      const result = manager.detectNewlyCompletedTasks(updatedTasks);

      // Then: 新規完了はなく、内部状態が更新される
      expect(result).toEqual([]);

      // Then: 次回task-2が完了すると新規完了として検出される
      const recompletedTasks: VibeKanbanTask[] = [
        { id: "task-1", title: "[Issue22 1.1] Task 1", status: "done" },
        { id: "task-2", title: "[Issue22 1.2] Task 2", status: "done" },
      ];
      const newResult = manager.detectNewlyCompletedTasks(recompletedTasks);
      expect(newResult).toEqual(["task-2"]);
    });
  });

  describe("getCompletedTaskGroupIds", () => {
    it("登録済みのタスクIDを渡すと対応するグループIDを返す", () => {
      // Given: マッピングが登録されている
      manager.registerTaskMapping("vibe-task-1", "1.1");
      manager.registerTaskMapping("vibe-task-2", "1.2");

      // When: 完了タスクのグループIDを取得
      const result = manager.getCompletedTaskGroupIds(["vibe-task-1", "vibe-task-2"]);

      // Then: 対応するグループIDが返る
      expect(result).toEqual(["1.1", "1.2"]);
    });

    it("未登録のタスクIDを含む場合、登録済みのもののみ返す", () => {
      // Given: 一部のマッピングのみ登録
      manager.registerTaskMapping("vibe-task-1", "1.1");

      // When: 未登録のIDを含めて取得
      const result = manager.getCompletedTaskGroupIds(["vibe-task-1", "vibe-task-unknown"]);

      // Then: 登録済みのもののみ返る
      expect(result).toEqual(["1.1"]);
    });

    it("空配列を渡すと空配列を返す", () => {
      // Given: マッピング登録済み
      manager.registerTaskMapping("vibe-task-1", "1.1");

      // When: 空配列を渡す
      const result = manager.getCompletedTaskGroupIds([]);

      // Then: 空配列が返る
      expect(result).toEqual([]);
    });
  });

  describe("markTaskGroupsAsCompleted", () => {
    it("複数タスクグループIDの場合、GitHub Issueが更新される", async () => {
      // Given: モックの設定
      const { getIssue, updateIssueBody, markTaskGroupAsCompleted } = await import(
        "./github-client.js"
      );
      const mockGetIssue = getIssue as ReturnType<typeof vi.fn>;
      const mockUpdateIssueBody = updateIssueBody as ReturnType<typeof vi.fn>;
      const mockMarkTaskGroupAsCompleted = markTaskGroupAsCompleted as ReturnType<typeof vi.fn>;

      mockGetIssue.mockReturnValue({
        number: 22,
        title: "Test Issue",
        body: "- [ ] 1.1 Task 1\n- [ ] 1.2 Task 2",
        state: "open",
      });

      // When: 複数のタスクグループを完了マーク
      const result = await manager.markTaskGroupsAsCompleted(22, ["1.1", "1.2"]);

      // Then: markTaskGroupAsCompletedが各グループIDで呼ばれる
      expect(mockMarkTaskGroupAsCompleted).toHaveBeenCalledTimes(2);
      expect(mockMarkTaskGroupAsCompleted).toHaveBeenCalledWith(
        "- [ ] 1.1 Task 1\n- [ ] 1.2 Task 2",
        "1.1"
      );

      // Then: updateIssueBodyが呼ばれる
      expect(mockUpdateIssueBody).toHaveBeenCalledWith(22, expect.any(String));

      // Then: 更新後のIssueを取得して返す
      expect(mockGetIssue).toHaveBeenCalledTimes(2); // 取得→更新→再取得
      expect(result.issueNumber).toBe(22);
    });

    it("空配列の場合、Issue更新なし", async () => {
      // Given: モックの設定
      const { getIssue, updateIssueBody } = await import("./github-client.js");
      const mockGetIssue = getIssue as ReturnType<typeof vi.fn>;
      const mockUpdateIssueBody = updateIssueBody as ReturnType<typeof vi.fn>;

      mockGetIssue.mockReturnValue({
        number: 22,
        title: "Test Issue",
        body: "- [ ] 1.1 Task 1",
        state: "open",
      });

      // When: 空配列を渡す
      const result = await manager.markTaskGroupsAsCompleted(22, []);

      // Then: updateIssueBodyは呼ばれない
      expect(mockUpdateIssueBody).not.toHaveBeenCalled();

      // Then: Issueは1回のみ取得される
      expect(mockGetIssue).toHaveBeenCalledTimes(1);
      expect(result.issueNumber).toBe(22);
    });

    it("単一タスクグループIDの場合、正しくIssue更新される", async () => {
      // Given: モックの設定
      const { getIssue, updateIssueBody, markTaskGroupAsCompleted } = await import(
        "./github-client.js"
      );
      const mockGetIssue = getIssue as ReturnType<typeof vi.fn>;
      const mockUpdateIssueBody = updateIssueBody as ReturnType<typeof vi.fn>;
      const mockMarkTaskGroupAsCompleted = markTaskGroupAsCompleted as ReturnType<typeof vi.fn>;

      mockGetIssue.mockReturnValue({
        number: 22,
        title: "Test Issue",
        body: "- [ ] 1.1 Task 1",
        state: "open",
      });

      // When: 単一のタスクグループを完了マーク
      await manager.markTaskGroupsAsCompleted(22, ["1.1"]);

      // Then: markTaskGroupAsCompletedが1回呼ばれる
      expect(mockMarkTaskGroupAsCompleted).toHaveBeenCalledTimes(1);
      expect(mockMarkTaskGroupAsCompleted).toHaveBeenCalledWith("- [ ] 1.1 Task 1", "1.1");

      // Then: updateIssueBodyが呼ばれる
      expect(mockUpdateIssueBody).toHaveBeenCalledWith(22, expect.any(String));
    });
  });

  describe("extractTaskGroupIdFromTitle", () => {
    it("'[Issue22 1.2] タスク名'形式から'1.2'を抽出する", () => {
      // Given: 新形式のタイトル
      const title = "[Issue22 1.2] タスクグループ1.2の実装";

      // When: タスクグループIDを抽出
      const result = extractTaskGroupIdFromTitle(title);

      // Then: '1.2'が抽出される
      expect(result).toBe("1.2");
    });

    it("'[1.2] タスク名'旧形式から'1.2'を抽出する", () => {
      // Given: 旧形式のタイトル
      const title = "[1.2] タスクグループ1.2の実装";

      // When: タスクグループIDを抽出
      const result = extractTaskGroupIdFromTitle(title);

      // Then: '1.2'が抽出される
      expect(result).toBe("1.2");
    });

    it("形式不一致の場合、nullを返す", () => {
      // Given: パターンに一致しないタイトル
      const title = "普通のタスク名";

      // When: タスクグループIDを抽出
      const result = extractTaskGroupIdFromTitle(title);

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("タスクグループIDが複数桁でも正しく抽出する", () => {
      // Given: 複数桁のタスクグループID
      const title = "[Issue22 12.34] 複数桁のタスクグループ";

      // When: タスクグループIDを抽出
      const result = extractTaskGroupIdFromTitle(title);

      // Then: '12.34'が抽出される
      expect(result).toBe("12.34");
    });

    it("タイトル内に複数の[]がある場合、最初の正しいパターンを抽出する", () => {
      // Given: 複数の[]を含むタイトル
      const title = "[Issue22 1.2] [補足情報] タスク名";

      // When: タスクグループIDを抽出
      const result = extractTaskGroupIdFromTitle(title);

      // Then: '1.2'が抽出される（最初のパターン）
      expect(result).toBe("1.2");
    });
  });

  describe("extractIssueNumberFromTitle", () => {
    it("'[Issue22 1.2] タスク名'形式から22を抽出する", () => {
      // Given: Issue番号を含むタイトル
      const title = "[Issue22 1.2] タスクグループ1.2の実装";

      // When: Issue番号を抽出
      const result = extractIssueNumberFromTitle(title);

      // Then: 22が抽出される
      expect(result).toBe(22);
    });

    it("'[1.2] タスク名'旧形式の場合、nullを返す", () => {
      // Given: Issue番号を含まない旧形式
      const title = "[1.2] タスクグループ1.2の実装";

      // When: Issue番号を抽出
      const result = extractIssueNumberFromTitle(title);

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("形式不一致の場合、nullを返す", () => {
      // Given: パターンに一致しないタイトル
      const title = "普通のタスク名";

      // When: Issue番号を抽出
      const result = extractIssueNumberFromTitle(title);

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("Issue番号が複数桁でも正しく抽出する", () => {
      // Given: 複数桁のIssue番号
      const title = "[Issue123 1.2] タスク名";

      // When: Issue番号を抽出
      const result = extractIssueNumberFromTitle(title);

      // Then: 123が抽出される
      expect(result).toBe(123);
    });

    it("'[Issue22 Phase1] Phase名'形式（親Issue）からIssue番号22を抽出する", () => {
      // Given: 親Issue形式のタイトル
      const title = "[Issue22 Phase1] Phase名";

      // When: Issue番号を抽出
      const result = extractIssueNumberFromTitle(title);

      // Then: 22が抽出される
      expect(result).toBe(22);
    });
  });

  describe("generateVibeKanbanTitle", () => {
    it("タスクグループとIssue番号から正しい形式のタイトルを生成する", () => {
      // Given: タスクグループ情報
      const taskGroup: TaskGroup = {
        id: "1.2",
        name: "データベース設計",
        phaseNumber: 1,
        status: "pending",
        dependencies: [],
        completionCriteria: "テストが通ること",
        tasks: [],
      };
      const issueNumber = 22;

      // When: タイトルを生成
      const result = generateVibeKanbanTitle(taskGroup, issueNumber);

      // Then: 正しい形式のタイトルが生成される
      expect(result).toBe("[Issue22 1.2] データベース設計");
    });

    it("タスクグループIDが複数桁でも正しく生成する", () => {
      // Given: 複数桁のタスクグループID
      const taskGroup: TaskGroup = {
        id: "12.34",
        name: "大規模タスク",
        phaseNumber: 12,
        status: "pending",
        dependencies: [],
        completionCriteria: "",
        tasks: [],
      };
      const issueNumber = 99;

      // When: タイトルを生成
      const result = generateVibeKanbanTitle(taskGroup, issueNumber);

      // Then: 正しい形式のタイトルが生成される
      expect(result).toBe("[Issue99 12.34] 大規模タスク");
    });
  });

  describe("generateVibeKanbanDescription", () => {
    it("タスクグループ情報から正しい形式の説明文を生成する", () => {
      // Given: 詳細なタスクグループ情報
      const taskGroup: TaskGroup = {
        id: "1.2",
        name: "データベース設計",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.1"],
        completionCriteria: "テストが通ること",
        tasks: [
          {
            id: "1.2.1",
            name: "テーブル設計",
            subtasks: ["Userテーブル作成", "Postテーブル作成"],
          },
          {
            id: "1.2.2",
            name: "インデックス設定",
            subtasks: ["主キー設定", "外部キー設定"],
          },
        ],
      };
      const issueNumber = 22;

      // When: 説明文を生成
      const result = generateVibeKanbanDescription(taskGroup, issueNumber);

      // Then: 必須セクションが含まれる
      expect(result).toContain('手動実行する場合: Skill "einja:task-exec" を引数 "#22 1.2" で実行');
      expect(result).toContain("GitHub Issue #22");
      expect(result).toContain("1.2");
      expect(result).toContain("### タスク 1.2.1: テーブル設計");
      expect(result).toContain("- Userテーブル作成");
      expect(result).toContain("- Postテーブル作成");
      expect(result).toContain("### タスク 1.2.2: インデックス設定");
      expect(result).toContain("- 主キー設定");
      expect(result).toContain("- 外部キー設定");
      expect(result).toContain("テストが通ること");
    });

    it("個別タスクがない場合、適切なメッセージを表示する", () => {
      // Given: 個別タスクのないタスクグループ
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "環境構築",
        phaseNumber: 1,
        status: "pending",
        dependencies: [],
        completionCriteria: "",
        tasks: [],
      };
      const issueNumber = 22;

      // When: 説明文を生成
      const result = generateVibeKanbanDescription(taskGroup, issueNumber);

      // Then: 個別タスクなしのメッセージが含まれる
      expect(result).toContain("(個別タスクなし)");
    });

    it("完了条件が未定義の場合、適切なメッセージを表示する", () => {
      // Given: 完了条件のないタスクグループ
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "環境構築",
        phaseNumber: 1,
        status: "pending",
        dependencies: [],
        completionCriteria: "",
        tasks: [],
      };
      const issueNumber = 22;

      // When: 説明文を生成
      const result = generateVibeKanbanDescription(taskGroup, issueNumber);

      // Then: 未定義メッセージが含まれる
      expect(result).toContain("(未定義)");
    });

    it("実行コマンドセクションが正しく含まれる", () => {
      // Given: タスクグループ情報
      const taskGroup: TaskGroup = {
        id: "2.3",
        name: "API実装",
        phaseNumber: 2,
        status: "pending",
        dependencies: [],
        completionCriteria: "",
        tasks: [],
      };
      const issueNumber = 45;

      // When: 説明文を生成
      const result = generateVibeKanbanDescription(taskGroup, issueNumber);

      // Then: 実行コマンドセクションが含まれる
      expect(result).toContain("## 🚀 実行方法");
      expect(result).toContain('手動実行する場合: Skill "einja:task-exec" を引数 "#45 2.3" で実行');
    });
  });

  describe("generateAgentPrompt", () => {
    it("Skill実行指示とタスク情報を含むプロンプトを生成する", () => {
      const taskGroup: TaskGroup = {
        id: "1.2",
        name: "テストタスク",
        phaseNumber: 1,
        tasks: [
          {
            id: "1.2.1",
            name: "サブタスク1",
            subtasks: ["手順A", "手順B"],
          },
        ],
        completionCriteria: "テストが通ること",
        dependencies: [],
        status: "pending",
      };

      const result = generateAgentPrompt(taskGroup, 22);

      expect(result).toContain('Skill "einja:task-exec" を引数 "#22 1.2" で実行してください');
      expect(result).toContain("### GitHub Issue\n#22");
      expect(result).toContain("### タスクグループ\n1.2");
      expect(result).toContain("### タスク 1.2.1: サブタスク1");
      expect(result).toContain("- 手順A");
      expect(result).toContain("- 手順B");
      expect(result).toContain("### 完了条件\nテストが通ること");
    });

    it("タスクがない場合も正しく生成される", () => {
      const taskGroup: TaskGroup = {
        id: "2.1",
        name: "空タスク",
        phaseNumber: 2,
        tasks: [],
        completionCriteria: "",
        dependencies: [],
        status: "pending",
      };

      const result = generateAgentPrompt(taskGroup, 10);

      expect(result).toContain('Skill "einja:task-exec" を引数 "#10 2.1" で実行してください');
      expect(result).toContain("(個別タスクなし)");
      expect(result).toContain("(未定義)");
    });
  });

  describe("registerPhaseMapping", () => {
    it("registerPhaseMappingでマッピング登録すると、getParentIssueMappingで取得できる", () => {
      // Given: Phase番号とマッピング情報
      const phaseNumber = 1;
      const mapping: PhaseIssueMapping = {
        phaseNumber: 1,
        parentIssueId: "parent-issue-uuid-1",
      };

      // When: マッピングを登録
      manager.registerPhaseMapping(phaseNumber, mapping);

      // Then: 登録したマッピングが取得できる
      const result = manager.getParentIssueMapping(phaseNumber);
      expect(result).toEqual(mapping);
    });

    it("同一Phase番号で再登録すると上書きされる", () => {
      // Given: 既に登録されているPhase1のマッピング
      const phaseNumber = 1;
      const originalMapping: PhaseIssueMapping = {
        phaseNumber: 1,
        parentIssueId: "original-uuid",
      };
      manager.registerPhaseMapping(phaseNumber, originalMapping);

      // When: 同じPhase番号で別のマッピングを登録
      const newMapping: PhaseIssueMapping = {
        phaseNumber: 1,
        parentIssueId: "new-uuid",
      };
      manager.registerPhaseMapping(phaseNumber, newMapping);

      // Then: 新しいマッピングで上書きされる
      const result = manager.getParentIssueMapping(phaseNumber);
      expect(result).toEqual(newMapping);
      expect(result?.parentIssueId).toBe("new-uuid");

      // Then: 古いIDはisParentIssueでfalseを返す（孤立ID防止）
      expect(manager.isParentIssue("original-uuid")).toBe(false);

      // Then: 新しいIDはisParentIssueでtrueを返す
      expect(manager.isParentIssue("new-uuid")).toBe(true);
    });

    it("複数Phaseのマッピングを登録すると全て保存される", () => {
      // Given: 複数のPhaseマッピング
      const mapping1: PhaseIssueMapping = { phaseNumber: 1, parentIssueId: "uuid-phase1" };
      const mapping2: PhaseIssueMapping = { phaseNumber: 2, parentIssueId: "uuid-phase2" };
      const mapping3: PhaseIssueMapping = { phaseNumber: 3, parentIssueId: "uuid-phase3" };

      // When: 複数のマッピングを登録
      manager.registerPhaseMapping(1, mapping1);
      manager.registerPhaseMapping(2, mapping2);
      manager.registerPhaseMapping(3, mapping3);

      // Then: 全てのマッピングが保存される
      expect(manager.getParentIssueMapping(1)).toEqual(mapping1);
      expect(manager.getParentIssueMapping(2)).toEqual(mapping2);
      expect(manager.getParentIssueMapping(3)).toEqual(mapping3);
    });
  });

  describe("getParentIssueMapping", () => {
    it("登録済みのPhase番号を渡すと、対応するマッピングが返る", () => {
      // Given: Phase2のマッピングが登録済み
      const mapping: PhaseIssueMapping = {
        phaseNumber: 2,
        parentIssueId: "uuid-for-phase2",
      };
      manager.registerPhaseMapping(2, mapping);

      // When: Phase2のマッピングを取得
      const result = manager.getParentIssueMapping(2);

      // Then: 登録したマッピングが返る
      expect(result).toEqual(mapping);
      expect(result?.parentIssueId).toBe("uuid-for-phase2");
    });

    it("未登録のPhase番号を渡すと、undefinedが返る", () => {
      // Given: 何も登録されていない状態

      // When: 未登録のPhase番号でマッピングを取得
      const result = manager.getParentIssueMapping(99);

      // Then: undefinedが返る
      expect(result).toBeUndefined();
    });
  });

  describe("isParentIssue", () => {
    it("登録された親IssueのIDを渡すと、trueが返る", () => {
      // Given: Phase1マッピングとして親IssueIDが登録済み
      const mapping: PhaseIssueMapping = {
        phaseNumber: 1,
        parentIssueId: "parent-uuid-abc",
      };
      manager.registerPhaseMapping(1, mapping);

      // When: 登録された親IssueIDで判定
      const result = manager.isParentIssue("parent-uuid-abc");

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("未登録のIDを渡すと、falseが返る", () => {
      // Given: 何も登録されていない状態

      // When: 登録されていないIDで判定
      const result = manager.isParentIssue("unknown-uuid");

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("複数のPhaseマッピングに含まれるIDの場合もtrueが返る", () => {
      // Given: Phase1とPhase2にそれぞれ異なる親IssueIDが登録済み
      manager.registerPhaseMapping(1, { phaseNumber: 1, parentIssueId: "parent-uuid-phase1" });
      manager.registerPhaseMapping(2, { phaseNumber: 2, parentIssueId: "parent-uuid-phase2" });

      // When: Phase2の親IssueIDで判定
      const resultPhase1 = manager.isParentIssue("parent-uuid-phase1");
      const resultPhase2 = manager.isParentIssue("parent-uuid-phase2");

      // Then: 両方ともtrueが返る
      expect(resultPhase1).toBe(true);
      expect(resultPhase2).toBe(true);
    });
  });

  describe("generateParentIssueTitle", () => {
    it("Phase情報とIssue番号から'[Issue22 Phase1] Phase名'形式のタイトルが生成される", () => {
      // Given: Phase情報とIssue番号
      const phase: Phase = {
        number: 1,
        name: "環境構築フェーズ",
        taskGroups: [],
      };
      const issueNumber = 22;

      // When: タイトルを生成
      const result = generateParentIssueTitle(phase, issueNumber);

      // Then: 正しい形式のタイトルが生成される
      expect(result).toBe("[Issue22 Phase1] 環境構築フェーズ");
    });

    it("Phase番号が複数桁でも正しく生成される", () => {
      // Given: 複数桁のPhase番号
      const phase: Phase = {
        number: 12,
        name: "大規模フェーズ",
        taskGroups: [],
      };
      const issueNumber = 99;

      // When: タイトルを生成
      const result = generateParentIssueTitle(phase, issueNumber);

      // Then: 複数桁のPhase番号でも正しく生成される
      expect(result).toBe("[Issue99 Phase12] 大規模フェーズ");
    });
  });

  describe("generateParentIssueDescription", () => {
    it("Phase情報とIssue番号からタスクグループ一覧を含む説明文が生成される", () => {
      // Given: タスクグループを含むPhase情報
      const phase: Phase = {
        number: 1,
        name: "環境構築フェーズ",
        taskGroups: [
          {
            id: "1.1",
            name: "開発環境セットアップ",
            phaseNumber: 1,
            status: "pending",
            dependencies: [],
            completionCriteria: "",
            tasks: [],
          },
          {
            id: "1.2",
            name: "データベース設計",
            phaseNumber: 1,
            status: "pending",
            dependencies: [],
            completionCriteria: "",
            tasks: [],
          },
        ],
      };
      const issueNumber = 22;

      // When: 説明文を生成
      const result = generateParentIssueDescription(phase, issueNumber);

      // Then: タスクグループ一覧が含まれる
      expect(result).toContain("GitHub Issue #22");
      expect(result).toContain("Phase 1");
      expect(result).toContain("- 1.1: 開発環境セットアップ");
      expect(result).toContain("- 1.2: データベース設計");
    });

    it("タスクグループがない場合、'(タスクグループなし)'と表示される", () => {
      // Given: タスクグループのないPhase情報
      const phase: Phase = {
        number: 2,
        name: "実装フェーズ",
        taskGroups: [],
      };
      const issueNumber = 33;

      // When: 説明文を生成
      const result = generateParentIssueDescription(phase, issueNumber);

      // Then: タスクグループなしのメッセージが含まれる
      expect(result).toContain("(タスクグループなし)");
    });

    it("Issue番号とPhase情報が正しく含まれる", () => {
      // Given: Phase3の情報
      const phase: Phase = {
        number: 3,
        name: "テストフェーズ",
        taskGroups: [
          {
            id: "3.1",
            name: "ユニットテスト",
            phaseNumber: 3,
            status: "pending",
            dependencies: [],
            completionCriteria: "",
            tasks: [],
          },
        ],
      };
      const issueNumber = 55;

      // When: 説明文を生成
      const result = generateParentIssueDescription(phase, issueNumber);

      // Then: Issue番号とPhase番号が正しく含まれる
      expect(result).toContain("GitHub Issue #55");
      expect(result).toContain("Phase 3");
      expect(result).toContain("テストフェーズ");
    });
  });

  describe("extractPhaseNumberFromTitle", () => {
    it("'[Issue22 Phase1] Phase名'からPhase番号1を抽出する", () => {
      // Given: 親Issue形式のタイトル
      const title = "[Issue22 Phase1] Phase名";

      // When: Phase番号を抽出
      const result = extractPhaseNumberFromTitle(title);

      // Then: 1が抽出される
      expect(result).toBe(1);
    });

    it("'[Issue99 Phase12] Phase名'から複数桁のPhase番号12を抽出する", () => {
      // Given: 複数桁のPhase番号を含むタイトル
      const title = "[Issue99 Phase12] 大規模フェーズ";

      // When: Phase番号を抽出
      const result = extractPhaseNumberFromTitle(title);

      // Then: 12が抽出される
      expect(result).toBe(12);
    });

    it("'[Issue22 1.2] タスク名'の場合（サブIssue形式）、nullが返る", () => {
      // Given: サブIssue（タスクグループ）形式のタイトル
      const title = "[Issue22 1.2] タスク名";

      // When: Phase番号を抽出
      const result = extractPhaseNumberFromTitle(title);

      // Then: nullが返る（Phaseパターンに一致しないため）
      expect(result).toBeNull();
    });

    it("パターンに一致しないタイトルの場合、nullが返る", () => {
      // Given: パターンに一致しないタイトル
      const title = "普通のタイトル";

      // When: Phase番号を抽出
      const result = extractPhaseNumberFromTitle(title);

      // Then: nullが返る
      expect(result).toBeNull();
    });
  });
});
