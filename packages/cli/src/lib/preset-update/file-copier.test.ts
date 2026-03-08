import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Preset } from "@/types/preset-update.js";
import { FileCopier } from "./file-copier.js";

describe("FileCopier", () => {
  let testDir: string;
  let presetDir: string;
  let copier: FileCopier;
  let preset: Preset;

  beforeEach(() => {
    // テスト用の一時ディレクトリを作成
    testDir = join(process.cwd(), "test-temp", `file-copier-${Date.now()}`);
    presetDir = join(testDir, "preset");
    mkdirSync(testDir, { recursive: true });
    mkdirSync(presetDir, { recursive: true });

    copier = new FileCopier();
    preset = {
      name: "test-preset",
      path: presetDir,
    };
  });

  afterEach(() => {
    // テスト用ディレクトリをクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("shouldSkip", () => {
    it("_プレフィックスで始まるファイルをスキップする", () => {
      expect(copier.shouldSkip(".claude/agents/_custom.md")).toBe(true);
      expect(copier.shouldSkip("_test.md")).toBe(true);
    });

    it(".で始まるファイル（隠しファイル）をスキップする", () => {
      expect(copier.shouldSkip(".DS_Store")).toBe(true);
      expect(copier.shouldSkip(".gitignore")).toBe(true);
    });

    it("通常のファイルはスキップしない", () => {
      expect(copier.shouldSkip(".claude/agents/spec-requirements.md")).toBe(false);
      expect(copier.shouldSkip("docs/einja/steering/terminology.md")).toBe(false);
    });

    it(".vscode/settings.jsonはsingleFileMappingに含まれるためスキップしない", () => {
      expect(copier.shouldSkip(".vscode/settings.json")).toBe(false);
    });
  });

  describe("scanSourceFiles", () => {
    it("プロジェクトの.claude/とdocs/をスキャンする", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      const hooksDir = join(testDir, ".claude", "hooks");
      mkdirSync(agentsDir, { recursive: true });
      mkdirSync(hooksDir, { recursive: true });

      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");
      writeFileSync(join(hooksDir, "pre-commit.sh"), "# pre-commit");

      // スキャン実行
      const files = await copier.scanSourceFiles(testDir);

      // 検証
      expect(files.length).toBe(2);
      expect(files.some((f) => f.relativePath.includes("spec-requirements.md"))).toBe(true);
      expect(files.some((f) => f.relativePath.includes("pre-commit.sh"))).toBe(true);
      expect(files.every((f) => f.category === "agents" || f.category === "hooks")).toBe(true);
    });

    it("_プレフィックスファイルも含めてスキャンされる（フィルタリングはcopyToPresetで行う）", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      mkdirSync(agentsDir, { recursive: true });

      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");
      writeFileSync(join(agentsDir, "_custom.md"), "# custom");

      // スキャン実行
      const files = await copier.scanSourceFiles(testDir);

      // 検証：両方のファイルがスキャンされる
      expect(files.length).toBe(2);
      expect(files.some((f) => f.relativePath.includes("spec-requirements.md"))).toBe(true);
      expect(files.some((f) => f.relativePath.includes("_custom.md"))).toBe(true);
    });

    it("ソースディレクトリが存在しない場合は空配列を返す", async () => {
      // 空のディレクトリでスキャン
      const files = await copier.scanSourceFiles(testDir);

      // 検証
      expect(files).toEqual([]);
    });
  });

  describe("copyToPreset", () => {
    it("ファイルをプリセットの適切なディレクトリにコピーする", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      const hooksDir = join(testDir, ".claude", "hooks");
      mkdirSync(agentsDir, { recursive: true });
      mkdirSync(hooksDir, { recursive: true });

      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");
      writeFileSync(join(hooksDir, "pre-commit.sh"), "# pre-commit");

      // 元のcwdを保存
      const originalCwd = process.cwd();

      try {
        // テストディレクトリに移動
        process.chdir(testDir);

        // コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // 検証：コピー成功
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(2);

        // 検証：ファイルが存在する
        const copiedAgent = join(presetDir, ".claude", "agents", "einja", "spec-requirements.md");
        const copiedHook = join(presetDir, ".claude", "hooks", "pre-commit.sh");

        expect(existsSync(copiedAgent)).toBe(true);
        expect(existsSync(copiedHook)).toBe(true);
      } finally {
        // cwdを元に戻す
        process.chdir(originalCwd);
      }
    });

    it("docs/einja/steering/とdocs/einja/templates/が正しいマッピングでコピーされる", async () => {
      // テストファイルを作成
      const steeringDir = join(testDir, "docs", "einja", "steering");
      const templatesDir = join(testDir, "docs", "einja", "templates");
      mkdirSync(steeringDir, { recursive: true });
      mkdirSync(templatesDir, { recursive: true });

      writeFileSync(join(steeringDir, "terminology.md"), "# terminology");
      writeFileSync(join(templatesDir, "qa-test-template.md"), "# qa template");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // 検証
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(2);

        // 検証：正しいマッピングでコピーされている
        const copiedSteering = join(presetDir, "docs", "einja", "steering", "terminology.md");
        const copiedTemplate = join(presetDir, "docs", "einja", "templates", "qa-test-template.md");

        expect(existsSync(copiedSteering)).toBe(true);
        expect(existsSync(copiedTemplate)).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("ドライランモードではファイルをコピーしない", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // ドライラン実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: true,
          force: false,
        });

        // 検証：結果は返されるが、ファイルは作成されない
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(1);

        const expectedPath = join(presetDir, ".claude", "agents", "einja", "spec-requirements.md");
        expect(existsSync(expectedPath)).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("_プレフィックスファイルはスキップされる", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");
      writeFileSync(join(agentsDir, "_custom.md"), "# custom");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // 検証
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(1);
        expect(result.skipped.length).toBe(1);
        expect(result.skipped[0]).toContain("_custom.md");

        // 検証：_custom.mdはコピーされていない
        const skippedPath = join(presetDir, ".claude", "agents", "einja", "_custom.md");
        expect(existsSync(skippedPath)).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("ネストされたディレクトリ構造も正しくコピーされる", async () => {
      // ネストされたディレクトリを作成
      const nestedDir = join(testDir, ".claude", "agents", "subdir");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "nested-file.md"), "# nested");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // 検証
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(1);

        // 検証：ネストされた構造も保持される
        const nestedCopied = join(
          presetDir,
          ".claude",
          "agents",
          "einja",
          "subdir",
          "nested-file.md"
        );
        expect(existsSync(nestedCopied)).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("skillsカテゴリはeinja-プレフィックスのみコピーされること", async () => {
      // Given: einja-プレフィックスとそれ以外のスキルを作成
      const einjaSkillDir = join(testDir, ".claude", "skills", "einja-coding-standards");
      const customSkillDir = join(testDir, ".claude", "skills", "custom-skill");

      mkdirSync(einjaSkillDir, { recursive: true });
      mkdirSync(customSkillDir, { recursive: true });

      writeFileSync(join(einjaSkillDir, "SKILL.md"), "# Einja Skill");
      writeFileSync(join(customSkillDir, "SKILL.md"), "# Custom Skill");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // When: コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // Then: einja-プレフィックスのみがコピーされる
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(1);
        expect(result.files[0].source).toContain("einja-coding-standards");

        // 検証：einja-スキルのみが存在する
        const einjaSkillPath = join(
          presetDir,
          ".claude",
          "skills",
          "einja-coding-standards",
          "SKILL.md"
        );
        const customSkillPath = join(presetDir, ".claude", "skills", "custom-skill", "SKILL.md");

        expect(existsSync(einjaSkillPath)).toBe(true);
        expect(existsSync(customSkillPath)).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("全ディレクトリマッピングが正しく適用される（統合テスト）", async () => {
      // 全カテゴリのテストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      const skillsDir = join(testDir, ".claude", "skills", "einja-coding-standards");
      const steeringDir = join(testDir, "docs", "einja", "steering");
      const templatesDir = join(testDir, "docs", "einja", "templates");

      mkdirSync(agentsDir, { recursive: true });
      mkdirSync(skillsDir, { recursive: true });
      mkdirSync(steeringDir, { recursive: true });
      mkdirSync(templatesDir, { recursive: true });

      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");
      writeFileSync(join(skillsDir, "SKILL.md"), "# einja skill");
      writeFileSync(join(steeringDir, "terminology.md"), "# terminology");
      writeFileSync(join(templatesDir, "qa-test-template.md"), "# qa template");

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // 検証：全ファイルがコピーされている
        expect(result.success).toBe(true);
        expect(result.files.length).toBe(4);

        // 検証：各ファイルが正しいパスにコピーされている
        const expectedPaths = [
          join(presetDir, ".claude", "agents", "einja", "spec-requirements.md"),
          join(presetDir, ".claude", "skills", "einja-coding-standards", "SKILL.md"),
          join(presetDir, "docs", "einja", "steering", "terminology.md"),
          join(presetDir, "docs", "einja", "templates", "qa-test-template.md"),
        ];

        for (const expectedPath of expectedPaths) {
          expect(existsSync(expectedPath)).toBe(true);
        }

        // 検証：マッピングが正しい（einja/サブディレクトリまたはeinja-プレフィックスに配置されている）
        expect(result.files[0].destination).toContain("/einja/");
        expect(result.files[1].destination).toContain("/einja-");
        expect(result.files[2].destination).toContain("/einja/");
        expect(result.files[3].destination).toContain("/einja/");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("ファイル書き込みエラーが発生した場合は詳細なエラーメッセージを返す", async () => {
      // テストファイルを作成
      const agentsDir = join(testDir, ".claude", "agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "spec-requirements.md"), "# requirements");

      // 書き込み不可能なプリセットディレクトリを使用（存在しないディレクトリの子パス）
      const invalidPreset: Preset = {
        name: "invalid",
        path: "/nonexistent/path/to/preset",
      };

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // コピー実行（エラーが発生するはず）
        await expect(
          copier.copyToPreset({
            preset: invalidPreset,
            dryRun: false,
            force: false,
          })
        ).rejects.toThrow(/ファイルの書き込みに失敗しました/);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it(".vscode/settings.jsonがsingleFileMappingでコピーされること", async () => {
      // Given: .vscode/settings.jsonを作成
      const vscodeDir = join(testDir, ".vscode");
      mkdirSync(vscodeDir, { recursive: true });
      writeFileSync(join(vscodeDir, "settings.json"), '{"test": true}');

      const originalCwd = process.cwd();

      try {
        process.chdir(testDir);

        // When: コピー実行
        const result = await copier.copyToPreset({
          preset,
          dryRun: false,
          force: false,
        });

        // Then: コピーされている
        const copiedFile = result.files.find((f) => f.source === ".vscode/settings.json");
        expect(copiedFile).toBeDefined();
        expect(existsSync(join(presetDir, ".vscode", "settings.json"))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
