/**
 * project-selector モジュールのユニットテスト
 *
 * タスク 1.1.1〜1.1.4 に対応した検証
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { VibeKanbanClient } from "./vibe-kanban-client.js";
import { VibeKanbanRestClient } from "./vibe-kanban-rest-client.js";

// ファイルシステム関連をモック
vi.mock("node:fs");
vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return {
    ...actual,
    join: actual.join,
    basename: actual.basename,
  };
});

// inquirer をモック
vi.mock("inquirer");

// VibeKanbanRestClient をモック
vi.mock("./vibe-kanban-rest-client.js");

// テスト対象をインポート（モック設定後）
const { selectProject } = await import("./project-selector.js");

// モック化した inquirer
const mockInquirer = await import("inquirer");

describe("selectProject", () => {
  /** VibeKanbanClient のモック */
  let mockVibeKanban: {
    listOrganizations: ReturnType<typeof vi.fn>;
    listProjects: ReturnType<typeof vi.fn>;
  };

  /** process.exit のモック */
  let mockProcessExit: ReturnType<typeof vi.fn>;

  /** console.log / console.error のモック */
  let mockConsoleLog: MockInstance<typeof console.log>;
  let mockConsoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    vi.clearAllMocks();

    // VibeKanbanClient のモックを設定
    mockVibeKanban = {
      listOrganizations: vi.fn(),
      listProjects: vi.fn(),
    };

    // process.exit をモック（テスト内で終了させない）
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit called with code ${_code}`);
    }) as unknown as ReturnType<typeof vi.fn>;

    // console をモック（出力を抑制）
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    // existsSync のデフォルト: 設定ファイルなし
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // タスク 1.1.1: .vibe-kanban.json が存在しない状態で
  //               プロジェクト選択UIが表示されることを確認
  // ────────────────────────────────────────────────────────────
  describe("タスク 1.1.1: 設定ファイルが存在しない場合のプロジェクト選択UI", () => {
    it(".vibe-kanban.json が存在しない場合、プロジェクト選択のinquirerプロンプトが表示される", async () => {
      // Given: 設定ファイルが存在しない（existsSync は false を返す）
      vi.mocked(existsSync).mockReturnValue(false);

      // Given: 1つの組織と1つのプロジェクトが存在する
      const mockOrg = { id: "org-1", name: "My Org" };
      const mockProject = { id: "project-1", name: "My Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      // Given: inquirer.prompt がプロジェクトを選択したと仮定
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "project-1",
      });
      // writeFileSync をモック（設定ファイル保存）
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: inquirer.prompt が呼ばれた（プロジェクト選択UIが表示された）
      expect(mockInquirer.default.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: "list",
            name: "projectId",
            message: expect.stringContaining("プロジェクト"),
          }),
        ])
      );

      // Then: 選択したプロジェクトIDが返る
      expect(result).toBe("project-1");
    });

    it(".vibe-kanban.json が存在しない場合、listOrganizations が呼ばれる", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      const mockProject = { id: "project-1", name: "My Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "project-1",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: listOrganizations が呼ばれた（接続確認も兼ねる）
      expect(mockVibeKanban.listOrganizations).toHaveBeenCalledTimes(1);
    });

    it("組織が1つの場合、組織選択UIは表示されずに自動選択される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      // Given: 1つの組織が存在する（自動選択される）
      const mockOrg = { id: "org-auto", name: "Auto Org" };
      const mockProject = { id: "project-auto", name: "Auto Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "project-auto",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: 組織IDを自動選択して listProjects が呼ばれた
      expect(mockVibeKanban.listProjects).toHaveBeenCalledWith("org-auto");
    });
  });

  // ────────────────────────────────────────────────────────────
  // タスク 1.1.2: 「新しいプロジェクトを作成」選択時に
  //               REST API で直接プロジェクトを作成する動作を確認
  // ────────────────────────────────────────────────────────────
  describe("タスク 1.1.2: 「新しいプロジェクトを作成」選択時のプロジェクト作成フロー", () => {
    it("「新しいプロジェクトを作成」を選択すると、VibeKanbanRestClient でプロジェクトが作成される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      const mockProject = { id: "project-existing", name: "Existing Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      // Given: 「新しいプロジェクトを作成」を選択したと仮定
      vi.mocked(mockInquirer.default.prompt)
        .mockResolvedValueOnce({ projectId: "__new__" }) // プロジェクト選択で「新規」を選択
        .mockResolvedValueOnce({ projectName: "New Test Project" }); // プロジェクト名入力

      // Given: VibeKanbanRestClient のスタティックメソッドとインスタンスをモック
      const mockDiscoverPort = vi.mocked(VibeKanbanRestClient.discoverPort);
      mockDiscoverPort.mockReturnValue(12345);

      const mockRestClientInstance = {
        isAvailable: vi.fn().mockResolvedValue(true),
        createProject: vi.fn().mockResolvedValue("new-project-id"),
      };
      vi.mocked(VibeKanbanRestClient).mockImplementation(
        () => mockRestClientInstance as unknown as VibeKanbanRestClient
      );

      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: REST API でプロジェクトが作成された
      expect(mockRestClientInstance.createProject).toHaveBeenCalledWith(
        "New Test Project",
        expect.any(String) // process.cwd()
      );

      // Then: 作成されたプロジェクトの ID が返る
      expect(result).toBe("new-project-id");
    });

    it("REST API 利用可能確認（isAvailable）が実行される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([]);

      // Given: 「新しいプロジェクトを作成」を選択
      vi.mocked(mockInquirer.default.prompt)
        .mockResolvedValueOnce({ projectId: "__new__" })
        .mockResolvedValueOnce({ projectName: "Test" });

      const mockDiscoverPort = vi.mocked(VibeKanbanRestClient.discoverPort);
      mockDiscoverPort.mockReturnValue(12345);

      const mockRestClientInstance = {
        isAvailable: vi.fn().mockResolvedValue(true),
        createProject: vi.fn().mockResolvedValue("created-project-id"),
      };
      vi.mocked(VibeKanbanRestClient).mockImplementation(
        () => mockRestClientInstance as unknown as VibeKanbanRestClient
      );

      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: isAvailable が呼ばれた（バックエンド接続確認）
      expect(mockRestClientInstance.isAvailable).toHaveBeenCalledTimes(1);
    });

    it("discoverPort が null を返す（バックエンド未起動）場合、guidance を表示して process.exit(1) が呼ばれる", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([]);

      // Given: 「新しいプロジェクトを作成」を選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValueOnce({
        projectId: "__new__",
      });

      // Given: ポートが発見できない（バックエンド未起動）
      vi.mocked(VibeKanbanRestClient.discoverPort).mockReturnValue(null);

      // When/Then: process.exit(1) が呼ばれる
      await expect(
        selectProject(mockVibeKanban as unknown as VibeKanbanClient)
      ).rejects.toThrow("process.exit called with code 1");

      // Then: console.log でガイダンスが出力された
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("vibe-kanban")
      );
    });

    it("isAvailable が false を返す場合、guidance を表示して process.exit(1) が呼ばれる", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([]);

      // Given: 「新しいプロジェクトを作成」を選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValueOnce({
        projectId: "__new__",
      });

      // Given: ポートは見つかるが接続不可
      vi.mocked(VibeKanbanRestClient.discoverPort).mockReturnValue(12345);

      const mockRestClientInstance = {
        isAvailable: vi.fn().mockResolvedValue(false),
        createProject: vi.fn(),
      };
      vi.mocked(VibeKanbanRestClient).mockImplementation(
        () => mockRestClientInstance as unknown as VibeKanbanRestClient
      );

      // When/Then: process.exit(1) が呼ばれる
      await expect(
        selectProject(mockVibeKanban as unknown as VibeKanbanClient)
      ).rejects.toThrow("process.exit called with code 1");

      // Then: createProject は呼ばれない
      expect(mockRestClientInstance.createProject).not.toHaveBeenCalled();
    });

    it("新規プロジェクト作成後に .vibe-kanban.json が保存される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([]);

      // Given: 「新しいプロジェクトを作成」を選択
      vi.mocked(mockInquirer.default.prompt)
        .mockResolvedValueOnce({ projectId: "__new__" })
        .mockResolvedValueOnce({ projectName: "Save Test Project" });

      vi.mocked(VibeKanbanRestClient.discoverPort).mockReturnValue(12345);

      const mockRestClientInstance = {
        isAvailable: vi.fn().mockResolvedValue(true),
        createProject: vi.fn().mockResolvedValue("saved-project-id"),
      };
      vi.mocked(VibeKanbanRestClient).mockImplementation(
        () => mockRestClientInstance as unknown as VibeKanbanRestClient
      );

      const mockWriteFile = vi.mocked(writeFileSync).mockImplementation(
        () => {}
      );

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: writeFileSync が呼ばれた（設定ファイルが保存された）
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(".vibe-kanban.json"),
        expect.stringContaining("saved-project-id")
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // タスク 1.1.3: 既存プロジェクト選択後に設定ファイルが保存され、
  //               次回から自動使用されることを確認
  // ────────────────────────────────────────────────────────────
  describe("タスク 1.1.3: プロジェクト選択後の設定ファイル保存と再利用", () => {
    it("既存プロジェクトを選択すると、.vibe-kanban.json に project_id が保存される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      const mockOrg = { id: "org-1", name: "My Org" };
      const mockProject = { id: "project-selected", name: "Selected Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      // Given: 既存プロジェクトを選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "project-selected",
      });

      const mockWriteFile = vi.mocked(writeFileSync).mockImplementation(
        () => {}
      );

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: 選択したプロジェクトIDが返る
      expect(result).toBe("project-selected");

      // Then: writeFileSync が .vibe-kanban.json に project_id を含んで呼ばれた
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(".vibe-kanban.json"),
        expect.stringContaining("project-selected")
      );
    });

    it("設定ファイルに有効な project_id がある場合、inquirer は表示されずに自動選択される", async () => {
      // Given: 設定ファイルに有効な project_id が存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ project_id: "valid-project-id" })
      );

      const mockOrg = { id: "org-1", name: "My Org" };
      const validProject = { id: "valid-project-id", name: "Valid Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([validProject]);

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: inquirer.prompt は呼ばれない（自動選択）
      expect(mockInquirer.default.prompt).not.toHaveBeenCalled();

      // Then: 設定ファイルの project_id が返る
      expect(result).toBe("valid-project-id");
    });

    it("設定ファイルの project_id が有効な場合、プロジェクト名がコンソールに出力される", async () => {
      // Given: 設定ファイルに有効な project_id が存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ project_id: "auto-project-id" })
      );

      const mockOrg = { id: "org-1", name: "My Org" };
      const validProject = { id: "auto-project-id", name: "Auto Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([validProject]);

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: プロジェクト名がコンソールに出力された
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Auto Project")
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // タスク 1.1.4: 無効な project_id が設定されている場合に
  //               再選択を促すメッセージが表示されることを確認
  // ────────────────────────────────────────────────────────────
  describe("タスク 1.1.4: 無効な project_id 設定時の再選択フロー", () => {
    it("設定ファイルの project_id が存在しないプロジェクトを指している場合、警告メッセージが表示される", async () => {
      // Given: 設定ファイルに無効な project_id が存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ project_id: "invalid-project-id" })
      );

      const mockOrg = { id: "org-1", name: "My Org" };
      // 設定の project_id と一致するプロジェクトが存在しない
      const existingProject = { id: "other-project", name: "Other Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([existingProject]);

      // Given: 再選択でプロジェクトを選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "other-project",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: 無効な project_id の警告メッセージが出力された
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("invalid-project-id")
      );
    });

    it("設定ファイルの project_id が無効な場合、再選択を促すメッセージが表示される", async () => {
      // Given: 設定ファイルに無効な project_id が存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ project_id: "nonexistent-id" })
      );

      const mockOrg = { id: "org-1", name: "My Org" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([
        { id: "valid-id", name: "Valid Project" },
      ]);

      // Given: 再選択でプロジェクトを選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "valid-id",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: 再選択を促すメッセージが出力された
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("再選択")
      );
    });

    it("設定ファイルの project_id が無効な場合、プロジェクト選択のUIが再表示される", async () => {
      // Given: 設定ファイルに無効な project_id が存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ project_id: "stale-project-id" })
      );

      const mockOrg = { id: "org-1", name: "My Org" };
      const newProject = { id: "new-project-id", name: "New Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([newProject]);

      // Given: 再選択UIでプロジェクトを選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "new-project-id",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: inquirer.prompt が呼ばれた（プロジェクト選択UIが再表示された）
      expect(mockInquirer.default.prompt).toHaveBeenCalled();

      // Then: 新しく選択したプロジェクトIDが返る
      expect(result).toBe("new-project-id");
    });

    it("設定ファイルが破損している（JSON パースエラー）場合、プロジェクト選択UIが表示される", async () => {
      // Given: 破損した設定ファイルが存在する
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json content {{{");

      const mockOrg = { id: "org-1", name: "My Org" };
      const mockProject = { id: "project-fallback", name: "Fallback Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue([mockOrg]);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      // Given: inquirer でプロジェクトを選択
      vi.mocked(mockInquirer.default.prompt).mockResolvedValue({
        projectId: "project-fallback",
      });
      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      const result = await selectProject(
        mockVibeKanban as unknown as VibeKanbanClient
      );

      // Then: inquirer.prompt が呼ばれた（設定ファイル破損時もUIが表示される）
      expect(mockInquirer.default.prompt).toHaveBeenCalled();
      expect(result).toBe("project-fallback");
    });
  });

  // ────────────────────────────────────────────────────────────
  // その他の動作確認
  // ────────────────────────────────────────────────────────────
  describe("バックエンド接続失敗の場合", () => {
    it("listOrganizations がエラーをスローした場合、guidance を表示して process.exit(1) が呼ばれる", async () => {
      // Given: バックエンドに接続できない
      mockVibeKanban.listOrganizations.mockRejectedValue(
        new Error("MCP connection failed")
      );

      // When/Then: process.exit(1) が呼ばれる
      await expect(
        selectProject(mockVibeKanban as unknown as VibeKanbanClient)
      ).rejects.toThrow("process.exit called with code 1");

      // Then: ガイダンスメッセージが出力された
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("vibe-kanban")
      );
    });

    it("組織が存在しない場合、エラーメッセージを表示して process.exit(1) が呼ばれる", async () => {
      // Given: 組織が存在しない
      mockVibeKanban.listOrganizations.mockResolvedValue([]);

      // When/Then: process.exit(1) が呼ばれる
      await expect(
        selectProject(mockVibeKanban as unknown as VibeKanbanClient)
      ).rejects.toThrow("process.exit called with code 1");

      // Then: エラーメッセージが出力された
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("組織")
      );
    });

    it("issueNumber を渡すと、ガイダンスメッセージに issue 番号が含まれる", async () => {
      // Given: バックエンドに接続できない
      mockVibeKanban.listOrganizations.mockRejectedValue(
        new Error("Connection failed")
      );

      // When: issue 番号付きで呼び出す（エラーになる）
      await expect(
        selectProject(mockVibeKanban as unknown as VibeKanbanClient, 123)
      ).rejects.toThrow("process.exit called with code 1");

      // Then: ガイダンスに issue 番号が含まれる
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("123")
      );
    });
  });

  describe("複数組織がある場合", () => {
    it("複数組織がある場合、組織選択の inquirer プロンプトが表示される", async () => {
      // Given: 設定ファイルが存在しない
      vi.mocked(existsSync).mockReturnValue(false);

      // Given: 複数の組織が存在する
      const mockOrgs = [
        { id: "org-1", name: "Organization A" },
        { id: "org-2", name: "Organization B" },
      ];
      const mockProject = { id: "project-1", name: "My Project" };
      mockVibeKanban.listOrganizations.mockResolvedValue(mockOrgs);
      mockVibeKanban.listProjects.mockResolvedValue([mockProject]);

      // Given: 組織選択とプロジェクト選択
      vi.mocked(mockInquirer.default.prompt)
        .mockResolvedValueOnce({ orgId: "org-2" }) // 組織選択
        .mockResolvedValueOnce({ projectId: "project-1" }); // プロジェクト選択

      vi.mocked(writeFileSync).mockImplementation(() => {});

      // When: selectProject を呼び出す
      await selectProject(mockVibeKanban as unknown as VibeKanbanClient);

      // Then: 組織選択の inquirer が呼ばれた
      expect(mockInquirer.default.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: "list",
            name: "orgId",
          }),
        ])
      );

      // Then: 選択した組織 (org-2) で listProjects が呼ばれた
      expect(mockVibeKanban.listProjects).toHaveBeenCalledWith("org-2");
    });
  });
});
