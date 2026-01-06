import fs from "fs-extra";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileFilter } from "./file-filter.js";

describe("FileFilter", () => {
	let tempDir: string;
	let projectDir: string;
	let templateDir: string;
	let fileFilter: FileFilter;

	beforeEach(async () => {
		// テスト用の一時ディレクトリを作成
		tempDir = path.join(process.cwd(), ".test-tmp", `file-filter-${Date.now()}`);
		projectDir = path.join(tempDir, "project");
		templateDir = path.join(tempDir, "template");

		await fs.ensureDir(projectDir);
		await fs.ensureDir(templateDir);

		fileFilter = new FileFilter(projectDir, templateDir);
	});

	afterEach(async () => {
		// テスト用の一時ディレクトリを削除
		await fs.remove(tempDir);
	});

	describe("scanSyncTargets", () => {
		it("einja/サブディレクトリ内のファイルをスキャンできること", async () => {
			// Given: テンプレートディレクトリにファイルを作成
			const commandsDir = path.join(templateDir, ".claude/commands/einja");
			const agentsDir = path.join(templateDir, ".claude/agents/einja");

			await fs.ensureDir(commandsDir);
			await fs.ensureDir(agentsDir);

			await fs.writeFile(path.join(commandsDir, "test-command.md"), "# Test Command");
			await fs.writeFile(path.join(agentsDir, "test-agent.md"), "# Test Agent");

			// When: スキャンを実行
			const targets = await fileFilter.scanSyncTargets();

			// Then: ファイルが検出される
			expect(targets.length).toBe(2);
			expect(targets.some((t) => t.path.endsWith("test-command.md"))).toBe(true);
			expect(targets.some((t) => t.path.endsWith("test-agent.md"))).toBe(true);
		});

		it("カテゴリでフィルタリングできること", async () => {
			// Given: 複数のカテゴリにファイルを作成
			const commandsDir = path.join(templateDir, ".claude/commands/einja");
			const agentsDir = path.join(templateDir, ".claude/agents/einja");
			const docsDir = path.join(templateDir, "docs/einja");

			await fs.ensureDir(commandsDir);
			await fs.ensureDir(agentsDir);
			await fs.ensureDir(docsDir);

			await fs.writeFile(path.join(commandsDir, "test-command.md"), "# Test Command");
			await fs.writeFile(path.join(agentsDir, "test-agent.md"), "# Test Agent");
			await fs.writeFile(path.join(docsDir, "test-doc.md"), "# Test Doc");

			// When: commandsのみをスキャン
			const targets = await fileFilter.scanSyncTargets({ categories: ["commands"] });

			// Then: commandsのみが検出される
			expect(targets.length).toBe(1);
			expect(targets[0].category).toBe("commands");
			expect(targets[0].path).toContain("test-command.md");
		});

		it("ローカルに存在するファイルをexists=trueとしてマークすること", async () => {
			// Given: テンプレートとプロジェクトの両方にファイルを作成
			const templateCommandsDir = path.join(templateDir, ".claude/commands/einja");
			const projectCommandsDir = path.join(projectDir, ".claude/commands/einja");

			await fs.ensureDir(templateCommandsDir);
			await fs.ensureDir(projectCommandsDir);

			await fs.writeFile(path.join(templateCommandsDir, "existing.md"), "# Existing");
			await fs.writeFile(path.join(projectCommandsDir, "existing.md"), "# Existing Local");
			await fs.writeFile(path.join(templateCommandsDir, "new.md"), "# New");

			// When: スキャンを実行
			const targets = await fileFilter.scanSyncTargets();

			// Then: existsフラグが正しく設定される
			const existingFile = targets.find((t) => t.path.endsWith("existing.md"));
			const newFile = targets.find((t) => t.path.endsWith("new.md"));

			expect(existingFile?.exists).toBe(true);
			expect(newFile?.exists).toBe(false);
		});
	});

	describe("shouldExclude", () => {
		it("_プレフィックスで始まるファイルを除外すること", () => {
			// Given: _プレフィックスのファイル
			const filePath = ".claude/agents/einja/_custom-agent.md";

			// When: 除外判定
			const result = fileFilter.shouldExclude(filePath);

			// Then: 除外される
			expect(result).toBe(true);
		});

		it("_プレフィックスでないファイルを除外しないこと", () => {
			// Given: 通常のファイル
			const filePath = ".claude/agents/einja/spec-requirements.md";

			// When: 除外判定
			const result = fileFilter.shouldExclude(filePath);

			// Then: 除外されない
			expect(result).toBe(false);
		});

		it("バイナリファイルを除外すること", () => {
			// Given: 画像ファイル
			const imagePath = ".claude/commands/einja/image.png";

			// When: 除外判定
			const result = fileFilter.shouldExclude(imagePath);

			// Then: 除外される
			expect(result).toBe(true);
		});

		it("追加の除外パターンで除外できること", () => {
			// Given: 追加の除外パターン
			const filePath = ".claude/commands/einja/test.md";
			const excludePatterns = ["**/*test*"];

			// When: 除外判定
			const result = fileFilter.shouldExclude(filePath, excludePatterns);

			// Then: 除外される
			expect(result).toBe(true);
		});

		it(".gitignoreパターンで除外できること", async () => {
			// Given: .gitignoreファイルを作成
			const gitignorePath = path.join(projectDir, ".gitignore");
			await fs.writeFile(gitignorePath, "*.log\ntemp/\n");

			// 新しいFileFilterインスタンスを作成して.gitignoreを読み込む
			const filter = new FileFilter(projectDir, templateDir);
			await filter.scanSyncTargets(); // .gitignoreの読み込みをトリガー

			// When: 除外判定
			const result1 = filter.shouldExclude("debug.log");
			const result2 = filter.shouldExclude("temp/file.txt");

			// Then: 除外される
			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});
	});

	describe("filterByCategory", () => {
		it("指定されたカテゴリのファイルのみを返すこと", () => {
			// Given: 複数のカテゴリのファイル
			const files = [
				{
					path: ".claude/commands/einja/cmd1.md",
					category: "commands",
					templatePath: "/template/cmd1.md",
					exists: false,
				},
				{
					path: ".claude/agents/einja/agent1.md",
					category: "agents",
					templatePath: "/template/agent1.md",
					exists: false,
				},
				{
					path: "docs/einja/doc1.md",
					category: "docs",
					templatePath: "/template/doc1.md",
					exists: false,
				},
			];

			// When: commandsとdocsでフィルタリング
			const filtered = fileFilter.filterByCategory(files, ["commands", "docs"]);

			// Then: commandsとdocsのみが返される
			expect(filtered.length).toBe(2);
			expect(filtered.some((f) => f.category === "commands")).toBe(true);
			expect(filtered.some((f) => f.category === "docs")).toBe(true);
			expect(filtered.some((f) => f.category === "agents")).toBe(false);
		});
	});

	describe("getCategoryFromPath", () => {
		it("パスからカテゴリを推測できること", () => {
			// Given & When: 各カテゴリのパス
			const commandsCategory = fileFilter.getCategoryFromPath(
				".claude/commands/einja/test.md",
			);
			const agentsCategory = fileFilter.getCategoryFromPath(
				".claude/agents/einja/test.md",
			);
			const skillsCategory = fileFilter.getCategoryFromPath(
				".claude/skills/einja/test.md",
			);
			const docsCategory = fileFilter.getCategoryFromPath("docs/einja/test.md");

			// Then: 正しいカテゴリが返される
			expect(commandsCategory).toBe("commands");
			expect(agentsCategory).toBe("agents");
			expect(skillsCategory).toBe("skills");
			expect(docsCategory).toBe("docs");
		});

		it("einja/外のパスはnullを返すこと", () => {
			// Given: einja/外のパス
			const customPath = ".claude/commands/my-custom.md";

			// When: カテゴリ推測
			const category = fileFilter.getCategoryFromPath(customPath);

			// Then: nullが返される
			expect(category).toBe(null);
		});
	});
});
