import { z } from "zod";

/**
 * ユーザー一覧取得クエリパラメータスキーマ
 */
export const userListQuerySchema = z.object({
  page: z.string().optional().default("1").transform(Number),
  limit: z.string().optional().default("10").transform(Number),
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

/**
 * ユーザーIDパスパラメータスキーマ
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
