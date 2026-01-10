import { beforeEach, describe, expect, it, vi } from "vitest";

// conflict-handler モジュールをモック
vi.mock("./conflict-handler.js", () => ({
  resolveConflictWithClaude: vi.fn(),
}));

// child_process モジュールをモック
vi.mock("node:child_process");

import { execSync } from "node:child_process";
import {
  branchExists,
  ensureIssueBranchWithoutCheckout,
  ensurePhaseBranchWithoutCheckout,
  fetchRemote,
  getDefaultBranch,
  getCurrentBranch,
  getPhaseBranchName,
  getPhaseBranchNameNew,
  mergePhaseBranchIntoIssue,
  syncPhaseBranch,
} from "./branch-manager.js";
import { resolveConflictWithClaude } from "./conflict-handler.js";

describe("branch-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchRemote", () => {
    it("git fetch origin を実行する", () => {
      // Given: fetchRemote が呼び出される
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: fetchRemote を実行
      fetchRemote();

      // Then: git fetch origin が実行される
      expect(execSync).toHaveBeenCalledWith("git fetch origin", { stdio: "inherit" });
    });
  });

  describe("getDefaultBranch", () => {
    it("リモートのデフォルトブランチ名を返す", () => {
      // Given: リモートのデフォルトブランチが main
      vi.mocked(execSync).mockReturnValueOnce("main\n" as any);

      // When: getDefaultBranch を呼び出す
      const result = getDefaultBranch();

      // Then: main が返る
      expect(result).toBe("main");
    });

    it("コマンド失敗時は main をデフォルトとして返す", () => {
      // Given: git コマンドが失敗する
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("command failed");
      });

      // When: getDefaultBranch を呼び出す
      const result = getDefaultBranch();

      // Then: デフォルト値 main が返る
      expect(result).toBe("main");
    });
  });

  describe("branchExists", () => {
    it("ローカルブランチが存在する場合、true を返す", () => {
      // Given: ローカルブランチが存在する
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from("commit-hash"));

      // When: branchExists を呼び出す
      const result = branchExists("feature/test");

      // Then: true が返る
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith("git rev-parse --verify feature/test", {
        stdio: "ignore",
      });
    });

    it("ローカルにはないがリモートブランチが存在する場合、true を返す", () => {
      // Given: ローカルブランチは存在しないが、リモートブランチは存在する
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        })
        .mockReturnValueOnce(Buffer.from("commit-hash"));

      // When: branchExists を呼び出す
      const result = branchExists("feature/test");

      // Then: true が返る
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith("git rev-parse --verify origin/feature/test", {
        stdio: "ignore",
      });
    });

    it("ローカルにもリモートにもブランチが存在しない場合、false を返す", () => {
      // Given: ローカルにもリモートにもブランチが存在しない
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("branch not found");
      });

      // When: branchExists を呼び出す
      const result = branchExists("non-existent");

      // Then: false が返る
      expect(result).toBe(false);
    });
  });

  describe("getPhaseBranchNameNew", () => {
    it("Phaseブランチ名を返す", () => {
      // When: getPhaseBranchNameNew を呼び出す
      const result = getPhaseBranchNameNew(123, 3);

      // Then: issue/123-phase3 が返る
      expect(result).toBe("issue/123-phase3");
    });
  });

  describe("getPhaseBranchName", () => {
    it("Phaseブランチ名を返す", () => {
      // When: getPhaseBranchName を呼び出す
      const result = getPhaseBranchName(123, 4);

      // Then: issue/123-phase4 が返る
      expect(result).toBe("issue/123-phase4");
    });
  });

  describe("ensureIssueBranchWithoutCheckout", () => {
    it("既存のIssueブランチの場合、チェックアウトせずに確認する", () => {
      // Given: Issueブランチが既に存在する
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")); // branchExists (local)

      // When: ensureIssueBranchWithoutCheckout を呼び出す
      const result = ensureIssueBranchWithoutCheckout(123, "main");

      // Then: issue/123 が返り、チェックアウトコマンドは実行されない
      expect(result).toBe("issue/123");
      const commands = vi.mocked(execSync).mock.calls.map((call) => call[0]);
      expect(commands.some((cmd) => String(cmd).includes("checkout"))).toBe(false);
    });

    it("Issueブランチが未存在の場合、チェックアウトせずに作成してプッシュする", () => {
      // Given: Issueブランチが存在しない
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockImplementationOnce(() => {
          throw new Error("branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create)
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: ensureIssueBranchWithoutCheckout を呼び出す
      const result = ensureIssueBranchWithoutCheckout(456, "develop");

      // Then: issue/456 が作成され、プッシュされる
      expect(result).toBe("issue/456");
      expect(execSync).toHaveBeenCalledWith("git branch issue/456 origin/develop", {
        stdio: "inherit",
      });
      expect(execSync).toHaveBeenCalledWith("git push -u origin issue/456", { stdio: "inherit" });

      // チェックアウトコマンドは実行されない
      const commands = vi.mocked(execSync).mock.calls.map((call) => call[0]);
      expect(commands.some((cmd) => String(cmd).includes("checkout"))).toBe(false);
    });
  });

  describe("ensurePhaseBranchWithoutCheckout", () => {
    it("既存のPhaseブランチの場合、確認のみ行う", () => {
      // Given: Phaseブランチが既に存在する
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from("commit-hash")); // branchExists

      // When: ensurePhaseBranchWithoutCheckout を呼び出す
      const result = ensurePhaseBranchWithoutCheckout(123, 1, "issue/123");

      // Then: issue/123-phase1 が返る
      expect(result).toBe("issue/123-phase1");
    });

    it("Phaseブランチが未存在の場合、作成してプッシュする", () => {
      // Given: Phaseブランチが存在しない
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error("branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: ensurePhaseBranchWithoutCheckout を呼び出す
      const result = ensurePhaseBranchWithoutCheckout(456, 2, "issue/456");

      // Then: issue/456-phase2 が作成され、プッシュされる
      expect(result).toBe("issue/456-phase2");
      expect(execSync).toHaveBeenCalledWith("git branch issue/456-phase2 issue/456", {
        stdio: "inherit",
      });
      expect(execSync).toHaveBeenCalledWith("git push -u origin issue/456-phase2", {
        stdio: "inherit",
      });
    });
  });

  describe("syncPhaseBranch", () => {
    it("Phaseブランチがリモートに未存在の場合、Issueブランチから新規作成する", async () => {
      // Given: Phaseブランチがリモートとローカルのどちらにも存在しない
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockImplementationOnce(() => {
          throw new Error("remote issue branch not found");
        }) // issue branch remote check fails (syncIssueBranch内)
        .mockImplementationOnce(() => {
          throw new Error("remote phase branch not found");
        }) // phase branch remote check fails
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create)
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: syncPhaseBranch を呼び出す
      const result = await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: issue/123-phase1 が作成され、プッシュされる
      expect(result).toBe("issue/123-phase1");
      expect(execSync).toHaveBeenCalledWith("git branch issue/123-phase1 issue/123", {
        stdio: "inherit",
      });
      expect(execSync).toHaveBeenCalledWith("git push -u origin issue/123-phase1", {
        stdio: "inherit",
      });
    });

    it("リモートにPhaseブランチが存在する場合、fetchして同期する", async () => {
      // Given: Phaseブランチがリモートに存在する
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockImplementationOnce(() => {
          throw new Error("remote issue branch not found");
        }) // issue branch remote check fails (syncIssueBranch内)
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin phase-branch
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        }) // local phase branch check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create from remote)
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base (for mergeIssueBranchIntoPhase)
        .mockReturnValueOnce("merge-base-commit\n" as any); // issue head (同じ = マージ済み)

      // When: syncPhaseBranch を呼び出す
      const result = await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: issue/123-phase1 が返り、リモートからフェッチされる
      expect(result).toBe("issue/123-phase1");
      expect(execSync).toHaveBeenCalledWith("git fetch origin issue/123-phase1", {
        stdio: "inherit",
      });
      expect(execSync).toHaveBeenCalledWith("git branch issue/123-phase1 origin/issue/123-phase1", {
        stdio: "inherit",
      });
    });

    it("ローカルのみの変更がある場合、マージする", async () => {
      // Given: Phaseブランチがリモートに存在し、ローカルにも存在する
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockImplementationOnce(() => {
          throw new Error("remote issue branch not found");
        }) // issue branch remote check fails (syncIssueBranch内)
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin phase-branch
        .mockReturnValueOnce(Buffer.from("local-commit")) // local phase branch exists
        // mergeRemoteIntoLocal の内部処理
        .mockReturnValueOnce("local-commit\n" as any) // git rev-parse local
        .mockReturnValueOnce("remote-commit\n" as any) // git rev-parse remote
        .mockReturnValueOnce("main-branch\n" as any) // getCurrentBranch
        .mockReturnValueOnce(Buffer.from("")) // git merge-base --is-ancestor (fast-forward可能)
        .mockReturnValueOnce(Buffer.from("")) // git branch -f
        // mergeIssueBranchIntoPhase の内部処理
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("merge-base-commit\n" as any); // issue head (同じ = マージ済み)

      // When: syncPhaseBranch を呼び出す
      const result = await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: issue/123-phase1 が返り、マージされる
      expect(result).toBe("issue/123-phase1");
    });
  });

  describe("mergePhaseBranchIntoIssue", () => {
    it("Phaseブランチがリモートに未存在の場合、スキップする", async () => {
      // Given: Phaseブランチがリモートに存在しない
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }); // rev-parse fails

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: マージがスキップされる（エラーなし）
      expect(execSync).toHaveBeenCalledTimes(2); // fetchRemote + rev-parse check
    });

    it("Phaseブランチが既にマージ済みの場合、スキップする", async () => {
      // Given: PhaseブランチがIssueブランチに既にマージ済み
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("phase-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-commit\n" as any); // phase head (同じ = マージ済み)

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: マージがスキップされる
      expect(execSync).toHaveBeenCalledTimes(4);
    });

    it("GitHub APIでマージ成功する", async () => {
      // Given: GitHub APIでマージが成功する
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-head-commit\n" as any) // phase head
        .mockReturnValueOnce(Buffer.from("")) // gh auth status
        .mockReturnValueOnce(Buffer.from("")) // gh api repos/.../merges
        .mockReturnValueOnce(Buffer.from("")) // git fetch issue branch
        .mockReturnValueOnce(Buffer.from("")); // git branch -f

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: GitHub APIでマージが実行される
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('gh api repos/:owner/:repo/merges -f base="issue/123"'),
        expect.anything()
      );
    });

    it("GitHub APIで409 Conflictの場合、worktreeで再試行する", async () => {
      // Given: GitHub APIが409を返し、worktreeでマージ成功
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-head-commit\n" as any) // phase head
        .mockReturnValueOnce(Buffer.from("")) // gh auth status
        .mockImplementationOnce(() => {
          throw new Error("409 Conflict");
        }) // gh api で 409 エラー
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockReturnValueOnce(Buffer.from("")) // git merge
        .mockReturnValueOnce(Buffer.from("")) // git push
        .mockReturnValueOnce(Buffer.from("")) // git worktree remove
        .mockReturnValueOnce(Buffer.from("")) // git fetch issue branch
        .mockReturnValueOnce(Buffer.from("")); // git branch -f

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: worktreeでマージが実行される
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git worktree add"),
        expect.anything()
      );
    });

    it("worktreeでコンフリクト発生時、resolveConflictWithClaudeを呼び出す", async () => {
      // Given: worktreeでコンフリクトが発生
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-head-commit\n" as any) // phase head
        .mockReturnValueOnce(Buffer.from("")) // gh auth status
        .mockImplementationOnce(() => {
          throw new Error("409 Conflict");
        }) // gh api で 409 エラー
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockImplementationOnce(() => {
          throw new Error("CONFLICT");
        }); // git merge でコンフリクト

      vi.mocked(resolveConflictWithClaude).mockResolvedValueOnce(true);

      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // git push after resolve
        .mockReturnValueOnce(Buffer.from("")) // git worktree remove
        .mockReturnValueOnce(Buffer.from("")) // git fetch issue branch
        .mockReturnValueOnce(Buffer.from("")); // git branch -f

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: resolveConflictWithClaude が呼び出される
      expect(resolveConflictWithClaude).toHaveBeenCalledWith(
        {
          targetBranch: "issue/123",
          sourceBranch: "issue/123-phase1",
          operationType: "phase",
        },
        expect.stringContaining("merge-work-")
      );
    });

    it("resolveConflictWithClaudeが失敗した場合、エラーをスローする", async () => {
      // Given: コンフリクト解消が失敗
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-head-commit\n" as any) // phase head
        .mockReturnValueOnce(Buffer.from("")) // gh auth status
        .mockImplementationOnce(() => {
          throw new Error("409 Conflict");
        })
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockImplementationOnce(() => {
          throw new Error("CONFLICT");
        });

      vi.mocked(resolveConflictWithClaude).mockResolvedValueOnce(false);

      vi.mocked(execSync).mockReturnValueOnce(Buffer.from("")); // git worktree remove

      // When/Then: エラーがスローされる
      await expect(mergePhaseBranchIntoIssue(123, 1, "issue/123")).rejects.toThrow(
        "Issue ブランチ issue/123 への Phase ブランチ issue/123-phase1 のマージでコンフリクトを解消できませんでした。"
      );

      // Then: worktree がクリーンアップされる
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git worktree remove"),
        expect.objectContaining({ stdio: "ignore" })
      );
    });
  });

  describe("mergeRemoteIntoLocal - fast-forward vs merge", () => {
    it("fast-forward可能な場合、fast-forwardマージする", async () => {
      // Given: Issueブランチがリモートに存在し、fast-forward可能
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote issue branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin issue/123
        .mockReturnValueOnce(Buffer.from("local-commit")) // local issue branch exists
        .mockReturnValueOnce("local-commit\n" as any) // git rev-parse local
        .mockReturnValueOnce("remote-commit\n" as any) // git rev-parse remote
        .mockReturnValueOnce("main\n" as any) // getCurrentBranch
        .mockReturnValueOnce(Buffer.from("")) // git merge-base --is-ancestor (fast-forward可能)
        .mockReturnValueOnce(Buffer.from("")) // git branch -f
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base (for mergeBaseBranchIntoIssue)
        .mockReturnValueOnce("merge-base-commit\n" as any) // base head (同じ = マージ済み)
        .mockImplementationOnce(() => {
          throw new Error("remote phase branch not found");
        }) // phase branch remote check fails
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create)
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: syncIssueBranch を呼び出す（内部で mergeRemoteIntoLocal が呼ばれる）
      await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: fast-forwardマージが実行される（git branch -f）
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git branch -f issue/123 origin/issue/123"),
        expect.anything()
      );
    });

    it("fast-forward不可の場合、通常マージする（worktree使用）", async () => {
      // Given: Issueブランチがリモートに存在し、fast-forward不可
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote issue branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin issue/123
        .mockReturnValueOnce(Buffer.from("local-commit")) // local issue branch exists
        .mockReturnValueOnce("local-commit\n" as any) // git rev-parse local
        .mockReturnValueOnce("remote-commit\n" as any) // git rev-parse remote
        .mockReturnValueOnce("main\n" as any) // getCurrentBranch
        .mockImplementationOnce(() => {
          throw new Error("not ancestor");
        }) // git merge-base --is-ancestor (fast-forward不可)
        .mockImplementationOnce(() => {
          throw new Error("not ancestor");
        }) // git merge-base --is-ancestor (プッシュも不可)
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockReturnValueOnce(Buffer.from("")) // git merge
        .mockReturnValueOnce(Buffer.from("")) // git push
        .mockReturnValueOnce(Buffer.from("")) // git worktree remove
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base (for mergeBaseBranchIntoIssue)
        .mockReturnValueOnce("merge-base-commit\n" as any) // base head (同じ = マージ済み)
        .mockImplementationOnce(() => {
          throw new Error("remote phase branch not found");
        }) // phase branch remote check fails
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create)
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: syncIssueBranch を呼び出す
      await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: worktreeでマージが実行される
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git worktree add"),
        expect.anything()
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git -C"),
        expect.anything()
      );
    });
  });

  describe("gh-auth 失敗時の処理", () => {
    it("gh auth statusが失敗した場合、worktreeでマージする", async () => {
      // Given: gh auth status が失敗する
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote phase branch exists
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base
        .mockReturnValueOnce("phase-head-commit\n" as any) // phase head
        .mockImplementationOnce(() => {
          throw new Error("not logged in");
        }) // gh auth status fails
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockReturnValueOnce(Buffer.from("")) // git merge
        .mockReturnValueOnce(Buffer.from("")) // git push
        .mockReturnValueOnce(Buffer.from("")) // git worktree remove
        .mockReturnValueOnce(Buffer.from("")) // git fetch issue branch
        .mockReturnValueOnce(Buffer.from("")); // git branch -f

      // When: mergePhaseBranchIntoIssue を呼び出す
      await mergePhaseBranchIntoIssue(123, 1, "issue/123");

      // Then: worktreeでマージが実行される
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git worktree add"),
        expect.anything()
      );
    });
  });

  describe("コンフリクトエスカレーション", () => {
    it("ベースブランチマージでコンフリクト時、Claude解決に委譲する", async () => {
      // Given: ベースブランチのマージでコンフリクトが発生
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote issue branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin issue/123
        .mockReturnValueOnce(Buffer.from("local-commit")) // local issue branch exists
        .mockReturnValueOnce("local-commit\n" as any) // git rev-parse local
        .mockReturnValueOnce("remote-commit\n" as any) // git rev-parse remote (同じでない)
        .mockReturnValueOnce("main\n" as any) // getCurrentBranch
        .mockReturnValueOnce(Buffer.from("")) // git merge-base --is-ancestor
        .mockReturnValueOnce(Buffer.from("")) // git branch -f
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base (for mergeBaseBranchIntoIssue)
        .mockReturnValueOnce("base-head-commit\n" as any) // base head (異なる = マージが必要)
        .mockImplementationOnce(() => {
          throw new Error("not logged in");
        }) // gh auth status fails
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockImplementationOnce(() => {
          throw new Error("CONFLICT");
        }); // git merge でコンフリクト

      vi.mocked(resolveConflictWithClaude).mockResolvedValueOnce(true);

      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // git push after resolve
        .mockReturnValueOnce(Buffer.from("")) // git worktree remove
        .mockReturnValueOnce(Buffer.from("")) // git fetch issue branch
        .mockReturnValueOnce(Buffer.from("")) // git branch -f
        .mockImplementationOnce(() => {
          throw new Error("remote phase branch not found");
        }) // phase branch remote check fails
        .mockImplementationOnce(() => {
          throw new Error("local branch not found");
        }) // branchExists local check fails
        .mockImplementationOnce(() => {
          throw new Error("remote branch not found");
        }) // branchExists remote check fails
        .mockReturnValueOnce(Buffer.from("")) // git branch (create)
        .mockReturnValueOnce(Buffer.from("")); // git push

      // When: syncPhaseBranch を呼び出す
      const result = await syncPhaseBranch(123, 1, "issue/123", "main");

      // Then: resolveConflictWithClaude が呼び出される
      expect(resolveConflictWithClaude).toHaveBeenCalledWith(
        {
          targetBranch: "issue/123",
          sourceBranch: "main",
          operationType: "base",
        },
        expect.stringContaining("merge-work-")
      );
      expect(result).toBe("issue/123-phase1");
    });

    it("Claude解決が失敗した場合、エラーをスローする", async () => {
      // Given: Claude解決が失敗
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from("")) // fetchRemote
        .mockReturnValueOnce(Buffer.from("commit-hash")) // remote issue branch exists
        .mockReturnValueOnce(Buffer.from("")) // git fetch origin issue/123
        .mockReturnValueOnce(Buffer.from("local-commit")) // local issue branch exists
        .mockReturnValueOnce("local-commit\n" as any) // git rev-parse local
        .mockReturnValueOnce("remote-commit\n" as any) // git rev-parse remote
        .mockReturnValueOnce("main\n" as any) // getCurrentBranch
        .mockReturnValueOnce(Buffer.from("")) // git merge-base --is-ancestor
        .mockReturnValueOnce(Buffer.from("")) // git branch -f
        .mockReturnValueOnce("merge-base-commit\n" as any) // merge-base (for mergeBaseBranchIntoIssue)
        .mockReturnValueOnce("base-head-commit\n" as any) // base head (異なる = マージが必要)
        .mockImplementationOnce(() => {
          throw new Error("not logged in");
        }) // gh auth status fails
        .mockReturnValueOnce(Buffer.from("")) // git worktree add
        .mockImplementationOnce(() => {
          throw new Error("CONFLICT");
        }); // git merge でコンフリクト

      vi.mocked(resolveConflictWithClaude).mockResolvedValueOnce(false);

      vi.mocked(execSync).mockReturnValueOnce(Buffer.from("")); // git worktree remove

      // When/Then: エラーがスローされる
      await expect(syncPhaseBranch(123, 1, "issue/123", "main")).rejects.toThrow(
        "Issue ブランチ issue/123 へのベースブランチ main のマージでコンフリクトを解消できませんでした。"
      );

      // Then: worktree がクリーンアップされる
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git worktree remove"),
        expect.objectContaining({ stdio: "ignore" })
      );
    });
  });
});
