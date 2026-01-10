# task-loop テストモック・フィクスチャ

このディレクトリには、task-loopコマンドのテストで使用するモックとフィクスチャが含まれています。

## ファイル一覧

### sample-issues.ts

テスト用のIssue Markdownサンプル集です。

#### 用意されているサンプル

| サンプル名 | 説明 |
|-----------|------|
| `SAMPLE_ISSUE_SIMPLE` | 基本的なPhase+タスクグループ構造 |
| `SAMPLE_ISSUE_WITH_PHASE_DEPENDENCY` | Phase間依存を含む構造 |
| `SAMPLE_ISSUE_CIRCULAR` | 循環依存エラーを検出するためのサンプル |
| `SAMPLE_ISSUE_MALFORMED` | 不正形式を検出するためのサンプル |
| `SAMPLE_ISSUE_COMPLEX_DEPENDENCIES` | 複雑な依存関係を持つサンプル |
| `SAMPLE_ISSUE_WITH_EXTERNAL_DEPENDENCY` | 外部Issue依存を含むサンプル |
| `SAMPLE_ISSUE_WITH_COMPLETED_TASKS` | 完了済みタスクを含むサンプル |
| `SAMPLE_ISSUE_SPECIAL_TASK_NUMBERS` | タスク番号の特殊ケース |
| `SAMPLE_ISSUE_EMPTY` | 空のIssue（エラーケース） |
| `SAMPLE_ISSUE_PHASE_ONLY` | Phaseのみでタスクなし（エラーケース） |

#### 使用例

```typescript
import { SAMPLE_ISSUE_SIMPLE } from "./__mocks__/sample-issues.js";

describe("issue-parser", () => {
  it("基本的なPhaseとタスクグループをパースできる", () => {
    const result = parseIssueBody(SAMPLE_ISSUE_SIMPLE);

    expect(result.phases).toHaveLength(2);
    expect(result.taskGroups).toHaveLength(5);
  });
});
```

### child-process.mock.ts

`child_process`モジュールのモック基盤クラスです。

#### クラス一覧

| クラス名 | 説明 |
|---------|------|
| `ChildProcessMock` | child_processモジュールのモック基盤 |
| `GhCliMock` | GitHub CLI (gh)コマンドに特化したモック |
| `GitCommandMock` | gitコマンドに特化したモック |

#### 使用例

##### ChildProcessMock

```typescript
import { ChildProcessMock } from "./__mocks__/child-process.mock.js";

describe("github-client", () => {
  let mock: ChildProcessMock;

  beforeEach(() => {
    mock = new ChildProcessMock();
    mock.setup();
  });

  afterEach(() => {
    mock.reset();
  });

  it("gh issue view コマンドを実行できる", () => {
    // Given: モックレスポンスを設定
    mock.mockGhCommand("issue view 123", {
      number: 123,
      title: "Test Issue",
      state: "open"
    });

    // When: コマンド実行
    const result = githubClient.getIssue(123);

    // Then: モックレスポンスが返る
    expect(result.number).toBe(123);
    expect(result.title).toBe("Test Issue");
  });
});
```

##### GhCliMock

```typescript
import { ChildProcessMock, GhCliMock } from "./__mocks__/child-process.mock.js";

describe("github-client", () => {
  let ghMock: GhCliMock;

  beforeEach(() => {
    ghMock = new GhCliMock(new ChildProcessMock());
    ghMock.setup();
  });

  afterEach(() => {
    ghMock.reset();
  });

  it("Issue情報を取得できる", () => {
    // Given: Issue情報をモック
    ghMock.mockIssueView(123, {
      number: 123,
      title: "Test Issue",
      body: "Issue content",
      state: "open"
    });

    // When & Then
    const result = githubClient.getIssue(123);
    expect(result.title).toBe("Test Issue");
  });
});
```

##### GitCommandMock

```typescript
import { ChildProcessMock, GitCommandMock } from "./__mocks__/child-process.mock.js";

describe("branch-manager", () => {
  let gitMock: GitCommandMock;

  beforeEach(() => {
    gitMock = new GitCommandMock(new ChildProcessMock());
    gitMock.setup();
  });

  afterEach(() => {
    gitMock.reset();
  });

  it("ブランチ一覧を取得できる", () => {
    // Given: ブランチ一覧をモック
    gitMock.mockBranchList(["main", "develop", "feature/test"], "main");

    // When & Then
    const branches = branchManager.listBranches();
    expect(branches).toContain("main");
    expect(branches).toContain("develop");
  });

  it("ブランチチェックアウトできる", () => {
    // Given: チェックアウト成功をモック
    gitMock.mockCheckout("feature/test", true);

    // When & Then
    expect(() => branchManager.checkout("feature/test")).not.toThrow();
  });
});
```

## テスト戦略

詳細なテスト戦略については、以下のドキュメントを参照してください：

- [task-loop テスト計画](/Users/kzp/.claude/plans/functional-snuggling-pike.md)

## 参考

- 既存のテストパターン: `packages/cli/src/lib/sync/*.test.ts`
- テスト戦略ドキュメント: `docs/einja/steering/development/testing-strategy.md`
