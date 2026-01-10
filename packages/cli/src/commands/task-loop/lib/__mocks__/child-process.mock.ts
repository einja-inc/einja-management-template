import type { ExecSyncOptions, SpawnSyncReturns } from "node:child_process";
import { type Mock, vi } from "vitest";

/**
 * child_processモジュールのモック基盤クラス
 *
 * gh コマンドや git コマンドなどの外部コマンド実行をモックする際に使用します。
 *
 * @example
 * ```typescript
 * const mock = new ChildProcessMock();
 * mock.setup();
 *
 * // gh コマンドのレスポンスをモック
 * mock.mockGhCommand("issue view 123", { number: 123, title: "Test Issue" });
 *
 * // テスト実行
 * const result = execSync("gh issue view 123");
 *
 * mock.reset();
 * ```
 */
export class ChildProcessMock {
  private execSyncMock: Mock;
  private commandResponses: Map<string, unknown>;
  private commandErrors: Map<string, Error>;

  constructor() {
    this.execSyncMock = vi.fn();
    this.commandResponses = new Map();
    this.commandErrors = new Map();
  }

  /**
   * モックをセットアップします
   */
  setup(): void {
    // execSync のデフォルト実装
    this.execSyncMock.mockImplementation((command: string, options?: ExecSyncOptions) => {
      const cmdStr = command.toString().trim();

      // エラーがモックされている場合
      if (this.commandErrors.has(cmdStr)) {
        const error = this.commandErrors.get(cmdStr);
        throw error;
      }

      // レスポンスがモックされている場合
      if (this.commandResponses.has(cmdStr)) {
        const response = this.commandResponses.get(cmdStr);

        // オブジェクトの場合はJSON文字列化
        if (typeof response === "object" && response !== null) {
          return Buffer.from(JSON.stringify(response));
        }

        // 文字列の場合はそのまま返す
        return Buffer.from(String(response));
      }

      // デフォルトレスポンス
      console.warn(`[ChildProcessMock] Unhandled command: ${cmdStr}`);
      return Buffer.from("");
    });

    // グローバルモジュールとして設定
    vi.mock("node:child_process", () => ({
      execSync: this.execSyncMock,
      spawnSync: vi.fn(),
    }));
  }

  /**
   * モックをリセットします
   */
  reset(): void {
    this.execSyncMock.mockReset();
    this.commandResponses.clear();
    this.commandErrors.clear();
  }

  /**
   * gh コマンドのレスポンスをモックします
   *
   * @param subCommand - gh のサブコマンド（例: "issue view 123"）
   * @param response - モックするレスポンス（文字列またはオブジェクト）
   *
   * @example
   * ```typescript
   * mock.mockGhCommand("issue view 123", {
   *   number: 123,
   *   title: "Test Issue",
   *   state: "open"
   * });
   * ```
   */
  mockGhCommand(subCommand: string, response: unknown): void {
    const fullCommand = `gh ${subCommand}`.trim();
    this.commandResponses.set(fullCommand, response);
  }

  /**
   * gh コマンドのエラーをモックします
   *
   * @param subCommand - gh のサブコマンド
   * @param error - スローするエラー
   *
   * @example
   * ```typescript
   * mock.mockGhCommandError("issue view 999", new Error("issue not found"));
   * ```
   */
  mockGhCommandError(subCommand: string, error: Error): void {
    const fullCommand = `gh ${subCommand}`.trim();
    this.commandErrors.set(fullCommand, error);
  }

  /**
   * git コマンドのレスポンスをモックします
   *
   * @param subCommand - git のサブコマンド（例: "branch --list"）
   * @param response - モックするレスポンス
   *
   * @example
   * ```typescript
   * mock.mockGitCommand("branch --list", "* main\n  develop\n  feature/test");
   * ```
   */
  mockGitCommand(subCommand: string, response: unknown): void {
    const fullCommand = `git ${subCommand}`.trim();
    this.commandResponses.set(fullCommand, response);
  }

  /**
   * git コマンドのエラーをモックします
   *
   * @param subCommand - git のサブコマンド
   * @param error - スローするエラー
   *
   * @example
   * ```typescript
   * mock.mockGitCommandError("checkout unknown-branch", new Error("branch not found"));
   * ```
   */
  mockGitCommandError(subCommand: string, error: Error): void {
    const fullCommand = `git ${subCommand}`.trim();
    this.commandErrors.set(fullCommand, error);
  }

  /**
   * カスタムコマンドのレスポンスをモックします
   *
   * @param command - 完全なコマンド文字列
   * @param response - モックするレスポンス
   *
   * @example
   * ```typescript
   * mock.mockCommand("npm --version", "10.2.4");
   * ```
   */
  mockCommand(command: string, response: unknown): void {
    this.commandResponses.set(command.trim(), response);
  }

  /**
   * カスタムコマンドのエラーをモックします
   *
   * @param command - 完全なコマンド文字列
   * @param error - スローするエラー
   */
  mockCommandError(command: string, error: Error): void {
    this.commandErrors.set(command.trim(), error);
  }

  /**
   * execSyncモックを取得します（直接操作が必要な場合）
   */
  getExecSyncMock(): Mock {
    return this.execSyncMock;
  }

  /**
   * 特定のコマンドが呼び出されたかを確認します
   *
   * @param command - 確認するコマンド
   * @returns 呼び出された場合true
   *
   * @example
   * ```typescript
   * expect(mock.wasCommandCalled("gh issue view 123")).toBe(true);
   * ```
   */
  wasCommandCalled(command: string): boolean {
    const calls = this.execSyncMock.mock.calls;
    return calls.some((call) => {
      const calledCommand = String(call[0]).trim();
      return calledCommand === command.trim();
    });
  }

  /**
   * 呼び出されたすべてのコマンドを取得します
   *
   * @returns コマンド文字列の配列
   */
  getCalledCommands(): string[] {
    return this.execSyncMock.mock.calls.map((call) => String(call[0]).trim());
  }
}

/**
 * gh CLI のモックヘルパー
 *
 * GitHub CLI (gh) コマンドに特化したモックヘルパーです。
 *
 * @example
 * ```typescript
 * const ghMock = new GhCliMock(new ChildProcessMock());
 * ghMock.setup();
 *
 * ghMock.mockIssueView(123, {
 *   number: 123,
 *   title: "Test Issue",
 *   body: "Issue content"
 * });
 *
 * ghMock.reset();
 * ```
 */
export class GhCliMock {
  constructor(private readonly childProcessMock: ChildProcessMock) {}

  /**
   * モックをセットアップします
   */
  setup(): void {
    this.childProcessMock.setup();
  }

  /**
   * モックをリセットします
   */
  reset(): void {
    this.childProcessMock.reset();
  }

  /**
   * gh issue view のレスポンスをモックします
   */
  mockIssueView(issueNumber: number, issueData: Record<string, unknown>): void {
    this.childProcessMock.mockGhCommand(
      `issue view ${issueNumber} --json number,title,body,state`,
      issueData
    );
  }

  /**
   * gh issue edit のレスポンスをモックします
   */
  mockIssueEdit(issueNumber: number, success = true): void {
    if (success) {
      this.childProcessMock.mockGhCommand(`issue edit ${issueNumber} --body`, "");
    } else {
      this.childProcessMock.mockGhCommandError(
        `issue edit ${issueNumber} --body`,
        new Error("Failed to edit issue")
      );
    }
  }

  /**
   * gh pr create のレスポンスをモックします
   */
  mockPrCreate(prUrl = "https://github.com/owner/repo/pull/1", success = true): void {
    if (success) {
      this.childProcessMock.mockGhCommand("pr create", prUrl);
    } else {
      this.childProcessMock.mockGhCommandError("pr create", new Error("Failed to create PR"));
    }
  }

  /**
   * 内部のChildProcessMockを取得します
   */
  getChildProcessMock(): ChildProcessMock {
    return this.childProcessMock;
  }
}

/**
 * git コマンドのモックヘルパー
 *
 * git コマンドに特化したモックヘルパーです。
 *
 * @example
 * ```typescript
 * const gitMock = new GitCommandMock(new ChildProcessMock());
 * gitMock.setup();
 *
 * gitMock.mockBranchList(["main", "develop", "feature/test"]);
 * gitMock.mockCheckout("feature/test", true);
 *
 * gitMock.reset();
 * ```
 */
export class GitCommandMock {
  constructor(private readonly childProcessMock: ChildProcessMock) {}

  /**
   * モックをセットアップします
   */
  setup(): void {
    this.childProcessMock.setup();
  }

  /**
   * モックをリセットします
   */
  reset(): void {
    this.childProcessMock.reset();
  }

  /**
   * git branch --list のレスポンスをモックします
   */
  mockBranchList(branches: string[], currentBranch = "main"): void {
    const branchList = branches.map((b) => (b === currentBranch ? `* ${b}` : `  ${b}`)).join("\n");
    this.childProcessMock.mockGitCommand("branch --list", branchList);
  }

  /**
   * git checkout のレスポンスをモックします
   */
  mockCheckout(branchName: string, success = true): void {
    if (success) {
      this.childProcessMock.mockGitCommand(
        `checkout ${branchName}`,
        `Switched to branch '${branchName}'`
      );
    } else {
      this.childProcessMock.mockGitCommandError(
        `checkout ${branchName}`,
        new Error(`error: pathspec '${branchName}' did not match any file(s) known to git`)
      );
    }
  }

  /**
   * git merge のレスポンスをモックします
   */
  mockMerge(branchName: string, success = true, hasConflict = false): void {
    if (!success) {
      this.childProcessMock.mockGitCommandError(`merge ${branchName}`, new Error("merge failed"));
    } else if (hasConflict) {
      this.childProcessMock.mockGitCommandError(
        `merge ${branchName}`,
        new Error("CONFLICT (content): Merge conflict")
      );
    } else {
      this.childProcessMock.mockGitCommand(`merge ${branchName}`, "Merge successful");
    }
  }

  /**
   * git status のレスポンスをモックします
   */
  mockStatus(clean = true, conflictFiles: string[] = []): void {
    if (clean) {
      this.childProcessMock.mockGitCommand("status --porcelain", "");
    } else {
      const status = conflictFiles.map((file) => `UU ${file}`).join("\n");
      this.childProcessMock.mockGitCommand("status --porcelain", status);
    }
  }

  /**
   * git push のレスポンスをモックします
   */
  mockPush(success = true): void {
    if (success) {
      this.childProcessMock.mockGitCommand("push", "");
    } else {
      this.childProcessMock.mockGitCommandError("push", new Error("failed to push"));
    }
  }

  /**
   * 内部のChildProcessMockを取得します
   */
  getChildProcessMock(): ChildProcessMock {
    return this.childProcessMock;
  }
}
