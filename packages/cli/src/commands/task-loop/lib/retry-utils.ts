/**
 * リトライユーティリティ
 *
 * 指数バックオフ付きのリトライ機能を提供
 */

export interface RetryOptions {
  /** 最大リトライ回数 */
  maxRetries: number;
  /** 初期遅延（ミリ秒） */
  initialDelayMs: number;
  /** 最大遅延（ミリ秒） */
  maxDelayMs: number;
  /** バックオフ倍率 */
  backoffMultiplier: number;
  /** リトライすべきエラーかを判定する関数 */
  shouldRetry?: (error: Error) => boolean;
  /** リトライ時のコールバック */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * 指定ミリ秒待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指数バックオフ付きリトライ
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行の場合はエラーを投げる
      if (attempt > opts.maxRetries) {
        break;
      }

      // リトライすべきでないエラーの場合は即座に投げる
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        throw lastError;
      }

      // リトライコールバック
      if (opts.onRetry) {
        opts.onRetry(attempt, lastError, delayMs);
      }

      // 待機
      await sleep(delayMs);

      // 次の遅延を計算（指数バックオフ）
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * MCP タイムアウトエラーかどうかを判定
 */
export function isMcpTimeoutError(error: Error): boolean {
  return error.message.includes("タイムアウト") || error.message.includes("timeout");
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function isRetryableError(error: Error): boolean {
  // タイムアウトエラー
  if (isMcpTimeoutError(error)) {
    return true;
  }

  // 一時的なネットワークエラー
  if (
    error.message.includes("ECONNRESET") ||
    error.message.includes("ETIMEDOUT") ||
    error.message.includes("ECONNREFUSED")
  ) {
    return true;
  }

  return false;
}

/** MCP 操作のデフォルトリトライ設定 */
export const MCP_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  shouldRetry: isRetryableError,
  onRetry: (attempt: number, error: Error, nextDelayMs: number) => {
    console.log(`   ⚠️ MCP 操作失敗 (試行 ${attempt}): ${error.message}`);
    console.log(`   🔄 ${nextDelayMs / 1000}秒後にリトライします...`);
  },
};
