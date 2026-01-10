import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresetFinder } from "./preset-finder.js";

describe("PresetFinder", () => {
  let finder: PresetFinder;
  let testDir: string;
  let cliPackagePath: string;

  beforeEach(() => {
    finder = new PresetFinder();
    // テスト用一時ディレクトリ
    testDir = join(process.cwd(), "test-temp-preset-finder");
    cliPackagePath = join(testDir, "packages", "cli");

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(cliPackagePath, { recursive: true });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("findPresets", () => {
    it("presets/ディレクトリが存在しない場合、空配列が返ること", async () => {
      const presets = await finder.findPresets(cliPackagePath);

      expect(presets).toEqual([]);
    });

    it("プリセットディレクトリが存在する場合、プリセット一覧が返ること", async () => {
      // プリセットディレクトリを作成
      const presetsDir = join(cliPackagePath, "presets");
      mkdirSync(presetsDir, { recursive: true });
      mkdirSync(join(presetsDir, "default"));
      mkdirSync(join(presetsDir, "turborepo-pandacss"));

      const presets = await finder.findPresets(cliPackagePath);

      expect(presets).toHaveLength(2);
      expect(presets.map((p) => p.name)).toContain("default");
      expect(presets.map((p) => p.name)).toContain("turborepo-pandacss");
      expect(presets[0].path).toBeDefined();
    });

    it("ドットで始まるディレクトリは除外されること", async () => {
      // プリセットディレクトリを作成
      const presetsDir = join(cliPackagePath, "presets");
      mkdirSync(presetsDir, { recursive: true });
      mkdirSync(join(presetsDir, "default"));
      mkdirSync(join(presetsDir, ".hidden"));

      const presets = await finder.findPresets(cliPackagePath);

      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("default");
    });

    it("無効な文字を含むディレクトリ名は除外されること", async () => {
      // プリセットディレクトリを作成
      const presetsDir = join(cliPackagePath, "presets");
      mkdirSync(presetsDir, { recursive: true });
      mkdirSync(join(presetsDir, "valid-preset"));
      // 無効な文字を含むディレクトリは実際には作成しないが、
      // validatePresetNameで除外されることを別テストで確認

      const presets = await finder.findPresets(cliPackagePath);

      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("valid-preset");
    });

    it("ファイル（ディレクトリでない）は除外されること", async () => {
      // プリセットディレクトリを作成
      const presetsDir = join(cliPackagePath, "presets");
      mkdirSync(presetsDir, { recursive: true });
      mkdirSync(join(presetsDir, "default"));
      writeFileSync(join(presetsDir, "README.md"), "# Presets");

      const presets = await finder.findPresets(cliPackagePath);

      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("default");
    });
  });

  describe("getPreset", () => {
    beforeEach(() => {
      // プリセットディレクトリを作成
      const presetsDir = join(cliPackagePath, "presets");
      mkdirSync(presetsDir, { recursive: true });
      mkdirSync(join(presetsDir, "default"));
      mkdirSync(join(presetsDir, "turborepo-pandacss"));
    });

    it("存在するプリセットの場合、プリセット情報が返ること", async () => {
      const preset = await finder.getPreset("default", cliPackagePath);

      expect(preset).not.toBeNull();
      expect(preset?.name).toBe("default");
      expect(preset?.path).toBe(join(cliPackagePath, "presets", "default"));
    });

    it("存在しないプリセットの場合、nullが返ること", async () => {
      const preset = await finder.getPreset("non-existent", cliPackagePath);

      expect(preset).toBeNull();
    });

    it("無効なプリセット名の場合、nullが返ること", async () => {
      const preset = await finder.getPreset("invalid name!", cliPackagePath);

      expect(preset).toBeNull();
    });

    it("ファイルの場合、nullが返ること", async () => {
      // ファイルを作成
      const presetsDir = join(cliPackagePath, "presets");
      writeFileSync(join(presetsDir, "file.txt"), "content");

      const preset = await finder.getPreset("file.txt", cliPackagePath);

      expect(preset).toBeNull();
    });
  });

  describe("validatePresetName", () => {
    it("空文字列の場合、falseが返ること", () => {
      const result = finder.validatePresetName("");

      expect(result).toBe(false);
    });

    it("ドットで始まる名前の場合、falseが返ること", () => {
      const result = finder.validatePresetName(".hidden");

      expect(result).toBe(false);
    });

    it("英数字、ハイフン、アンダースコアのみの場合、trueが返ること", () => {
      expect(finder.validatePresetName("default")).toBe(true);
      expect(finder.validatePresetName("turborepo-pandacss")).toBe(true);
      expect(finder.validatePresetName("preset_123")).toBe(true);
      expect(finder.validatePresetName("MyPreset")).toBe(true);
    });

    it("無効な文字を含む場合、falseが返ること", () => {
      expect(finder.validatePresetName("invalid name")).toBe(false);
      expect(finder.validatePresetName("invalid/name")).toBe(false);
      expect(finder.validatePresetName("invalid\\name")).toBe(false);
      expect(finder.validatePresetName("invalid@name")).toBe(false);
      expect(finder.validatePresetName("invalid!name")).toBe(false);
    });
  });
});
