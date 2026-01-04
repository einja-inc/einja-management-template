/**
 * UserUseCases
 *
 * ユーザー関連のユースケース。
 * Domain層とInfrastructure層を組み合わせてビジネスロジックを実行。
 */

import { type Result, failure, success } from "@repo/server-core/core/result";
import type { User } from "@repo/server-core/domain/entities/User";
import type {
  PaginatedResult,
  PaginationOptions,
  UserSearchCriteria,
} from "@repo/server-core/domain/repository-interfaces/IUserRepository";
import { userRepository } from "@repo/server-core/infrastructure/database/repositories/UserRepository";

/**
 * ユーザー一覧表示用のDTO
 */
export interface UserListItem {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: "active" | "inactive" | "pending";
  readonly role: "admin" | "user" | "moderator";
  readonly createdAt: string;
  readonly lastLogin: string | null;
}

/**
 * ページネーション付きユーザー一覧のDTO
 */
export interface PaginatedUserList {
  readonly items: readonly UserListItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/**
 * User Entity を UserListItem DTO に変換
 */
function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  };
}

/**
 * PaginatedResult<User> を PaginatedUserList に変換
 */
function toPaginatedUserList(result: PaginatedResult<User>): PaginatedUserList {
  return {
    items: result.items.map(toUserListItem),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

/**
 * ユーザー関連のユースケース
 */
export const userUseCases = {
  /**
   * ユーザー一覧を取得
   */
  async list(
    criteria?: UserSearchCriteria,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedUserList, Error>> {
    const result = await userRepository.search(criteria ?? {}, pagination);
    if (!result.isSuccess) {
      return failure(result.error);
    }
    return success(toPaginatedUserList(result.value));
  },

  /**
   * IDでユーザーを取得
   */
  async getById(id: string): Promise<Result<UserListItem | null, Error>> {
    const result = await userRepository.findById(id);
    if (!result.isSuccess) {
      return failure(result.error);
    }
    return success(result.value ? toUserListItem(result.value) : null);
  },

  /**
   * メールアドレスでユーザーを取得
   */
  async getByEmail(email: string): Promise<Result<UserListItem | null, Error>> {
    const result = await userRepository.findByEmail(email);
    if (!result.isSuccess) {
      return failure(result.error);
    }
    return success(result.value ? toUserListItem(result.value) : null);
  },

  /**
   * 最終ログイン日時を更新
   */
  async updateLastLogin(id: string): Promise<Result<void, Error>> {
    return userRepository.updateLastLogin(id, new Date());
  },
};
