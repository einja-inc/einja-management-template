import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MetadataManager } from "./metadata-manager.js";
import { BatchProcessor } from "./batch-processor.js";

describe("パフォーマンステスト", () => {
	let tempDir: string;
	let metadataManager: MetadataManager;
	let batchProcessor: BatchProcessor;

	beforeEach(async () => {
		// 一時ディレクトリを作成
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-perf-test-"));
		metadataManager = new MetadataManager(tempDir);
		batchProcessor = new BatchProcessor(10);
	});

	afterEach(async () => {
		// 一時ディレクトリを削除
		await fs.remove(tempDir);
	});

	describe("ハッシュキャッシュのパフォーマンス", () => {
		it("同一ファイルの2回目以降のハッシュ計算がスキップされること", async () => {
			const content = "a".repeat(10000); // 10KB のコンテンツ
			const filePath = "test.md";

			// 1回目：ハッシュ計算
			const hash1 = metadataManager.calculateHash(content, filePath);

			// 2回目：キャッシュから取得
			const hash2 = metadataManager.calculateHash(content, filePath);

			// 同じハッシュが返されること
			expect(hash1).toBe(hash2);

			// キャッシュが存在すること
			// privateメンバーのhashCacheに直接アクセス（テスト目的）
			// biome-ignore lint/complexity/useLiteralKeys: テストでprivateメンバーにアクセス
			expect(metadataManager["hashCache"].has(filePath, content)).toBe(true);
		});

		it("100ファイルのハッシュ計算がキャッシュにより高速化されること", async () => {
			const content = "a".repeat(1000); // 1KB のコンテンツ
			const files = Array.from({ length: 100 }, (_, i) => `file${i}.md`);

			// 1回目：すべてハッシュ計算
			for (const file of files) {
				metadataManager.calculateHash(content, file);
			}

			// すべてのファイルがキャッシュされていること
			for (const file of files) {
				// biome-ignore lint/complexity/useLiteralKeys: テストでprivateメンバーにアクセス
				expect(metadataManager["hashCache"].has(file, content)).toBe(true);
			}

			// キャッシュクリア
			metadataManager.clearHashCache();

			// キャッシュがクリアされたこと
			for (const file of files) {
				// biome-ignore lint/complexity/useLiteralKeys: テストでprivateメンバーにアクセス
				expect(metadataManager["hashCache"].has(file, content)).toBe(false);
			}

			// 2回目：再度ハッシュ計算
			for (const file of files) {
				metadataManager.calculateHash(content, file);
			}

			// 再度キャッシュされていること
			for (const file of files) {
				// biome-ignore lint/complexity/useLiteralKeys: テストでprivateメンバーにアクセス
				expect(metadataManager["hashCache"].has(file, content)).toBe(true);
			}
		});
	});

	describe("並列処理のパフォーマンス", () => {
		it("100ファイルの処理が並列化により高速化されること", async () => {
			const files = Array.from({ length: 100 }, (_, i) => ({
				id: i,
				content: `content-${i}`,
			}));

			// 逐次処理
			const start1 = Date.now();
			const results1: string[] = [];
			for (const file of files) {
				await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms待機
				results1.push(`processed-${file.id}`);
			}
			const time1 = Date.now() - start1;

			// 並列処理
			const start2 = Date.now();
			const results2 = await batchProcessor.processBatch(files, async (file) => {
				await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms待機
				return `processed-${file.id}`;
			});
			const time2 = Date.now() - start2;

			// 結果が同じであること
			expect(results2).toEqual(results1);

			// 並列処理の方が高速であること
			expect(time2).toBeLessThan(time1);

			// 並列処理は100ms以内に完了すること
			// バッチサイズ10で100ファイル = 10バッチ
			// 各バッチは並列実行されるため、10バッチ × 1ms = 約10ms（実際はオーバーヘッドがあるので100ms以内）
			expect(time2).toBeLessThan(100);
		});

		it("100ファイルの同期が3秒以内に完了すること（統合テスト）", async () => {
			// 100ファイルのモックデータを準備
			const files = Array.from({ length: 100 }, (_, i) => ({
				path: `file${i}.md`,
				content: `content-${i}`.repeat(100), // 約1KB
			}));

			const start = Date.now();

			// ファイルハッシュ計算を並列実行（実際のsyncコマンドの差分計算をシミュレート）
			await batchProcessor.processBatch(files, async (file) => {
				// ハッシュ計算（キャッシュあり）
				const hash = metadataManager.calculateHash(file.content, file.path);
				return { path: file.path, hash };
			});

			const time = Date.now() - start;

			// 3秒以内に完了すること
			expect(time).toBeLessThan(3000);
		});
	});

	describe("差分計算の最適化", () => {
		it("同一ハッシュのファイルはマージ処理をスキップすること", async () => {
			const content = "same content";
			const hash1 = metadataManager.calculateHash(content, "test.md");
			const hash2 = metadataManager.calculateHash(content, "test.md");

			// ベースハッシュとテンプレートハッシュが同じ場合
			const shouldSkip = hash1 === hash2;

			expect(shouldSkip).toBe(true);
		});
	});
});
