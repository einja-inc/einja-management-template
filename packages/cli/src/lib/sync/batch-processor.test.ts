import { describe, expect, it, vi } from "vitest";
import { BatchProcessor } from "./batch-processor.js";

describe("BatchProcessor", () => {
  describe("processBatchメソッド", () => {
    it("10ファイル単位でバッチ処理を実行すること", async () => {
      const processor = new BatchProcessor(10);
      const items = Array.from({ length: 25 }, (_, i) => i); // 25個のアイテム
      const mockFn = vi.fn(async (item: number) => item * 2);

      const results = await processor.processBatch(items, mockFn);

      // 全アイテムが処理されること
      expect(results).toHaveLength(25);
      expect(results).toEqual(items.map((i) => i * 2));
      expect(mockFn).toHaveBeenCalledTimes(25);
    });

    it("空の配列を渡した場合、空の結果を返すこと", async () => {
      const processor = new BatchProcessor(10);
      const items: number[] = [];
      const mockFn = vi.fn(async (item: number) => item);

      const results = await processor.processBatch(items, mockFn);

      expect(results).toEqual([]);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("アイテム数がバッチサイズより少ない場合、1バッチで処理されること", async () => {
      const processor = new BatchProcessor(10);
      const items = [1, 2, 3]; // 3個のアイテム
      const mockFn = vi.fn(async (item: number) => item * 2);

      const results = await processor.processBatch(items, mockFn);

      expect(results).toEqual([2, 4, 6]);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("バッチサイズちょうどのアイテム数の場合、1バッチで処理されること", async () => {
      const processor = new BatchProcessor(10);
      const items = Array.from({ length: 10 }, (_, i) => i);
      const mockFn = vi.fn(async (item: number) => item);

      const results = await processor.processBatch(items, mockFn);

      expect(results).toHaveLength(10);
      expect(mockFn).toHaveBeenCalledTimes(10);
    });

    it.skip("100ファイルの処理を並列化できること", async () => {
      const processor = new BatchProcessor(10);
      const items = Array.from({ length: 100 }, (_, i) => i);
      const mockFn = vi.fn(async (item: number) => {
        // 簡易的な非同期処理をシミュレート
        await new Promise((resolve) => setTimeout(resolve, 1));
        return item * 2;
      });

      const startTime = Date.now();
      const results = await processor.processBatch(items, mockFn);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(mockFn).toHaveBeenCalledTimes(100);

      // 並列処理により処理時間が短縮されることを確認（目安: 100ms未満）
      // バッチサイズ10で100ファイル = 10バッチ
      // 各バッチは並列実行されるため、10バッチ × 1ms = 約10ms（実際はオーバーヘッドがあるので100ms以内）
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("エラーが発生した場合、Promiseがrejectされること", async () => {
      const processor = new BatchProcessor(10);
      const items = [1, 2, 3];
      const mockFn = vi.fn(async (item: number) => {
        if (item === 2) {
          throw new Error("処理エラー");
        }
        return item;
      });

      await expect(processor.processBatch(items, mockFn)).rejects.toThrow("処理エラー");
    });
  });

  describe("getBatchSizeメソッド", () => {
    it("設定されたバッチサイズを返すこと", () => {
      const processor = new BatchProcessor(10);
      expect(processor.getBatchSize()).toBe(10);
    });

    it("カスタムバッチサイズを設定できること", () => {
      const processor = new BatchProcessor(20);
      expect(processor.getBatchSize()).toBe(20);
    });
  });

  describe("setBatchSizeメソッド", () => {
    it("バッチサイズを変更できること", () => {
      const processor = new BatchProcessor(10);
      processor.setBatchSize(20);
      expect(processor.getBatchSize()).toBe(20);
    });

    it("バッチサイズが0以下の場合、エラーを投げること", () => {
      const processor = new BatchProcessor(10);
      expect(() => processor.setBatchSize(0)).toThrow("バッチサイズは1以上である必要があります");
      expect(() => processor.setBatchSize(-1)).toThrow("バッチサイズは1以上である必要があります");
    });
  });

  describe("並列処理の効果検証", () => {
    it("バッチ内のアイテムが並列に処理されること", async () => {
      const processor = new BatchProcessor(3);
      const executionOrder: number[] = [];

      const items = [1, 2, 3, 4, 5];
      const mockFn = vi.fn(async (item: number) => {
        // 非同期処理の開始を記録
        executionOrder.push(item);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item;
      });

      await processor.processBatch(items, mockFn);

      // バッチ1: 1, 2, 3が並列処理
      // バッチ2: 4, 5が並列処理
      expect(executionOrder.slice(0, 3)).toEqual([1, 2, 3]);
      expect(executionOrder.slice(3)).toEqual([4, 5]);
    });
  });
});
