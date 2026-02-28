import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { beforeEach, describe, expect, it } from "vitest";
import type { SyncMetadata } from "@/types/sync.js";
import { FileFilter } from "./file-filter.js";
import { OrphanCleaner } from "./orphan-cleaner.js";

describe("OrphanCleaner", () => {
  let tempDir: string;
  let templateDir: string;
  let cleaner: OrphanCleaner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orphan-test-"));
    templateDir = path.join(tempDir, "template");
    await fs.ensureDir(templateDir);
    const fileFilter = new FileFilter(tempDir, templateDir);
    cleaner = new OrphanCleaner(tempDir, fileFilter);
  });

  describe("detectOrphans", () => {
    it("メタデータにあるがテンプレートにないファイルを検出する", async () => {
      // ディスク上にファイルを作成
      await fs.ensureDir(path.join(tempDir, ".claude/skills/einja-old"));
      await fs.writeFile(
        path.join(tempDir, ".claude/skills/einja-old/SKILL.md"),
        "old skill",
        "utf-8"
      );

      const metadata: SyncMetadata = {
        version: "1.0.0",
        lastSync: "2025-01-01T00:00:00.000Z",
        templateVersion: "0.1.0",
        files: {
          ".claude/skills/einja-old/SKILL.md": {
            hash: "abc123",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
          ".claude/commands/einja/test.md": {
            hash: "def456",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };

      const currentTemplateFiles = [".claude/commands/einja/test.md"];
      const orphans = await cleaner.detectOrphans(metadata, currentTemplateFiles);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].path).toBe(".claude/skills/einja-old/SKILL.md");
      expect(orphans[0].category).toBe("skills");
      expect(orphans[0].exists).toBe(true);
    });

    it("カテゴリフィルタが正しく適用される", async () => {
      const metadata: SyncMetadata = {
        version: "1.0.0",
        lastSync: "2025-01-01T00:00:00.000Z",
        templateVersion: "0.1.0",
        files: {
          ".claude/skills/einja-old/SKILL.md": {
            hash: "abc123",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
          "docs/einja/old-doc.md": {
            hash: "def456",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };

      const currentTemplateFiles: string[] = [];
      const orphans = await cleaner.detectOrphans(metadata, currentTemplateFiles, ["skills"]);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].path).toBe(".claude/skills/einja-old/SKILL.md");
    });

    it("ディスク上に存在しないファイルはexists=falseになる", async () => {
      const metadata: SyncMetadata = {
        version: "1.0.0",
        lastSync: "2025-01-01T00:00:00.000Z",
        templateVersion: "0.1.0",
        files: {
          "docs/einja/deleted.md": {
            hash: "abc123",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };

      const orphans = await cleaner.detectOrphans(metadata, []);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].exists).toBe(false);
    });

    it("カテゴリがnullのファイルはスキップされる", async () => {
      const metadata: SyncMetadata = {
        version: "1.0.0",
        lastSync: "2025-01-01T00:00:00.000Z",
        templateVersion: "0.1.0",
        files: {
          "unknown/path/file.txt": {
            hash: "abc123",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };

      const orphans = await cleaner.detectOrphans(metadata, []);

      expect(orphans).toHaveLength(0);
    });

    it("パストラバーサルを含むパスはスキップされる", async () => {
      const metadata: SyncMetadata = {
        version: "1.0.0",
        lastSync: "2025-01-01T00:00:00.000Z",
        templateVersion: "0.1.0",
        files: {
          "../../../etc/passwd": {
            hash: "evil",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
          "docs/einja/../../../secret.txt": {
            hash: "evil2",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
          "/absolute/path/file.md": {
            hash: "evil3",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
          ".claude/skills/einja-valid/SKILL.md": {
            hash: "good",
            syncedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };

      const orphans = await cleaner.detectOrphans(metadata, []);

      // パストラバーサルと絶対パスはスキップされ、正常パスのみ検出
      expect(orphans).toHaveLength(1);
      expect(orphans[0].path).toBe(".claude/skills/einja-valid/SKILL.md");
    });
  });

  describe("createReport", () => {
    it("孤児がない場合のレポート", () => {
      const report = cleaner.createReport([]);

      expect(report.hasOrphans).toBe(false);
      expect(report.total).toBe(0);
      expect(report.existingCount).toBe(0);
    });

    it("孤児がある場合のレポート", () => {
      const orphans = [
        { path: "file1.md", category: "docs", exists: true },
        { path: "file2.md", category: "docs", exists: false },
      ];
      const report = cleaner.createReport(orphans);

      expect(report.hasOrphans).toBe(true);
      expect(report.total).toBe(2);
      expect(report.existingCount).toBe(1);
    });
  });

  describe("formatReport", () => {
    it("孤児がない場合は空文字を返す", () => {
      const report = cleaner.createReport([]);
      const formatted = cleaner.formatReport(report);

      expect(formatted).toBe("");
    });

    it("孤児がある場合はフォーマットされたレポートを返す", () => {
      const orphans = [
        { path: ".claude/skills/einja-old/SKILL.md", category: "skills", exists: true },
      ];
      const report = cleaner.createReport(orphans);
      const formatted = cleaner.formatReport(report);

      expect(formatted).toContain("孤児ファイルが検出されました");
      expect(formatted).toContain(".claude/skills/einja-old/SKILL.md");
      expect(formatted).toContain("(存在)");
    });
  });

  describe("formatHelpMessage", () => {
    it("ヘルプメッセージに--cleanが含まれる", () => {
      const message = cleaner.formatHelpMessage();

      expect(message).toContain("--clean");
    });
  });
});
