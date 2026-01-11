import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkExternalIssueDependencies,
  detectCircularDependencies,
  getCompletedPhaseNumbers,
  isAllTasksCompleted,
  isDependencySatisfied,
  isPhaseCompleted,
  selectExecutableTaskGroups,
  selectNextTaskGroup,
} from "./dependency-resolver.js";
import { parseIssueBody } from "./issue-parser.js";
import type { GitHubIssue, ParsedIssue, Phase, TaskGroup } from "./types.js";

// github-client.js のモック
vi.mock("./github-client.js", () => ({
  isIssueClosed: vi.fn(),
}));

import { isIssueClosed } from "./github-client.js";

describe("dependency-resolver", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("isDependencySatisfied", () => {
    it("依存なしの場合、trueを返す", () => {
      // Given: 依存関係を持たないタスクグループ
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: [],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>();
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("タスク依存'1.1'が完了済みの場合、trueを返す", () => {
      // Given: タスク1.1に依存するタスク1.2
      const taskGroup: TaskGroup = {
        id: "1.2",
        name: "タスク2",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.1"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>(["1.1"]);
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("タスク依存'1.1'が未完了の場合、falseを返す", () => {
      // Given: タスク1.1に依存するタスク1.2（1.1は未完了）
      const taskGroup: TaskGroup = {
        id: "1.2",
        name: "タスク2",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.1"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>();
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("Phase依存が満たされている場合、trueを返す", () => {
      // Given: Phase 1完了に依存するタスク2.1
      const taskGroup: TaskGroup = {
        id: "2.1",
        name: "タスク2.1",
        phaseNumber: 2,
        status: "pending",
        dependencies: ["Phase 1完了"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>(["1.1", "1.2"]);
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [
            {
              id: "1.1",
              name: "タスク1.1",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
            {
              id: "1.2",
              name: "タスク1.2",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
          ],
        },
      ];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("Phase依存が未満たしの場合、falseを返す", () => {
      // Given: Phase 1完了に依存するタスク2.1（Phase 1は未完了）
      const taskGroup: TaskGroup = {
        id: "2.1",
        name: "タスク2.1",
        phaseNumber: 2,
        status: "pending",
        dependencies: ["Phase 1完了"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>(["1.1"]);
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [
            {
              id: "1.1",
              name: "タスク1.1",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
            {
              id: "1.2",
              name: "タスク1.2",
              phaseNumber: 1,
              status: "pending",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
          ],
        },
      ];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("Issue依存'#123'の場合、同期チェックではtrueを返す", () => {
      // Given: Issue #123に依存するタスク
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["#123"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>();
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: trueが返る（Issue依存は非同期でチェックされる）
      expect(result).toBe(true);
    });

    it("複数依存が全て満たされている場合、trueを返す", () => {
      // Given: 複数の依存関係を持つタスク
      const taskGroup: TaskGroup = {
        id: "1.3",
        name: "タスク3",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.1", "1.2"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>(["1.1", "1.2"]);
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("複数依存のうち一部が未満たしの場合、falseを返す", () => {
      // Given: 複数の依存関係を持つタスク（一部未完了）
      const taskGroup: TaskGroup = {
        id: "1.3",
        name: "タスク3",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.1", "1.2"],
        completionCriteria: "完了",
        tasks: [],
      };
      const completedGroups = new Set<string>(["1.1"]);
      const phases: Phase[] = [];

      // When: 依存関係チェック
      const result = isDependencySatisfied(taskGroup, completedGroups, phases);

      // Then: falseが返る
      expect(result).toBe(false);
    });
  });

  describe("checkExternalIssueDependencies", () => {
    it("Issue依存'#123'がクローズ済みの場合、trueを返す", async () => {
      // Given: Issue #123に依存するタスク
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["#123"],
        completionCriteria: "完了",
        tasks: [],
      };
      vi.mocked(isIssueClosed).mockReturnValue(true);

      // When: 外部Issue依存をチェック
      const result = await checkExternalIssueDependencies(taskGroup);

      // Then: trueが返る
      expect(result).toBe(true);
      expect(isIssueClosed).toHaveBeenCalledWith(123);
    });

    it("Issue依存'#123'がオープンの場合、falseを返す", async () => {
      // Given: Issue #123に依存するタスク（#123はオープン）
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["#123"],
        completionCriteria: "完了",
        tasks: [],
      };
      vi.mocked(isIssueClosed).mockReturnValue(false);

      // When: 外部Issue依存をチェック
      const result = await checkExternalIssueDependencies(taskGroup);

      // Then: falseが返る
      expect(result).toBe(false);
      expect(isIssueClosed).toHaveBeenCalledWith(123);
    });

    it("複数Issue依存が全てクローズ済みの場合、trueを返す", async () => {
      // Given: 複数のIssue依存を持つタスク
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["#123", "#456"],
        completionCriteria: "完了",
        tasks: [],
      };
      vi.mocked(isIssueClosed).mockReturnValue(true);

      // When: 外部Issue依存をチェック
      const result = await checkExternalIssueDependencies(taskGroup);

      // Then: trueが返る
      expect(result).toBe(true);
      expect(isIssueClosed).toHaveBeenCalledWith(123);
      expect(isIssueClosed).toHaveBeenCalledWith(456);
    });

    it("複数Issue依存のうち一部がオープンの場合、falseを返す", async () => {
      // Given: 複数のIssue依存を持つタスク（一部オープン）
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["#123", "#456"],
        completionCriteria: "完了",
        tasks: [],
      };
      vi.mocked(isIssueClosed).mockReturnValueOnce(true).mockReturnValueOnce(false);

      // When: 外部Issue依存をチェック
      const result = await checkExternalIssueDependencies(taskGroup);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("Issue依存が存在しない場合、trueを返す", async () => {
      // Given: Issue依存を持たないタスク
      const taskGroup: TaskGroup = {
        id: "1.1",
        name: "タスク1",
        phaseNumber: 1,
        status: "pending",
        dependencies: ["1.2"],
        completionCriteria: "完了",
        tasks: [],
      };

      // When: 外部Issue依存をチェック
      const result = await checkExternalIssueDependencies(taskGroup);

      // Then: trueが返る（チェック対象なし）
      expect(result).toBe(true);
      expect(isIssueClosed).not.toHaveBeenCalled();
    });
  });

  describe("isPhaseCompleted", () => {
    it("Phase内の全タスクグループが完了済みの場合、trueを返す", () => {
      // Given: Phase 1の全タスクグループが完了済み
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [
            {
              id: "1.1",
              name: "タスク1.1",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
            {
              id: "1.2",
              name: "タスク1.2",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
          ],
        },
      ];
      const completedGroups = new Set<string>(["1.1", "1.2"]);

      // When: Phase完了チェック
      const result = isPhaseCompleted(phases, 1, completedGroups);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("Phase内に未完了タスクグループが存在する場合、falseを返す", () => {
      // Given: Phase 1に未完了タスクグループが存在
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [
            {
              id: "1.1",
              name: "タスク1.1",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
            {
              id: "1.2",
              name: "タスク1.2",
              phaseNumber: 1,
              status: "pending",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
          ],
        },
      ];
      const completedGroups = new Set<string>(["1.1"]);

      // When: Phase完了チェック
      const result = isPhaseCompleted(phases, 1, completedGroups);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("存在しないPhase番号を指定した場合、falseを返す", () => {
      // Given: Phase 1のみ存在
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [
            {
              id: "1.1",
              name: "タスク1.1",
              phaseNumber: 1,
              status: "completed",
              dependencies: [],
              completionCriteria: "完了",
              tasks: [],
            },
          ],
        },
      ];
      const completedGroups = new Set<string>(["1.1"]);

      // When: 存在しないPhase 2をチェック
      const result = isPhaseCompleted(phases, 2, completedGroups);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("Phaseにタスクグループが存在しない場合、trueを返す", () => {
      // Given: タスクグループが空のPhase
      const phases: Phase[] = [
        {
          number: 1,
          name: "Phase 1",
          taskGroups: [],
        },
      ];
      const completedGroups = new Set<string>();

      // When: Phase完了チェック
      const result = isPhaseCompleted(phases, 1, completedGroups);

      // Then: trueが返る（タスクグループが空=全て完了と見なす）
      expect(result).toBe(true);
    });
  });

  describe("getCompletedPhaseNumbers", () => {
    it("完了済みPhaseの番号配列を返す", () => {
      // Given: Phase 1が完了、Phase 2が未完了のIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

### Phase 2: フェーズ2

- [ ] **2.1 タスク2.1**
  **依存関係**: Phase 1完了
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 完了済みPhase番号を取得
      const result = getCompletedPhaseNumbers(parsedIssue);

      // Then: Phase 1のみ返る
      expect(result).toEqual([1]);
    });

    it("全Phase未完了の場合、空配列を返す", () => {
      // Given: 全Phase未完了のIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 完了済みPhase番号を取得
      const result = getCompletedPhaseNumbers(parsedIssue);

      // Then: 空配列が返る
      expect(result).toEqual([]);
    });

    it("全Phase完了の場合、全Phase番号を返す", () => {
      // Given: 全Phase完了のIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

### Phase 2: フェーズ2

- [x] **2.1 タスク2.1**
  **依存関係**: Phase 1完了
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 完了済みPhase番号を取得
      const result = getCompletedPhaseNumbers(parsedIssue);

      // Then: 全Phase番号が返る
      expect(result).toEqual([1, 2]);
    });
  });

  describe("selectNextTaskGroup", () => {
    it("実行可能なタスクがある場合、最初のタスクグループを返す", async () => {
      // Given: 依存を満たす複数のタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 次のタスクグループを選定
      const result = await selectNextTaskGroup(parsedIssue);

      // Then: 最初の実行可能タスクグループが返る
      expect(result).not.toBeNull();
      expect(result?.id).toBe("1.2");
    });

    it("maxTaskNumberで範囲外のタスクは除外される", async () => {
      // Given: 複数のタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: なし
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: maxTaskNumberを指定して次のタスクグループを選定
      const result = await selectNextTaskGroup(parsedIssue, "1.2");

      // Then: 1.2以下の最初のタスクグループが返る
      expect(result).not.toBeNull();
      expect(result?.id).toBe("1.1");
    });

    it("依存関係が未解決のタスクは除外される", async () => {
      // Given: 依存関係が未解決のタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 次のタスクグループを選定
      const result = await selectNextTaskGroup(parsedIssue);

      // Then: 依存のないタスクのみ返る（1.2は除外される）
      expect(result).not.toBeNull();
      expect(result?.id).toBe("1.1");
    });

    it("全て完了済みの場合、nullを返す", async () => {
      // Given: 全て完了済みのIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 次のタスクグループを選定
      const result = await selectNextTaskGroup(parsedIssue);

      // Then: nullが返る
      expect(result).toBeNull();
    });
  });

  describe("selectExecutableTaskGroups", () => {
    it("依存を満たす複数タスクの場合、実行可能配列を返す", async () => {
      // Given: 依存を満たす複数のタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: 依存を満たすタスクグループが返る
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1.2");
      expect(result[1].id).toBe("1.3");
    });

    it("maxTaskNumber='1.2'の場合、1.2以下のみ返す", async () => {
      // Given: 複数のタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: なし
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: maxTaskNumberを指定して実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue, "1.2");

      // Then: 1.2以下のタスクグループのみ返る
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1.1");
      expect(result[1].id).toBe("1.2");
    });

    it("全て完了済みの場合、空配列を返す", async () => {
      // Given: 全て完了済みのIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: 空配列が返る
      expect(result).toHaveLength(0);
    });

    it("依存が満たされていないタスクは除外される", async () => {
      // Given: 依存が満たされていないタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: 依存のないタスクのみ返る
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1.1");
    });

    it("外部Issue依存がクローズ済みの場合、実行可能に含まれる", async () => {
      // Given: 外部Issue依存を持つタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: #123
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);
      vi.mocked(isIssueClosed).mockReturnValue(true);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: 実行可能に含まれる
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1.1");
      expect(isIssueClosed).toHaveBeenCalledWith(123);
    });

    it("外部Issue依存がオープンの場合、実行可能から除外される", async () => {
      // Given: 外部Issue依存を持つタスク（Issue はオープン）
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: #123
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);
      vi.mocked(isIssueClosed).mockReturnValue(false);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: 実行可能から除外される
      expect(result).toHaveLength(0);
      expect(isIssueClosed).toHaveBeenCalledWith(123);
    });

    it("in-progressステータスのタスクも候補に含まれる", async () => {
      // Given: in-progressステータスのタスク
      const parsedIssue: ParsedIssue = {
        issueNumber: 1,
        title: "Test",
        body: "",
        phases: [
          {
            number: 1,
            name: "Phase 1",
            taskGroups: [
              {
                id: "1.1",
                name: "タスク1.1",
                phaseNumber: 1,
                status: "in-progress",
                dependencies: [],
                completionCriteria: "完了",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: in-progressタスクが含まれる
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1.1");
    });

    it("タスク番号順にソートされて返される", async () => {
      // Given: タスク番号がバラバラのタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.3 タスク1.3**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: なし
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 実行可能タスクグループを選定
      const result = await selectExecutableTaskGroups(parsedIssue);

      // Then: タスク番号順にソートされて返る
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("1.1");
      expect(result[1].id).toBe("1.2");
      expect(result[2].id).toBe("1.3");
    });
  });

  describe("isAllTasksCompleted", () => {
    it("全タスクが完了済みの場合、trueを返す", () => {
      // Given: 全タスクが完了済みのIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

### Phase 2: フェーズ2

- [x] **2.1 タスク2.1**
  **依存関係**: Phase 1完了
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 全タスク完了チェック
      const result = isAllTasksCompleted(parsedIssue);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("未完了タスクがある場合、falseを返す", () => {
      // Given: 未完了タスクがあるIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 全タスク完了チェック
      const result = isAllTasksCompleted(parsedIssue);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("maxTaskNumber範囲内の全タスクが完了の場合、trueを返す", () => {
      // Given: 1.2以下が完了、1.3が未完了のIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: 1.2
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: maxTaskNumber=1.2で全タスク完了チェック
      const result = isAllTasksCompleted(parsedIssue, "1.2");

      // Then: trueが返る（1.3は範囲外なので無視される）
      expect(result).toBe(true);
    });

    it("maxTaskNumber範囲内に未完了タスクがある場合、falseを返す", () => {
      // Given: 1.2が未完了、1.3以降は完了のIssue
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [x] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

- [x] **1.3 タスク1.3**
  **依存関係**: 1.2
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: maxTaskNumber=1.2で全タスク完了チェック
      const result = isAllTasksCompleted(parsedIssue, "1.2");

      // Then: falseが返る（1.2が未完了）
      expect(result).toBe(false);
    });

    it("タスクグループが存在しない場合、falseを返す", () => {
      // Given: タスクグループが空のIssue
      const parsedIssue: ParsedIssue = {
        issueNumber: 1,
        title: "Test",
        body: "",
        phases: [],
      };

      // When: 全タスク完了チェック
      const result = isAllTasksCompleted(parsedIssue);

      // Then: falseが返る（タスクが存在しない場合は未完了と見なす）
      expect(result).toBe(false);
    });
  });

  describe("detectCircularDependencies", () => {
    it("循環なしの場合、nullを返す", () => {
      // Given: 循環のない依存関係
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: 1.2
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("A→B→Aの2ノード循環の場合、循環パスを返す", () => {
      // Given: 2ノード循環依存
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスクA**
  **依存関係**: 1.2
  **完了条件**: 完了

- [ ] **1.2 タスクB**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: 循環パスが返る
      expect(result).not.toBeNull();
      expect(result).toContain("1.1");
      expect(result).toContain("1.2");
    });

    it("A→B→C→Aの3ノード循環の場合、循環パスを返す", () => {
      // Given: 3ノード循環依存
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスクA**
  **依存関係**: 1.2
  **完了条件**: 完了

- [ ] **1.2 タスクB**
  **依存関係**: 1.3
  **完了条件**: 完了

- [ ] **1.3 タスクC**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: 循環パスが返る
      expect(result).not.toBeNull();
      expect(result).toContain("1.1");
      expect(result).toContain("1.2");
      expect(result).toContain("1.3");
    });

    it("自己参照依存は循環として検出される", () => {
      // Given: 自己参照依存（1.1 → 1.1）
      const parsedIssue: ParsedIssue = {
        issueNumber: 1,
        title: "Test",
        body: "",
        phases: [
          {
            number: 1,
            name: "Phase 1",
            taskGroups: [
              {
                id: "1.1",
                name: "タスク1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: ["1.1"],
                completionCriteria: "完了",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: 循環パスが返る
      expect(result).not.toBeNull();
      expect(result).toContain("1.1");
    });

    it("Phase依存やIssue依存は循環検出の対象外", () => {
      // Given: Phase依存とIssue依存を含むタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

### Phase 2: フェーズ2

- [ ] **2.1 タスク2.1**
  **依存関係**: Phase 1完了, #123
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: nullが返る（タスクグループ依存のみが対象）
      expect(result).toBeNull();
    });

    it("複数の独立した依存チェーンがある場合、循環がなければnullを返す", () => {
      // Given: 複数の独立した依存チェーン
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.1
  **完了条件**: 完了

### Phase 2: フェーズ2

- [ ] **2.1 タスク2.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **2.2 タスク2.2**
  **依存関係**: 2.1
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("部分的な循環がある場合、循環パスを返す", () => {
      // Given: 一部のタスクで循環依存が発生
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1.1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク1.2**
  **依存関係**: 1.3
  **完了条件**: 完了

- [ ] **1.3 タスク1.3**
  **依存関係**: 1.4
  **完了条件**: 完了

- [ ] **1.4 タスク1.4**
  **依存関係**: 1.2
  **完了条件**: 完了
`,
      };
      const parsedIssue = parseIssueBody(issue);

      // When: 循環依存をチェック
      const result = detectCircularDependencies(parsedIssue);

      // Then: 循環パスが返る（1.2 → 1.3 → 1.4 → 1.2）
      expect(result).not.toBeNull();
      expect(result).toContain("1.2");
      expect(result).toContain("1.3");
      expect(result).toContain("1.4");
    });
  });
});
