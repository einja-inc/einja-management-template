import { describe, expect, it } from "vitest";
import { MarkerProcessor } from "./marker-processor.js";

describe("MarkerProcessor", () => {
  const processor = new MarkerProcessor();

  describe("parseMarkers", () => {
    it("マーカーが存在しない場合、全体をunmanagedセクションとして返すこと", () => {
      const content = `行1
行2
行3`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(1);
      expect(sections[0]).toEqual({
        type: "unmanaged",
        startLine: 1,
        endLine: 3,
        content: "行1\n行2\n行3",
      });
    });

    it("Markdownマーカーで囲まれたセクションをmanagedとして認識すること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
行2`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[0].content).toBe("行1");
      expect(sections[1].type).toBe("managed");
      expect(sections[1].content).toBe(
        "<!-- @einja:managed:start -->\n管理セクション\n<!-- @einja:managed:end -->"
      );
      expect(sections[2].type).toBe("unmanaged");
      expect(sections[2].content).toBe("行2");
    });

    it("YAMLマーカーで囲まれたセクションをmanagedとして認識すること", () => {
      const content = `設定1: value1
# @einja:managed:start
管理設定: value
# @einja:managed:end
設定2: value2`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("managed");
      expect(sections[1].content).toBe(
        "# @einja:managed:start\n管理設定: value\n# @einja:managed:end"
      );
      expect(sections[2].type).toBe("unmanaged");
    });

    it("複数のmanagedセクションを正しく分離すること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション1
<!-- @einja:managed:end -->
行2
<!-- @einja:managed:start -->
管理セクション2
<!-- @einja:managed:end -->
行3`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(5);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("managed");
      expect(sections[2].type).toBe("unmanaged");
      expect(sections[3].type).toBe("managed");
      expect(sections[4].type).toBe("unmanaged");
    });

    it("行番号が正しく設定されること", () => {
      const content = `行1
行2
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
行3`;

      const sections = processor.parseMarkers(content);

      expect(sections[0].startLine).toBe(1);
      expect(sections[0].endLine).toBe(2);
      expect(sections[1].startLine).toBe(3);
      expect(sections[1].endLine).toBe(5);
      expect(sections[2].startLine).toBe(6);
      expect(sections[2].endLine).toBe(6);
    });
  });

  describe("validateMarkers", () => {
    it("正しいマーカーペアの場合、validがtrueであること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("startマーカーのみの場合、unpaired_startエラーを返すこと", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("unpaired_start");
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].message).toBe("対応する@einja:managed:endが見つかりません");
    });

    it("endマーカーのみの場合、unpaired_endエラーを返すこと", () => {
      const content = `行1
管理セクション
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("unpaired_end");
      expect(result.errors[0].line).toBe(3);
      expect(result.errors[0].message).toBe("対応する@einja:managed:startが見つかりません");
    });

    it("ネストしたマーカーの場合、nestedエラーを返すこと", () => {
      const content = `行1
<!-- @einja:managed:start -->
外側
<!-- @einja:managed:start -->
内側
<!-- @einja:managed:end -->
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      // ネストマーカーのエラーと、2つ目のendマーカーの対応なしエラーの2つ
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].type).toBe("nested");
      expect(result.errors[0].line).toBe(4);
      expect(result.errors[0].message).toBe("@einja:managedマーカー内に@einja:managedマーカーをネストすることは許可されていません");
      expect(result.errors[1].type).toBe("unpaired_end");
      expect(result.errors[1].line).toBe(7);
    });

    it("複数のエラーを検出できること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション1
行2
<!-- @einja:managed:end -->
行3
<!-- @einja:managed:start -->
管理セクション2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      // 最初のペアは正しいが、2つ目のstartに対応するendがない
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("unpaired_start");
      expect(result.errors[0].line).toBe(7);
    });
  });

  describe("replaceManaged", () => {
    it("managedセクションがテンプレート版で上書きされること", () => {
      const localContent = `行1
<!-- @einja:managed:start -->
ローカル管理セクション
<!-- @einja:managed:end -->
行2`;

      const templateContent = `行1
<!-- @einja:managed:start -->
テンプレート管理セクション
<!-- @einja:managed:end -->
行2`;

      const localSections = processor.parseMarkers(localContent);
      const result = processor.replaceManaged(localSections, templateContent);

      expect(result).toContain("テンプレート管理セクション");
      expect(result).not.toContain("ローカル管理セクション");
    });

    it("unmanagedセクションはローカル版が保持されること", () => {
      const localContent = `ローカル行1
<!-- @einja:managed:start -->
ローカル管理セクション
<!-- @einja:managed:end -->
ローカル行2`;

      const templateContent = `テンプレート行1
<!-- @einja:managed:start -->
テンプレート管理セクション
<!-- @einja:managed:end -->
テンプレート行2`;

      const localSections = processor.parseMarkers(localContent);
      const result = processor.replaceManaged(localSections, templateContent);

      expect(result).toContain("ローカル行1");
      expect(result).toContain("ローカル行2");
      expect(result).toContain("テンプレート管理セクション");
      expect(result).not.toContain("テンプレート行1");
      expect(result).not.toContain("テンプレート行2");
    });

    it("複数のmanagedセクションが正しく置換されること", () => {
      const localContent = `ローカル行1
<!-- @einja:managed:start -->
ローカル管理1
<!-- @einja:managed:end -->
ローカル行2
<!-- @einja:managed:start -->
ローカル管理2
<!-- @einja:managed:end -->
ローカル行3`;

      const templateContent = `テンプレート行1
<!-- @einja:managed:start -->
テンプレート管理1
<!-- @einja:managed:end -->
テンプレート行2
<!-- @einja:managed:start -->
テンプレート管理2
<!-- @einja:managed:end -->
テンプレート行3`;

      const localSections = processor.parseMarkers(localContent);
      const result = processor.replaceManaged(localSections, templateContent);

      expect(result).toContain("テンプレート管理1");
      expect(result).toContain("テンプレート管理2");
      expect(result).toContain("ローカル行1");
      expect(result).toContain("ローカル行2");
      expect(result).toContain("ローカル行3");
      expect(result).not.toContain("ローカル管理1");
      expect(result).not.toContain("ローカル管理2");
    });

    it("マーカーがない場合、ローカル版がそのまま保持されること", () => {
      const localContent = `ローカル行1
ローカル行2
ローカル行3`;

      const templateContent = `テンプレート行1
テンプレート行2
テンプレート行3`;

      const localSections = processor.parseMarkers(localContent);
      const result = processor.replaceManaged(localSections, templateContent);

      expect(result).toBe(localContent);
    });

    it("テンプレート側でマーカーが削除された場合、ローカル版が保持されること", () => {
      const localContent = `ローカル行1
<!-- @einja:managed:start -->
ローカル管理セクション
<!-- @einja:managed:end -->
ローカル行2`;

      const templateContent = `テンプレート行1
テンプレート行2`;

      const localSections = processor.parseMarkers(localContent);
      const result = processor.replaceManaged(localSections, templateContent);

      // テンプレート側にmanagedセクションがない場合、ローカルのmanagedセクションを保持
      expect(result).toContain("ローカル管理セクション");
      expect(result).toContain("ローカル行1");
      expect(result).toContain("ローカル行2");
    });
  });

  describe("parseMarkers - seed対応", () => {
    it("seedマーカーで囲まれたセクションをseedとして認識し、IDを抽出すること", () => {
      const content = `行1
<!-- @einja:seed:start id="test-seed" -->
シードセクション
<!-- @einja:seed:end -->
行2`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("seed");
      expect(sections[1].id).toBe("test-seed");
      expect(sections[1].content).toBe(
        '<!-- @einja:seed:start id="test-seed" -->\nシードセクション\n<!-- @einja:seed:end -->'
      );
      expect(sections[2].type).toBe("unmanaged");
    });

    it("managedマーカーにID属性がある場合、IDを抽出すること", () => {
      const content = `行1
<!-- @einja:managed:start id="managed-with-id" -->
管理セクション
<!-- @einja:managed:end -->
行2`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(3);
      expect(sections[1].type).toBe("managed");
      expect(sections[1].id).toBe("managed-with-id");
    });

    it("managedとseedが混在する場合、正しく分離されること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション1
<!-- @einja:managed:end -->
行2
<!-- @einja:seed:start id="seed-1" -->
シードセクション1
<!-- @einja:seed:end -->
行3`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(5);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("managed");
      expect(sections[2].type).toBe("unmanaged");
      expect(sections[3].type).toBe("seed");
      expect(sections[3].id).toBe("seed-1");
      expect(sections[4].type).toBe("unmanaged");
    });
  });

  describe("validateMarkers - seed対応", () => {
    it("seedマーカーのペアが正しい場合、validがtrueであること", () => {
      const content = `行1
<!-- @einja:seed:start id="test-seed" -->
シードセクション
<!-- @einja:seed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("seedマーカーにID属性がない場合、seed_without_idエラーを返すこと", () => {
      const content = `行1
<!-- @einja:seed:start -->
シードセクション
<!-- @einja:seed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("seed_without_id");
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].message).toBe("@einja:seedマーカーにはid属性が必須です");
    });

    it("ID属性が重複している場合、duplicate_idエラーを返すこと", () => {
      const content = `行1
<!-- @einja:seed:start id="duplicate" -->
シードセクション1
<!-- @einja:seed:end -->
行2
<!-- @einja:seed:start id="duplicate" -->
シードセクション2
<!-- @einja:seed:end -->
行3`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duplicate_id");
      expect(result.errors[0].line).toBe(6);
      expect(result.errors[0].message).toBe('ID "duplicate" が重複しています');
    });

    it("managed内にseedマーカーがネストされている場合、nestedエラーを返すこと", () => {
      const content = `行1
<!-- @einja:managed:start -->
外側
<!-- @einja:seed:start id="nested-seed" -->
内側
<!-- @einja:seed:end -->
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const nestedError = result.errors.find((e) => e.type === "nested");
      expect(nestedError).toBeDefined();
      expect(nestedError?.line).toBe(4);
      expect(nestedError?.message).toContain("ネスト");
    });

    it("seed内にmanagedマーカーがネストされている場合、nestedエラーを返すこと", () => {
      const content = `行1
<!-- @einja:seed:start id="outer-seed" -->
外側
<!-- @einja:managed:start -->
内側
<!-- @einja:managed:end -->
<!-- @einja:seed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      const nestedError = result.errors.find((e) => e.type === "nested");
      expect(nestedError).toBeDefined();
      expect(nestedError?.line).toBe(4);
      expect(nestedError?.message).toContain("ネスト");
    });

    it("seedの開始と終了の型が一致しない場合、unpaired_endエラーを返すこと", () => {
      const content = `行1
<!-- @einja:seed:start id="test-seed" -->
シードセクション
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      const unpairedError = result.errors.find((e) => e.type === "unpaired_end");
      expect(unpairedError).toBeDefined();
      expect(unpairedError?.line).toBe(4);
    });
  });
});
