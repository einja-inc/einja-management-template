import { failure, isFailure, isSuccess, success } from "@repo/server-core/core/result";
import { User } from "@repo/server-core/domain/entities/User";
import type { PaginatedResult } from "@repo/server-core/domain/repository-interfaces/IUserRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userUseCases } from "./UserUseCases";

// UserRepositoryをモック
vi.mock("@repo/server-core/infrastructure/database/repositories/UserRepository", () => ({
  userRepository: {
    search: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    updateLastLogin: vi.fn(),
  },
}));

import { userRepository } from "@repo/server-core/infrastructure/database/repositories/UserRepository";

describe("UserUseCases", () => {
  const createMockUser = (overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User =>
    new User({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      status: "active",
      role: "user",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      lastLogin: new Date("2025-01-02T00:00:00Z"),
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("ユーザー一覧をDTO形式で取得できる", async () => {
      // Given
      const mockUsers = [
        createMockUser({ id: "user-1", email: "user1@example.com" }),
        createMockUser({ id: "user-2", email: "user2@example.com" }),
      ];
      const mockPaginatedResult: PaginatedResult<User> = {
        items: mockUsers,
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      };
      vi.mocked(userRepository.search).mockResolvedValue(success(mockPaginatedResult));

      // When
      const result = await userUseCases.list();

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0]).toEqual({
          id: "user-1",
          name: "Test User",
          email: "user1@example.com",
          status: "active",
          role: "user",
          createdAt: "2025-01-01T00:00:00.000Z",
          lastLogin: "2025-01-02T00:00:00.000Z",
        });
        expect(result.value.total).toBe(25);
        expect(result.value.page).toBe(1);
        expect(result.value.limit).toBe(10);
        expect(result.value.totalPages).toBe(3);
      }
    });

    it("nameがnullの場合、空文字に変換される", async () => {
      // Given
      const mockUser = createMockUser({ name: null });
      const mockPaginatedResult: PaginatedResult<User> = {
        items: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      vi.mocked(userRepository.search).mockResolvedValue(success(mockPaginatedResult));

      // When
      const result = await userUseCases.list();

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.items[0].name).toBe("");
      }
    });

    it("lastLoginがnullの場合、nullのまま返される", async () => {
      // Given
      const mockUser = createMockUser({ lastLogin: null });
      const mockPaginatedResult: PaginatedResult<User> = {
        items: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      vi.mocked(userRepository.search).mockResolvedValue(success(mockPaginatedResult));

      // When
      const result = await userUseCases.list();

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.items[0].lastLogin).toBeNull();
      }
    });

    it("検索条件とページネーションがリポジトリに渡される", async () => {
      // Given
      const criteria = { status: "active" as const };
      const pagination = { page: 2, limit: 20 };
      vi.mocked(userRepository.search).mockResolvedValue(
        success({
          items: [],
          total: 0,
          page: 2,
          limit: 20,
          totalPages: 0,
        })
      );

      // When
      await userUseCases.list(criteria, pagination);

      // Then
      expect(userRepository.search).toHaveBeenCalledWith(criteria, pagination);
    });

    it("Repository失敗時にfailure Resultを返す", async () => {
      // Given
      vi.mocked(userRepository.search).mockResolvedValue(failure(new Error("DB error")));

      // When
      const result = await userUseCases.list();

      // Then
      expect(isFailure(result)).toBe(true);
    });
  });

  describe("getById", () => {
    it("IDでユーザーをDTO形式で取得できる", async () => {
      // Given
      const mockUser = createMockUser();
      vi.mocked(userRepository.findById).mockResolvedValue(success(mockUser));

      // When
      const result = await userUseCases.getById("user-123");

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value?.id).toBe("user-123");
        expect(result.value?.email).toBe("test@example.com");
      }
    });

    it("見つからない場合はnullを返す", async () => {
      // Given
      vi.mocked(userRepository.findById).mockResolvedValue(success(null));

      // When
      const result = await userUseCases.getById("nonexistent");

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("getByEmail", () => {
    it("メールアドレスでユーザーをDTO形式で取得できる", async () => {
      // Given
      const mockUser = createMockUser();
      vi.mocked(userRepository.findByEmail).mockResolvedValue(success(mockUser));

      // When
      const result = await userUseCases.getByEmail("test@example.com");

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value?.email).toBe("test@example.com");
      }
    });

    it("見つからない場合はnullを返す", async () => {
      // Given
      vi.mocked(userRepository.findByEmail).mockResolvedValue(success(null));

      // When
      const result = await userUseCases.getByEmail("notfound@example.com");

      // Then
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("updateLastLogin", () => {
    it("最終ログイン日時を更新できる", async () => {
      // Given
      vi.mocked(userRepository.updateLastLogin).mockResolvedValue(success(undefined));

      // When
      const result = await userUseCases.updateLastLogin("user-123");

      // Then
      expect(isSuccess(result)).toBe(true);
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith("user-123", expect.any(Date));
    });

    it("Repository失敗時にfailure Resultを返す", async () => {
      // Given
      vi.mocked(userRepository.updateLastLogin).mockResolvedValue(
        failure(new Error("Update failed"))
      );

      // When
      const result = await userUseCases.updateLastLogin("user-123");

      // Then
      expect(isFailure(result)).toBe(true);
    });
  });
});
