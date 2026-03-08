import { describe, expect, it } from "vitest";
import {
  CATEGORY_DESCRIPTIONS,
  VALID_CATEGORIES,
  createValidationErrorMessage,
  validateCategories,
} from "./category-validator.js";

describe("category-validator", () => {
  describe("validateCategories", () => {
    it("単一の有効なカテゴリを受け入れる", () => {
      const result = validateCategories("agents");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["agents"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("複数の有効なカテゴリを受け入れる", () => {
      const result = validateCategories("agents,skills,hooks");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["agents", "skills", "hooks"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("全ての有効なカテゴリを受け入れる", () => {
      const result = validateCategories("agents,skills,docs,hooks");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["agents", "skills", "docs", "hooks"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("スペースを含む入力を正しくトリムする", () => {
      const result = validateCategories(" agents , skills , hooks ");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["agents", "skills", "hooks"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("単一の無効なカテゴリを拒否する", () => {
      const result = validateCategories("invalid-category");

      expect(result.valid).toBe(false);
      expect(result.validCategories).toEqual([]);
      expect(result.invalidCategories).toEqual(["invalid-category"]);
    });

    it("複数の無効なカテゴリを拒否する", () => {
      const result = validateCategories("invalid1,invalid2");

      expect(result.valid).toBe(false);
      expect(result.validCategories).toEqual([]);
      expect(result.invalidCategories).toEqual(["invalid1", "invalid2"]);
    });

    it("有効と無効が混在する場合、無効として判定する", () => {
      const result = validateCategories("agents,invalid,skills");

      expect(result.valid).toBe(false);
      expect(result.validCategories).toEqual(["agents", "skills"]);
      expect(result.invalidCategories).toEqual(["invalid"]);
    });

    it("空文字列を適切に処理する", () => {
      const result = validateCategories("");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual([]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("連続したカンマを適切に処理する", () => {
      const result = validateCategories("agents,,skills");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["agents", "skills"]);
      expect(result.invalidCategories).toEqual([]);
    });
  });

  describe("createValidationErrorMessage", () => {
    it("単一の無効なカテゴリのエラーメッセージを生成する", () => {
      const message = createValidationErrorMessage(["invalid-category"]);

      expect(message).toContain("無効なカテゴリ: invalid-category");
      expect(message).toContain("有効なカテゴリは以下のいずれかです:");
      expect(message).toContain("agents - Claude Code エージェント");
      expect(message).toContain("scripts - ユーティリティスクリプト");
      expect(message).toContain("tools - 開発ツール設定");
    });

    it("複数の無効なカテゴリのエラーメッセージを生成する", () => {
      const message = createValidationErrorMessage(["invalid1", "invalid2", "invalid3"]);

      expect(message).toContain("無効なカテゴリ: invalid1, invalid2, invalid3");
      expect(message).toContain("有効なカテゴリは以下のいずれかです:");
      expect(message).toContain("agents - Claude Code エージェント");
      expect(message).toContain("scripts - ユーティリティスクリプト");
      expect(message).toContain("tools - 開発ツール設定");
    });
  });

  describe("VALID_CATEGORIES", () => {
    it("全ての有効なカテゴリが定義されている", () => {
      expect(VALID_CATEGORIES).toEqual(["agents", "skills", "hooks", "docs", "scripts", "env", "tools", "claude-md", "root-config", "claude-config"]);
    });
  });

  describe("CATEGORY_DESCRIPTIONS", () => {
    it("全てのVALID_CATEGORIESに対応する説明が定義されている", () => {
      for (const category of VALID_CATEGORIES) {
        expect(CATEGORY_DESCRIPTIONS[category]).toBeDefined();
        expect(typeof CATEGORY_DESCRIPTIONS[category]).toBe("string");
      }
    });
  });

  describe("新カテゴリのバリデーション", () => {
    it("claude-mdカテゴリが有効として受け入れられること", () => {
      const result = validateCategories("claude-md");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["claude-md"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("root-configカテゴリが有効として受け入れられること", () => {
      const result = validateCategories("root-config");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["root-config"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("claude-configカテゴリが有効として受け入れられること", () => {
      const result = validateCategories("claude-config");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["claude-config"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("新カテゴリのCATEGORY_DESCRIPTIONSが定義されていること", () => {
      expect(CATEGORY_DESCRIPTIONS["claude-md"]).toBe("Claude Code 設定ファイル (CLAUDE.md, AGENTS.md)");
      expect(CATEGORY_DESCRIPTIONS["root-config"]).toBe("ルート設定 (package.json, .mcp.json)");
      expect(CATEGORY_DESCRIPTIONS["claude-config"]).toBe("Claude Code 設定 (.claude/settings.json)");
    });
  });
});
