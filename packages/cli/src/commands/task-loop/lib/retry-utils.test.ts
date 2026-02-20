import { describe, expect, it, vi } from "vitest";
import { isMcpTimeoutError, isRetryableError, withRetry } from "./retry-utils.js";

describe("retry-utils", () => {
  describe("withRetry", () => {
    it("成功した場合、結果を返す", async () => {
      // Given: 成功する関数
      const fn = vi.fn().mockResolvedValue("success");

      // When: withRetryを呼び出す
      const result = await withRetry(fn);

      // Then: 結果が返る
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("失敗後にリトライして成功した場合、結果を返す", async () => {
      // Given: 2回失敗して3回目に成功する関数
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      // When: withRetryを呼び出す（リトライ3回、初期遅延10ms）
      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      // Then: 3回目で成功し、結果が返る
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("最大リトライ回数を超えた場合、エラーを投げる", async () => {
      // Given: 常に失敗する関数
      const fn = vi.fn().mockRejectedValue(new Error("always fail"));

      // When/Then: 最大リトライ回数を超えるとエラーが投げられる
      await expect(
        withRetry(fn, { maxRetries: 2, initialDelayMs: 10 })
      ).rejects.toThrow("always fail");

      // Then: 3回試行される（初回 + リトライ2回）
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("shouldRetry が false を返す場合、即座にエラーを投げる", async () => {
      // Given: 失敗する関数とリトライしない設定
      const fn = vi.fn().mockRejectedValue(new Error("no retry"));

      // When/Then: リトライせずにエラーが投げられる
      await expect(
        withRetry(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
          shouldRetry: () => false,
        })
      ).rejects.toThrow("no retry");

      // Then: 1回のみ試行される
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("onRetry コールバックが呼ばれる", async () => {
      // Given: リトライ時のコールバック
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("success");
      const onRetry = vi.fn();

      // When: withRetryを呼び出す
      await withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
        onRetry,
      });

      // Then: onRetryが呼ばれる
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10);
    });

    it("指数バックオフが機能する", async () => {
      // Given: 複数回失敗する関数
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");
      const onRetry = vi.fn();

      // When: withRetryを呼び出す（バックオフ倍率2）
      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        onRetry,
      });

      // Then: 遅延が指数的に増加する
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 200);
    });

    it("最大遅延を超えない", async () => {
      // Given: 複数回失敗する関数
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockRejectedValueOnce(new Error("fail 3"))
        .mockResolvedValue("success");
      const onRetry = vi.fn();

      // When: withRetryを呼び出す（最大遅延150ms）
      await withRetry(fn, {
        maxRetries: 4,
        initialDelayMs: 100,
        maxDelayMs: 150,
        backoffMultiplier: 2,
        onRetry,
      });

      // Then: 遅延が最大値を超えない
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 150); // 200 → 150に制限
      expect(onRetry).toHaveBeenNthCalledWith(3, 3, expect.any(Error), 150);
    });
  });

  describe("isMcpTimeoutError", () => {
    it("タイムアウトエラーを検出する", () => {
      // Given: タイムアウトエラー
      const error1 = new Error("MCP 呼び出しがタイムアウトしました");
      const error2 = new Error("Connection timeout");

      // When/Then: タイムアウトエラーとして検出される
      expect(isMcpTimeoutError(error1)).toBe(true);
      expect(isMcpTimeoutError(error2)).toBe(true);
    });

    it("タイムアウトエラーでない場合、falseを返す", () => {
      // Given: 通常のエラー
      const error = new Error("Other error");

      // When/Then: タイムアウトエラーとして検出されない
      expect(isMcpTimeoutError(error)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("タイムアウトエラーをリトライ可能と判定する", () => {
      // Given: タイムアウトエラー
      const error = new Error("タイムアウトしました");

      // When/Then: リトライ可能と判定される
      expect(isRetryableError(error)).toBe(true);
    });

    it("ECONNRESET エラーをリトライ可能と判定する", () => {
      // Given: ECONNRESET エラー
      const error = new Error("ECONNRESET: Connection reset by peer");

      // When/Then: リトライ可能と判定される
      expect(isRetryableError(error)).toBe(true);
    });

    it("ETIMEDOUT エラーをリトライ可能と判定する", () => {
      // Given: ETIMEDOUT エラー
      const error = new Error("ETIMEDOUT: Connection timed out");

      // When/Then: リトライ可能と判定される
      expect(isRetryableError(error)).toBe(true);
    });

    it("ECONNREFUSED エラーをリトライ可能と判定する", () => {
      // Given: ECONNREFUSED エラー
      const error = new Error("ECONNREFUSED: Connection refused");

      // When/Then: リトライ可能と判定される
      expect(isRetryableError(error)).toBe(true);
    });

    it("バリデーションエラーをリトライ不可能と判定する", () => {
      // Given: バリデーションエラー
      const error = new Error("Validation error: Invalid input");

      // When/Then: リトライ不可能と判定される
      expect(isRetryableError(error)).toBe(false);
    });

    it("通常のエラーをリトライ不可能と判定する", () => {
      // Given: 通常のエラー
      const error = new Error("Something went wrong");

      // When/Then: リトライ不可能と判定される
      expect(isRetryableError(error)).toBe(false);
    });
  });
});
