import { describe, expect, it } from "vitest";
import { HashCache } from "./hash-cache.js";

describe("HashCache", () => {
	describe("ハッシュの保存と取得", () => {
		it("ハッシュを保存し、同じキーで取得できること", () => {
			const cache = new HashCache();
			const filePath = ".claude/commands/einja/spec-create.md";
			const contentLength = 1024;
			const hash = "abc123def456";

			cache.set(filePath, contentLength, hash);
			const result = cache.get(filePath, contentLength);

			expect(result).toBe(hash);
		});

		it("存在しないキーの場合、undefinedが返されること", () => {
			const cache = new HashCache();
			const result = cache.get("nonexistent.md", 100);

			expect(result).toBeUndefined();
		});

		it("異なるファイルパスで異なるハッシュを保存できること", () => {
			const cache = new HashCache();
			const file1 = "file1.md";
			const file2 = "file2.md";
			const hash1 = "hash1";
			const hash2 = "hash2";

			cache.set(file1, 100, hash1);
			cache.set(file2, 100, hash2);

			expect(cache.get(file1, 100)).toBe(hash1);
			expect(cache.get(file2, 100)).toBe(hash2);
		});

		it("同じファイルパスでも異なるコンテンツ長で異なるハッシュを保存できること", () => {
			const cache = new HashCache();
			const filePath = "file.md";
			const hash1 = "hash1";
			const hash2 = "hash2";

			cache.set(filePath, 100, hash1);
			cache.set(filePath, 200, hash2);

			expect(cache.get(filePath, 100)).toBe(hash1);
			expect(cache.get(filePath, 200)).toBe(hash2);
		});
	});

	describe("hasメソッド", () => {
		it("保存されたキーに対してtrueを返すこと", () => {
			const cache = new HashCache();
			cache.set("file.md", 100, "hash");

			expect(cache.has("file.md", 100)).toBe(true);
		});

		it("保存されていないキーに対してfalseを返すこと", () => {
			const cache = new HashCache();

			expect(cache.has("file.md", 100)).toBe(false);
		});
	});

	describe("clearメソッド", () => {
		it("すべてのキャッシュをクリアできること", () => {
			const cache = new HashCache();
			cache.set("file1.md", 100, "hash1");
			cache.set("file2.md", 200, "hash2");

			expect(cache.size()).toBe(2);

			cache.clear();

			expect(cache.size()).toBe(0);
			expect(cache.has("file1.md", 100)).toBe(false);
			expect(cache.has("file2.md", 200)).toBe(false);
		});
	});

	describe("sizeメソッド", () => {
		it("キャッシュエントリ数を正しく返すこと", () => {
			const cache = new HashCache();

			expect(cache.size()).toBe(0);

			cache.set("file1.md", 100, "hash1");
			expect(cache.size()).toBe(1);

			cache.set("file2.md", 200, "hash2");
			expect(cache.size()).toBe(2);

			cache.clear();
			expect(cache.size()).toBe(0);
		});
	});

	describe("同一ファイルの2回目以降のハッシュ計算をスキップ", () => {
		it("同じファイルパスとコンテンツ長で2回getした場合、2回目はキャッシュから取得されること", () => {
			const cache = new HashCache();
			const filePath = ".claude/commands/einja/spec-create.md";
			const contentLength = 1024;
			const hash = "abc123def456";

			// 1回目：保存
			cache.set(filePath, contentLength, hash);

			// 2回目：取得（キャッシュヒット）
			const result1 = cache.get(filePath, contentLength);
			const result2 = cache.get(filePath, contentLength);

			expect(result1).toBe(hash);
			expect(result2).toBe(hash);
			expect(result1).toBe(result2);
		});
	});

	describe("キャッシュキーの一意性", () => {
		it("ファイルパスとコンテンツ長の組み合わせでキャッシュキーが一意であること", () => {
			const cache = new HashCache();

			// 同じファイルパス、異なるコンテンツ長
			cache.set("file.md", 100, "hash_100");
			cache.set("file.md", 200, "hash_200");

			// 異なるファイルパス、同じコンテンツ長
			cache.set("file1.md", 100, "hash_file1");
			cache.set("file2.md", 100, "hash_file2");

			expect(cache.get("file.md", 100)).toBe("hash_100");
			expect(cache.get("file.md", 200)).toBe("hash_200");
			expect(cache.get("file1.md", 100)).toBe("hash_file1");
			expect(cache.get("file2.md", 100)).toBe("hash_file2");

			// すべて異なるキーとして扱われている
			expect(cache.size()).toBe(4);
		});
	});
});
