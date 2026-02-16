import { describe, expect, it } from "vitest";
import {
  SAMPLE_ISSUE_SIMPLE,
  SAMPLE_ISSUE_WITH_COMPLETED_TASKS,
} from "./__mocks__/sample-issues.js";
import {
  findTaskGroupById,
  getAllTaskGroups,
  getCompletedTaskGroupIds,
  getPendingTaskGroups,
  parseIssueBody,
} from "./issue-parser.js";
import type { GitHubIssue, ParsedIssue } from "./types.js";

describe("issue-parser", () => {
  describe("parseIssueBody", () => {
    // 正常系
    it("PhaseとタスクグループとタスクのMarkdownをパースすると構造化オブジェクトを返す", () => {
      // Given: Phase、タスクグループ、タスクを含むMarkdown (既存フィクスチャを使用)
      const issue: GitHubIssue = {
        number: 123,
        title: "基本機能",
        state: "open",
        body: SAMPLE_ISSUE_SIMPLE,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 構造化されたデータが返る
      expect(result.issueNumber).toBe(123);
      expect(result.title).toBe("基本機能");
      expect(result.phases).toHaveLength(2);

      const phase1 = result.phases[0];
      expect(phase1.number).toBe(1);
      expect(phase1.name).toBe("基本機能");
      expect(phase1.taskGroups).toHaveLength(3);

      const taskGroup1 = phase1.taskGroups[0];
      expect(taskGroup1.id).toBe("1.1");
      expect(taskGroup1.name).toBe("認証機能");
      expect(taskGroup1.status).toBe("pending");
      expect(taskGroup1.dependencies).toEqual([]);
      expect(taskGroup1.completionCriteria).toBe("ログイン・ログアウトが動作すること");

      const taskGroup2 = phase1.taskGroups[1];
      expect(taskGroup2.id).toBe("1.2");
      expect(taskGroup2.name).toBe("ユーザー管理");
      expect(taskGroup2.status).toBe("pending");
      expect(taskGroup2.dependencies).toEqual(["1.1"]);
    });

    it("チェック済みタスクグループ[x]の場合、statusがcompletedになる", () => {
      // Given: チェック済みタスクグループを含むMarkdown (既存フィクスチャを使用)
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: SAMPLE_ISSUE_WITH_COMPLETED_TASKS,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: ステータスが正しく設定される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].status).toBe("completed");
      expect(phase1.taskGroups[1].status).toBe("completed");
      expect(phase1.taskGroups[2].status).toBe("pending");
    });

    it("依存関係にタスクグループIDが指定されている場合、dependencies配列に含まれる", () => {
      // Given: 依存関係を持つタスクグループを含むMarkdown
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 基礎タスク**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 依存タスク**
  **依存関係**: 1.1
  **完了条件**: 完了

- [ ] **1.3 複数依存タスク**
  **依存関係**: 1.1, 1.2
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 依存関係が正しく抽出される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].dependencies).toEqual([]);
      expect(phase1.taskGroups[1].dependencies).toEqual(["1.1"]);
      expect(phase1.taskGroups[2].dependencies).toEqual(["1.1", "1.2"]);
    });

    // 異常系
    it("Phaseヘッダーがない場合、空のPhase配列を返す", () => {
      // Given: Phaseヘッダーがない本文
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `これはPhaseヘッダーがない本文です。

- タスク1
- タスク2
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 空のPhase配列が返る
      expect(result.phases).toHaveLength(0);
    });

    it("依存関係セクションがない場合、dependenciesは空配列になる", () => {
      // Given: 依存関係セクションがないタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク名**
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: dependenciesは空配列
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].dependencies).toEqual([]);
    });

    it("ボールドなしチェックボックスも認識される", () => {
      // Given: ボールドなしのタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] 1.1 ボールドなしタスク
  **依存関係**: なし
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: タスクグループが認識される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups).toHaveLength(1);
      expect(phase1.taskGroups[0].id).toBe("1.1");
      expect(phase1.taskGroups[0].name).toBe("ボールドなしタスク");
    });

    it("空のPhaseセクションの場合、taskGroupsは空配列として処理される", () => {
      // Given: タスクグループがないPhase
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: 空のフェーズ

### Phase 2: タスクありフェーズ

- [ ] **2.1 タスク名**
  **依存関係**: なし
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 空のPhaseも正しく処理される
      expect(result.phases).toHaveLength(2);
      expect(result.phases[0].taskGroups).toHaveLength(0);
      expect(result.phases[1].taskGroups).toHaveLength(1);
    });
  });

  describe("依存関係パターン", () => {
    it("Phase依存パターン'Phase X完了'が認識される", () => {
      // Given: Phase依存を持つタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: フェーズ1

- [ ] **1.1 タスク1**
  **依存関係**: なし
  **完了条件**: 完了

### Phase 2: フェーズ2

- [ ] **2.1 タスク2**
  **依存関係**: Phase 1完了
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: Phase依存が正しく認識される
      const phase2 = result.phases[1];
      expect(phase2.taskGroups[0].dependencies).toEqual(["Phase 1完了"]);
    });

    it("Issue依存パターン'#123'が認識される", () => {
      // Given: Issue依存を持つタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク名**
  **依存関係**: #123
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: Issue依存が正しく認識される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].dependencies).toEqual(["#123"]);
    });

    it("サブタスクID'1.2.1'はタスクグループID'1.2'に変換される", () => {
      // Given: サブタスクIDを含む依存関係
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク2**
  **依存関係**: 1.1.1
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: サブタスクIDがタスクグループIDに変換される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[1].dependencies).toEqual(["1.1"]);
    });

    it("自己参照の依存関係は除外される", () => {
      // Given: 自己参照する依存関係
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク1**
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 自己参照は除外される
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].dependencies).toEqual([]);
    });

    it("重複する依存関係は一意化される", () => {
      // Given: 重複する依存関係
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク2**
  **依存関係**: 1.1, 1.1.1, 1.1.2
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 重複が除去される（1.1.1と1.1.2は1.1に変換され、1.1として一意化）
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[1].dependencies).toEqual(["1.1"]);
    });

    it("依存関係が'なし'または'-'の場合、空配列になる", () => {
      // Given: 依存関係が'なし'または'-'
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク1**
  **依存関係**: なし
  **完了条件**: 完了

- [ ] **1.2 タスク2**
  **依存関係**: -
  **完了条件**: 完了
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 両方とも空配列
      const phase1 = result.phases[0];
      expect(phase1.taskGroups[0].dependencies).toEqual([]);
      expect(phase1.taskGroups[1].dependencies).toEqual([]);
    });
  });

  describe("findTaskGroupById", () => {
    it("存在するタスクグループIDを渡すと、該当タスクグループを返す", () => {
      // Given: 複数のタスクグループを持つParsedIssue
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.2",
                name: "Task 1.2",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: findTaskGroupByIdを呼び出す
      const result = findTaskGroupById(parsedIssue, "1.2");

      // Then: 該当タスクグループが返る
      expect(result).not.toBeNull();
      expect(result?.id).toBe("1.2");
      expect(result?.name).toBe("Task 1.2");
    });

    it("存在しないタスクグループIDを渡すと、nullを返す", () => {
      // Given: タスクグループを持つParsedIssue
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: 存在しないIDで検索
      const result = findTaskGroupById(parsedIssue, "2.1");

      // Then: nullが返る
      expect(result).toBeNull();
    });
  });

  describe("getAllTaskGroups", () => {
    it("全Phaseのタスクグループをフラットな配列で返す", () => {
      // Given: 複数Phaseと複数タスクグループを持つParsedIssue
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.2",
                name: "Task 1.2",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
          {
            number: 2,
            name: "Phase 2",
            taskGroups: [
              {
                id: "2.1",
                name: "Task 2.1",
                phaseNumber: 2,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: getAllTaskGroupsを呼び出す
      const result = getAllTaskGroups(parsedIssue);

      // Then: 全タスクグループがフラットな配列で返る
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("1.1");
      expect(result[1].id).toBe("1.2");
      expect(result[2].id).toBe("2.1");
    });

    it("タスクグループが存在しない場合、空配列を返す", () => {
      // Given: タスクグループが空のParsedIssue
      const parsedIssue: ParsedIssue = {
        issueNumber: 1,
        title: "Test",
        body: "",
        phases: [
          {
            number: 1,
            name: "Phase 1",
            taskGroups: [],
          },
        ],
      };

      // When: getAllTaskGroupsを呼び出す
      const result = getAllTaskGroups(parsedIssue);

      // Then: 空配列が返る
      expect(result).toHaveLength(0);
    });
  });

  describe("getCompletedTaskGroupIds", () => {
    it("完了済みタスクグループのIDのSetを返す", () => {
      // Given: 完了済みと未完了のタスクグループを持つParsedIssue
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.2",
                name: "Task 1.2",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.3",
                name: "Task 1.3",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: getCompletedTaskGroupIdsを呼び出す
      const result = getCompletedTaskGroupIds(parsedIssue);

      // Then: 完了済みタスクグループのIDのSetが返る
      expect(result.size).toBe(2);
      expect(result.has("1.1")).toBe(true);
      expect(result.has("1.3")).toBe(true);
      expect(result.has("1.2")).toBe(false);
    });

    it("完了済みタスクグループが存在しない場合、空のSetを返す", () => {
      // Given: 全て未完了のタスクグループ
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: getCompletedTaskGroupIdsを呼び出す
      const result = getCompletedTaskGroupIds(parsedIssue);

      // Then: 空のSetが返る
      expect(result.size).toBe(0);
    });
  });

  describe("getPendingTaskGroups", () => {
    it("未着手タスクグループの配列を返す", () => {
      // Given: 複数ステータスのタスクグループを持つParsedIssue
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.2",
                name: "Task 1.2",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.3",
                name: "Task 1.3",
                phaseNumber: 1,
                status: "in-progress",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
              {
                id: "1.4",
                name: "Task 1.4",
                phaseNumber: 1,
                status: "pending",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: getPendingTaskGroupsを呼び出す
      const result = getPendingTaskGroups(parsedIssue);

      // Then: 未着手タスクグループのみ返る
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1.1");
      expect(result[1].id).toBe("1.4");
    });

    it("未着手タスクグループが存在しない場合、空配列を返す", () => {
      // Given: 全て完了済みのタスクグループ
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
                name: "Task 1.1",
                phaseNumber: 1,
                status: "completed",
                dependencies: [],
                completionCriteria: "",
                tasks: [],
              },
            ],
          },
        ],
      };

      // When: getPendingTaskGroupsを呼び出す
      const result = getPendingTaskGroups(parsedIssue);

      // Then: 空配列が返る
      expect(result).toHaveLength(0);
    });
  });

  describe("extractTasks", () => {
    it("タスクグループ配下のサブタスク一覧が抽出される", () => {
      // Given: サブタスクを含むタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスクグループ名**
  **依存関係**: なし
  **完了条件**: 完了
  - 1.1.1 サブタスク1
  - 1.1.2 サブタスク2
  - 1.1.3 サブタスク3
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: サブタスクが正しく抽出される
      const phase1 = result.phases[0];
      const taskGroup = phase1.taskGroups[0];
      expect(taskGroup.tasks).toHaveLength(3);
      expect(taskGroup.tasks[0].id).toBe("1.1.1");
      expect(taskGroup.tasks[0].name).toBe("サブタスク1");
      expect(taskGroup.tasks[1].id).toBe("1.1.2");
      expect(taskGroup.tasks[1].name).toBe("サブタスク2");
      expect(taskGroup.tasks[2].id).toBe("1.1.3");
      expect(taskGroup.tasks[2].name).toBe("サブタスク3");
    });

    it("リストマーカーなしのサブタスクも抽出される", () => {
      // Given: リストマーカーなしのサブタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスクグループ名**
  **依存関係**: なし
  **完了条件**: 完了
  1.1.1 リストなしサブタスク1
  - 1.1.2 リストありサブタスク2
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: リストマーカーの有無に関わらずサブタスクが抽出される
      const phase1 = result.phases[0];
      const taskGroup = phase1.taskGroups[0];
      expect(taskGroup.tasks).toHaveLength(2);
      expect(taskGroup.tasks[0].id).toBe("1.1.1");
      expect(taskGroup.tasks[1].id).toBe("1.1.2");
    });
  });

  describe("HTMLコメント付きタスク", () => {
    it("着手中コメント付きのタスクでもタスクグループIDが抽出される", () => {
      // Given: 着手中コメント付きのタスク
      const issue: GitHubIssue = {
        number: 22,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 タスク名** <!-- 着手中: Issue22 - Vibe-Kanban Task: agent-123 -->
  **依存関係**: なし
  **完了条件**: 完了

- [x] **1.2 完了済みタスク** <!-- 着手中: Issue22 - Vibe-Kanban Task: def456 -->
  **依存関係**: 1.1
  **完了条件**: 完了
`,
      };

      // When: パース実行
      const result = parseIssueBody(issue);

      // Then: タスクグループが抽出される
      expect(result.phases).toHaveLength(1);
      const phase1 = result.phases[0];
      expect(phase1.taskGroups).toHaveLength(2);

      // 1つ目のタスクグループ
      expect(phase1.taskGroups[0].id).toBe("1.1");
      expect(phase1.taskGroups[0].name).toBe("タスク名");
      expect(phase1.taskGroups[0].status).toBe("pending");

      // 2つ目のタスクグループ
      expect(phase1.taskGroups[1].id).toBe("1.2");
      expect(phase1.taskGroups[1].name).toBe("完了済みタスク");
      expect(phase1.taskGroups[1].status).toBe("completed");
      expect(phase1.taskGroups[1].dependencies).toEqual(["1.1"]);
    });

    it("ボールドなしでHTMLコメント付きの場合もタスクグループが抽出される", () => {
      // Given: ボールドなしでHTMLコメント付きのタスク
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] 1.1 ボールドなしタスク <!-- 着手中: agent-123 -->
  **依存関係**: なし
  **完了条件**: 完了
`,
      };

      // When: パース実行
      const result = parseIssueBody(issue);

      // Then: タスクグループが抽出される
      expect(result.phases[0].taskGroups).toHaveLength(1);
      expect(result.phases[0].taskGroups[0].id).toBe("1.1");
      expect(result.phases[0].taskGroups[0].name).toBe("ボールドなしタスク");
    });
  });

  describe("3階層タスクID", () => {
    it("タスクグループとして3階層ID '1.2.1' を使った場合、正規表現で抽出されない", () => {
      // Given: タスクグループとして3階層IDを記述
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.2.1 3階層タスクグループ**
  **依存関係**: なし
  **完了条件**: これはタスクグループとして認識されない
`,
      };

      // When: パース実行
      const result = parseIssueBody(issue);

      // Then: タスクグループとして認識されない（正規表現が \d+\.\d+ のみ対応）
      expect(result.phases[0].taskGroups).toHaveLength(0);
    });

    it("サブタスク（Task）として3階層ID '1.1.1' を使った場合、正しく抽出される", () => {
      // Given: サブタスクとして3階層IDを記述
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1 親タスクグループ**
  **依存関係**: なし
  **完了条件**: 完了
  - 1.1.1 サブタスク1
  - 1.1.2 サブタスク2
  - 1.1.3 サブタスク3
`,
      };

      // When: パース実行
      const result = parseIssueBody(issue);

      // Then: タスクグループは1つ、サブタスクは3つ抽出される
      expect(result.phases[0].taskGroups).toHaveLength(1);
      const taskGroup = result.phases[0].taskGroups[0];
      expect(taskGroup.id).toBe("1.1");
      expect(taskGroup.tasks).toHaveLength(3);
      expect(taskGroup.tasks[0].id).toBe("1.1.1");
      expect(taskGroup.tasks[1].id).toBe("1.1.2");
      expect(taskGroup.tasks[2].id).toBe("1.1.3");
    });

    it("4階層ID '1.1.1.1' のようなより深いネストも認識されない", () => {
      // Given: 4階層IDのタスクグループ
      const issue: GitHubIssue = {
        number: 1,
        title: "Test",
        state: "open",
        body: `### Phase 1: テスト

- [ ] **1.1.1.1 4階層タスク**
  **依存関係**: なし
  **完了条件**: 認識されないはず
`,
      };

      // When: パース実行
      const result = parseIssueBody(issue);

      // Then: タスクグループとして認識されない
      expect(result.phases[0].taskGroups).toHaveLength(0);
    });
  });

  describe("複雑な実例", () => {
    it("複数Phase、複数タスクグループ、複雑な依存関係を持つIssueを正しくパースする", () => {
      // Given: 複雑な構造のIssue
      const issue: GitHubIssue = {
        number: 456,
        title: "複雑なプロジェクト",
        state: "open",
        body: `## 概要
このプロジェクトは複雑な依存関係を持つタスク群です。

### Phase 1: 基盤構築

- [x] **1.1 環境セットアップ**
  **依存関係**: なし
  **完了条件**: Docker環境が起動する
  - 1.1.1 Dockerインストール
  - 1.1.2 docker-compose.yml作成

- [ ] **1.2 データベース設計**
  **依存関係**: 1.1
  **完了条件**: スキーマが定義される
  - 1.2.1 ER図作成
  - 1.2.2 マイグレーションファイル作成

### Phase 2: アプリケーション開発

- [ ] **2.1 API実装**
  **依存関係**: Phase 1完了
  **完了条件**: APIが動作する
  - 2.1.1 ルーティング設定
  - 2.1.2 コントローラー実装
  - 2.1.3 テスト作成

- [ ] **2.2 フロントエンド実装**
  **依存関係**: 2.1, #123
  **完了条件**: 画面が表示される
  - 2.2.1 コンポーネント作成
  - 2.2.2 API連携
`,
      };

      // When: parseIssueBodyを呼び出す
      const result = parseIssueBody(issue);

      // Then: 全ての構造が正しくパースされる
      expect(result.issueNumber).toBe(456);
      expect(result.phases).toHaveLength(2);

      // Phase 1
      const phase1 = result.phases[0];
      expect(phase1.number).toBe(1);
      expect(phase1.name).toBe("基盤構築");
      expect(phase1.taskGroups).toHaveLength(2);
      expect(phase1.taskGroups[0].status).toBe("completed");
      expect(phase1.taskGroups[1].dependencies).toEqual(["1.1"]);
      expect(phase1.taskGroups[0].tasks).toHaveLength(2);

      // Phase 2
      const phase2 = result.phases[1];
      expect(phase2.number).toBe(2);
      expect(phase2.name).toBe("アプリケーション開発");
      expect(phase2.taskGroups).toHaveLength(2);
      expect(phase2.taskGroups[0].dependencies).toEqual(["Phase 1完了"]);
      expect(phase2.taskGroups[1].dependencies).toEqual(["2.1", "#123"]);
      expect(phase2.taskGroups[1].tasks).toHaveLength(2);
    });
  });
});
