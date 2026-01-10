/**
 * prefetch-users.ts
 *
 * Server Component用のユーザーデータプリフェッチ関数
 */

import { parseResponse } from "@/lib/api/parse-response";
import { type PaginatedUserList, paginatedUserListSchema } from "@/shared/schemas/user";
import { cookies, headers } from "next/headers";

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
 * prefetchUsers
 *
 * Server Component用のデータ取得関数
 */
export async function prefetchUsers(filters: UserFilters = {}): Promise<PaginatedUserList | null> {
  try {
    // リクエストヘッダーからホスト情報を取得
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // クッキーを取得して転送
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.role) params.set("role", filters.role);

    const url = `${baseUrl}/api/rpc/users?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    return parseResponse(response, paginatedUserListSchema);
  } catch (error) {
    console.error("Failed to prefetch users:", error);
    return null;
  }
}
