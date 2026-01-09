import type { User as PrismaUser, UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFailure, isSuccess } from "../../../core/result";
import { UserFactory, initialize } from "../../../testing";

// Prismaクライアントをモック
vi.mock("../client", () => ({
	prisma: {
		user: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
		},
	},
}));

// モックしたprismaをインポート
import { prisma } from "../client";
import { userRepository } from "./UserRepository";

describe("UserRepository", () => {
	beforeEach(() => {
		// リポジトリテストではモックprismaを使用するため、空のオブジェクトを渡す
		// biome-ignore lint/suspicious/noExplicitAny: test fixture initialization
		initialize({ prisma: {} as any });
		vi.clearAllMocks();
	});

	describe("search", () => {
		it("ページネーション付きでユーザー一覧を取得できる", async () => {
			// Given
			const mockUsers = [
				await UserFactory.build({ id: "user-1", email: "user1@example.com" }),
				await UserFactory.build({ id: "user-2", email: "user2@example.com" }),
			];
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
			vi.mocked(prisma.user.count).mockResolvedValue(25);

			// When
			const result = await userRepository.search({}, { page: 2, limit: 10 });

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value.items).toHaveLength(2);
				expect(result.value.total).toBe(25);
				expect(result.value.page).toBe(2);
				expect(result.value.limit).toBe(10);
				expect(result.value.totalPages).toBe(3);
			}
		});

		it("検索条件なしで全件取得できる", async () => {
			// Given
			const mockUsers = [await UserFactory.build()];
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
			vi.mocked(prisma.user.count).mockResolvedValue(1);

			// When
			const result = await userRepository.search({});

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value.items).toHaveLength(1);
			}
		});

		it("statusで絞り込みできる", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockResolvedValue([]);
			vi.mocked(prisma.user.count).mockResolvedValue(0);

			// When
			await userRepository.search({ status: "active" });

			// Then
			expect(prisma.user.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ status: "active" }),
				}),
			);
		});

		it("roleで絞り込みできる", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockResolvedValue([]);
			vi.mocked(prisma.user.count).mockResolvedValue(0);

			// When
			await userRepository.search({ role: "admin" });

			// Then
			expect(prisma.user.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ role: "admin" }),
				}),
			);
		});

		it("検索テキストで名前・メールを絞り込みできる", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockResolvedValue([]);
			vi.mocked(prisma.user.count).mockResolvedValue(0);

			// When
			await userRepository.search({ search: "john" });

			// Then
			expect(prisma.user.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: [
							{ name: { contains: "john", mode: "insensitive" } },
							{ email: { contains: "john", mode: "insensitive" } },
						],
					}),
				}),
			);
		});

		it("空の検索結果でも成功を返す", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockResolvedValue([]);
			vi.mocked(prisma.user.count).mockResolvedValue(0);

			// When
			const result = await userRepository.search({});

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value.items).toHaveLength(0);
				expect(result.value.total).toBe(0);
				expect(result.value.totalPages).toBe(0);
			}
		});

		it("ページネーションのデフォルト値が適用される", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockResolvedValue([]);
			vi.mocked(prisma.user.count).mockResolvedValue(0);

			// When
			const result = await userRepository.search({});

			// Then
			expect(prisma.user.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 10,
				}),
			);
			if (isSuccess(result)) {
				expect(result.value.page).toBe(1);
				expect(result.value.limit).toBe(10);
			}
		});

		it("DBエラー時にfailure Resultを返す", async () => {
			// Given
			vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("DB connection failed"));

			// When
			const result = await userRepository.search({});

			// Then
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.message).toBe("DB connection failed");
			}
		});
	});

	describe("find", () => {
		it("条件に一致するユーザーを取得できる", async () => {
			// Given
			const mockUser = await UserFactory.build();
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

			// When
			const result = await userRepository.find({ email: "test@example.com" });

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value).not.toBeNull();
				expect(result.value?.email).toBeDefined();
			}
		});

		it("見つからない場合はnullを返す", async () => {
			// Given
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

			// When
			const result = await userRepository.find({ email: "notfound@example.com" });

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value).toBeNull();
			}
		});

		it("DBエラー時にfailure Resultを返す", async () => {
			// Given
			vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error("Query failed"));

			// When
			const result = await userRepository.find({ email: "test@example.com" });

			// Then
			expect(isFailure(result)).toBe(true);
		});
	});

	describe("findById", () => {
		it("IDでユーザーを取得できる", async () => {
			// Given
			const mockUser = await UserFactory.build({ id: "user-456" });
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

			// When
			const result = await userRepository.findById("user-456");

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value?.id).toBe("user-456");
			}
		});

		it("見つからない場合はnullを返す", async () => {
			// Given
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

			// When
			const result = await userRepository.findById("nonexistent");

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe("findByEmail", () => {
		it("メールアドレスでユーザーを取得できる", async () => {
			// Given
			const mockUser = await UserFactory.build({ email: "specific@example.com" });
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

			// When
			const result = await userRepository.findByEmail("specific@example.com");

			// Then
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.value?.email).toBe("specific@example.com");
			}
		});

		it("見つからない場合はnullを返す", async () => {
			// Given
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

			// When
			const result = await userRepository.findByEmail("notfound@example.com");

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
			const loginTime = new Date("2025-01-03T12:00:00Z");
			const updatedUser = await UserFactory.build({ lastLogin: loginTime });
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

			// When
			const result = await userRepository.updateLastLogin("user-123", loginTime);

			// Then
			expect(isSuccess(result)).toBe(true);
			expect(prisma.user.update).toHaveBeenCalledWith({
				where: { id: "user-123" },
				data: { lastLogin: loginTime },
			});
		});

		it("存在しないユーザーの更新でfailure Resultを返す", async () => {
			// Given
			vi.mocked(prisma.user.update).mockRejectedValue(new Error("Record not found"));

			// When
			const result = await userRepository.updateLastLogin("nonexistent", new Date());

			// Then
			expect(isFailure(result)).toBe(true);
		});
	});
});
