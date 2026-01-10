import { describe, expect, it } from "vitest";
import { HashCache } from "./hash-cache.js";

describe("HashCache", () => {
	describe("ハッシュの保存と取得", () => {
		it("ハッシュを保存し、同じキーで取得できること", () => {
			const cache = new HashCache();
			const filePath = ".claude/commands/einja/spec-create.md";
			const content = "a".repeat(1024);
			const hash = "abc123def456";

			cache.set(filePath, content, hash);
			const result = cache.get(filePath, content);

			expect(result).toBe(hash);
		});

		it("存在しないキーの場合、undefinedが返されること", () => {
			const cache = new HashCache();
			const result = cache.get("nonexistent.md", "some content");

			expect(result).toBeUndefined();
		});

		it("異なるファイルパスで異なるハッシュを保存できること", () => {
			const cache = new HashCache();
			const file1 = "file1.md";
			const file2 = "file2.md";
			const content = "same content";
			const hash1 = "hash1";
			const hash2 = "hash2";

			cache.set(file1, content, hash1);
			cache.set(file2, content, hash2);

			expect(cache.get(file1, content)).toBe(hash1);
			expect(cache.get(file2, content)).toBe(hash2);
		});

		it("同じファイルパスでも異なるコンテンツで異なるハッシュを保存できること", () => {
			const cache = new HashCache();
			const filePath = "file.md";
			const content1 = "content version 1";
			const content2 = "content version 2";
			const hash1 = "hash1";
			const hash2 = "hash2";

			cache.set(filePath, content1, hash1);
			cache.set(filePath, content2, hash2);

			expect(cache.get(filePath, content1)).toBe(hash1);
			expect(cache.get(filePath, content2)).toBe(hash2);
		});

		it("同じ長さでも異なる内容のコンテンツを区別できること", () => {
			const cache = new HashCache();
			const filePath = "file.md";
			// 同じ長さだが異なる内容
			const content1 = "abcdef";
			const content2 = "ghijkl";
			const hash1 = "hash1";
			const hash2 = "hash2";

			cache.set(filePath, content1, hash1);
			cache.set(filePath, content2, hash2);

			expect(cache.get(filePath, content1)).toBe(hash1);
			expect(cache.get(filePath, content2)).toBe(hash2);
		});
	});

	describe("hasメソッド", () => {
		it("保存されたキーに対してtrueを返すこと", () => {
			const cache = new HashCache();
			const content = "some content";
			cache.set("file.md", content, "hash");

			expect(cache.has("file.md", content)).toBe(true);
		});

		it("保存されていないキーに対してfalseを返すこと", () => {
			const cache = new HashCache();

			expect(cache.has("file.md", "some content")).toBe(false);
		});
	});

	describe("clearメソッド", () => {
		it("すべてのキャッシュをクリアできること", () => {
			const cache = new HashCache();
			const content1 = "content 1";
			const content2 = "content 2";
			cache.set("file1.md", content1, "hash1");
			cache.set("file2.md", content2, "hash2");

			expect(cache.size()).toBe(2);

			cache.clear();

			expect(cache.size()).toBe(0);
			expect(cache.has("file1.md", content1)).toBe(false);
			expect(cache.has("file2.md", content2)).toBe(false);
		});
	});

	describe("sizeメソッド", () => {
		it("キャッシュエントリ数を正しく返すこと", () => {
			const cache = new HashCache();

			expect(cache.size()).toBe(0);

			cache.set("file1.md", "content 1", "hash1");
			expect(cache.size()).toBe(1);

			cache.set("file2.md", "content 2", "hash2");
			expect(cache.size()).toBe(2);

			cache.clear();
			expect(cache.size()).toBe(0);
		});
	});

	describe("同一ファイルの2回目以降のハッシュ計算をスキップ", () => {
		it("同じファイルパスとコンテンツで2回getした場合、2回目はキャッシュから取得されること", () => {
			const cache = new HashCache();
			const filePath = ".claude/commands/einja/spec-create.md";
			const content = "a".repeat(1024);
			const hash = "abc123def456";

			// 1回目：保存
			cache.set(filePath, content, hash);

			// 2回目：取得（キャッシュヒット）
			const result1 = cache.get(filePath, content);
			const result2 = cache.get(filePath, content);

			expect(result1).toBe(hash);
			expect(result2).toBe(hash);
			expect(result1).toBe(result2);
		});
	});

	describe("キャッシュキーの一意性", () => {
		it("ファイルパスとコンテンツの組み合わせでキャッシュキーが一意であること", () => {
			const cache = new HashCache();

			// 同じファイルパス、異なるコンテンツ
			cache.set("file.md", "content A", "hash_A");
			cache.set("file.md", "content B", "hash_B");

			// 異なるファイルパス、同じコンテンツ
			cache.set("file1.md", "same content", "hash_file1");
			cache.set("file2.md", "same content", "hash_file2");

			expect(cache.get("file.md", "content A")).toBe("hash_A");
			expect(cache.get("file.md", "content B")).toBe("hash_B");
			expect(cache.get("file1.md", "same content")).toBe("hash_file1");
			expect(cache.get("file2.md", "same content")).toBe("hash_file2");

			// すべて異なるキーとして扱われている
			expect(cache.size()).toBe(4);
		});

		it("長いコンテンツでもシグネチャで正しく区別できること", () => {
			const cache = new HashCache();
			const filePath = "file.md";

			// 中央部分だけ異なる長いコンテンツ
			const base = "a".repeat(100);
			const content1 = base + "X" + base;
			const content2 = base + "Y" + base;

			cache.set(filePath, content1, "hash1");
			cache.set(filePath, content2, "hash2");

			expect(cache.get(filePath, content1)).toBe("hash1");
			expect(cache.get(filePath, content2)).toBe("hash2");
		});
	});
});
