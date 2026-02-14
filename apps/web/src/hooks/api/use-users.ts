/**
 * use-users.ts
 *
 * Tanstack Query hooks for user data management
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { parseResponse } from "@/lib/api/parse-response";
import {
  type PaginatedUserList,
  paginatedUserListSchema,
  userListItemSchema,
} from "@/shared/schemas/user";

/**
 * QueryKey factory for users
 */
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

/**
 * User filters type
 */
export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive";
  role?: "admin" | "user";
}

/**
 * useUsers hook
 *
 * ユーザー一覧を取得するhook
 */
export function useUsers(filters: UserFilters = {}, initialData?: PaginatedUserList) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.api.rpc.users.$get({
        query: {
          page: filters.page?.toString() ?? "1",
          limit: filters.limit?.toString() ?? "10",
          search: filters.search,
          status: filters.status,
          role: filters.role,
        },
      });

      return parseResponse(response, paginatedUserListSchema);
    },
    initialData,
  });
}

/**
 * useUser hook
 *
 * 特定のユーザーを取得するhook
 */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.api.rpc.users[":id"].$get({
        param: { id },
      });

      return parseResponse(response, userListItemSchema);
    },
    enabled: !!id,
  });
}
