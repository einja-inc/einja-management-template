import { describe, expect, it } from "vitest";
import { User, type UserRole, type UserStatus } from "../../../domain/entities/User";
import { buildUserProps, UserFactory } from "../../../testing";
import { UserMapper } from "./UserMapper";

describe("UserMapper", () => {
	describe("toDomain", () => {
		it("DB行をDomain Userに変換できる", async () => {
			// Given
			const row = await UserFactory.build();

			// When
			const domainUser = UserMapper.toDomain(row);

			// Then
			expect(domainUser).toBeInstanceOf(User);
			expect(domainUser.id).toBe(row.id);
			expect(domainUser.email).toBe(row.email);
			expect(domainUser.name).toBe(row.name);
			expect(domainUser.status).toBe(row.status);
			expect(domainUser.role).toBe(row.role);
			expect(domainUser.createdAt).toEqual(row.createdAt);
			expect(domainUser.lastLogin).toEqual(row.lastLogin);
		});

		it("nameがnullでも変換できる", async () => {
			// Given
			const row = await UserFactory.build({ name: null });

			// When
			const domainUser = UserMapper.toDomain(row);

			// Then
			expect(domainUser.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", async () => {
			// Given
			const row = await UserFactory.build({ lastLogin: null });

			// When
			const domainUser = UserMapper.toDomain(row);

			// Then
			expect(domainUser.lastLogin).toBeNull();
		});

		describe("status変換", () => {
			it("activeを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ status: "active" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.status).toBe("active");
			});

			it("inactiveを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ status: "inactive" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.status).toBe("inactive");
			});

			it("pendingを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ status: "pending" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.status).toBe("pending");
			});
		});

		describe("role変換", () => {
			it("adminを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ role: "admin" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.role).toBe("admin");
			});

			it("userを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ role: "user" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.role).toBe("user");
			});

			it("moderatorを変換できる", async () => {
				// Given
				const row = await UserFactory.build({ role: "moderator" });

				// When
				const domainUser = UserMapper.toDomain(row);

				// Then
				expect(domainUser.role).toBe("moderator");
			});
		});
	});

	describe("toRowUpdate", () => {
		it("Domain UserをDB更新データに変換できる", async () => {
			// Given
			const props = await buildUserProps({
				name: "Updated Name",
				status: "active" satisfies UserStatus,
				role: "admin" satisfies UserRole,
				lastLogin: new Date("2025-01-03T00:00:00Z"),
			});
			const domainUser = new User(props);

			// When
			const rowData = UserMapper.toRowUpdate(domainUser);

			// Then
			expect(rowData.name).toBe("Updated Name");
			expect(rowData.status).toBe("active");
			expect(rowData.role).toBe("admin");
			expect(rowData.lastLogin).toEqual(new Date("2025-01-03T00:00:00Z"));
		});

		it("nameがnullでも変換できる", async () => {
			// Given
			const props = await buildUserProps({
				name: null,
				status: "active" satisfies UserStatus,
				role: "user" satisfies UserRole,
				lastLogin: null,
			});
			const domainUser = new User(props);

			// When
			const rowData = UserMapper.toRowUpdate(domainUser);

			// Then
			expect(rowData.name).toBeNull();
		});

		it("lastLoginがnullでも変換できる", async () => {
			// Given
			const props = await buildUserProps({
				name: "Test",
				status: "pending" satisfies UserStatus,
				role: "user" satisfies UserRole,
				lastLogin: null,
			});
			const domainUser = new User(props);

			// When
			const rowData = UserMapper.toRowUpdate(domainUser);

			// Then
			expect(rowData.lastLogin).toBeNull();
		});

		describe("status逆変換", () => {
			it("activeをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					status: "active" satisfies UserStatus,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.status).toBe("active");
			});

			it("inactiveをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					status: "inactive" satisfies UserStatus,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.status).toBe("inactive");
			});

			it("pendingをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					status: "pending" satisfies UserStatus,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.status).toBe("pending");
			});
		});

		describe("role逆変換", () => {
			it("adminをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					role: "admin" satisfies UserRole,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.role).toBe("admin");
			});

			it("userをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					role: "user" satisfies UserRole,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.role).toBe("user");
			});

			it("moderatorをDB形式に変換できる", async () => {
				// Given
				const props = await buildUserProps({
					role: "moderator" satisfies UserRole,
				});
				const domainUser = new User(props);

				// When
				const rowData = UserMapper.toRowUpdate(domainUser);

				// Then
				expect(rowData.role).toBe("moderator");
			});
		});
	});
});
