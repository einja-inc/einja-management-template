import type { User as PrismaUser, UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { User } from "../../../domain/entities/User";
import { UserFactory, initialize } from "../../../testing";
import { UserMapper } from "./UserMapper";

describe("UserMapper", () => {
	beforeAll(() => {
		// マッパーテストではPrismaクライアントは使用しないため、空のオブジェクトを渡す
		// biome-ignore lint/suspicious/noExplicitAny: test fixture initialization
		initialize({ prisma: {} as any });
	});

	describe("toDomain", () => {
		it("PrismaUserをDomain Userに変換できる", async () => {
			// Given
			const prismaUser = await UserFactory.build();

			// When
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			const domainUser = UserMapper.toDomain(prismaUser as any);

			// Then
			expect(domainUser).toBeInstanceOf(User);
			expect(domainUser.id).toBe(prismaUser.id);
			expect(domainUser.email).toBe(prismaUser.email);
			expect(domainUser.name).toBe(prismaUser.name);
			expect(domainUser.status).toBe(prismaUser.status);
			expect(domainUser.role).toBe(prismaUser.role);
			expect(domainUser.createdAt).toEqual(prismaUser.createdAt);
			expect(domainUser.lastLogin).toEqual(prismaUser.lastLogin);
		});

		it("nameがnullでも変換できる", async () => {
			// Given
			const prismaUser = await UserFactory.build({ name: null });

			// When
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			const domainUser = UserMapper.toDomain(prismaUser as any);

			// Then
			expect(domainUser.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", async () => {
			// Given
			const prismaUser = await UserFactory.build({ lastLogin: null });

			// When
			// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
			const domainUser = UserMapper.toDomain(prismaUser as any);

			// Then
			expect(domainUser.lastLogin).toBeNull();
		});

		describe("status変換", () => {
			it("activeを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ status: "active" as PrismaUserStatus });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.status).toBe("active");
			});

			it("inactiveを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ status: "inactive" as PrismaUserStatus });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.status).toBe("inactive");
			});

			it("pendingを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ status: "pending" as PrismaUserStatus });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.status).toBe("pending");
			});
		});

		describe("role変換", () => {
			it("adminを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ role: "admin" as PrismaUserRole });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.role).toBe("admin");
			});

			it("userを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ role: "user" as PrismaUserRole });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.role).toBe("user");
			});

			it("moderatorを変換できる", async () => {
				// Given
				const prismaUser = await UserFactory.build({ role: "moderator" as PrismaUserRole });

				// When
				// biome-ignore lint/suspicious/noExplicitAny: test with factory-generated data
				const domainUser = UserMapper.toDomain(prismaUser as any);

				// Then
				expect(domainUser.role).toBe("moderator");
			});
		});
	});

	describe("toPrismaUpdate", () => {
		it("Domain UserをPrisma更新データに変換できる", async () => {
			// Given
			const props = await UserFactory.build({
				name: "Updated Name",
				status: "active" as PrismaUserStatus,
				role: "admin" as PrismaUserRole,
				lastLogin: new Date("2025-01-03T00:00:00Z"),
			});
			const domainUser = new User(props);

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.name).toBe("Updated Name");
			expect(prismaData.status).toBe("active");
			expect(prismaData.role).toBe("admin");
			expect(prismaData.lastLogin).toEqual(new Date("2025-01-03T00:00:00Z"));
		});

		it("nameがnullでも変換できる", async () => {
			// Given
			const props = await UserFactory.build({
				name: null,
				status: "active" as PrismaUserStatus,
				role: "user" as PrismaUserRole,
				lastLogin: null,
			});
			const domainUser = new User(props);

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", async () => {
			// Given
			const props = await UserFactory.build({
				name: "Test",
				status: "pending" as PrismaUserStatus,
				role: "user" as PrismaUserRole,
				lastLogin: null,
			});
			const domainUser = new User(props);

			// When
			const prismaData = UserMapper.toPrismaUpdate(domainUser);

			// Then
			expect(prismaData.lastLogin).toBeNull();
		});

		describe("status逆変換", () => {
			it("activeをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					status: "active" as PrismaUserStatus,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("active");
			});

			it("inactiveをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					status: "inactive" as PrismaUserStatus,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("inactive");
			});

			it("pendingをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					status: "pending" as PrismaUserStatus,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.status).toBe("pending");
			});
		});

		describe("role逆変換", () => {
			it("adminをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					role: "admin" as PrismaUserRole,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("admin");
			});

			it("userをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					role: "user" as PrismaUserRole,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("user");
			});

			it("moderatorをPrisma形式に変換できる", async () => {
				// Given
				const props = await UserFactory.build({
					role: "moderator" as PrismaUserRole,
				});
				const domainUser = new User(props);

				// When
				const prismaData = UserMapper.toPrismaUpdate(domainUser);

				// Then
				expect(prismaData.role).toBe("moderator");
			});
		});
	});
});
