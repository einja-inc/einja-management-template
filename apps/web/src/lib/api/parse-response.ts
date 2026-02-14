/**
 * parse-response.ts
 *
 * Zodスキーマによるレスポンス検証とエラーハンドリング
 */

import type { z } from "zod";

/**
 * APIエラークラス
 *
 * APIレスポンスのエラーを表現する
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * JSONを安全にパースする
 *
 * @param response - Fetchレスポンス
 * @returns パース結果（失敗時は空オブジェクト）
 */
async function safeJsonParse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // JSONパースに失敗した場合は空オブジェクトを返す
    return {};
  }
}

/**
 * エラーレスポンスからエラー情報を抽出する
 *
 * バックエンドの形式: { error: string } または { error: { code, message, details } }
 *
 * @param json - パースされたJSON
 * @param statusCode - HTTPステータスコード
 * @returns エラー情報
 */
function extractErrorInfo(
  json: unknown,
  _statusCode: number
): { code: string; message: string; details?: Record<string, unknown> } {
  if (typeof json === "object" && json !== null && "error" in json) {
    const errorField = (json as { error: unknown }).error;

    // { error: string } 形式
    if (typeof errorField === "string") {
      return {
        code: "API_ERROR",
        message: errorField,
      };
    }

    // { error: { code, message, details } } 形式
    if (typeof errorField === "object" && errorField !== null) {
      const errObj = errorField as {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
      };
      return {
        code: errObj.code ?? "API_ERROR",
        message: errObj.message ?? "An unknown error occurred",
        details: errObj.details,
      };
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred",
  };
}

/**
 * レスポンスをパースしてZodスキーマで検証
 *
 * @param response - Fetchレスポンス
 * @param schema - Zodスキーマ
 * @returns バリデーション済みのデータ
 * @throws ApiError - レスポンスエラーまたはバリデーションエラー
 */
export async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  // エラーレスポンスの場合
  if (!response.ok) {
    const json = await safeJsonParse(response);
    const errorInfo = extractErrorInfo(json, response.status);
    throw new ApiError(errorInfo.code, errorInfo.message, response.status, errorInfo.details);
  }

  // 成功レスポンスの場合
  const json = await safeJsonParse(response);

  // Zodスキーマでバリデーション
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Response validation failed", response.status, {
      zodErrors: result.error.flatten(),
    });
  }

  return result.data;
}
