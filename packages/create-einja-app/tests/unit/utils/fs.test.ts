import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeWithStrategy,
  ensureDir,
  appendToGitignore,
  fileExists,
} from "../../../src/utils/fs.js";

describe("fs utils", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("writeWithStrategy", () => {
    it("新規ファイルに書き込むと、ファイルが作成される", () => {
      // Given: 存在しないファイルパス
      const filePath = join(testDir, "new-file.txt");
      const content = "test content";

      // When: writeWithStrategy実行
      const result = writeWithStrategy(filePath, content, "overwrite");

      // Then: ファイルが作成される
      expect(result).toBe(true);
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, "utf-8")).toBe(content);
    });

    it("overwrite戦略で既存ファイルを上書きすると、新しい内容になる", () => {
      // Given: 既存ファイル
      const filePath = join(testDir, "existing.txt");
      writeFileSync(filePath, "old content", "utf-8");

      // When: overwrite戦略で書き込み
      const newContent = "new content";
      const result = writeWithStrategy(filePath, newContent, "overwrite");

      // Then: ファイルが上書きされる
      expect(result).toBe(true);
      expect(readFileSync(filePath, "utf-8")).toBe(newContent);
    });

    it("merge戦略で既存ファイルに追記すると、両方の内容が含まれる", () => {
      // Given: 既存ファイル
      const filePath = join(testDir, "existing.txt");
      const existingContent = "existing line";
      writeFileSync(filePath, existingContent, "utf-8");

      // When: merge戦略で書き込み
      const newContent = "new line";
      const result = writeWithStrategy(filePath, newContent, "merge");

      // Then: 既存内容と新規内容の両方が含まれる
      expect(result).toBe(true);
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain(existingContent);
      expect(content).toContain(newContent);
    });

    it("merge戦略で重複内容を追記しようとすると、重複しない", () => {
      // Given: 既存ファイルに同じ内容がある
      const filePath = join(testDir, "existing.txt");
      const content = "same content";
      writeFileSync(filePath, content, "utf-8");

      // When: 同じ内容をmerge戦略で書き込み
      const result = writeWithStrategy(filePath, content, "merge");

      // Then: 内容が重複しない
      expect(result).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      const matches = fileContent.match(/same content/g);
      expect(matches?.length).toBe(1);
    });

    it("skip戦略で既存ファイルがある場合、書き込みがスキップされる", () => {
      // Given: 既存ファイル
      const filePath = join(testDir, "existing.txt");
      const existingContent = "existing content";
      writeFileSync(filePath, existingContent, "utf-8");

      // When: skip戦略で書き込み
      const newContent = "new content";
      const result = writeWithStrategy(filePath, newContent, "skip");

      // Then: 書き込みがスキップされ、既存内容が保持される
      expect(result).toBe(false);
      expect(readFileSync(filePath, "utf-8")).toBe(existingContent);
    });

    it("ネストしたディレクトリに書き込むと、親ディレクトリも作成される", () => {
      // Given: 存在しないネストしたパス
      const filePath = join(testDir, "nested", "dir", "file.txt");
      const content = "nested file content";

      // When: writeWithStrategy実行
      const result = writeWithStrategy(filePath, content, "overwrite");

      // Then: 親ディレクトリも作成され、ファイルが作成される
      expect(result).toBe(true);
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, "utf-8")).toBe(content);
    });
  });

  describe("ensureDir", () => {
    it("存在しないディレクトリパスを渡すと、ディレクトリが作成される", () => {
      // Given: 存在しないディレクトリパス
      const dirPath = join(testDir, "new-directory");

      // When: ensureDir実行
      ensureDir(dirPath);

      // Then: ディレクトリが作成される
      expect(existsSync(dirPath)).toBe(true);
    });

    it("既に存在するディレクトリパスを渡すと、エラーにならない", () => {
      // Given: 既存ディレクトリ
      const dirPath = join(testDir, "existing-directory");
      ensureDir(dirPath);

      // When: 再度ensureDir実行
      // Then: エラーが発生しない
      expect(() => ensureDir(dirPath)).not.toThrow();
    });

    it("ネストしたディレクトリパスを渡すと、親ディレクトリも作成される", () => {
      // Given: 存在しないネストしたディレクトリパス
      const dirPath = join(testDir, "parent", "child", "grandchild");

      // When: ensureDir実行
      ensureDir(dirPath);

      // Then: 全てのディレクトリが作成される
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  describe("appendToGitignore", () => {
    it(".gitignoreが存在しない場合、新規作成して行が追加される", () => {
      // Given: .gitignoreが存在しない
      const line = ".envrc";

      // When: appendToGitignore実行
      appendToGitignore(testDir, line);

      // Then: .gitignoreが作成され、行が含まれる
      const gitignorePath = join(testDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(true);
      expect(readFileSync(gitignorePath, "utf-8")).toContain(line);
    });

    it(".gitignoreが存在する場合、行が追記される", () => {
      // Given: 既存の.gitignore
      const gitignorePath = join(testDir, ".gitignore");
      const existingLine = "node_modules/";
      writeFileSync(gitignorePath, `${existingLine}\n`, "utf-8");

      // When: 新しい行を追加
      const newLine = ".envrc";
      appendToGitignore(testDir, newLine);

      // Then: 既存行と新規行の両方が含まれる
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(existingLine);
      expect(content).toContain(newLine);
    });

    it("既に存在する行を追加しようとすると、重複しない", () => {
      // Given: 既存の.gitignoreに同じ行がある
      const gitignorePath = join(testDir, ".gitignore");
      const line = ".envrc";
      writeFileSync(gitignorePath, `${line}\n`, "utf-8");

      // When: 同じ行を追加
      appendToGitignore(testDir, line);

      // Then: 行が重複しない
      const content = readFileSync(gitignorePath, "utf-8");
      const matches = content.match(/\.envrc/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe("fileExists", () => {
    it("存在するファイルパスを渡すと、trueが返る", () => {
      // Given: 存在するファイル
      const filePath = join(testDir, "existing.txt");
      writeFileSync(filePath, "content", "utf-8");

      // When: fileExists実行
      const result = fileExists(filePath);

      // Then: trueが返る
      expect(result).toBe(true);
    });

    it("存在しないファイルパスを渡すと、falseが返る", () => {
      // Given: 存在しないファイル
      const filePath = join(testDir, "non-existing.txt");

      // When: fileExists実行
      const result = fileExists(filePath);

      // Then: falseが返る
      expect(result).toBe(false);
    });
  });
});
