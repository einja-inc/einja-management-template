/**
 * use-users.ts
 *
 * Tanstack Query hooks for user data management
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PaginatedUserList } from "@web/application/use-cases/UserUseCases";

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
export function useUsers(
  filters: UserFilters = {},
  initialData?: PaginatedUserList
) {
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

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      return response.json() as Promise<PaginatedUserList>;
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

      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }

      return response.json();
    },
    enabled: !!id,
  });
}

/**
 * prefetchUsers
 *
 * Server Component用のデータ取得関数
 */
export async function prefetchUsers(
  filters: UserFilters = {}
): Promise<PaginatedUserList> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();

  if (filters.page) params.set("page", filters.page.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.role) params.set("role", filters.role);

  const url = `${baseUrl}/api/rpc/users?${params.toString()}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to prefetch users");
  }

  return response.json();
}
