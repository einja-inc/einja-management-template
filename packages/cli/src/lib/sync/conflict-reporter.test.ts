import { describe, expect, it } from "vitest";
import type { Conflict } from "../../types/sync.js";
import { ConflictReporter } from "./conflict-reporter.js";

describe("ConflictReporter", () => {
	const reporter = new ConflictReporter();

	describe("createReport", () => {
		it("コンフリクトがある場合、正しくレポートを作成する", () => {
			const fileConflicts = new Map<string, Conflict[]>([
				[
					"file1.txt",
					[
						{ line: 10, localContent: "local1", templateContent: "template1" },
						{ line: 20, localContent: "local2", templateContent: "template2" },
					],
				],
				[
					"file2.txt",
					[{ line: 5, localContent: "local3", templateContent: "template3" }],
				],
			]);

			const report = reporter.createReport(fileConflicts);

			expect(report.hasConflicts).toBe(true);
			expect(report.files).toHaveLength(2);
			expect(report.totalConflicts).toBe(3);
			expect(report.files[0].path).toBe("file1.txt");
			expect(report.files[0].conflicts).toHaveLength(2);
			expect(report.files[1].path).toBe("file2.txt");
			expect(report.files[1].conflicts).toHaveLength(1);
		});

		it("コンフリクトがない場合、空のレポートを作成する", () => {
			const fileConflicts = new Map<string, Conflict[]>([
				["file1.txt", []],
				["file2.txt", []],
			]);

			const report = reporter.createReport(fileConflicts);

			expect(report.hasConflicts).toBe(false);
			expect(report.files).toHaveLength(0);
			expect(report.totalConflicts).toBe(0);
		});
	});

	describe("formatReport", () => {
		it("コンフリクトがある場合、フォーマット済みのレポートを返す", () => {
			const report = {
				hasConflicts: true,
				files: [
					{
						path: "file1.txt",
						conflicts: [
							{ line: 10, localContent: "a", templateContent: "b" },
							{ line: 20, localContent: "c", templateContent: "d" },
						],
					},
					{
						path: "file2.txt",
						conflicts: [{ line: 5, localContent: "e", templateContent: "f" }],
					},
				],
				totalConflicts: 3,
			};

			const formatted = reporter.formatReport(report);

			expect(formatted).toContain("3件のコンフリクトが検出されました");
			expect(formatted).toContain("file1.txt (2箇所)");
			expect(formatted).toContain("行10");
			expect(formatted).toContain("行20");
			expect(formatted).toContain("file2.txt (1箇所)");
			expect(formatted).toContain("行5");
		});

		it("コンフリクトがない場合、メッセージを返す", () => {
			const report = {
				hasConflicts: false,
				files: [],
				totalConflicts: 0,
			};

			const formatted = reporter.formatReport(report);

			expect(formatted).toBe("コンフリクトは検出されませんでした。");
		});
	});

	describe("formatHelpMessage", () => {
		it("コンフリクト解消方法のヘルプメッセージを返す", () => {
			const helpMessage = reporter.formatHelpMessage();

			expect(helpMessage).toContain("コンフリクト解消方法");
			expect(helpMessage).toContain("上記ファイルを開く");
			expect(helpMessage).toContain("<<<<<<< LOCAL と >>>>>>> TEMPLATE");
			expect(helpMessage).toContain("再度 sync を実行");
		});
	});

	describe("hasUnresolvedConflicts", () => {
		it("未解決のコンフリクトマーカーが存在する場合、trueを返す", () => {
			const content = `行1
<<<<<<< LOCAL (your changes)
ローカル版
=======
テンプレート版
>>>>>>> TEMPLATE (from @einja/cli)
行2`;

			expect(reporter.hasUnresolvedConflicts(content)).toBe(true);
		});

		it("コンフリクトマーカーが存在しない場合、falseを返す", () => {
			const content = "行1\n行2\n行3";

			expect(reporter.hasUnresolvedConflicts(content)).toBe(false);
		});
	});

	describe("formatUnresolvedConflictError", () => {
		it("未解決のコンフリクトエラーメッセージを返す", () => {
			const error = reporter.formatUnresolvedConflictError("file.txt");

			expect(error).toContain("未解決のコンフリクトが存在します");
			expect(error).toContain("file.txt");
			expect(error).toContain("<<<<<<< LOCAL");
			expect(error).toContain(">>>>>>> TEMPLATE");
		});
	});

	describe("formatExitMessage", () => {
		it("コンフリクト発生時の終了メッセージを返す", () => {
			const report = {
				hasConflicts: true,
				files: [
					{
						path: "file.txt",
						conflicts: [
							{ line: 10, localContent: "a", templateContent: "b" },
						],
					},
				],
				totalConflicts: 1,
			};

			const message = reporter.formatExitMessage(report);

			expect(message).toContain("1件のコンフリクトが検出されました");
			expect(message).toContain("コンフリクト解消方法");
			expect(message).toContain("同期処理は部分的に完了しました");
		});
	});
});
