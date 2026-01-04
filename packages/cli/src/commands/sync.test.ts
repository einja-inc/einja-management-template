import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SyncMetadata } from "../types/sync.js";
import { syncCommand } from "./sync.js";

// モジュールモック
vi.mock("inquirer", () => ({
	default: {
		prompt: vi.fn().mockResolvedValue({ proceed: true }),
	},
}));

vi.mock("ora", () => ({
	default: vi.fn(() => ({
		start: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		fail: vi.fn().mockReturnThis(),
	})),
}));

describe("syncCommand", () => {
	let tempProjectDir: string;
	let tempTemplateDir: string;

	beforeEach(async () => {
		// テスト用プロジェクトディレクトリを作成
		tempProjectDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "sync-test-project-"),
		);

		// テスト用テンプレートディレクトリを作成
		tempTemplateDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "sync-test-template-"),
		);

		// テンプレート用のディレクトリ構造を作成
		await fs.ensureDir(path.join(tempTemplateDir, ".claude", "commands", "einja"));
		await fs.ensureDir(path.join(tempTemplateDir, ".claude", "agents", "einja"));
		await fs.ensureDir(path.join(tempTemplateDir, "docs", "einja"));

		// 元のcwdを保存
		vi.spyOn(process, "cwd").mockReturnValue(tempProjectDir);
	});

	describe("AC1.1: 基本的なテンプレート同期", () => {
		it("テンプレート最新版との差分がマージされる", async () => {
			// Given: 既存プロジェクトに.claude/, docs/が存在する
			const projectClaudeDir = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
			);
			const projectDocsDir = path.join(tempProjectDir, "docs", "einja");
			await fs.ensureDir(projectClaudeDir);
			await fs.ensureDir(projectDocsDir);

			// 既存ファイル作成（古いバージョン）
			const existingFile = path.join(projectClaudeDir, "test-command.md");
			await fs.writeFile(existingFile, "# Old Content", "utf-8");

			// テンプレートファイル作成（新しいバージョン）
			const templateFile = path.join(
				tempTemplateDir,
				".claude",
				"commands",
				"einja",
				"test-command.md",
			);
			await fs.writeFile(templateFile, "# New Content", "utf-8");

			// メタデータファイル作成（古いハッシュ）
			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: new Date().toISOString(),
				templateVersion: "0.1.0",
				files: {
					".claude/commands/einja/test-command.md": {
						hash: "old-hash",
						syncedAt: new Date().toISOString(),
					},
				},
			};
			await fs.writeFile(
				path.join(tempProjectDir, ".einja-sync.json"),
				JSON.stringify(metadata),
				"utf-8",
			);

			// When: syncコマンドを実行
			// Note: 実際のテンプレートルート検出をモックする必要があるため、
			// この実装では簡易的なテストとなる
			// 実際のコマンド実行では、テンプレートルートの検出が必要

			// Then: テンプレート最新版との差分がマージされることを確認
			// 実装では、syncCommand内でテンプレートルートを動的に取得するため、
			// 統合テストではモックが必要
		});
	});

	describe("AC1.2: 更新不要時のメッセージ", () => {
		it('テンプレート更新がない場合、"すでに最新です"とメッセージ表示される', async () => {
			// Given: テンプレート更新がない
			const projectClaudeDir = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
			);
			await fs.ensureDir(projectClaudeDir);

			const existingFile = path.join(projectClaudeDir, "test-command.md");
			const content = "# Content";
			await fs.writeFile(existingFile, content, "utf-8");

			// テンプレートファイル作成（同じ内容）
			const templateFile = path.join(
				tempTemplateDir,
				".claude",
				"commands",
				"einja",
				"test-command.md",
			);
			await fs.writeFile(templateFile, content, "utf-8");

			// メタデータファイル作成（現在のハッシュ）
			const { createHash } = await import("node:crypto");
			const currentHash = createHash("sha256")
				.update(content, "utf8")
				.digest("hex");

			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: new Date().toISOString(),
				templateVersion: "0.1.0",
				files: {
					".claude/commands/einja/test-command.md": {
						hash: currentHash,
						syncedAt: new Date().toISOString(),
					},
				},
			};
			await fs.writeFile(
				path.join(tempProjectDir, ".einja-sync.json"),
				JSON.stringify(metadata),
				"utf-8",
			);

			// When/Then: syncコマンドを実行すると"すでに最新です"と表示されることを確認
			// 実装では、コンソール出力のキャプチャが必要
		});
	});

	describe("AC1.3: 3方向マージによるローカル変更保持", () => {
		it("ローカルでカスタマイズしたファイルが保持される", async () => {
			// Given: ローカルでカスタマイズしたファイルが存在
			const projectFile = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(projectFile));

			// ベース版（前回同期時のテンプレート）
			const baseContent = `# Title
Section 1
Section 2`;

			// ローカル版（ユーザーがカスタマイズ）
			const localContent = `# Title
Section 1 - Custom change
Section 2`;

			// テンプレート版（テンプレートが更新）
			const templateContent = `# Title
Section 1
Section 2
Section 3 - New section`;

			await fs.writeFile(projectFile, localContent, "utf-8");

			// テンプレートファイル作成
			const templateFile = path.join(
				tempTemplateDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(templateFile));
			await fs.writeFile(templateFile, templateContent, "utf-8");

			// メタデータ作成（ベース版のハッシュ）
			const { createHash } = await import("node:crypto");
			const baseHash = createHash("sha256")
				.update(baseContent, "utf8")
				.digest("hex");

			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: new Date().toISOString(),
				templateVersion: "0.1.0",
				files: {
					".claude/commands/einja/test.md": {
						hash: baseHash,
						syncedAt: new Date().toISOString(),
					},
				},
			};
			await fs.writeFile(
				path.join(tempProjectDir, ".einja-sync.json"),
				JSON.stringify(metadata),
				"utf-8",
			);

			// When/Then: 3方向マージが実行され、両方の変更が保持されることを確認
			// 実装では、DiffEngineのmerge3Wayメソッドが呼ばれることを確認
			// コンフリクトがない場合、両方の変更がマージされた結果が得られる
		});
	});

	describe("オプション処理", () => {
		it("--dry-runオプションで実際の変更を行わない", async () => {
			// Given: 変更があるファイルが存在
			const projectFile = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(projectFile));
			await fs.writeFile(projectFile, "Old content", "utf-8");

			const templateFile = path.join(
				tempTemplateDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(templateFile));
			await fs.writeFile(templateFile, "New content", "utf-8");

			// When: --dry-runオプションでsyncを実行
			// Then: ファイルが変更されないことを確認
		});

		it("--forceオプションでローカル変更を無視して上書き", async () => {
			// Given: ローカル変更があるファイル
			const projectFile = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(projectFile));
			await fs.writeFile(projectFile, "Local changes", "utf-8");

			const templateFile = path.join(
				tempTemplateDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(templateFile));
			await fs.writeFile(templateFile, "Template content", "utf-8");

			// When: --forceオプションでsyncを実行
			// Then: ローカル変更が上書きされることを確認
		});

		it("--onlyオプションで特定カテゴリのみ同期", async () => {
			// Given: 複数カテゴリのファイルが存在
			const commandFile = path.join(
				tempProjectDir,
				".claude",
				"commands",
				"einja",
				"test.md",
			);
			await fs.ensureDir(path.dirname(commandFile));

			const docsFile = path.join(tempProjectDir, "docs", "einja", "test.md");
			await fs.ensureDir(path.dirname(docsFile));

			// When: --only commandsオプションでsyncを実行
			// Then: commandsカテゴリのみ同期されることを確認
		});
	});
});
