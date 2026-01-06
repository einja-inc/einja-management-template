import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import type { SyncMetadata } from "../../types/sync.js";
import { MetadataManager } from "./metadata-manager.js";

describe("MetadataManager", () => {
	let tempDir: string;
	let manager: MetadataManager;

	beforeEach(async () => {
		// テスト用一時ディレクトリを作成
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "metadata-test-"));
		manager = new MetadataManager(tempDir);
	});

	describe("load", () => {
		it("メタデータファイルが存在しない場合、デフォルトメタデータを返す", async () => {
			const metadata = await manager.load();

			expect(metadata).toHaveProperty("version", "1.0.0");
			expect(metadata).toHaveProperty("templateVersion", "0.1.0");
			expect(metadata).toHaveProperty("lastSync");
			expect(metadata).toHaveProperty("files", {});
		});

		it("メタデータファイルが存在する場合、読み込んで返す", async () => {
			const testMetadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: "2025-01-01T00:00:00.000Z",
				templateVersion: "0.2.0",
				files: {
					"test.txt": {
						hash: "abc123",
						syncedAt: "2025-01-01T00:00:00.000Z",
					},
				},
			};

			await fs.writeFile(
				path.join(tempDir, ".einja-sync.json"),
				JSON.stringify(testMetadata),
				"utf-8",
			);

			const metadata = await manager.load();

			expect(metadata).toEqual(testMetadata);
		});

		it("不正なJSON形式の場合、エラーをスローする", async () => {
			await fs.writeFile(
				path.join(tempDir, ".einja-sync.json"),
				"invalid json",
				"utf-8",
			);

			await expect(manager.load()).rejects.toThrow("メタデータの読み込みに失敗しました");
		});
	});

	describe("save", () => {
		it("メタデータをJSON形式で保存する", async () => {
			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: "2025-01-01T00:00:00.000Z",
				templateVersion: "0.1.0",
				files: {},
			};

			await manager.save(metadata);

			const content = await fs.readFile(
				path.join(tempDir, ".einja-sync.json"),
				"utf-8",
			);
			const saved = JSON.parse(content);

			expect(saved).toEqual(metadata);
		});

		it("不正なメタデータの場合、エラーをスローする", async () => {
			const invalidMetadata = {
				version: "1.0.0",
				// lastSync と templateVersion が欠けている
				files: {},
			};

			await expect(manager.save(invalidMetadata as SyncMetadata)).rejects.toThrow(
				"メタデータの保存に失敗しました",
			);
		});
	});

	describe("validate", () => {
		it("正しいメタデータの場合、バリデーションを通過する", () => {
			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: "2025-01-01T00:00:00.000Z",
				templateVersion: "0.1.0",
				files: {},
			};

			const result = manager.validate(metadata);

			expect(result).toEqual(metadata);
		});

		it("不正なメタデータの場合、エラーをスローする", () => {
			const invalidMetadata = {
				version: "1.0.0",
				// 必須フィールドが欠けている
			};

			expect(() => manager.validate(invalidMetadata)).toThrow(
				"メタデータのバリデーションに失敗しました",
			);
		});
	});

	describe("getBaseContent", () => {
		it("ファイルの内容とハッシュを取得する", async () => {
			const testFile = path.join(tempDir, "test.txt");
			const testContent = "Hello, World!";
			await fs.writeFile(testFile, testContent, "utf-8");

			const result = await manager.getBaseContent(testFile);

			const expectedHash = createHash("sha256")
				.update(testContent, "utf8")
				.digest("hex");

			expect(result.content).toBe(testContent);
			expect(result.hash).toBe(expectedHash);
		});

		it("ファイルが存在しない場合、エラーをスローする", async () => {
			const nonExistentFile = path.join(tempDir, "nonexistent.txt");

			await expect(manager.getBaseContent(nonExistentFile)).rejects.toThrow(
				"ファイル",
			);
		});
	});

	describe("updateFileHash", () => {
		it("ファイルハッシュを更新する", async () => {
			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: "2025-01-01T00:00:00.000Z",
				templateVersion: "0.1.0",
				files: {},
			};

			const filePath = "test.txt";
			const content = "Test content";

			const updated = await manager.updateFileHash(metadata, filePath, content);

			expect(updated.files[filePath]).toBeDefined();
			expect(updated.files[filePath].hash).toBe(
				createHash("sha256").update(content, "utf8").digest("hex"),
			);
			expect(updated.files[filePath].syncedAt).toBeDefined();
		});

		it("既存のファイルハッシュを上書きする", async () => {
			const metadata: SyncMetadata = {
				version: "1.0.0",
				lastSync: "2025-01-01T00:00:00.000Z",
				templateVersion: "0.1.0",
				files: {
					"test.txt": {
						hash: "old-hash",
						syncedAt: "2025-01-01T00:00:00.000Z",
					},
				},
			};

			const filePath = "test.txt";
			const newContent = "New content";

			const updated = await manager.updateFileHash(
				metadata,
				filePath,
				newContent,
			);

			expect(updated.files[filePath].hash).toBe(
				createHash("sha256").update(newContent, "utf8").digest("hex"),
			);
			expect(updated.files[filePath].hash).not.toBe("old-hash");
		});
	});
});
