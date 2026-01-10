/**
 * userRoutes.ts
 *
 * Hono APIルート定義（Presentation層）
 * ユーザー一覧・詳細取得エンドポイント
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  userListQuerySchema,
  userIdParamSchema,
} from "@repo/server-core/domain/validators/user";
import { userUseCases } from "@web/application/use-cases/UserUseCases";

/**
 * ユーザーAPI ルート
 *
 * 重要: メソッドチェーン形式で定義（型推論のため）
 */
export const userRoutes = new Hono()
  .get("/", zValidator("query", userListQuerySchema), async (c) => {
    const query = c.req.valid("query");

    const result = await userUseCases.list(
      {
        search: query.search,
        status: query.status,
        role: query.role,
      },
      {
        page: query.page,
        limit: query.limit,
      }
    );

    if (!result.isSuccess) {
      return c.json({ error: result.error.message }, 500);
    }

    return c.json(result.value);
  })
  .get("/:id", zValidator("param", userIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");

    const result = await userUseCases.getById(id);

    if (!result.isSuccess) {
      return c.json({ error: result.error.message }, 500);
    }

    if (!result.value) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(result.value);
  });
