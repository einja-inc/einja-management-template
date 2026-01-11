import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorktreePathByAttemptId, runDirenvAllow } from "./worktree-utils.js";

// node:child_process のモック
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

// node:fs のモック
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";

describe("worktree-utils", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("getWorktreePathByAttemptId", () => {
    it("porcelain形式の出力をパースし、ブランチ名が一致するワークツリーパスを返す", async () => {
      // Given: git worktree list --porcelain の出力
      const porcelainOutput = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/worktree1
HEAD def456abc789
branch refs/heads/vk/attempt-123

worktree /path/to/worktree2
HEAD 789abc456def
branch refs/heads/feature/test
`;
      vi.mocked(execSync).mockReturnValue(porcelainOutput);

      // When: attempt-123 のワークツリーパスを取得
      const result = await getWorktreePathByAttemptId("attempt-123");

      // Then: 正しいパスが返る
      expect(result).toBe("/path/to/worktree1");
      expect(execSync).toHaveBeenCalledWith("git worktree list --porcelain", {
        encoding: "utf-8",
      });
    });

    it("複数のワークツリーがある場合、正しいブランチのものを選択する", async () => {
      // Given: 複数のワークツリーを含む出力
      const porcelainOutput = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/vk-attempt-456
HEAD def456abc789
branch refs/heads/vk/attempt-456

worktree /path/to/vk-attempt-789
HEAD 789abc456def
branch refs/heads/vk/attempt-789
`;
      vi.mocked(execSync).mockReturnValue(porcelainOutput);

      // When: attempt-789 のワークツリーパスを取得
      const result = await getWorktreePathByAttemptId("attempt-789");

      // Then: attempt-789 に対応するパスが返る
      expect(result).toBe("/path/to/vk-attempt-789");
    });

    it("ブランチが見つからない場合、nullを返す", async () => {
      // Given: 対象のブランチが存在しない出力
      const porcelainOutput = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main

worktree /path/to/worktree1
HEAD def456abc789
branch refs/heads/vk/attempt-123
`;
      vi.mocked(execSync).mockReturnValue(porcelainOutput);

      // When: 存在しないattempt-999のワークツリーパスを取得
      const result = await getWorktreePathByAttemptId("attempt-999");

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("gitコマンドが失敗した場合、リトライして最終的にnullを返す", async () => {
      // Given: execSyncが常に失敗する
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("git command failed");
      });

      // When: ワークツリーパスを取得（maxRetries=3, retryDelayMs=10で高速化）
      const result = await getWorktreePathByAttemptId("attempt-123", "vk/", 3, 10);

      // Then: nullが返り、3回リトライされる
      expect(result).toBeNull();
      expect(execSync).toHaveBeenCalledTimes(3);
    });

    it("1回目は失敗し2回目で成功した場合、正しいパスを返す", async () => {
      // Given: 1回目は失敗、2回目以降は成功
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error("git command failed");
        })
        .mockReturnValue(`worktree /path/to/worktree1
HEAD def456abc789
branch refs/heads/vk/attempt-123
`);

      // When: ワークツリーパスを取得（retryDelayMs=10で高速化）
      const result = await getWorktreePathByAttemptId("attempt-123", "vk/", 3, 10);

      // Then: 正しいパスが返る
      expect(result).toBe("/path/to/worktree1");
      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it("空の出力の場合、nullを返す", async () => {
      // Given: 空の出力
      vi.mocked(execSync).mockReturnValue("");

      // When: ワークツリーパスを取得
      const result = await getWorktreePathByAttemptId("attempt-123");

      // Then: nullが返る
      expect(result).toBeNull();
    });

    it("ワークツリーパスは存在するがブランチ情報がない場合、nullを返す", async () => {
      // Given: ブランチ情報がない出力
      const porcelainOutput = `worktree /path/to/worktree1
HEAD def456abc789
`;
      vi.mocked(execSync).mockReturnValue(porcelainOutput);

      // When: ワークツリーパスを取得
      const result = await getWorktreePathByAttemptId("attempt-123");

      // Then: nullが返る（ブランチ情報がないため）
      expect(result).toBeNull();
    });
  });

  describe("runDirenvAllow", () => {
    it(".envrcが存在しない場合、成功を返す", () => {
      // Given: .envrcファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      // When: direnv allowを実行
      const result = runDirenvAllow("/path/to/worktree");

      // Then: 成功が返る
      expect(result.success).toBe(true);
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it(".envrcが存在する場合、direnvコマンドを実行し成功を返す", () => {
      // Given: .envrcファイルが存在し、direnvコマンドが成功する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("");

      // When: direnv allowを実行
      const result = runDirenvAllow("/path/to/worktree");

      // Then: 成功が返り、正しいコマンドが実行される
      expect(result.success).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith("direnv", ["allow", "/path/to/worktree"], {
        cwd: "/path/to/worktree",
        stdio: "pipe",
      });
    });

    it("direnvコマンドが失敗した場合、エラーを返す", () => {
      // Given: .envrcファイルが存在し、direnvコマンドが失敗する
      vi.mocked(existsSync).mockReturnValue(true);
      const mockError = new Error("direnv failed") as Error & { stderr: Buffer };
      mockError.stderr = Buffer.from("permission denied");
      vi.mocked(execFileSync).mockImplementation(() => {
        throw mockError;
      });

      // When: direnv allowを実行
      const result = runDirenvAllow("/path/to/worktree");

      // Then: エラーが返る
      expect(result.success).toBe(false);
      expect(result.error).toBe("permission denied");
    });

    it("direnvコマンドが失敗しstderrがない場合、デフォルトエラーメッセージを返す", () => {
      // Given: .envrcファイルが存在し、direnvコマンドがstderrなしで失敗する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error("unknown error");
      });

      // When: direnv allowを実行
      const result = runDirenvAllow("/path/to/worktree");

      // Then: デフォルトエラーメッセージが返る
      expect(result.success).toBe(false);
      expect(result.error).toBe("direnv allow failed");
    });

    it("パスにスペースが含まれる場合も正しく処理される", () => {
      // Given: スペースを含むパスで.envrcが存在
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("");

      // When: direnv allowを実行
      const result = runDirenvAllow("/path/to/my worktree");

      // Then: パスが配列要素として正しく渡される
      expect(result.success).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith("direnv", ["allow", "/path/to/my worktree"], {
        cwd: "/path/to/my worktree",
        stdio: "pipe",
      });
    });
  });
});
