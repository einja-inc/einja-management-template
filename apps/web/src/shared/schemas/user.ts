/**
 * user.ts
 *
 * ユーザー関連のZodスキーマと型定義
 * APIレスポンスの型検証に使用
 */

import { z } from "zod";

/**
 * ユーザー一覧アイテムのレスポンススキーマ
 * APIレスポンスの型検証に使用
 */
export const userListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.enum(["active", "inactive", "pending"]),
  role: z.enum(["admin", "user", "moderator"]),
  createdAt: z.string(),
  lastLogin: z.string().nullable(),
});

/**
 * ページネーション付きユーザー一覧のレスポンススキーマ
 */
export const paginatedUserListSchema = z.object({
  items: z.array(userListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type UserListItem = z.infer<typeof userListItemSchema>;
export type PaginatedUserList = z.infer<typeof paginatedUserListSchema>;
