import { describe, expect, it } from "vitest";
import { DiffEngine } from "./diff-engine.js";

describe("DiffEngine", () => {
	const engine = new DiffEngine();

	describe("merge3Way", () => {
		it("ローカルのみ変更された場合、ローカルの変更を維持する", () => {
			const base = "行1\n行2\n行3";
			const local = "行1（編集）\n行2\n行3";
			const template = "行1\n行2\n行3";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(true);
			expect(result.content).toBe("行1（編集）\n行2\n行3");
			expect(result.conflicts).toHaveLength(0);
		});

		it("テンプレートのみ変更された場合、テンプレートの変更を採用する", () => {
			const base = "行1\n行2\n行3";
			const local = "行1\n行2\n行3";
			const template = "行1\n行2\n行3（編集）";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(true);
			expect(result.content).toBe("行1\n行2\n行3（編集）");
			expect(result.conflicts).toHaveLength(0);
		});

		it("異なる行を両方が変更した場合、両方の変更を統合する", () => {
			const base = "行1\n行2\n行3";
			const local = "行1（ローカル編集）\n行2\n行3";
			const template = "行1\n行2\n行3（テンプレート編集）";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(true);
			expect(result.content).toBe("行1（ローカル編集）\n行2\n行3（テンプレート編集）");
			expect(result.conflicts).toHaveLength(0);
		});

		it("同じ行を両方が変更した場合、コンフリクトマーカーを挿入する", () => {
			const base = "行1\n行2\n行3";
			const local = "行1（ローカル編集）\n行2\n行3";
			const template = "行1（テンプレート編集）\n行2\n行3";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(false);
			expect(result.conflicts).toHaveLength(1);
			expect(result.conflicts[0]).toEqual({
				line: 1,
				localContent: "行1（ローカル編集）",
				templateContent: "行1（テンプレート編集）",
			});

			// コンフリクトマーカーが含まれることを確認
			expect(result.content).toContain("<<<<<<< LOCAL (your changes)");
			expect(result.content).toContain("行1（ローカル編集）");
			expect(result.content).toContain("=======");
			expect(result.content).toContain("行1（テンプレート編集）");
			expect(result.content).toContain(">>>>>>> TEMPLATE (from @einja/cli)");
		});

		it("複数のコンフリクトがある場合、すべて検出する", () => {
			const base = "行1\n行2\n行3\n行4";
			const local = "行1（ローカル編集）\n行2\n行3（ローカル編集）\n行4";
			const template = "行1（テンプレート編集）\n行2\n行3（テンプレート編集）\n行4";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(false);
			expect(result.conflicts).toHaveLength(2);
			expect(result.conflicts[0].line).toBe(1);
			expect(result.conflicts[1].line).toBeGreaterThan(1);
		});

		it("変更がない場合、元の内容を維持する", () => {
			const base = "行1\n行2\n行3";
			const local = "行1\n行2\n行3";
			const template = "行1\n行2\n行3";

			const result = engine.merge3Way(base, local, template);

			expect(result.success).toBe(true);
			expect(result.content).toBe("行1\n行2\n行3");
			expect(result.conflicts).toHaveLength(0);
		});
	});

	describe("hasConflictMarkers", () => {
		it("コンフリクトマーカーが存在する場合、trueを返す", () => {
			const content = `行1
<<<<<<< LOCAL (your changes)
ローカル版
=======
テンプレート版
>>>>>>> TEMPLATE (from @einja/cli)
行2`;

			expect(engine.hasConflictMarkers(content)).toBe(true);
		});

		it("コンフリクトマーカーが存在しない場合、falseを返す", () => {
			const content = "行1\n行2\n行3";

			expect(engine.hasConflictMarkers(content)).toBe(false);
		});
	});

	describe("parseConflictMarkers", () => {
		it("コンフリクトマーカーをパースしてコンフリクト情報を抽出する", () => {
			const content = `行1
<<<<<<< LOCAL (your changes)
ローカル版の行1
ローカル版の行2
=======
テンプレート版の行1
テンプレート版の行2
>>>>>>> TEMPLATE (from @einja/cli)
行2`;

			const conflicts = engine.parseConflictMarkers(content);

			expect(conflicts).toHaveLength(1);
			expect(conflicts[0]).toEqual({
				line: 2,
				localContent: "ローカル版の行1\nローカル版の行2",
				templateContent: "テンプレート版の行1\nテンプレート版の行2",
			});
		});

		it("複数のコンフリクトマーカーをパースする", () => {
			const content = `行1
<<<<<<< LOCAL (your changes)
ローカル1
=======
テンプレート1
>>>>>>> TEMPLATE (from @einja/cli)
行2
<<<<<<< LOCAL (your changes)
ローカル2
=======
テンプレート2
>>>>>>> TEMPLATE (from @einja/cli)
行3`;

			const conflicts = engine.parseConflictMarkers(content);

			expect(conflicts).toHaveLength(2);
			expect(conflicts[0].localContent).toBe("ローカル1");
			expect(conflicts[1].localContent).toBe("ローカル2");
		});

		it("コンフリクトマーカーがない場合、空配列を返す", () => {
			const content = "行1\n行2\n行3";

			const conflicts = engine.parseConflictMarkers(content);

			expect(conflicts).toHaveLength(0);
		});
	});
});
