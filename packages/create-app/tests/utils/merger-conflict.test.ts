import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SyncMetadata } from "@/types/index.js";
import { mergeAndWriteFile } from "@/utils/merger.js";

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "create-app-merger-"));
  tempDirs.push(dir);
  return dir;
}

function createMetadata(baseContentByPath: Record<string, string>): SyncMetadata {
  const files = Object.fromEntries(
    Object.entries(baseContentByPath).map(([filePath, baseContent]) => [
      filePath,
      {
        hash: "test-hash",
        syncedAt: "2026-03-18T00:00:00.000Z",
        baseContent,
      },
    ])
  );

  return {
    version: "1.1.0",
    lastSync: "2026-03-18T00:00:00.000Z",
    templateVersion: "0.3.20",
    files,
    jsonPaths: {
      managed: {},
      "project-private": {},
    },
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("mergeAndWriteFile - file level conflicts", () => {
  it("マーカーなしテキストでローカル変更とテンプレート変更が衝突した場合、コンフリクトマーカーを書き込む", async () => {
    const dir = createTempDir();
    const templatePath = join(dir, "template.md");
    const targetPath = join(dir, "README.md");
    const baseContent = "# Title\nOld line\nFooter\n";
    const localContent = "# Title\nLocal line\nFooter\n";
    const templateContent = "# Title\nTemplate line\nFooter\n";

    writeFileSync(templatePath, templateContent, "utf-8");
    writeFileSync(targetPath, localContent, "utf-8");

    const result = await mergeAndWriteFile(
      templatePath,
      targetPath,
      createMetadata({ "README.md": baseContent }),
      "README.md"
    );

    expect(result.action).toBe("conflicted");
    expect(result.conflicts).toHaveLength(1);

    const merged = readFileSync(targetPath, "utf-8");
    expect(merged).toContain("<<<<<<< LOCAL (your changes)");
    expect(merged).toContain("Local line");
    expect(merged).toContain("Template line");
  });

  it("マーカーなしテキストでローカル未変更ならテンプレート更新を自動適用する", async () => {
    const dir = createTempDir();
    const templatePath = join(dir, "template.md");
    const targetPath = join(dir, "README.md");
    const baseContent = "# Title\nOld line\nFooter\n";
    const templateContent = "# Title\nNew line\nFooter\n";

    writeFileSync(templatePath, templateContent, "utf-8");
    writeFileSync(targetPath, baseContent, "utf-8");

    const result = await mergeAndWriteFile(
      templatePath,
      targetPath,
      createMetadata({ "README.md": baseContent }),
      "README.md"
    );

    expect(result.action).toBe("merged");
    expect(result.conflicts).toHaveLength(0);
    expect(readFileSync(targetPath, "utf-8")).toBe(templateContent);
  });

  it("JSONでローカル変更とテンプレート変更が衝突した場合、ローカル値を保持してコンフリクトを返す", async () => {
    const dir = createTempDir();
    const templatePath = join(dir, "template.json");
    const targetPath = join(dir, "config.json");
    const baseContent = JSON.stringify({ port: 3000 }, null, 2);
    const localContent = JSON.stringify({ port: 4000 }, null, 2);
    const templateContent = JSON.stringify({ port: 5000 }, null, 2);

    writeFileSync(templatePath, `${templateContent}\n`, "utf-8");
    writeFileSync(targetPath, `${localContent}\n`, "utf-8");

    const result = await mergeAndWriteFile(
      templatePath,
      targetPath,
      createMetadata({ "config.json": baseContent }),
      "config.json"
    );

    expect(result.action).toBe("conflicted");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.keyPath).toBe("port");
    expect(JSON.parse(readFileSync(targetPath, "utf-8"))).toEqual({ port: 4000 });
  });
});
