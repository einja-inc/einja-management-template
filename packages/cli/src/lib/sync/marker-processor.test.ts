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
      expect(result.errors[0].message).toBe(
        "@einja:managedマーカー内に@einja:managedマーカーをネストすることは許可されていません"
      );
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

  describe("parseMarkers - project-private対応", () => {
    it("project-privateマーカーで囲まれたセクションをproject-privateとして認識し、IDを抽出すること", () => {
      const content = `行1
<!-- @einja:project-private:start id="test-project-private" -->
プロジェクト固有セクション
<!-- @einja:project-private:end -->
行2`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(3);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("project-private");
      expect(sections[1].id).toBe("test-project-private");
      expect(sections[1].content).toBe(
        '<!-- @einja:project-private:start id="test-project-private" -->\nプロジェクト固有セクション\n<!-- @einja:project-private:end -->'
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

    it("managedとproject-privateが混在する場合、正しく分離されること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション1
<!-- @einja:managed:end -->
行2
<!-- @einja:project-private:start id="pp-1" -->
プロジェクト固有セクション1
<!-- @einja:project-private:end -->
行3`;

      const sections = processor.parseMarkers(content);

      expect(sections).toHaveLength(5);
      expect(sections[0].type).toBe("unmanaged");
      expect(sections[1].type).toBe("managed");
      expect(sections[2].type).toBe("unmanaged");
      expect(sections[3].type).toBe("project-private");
      expect(sections[3].id).toBe("pp-1");
      expect(sections[4].type).toBe("unmanaged");
    });
  });

  describe("validateMarkers - project-private対応", () => {
    it("project-privateマーカーのペアが正しい場合、validがtrueであること", () => {
      const content = `行1
<!-- @einja:project-private:start id="test-project-private" -->
プロジェクト固有セクション
<!-- @einja:project-private:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("project-privateマーカーにID属性がない場合、project_private_without_idエラーを返すこと", () => {
      const content = `行1
<!-- @einja:project-private:start -->
プロジェクト固有セクション
<!-- @einja:project-private:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("project_private_without_id");
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].message).toBe("@einja:project-privateマーカーにはid属性が必須です");
    });

    it("ID属性が重複している場合、duplicate_idエラーを返すこと", () => {
      const content = `行1
<!-- @einja:project-private:start id="duplicate" -->
プロジェクト固有セクション1
<!-- @einja:project-private:end -->
行2
<!-- @einja:project-private:start id="duplicate" -->
プロジェクト固有セクション2
<!-- @einja:project-private:end -->
行3`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("duplicate_id");
      expect(result.errors[0].line).toBe(6);
      expect(result.errors[0].message).toBe('ID "duplicate" が重複しています');
    });

    it("managed内にproject-privateマーカーがネストされている場合、nestedエラーを返すこと", () => {
      const content = `行1
<!-- @einja:managed:start -->
外側
<!-- @einja:project-private:start id="nested-pp" -->
内側
<!-- @einja:project-private:end -->
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

    it("project-private内にmanagedマーカーがネストされている場合、nestedエラーを返すこと", () => {
      const content = `行1
<!-- @einja:project-private:start id="outer-pp" -->
外側
<!-- @einja:managed:start -->
内側
<!-- @einja:managed:end -->
<!-- @einja:project-private:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      const nestedError = result.errors.find((e) => e.type === "nested");
      expect(nestedError).toBeDefined();
      expect(nestedError?.line).toBe(4);
      expect(nestedError?.message).toContain("ネスト");
    });

    it("project-privateの開始と終了の型が一致しない場合、unpaired_endエラーを返すこと", () => {
      const content = `行1
<!-- @einja:project-private:start id="test-pp" -->
プロジェクト固有セクション
<!-- @einja:managed:end -->
行2`;

      const result = processor.validateMarkers(content);

      expect(result.valid).toBe(false);
      const unpairedError = result.errors.find((e) => e.type === "unpaired_end");
      expect(unpairedError).toBeDefined();
      expect(unpairedError?.line).toBe(4);
    });
  });

  describe("extractProjectPrivateSections", () => {
    it("project-privateセクションを抽出できること", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
<!-- @einja:project-private:start id="test-pp" -->
プロジェクト固有内容
<!-- @einja:project-private:end -->`;

      const ppSections = processor.extractProjectPrivateSections(content);

      expect(ppSections).toHaveLength(1);
      expect(ppSections[0].id).toBe("test-pp");
      expect(ppSections[0].content).toContain("プロジェクト固有内容");
    });
  });

  describe("stripProjectPrivateSections", () => {
    it("project-privateセクションを除去した本文を返すこと", () => {
      const content = `行1
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
行2
<!-- @einja:project-private:start id="test-pp" -->
プロジェクト固有内容
<!-- @einja:project-private:end -->`;

      const stripped = processor.stripProjectPrivateSections(content);

      expect(stripped).toContain("行1");
      expect(stripped).toContain("管理セクション");
      expect(stripped).toContain("行2");
      expect(stripped).not.toContain("プロジェクト固有内容");
      expect(stripped).not.toContain("@einja:project-private");
    });
  });

  describe("reattachProjectPrivateSections", () => {
    it("project-privateセクションを本文末尾に再付加すること", () => {
      const body = "行1\n行2";
      const ppSections = [{
        id: "test-pp",
        content: '<!-- @einja:project-private:start id="test-pp" -->\nプロジェクト固有内容\n<!-- @einja:project-private:end -->'
      }];

      const result = processor.reattachProjectPrivateSections(body, ppSections);

      expect(result).toContain("行1");
      expect(result).toContain("行2");
      expect(result).toContain("プロジェクト固有内容");
    });

    it("空のproject-privateセクション配列の場合、本文をそのまま返すこと", () => {
      const body = "行1\n行2";
      const result = processor.reattachProjectPrivateSections(body, []);
      expect(result).toBe(body);
    });
  });

  describe("hasManagedMarkers", () => {
    it("managedマーカーが含まれる場合trueを返すこと", () => {
      const content = "<!-- @einja:managed:start -->\n内容\n<!-- @einja:managed:end -->";
      expect(processor.hasManagedMarkers(content)).toBe(true);
    });

    it("managedマーカーが含まれない場合falseを返すこと", () => {
      const content = "通常のテキスト";
      expect(processor.hasManagedMarkers(content)).toBe(false);
    });
  });

  describe("migrateLegacySeedMarkers", () => {
    it("旧@einja:seedマーカーを@einja:project-privateに変換すること", () => {
      const content = '<!-- @einja:seed:start id="old-seed" -->\n内容\n<!-- @einja:seed:end -->';
      const migrated = processor.migrateLegacySeedMarkers(content);

      expect(migrated).toContain("@einja:project-private:start");
      expect(migrated).toContain("@einja:project-private:end");
      expect(migrated).not.toContain("@einja:seed:");
    });

    it("既にproject-privateマーカーの場合、変更しないこと", () => {
      const content = '<!-- @einja:project-private:start id="pp-1" -->\n内容\n<!-- @einja:project-private:end -->';
      const migrated = processor.migrateLegacySeedMarkers(content);
      expect(migrated).toBe(content);
    });
  });

  describe("legacy @einja:seed マーカー互換性", () => {
    describe("parseMarkers", () => {
      it("Markdown legacy seed → type: \"project-private\"", () => {
        const content = `行1
<!-- @einja:seed:start id="test" -->
シード内容
<!-- @einja:seed:end -->
行2`;

        const sections = processor.parseMarkers(content);

        expect(sections).toHaveLength(3);
        expect(sections[0].type).toBe("unmanaged");
        expect(sections[1].type).toBe("project-private");
        expect(sections[1].content).toBe(
          '<!-- @einja:seed:start id="test" -->\nシード内容\n<!-- @einja:seed:end -->'
        );
        expect(sections[2].type).toBe("unmanaged");
      });

      it("YAML legacy seed → type: \"project-private\"", () => {
        const content = `設定1: value1
# @einja:seed:start id="test"
シード設定: value
# @einja:seed:end
設定2: value2`;

        const sections = processor.parseMarkers(content);

        expect(sections).toHaveLength(3);
        expect(sections[0].type).toBe("unmanaged");
        expect(sections[1].type).toBe("project-private");
        expect(sections[1].content).toBe(
          '# @einja:seed:start id="test"\nシード設定: value\n# @einja:seed:end'
        );
        expect(sections[2].type).toBe("unmanaged");
      });

      it("legacy seed + managed混在", () => {
        const content = `行1
<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
行2
<!-- @einja:seed:start id="seed-1" -->
シード内容
<!-- @einja:seed:end -->
行3`;

        const sections = processor.parseMarkers(content);

        expect(sections).toHaveLength(5);
        expect(sections[0].type).toBe("unmanaged");
        expect(sections[1].type).toBe("managed");
        expect(sections[2].type).toBe("unmanaged");
        expect(sections[3].type).toBe("project-private");
        expect(sections[4].type).toBe("unmanaged");
      });

      it("legacy seed ID属性保持", () => {
        const content = `<!-- @einja:seed:start id="my-section" -->
シード内容
<!-- @einja:seed:end -->`;

        const sections = processor.parseMarkers(content);

        const seedSection = sections.find((s) => s.type === "project-private");
        expect(seedSection).toBeDefined();
        expect(seedSection?.id).toBe("my-section");
      });
    });

    describe("migrateLegacySeedMarkers", () => {
      it("managed + seed混在 → seedのみ変換", () => {
        const content = `<!-- @einja:managed:start -->
管理セクション
<!-- @einja:managed:end -->
<!-- @einja:seed:start id="s1" -->
シード内容
<!-- @einja:seed:end -->`;

        const migrated = processor.migrateLegacySeedMarkers(content);

        expect(migrated).toContain("@einja:managed:start");
        expect(migrated).toContain("@einja:managed:end");
        expect(migrated).toContain("@einja:project-private:start");
        expect(migrated).toContain("@einja:project-private:end");
        expect(migrated).not.toContain("@einja:seed:");
      });

      it("YAML形式のseed → 変換", () => {
        const content = `# @einja:seed:start id="yaml-seed"
シード設定: value
# @einja:seed:end`;

        const migrated = processor.migrateLegacySeedMarkers(content);

        expect(migrated).toBe(`# @einja:project-private:start id="yaml-seed"
シード設定: value
# @einja:project-private:end`);
      });

      it("空seedセクション（マーカーペアのみ）", () => {
        const content = `<!-- @einja:seed:start id="x" -->
<!-- @einja:seed:end -->`;

        const migrated = processor.migrateLegacySeedMarkers(content);

        expect(migrated).toBe(`<!-- @einja:project-private:start id="x" -->
<!-- @einja:project-private:end -->`);
      });

      it("複数seedマーカー → すべて変換", () => {
        const content = `<!-- @einja:seed:start id="s1" -->
内容1
<!-- @einja:seed:end -->
行中間
<!-- @einja:seed:start id="s2" -->
内容2
<!-- @einja:seed:end -->`;

        const migrated = processor.migrateLegacySeedMarkers(content);

        expect(migrated).not.toContain("@einja:seed:");
        expect(migrated).toContain('@einja:project-private:start id="s1"');
        expect(migrated).toContain('@einja:project-private:start id="s2"');
        expect(migrated).toContain("@einja:project-private:end");
        // endが2つ変換されていること
        const endCount = (migrated.match(/@einja:project-private:end/g) || []).length;
        expect(endCount).toBe(2);
      });

      it("ID属性を含むseed → ID保持して変換", () => {
        const content = `<!-- @einja:seed:start id="old-id" -->
内容
<!-- @einja:seed:end -->`;

        const migrated = processor.migrateLegacySeedMarkers(content);

        expect(migrated).toContain('id="old-id"');
        expect(migrated).toContain("@einja:project-private:start");
        expect(migrated).not.toContain("@einja:seed:");
      });
    });

    describe("validateMarkers", () => {
      it("legacy seedでID欠落 → エラー検出", () => {
        const content = `行1
<!-- @einja:seed:start -->
シード内容
<!-- @einja:seed:end -->
行2`;

        const result = processor.validateMarkers(content);

        expect(result.valid).toBe(false);
        const idError = result.errors.find((e) => e.type === "project_private_without_id");
        expect(idError).toBeDefined();
        expect(idError?.line).toBe(2);
        expect(idError?.message).toBe("@einja:project-privateマーカーにはid属性が必須です");
      });

      it("legacy seedのネスト → エラー検出", () => {
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
        const nestedError = result.errors.find((e) => e.type === "nested");
        expect(nestedError).toBeDefined();
        expect(nestedError?.line).toBe(4);
        expect(nestedError?.message).toContain("ネスト");
      });
    });
  });
});
