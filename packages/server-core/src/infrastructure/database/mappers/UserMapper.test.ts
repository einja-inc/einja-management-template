import type { User as PrismaUser, UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { User } from "../../../domain/entities/User";
import { UserMapper } from "./UserMapper";

describe("UserMapper", () => {
	const createPrismaUser = (overrides: Partial<PrismaUser> = {}): PrismaUser => ({
		id: "user-123",
		email: "test@example.com",
		name: "Test User",
		emailVerified: null,
		image: null,
		password: "hashed-password",
		status: "active" as PrismaUserStatus,
		role: "user" as PrismaUserRole,
		createdAt: new Date("2025-01-01T00:00:00Z"),
		updatedAt: new Date("2025-01-01T00:00:00Z"),
		lastLogin: new Date("2025-01-02T00:00:00Z"),
		...overrides,
	});

	describe("toDomain", () => {
		it("PrismaUserをDomain Userに変換できる", () => {
			// Given
			const prismaUser = createPrismaUser();

			// When
			const domainUser = UserMapper.toDomain(prismaUser);

			// Then
			expect(domainUser).toBeInstanceOf(User);
			expect(domainUser.id).toBe("user-123");
			expect(domainUser.email).toBe("test@example.com");
			expect(domainUser.name).toBe("Test User");
			expect(domainUser.status).toBe("active");
			expect(domainUser.role).toBe("user");
			expect(domainUser.createdAt).toEqual(new Date("2025-01-01T00:00:00Z"));
			expect(domainUser.lastLogin).toEqual(new Date("2025-01-02T00:00:00Z"));
		});

		it("nameがnullでも変換できる", () => {
			// Given
			const prismaUser = createPrismaUser({ name: null });

			// When
			const domainUser = UserMapper.toDomain(prismaUser);

			// Then
			expect(domainUser.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", () => {
			// Given
			const prismaUser = createPrismaUser({ lastLogin: null });

			// When
			const domainUser = UserMapper.toDomain(prismaUser);

			// Then
			expect(domainUser.lastLogin).toBeNull();
		});

		describe("status変換", () => {
			it("activeを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ status: "active" as PrismaUserStatus });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.status).toBe("active");
			});

			it("inactiveを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ status: "inactive" as PrismaUserStatus });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.status).toBe("inactive");
			});

			it("pendingを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ status: "pending" as PrismaUserStatus });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.status).toBe("pending");
			});
		});

		describe("role変換", () => {
			it("adminを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ role: "admin" as PrismaUserRole });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.role).toBe("admin");
			});

			it("userを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ role: "user" as PrismaUserRole });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.role).toBe("user");
			});

			it("moderatorを変換できる", () => {
				// Given
				const prismaUser = createPrismaUser({ role: "moderator" as PrismaUserRole });

				// When
				const domainUser = UserMapper.toDomain(prismaUser);

				// Then
				expect(domainUser.role).toBe("moderator");
			});
		});
	});

	describe("toPrismaUpdate", () => {
		it("Domain UserをPrisma更新データに変換できる", () => {
			// Given
			const domainUser = new User({
				id: "user-123",
				email: "test@example.com",
				name: "Updated Name",
				status: "active",
				role: "admin",
				createdAt: new Date("2025-01-01T00:00:00Z"),
				lastLogin: new Date("2025-01-03T00:00:00Z"),
			});

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.name).toBe("Updated Name");
			expect(prismaData.status).toBe("active");
			expect(prismaData.role).toBe("admin");
			expect(prismaData.lastLogin).toEqual(new Date("2025-01-03T00:00:00Z"));
		});

		it("nameがnullでも変換できる", () => {
			// Given
			const domainUser = new User({
				id: "user-123",
				email: "test@example.com",
				name: null,
				status: "active",
				role: "user",
				createdAt: new Date("2025-01-01T00:00:00Z"),
				lastLogin: null,
			});

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", () => {
			// Given
			const domainUser = new User({
				id: "user-123",
				email: "test@example.com",
				name: "Test",
				status: "pending",
				role: "user",
				createdAt: new Date("2025-01-01T00:00:00Z"),
				lastLogin: null,
			});

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.lastLogin).toBeNull();
		});

		describe("status逆変換", () => {
			it("activeをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "active",
					role: "user",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("active");
			});

			it("inactiveをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "inactive",
					role: "user",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("inactive");
			});

			it("pendingをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "pending",
					role: "user",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("pending");
			});
		});

		describe("role逆変換", () => {
			it("adminをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "active",
					role: "admin",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("admin");
			});

			it("userをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "active",
					role: "user",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("user");
			});

			it("moderatorをPrisma形式に変換できる", () => {
				// Given
				const domainUser = new User({
					id: "user-123",
					email: "test@example.com",
					name: null,
					status: "active",
					role: "moderator",
					createdAt: new Date(),
					lastLogin: null,
				});

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("moderator");
			});
		});
	});
});
