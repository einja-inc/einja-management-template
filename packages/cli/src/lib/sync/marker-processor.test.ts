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
				"<!-- @einja:managed:start -->\n管理セクション\n<!-- @einja:managed:end -->",
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
				"# @einja:managed:start\n管理設定: value\n# @einja:managed:end",
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
			expect(result.errors[0].message).toBe(
				"対応する@einja:managed:endが見つかりません",
			);
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
			expect(result.errors[0].message).toBe(
				"対応する@einja:managed:startが見つかりません",
			);
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
				"@einja:managedマーカーのネストは許可されていません",
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
});
