import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// child_process モジュールをモック
vi.mock("node:child_process");

// fs モジュールをモック
vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

import { execSync } from "node:child_process";
import fs from "node:fs";
import {
  getIssue,
  getRepoInfo,
  isIssueClosed,
  markTaskGroupAsCompleted,
  updateIssueBody,
} from "./github-client.js";

describe("github-client", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("getIssue", () => {
    it("存在するIssue番号の場合、Issueオブジェクトを返す", () => {
      // Given: 存在するIssue番号とそのレスポンス
      const issueNumber = 123;
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            number: 123,
            title: "Test Issue",
            body: "Issue body content",
            state: "open",
          })
        )
      );

      // When: getIssueを呼び出す
      const result = getIssue(issueNumber);

      // Then: Issueオブジェクトが返る
      expect(result).toEqual({
        number: 123,
        title: "Test Issue",
        body: "Issue body content",
        state: "open",
      });
    });

    it("存在しないIssue番号の場合、エラーをスローする", () => {
      // Given: 存在しないIssue番号
      const issueNumber = 999;
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("issue not found");
      });

      // When/Then: getIssueを呼び出すとエラーがスローされる
      expect(() => getIssue(issueNumber)).toThrow("GitHub Issue #999 の取得に失敗しました");
    });

    it("ghコマンド実行に失敗した場合、エラーをスローする", () => {
      // Given: ghコマンドが失敗する状況
      const issueNumber = 123;
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("gh command failed");
      });

      // When/Then: エラーがスローされる
      expect(() => getIssue(issueNumber)).toThrow("GitHub Issue #123 の取得に失敗しました");
    });

    it("closedステータスのIssueを取得できる", () => {
      // Given: closedステータスのIssue
      const issueNumber = 456;
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            number: 456,
            title: "Closed Issue",
            body: "This issue is closed",
            state: "closed",
          })
        )
      );

      // When: getIssueを呼び出す
      const result = getIssue(issueNumber);

      // Then: closedステータスが正しく設定される
      expect(result.state).toBe("closed");
    });
  });

  describe("updateIssueBody", () => {
    it("Issue本文を更新すると、一時ファイル経由でgh issue editが実行される", () => {
      // Given: Issue番号と新しい本文
      const issueNumber = 123;
      const newBody = "Updated issue body";
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: updateIssueBodyを呼び出す
      updateIssueBody(issueNumber, newBody);

      // Then: gh issue editが呼び出される
      const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        `gh issue edit ${issueNumber} --body-file "${tempFile}"`,
        expect.any(Object)
      );
    });

    it("一時ファイルに本文が書き込まれる", () => {
      // Given: 更新する本文
      const issueNumber = 123;
      const newBody = "Updated issue body content";
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: updateIssueBodyを実行
      updateIssueBody(issueNumber, newBody);

      // Then: fs.writeFileSyncが正しい内容で呼ばれる
      const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(tempFile, newBody, "utf-8");
    });

    it("処理完了後に一時ファイルが削除される", () => {
      // Given: Issue本文更新
      const issueNumber = 456;
      const newBody = "New body";
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: updateIssueBodyを実行
      updateIssueBody(issueNumber, newBody);

      // Then: fs.unlinkSyncが呼ばれる
      const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
      expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalledWith(tempFile);
    });

    it("エラー発生時も一時ファイルが削除されない（例外がスローされるため）", () => {
      // Given: ghコマンドが失敗する設定
      const issueNumber = 789;
      const newBody = "Body";
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("gh edit failed");
      });

      // When: updateIssueBodyを実行
      expect(() => updateIssueBody(issueNumber, newBody)).toThrow(
        "GitHub Issue #789 の更新に失敗しました"
      );

      // Then: エラーがスローされ、unlinkSyncは呼ばれない
      expect(vi.mocked(fs.unlinkSync)).not.toHaveBeenCalled();
    });

    it("4000文字を超える長い本文の場合、一時ファイル経由で更新される", () => {
      // Given: 4000文字を超える本文
      const issueNumber = 789;
      const longBody = "a".repeat(5000);
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: updateIssueBodyを呼び出す
      updateIssueBody(issueNumber, longBody);

      // Then: gh issue editが呼び出される
      const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        `gh issue edit ${issueNumber} --body-file "${tempFile}"`,
        expect.any(Object)
      );
    });

    it("gh issue editが失敗した場合、エラーをスローする", () => {
      // Given: gh issue editが失敗する状況
      const issueNumber = 123;
      const newBody = "New body";
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("edit failed");
      });

      // When/Then: エラーがスローされる
      expect(() => updateIssueBody(issueNumber, newBody)).toThrow(
        "GitHub Issue #123 の更新に失敗しました"
      );
    });

    it("空の本文でも更新できる", () => {
      // Given: 空の本文
      const issueNumber = 123;
      const emptyBody = "";
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(""));

      // When: updateIssueBodyを呼び出す
      updateIssueBody(issueNumber, emptyBody);

      // Then: gh issue editが呼び出される
      const tempFile = path.join(os.tmpdir(), `issue-body-${issueNumber}.md`);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        `gh issue edit ${issueNumber} --body-file "${tempFile}"`,
        expect.any(Object)
      );
    });
  });

  describe("isIssueClosed", () => {
    it("CLOSEDステータスのIssueの場合、trueを返す", () => {
      // Given: CLOSEDステータスのIssue
      const issueNumber = 123;
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            state: "CLOSED",
          })
        )
      );

      // When: isIssueClosedを呼び出す
      const result = isIssueClosed(issueNumber);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("OPENステータスのIssueの場合、falseを返す", () => {
      // Given: OPENステータスのIssue
      const issueNumber = 456;
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            state: "OPEN",
          })
        )
      );

      // When: isIssueClosedを呼び出す
      const result = isIssueClosed(issueNumber);

      // Then: falseが返る
      expect(result).toBe(false);
    });

    it("Issueが見つからない場合、falseを返す", () => {
      // Given: 存在しないIssue
      const issueNumber = 999;
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("issue not found");
      });

      // When: isIssueClosedを呼び出す
      const result = isIssueClosed(issueNumber);

      // Then: falseが返る（閉じられていないとみなす）
      expect(result).toBe(false);
    });

    it("ghコマンドが失敗した場合、falseを返す", () => {
      // Given: ghコマンドが失敗する状況
      const issueNumber = 123;
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("gh command failed");
      });

      // When: isIssueClosedを呼び出す
      const result = isIssueClosed(issueNumber);

      // Then: falseが返る
      expect(result).toBe(false);
    });
  });

  describe("getRepoInfo", () => {
    it("リポジトリ情報を取得すると、owner/name/defaultBranchを含むオブジェクトが返る", () => {
      // Given: リポジトリ情報のレスポンス
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            owner: { login: "test-owner" },
            name: "test-repo",
            defaultBranchRef: { name: "main" },
          })
        )
      );

      // When: getRepoInfoを呼び出す
      const result = getRepoInfo();

      // Then: リポジトリ情報が返る
      expect(result).toEqual({
        owner: "test-owner",
        name: "test-repo",
        defaultBranch: "main",
      });
    });

    it("デフォルトブランチがdevelopの場合、正しく取得できる", () => {
      // Given: デフォルトブランチがdevelopのリポジトリ
      vi.mocked(execSync).mockReturnValueOnce(
        Buffer.from(
          JSON.stringify({
            owner: { login: "another-owner" },
            name: "another-repo",
            defaultBranchRef: { name: "develop" },
          })
        )
      );

      // When: getRepoInfoを呼び出す
      const result = getRepoInfo();

      // Then: developブランチが取得される
      expect(result.defaultBranch).toBe("develop");
    });

    it("リポジトリ情報の取得に失敗した場合、エラーをスローする", () => {
      // Given: gh repo viewが失敗する状況
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("not a git repository");
      });

      // When/Then: エラーがスローされる
      expect(() => getRepoInfo()).toThrow("リポジトリ情報の取得に失敗しました");
    });
  });

  describe("markTaskGroupAsCompleted", () => {
    it("ボールドなしの未完了チェックボックスを完了マークに変換する", () => {
      // Given: ボールドなしの未完了タスクグループ
      const issueBody = `### Phase 1: テスト

- [ ] 1.1 タスクA
  - **依存関係**: なし
  - **完了条件**: 完了すること
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.1");

      // Then: チェックボックスが[x]に変換される
      expect(result).toContain("- [x] 1.1 タスクA");
    });

    it("ボールドありの未完了チェックボックスを完了マークに変換する", () => {
      // Given: ボールドありの未完了タスクグループ
      const issueBody = `### Phase 1: テスト

- [ ] **1.2 タスクB**
  - **依存関係**: 1.1
  - **完了条件**: 完了すること
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.2");

      // Then: チェックボックスが[x]に変換される
      expect(result).toContain("- [x] **1.2 タスクB**");
    });

    it("着手中コメントがある場合、削除する", () => {
      // Given: 着手中コメント付きのタスクグループ
      const issueBody = `### Phase 1: テスト

- [ ] **1.3 タスクC** <!-- 🔄 着手中 -->
  - **依存関係**: なし
  - **完了条件**: 完了すること
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.3");

      // Then: 着手中コメントが削除される
      expect(result).not.toContain("<!-- 🔄 着手中 -->");
      expect(result).toContain("- [x] **1.3 タスクC**");
    });

    it("インデントがある場合でも正しく変換する", () => {
      // Given: インデント付きのタスクグループ
      const issueBody = `### Phase 1: テスト

  - [ ] **1.4 インデントタスク**
    - **依存関係**: なし
    - **完了条件**: 完了すること
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.4");

      // Then: インデントを保ったまま変換される
      expect(result).toContain("  - [x] **1.4 インデントタスク**");
    });

    it("該当しないタスクグループIDの場合、変更しない", () => {
      // Given: タスクグループIDが一致しない
      const issueBody = `### Phase 1: テスト

- [ ] **1.5 タスクE**
  - **依存関係**: なし
  - **完了条件**: 完了すること
`;

      // When: 存在しないタスクグループIDで呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "9.9");

      // Then: 変更されない
      expect(result).toBe(issueBody);
    });

    it("複数のタスクグループがある場合、指定したもののみ変換する", () => {
      // Given: 複数のタスクグループ
      const issueBody = `### Phase 1: テスト

- [ ] **1.1 タスクA**
  - **依存関係**: なし
  - **完了条件**: A完了

- [ ] **1.2 タスクB**
  - **依存関係**: 1.1
  - **完了条件**: B完了

- [ ] **1.3 タスクC**
  - **依存関係**: 1.2
  - **完了条件**: C完了
`;

      // When: 1.2のみ完了マークに変換
      const result = markTaskGroupAsCompleted(issueBody, "1.2");

      // Then: 1.2のみ変換され、他はそのまま
      expect(result).toContain("- [ ] **1.1 タスクA**");
      expect(result).toContain("- [x] **1.2 タスクB**");
      expect(result).toContain("- [ ] **1.3 タスクC**");
    });

    it("既に完了済みのタスクグループは変更しない", () => {
      // Given: 既に完了済みのタスクグループ
      const issueBody = `### Phase 1: テスト

- [x] **1.6 完了済みタスク**
  - **依存関係**: なし
  - **完了条件**: 既に完了
`;

      // When: 完了済みタスクに対して呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.6");

      // Then: 変更されない
      expect(result).toBe(issueBody);
    });

    it("タスクグループIDにドットが含まれる場合でも正しく変換する", () => {
      // Given: サブタスクグループID（例: 1.2.3）
      const issueBody = `### Phase 1: テスト

- [ ] **1.2.3 サブタスク**
  - **依存関係**: 1.2
  - **完了条件**: サブタスク完了
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.2.3");

      // Then: 正しく変換される
      expect(result).toContain("- [x] **1.2.3 サブタスク**");
    });

    it("空の本文の場合、変更しない", () => {
      // Given: 空の本文
      const issueBody = "";

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.1");

      // Then: 変更されない
      expect(result).toBe("");
    });

    it("着手中コメントの前後に空白がある場合でも削除する", () => {
      // Given: 着手中コメントの前後に空白があるタスクグループ
      const issueBody = `### Phase 1: テスト

- [ ] **1.7 タスクG**   <!--   🔄   着手中   -->
  - **依存関係**: なし
  - **完了条件**: 完了すること
`;

      // When: markTaskGroupAsCompletedを呼び出す
      const result = markTaskGroupAsCompleted(issueBody, "1.7");

      // Then: 着手中コメントが削除される
      expect(result).not.toContain("着手中");
      expect(result).toContain("- [x] **1.7 タスクG**");
    });
  });
});
