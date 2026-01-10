/**
 * api-client.ts
 *
 * Hono Client設定
 * 型安全なAPI呼び出しを提供
 */

import type { AppType } from "@/app/api/rpc/[[...route]]/route";
import { hc } from "hono/client";

/**
 * Hono Client インスタンス
 *
 * 使用方法:
 * - 一覧取得: apiClient.api.rpc.users.$get({ query: { page: "1", limit: "10" } })
 * - 詳細取得: apiClient.api.rpc.users[":id"].$get({ param: { id: "..." } })
 */
export const apiClient = hc<AppType>("/");
