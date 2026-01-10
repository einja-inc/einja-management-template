import { describe, expect, it } from "vitest";
import {
  VALID_CATEGORIES,
  createValidationErrorMessage,
  validateCategories,
} from "./category-validator.js";

describe("category-validator", () => {
  describe("validateCategories", () => {
    it("単一の有効なカテゴリを受け入れる", () => {
      const result = validateCategories("commands");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["commands"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("複数の有効なカテゴリを受け入れる", () => {
      const result = validateCategories("commands,agents,skills");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["commands", "agents", "skills"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("全ての有効なカテゴリを受け入れる", () => {
      const result = validateCategories("commands,agents,skills,docs");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["commands", "agents", "skills", "docs"]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("スペースを含む入力を正しくトリムする", () => {
      const result = validateCategories(" commands , agents , skills ");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["commands", "agents", "skills"]);
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
      const result = validateCategories("commands,invalid,agents");

      expect(result.valid).toBe(false);
      expect(result.validCategories).toEqual(["commands", "agents"]);
      expect(result.invalidCategories).toEqual(["invalid"]);
    });

    it("空文字列を適切に処理する", () => {
      const result = validateCategories("");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual([]);
      expect(result.invalidCategories).toEqual([]);
    });

    it("連続したカンマを適切に処理する", () => {
      const result = validateCategories("commands,,agents");

      expect(result.valid).toBe(true);
      expect(result.validCategories).toEqual(["commands", "agents"]);
      expect(result.invalidCategories).toEqual([]);
    });
  });

  describe("createValidationErrorMessage", () => {
    it("単一の無効なカテゴリのエラーメッセージを生成する", () => {
      const message = createValidationErrorMessage(["invalid-category"]);

      expect(message).toContain("無効なカテゴリ: invalid-category");
      expect(message).toContain("有効なカテゴリは以下のいずれかです:");
      expect(message).toContain("commands, agents, skills, hooks, docs");
    });

    it("複数の無効なカテゴリのエラーメッセージを生成する", () => {
      const message = createValidationErrorMessage(["invalid1", "invalid2", "invalid3"]);

      expect(message).toContain("無効なカテゴリ: invalid1, invalid2, invalid3");
      expect(message).toContain("有効なカテゴリは以下のいずれかです:");
      expect(message).toContain("commands, agents, skills, hooks, docs");
    });
  });

  describe("VALID_CATEGORIES", () => {
    it("全ての有効なカテゴリが定義されている", () => {
      expect(VALID_CATEGORIES).toEqual(["commands", "agents", "skills", "hooks", "docs"]);
    });
  });
});
