/**
 * route.ts
 *
 * Hono APIエントリーポイント
 * basePath: /api/rpc
 */

import { Hono } from "hono";
import { handle } from "hono/vercel";
import { userRoutes } from "@web/server/presentation/routes/userRoutes";

const app = new Hono().basePath("/api/rpc");

/**
 * ルート登録
 */
const routes = app.route("/users", userRoutes);

/**
 * 型エクスポート（Hono Client用）
 */
export type AppType = typeof routes;

/**
 * Next.js App Router統合
 */
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
